import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccountItem, setAccountItem } from '../lib/account-storage';
import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const FAVORITE_CASES_KEY = 'favorite_case_ids';
const FAVORITE_PROJECTS_KEY = 'favorite_project_ids';

type FavoriteItem = {
  id: string;
  title: string;
  image_url: string | null;
  description: string | null;
  type: 'case' | 'project';
};

function parseIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export default function FavoriteScreen() {
  const [cases, setCases] = useState<FavoriteItem[]>([]);
  const [projects, setProjects] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
      let active = true;
      async function loadFavorites() {
        setLoading(true);
        setLoadError(false);
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
          // Verificarea sesiunii este normală și pentru vizitatorii neautentificați.
          // Nu afișăm mesaje de diagnosticare ca erori în LogBox.
          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(new Error('Verificarea sesiunii a durat prea mult.'));
              }, 8000);
            }),
          ]);
          if (timeoutId) clearTimeout(timeoutId);
          const { data: { session }, error: sessionError } = sessionResult;
          if (sessionError) throw sessionError;
          if (!active) return;
          setSignedOut(!session);
          if (!session) {
            setCases([]);
            setProjects([]);
            return;
          }
          const [storedCases, storedProjects] = await Promise.all([
            getAccountItem(FAVORITE_CASES_KEY),
            getAccountItem(FAVORITE_PROJECTS_KEY),
          ]);
          const caseIds = parseIds(storedCases);
          const projectIds = parseIds(storedProjects);
          const [caseResult, projectResult] = await Promise.all([
            caseIds.length
              ? supabase.from('cases')
                  .select('id, title, image_url, story')
                  .in('id', caseIds)
                  .in('status', ['active', 'completed', 'archived'])
              : Promise.resolve({ data: [], error: null }),
            projectIds.length
              ? supabase.from('projects')
                  .select('id, title, image_url, description')
                  .in('id', projectIds)
                  .in('status', ['active', 'seasonal', 'permanent', 'planned'])
              : Promise.resolve({ data: [], error: null }),
          ]);
          if (caseResult.error) console.log('Eroare favorite cazuri:', caseResult.error);
          if (projectResult.error) console.log('Eroare favorite proiecte:', projectResult.error);
          if (!active) return;
          const loadedCases = (caseResult.data ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            image_url: item.image_url,
            description: item.story,
            type: 'case' as const,
          }));
          const loadedProjects = (projectResult.data ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            image_url: item.image_url,
            description: item.description,
            type: 'project' as const,
          }));
          setCases(caseIds.flatMap((id) => loadedCases.filter((item) => item.id === id)));
          setProjects(projectIds.flatMap((id) => loadedProjects.filter((item) => item.id === id)));
        } catch (error) {
          console.log('Eroare încărcare favorite:', error);
          if (active) setLoadError(true);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
          if (active) setLoading(false);
        }
      }
      loadFavorites();
      return () => { active = false; };
  }, [retryCount]);

  async function removeFavorite(item: FavoriteItem) {
    const key = item.type === 'case' ? FAVORITE_CASES_KEY : FAVORITE_PROJECTS_KEY;
    try {
      const ids = parseIds(await getAccountItem(key));
      await setAccountItem(key, JSON.stringify(ids.filter((id) => id !== item.id)));
      if (item.type === 'case') {
        setCases((previous) => previous.filter((entry) => entry.id !== item.id));
      } else {
        setProjects((previous) => previous.filter((entry) => entry.id !== item.id));
      }
    } catch (error) {
      console.log('Eroare eliminare favorit:', error);
    }
  }

  function renderItem(item: FavoriteItem) {
    return (
      <View key={`${item.type}-${item.id}`} style={styles.card}>
        <TouchableOpacity
          style={styles.cardMain}
          activeOpacity={0.8}
          onPress={() => router.push(item.type === 'case'
            ? { pathname: '/caz/[id]', params: { id: item.id } }
            : { pathname: '/proiect/[id]', params: { id: item.id } })}
        >
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name={item.type === 'case' ? 'people-outline' : 'folder-outline'} size={25} color={RED} />
            </View>
          )}
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description || (item.type === 'case' ? 'Descoperă acest caz.' : 'Descoperă acest proiect.')}
            </Text>
            <Text style={styles.openText}>Deschide {item.type === 'case' ? 'cazul' : 'proiectul'} →</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFavorite(item)}
          accessibilityRole="button"
          accessibilityLabel={`Elimină ${item.title} din favorite`}
        >
          <Ionicons name="heart" size={21} color={RED} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}>
          <Ionicons name="arrow-back" size={23} color={DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorite</Text>
        <View style={styles.headerSpace} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RED} />
          <Text style={styles.muted}>Se încarcă favoritele...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.signInWrapper}>
          <View style={styles.signInCard}>
            <Ionicons name="alert-circle-outline" size={46} color={RED} />
            <Text style={styles.emptyTitle}>Nu am putut verifica autentificarea</Text>
            <Text style={styles.muted}>Verifică conexiunea și încearcă din nou. Dacă problema persistă, trebuie verificată configurația Supabase pentru web.</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.signInButton} onPress={() => setRetryCount((n) => n + 1)}>
              <Text style={styles.signInButtonText}>Încearcă din nou</Text>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : signedOut ? (
        <View style={styles.signInWrapper}>
          <View style={styles.signInCard}>
            <Ionicons name="heart-outline" size={46} color={RED} />
            <Text style={styles.emptyTitle}>Conectează-te pentru a vedea favoritele</Text>
            <Text style={styles.muted}>Ai nevoie de un cont pentru a salva și urmări cazurile și proiectele favorite.</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.signInButton} onPress={() => router.push('/alege-cont')}>
              <Text style={styles.signInButtonText}>Conectează-te</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Cazurile și proiectele pe care vrei să le urmărești.</Text>
          {cases.length === 0 && projects.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={46} color={RED} />
              <Text style={styles.emptyTitle}>Nu ai favorite încă</Text>
              <Text style={styles.muted}>Deschide un caz sau un proiect și apasă pe inimioară pentru a-l salva aici.</Text>
            </View>
          ) : null}
          <Text style={styles.sectionTitle}>Cazuri salvate ({cases.length})</Text>
          {cases.length ? cases.map(renderItem) : <Text style={styles.emptySection}>Nu ai cazuri salvate.</Text>}
          <Text style={styles.sectionTitle}>Proiecte salvate ({projects.length})</Text>
          {projects.length ? projects.map(renderItem) : <Text style={styles.emptySection}>Nu ai proiecte salvate.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F6F6' , ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},
  header: { height: 58, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' , ...(Platform.OS === "web" ? { height: 82, paddingHorizontal: 32 } : {})},
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: DARK, fontSize: 18, fontWeight: '900' , ...(Platform.OS === "web" ? { fontSize: 24 } : {})},
  headerSpace: { width: 42 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 45, width: '100%', maxWidth: 1180, alignSelf: 'center' , ...(Platform.OS === "web" ? { maxWidth: 1050, paddingHorizontal: 24, paddingTop: 32 } : {})},
  signInWrapper: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  signInCard: { width: '100%', maxWidth: 520, padding: 28, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center' , ...(Platform.OS === "web" ? { maxWidth: 560, padding: 48, borderRadius: 24, borderWidth: 1, borderColor: "#ECECEF" } : {})},
  signInButton: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12, backgroundColor: RED , ...(Platform.OS === "web" ? { paddingHorizontal: 28, paddingVertical: 16 } : {})},
  signInButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  intro: { color: '#777777', fontSize: 13, lineHeight: 20, marginBottom: 14 , ...(Platform.OS === "web" ? { fontSize: 15, lineHeight: 24, marginBottom: 22 } : {})},
  sectionTitle: { fontSize: 20, fontWeight: '900', color: DARK, marginTop: 20, marginBottom: 12 , ...(Platform.OS === "web" ? { fontSize: 23, marginTop: 28, marginBottom: 16 } : {})},
  card: { backgroundColor: '#FFFFFF', borderRadius: 17, marginBottom: 11, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' , ...(Platform.OS === "web" ? { borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: "#EAEAED" } : {})},
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10 , ...(Platform.OS === "web" ? { padding: 17 } : {})},
  thumbnail: { width: 80, height: 85, borderRadius: 12, backgroundColor: '#F1E7E7' , ...(Platform.OS === "web" ? { width: 120, height: 108, borderRadius: 14 } : {})},
  placeholder: { width: 80, height: 85, borderRadius: 12, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' , ...(Platform.OS === "web" ? { width: 120, height: 108, borderRadius: 14 } : {})},
  cardContent: { flex: 1, paddingHorizontal: 11 , ...(Platform.OS === "web" ? { paddingHorizontal: 20 } : {})},
  cardTitle: { color: DARK, fontSize: 14, fontWeight: '900' , ...(Platform.OS === "web" ? { fontSize: 17 } : {})},
  cardDescription: { color: '#777777', fontSize: 11, lineHeight: 16, marginTop: 5 , ...(Platform.OS === "web" ? { fontSize: 14, lineHeight: 21, marginTop: 9 } : {})},
  openText: { color: RED, fontSize: 11, fontWeight: '800', marginTop: 7 , ...(Platform.OS === "web" ? { fontSize: 13, marginTop: 11 } : {})},
  removeButton: { paddingHorizontal: 13, paddingVertical: 20 , ...(Platform.OS === "web" ? { paddingHorizontal: 22, paddingVertical: 24 } : {})},
  muted: { color: '#888888', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 12 , ...(Platform.OS === "web" ? { fontSize: 14, lineHeight: 23 } : {})},
  empty: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 25, alignItems: 'center', marginTop: 10 , ...(Platform.OS === "web" ? { padding: 42, borderWidth: 1, borderColor: "#ECECEF" } : {})},
  emptyTitle: { fontSize: 17, color: DARK, fontWeight: '900', marginTop: 10 , ...(Platform.OS === "web" ? { fontSize: 22, textAlign: "center" } : {})},
  emptySection: { color: '#999999', fontSize: 12, paddingVertical: 9 , ...(Platform.OS === "web" ? { fontSize: 14, paddingVertical: 14 } : {})},
});
