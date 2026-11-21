import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Image,
  TextInput,
  useWindowDimensions,
  RefreshControl,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type Project = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  status: 'active' | 'seasonal' | 'permanent' | 'planned';
  display_order: number;
};

export default function ProiecteScreen() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Project['status']>('all');
  const { width: windowWidth } = useWindowDimensions();

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [failedImages, setFailedImages] =
    useState<Record<string, boolean>>({});

  async function loadProjects(
    isRefresh = false
  ) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from('projects')
      .select(
  'id, title, description, image_url, status, display_order'
)
.in('status', ['active', 'seasonal', 'permanent', 'planned'])
.order('display_order', {
  ascending: true,
})
.order('created_at', {
  ascending: false,
});

    if (error) {
      console.log(
        'Eroare încărcare proiecte:',
        error
      );
    } else {
      setProjects(
        (data ?? []) as Project[]
      );
    }

    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [])
  );

  const isDesktop = Platform.OS === 'web';
  const columns = windowWidth >= 1020 ? 3 : windowWidth >= 700 && (Platform.OS === 'web' || windowWidth >= 900) ? 2 : 1;
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = `${project.title} ${project.description ?? ''}`
      .toLocaleLowerCase('ro-RO').includes(search.trim().toLocaleLowerCase('ro-RO'));
    return matchesSearch && (statusFilter === 'all' || project.status === statusFilter);
  });

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <ScrollView
        stickyHeaderIndices={[3]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, isDesktop && styles.webDesktopContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadProjects(true)
            }
            tintColor={RED}
          />
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            MISIUNEA BUCOVINA
          </Text>

          <Text style={styles.title}>
            Proiectele noastre
          </Text>

          <Text style={styles.subtitle}>
            Descoperă proiectele prin care
            ajutorul ajunge la copii, familii
            și oameni aflați în nevoie.
          </Text>
        </View>

        {/* HERO */}

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="people"
              size={31}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.heroSmall}>
            ÎMPREUNĂ PUTEM AJUTA
          </Text>

          <Text style={styles.heroTitle}>
            Fii parte dintr-un proiect
          </Text>

          <Text style={styles.heroDescription}>
            Fiecare proiect înseamnă oameni
            care aleg să se implice pentru a
            schimba în bine viața altor oameni.
          </Text>

          <TouchableOpacity
            style={styles.heroButton}
            onPress={() =>
              router.push('/doneaza')
            }
          >
            <Ionicons
              name="heart"
              size={17}
              color={RED}
            />

            <Text
              style={styles.heroButtonText}
            >
              Susține proiectele
            </Text>
          </TouchableOpacity>
        </View>

        {/* PROJECTS HEADER */}

        <View style={styles.sectionHeader}>
          <View>
            <Text
              style={styles.sectionEyebrow}
            >
              LUCRAREA NOASTRĂ
            </Text>

            <Text
              style={styles.sectionTitle}
            >
              Descoperă proiectele
            </Text>
          </View>

          {!loading && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {projects.length}{' '}
                {projects.length === 1
                  ? 'PROIECT'
                  : 'PROIECTE'}
              </Text>
            </View>
          )}
        </View>

        {/* CĂUTARE ȘI FILTRE */}
        <View style={[styles.filtersCard, styles.stickyFilters]}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color="#8B8B8B" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Caută un proiect..."
              placeholderTextColor="#8B8B8B"
              style={styles.searchInput}
              accessibilityLabel="Caută proiecte"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Șterge căutarea">
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
            {([
              ['all', 'Toate'],
              ['active', 'Active'],
              ['permanent', 'Permanente'],
              ['seasonal', 'Sezoniere'],
              ['planned', 'În perspectivă'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setStatusFilter(value)}
                style={[styles.filterChip, statusFilter === value && styles.filterChipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: statusFilter === value }}
              >
                <Text style={[styles.filterChipText, statusFilter === value && styles.filterChipTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* LOADING */}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="large"
              color={RED}
            />

            <Text style={styles.loadingText}>
              Se încarcă proiectele...
            </Text>
          </View>
        ) : filteredProjects.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="people-outline"
                size={32}
                color={RED}
              />
            </View>

            <Text style={styles.emptyTitle}>
              {projects.length === 0 ? 'Proiectele vor apărea aici' : 'Niciun proiect găsit'}
            </Text>

            <Text style={styles.emptyText}>
              {projects.length === 0 ? 'Momentan nu există proiecte publicate.' : 'Încearcă altă căutare sau schimbă filtrele.'}
            </Text>
          </View>
        ) : (
          <View style={styles.projectGrid}>
          {filteredProjects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={[styles.projectCard, { width: columns === 1 ? '100%' : columns === 2 ? '48.7%' : '32.1%' }]}
              activeOpacity={0.85}
              onPress={() =>
                router.push(
                  `/proiect/${project.id}`
                )
              }
            >
              {project.image_url &&
              !failedImages[project.id] ? (
                <Image
                  source={{
                    uri: project.image_url,
                  }}
                  style={styles.projectImage}
                  resizeMode="cover"
                  onError={() =>
                    setFailedImages((current) => ({
                      ...current,
                      [project.id]: true,
                    }))
                  }
                />
              ) : null}

              <View style={styles.projectBody}>
                <View
                  style={styles.projectTop}
                >
                  <View
                    style={
                      styles.projectIcon
                    }
                  >
                    <Ionicons
                      name="heart-outline"
                      size={25}
                      color={RED}
                    />
                  </View>

                  <View
                    style={
                      styles.activeBadge
                    }
                  >
                    <View
                      style={
                        styles.activeDot
                      }
                    />

                    <Text
                      style={
                        styles.activeText
                      }
                    >
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

                <Text
                  style={styles.projectTitle}
                >
                  {project.title}
                </Text>

                {project.description ? (
                  <Text
                    numberOfLines={2}
                    style={
                      styles.projectDescription
                    }
                  >
                    {project.description}
                  </Text>
                ) : null}

                <View
                  style={styles.projectFooter}
                >
                  <Text
                    style={
                      styles.discoverText
                    }
                  >
                    Descoperă proiectul
                  </Text>

                  <View
                    style={
                      styles.arrowButton
                    }
                  >
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          </View>
        )}

        {/* VOLUNTEER */}

        <View style={styles.volunteerCard}>
          <View
            style={styles.volunteerIcon}
          >
            <Ionicons
              name="hand-left-outline"
              size={28}
              color="#FFFFFF"
            />
          </View>

          <Text
            style={styles.volunteerSmall}
          >
            NU DOAR PRIN DONAȚII
          </Text>

          <Text
            style={styles.volunteerTitle}
          >
            Poți ajuta și prin timpul tău
          </Text>

          <Text
            style={styles.volunteerText}
          >
            Implică-te ca voluntar și
            participă direct la proiectele
            Misiunii Bucovina.
          </Text>

          <TouchableOpacity
            style={styles.volunteerButton}
            onPress={() =>
              router.push('/implica-te')
            }
          >
            <Text
              style={
                styles.volunteerButtonText
              }
            >
              Devino voluntar
            </Text>

            <Ionicons
              name="arrow-forward"
              size={17}
              color={RED}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stickyFilters: { backgroundColor: BACKGROUND, zIndex: 10, elevation: 5, paddingBottom: 7 },
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  content: {
    paddingHorizontal: 15,
    paddingBottom: 35,
  },

  header: {
    paddingTop: 18,
    paddingBottom: 18,
  },

  eyebrow: {
    color: RED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },

  title: {
    color: DARK,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
    marginTop: 4,
  },

  subtitle: {
    color: '#666666',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 350,
  },

  hero: {
    backgroundColor: RED,
    borderRadius: 23,
    padding: 22,
  },

  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor:
      'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 17,
  },

  heroSmall: {
    color: '#FFFFFF',
    opacity: 0.75,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    marginTop: 5,
  },

  heroDescription: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },

  heroButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  heroButtonText: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
  },

  sectionHeader: {
    marginTop: 27,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  sectionEyebrow: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },

  sectionTitle: {
    color: DARK,
    fontSize: 20,
    fontWeight: '900',
  },

  countBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  countText: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
  },

  loadingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },

  loadingText: {
    color: '#888888',
    fontSize: 10,
    marginTop: 10,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 11,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },

  filtersCard: {
    backgroundColor: 'transparent', borderRadius: 0, padding: 0, marginBottom: 0,
  },
  searchRow: {
    minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E9E9E9',
  },
  searchInput: { flex: 1, color: DARK, fontSize: 14, paddingVertical: 10 },
  filterChips: { flexDirection: 'row', gap: 8, paddingTop: 12, paddingBottom: 2 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E9E9' },
  filterChipSelected: { backgroundColor: RED, borderColor: RED },
  filterChipText: { color: '#666666', fontSize: 12, fontWeight: '800' },
  filterChipTextSelected: { color: '#FFFFFF' },
  projectGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 13,
    borderWidth: 1, borderColor: '#ECECEC',
  },

  projectImage: {
    width: '100%',
    height: 170,
  },

  projectBody: {
    padding: 15,
  },

  projectTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  projectIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  activeBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    paddingHorizontal: 10,
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
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  projectTitle: {
    color: DARK,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    marginTop: 12,
  },

  projectDescription: {
    color: '#6F6F6F',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },

  projectFooter: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    marginTop: 13,
    paddingTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  discoverText: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
  },

  arrowButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  volunteerCard: {
    backgroundColor: '#171717',
    borderRadius: 22,
    padding: 21,
    marginTop: 8,
  },

  volunteerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor:
      'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  volunteerSmall: {
    color: '#E4A3A5',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 15,
  },

  volunteerTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '900',
    marginTop: 5,
  },

  volunteerText: {
    color: '#BBBBBB',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },

  volunteerButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  volunteerButtonText: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
  },
  webDesktopContent: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 56 },
});