// MISIBI_YOUTUBE_REFERER_FIX: tentative embed configuration; external YouTube button retained.
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,

  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Alert } from '../../lib/platform-alert';

import { getAccountItem, setAccountItem } from '../../lib/account-storage';
import { supabase } from '../../lib/supabase';


const RED = '#A61E22';
const DARK = '#171717';

type Case = {
  id: string;
  title: string;
  story: string | null;
  description: string | null;
  how_to_help: string | null;
  location: string | null;
  urgent_need: string | null;
  video_url: string | null;
  status: 'active' | 'completed' | 'archived';
  image_url: string | null;
};

type CaseImage = {
  id: string;
  case_id: string;
  image_url: string;
  display_order: number;
};

// Linkul public trebuie să deschidă efectiv ruta /caz/<uuid>.
// Nu folosim localhost sau adrese Expo Go pentru distribuire.
const SHARE_BASE = (process.env.EXPO_PUBLIC_CASE_SHARE_BASE_URL ?? '').trim().replace(/\/+$/, '');
function getShareUrl(caseId: string): string | null {
  if (!/^https:\/\//i.test(SHARE_BASE)) return null;
  return `${SHARE_BASE}/caz/${encodeURIComponent(caseId)}`;
}
function youtubeEmbedUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    let videoId: string | null = null;
    if (host === 'youtu.be') videoId = u.pathname.split('/')[1];
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      videoId = u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/embed/') || u.pathname.startsWith('/live/')
        ? u.pathname.split('/')[2] : u.searchParams.get('v');
    }
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
    return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&origin=https%3A%2F%2Fmisiuneabucovina.org`;
  } catch { return null; }
}

export default function CaseDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [galleryImages, setGalleryImages] = useState<CaseImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);

  const favoriteKey = 'favorite_case_ids';
  const [shareVisible, setShareVisible] = useState(false);

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
    loadCase();
  }, [id]);

  async function loadCase() {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('cases')
      .select(
        'id, title, description, story, location, urgent_need, how_to_help, video_url, status, image_url'
      )
      .eq('id', id)
      .in('status', ['active', 'completed', 'archived'])
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.log('Eroare încărcare caz:', error);
      }
      setCaseData(null);
      setGalleryImages([]);
      setLoading(false);
      return;
    }

    setCaseData(data as Case);

    const { data: galleryData, error: galleryError } = await supabase
      .from('case_images')
      .select('id, case_id, image_url, display_order')
      .eq('case_id', id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (galleryError) {
      console.log('Eroare încărcare galerie caz:', galleryError);
      setGalleryImages([]);
    } else {
      setGalleryImages((galleryData ?? []) as CaseImage[]);
    }

    setCurrentImageIndex(0);
    setLoading(false);
  }

  const carouselImages = Array.from(
    new Set(
      [
        caseData?.image_url,
        ...galleryImages.map((image) => image.image_url),
      ].filter((url): url is string => Boolean(url))
    )
  );

  useEffect(() => {
    if (carouselImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex(
        (current) => (current + 1) % carouselImages.length
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [carouselImages.length]);

  function showPreviousImage() {
    if (carouselImages.length <= 1) return;

    setCurrentImageIndex(
      (current) =>
        (current - 1 + carouselImages.length) %
        carouselImages.length
    );
  }

  function showNextImage() {
    if (carouselImages.length <= 1) return;

    setCurrentImageIndex(
      (current) => (current + 1) % carouselImages.length
    );
  }

  const shareUrl = caseData ? getShareUrl(caseData.id) : null;
  const embedUrl = youtubeEmbedUrl(caseData?.video_url ?? null);

  async function shareNative() {
    if (!caseData) return;
    setShareVisible(false);
    try {
      await Share.share({ message: shareUrl ? `${caseData.title}\n${shareUrl}` : `Misiunea Bucovina — ${caseData.title}`, ...(shareUrl ? { url: shareUrl } : {}) });
    } catch (error) { console.log('Eroare distribuire:', error); }
  }

  async function shareVia(kind: 'whatsapp' | 'telegram' | 'facebook' | 'email' | 'copy') {
    if (!caseData) return;
    if (!shareUrl) {
      setShareVisible(false);
      Alert.alert('Link public neconfigurat', 'Pentru distribuirea directă a cazului, configurează EXPO_PUBLIC_CASE_SHARE_BASE_URL cu domeniul real care servește ruta /caz/<uuid>. Poți folosi deocamdată distribuirea nativă a titlului.');
      return;
    }
    if (kind === 'copy') {
      await Clipboard.setStringAsync(shareUrl);
      setShareVisible(false);
      Alert.alert('Link copiat', 'Linkul cazului a fost copiat.');
      return;
    }
    const text = `${caseData.title} — ${shareUrl}`;
    const urls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(caseData.title)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent(caseData.title)}&body=${encodeURIComponent(text)}`,
    };
    setShareVisible(false);
    try { await Linking.openURL(urls[kind]); }
    catch { Alert.alert('Eroare', 'Nu am putut deschide opțiunea de distribuire.'); }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă cazul...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!caseData) {
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
            Caz
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={45}
            color={RED}
          />

          <Text style={styles.notFoundTitle}>
            Cazul nu a fost găsit
          </Text>

          <Text style={styles.loadingText}>
            Este posibil ca acest caz să nu mai fie disponibil.
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.screen}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}
        >
          <Ionicons name="arrow-back" size={23} color={DARK} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
  {caseData.status === 'archived'
    ? 'Misiune îndeplinită'
    : caseData.status === 'completed'
      ? 'Caz finalizat'
      : 'Caz activ'}
</Text>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={toggleFavorite}
          disabled={favoriteSaving}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Elimină cazul din favorite' : 'Salvează cazul la favorite'}
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
        <View style={styles.imagePlaceholder}>
          {carouselImages.length > 0 ? (
            <Image
              source={{ uri: carouselImages[currentImageIndex] }}
              style={styles.caseImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons
              name="people-outline"
              size={65}
              color={RED}
            />
          )}

          {carouselImages.length > 1 ? (
            <>
              <TouchableOpacity
                style={[styles.carouselArrow, styles.carouselArrowLeft]}
                onPress={showPreviousImage}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="chevron-back"
                  size={23}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.carouselArrow, styles.carouselArrowRight]}
                onPress={showNextImage}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="chevron-forward"
                  size={23}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <View style={styles.carouselDots}>
                {carouselImages.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.carouselDot,
                      index === currentImageIndex &&
                        styles.carouselDotActive,
                    ]}
                    onPress={() => setCurrentImageIndex(index)}
                    activeOpacity={0.8}
                  />
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* CASE INFO */}
        <View style={styles.caseInfo}>
          <View style={styles.detailStatus}><View style={[styles.detailStatusDot, caseData.status !== 'active' && { backgroundColor: '#368564' }]} /><Text style={styles.detailStatusText}>{caseData.status === 'active' ? 'CAZ ACTIV' : caseData.status === 'completed' ? 'CAZ FINALIZAT' : 'MISIUNE ÎNDEPLINITĂ'}</Text></View>
          <Text style={styles.category}>MISIUNEA BUCOVINA  /  POVEȘTI</Text>

          <Text style={styles.title}>
  {caseData.title}
</Text>

          {caseData.description?.trim() ? (
            <Text style={styles.paragraph}>{caseData.description}</Text>
          ) : null}

          {caseData.location ? (
  <Text style={styles.location}>
    <Ionicons
      name="location-outline"
      size={14}
      color="#777777"
    />{' '}
    {caseData.location}
  </Text>
) : null}

        </View>

        {/* STORY */}
        {caseData.story ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Povestea
            </Text>

            <Text style={styles.paragraph}>
              {caseData.story}
            </Text>
          </View>
        ) : null}

        {/* URGENT NEED */}
        {caseData.urgent_need ? (
          <View style={styles.section}>
            <View style={styles.needTitleRow}>
              <View style={styles.needIcon}>
                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color={RED}
                />
              </View>

              <Text style={styles.sectionTitle}>
                Nevoia urgentă
              </Text>
            </View>

            <Text style={styles.paragraph}>
              {caseData.urgent_need}
            </Text>
          </View>
        ) : null}

        {/* HOW TO HELP */}
        {caseData.how_to_help?.trim() ? (
          <View style={styles.section}>
            <View style={styles.needTitleRow}>
              <View style={styles.needIcon}>
                <Ionicons name="hand-left-outline" size={22} color={RED} />
              </View>
              <Text style={styles.sectionTitle}>Cum poți ajuta</Text>
            </View>
            <Text style={styles.paragraph}>{caseData.how_to_help}</Text>
          </View>
        ) : null}

        {/* VIDEO */}
        {caseData.video_url?.trim() ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vezi povestea video</Text>
            {embedUrl ? (
              <View style={styles.videoFrame}>
                <WebView
                  source={{ uri: embedUrl, headers: { Referer: 'https://misiuneabucovina.org/' } }}
                  style={{ flex: 1 }}
                  javaScriptEnabled
                  allowsFullscreenVideo
                  allowsInlineMediaPlayback
                  originWhitelist={['https://*']}
                />
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.videoButton}
              onPress={() => Linking.openURL(caseData.video_url!)}
              activeOpacity={0.85}
            >
              <Ionicons name="play-circle-outline" size={22} color={RED} />
              <Text style={styles.videoButtonText}>{embedUrl ? 'Deschide pe YouTube' : 'Deschide videoclipul'}</Text>
              <Ionicons name="open-outline" size={18} color={RED} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Acțiuni pe același rând, ca la proiecte */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => setShareVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Distribuie cazul"
          >
            <Ionicons name="share-social-outline" size={19} color={RED} />
            <Text style={styles.shareButtonText}>Distribuie</Text>
          </TouchableOpacity>
          {caseData.status === 'active' ? (
            <TouchableOpacity
              style={styles.donateButton}
              onPress={() => router.push({
                pathname: '/doneaza',
                params: { specification: caseData.title, sourceType: 'case' },
              })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Donează pentru caz"
            >
              <Ionicons name="heart" size={19} color="#FFFFFF" />
              <Text style={styles.donateText}>Donează</Text>
            </TouchableOpacity>
          ) : null}
        </View>

      </ScrollView>
      <Modal visible={shareVisible} transparent animationType="fade" onRequestClose={() => setShareVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Distribuie cazul</Text>
            {([
              ['whatsapp', 'WhatsApp', 'logo-whatsapp'],
              ['telegram', 'Telegram', 'paper-plane-outline'],
              ['facebook', 'Facebook', 'logo-facebook'],
              ['email', 'Email', 'mail-outline'],
              ['copy', 'Copiază linkul', 'copy-outline'],
            ] as const).map(([key, label, icon]) => (
              <TouchableOpacity key={key} style={styles.shareOption} onPress={() => void shareVia(key)}>
                <Ionicons name={icon} size={21} color={RED} />
                <Text style={styles.shareOptionText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.shareOption} onPress={() => void shareNative()}>
              <Ionicons name="share-outline" size={21} color={RED} />
              <Text style={styles.shareOptionText}>Alte aplicații</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeModal} onPress={() => setShareVisible(false)}>
              <Text style={styles.closeModalText}>Închide</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  detailStatus: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFF1F1', marginBottom: 12 },
  detailStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: RED },
  detailStatusText: { fontSize: 10, color: RED, fontWeight: '900', letterSpacing: 0.6 },
  videoFrame: { height: 210, marginTop: 14, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111111' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  shareButton: { flex: 1, minHeight: 54, borderRadius: 15, borderWidth: 1, borderColor: '#EACACA', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  shareButtonText: { color: RED, fontSize: 15, fontWeight: '900' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 25 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20 },
  modalTitle: { color: DARK, fontSize: 19, fontWeight: '900', marginBottom: 10 },
  shareOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  shareOptionText: { color: DARK, fontSize: 14, fontWeight: '700' },
  closeModal: { paddingVertical: 12, alignItems: 'center', marginTop: 5 },
  closeModalText: { color: '#777777', fontWeight: '800' },
  screen: {
    flex: 1,
    backgroundColor: '#F7F7F8',
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
    backgroundColor: '#F4F4F4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '800',
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
    padding: 15,
    paddingBottom: 40,
  },

  imagePlaceholder: {
    height: 275,
    borderRadius: 20,
    backgroundColor: '#F1E7E7',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  carouselArrow: {
    position: 'absolute',
    top: '50%',
    width: 38,
    height: 38,
    marginTop: -19,
    borderRadius: 19,
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

  carouselDots: {
    position: 'absolute',
    bottom: 13,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },

  carouselDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  carouselDotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
  },

  activeBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: RED,
  },

  activeText: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
  },

  caseInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 21,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  category: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  title: {
    color: DARK,
    fontSize: 28,
    lineHeight: 35,
    fontWeight: '900',
    marginTop: 7,
  },

  location: {
    color: '#777777',
    fontSize: 12,
    marginTop: 10,
  },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 21,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  sectionTitle: {
    color: DARK,
    fontSize: 19,
    fontWeight: '900',
  },

  paragraph: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 23,
    marginTop: 10,
  },

  needRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },

  needIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  needText: {
    flex: 1,
    color: DARK,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 12,
  },

  updateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  newBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  newBadgeText: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
  },

  update: {
    flexDirection: 'row',
    marginTop: 17,
  },

  timeline: {
    width: 22,
    alignItems: 'center',
  },

  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RED,
  },

  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#EEEEEE',
    marginTop: 4,
  },

  updateContent: {
    flex: 1,
    paddingLeft: 8,
  },

  updateDate: {
    color: RED,
    fontSize: 9,
    fontWeight: '800',
  },

  updateTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 5,
  },

  updateText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  needTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  videoDescription: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },

  videoButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    backgroundColor: '#FFF8F8',
    marginTop: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  videoButtonText: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
    flex: 1,
    textAlign: 'center',
  },

  contributionButton: {
    backgroundColor: '#FFFFFF', borderColor: '#F1D6D6', borderWidth: 1,
    borderRadius: 15, paddingVertical: 17, paddingHorizontal: 16,
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  contributionTitle: { color: RED, fontSize: 14, fontWeight: '900' },
  contributionSubtitle: { color: '#777777', fontSize: 11, marginTop: 3, lineHeight: 16 },

  donateButton: {
    backgroundColor: RED,
    borderRadius: 15,
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  donateTextContainer: {
    flex: 1,
    alignItems: 'center',
  },

  donateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  donateSpecification: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.82,
    marginTop: 2,
    textAlign: 'center',
  },

    loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: '#888888',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },

  notFoundTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },

  caseImage: {
  width: '100%',
  height: '100%',
},

});