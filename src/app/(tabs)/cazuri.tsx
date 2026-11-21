import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  TextInput,
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type Case = {
  id: string;
  title: string;
  story: string | null;
  location: string | null;
  urgent_need: string | null;
  status: 'active' | 'completed';
  image_url: string | null;
  display_order: number;
};

export default function CazuriScreen() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const { width } = useWindowDimensions();
  const columns = width >= 1020 ? 3 : width >= 700 && (Platform.OS === 'web' || width >= 900) ? 2 : 1;
  const visibleCases = useMemo(() => cases.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    const term = search.trim().toLocaleLowerCase('ro');
    return !term || [item.title, item.location, item.story, item.urgent_need].some(value => value?.toLocaleLowerCase('ro').includes(term));
  }), [cases, search, filter]);

  async function loadCases() {
    setLoading(true);

    const { data, error } = await supabase
      .from('cases')
      .select(
        'id, title, story, location, urgent_need, status, image_url, display_order'
      )
      .in('status', ['active', 'completed'])
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Eroare încărcare cazuri:', error);
      setCases([]);
    } else {
      setCases((data ?? []) as Case[]);
    }

    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadCases();
    }, [])
  );

  const isDesktop = Platform.OS === 'web';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, isDesktop && styles.webDesktopContent]}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
          <Text style={styles.title}>Povești care merită ascultate</Text>
          <Text style={styles.subtitle}>Descoperă poveștile oamenilor și familiilor pe care îi putem sprijini împreună.</Text>
          <View style={styles.heroPill}><Ionicons name="heart-outline" size={15} color={RED} /><Text style={styles.heroPillText}>Fiecare gest de bunătate contează</Text></View>
        </View>

        <View style={[styles.toolbar, styles.stickyToolbar]}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={21} color="#8A8A8A" />
            <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
              placeholder="Caută un caz sau o localitate" placeholderTextColor="#999999" autoCorrect={false}
              accessibilityLabel="Caută cazuri" returnKeyType="search" />
            {search.length > 0 ? <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Șterge căutarea"><Ionicons name="close-circle" size={20} color="#999999" /></TouchableOpacity> : null}
          </View>
          <View style={styles.filters}>
            {([['active', 'Active'], ['completed', 'Finalizate'], ['all', 'Toate']] as const).map(([value, label]) => (
              <TouchableOpacity key={value} onPress={() => setFilter(value)} accessibilityRole="button"
                accessibilityState={{ selected: filter === value }} style={[styles.filterChip, filter === value && styles.filterChipActive]}>
                <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View><Text style={styles.sectionTitle}>{filter === 'active' ? 'Cazuri active' : filter === 'completed' ? 'Cazuri finalizate' : 'Toate cazurile'}</Text>
            <Text style={styles.sectionCaption}>Alege o poveste pentru a afla mai multe</Text></View>
          {!loading && <View style={styles.countPill}><Text style={styles.countText}>{visibleCases.length}</Text></View>}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={RED} /><Text style={styles.loadingText}>Se încarcă poveștile...</Text></View>
        ) : visibleCases.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name={search ? 'search-outline' : 'heart-outline'} size={35} color={RED} />
            <Text style={styles.emptyTitle}>{search ? 'Niciun rezultat' : 'Nu există cazuri în această categorie'}</Text>
            <Text style={styles.emptyText}>{search ? 'Încearcă alt nume sau altă localitate.' : 'Revino mai târziu pentru noi povești.'}</Text>
            {(search || filter !== 'active') && <TouchableOpacity style={styles.resetButton} onPress={() => { setSearch(''); setFilter('active'); }}><Text style={styles.resetText}>Resetează filtrele</Text></TouchableOpacity>}
          </View>
        ) : (
          <View style={styles.caseGrid}>
            {visibleCases.map(item => (
              <TouchableOpacity key={item.id} style={[styles.caseCard, { width: columns === 1 ? '100%' : columns === 2 ? '48.7%' : '32.1%' }]} activeOpacity={0.85}
                onPress={() => router.push(`/caz/${item.id}`)} accessibilityRole="button" accessibilityLabel={`Vezi povestea: ${item.title}`}>
                <View style={styles.imagePlaceholder}>
                  {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.caseImage} resizeMode="cover" /> : <Ionicons name="people-outline" size={55} color="#C98A8C" />}
                  <View style={styles.statusBadge}><View style={[styles.statusDot, item.status === 'completed' && styles.completedDot]} /><Text style={styles.statusText}>{item.status === 'completed' ? 'Finalizat' : 'Caz activ'}</Text></View>
                </View>
                <View style={styles.caseContent}>
                  {item.location ? <View style={styles.locationRow}><Ionicons name="location-outline" size={14} color={RED} /><Text style={styles.caseCategory} numberOfLines={1}>{item.location}</Text></View> : null}
                  <Text style={styles.caseTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.caseDescription} numberOfLines={3}>{item.story || 'Află mai multe despre acest caz și cum poți fi alături de cei care au nevoie.'}</Text>
                  {item.urgent_need ? <View style={styles.urgentNeed}><Ionicons name="hand-left-outline" size={18} color={RED} /><View style={styles.urgentNeedContent}><Text style={styles.urgentNeedLabel}>NEVOIA PRINCIPALĂ</Text><Text style={styles.urgentNeedText} numberOfLines={2}>{item.urgent_need}</Text></View></View> : null}
                  <View style={styles.cardFooter}><Text style={styles.detailsText}>Descoperă povestea</Text><View style={styles.arrowButton}><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></View></View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.donationCard}>
          <View style={styles.donationIcon}>
            <Ionicons name="heart" size={25} color="#FFFFFF" />
          </View>

          <Text style={styles.donationTitle}>Vrei să ajuți?</Text>

          <Text style={styles.donationText}>
            Poți susține lucrarea Misiunea Bucovina și fără să alegi un caz
            anume.
          </Text>

          <TouchableOpacity
            style={styles.donationButton}
            onPress={() => router.push('/doneaza')}
          >
            <Text style={styles.donationButtonText}>Donează acum</Text>

            <Ionicons name="arrow-forward" size={17} color={RED} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stickyToolbar: { backgroundColor: BACKGROUND, zIndex: 10, elevation: 5, paddingBottom: 7 },
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
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
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    marginTop: 4,
  },

  subtitle: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 570,
  },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  infoContent: {
    flex: 1,
    marginLeft: 13,
  },

  infoTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
  },

  infoText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    color: DARK,
    fontSize: 21,
    fontWeight: '900',
  },

  activeCount: {
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

  activeCountText: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  caseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ECECEC',
  },

  imagePlaceholder: {
    height: 205,
    backgroundColor: '#F1E7E7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  caseContent: {
    padding: 18,
  },

  caseCategory: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  caseTitle: {
    color: DARK,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    marginTop: 6,
  },

  caseDescription: {
    color: '#6E6E6E',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
  },

  urgentNeed: {
    backgroundColor: '#FFF8F8',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },

  urgentNeedContent: {
    flex: 1,
  },

  urgentNeedLabel: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  urgentNeedText: {
    color: '#666666',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    marginTop: 17,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  detailsText: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
  },

  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
  },

  donationCard: {
    backgroundColor: RED,
    borderRadius: 21,
    padding: 21,
    marginTop: 18,
  },

  donationIcon: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  donationTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 14,
  },

  donationText: {
    color: '#FFFFFF',
    opacity: 0.88,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },

  donationButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  donationButtonText: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
  },

  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 10,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    paddingVertical: 45,
    paddingHorizontal: 20,
    alignItems: 'center',
  },

  emptyTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },

  emptyText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },

  caseCardSpacing: {
    marginBottom: 14,
  },

  caseImage: {
    width: '100%',
    height: '100%',
  },
  heroPill: { marginTop: 19, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0F0', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 24 },
  heroPillText: { color: RED, fontSize: 12, fontWeight: '700' },
  toolbar: { marginTop: 8, marginBottom: 0 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, minHeight: 52, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECECEC', borderRadius: 16 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: DARK, paddingVertical: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  filterChip: { borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E9E9' },
  filterChipActive: { backgroundColor: RED, borderColor: RED },
  filterText: { color: '#666666', fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  sectionCaption: { color: '#888888', fontSize: 12, marginTop: 4 },
  countPill: { minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 9, backgroundColor: '#FBE9E9', alignItems: 'center', justifyContent: 'center' },
  countText: { color: RED, fontSize: 13, fontWeight: '900' },
  caseGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'stretch', rowGap: 16 },
  statusBadge: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: RED },
  completedDot: { backgroundColor: '#368564' },
  statusText: { fontSize: 10, color: '#454545', fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF0F0' },
  resetText: { color: RED, fontWeight: '800', fontSize: 12 },
  webDesktopContent: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 56 },
});
