import AdminSectionHeader from '../../../components/AdminSectionHeader';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ActivityIndicator, FlatList, Keyboard, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';

type Application = {
  id: string;
  full_name: string;
  city: string;
  county: string | null;
  email: string;
  status: string;
  created_at: string;
  domains: string[];
};

const STATUS: Record<string, { label: string; color: string; background: string }> = {
  noua: { label: 'Nouă', color: '#A61E22', background: '#FCE9E9' },
  in_analiza: { label: 'În analiză', color: '#8A5B0A', background: '#FFF2D8' },
  acceptata: { label: 'Acceptată', color: '#20734B', background: '#E3F5EA' },
  respinsa: { label: 'Respinsă', color: '#777', background: '#ECECEC' },
};

function SchoolApplicationsScreen() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('toate');
  const [search, setSearch] = useState('');

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        Alert.alert('Acces restricționat', 'Autentifică-te ca administrator.');
        router.back();
        return;
      }
      const { data: admin, error: adminError } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (adminError) throw adminError;
      if (!admin) {
        Alert.alert('Acces interzis', 'Acest cont nu este administrator.');
        router.back();
        return;
      }
      const { data, error } = await supabase.from('school_instructor_applications')
        .select('id, full_name, city, county, email, status, created_at, domains')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as Application[]);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const normalizedSearch = search.trim().toLocaleLowerCase('ro-RO');
  const visible = items.filter(item =>
    (filter === 'toate' || item.status === filter) &&
    (!normalizedSearch || [item.full_name, item.email, item.city, item.county ?? '', ...(item.domains ?? [])]
      .some(value => value.toLocaleLowerCase('ro-RO').includes(normalizedSearch)))
  );
  const filters = [{ id: 'toate', label: 'Toate' }, ...Object.entries(STATUS).map(([id, value]) => ({ id, label: value.label }))];
  const hasFilters = filter !== 'toate' || search.trim().length > 0;
  const resetFilters = () => { setFilter('toate'); setSearch(''); Keyboard.dismiss(); };
  const formatDate = (date: string) => new Date(date).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (loading) return <SafeAreaView style={styles.screen}><View style={styles.loadingContainer}><ActivityIndicator size="large" color={RED} /><Text style={styles.loadingText}>Se încarcă cererile...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AdminSectionHeader title="Cereri instructori" backTo="/admin" />
      <View style={styles.overview}>
        <Text style={styles.overviewSubtitle}>Gestionează înscrierile instructorilor</Text>
        <View style={styles.statsRow}>
          {[
            { label: 'Total cereri', value: items.length, icon: 'documents-outline' as const },
            { label: 'Cereri noi', value: items.filter(item => item.status === 'noua').length, icon: 'time-outline' as const },
            { label: 'Acceptate', value: items.filter(item => item.status === 'acceptata').length, icon: 'checkmark-circle-outline' as const },
          ].map(stat => <View style={styles.statCard} key={stat.label}>
            <Ionicons name={stat.icon} size={20} color={RED} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>)}
        </View>
      </View>
      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#858585" />
          <TextInput style={styles.searchInput} placeholder="Caută nume, email, localitate, domeniu..." placeholderTextColor="#999" value={search} onChangeText={setSearch} autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
          {search.length > 0 && <TouchableOpacity accessibilityLabel="Șterge căutarea" onPress={() => setSearch('')}><Ionicons name="close-circle" size={20} color="#999" /></TouchableOpacity>}
        </View>
        <View style={styles.filterHeading}>
          <Text style={styles.filterHeadingText}>FILTRARE CERERI</Text>
          {hasFilters && <TouchableOpacity onPress={resetFilters}><Text style={styles.resetText}>Resetează</Text></TouchableOpacity>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filters}>
          {filters.map(option => <TouchableOpacity key={option.id} onPress={() => setFilter(option.id)} style={[styles.filterButton, filter === option.id && styles.filterButtonSelected]}>
            <Text style={[styles.filterText, filter === option.id && styles.filterTextSelected]}>{option.label}</Text>
          </TouchableOpacity>)}
        </ScrollView>
      </View>
      <FlatList
        data={visible}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, visible.length === 0 && styles.emptyList]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(false); }} tintColor={RED} />}
        ListEmptyComponent={<View style={styles.empty}>
          <View style={styles.emptyIcon}><Ionicons name={loadError ? 'alert-circle-outline' : 'file-tray-outline'} size={36} color={RED} /></View>
          <Text style={styles.emptyTitle}>{loadError ? 'Cererile nu s-au încărcat' : hasFilters ? 'Niciun rezultat' : 'Nu există cereri încă'}</Text>
          <Text style={styles.emptyText}>{loadError ?? (hasFilters ? 'Nu am găsit cereri pentru filtrele selectate.' : 'Cererile de instructor vor apărea aici.')}</Text>
          {loadError ? <TouchableOpacity style={styles.emptyAction} onPress={() => void load()}><Text style={styles.emptyActionText}>Reîncearcă</Text></TouchableOpacity> : hasFilters ? <TouchableOpacity style={styles.emptyAction} onPress={resetFilters}><Text style={styles.emptyActionText}>Resetează filtrele</Text></TouchableOpacity> : null}
        </View>}
        renderItem={({ item }) => {
          const status = STATUS[item.status] ?? { label: item.status, color: '#777', background: '#EEE' };
          return <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push({ pathname: '/admin/school-applications/[id]', params: { id: item.id } })}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}><Ionicons name="person" size={22} color={RED} /></View>
              <View style={styles.person}><Text style={styles.name} numberOfLines={1}>{item.full_name}</Text><Text style={styles.email} numberOfLines={1}>{item.email}</Text></View>
              <View style={[styles.statusBadge, { backgroundColor: status.background }]}><Text style={[styles.statusText, { color: status.color }]}>{status.label.toLocaleUpperCase('ro-RO')}</Text></View>
            </View>
            {(item.city || item.county) && <View style={styles.infoRow}><Ionicons name="location-outline" size={15} color="#888" /><Text style={styles.infoText}>{[item.city, item.county].filter(Boolean).join(', ')}</Text></View>}
            {(item.domains ?? []).length > 0 && <View style={styles.options}>{item.domains.map((domain, i) => <View key={`${domain}-${i}`} style={styles.optionBadge}><Text style={styles.optionBadgeText}>{domain}</Text></View>)}</View>}
            <View style={styles.cardFooter}>
              <View style={styles.dateRow}><Ionicons name="calendar-outline" size={14} color="#999" /><Text style={styles.dateText}>{formatDate(item.created_at)}</Text></View>
              <View style={styles.openRow}><Text style={styles.openText}>Vezi cererea</Text><Ionicons name="chevron-forward" size={16} color={RED} /></View>
            </View>
          </TouchableOpacity>;
        }}
      />
    </SafeAreaView>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : 'Încearcă din nou.';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F7F8' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#777', fontSize: 12, marginTop: 10 },
  overview: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}) },
  overviewSubtitle: { fontSize: 13, color: '#777', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, minWidth: 0, backgroundColor: '#FFF', borderRadius: 18, padding: 13, minHeight: 116, justifyContent: 'space-between' },
  statValue: { fontSize: 29, fontWeight: '900', color: DARK, marginTop: 5 },
  statLabel: { fontSize: 10, color: '#777', fontWeight: '600' },
  searchArea: { paddingHorizontal: 16, paddingBottom: 10, ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}) },
  searchBox: { height: 52, borderRadius: 15, backgroundColor: '#FFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, color: DARK, fontSize: 13, marginLeft: 9, paddingVertical: 8 },
  filterHeading: { marginTop: 17, marginBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterHeadingText: { color: '#888', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  resetText: { color: RED, fontSize: 12, fontWeight: '800' },
  filters: { gap: 7, paddingVertical: 11, paddingRight: 12 },
  filterButton: { minHeight: 38, paddingHorizontal: 15, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ECECEC' },
  filterButtonSelected: { backgroundColor: RED, borderColor: RED },
  filterText: { color: '#666', fontSize: 12, fontWeight: '700' },
  filterTextSelected: { color: '#FFF' },
  list: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), padding: 15, paddingBottom: 35 },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 23, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: DARK, fontSize: 18, fontWeight: '900', marginTop: 14 },
  emptyText: { color: '#888', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  emptyAction: { marginTop: 18, backgroundColor: RED, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  emptyActionText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: '#FFF', borderRadius: 19, padding: 16, marginBottom: 11 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  person: { flex: 1, marginLeft: 11, marginRight: 8 },
  name: { color: DARK, fontSize: 14, fontWeight: '900' },
  email: { color: '#888', fontSize: 10, marginTop: 3 },
  statusBadge: { backgroundColor: '#FFF0F0', borderRadius: 15, paddingHorizontal: 8, paddingVertical: 6 },
  statusText: { color: RED, fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  infoText: { flex: 1, color: '#666', fontSize: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 13 },
  optionBadge: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  optionBadgeText: { color: '#666', fontSize: 8, fontWeight: '700' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F2F2F2', marginTop: 14, paddingTop: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { color: '#999', fontSize: 9 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openText: { color: RED, fontSize: 9, fontWeight: '900' },
});

export default SchoolApplicationsScreen;
