import { Platform } from 'react-native';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator,
  
  ScrollView,
  TextInput,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type Report = {
  id: string;
  title: string;
  year: number;
  description: string | null;
  pdf_url: string | null;
  status: 'published' | 'draft';
  created_at: string;
};

type AnnualVision = {
  id: string;
  year: number;
  title: string;
  message: string | null;
  pdf_url: string | null;
  status: 'published' | 'draft';
};

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [visions, setVisions] = useState<AnnualVision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const filteredReports = reports.filter((report) =>
    (filter === 'all' || report.status === filter) &&
    `${report.title} ${report.description ?? ''} ${report.year}`.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))
  );

  const filteredVisions = visions.filter((vision) =>
    (filter === 'all' || vision.status === filter) &&
    `${vision.title} ${vision.message ?? ''} ${vision.year}`
      .toLocaleLowerCase('ro')
      .includes(search.trim().toLocaleLowerCase('ro'))
  );

  useFocusEffect(
    useCallback(() => {
      loadReports();
      loadVisions();
    }, [])
  );

  async function loadReports(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from('reports')
      .select(
        'id, title, year, description, pdf_url, status, created_at'
      )
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Eroare încărcare rapoarte:', error);

      Alert.alert(
        'Eroare',
        'Rapoartele nu au putut fi încărcate.'
      );
    } else {
      setReports((data ?? []) as Report[]);
    }

    setLoading(false);
    setRefreshing(false);
  }

  async function loadVisions() {
    const { data, error } = await supabase
      .from('annual_vision')
      .select('id, year, title, message, pdf_url, status')
      .order('year', { ascending: false });

    if (error) {
      console.log('Eroare încărcare viziune anuală:', error);
    } else {
      setVisions((data ?? []) as AnnualVision[]);
    }
  }

  function confirmDeleteVision(vision: AnnualVision) {
    Alert.alert(
      'Șterge viziunea anuală',
      `Sigur vrei să ștergi viziunea pentru anul ${vision.year}?`,
      [
        {
          text: 'Anulează',
          style: 'cancel',
        },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: () => deleteVision(vision),
        },
      ]
    );
  }

  async function deleteVision(vision: AnnualVision) {
    const { error } = await supabase
      .from('annual_vision')
      .delete()
      .eq('id', vision.id);

    if (error) {
      console.log('Eroare ștergere viziune anuală:', error);

      Alert.alert(
        'Eroare',
        'Viziunea anuală nu a putut fi ștearsă.'
      );

      return;
    }

    setVisions((current) =>
      current.filter((item) => item.id !== vision.id)
    );

    // Dacă viziunea avea PDF, încercăm să eliminăm și fișierul
    // din bucket-ul report-files. Ștergerea viziunii rămâne validă
    // chiar dacă fișierul nu poate fi eliminat.
    if (vision.pdf_url) {
      try {
        const marker = '/report-files/';
        const markerIndex = vision.pdf_url.indexOf(marker);

        if (markerIndex !== -1) {
          const encodedPath = vision.pdf_url.slice(
            markerIndex + marker.length
          );
          const filePath = decodeURIComponent(encodedPath);

          const { error: storageError } =
            await supabase.storage
              .from('report-files')
              .remove([filePath]);

          if (storageError) {
            console.log(
              'PDF-ul viziunii nu a putut fi șters din Storage:',
              storageError
            );
          }
        }
      } catch (storageError) {
        console.log(
          'Eroare curățare PDF viziune:',
          storageError
        );
      }
    }
  }

  function confirmDelete(report: Report) {
    Alert.alert(
      'Șterge raportul',
      `Sigur vrei să ștergi „${report.title}”?`,
      [
        {
          text: 'Anulează',
          style: 'cancel',
        },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: () => deleteReport(report),
        },
      ]
    );
  }

  async function deleteReport(report: Report) {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', report.id);

    if (error) {
      console.log('Eroare ștergere raport:', error);

      Alert.alert(
        'Eroare',
        'Raportul nu a putut fi șters.'
      );

      return;
    }

    setReports((current) =>
      current.filter((item) => item.id !== report.id)
    );
  }

  function renderReport({ item }: { item: Report }) {
    const published = item.status === 'published';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
          router.push(`/admin/reports/${item.id}`)
        }
      >
        <View style={styles.pdfIcon}>
          <Ionicons
            name="document-text-outline"
            size={25}
            color={RED}
          />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardTop}>
            <Text style={styles.year}>
              {item.year}
            </Text>

            <View
              style={[
                styles.status,
                published
                  ? styles.statusPublished
                  : styles.statusDraft,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  published
                    ? styles.statusTextPublished
                    : styles.statusTextDraft,
                ]}
              >
                {published ? 'PUBLICAT' : 'DRAFT'}
              </Text>
            </View>
          </View>

          <Text
            style={styles.cardTitle}
            numberOfLines={2}
          >
            {item.title}
          </Text>

          {item.description ? (
            <Text
              style={styles.description}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          ) : null}

          <View style={styles.fileRow}>
            <Ionicons
              name={
                item.pdf_url
                  ? 'checkmark-circle'
                  : 'alert-circle-outline'
              }
              size={15}
              color={
                item.pdf_url ? '#358A53' : '#999999'
              }
            />

            <Text style={styles.fileText}>
              {item.pdf_url
                ? 'PDF atașat'
                : 'Fără PDF'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => confirmDelete(item)}
        >
          <Ionicons
            name="trash-outline"
            size={19}
            color={RED}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={DARK}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>
            ADMINISTRARE
          </Text>

          <Text style={styles.title}>
            Rapoarte
          </Text>
        </View>

      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă rapoartele...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await Promise.all([loadReports(), loadVisions()]);
                setRefreshing(false);
              }}
              tintColor={RED}
            />
          }
        >
              <View style={{ marginTop: 7, marginBottom: 15 }}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Caută rapoarte și viziuni după titlu, an..."
                  placeholderTextColor="#929292"
                  style={{ backgroundColor: '#FFFFFF', borderRadius: 15, paddingHorizontal: 18, paddingVertical: 15, fontSize: 15, color: DARK, marginBottom: 12 }}
                />
              </View>
              <View style={{ marginTop: 0, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
                  {([
                    ['all', 'Toate', reports.length + visions.length],
                    ['published', 'Publicate', reports.filter(r => r.status === 'published').length + visions.filter(v => v.status === 'published').length],
                    ['draft', 'Ciorne', reports.filter(r => r.status === 'draft').length + visions.filter(v => v.status === 'draft').length],
                  ] as const).map(([key, label, count]) => (
                    <TouchableOpacity key={key} onPress={() => setFilter(key)} style={{ backgroundColor: filter === key ? RED : '#FFFFFF', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 24, borderWidth: 1, borderColor: filter === key ? RED : '#E8E8E8' }}>
                      <Text style={{ color: filter === key ? '#FFFFFF' : DARK, fontWeight: '700' }}>{label} · {count}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionEyebrow}>
                    PLANURI ȘI DIRECȚIE
                  </Text>
                  <Text style={styles.sectionTitle}>
                    Viziunea anuală
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.visionAddButton}
                  onPress={() =>
                    router.push('/admin/reports/vision')
                  }
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={{color:"#FFFFFF",fontSize:13,fontWeight:"800"}}>Adaugă viziune anuală</Text>
                </TouchableOpacity>
              </View>

              {visions.length === 0 ? (
                <TouchableOpacity
                  style={styles.visionEmpty}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push('/admin/reports/vision')
                  }
                >
                  <View style={styles.visionIcon}>
                    <Ionicons
                      name="eye-outline"
                      size={24}
                      color={RED}
                    />
                  </View>

                  <View style={styles.visionContent}>
                    <Text style={styles.visionEmptyTitle}>
                      Adaugă viziunea anuală
                    </Text>
                    <Text style={styles.visionEmptyText}>
                      Setează anul, mesajul și documentul PDF.
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={19}
                    color="#BBBBBB"
                  />
                </TouchableOpacity>
              ) : filteredVisions.length === 0 ? (
                <View style={styles.visionEmpty}>
                  <Text style={styles.visionEmptyText}>Nu există viziuni pentru căutarea sau filtrul ales.</Text>
                </View>
              ) : (
                <ScrollView
                  style={filteredVisions.length > 3 ? styles.visionScrollLimit : undefined}
                  nestedScrollEnabled
                  scrollEnabled={filteredVisions.length > 3}
                  showsVerticalScrollIndicator={filteredVisions.length > 3}
                >
                  {filteredVisions.map((vision) => (
                  <TouchableOpacity
                    key={vision.id}
                    style={styles.visionCard}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push({
                        pathname: '/admin/reports/vision',
                        params: { id: vision.id },
                      })
                    }
                  >
                    <View style={styles.visionIcon}>
                      <Ionicons
                        name="eye-outline"
                        size={24}
                        color={RED}
                      />
                    </View>

                    <View style={styles.visionContent}>
                      <View style={styles.visionTop}>
                        <Text style={styles.visionYear}>
                          {vision.year}
                        </Text>

                        <View
                          style={[
                            styles.status,
                            vision.status === 'published'
                              ? styles.statusPublished
                              : styles.statusDraft,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              vision.status === 'published'
                                ? styles.statusTextPublished
                                : styles.statusTextDraft,
                            ]}
                          >
                            {vision.status === 'published'
                              ? 'PUBLICAT'
                              : 'DRAFT'}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={styles.visionTitle}
                        numberOfLines={2}
                      >
                        {vision.title}
                      </Text>

                      <Text style={styles.fileText}>
                        {vision.pdf_url
                          ? 'PDF atașat'
                          : 'Fără PDF'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={(event) => {
                        event.stopPropagation();
                        confirmDeleteVision(vision);
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={19}
                        color={RED}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.reportsHeading}>
                <View>
                  <Text style={styles.sectionEyebrow}>
                    ACTIVITATE
                  </Text>
                  <Text style={styles.sectionTitle}>
                    Rapoarte anuale
                  </Text>
                </View>

                <View style={styles.reportsHeadingActions}>

                  <TouchableOpacity
                    style={styles.reportAddButton}
                    onPress={() =>
                      router.push('/admin/reports/create')
                    }
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color="#FFFFFF"
                    />
                  <Text style={{color:"#FFFFFF",fontSize:13,fontWeight:"800"}}>Adaugă raport anual</Text>
                  </TouchableOpacity>
                </View>
              </View>
          {filteredReports.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={35}
                  color={RED}
                />
              </View>

              <Text style={styles.emptyTitle}>
                Nu există rapoarte pentru filtrul ales
              </Text>

              <Text style={styles.emptyText}>
                Apasă butonul + pentru a adăuga
                primul raport.
              </Text>

              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() =>
                  router.push('/admin/reports/create')
                }
              >
                <Ionicons
                  name="add"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.emptyButtonText}>
                  Adaugă raport
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={filteredReports.length > 3 ? styles.reportScrollLimit : undefined}
              nestedScrollEnabled
              scrollEnabled={filteredReports.length > 3}
              showsVerticalScrollIndicator={filteredReports.length > 3}
            >
              {filteredReports.map((item) => (
                <View key={item.id}>{renderReport({ item })}</View>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
   ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 15,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
    marginLeft: 13,
  },

  eyebrow: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  title: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
  },

  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  visionScrollLimit: {
    maxHeight: 300,
  },
  reportScrollLimit: {
    maxHeight: 390,
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web' ? { overflowY: 'auto' as const } : {}),
  },
  list: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15,
    paddingBottom: 40,
  },

  emptyList: {
    flexGrow: 1,
  },

  count: {
    color: '#999999',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },

  sectionHeading: {
    marginTop: 7,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionEyebrow: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 3,
  },

  sectionTitle: {
    color: DARK,
    fontSize: 19,
    fontWeight: '900',
  },

  visionAddButton: {
    paddingHorizontal: 17,
    minHeight: 42,
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  visionEmpty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  visionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  visionIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  visionContent: {
    flex: 1,
    marginLeft: 12,
  },

  visionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },

  visionYear: {
    color: RED,
    fontSize: 11,
    fontWeight: '900',
  },

  visionTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
  },

  visionEmptyTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
  },

  visionEmptyText: {
    color: '#888888',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  reportsHeading: {
    marginTop: 25,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  reportsHeadingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  reportAddButton: {
    paddingHorizontal: 17,
    minHeight: 42,
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  pdfIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardContent: {
    flex: 1,
    marginLeft: 12,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },

  year: {
    color: RED,
    fontSize: 11,
    fontWeight: '900',
    marginRight: 8,
  },

  status: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  statusPublished: {
    backgroundColor: '#EAF7EE',
  },

  statusDraft: {
    backgroundColor: '#F1F1F1',
  },

  statusText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  statusTextPublished: {
    color: '#358A53',
  },

  statusTextDraft: {
    color: '#777777',
  },

  cardTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },

  description: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },

  fileText: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 5,
  },

  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 10,
  },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
    paddingTop: 35,
    paddingBottom: 45,
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  emptyTitle: {
    color: DARK,
    fontSize: 19,
    fontWeight: '900',
  },

  emptyText: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },

  emptyButton: {
    backgroundColor: RED,
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 17,
  },

  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 6,
  },
});