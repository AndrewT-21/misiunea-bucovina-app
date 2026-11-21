// MISIBI_YOUTUBE_REFERER_FIX: tentative embed configuration; external YouTube button retained.
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { createElement, useCallback, useEffect, useState } from 'react';
import { WebView } from 'react-native-webview';
import { Alert } from '../../lib/platform-alert';

import {
  ActivityIndicator,

  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccountItem, setAccountItem } from '../../lib/account-storage';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';

type ProjectImage = {
  id: string;
  image_url: string;
  display_order: number;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  impact: string | null;
  urgent_needs: string | null;
  how_to_help: string | null;
  video_url: string | null;
  image_url: string | null;
  status: 'active' | 'seasonal' | 'permanent' | 'planned';
};

export default function ProjectDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [project, setProject] =
    useState<Project | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [galleryImages, setGalleryImages] =
    useState<ProjectImage[]>([]);

  const [currentImageIndex, setCurrentImageIndex] =
    useState(0);

  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const favoriteKey = 'favorite_project_ids';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadFavorite() {
        if (!id) return;
        try {
          const stored = await getAccountItem(favoriteKey);
          const parsed: unknown = stored ? JSON.parse(stored) : [];
          if (active) setIsFavorite(Array.isArray(parsed) && parsed.includes(id));
        } catch (error) {
          console.log('Eroare încărcare favorite:', error);
          if (active) setIsFavorite(false);
        }
      }
      void loadFavorite();
      return () => { active = false; };
    }, [id])
  );

  async function toggleFavorite() {
    if (!id || favoriteSaving) return;
    setFavoriteSaving(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) {
        Alert.alert('Autentificare necesară', 'Conectează-te pentru a salva favorite.', [
          { text: 'Anulează', style: 'cancel' },
          { text: 'Autentificare', onPress: () => router.push('/alege-cont') },
        ]);
        return;
      }
      const stored = await getAccountItem(favoriteKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      const ids: string[] = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
      const exists = ids.includes(id);
      const updated = exists ? ids.filter(x => x !== id) : [...ids, id];
      await setAccountItem(favoriteKey, JSON.stringify(updated));
      setIsFavorite(!exists);
    } catch (error: any) {
      console.log('Eroare salvare favorite:', error);
      Alert.alert('Eroare', error?.message ?? 'Nu am putut actualiza favoritele.');
    } finally {
      setFavoriteSaving(false);
    }
  }

  useEffect(() => {
    if (id) {
      loadProject();
    }
  }, [id]);

  async function loadProject() {
    setLoading(true);

    const { data, error } = await supabase
      .from('projects')
      .select(
        'id, title, description, content, impact, urgent_needs, how_to_help, video_url, image_url, status'
      )
      .eq('id', id)
      .in('status', ['active', 'seasonal', 'permanent', 'planned'])
      .maybeSingle();

    if (error) {
      console.log(
        'Eroare încărcare proiect:',
        error
      );
    }

    const loadedProject =
      error ? null : (data as Project | null);

    setProject(loadedProject);

    if (loadedProject) {
      const { data: galleryData, error: galleryError } =
        await supabase
          .from('project_images')
          .select('id, image_url, display_order')
          .eq('project_id', loadedProject.id)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true });

      if (galleryError) {
        console.log(
          'Eroare încărcare galerie proiect:',
          galleryError
        );
        setGalleryImages([]);
      } else {
        setGalleryImages(
          (galleryData ?? []) as ProjectImage[]
        );
      }
    } else {
      setGalleryImages([]);
    }

    setCurrentImageIndex(0);
    setLoading(false);
  }

  const projectImages = project
    ? [
        ...(project.image_url
          ? [{ id: 'main', image_url: project.image_url, display_order: -1 }]
          : []),
        ...galleryImages.filter(
          (image) => image.image_url !== project.image_url
        ),
      ]
    : [];

  useEffect(() => {
    if (projectImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((current) =>
        current === projectImages.length - 1
          ? 0
          : current + 1
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [projectImages.length]);

  function showPreviousImage() {
    if (projectImages.length <= 1) return;

    setCurrentImageIndex((current) =>
      current === 0
        ? projectImages.length - 1
        : current - 1
    );
  }

  function showNextImage() {
    if (projectImages.length <= 1) return;

    setCurrentImageIndex((current) =>
      current === projectImages.length - 1
        ? 0
        : current + 1
    );
  }
  // Linkul trebuie să fie accesibil public, nu un URL intern Expo Go.
  const publicBase = process.env.EXPO_PUBLIC_PROJECT_SHARE_BASE_URL?.replace(/\/$/, '');
  const shareUrl = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.href
    : publicBase && id ? `${publicBase}/proiect/${encodeURIComponent(id)}` : '';

  function getYouTubeId(url: string | null): string | null {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?[^#]*?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1] ?? null;
  }

  async function shareTo(channel: 'native' | 'facebook' | 'whatsapp' | 'telegram' | 'email' | 'copy') {
    if (!project) return;
    setShareVisible(false);
    if (!shareUrl) {
      Alert.alert('Link public neconfigurat', 'Configurează EXPO_PUBLIC_PROJECT_SHARE_BASE_URL cu adresa publică a aplicației pentru distribuirea din aplicația mobilă.');
      return;
    }
    const message = `Descoperă proiectul „${project.title}” al Misiunii Bucovina: ${shareUrl}`;
    try {
      if (channel === 'copy') {
        await Clipboard.setStringAsync(shareUrl);
        Alert.alert('Copiat', 'Linkul proiectului a fost copiat.');
      } else if (channel === 'native') {
        await Share.share({ message, url: shareUrl, title: project.title });
      } else {
        const encodedUrl = encodeURIComponent(shareUrl);
        const encodedMessage = encodeURIComponent(message);
        const target = channel === 'facebook'
          ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
          : channel === 'whatsapp'
            ? `https://wa.me/?text=${encodedMessage}`
            : channel === 'telegram'
              ? `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(project.title)}`
              : `mailto:?subject=${encodeURIComponent(project.title)}&body=${encodedMessage}`;
        await Linking.openURL(target);
      }
    } catch (error) {
      console.log('Eroare distribuire:', error);
      Alert.alert('Eroare', 'Nu am putut distribui proiectul.');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color={DARK}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Proiect
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă proiectul...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}
          >
            <Ionicons
              name="arrow-back"
              size={23}
              color={DARK}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Proiect
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.notFound}>
          <View style={styles.notFoundIcon}>
            <Ionicons
              name="folder-open-outline"
              size={35}
              color={RED}
            />
          </View>

          <Text style={styles.notFoundTitle}>
            Proiectul nu a fost găsit
          </Text>

          <Text style={styles.notFoundText}>
            Este posibil ca proiectul să nu mai
            fie disponibil.
          </Text>

          <TouchableOpacity
            style={styles.backToProjectsButton}
            onPress={() =>
              router.replace('/proiecte')
            }
          >
            <Text
              style={styles.backToProjectsText}
            >
              Vezi proiectele
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={DARK}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Proiect
        </Text>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={toggleFavorite}
          disabled={favoriteSaving}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Elimină proiectul din favorite' : 'Salvează proiectul la favorite'}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={24}
            color={RED}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
      >
        {/* IMAGE CAROUSEL */}

        {projectImages.length > 0 ? (
          <View style={styles.carousel}>
            <Image
              source={{
                uri: projectImages[currentImageIndex]?.image_url,
              }}
              style={styles.projectImage}
              resizeMode="cover"
            />

            {projectImages.length > 1 ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.carouselArrow,
                    styles.carouselArrowLeft,
                  ]}
                  onPress={showPreviousImage}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="chevron-back"
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.carouselArrow,
                    styles.carouselArrowRight,
                  ]}
                  onPress={showNextImage}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>

                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1} / {projectImages.length}
                  </Text>
                </View>

                <View style={styles.dots}>
                  {projectImages.map((image, index) => (
                    <TouchableOpacity
                      key={image.id}
                      style={[
                        styles.dot,
                        index === currentImageIndex &&
                          styles.dotActive,
                      ]}
                      onPress={() =>
                        setCurrentImageIndex(index)
                      }
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {/* HERO */}

        <View
          style={[
            styles.hero,
            projectImages.length > 0
              ? styles.heroWithImage
              : null,
          ]}
        >
          <View style={styles.heroTop}>
            <View style={styles.icon}>
              <Ionicons
                name="heart-outline"
                size={31}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />

              <Text style={styles.statusText}>
                {project.status === 'seasonal'
                  ? 'SEZONIER'
                  : project.status === 'permanent'
                    ? 'PERMANENT'
                    : project.status === 'planned'
                      ? 'ÎN PERSPECTIVĂ'
                      : 'ACTIV'}
              </Text>
            </View>
          </View>

          <Text style={styles.badge}>
            PROIECT MISIUNEA BUCOVINA
          </Text>

          <Text style={styles.title}>
            {project.title}
          </Text>

          {project.description ? (
            <Text style={styles.description}>
              {project.description}
            </Text>
          ) : null}
        </View>

        {/* CONTENT */}

        {project.content ? (
          <View style={styles.infoCard}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIcon}>
                <Ionicons name="information-circle-outline" size={22} color={RED} />
              </View>
              <Text style={styles.sectionTitle}>Despre proiect</Text>
            </View>

            <Text style={styles.text}>{project.content}</Text>
          </View>
        ) : null}

        {project.impact ? (
          <View style={styles.infoCard}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIcon}>
                <Ionicons name="heart-outline" size={21} color={RED} />
              </View>
              <Text style={styles.sectionTitle}>Impactul proiectului</Text>
            </View>

            <Text style={styles.text}>{project.impact}</Text>
          </View>
        ) : null}

        {project.urgent_needs ? (
          <View style={styles.infoCard}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIcon}>
                <Ionicons name="alert-circle-outline" size={21} color={RED} />
              </View>
              <Text style={styles.sectionTitle}>Urgențele proiectului</Text>
            </View>

            <Text style={styles.text}>{project.urgent_needs}</Text>
          </View>
        ) : null}

        {project.how_to_help ? (
          <View style={styles.infoCard}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIcon}>
                <Ionicons name="hand-left-outline" size={21} color={RED} />
              </View>
              <Text style={styles.sectionTitle}>Cum te poți implica</Text>
            </View>

            <Text style={styles.text}>{project.how_to_help}</Text>
          </View>
        ) : null}

        {/* VIDEO: se afișează numai pentru linkuri YouTube valide */}
        {getYouTubeId(project.video_url) ? (
          <View style={styles.infoCard}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIcon}>
                <Ionicons name="logo-youtube" size={22} color={RED} />
              </View>
              <Text style={styles.sectionTitle}>Vezi proiectul în video</Text>
            </View>
            <View style={styles.videoFrame}>
              {Platform.OS === 'web' ? createElement('iframe', {
                src: `https://www.youtube.com/embed/${getYouTubeId(project.video_url)}?playsinline=1&rel=0&origin=https%3A%2F%2Fmisiuneabucovina.org`,
                title: 'Videoclipul proiectului',
                  referrerPolicy: 'strict-origin-when-cross-origin',
                allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen',
                allowFullScreen: true,
                style: { width: '100%', height: '100%', border: 0 },
              }) : <WebView
                key={getYouTubeId(project.video_url)!}
                source={{ uri: `https://www.youtube.com/embed/${getYouTubeId(project.video_url)}?playsinline=1&rel=0&origin=https%3A%2F%2Fmisiuneabucovina.org`, headers: { Referer: 'https://misiuneabucovina.org/' } }}
                style={styles.videoPlayer}
                javaScriptEnabled
                domStorageEnabled
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                originWhitelist={['https://*']}
              />}
            </View>
            <TouchableOpacity
              style={styles.youtubeOpenButton}
              onPress={() => {
                const videoId = getYouTubeId(project.video_url);
                if (videoId) void Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Deschide videoclipul pe YouTube"
            >
              <Ionicons name="play-circle-outline" size={22} color={RED} />
              <Text style={styles.youtubeOpenButtonText}>Deschide pe YouTube</Text>
              <Ionicons name="open-outline" size={18} color={RED} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* DOAR DOUĂ ACȚIUNI: DISTRIBUIE ȘI DONEAZĂ */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => setShareVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Distribuie proiectul"
          >
            <Ionicons name="share-social-outline" size={19} color={RED} />
            <Text style={styles.shareButtonText}>Distribuie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.donateButton}
            onPress={() => router.push({
              pathname: '/doneaza',
              params: { specification: project.title, sourceType: 'project' },
            })}
            accessibilityRole="button"
            accessibilityLabel="Donează pentru proiect"
          >
            <Ionicons name="heart" size={19} color="#FFFFFF" />
            <Text style={styles.donateButtonText}>Donează</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={shareVisible} transparent animationType="fade" onRequestClose={() => setShareVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.shareSheet}>
              <Text style={styles.shareSheetTitle}>Distribuie proiectul</Text>
              {([
                ['native', 'Alte aplicații', 'share-outline'],
                ['facebook', 'Facebook', 'logo-facebook'],
                ['whatsapp', 'WhatsApp', 'logo-whatsapp'],
                ['telegram', 'Telegram', 'paper-plane-outline'],
                ['email', 'Email', 'mail-outline'],
                ['copy', 'Copiază linkul', 'link-outline'],
              ] as const).map(([channel, label, icon]) => (
                <TouchableOpacity key={channel} style={styles.shareOption} onPress={() => void shareTo(channel)}>
                  <Ionicons name={icon} size={22} color={RED} />
                  <Text style={styles.shareOptionText}>{label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.cancelShare} onPress={() => setShareVisible(false)}>
                <Text style={styles.cancelShareText}>Anulează</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },

  header: {
    height: 58,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: DARK,
  },

  headerSpace: {
    width: 42,
  },

  favoriteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    padding: 16,
    paddingBottom: 52,
  },

  carousel: {
    position: 'relative',
    width: '100%',
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#EDEDED',
    borderWidth: 1, borderColor: '#EEEEEE',
  },

  carouselArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -23,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  carouselArrowLeft: {
    left: 12,
  },

  carouselArrowRight: {
    right: 12,
  },

  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  dotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
  },

  projectImage: {
    width: '100%',
    height: 240,
    borderRadius: 24,
  },

  hero: {
    backgroundColor: RED,
    borderRadius: 24,
    padding: 24,
  },

  heroWithImage: {
    marginTop: 12,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  icon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor:
      'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  statusBadge: {
    backgroundColor:
      'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },

  statusText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  badge: {
    color: '#FFFFFF',
    opacity: 0.75,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    marginTop: 7,
  },

  description: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginTop: 15,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    flex: 1,
    color: DARK,
    fontSize: 20,
    fontWeight: '900',
  },

  text: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 9,
  },

  videoFrame: { marginTop: 14, width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111' },
  videoPlayer: { flex: 1, backgroundColor: '#111' },
  youtubeOpenButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#F1D6D6', backgroundColor: '#FFF8F8', marginTop: 14, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  youtubeOpenButtonText: { color: RED, fontSize: 12, fontWeight: '900', flex: 1, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  shareButton: { flex: 1, minHeight: 54, borderRadius: 15, borderWidth: 1, borderColor: '#EACACA', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  shareButtonText: { color: RED, fontSize: 14, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  shareSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 36 },
  shareSheetTitle: { color: DARK, fontSize: 19, fontWeight: '900', marginBottom: 10 },
  shareOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 14 },
  shareOptionText: { color: DARK, fontSize: 15, fontWeight: '600' },
  cancelShare: { alignItems: 'center', marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#F5F5F5' },
  cancelShareText: { color: DARK, fontWeight: '800' },
  donateButton: {
    flex: 1,
    minHeight: 54,
    backgroundColor: RED,
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  donateButtonContent: {
    flex: 1,
    alignItems: 'center',
  },

  donateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  donateProjectName: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.82,
    marginTop: 2,
    textAlign: 'center',
  },

  contributionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  contributionButtonContent: { flex: 1, alignItems: 'center' },
  contributionButtonText: { color: RED, fontSize: 14, fontWeight: '900' },
  contributionButtonSubtitle: {
    color: '#777777', fontSize: 10, marginTop: 3, textAlign: 'center',
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 12,
    marginTop: 10,
  },

  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  notFoundIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notFoundTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: DARK,
    marginTop: 15,
  },

  notFoundText: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },

  backToProjectsButton: {
    backgroundColor: RED,
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 12,
    marginTop: 18,
  },

  backToProjectsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});