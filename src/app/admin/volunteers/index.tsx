import AdminSectionHeader from '../../../components/AdminSectionHeader';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  Modal,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type VolunteerApplication = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  involvement_options: string[] | null;
  status: 'new' | 'contacted' | 'accepted' | 'rejected';
  created_at: string;
};

const statusFilters = [
  { value: 'all', label: 'Toți' },
  { value: 'new', label: 'Nou' },
  { value: 'contacted', label: 'Contactat' },
  { value: 'accepted', label: 'Acceptat' },
  { value: 'rejected', label: 'Respins' },
] as const;

const involvementFilters = [
  'Toate domeniile',
  'Proiecte sociale',
  'Activități cu copii',
  'Distribuire alimente',
  'Logistică',
  'Evenimente',
  'Foto / Video / Media',
  'Șofer / Transport',
  'Rugăciune',
  'Altele',
] as const;

export default function VolunteersScreen() {
  const [applications, setApplications] = useState<
    VolunteerApplication[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
  'all' | 'new' | 'contacted' | 'accepted' | 'rejected'
>('all');
const [involvementFilter, setInvolvementFilter] =
  useState('Toate domeniile');
  const [domainPickerOpen, setDomainPickerOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadApplications(showLoader = true) {
    if (showLoader) {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from('volunteer_applications')
      .select(
        `
          id,
          name,
          email,
          phone,
          city,
          country,
          involvement_options,
          status,
          created_at
        `
      )
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      console.log(
        'Eroare încărcare voluntari:',
        error
      );

      setLoadError('Nu am putut încărca cererile. Verifică permisiunile sau conexiunea și încearcă din nou.');
    } else {
      setLoadError(null);
      setApplications(
        (data ?? []) as VolunteerApplication[]
      );
    }

    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadApplications();
    }, [])
  );

  function refresh() {
    setRefreshing(true);
    loadApplications(false);
  }

  function getStatusLabel(
    status: VolunteerApplication['status']
  ) {
    switch (status) {
      case 'contacted':
        return 'CONTACTAT';

      case 'accepted':
        return 'ACCEPTAT';

      case 'rejected':
        return 'RESPINS';

      default:
        return 'NOU';
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(
      'ro-RO',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }
    );
  }

  const totalNew = applications.filter((item) => item.status === 'new').length;
  const totalAccepted = applications.filter((item) => item.status === 'accepted').length;
  const hasFilters = search.trim().length > 0 || statusFilter !== 'all' || involvementFilter !== 'Toate domeniile';
  function resetFilters() { setSearch(''); setStatusFilter('all'); setInvolvementFilter('Toate domeniile'); Keyboard.dismiss(); }

  const normalizedSearch = search
  .trim()
  .toLowerCase();

const filteredApplications = applications.filter(
  (application) => {
    const matchesStatus =
      statusFilter === 'all' ||
      application.status === statusFilter;

    const matchesInvolvement =
      involvementFilter === 'Toate domeniile' ||
      (application.involvement_options ?? []).includes(
        involvementFilter
      );

    if (!matchesStatus || !matchesInvolvement) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return (
      application.name
        .toLowerCase()
        .includes(normalizedSearch) ||
      application.email
        .toLowerCase()
        .includes(normalizedSearch) ||
      (application.city ?? '')
        .toLowerCase()
        .includes(normalizedSearch) ||
      (application.country ?? '')
        .toLowerCase()
        .includes(normalizedSearch) ||
      (application.phone ?? '')
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }
);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă cererile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <AdminSectionHeader title="Cereri voluntariat" backTo="/voluntar/departamente" />
      <View style={styles.overview}>
        <Text style={styles.overviewSubtitle}>Gestionează înscrierile voluntarilor</Text>
        <View style={styles.statsRow}>
          {[
            { label: 'Total cereri', value: applications.length, icon: 'documents-outline' as const },
            { label: 'Cereri noi', value: totalNew, icon: 'time-outline' as const },
            { label: 'Acceptate', value: totalAccepted, icon: 'checkmark-circle-outline' as const },
          ].map((stat) => (
            <View style={styles.statCard} key={stat.label}>
              <Ionicons name={stat.icon} size={20} color={RED} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#858585" />
          <TextInput
            style={styles.searchInput}
            placeholder="Caută nume, email, telefon, localitate..."
            placeholderTextColor="#999999"
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity accessibilityLabel="Șterge căutarea" onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#999999" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filterHeading}>
          <Text style={styles.filterHeadingText}>FILTRARE CERERI</Text>
          {hasFilters && <TouchableOpacity onPress={resetFilters}><Text style={styles.resetText}>Resetează</Text></TouchableOpacity>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filters}>
          {statusFilters.map((filter) => {
            const selected = statusFilter === filter.value;
            return (
              <TouchableOpacity key={filter.value} style={[styles.filterButton, selected && styles.filterButtonSelected]} onPress={() => setStatusFilter(filter.value)}>
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.domainSelect} onPress={() => { Keyboard.dismiss(); setDomainPickerOpen(true); }} accessibilityRole="button" accessibilityLabel="Selectează domeniul de implicare">
          <View style={styles.domainSelectLeft}>
            <Ionicons name="options-outline" size={19} color={RED} />
            <Text style={styles.domainSelectText} numberOfLines={1}>{involvementFilter}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color="#777777" />
        </TouchableOpacity>
      </View>
      <Modal visible={domainPickerOpen} transparent animationType="fade" onRequestClose={() => setDomainPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.domainModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Domeniu de implicare</Text>
              <TouchableOpacity onPress={() => setDomainPickerOpen(false)} accessibilityLabel="Închide"><Ionicons name="close-circle-outline" size={27} color="#555555" /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {involvementFilters.map((filter) => (
                <TouchableOpacity key={filter} style={styles.domainOption} onPress={() => { setInvolvementFilter(filter); setDomainPickerOpen(false); }}>
                  <Text style={[styles.domainOptionText, involvementFilter === filter && { color: RED, fontWeight: '800' }]}>{filter}</Text>
                  {involvementFilter === filter && <Ionicons name="checkmark-circle" size={20} color={RED} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FlatList
        data={filteredApplications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          filteredApplications.length === 0 &&
            styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={RED}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name={loadError ? 'alert-circle-outline' : 'file-tray-outline'} size={36} color={RED} /></View>
            <Text style={styles.emptyTitle}>{loadError ? 'Cererile nu s-au încărcat' : hasFilters ? 'Niciun rezultat' : 'Nu există cereri încă'}</Text>
            <Text style={styles.emptyText}>{loadError ?? (hasFilters ? 'Nu am găsit cereri pentru filtrele selectate.' : 'Cererile trimise prin formularul de voluntariat vor apărea aici.')}</Text>
            {loadError ? <TouchableOpacity style={styles.emptyAction} onPress={() => loadApplications()}><Text style={styles.emptyActionText}>Reîncearcă</Text></TouchableOpacity> : hasFilters ? <TouchableOpacity style={styles.emptyAction} onPress={resetFilters}><Text style={styles.emptyActionText}>Resetează filtrele</Text></TouchableOpacity> : null}
          </View>
        }
        renderItem={({ item }) => (
  <TouchableOpacity
    style={styles.card}
    activeOpacity={0.8}
    onPress={() =>
      router.push({
        pathname: '/admin/volunteers/[id]',
        params: { id: item.id },
      })
    }
  >
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Ionicons
                  name="person"
                  size={22}
                  color={RED}
                />
              </View>

              <View style={styles.person}>
                <Text
                  style={styles.name}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>

                <Text
                  style={styles.email}
                  numberOfLines={1}
                >
                  {item.email}
                </Text>
              </View>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {getStatusLabel(item.status)}
                </Text>
              </View>
            </View>

            {(item.city || item.country) && (
              <View style={styles.infoRow}>
                <Ionicons
                  name="location-outline"
                  size={15}
                  color="#888888"
                />

                <Text style={styles.infoText}>
                  {[item.city, item.country]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
            )}

            {item.phone ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="call-outline"
                  size={15}
                  color="#888888"
                />

                <Text style={styles.infoText}>
                  {item.phone}
                </Text>
              </View>
            ) : null}

            {item.involvement_options &&
            item.involvement_options.length >
              0 ? (
              <View style={styles.options}>
                {item.involvement_options.map(
                  (option) => (
                    <View
                      key={option}
                      style={styles.optionBadge}
                    >
                      <Text
                        style={
                          styles.optionBadgeText
                        }
                      >
                        {option}
                      </Text>
                    </View>
                  )
                )}
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <View style={styles.dateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color="#999999"
                />

                <Text style={styles.dateText}>
                  {formatDate(item.created_at)}
                </Text>
              </View>

              <View style={styles.openRow}>
                <Text style={styles.openText}>
                  Vezi cererea
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={RED}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
   ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 12,
    marginTop: 10,
  },

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    minHeight: 76,
    backgroundColor: BACKGROUND,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    ...(Platform.OS === 'web' ? {} : {borderBottomWidth: 1, borderBottomColor: '#EEEEEE'}),
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerContent: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 0,
  },

  headerTitle: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
  },

  headerSubtitle: {
    color: '#888888',
    fontSize: 9,
    marginTop: 2,
  },

  headerSpace: {
    width: 0,
  },

  overview: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14, ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}) },
  overviewSubtitle: { fontSize: 13, color: '#777777', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 13, minHeight: 116, justifyContent: 'space-between' },
  statValue: { fontSize: 29, fontWeight: '900', color: DARK, marginTop: 5 },
  statLabel: { fontSize: 10, color: '#777777', fontWeight: '600' },
  searchArea: { paddingHorizontal: 16, paddingBottom: 10, ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}) },
  searchBox: { height: 52, borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  searchBoxExpanded: {},
  searchInput: { flex: 1, color: DARK, fontSize: 13, marginLeft: 9, paddingVertical: 8 },
  filterHeading: { marginTop: 17, marginBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterHeadingText: { color: '#888888', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  resetText: { color: RED, fontSize: 12, fontWeight: '800' },
  filters: { gap: 7, paddingVertical: 11, paddingRight: 12 },
  filterButton: { minHeight: 38, paddingHorizontal: 15, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ECECEC' },
  filterButtonSelected: { backgroundColor: RED, borderColor: RED },
  filterText: { color: '#666666', fontSize: 12, fontWeight: '700' },
  filterTextSelected: { color: '#FFFFFF' },
  domainSelect: { backgroundColor: '#FFFFFF', borderRadius: 14, minHeight: 49, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#EEEEEE' },
  domainSelectLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  domainSelectText: { flex: 1, color: '#444444', fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'center', paddingHorizontal: 22 },
  domainModal: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: 18, color: DARK, fontWeight: '900', flex: 1 },
  domainOption: { minHeight: 48, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F1F1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  domainOptionText: { fontSize: 14, color: '#333333', flex: 1 },
  emptyAction: { marginTop: 18, backgroundColor: RED, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  emptyActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  list: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 35,
  },

  emptyList: {
    flexGrow: 1,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 23,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyText: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 16,
    marginBottom: 11,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  person: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },

  name: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
  },

  email: {
    color: '#888888',
    fontSize: 10,
    marginTop: 3,
  },

  statusBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  statusText: {
    color: RED,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 11,
  },

  infoText: {
    flex: 1,
    color: '#666666',
    fontSize: 10,
  },

  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 13,
  },

  optionBadge: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  optionBadgeText: {
    color: '#666666',
    fontSize: 8,
    fontWeight: '700',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',
    marginTop: 14,
    paddingTop: 12,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  dateText: {
    color: '#999999',
    fontSize: 9,
  },

  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  openText: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
  },

  involvementSection: {
  marginTop: 13,
},

filterLabel: {
  color: '#999999',
  fontSize: 8,
  fontWeight: '900',
  letterSpacing: 0.8,
  marginBottom: 7,
  marginLeft: 2,
},

involvementFilters: {
  gap: 7,
  paddingRight: 10,
},

involvementButton: {
  minHeight: 34,
  paddingHorizontal: 12,
  borderRadius: 11,
  backgroundColor: '#F4F4F4',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
},

involvementButtonSelected: {
  backgroundColor: RED,
},

involvementText: {
  color: '#777777',
  fontSize: 9,
  fontWeight: '700',
},

involvementTextSelected: {
  color: '#FFFFFF',
},

});