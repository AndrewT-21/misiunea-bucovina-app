import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

type Case = {
  id: string;
  title: string;
  location: string | null;
  urgent_need: string | null;
  status: 'active' | 'completed' | 'draft' | 'archived';
  display_order: number;
  created_at: string;
  report_year: number | null;
};

export default function AdminCasesScreen() {
  const [cases, setCases] = useState<Case[]>([]);
  const [listSearch,setListSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState<'all' | Case['status']>('all');
  const [searchFocused,setSearchFocused]=useState(false);
  const [expandedArchiveYears,setExpandedArchiveYears]=useState<Record<string,boolean>>({});
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadCases();
    }, [])
  );

  async function loadCases() {
    setLoading(true);

    const { data, error } = await supabase
      .from('cases')
      .select(
        'id, title, location, urgent_need, status, display_order, created_at, report_year'
      )
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Eroare încărcare cazuri:', error);
    } else {
      setCases((data ?? []) as Case[]);
    }

    setLoading(false);
  }

  async function moveCase(
    item: Case,
    direction: 'up' | 'down'
  ) {
    const currentCases = cases.filter(
      (caseItem) => caseItem.status !== 'archived'
    );

    const index = currentCases.findIndex(
      (caseItem) => caseItem.id === item.id
    );

    const targetIndex =
      direction === 'up' ? index - 1 : index + 1;

    if (
      index === -1 ||
      targetIndex < 0 ||
      targetIndex >= currentCases.length
    ) {
      return;
    }

    const currentCase = currentCases[index];
    const targetCase = currentCases[targetIndex];

    setMovingId(currentCase.id);

    try {
      const currentOrder = currentCase.display_order;
      const targetOrder = targetCase.display_order;

      const { error: firstError } = await supabase
        .from('cases')
        .update({
          display_order: targetOrder,
        })
        .eq('id', currentCase.id);

      if (firstError) {
        throw firstError;
      }

      const { error: secondError } = await supabase
        .from('cases')
        .update({
          display_order: currentOrder,
        })
        .eq('id', targetCase.id);

      if (secondError) {
        throw secondError;
      }

      await loadCases();
    } catch (error) {
      console.log(
        'Eroare schimbare ordine cazuri:',
        error
      );

      await loadCases();
    } finally {
      setMovingId(null);
    }
  }

  // Pagina principală afișează primele trei cazuri active în ordinea stabilită.
  const homeCaseIds = new Set(cases.filter(item => item.status === 'active').slice(0, 3).map(item => item.id));

  const currentCases = cases.filter(
    (item) => item.status !== 'archived' && (statusFilter === 'all' || item.status === statusFilter) && item.title.toLocaleLowerCase('ro').includes(listSearch.trim().toLocaleLowerCase('ro'))
  );

  const archivedCases = cases.filter(
    (item) => item.status === 'archived' && (statusFilter === 'all' || statusFilter === 'archived') && item.title.toLocaleLowerCase('ro').includes(listSearch.trim().toLocaleLowerCase('ro'))
  );

  // Folosim anul cazului introdus de administrator (report_year), nu anul creării/arhivării.
  const archiveGroups = archivedCases.reduce<Record<string, Case[]>>((groups, item) => {
    const year = item.report_year != null ? String(item.report_year) : 'Fără an specificat';
    (groups[year] ??= []).push(item);
    return groups;
  }, {});
  const archiveYears = Object.keys(archiveGroups).sort((a,b) => b.localeCompare(a));

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
            Cazuri
          </Text>
        </View>

        
      </View>
      <View style={{paddingHorizontal:16,marginBottom:14,gap:12,...(Platform.OS === "web" ? {width:"100%" as const,maxWidth:1040,alignSelf:"center" as const,paddingHorizontal:32} : {})}}>
        <TouchableOpacity
          style={{backgroundColor:RED,borderRadius:14,paddingHorizontal:18,minHeight:46,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9,alignSelf:"flex-start"}}
          onPress={() =>
            router.push('/admin/cases/new')
          }
        >
          <Ionicons
            name="add"
            size={25}
            color="#FFFFFF"
          />
        <Text style={{fontSize:14,fontWeight:"800",color:"#FFF"}}>Adaugă caz</Text></TouchableOpacity>
        <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:14,paddingHorizontal:13,minHeight:46,gap:9,...(Platform.OS==='web'?{width:searchFocused? '100%' as const:230,maxWidth:'100%' as const}: {})}}>
          <Ionicons name="search-outline" size={19} color="#888" />
          <TextInput style={{flex:1,fontSize:14,color:'#171717'}} placeholder="Caută după nume..." placeholderTextColor="#999" value={listSearch} onChangeText={setListSearch} autoCorrect={false} onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)} />
        </View>
      </View>

      <View style={styles.filterArea}>
        <Text style={styles.filterHeading}>Cazuri · {cases.length}</Text>
        <View style={styles.filterRow}>
          {([['all','Toate'],['active','Active'],['completed','Finalizate'],['draft','Ciorne'],['archived','Arhivate']] as const).map(([key,label]) => (
            <TouchableOpacity key={key} onPress={() => setStatusFilter(key)} style={[styles.filterChip, statusFilter === key && styles.filterChipActive]} accessibilityRole="button" accessibilityState={{selected:statusFilter===key}}>
              <Text style={[styles.filterChipText, statusFilter === key && styles.filterChipTextActive]}>{label} · {key === 'all' ? cases.length : cases.filter(c => c.status === key).length}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă cazurile...
          </Text>
        </View>
      ) : cases.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="heart-outline"
              size={34}
              color={RED}
            />
          </View>

          <Text style={styles.emptyTitle}>
            Nu există cazuri
          </Text>

          <Text style={styles.emptyText}>
            Adaugă primul caz al Misiunii Bucovina.
          </Text>

          <TouchableOpacity
            style={styles.firstCaseButton}
            onPress={() =>
              router.push('/admin/cases/new')
            }
          >
            <Ionicons
              name="add"
              size={18}
              color="#FFFFFF"
            />

            <Text style={styles.firstCaseText}>
              Adaugă primul caz
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={currentCases}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={loadCases}
          ListHeaderComponent={
            statusFilter === 'archived' ? null : <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  ADMINISTRARE
                </Text>
                <Text style={styles.sectionTitle}>
                  {statusFilter === 'all' ? 'Cazuri curente' : statusFilter === 'active' ? 'Cazuri active' : statusFilter === 'completed' ? 'Cazuri finalizate' : statusFilter === 'draft' ? 'Ciorne' : 'Cazuri arhivate'}
                </Text>
              </View>

              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {currentCases.length}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.caseCard}>
              <View style={styles.orderColumn}>
                <Text style={styles.orderNumber}>
                  {index + 1}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    index === 0 &&
                      styles.orderButtonDisabled,
                  ]}
                  disabled={
                    statusFilter !== 'all' || !!listSearch.trim() || index === 0 ||
                    movingId !== null
                  }
                  onPress={() =>
                    moveCase(item, 'up')
                  }
                >
                  <Ionicons
                    name="chevron-up"
                    size={17}
                    color={
                      index === 0
                        ? '#CCCCCC'
                        : RED
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    index === currentCases.length - 1 &&
                      styles.orderButtonDisabled,
                  ]}
                  disabled={
                    statusFilter !== 'all' || !!listSearch.trim() || index === currentCases.length - 1 ||
                    movingId !== null
                  }
                  onPress={() =>
                    moveCase(item, 'down')
                  }
                >
                  <Ionicons
                    name="chevron-down"
                    size={17}
                    color={
                      index === currentCases.length - 1
                        ? '#CCCCCC'
                        : RED
                    }
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.caseMain}
                activeOpacity={0.8}
                onPress={() =>
                  router.push(
                    `/admin/cases/${item.id}`
                  )
                }
              >
                <View style={styles.caseIcon}>
                  <Ionicons
                    name="heart-outline"
                    size={23}
                    color={RED}
                  />
                </View>

                <View style={styles.caseContent}>
                  <Text
                    style={styles.caseTitle}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>

                  {item.urgent_need ? (
                    <Text style={styles.compactDescription} numberOfLines={1}>{item.urgent_need}</Text>
                  ) : null}
                  <View style={styles.caseBottom}>
                    {false && item.urgent_need ? (
                      <Text
                        style={styles.urgentNeed}
                        numberOfLines={1}
                      >
                        {item.urgent_need}
                      </Text>
                    ) : null}

                    <StatusBadge
                      status={item.status}
                    />
                    {homeCaseIds.has(item.id) ? (
                      <View style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#FFF0F0',borderRadius:12,paddingHorizontal:8,paddingVertical:4,marginLeft:6}}>
                        <Ionicons name="home-outline" size={12} color={RED} />
                        <Text style={{fontSize:10,fontWeight:'800',color:RED,letterSpacing:0.6}}>ACASĂ</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color="#BBBBBB"
                />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.sectionEmpty}>
              <Text style={styles.sectionEmptyText}>
                Nu există cazuri curente.
              </Text>
            </View>
          }
          ListFooterComponent={
            (statusFilter === 'all' || statusFilter === 'archived') ? <View style={styles.archiveSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.archiveEyebrow}>
                    ISTORIC
                  </Text>
                  <Text style={styles.sectionTitle}>
                    Cazuri arhivate
                  </Text>
                </View>

                <View style={styles.archiveCountBadge}>
                  <Text style={styles.archiveCountText}>
                    {archivedCases.length}
                  </Text>
                </View>
              </View>

              {archivedCases.length === 0 ? (
                <View style={styles.sectionEmpty}>
                  <Ionicons
                    name="archive-outline"
                    size={25}
                    color="#999999"
                  />
                  <Text style={styles.sectionEmptyText}>
                    Nu există cazuri arhivate.
                  </Text>
                </View>
              ) : (
                archiveYears.map((year) => (
                  <View key={year} style={{marginBottom:12}}>
                    <TouchableOpacity onPress={() => setExpandedArchiveYears(old => ({...old,[year]: !(old[year] ?? false)}))} style={{backgroundColor:'#FFFFFF',borderRadius:15,padding:16,marginBottom:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:'#ECECEC'}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:10}}><Ionicons name="calendar-outline" size={20} color={RED}/><Text style={{fontWeight:'800',fontSize:17,color:DARK}}>{year}</Text><Text style={{color:'#777',fontSize:13}}>({archiveGroups[year].length})</Text></View>
                      <Ionicons name={(expandedArchiveYears[year] ?? false) ? 'chevron-up' : 'chevron-down'} size={20} color={RED}/>
                    </TouchableOpacity>
                    {(expandedArchiveYears[year] ?? false) && archiveGroups[year].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.archivedCard}
                    activeOpacity={0.8}
                    onPress={() =>
                      router.push(
                        `/admin/cases/${item.id}`
                      )
                    }
                  >
                    <View style={styles.archiveIcon}>
                      <Ionicons
                        name="archive-outline"
                        size={22}
                        color="#777777"
                      />
                    </View>

                    <View style={styles.caseContent}>
                      <Text
                        style={styles.caseTitle}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>

                      {item.urgent_need ? <Text style={styles.compactDescription} numberOfLines={1}>{item.urgent_need}</Text> : null}

                      <View style={styles.caseBottom}>
                        <StatusBadge
                          status={item.status}
                        />
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={19}
                      color="#BBBBBB"
                    />
                  </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </View> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function StatusBadge({
  status,
}: {
  status: Case['status'];
}) {
  const labels = {
    active: 'ACTIV',
    completed: 'FINALIZAT',
    draft: 'DRAFT',
    archived: 'ARHIVAT',
  };

  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>
        {labels[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterArea: {width:'100%',maxWidth:1040,alignSelf:'center',paddingHorizontal:16,paddingBottom:14},
  filterHeading: {fontSize:17,fontWeight:'800',color:DARK,marginBottom:11},
  filterRow: {flexDirection:'row',flexWrap:'wrap',gap:8},
  filterChip: {backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EAEAEA',borderRadius:22,paddingHorizontal:14,paddingVertical:10},
  filterChipActive: {backgroundColor:RED,borderColor:RED},
  filterChipText: {fontSize:14,fontWeight:'700',color:DARK},
  filterChipTextActive: {color:'#FFFFFF'},
  compactDescription: {fontSize:11,color:'#888888',marginTop:5},
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
   ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
   ...(Platform.OS === "web" ? { paddingHorizontal: 32, paddingTop: 26, paddingBottom: 22 } : {})},

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
    fontSize:10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  title: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
   ...(Platform.OS === "web" ? { fontSize: 28 } : {})},

  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  center: {
    flex: 1,
    paddingHorizontal: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 12,
  },

  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: DARK,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 17,
  },

  emptyText: {
    color: '#888888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },

  firstCaseButton: {
    backgroundColor: RED,
    borderRadius: 15,
    paddingHorizontal: 18,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 20,
  },

  firstCaseText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  list: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 35,
   ...(Platform.OS === "web" ? { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 28, paddingTop: 22, paddingBottom: 65 } : {})},

  sectionHeader: {
    marginTop: 4,
    marginBottom: 13,
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

  countBadge: {
    minWidth: 31,
    height: 31,
    paddingHorizontal: 9,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  countText: {
    color: RED,
    fontSize: 11,
    fontWeight: '900',
  },

  archiveSection: {
    marginTop: 22,
  },

  archiveEyebrow: {
    color: '#777777',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 3,
  },

  archiveCountBadge: {
    minWidth: 31,
    height: 31,
    paddingHorizontal: 9,
    borderRadius: 16,
    backgroundColor: '#EDEDED',
    alignItems: 'center',
    justifyContent: 'center',
  },

  archiveCountText: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '900',
  },

  sectionEmpty: {
    minHeight: 90,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 7,
    marginBottom: 10,
  },

  sectionEmptyText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  archivedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  archiveIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#F1F1F1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  caseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
   ...(Platform.OS === "web" ? { borderRadius: 17, padding: 18 } : {})},

  orderColumn: {
    width: 46,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F1F1',
  },

  orderNumber: {
    color: DARK,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 4,
  },

  orderButton: {
    width: 30,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orderButtonDisabled: {
    opacity: 0.45,
  },

  caseMain: {
    flex: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  caseIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  caseContent: {
    flex: 1,
    marginLeft: 12,
  },

  caseTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
   ...(Platform.OS === "web" ? { fontSize: 17 } : {})},

  caseLocation: {
    color: '#888888',
    fontSize: 10,
    marginTop: 3,
  },

  caseBottom: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  urgentNeed: {
    flexShrink: 1,
    color: '#666666',
    fontSize: 9,
    fontWeight: '700',
  },

  statusBadge: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },

  statusText: {
    color: RED,
    fontSize: 7,
    fontWeight: '900',
  },
});