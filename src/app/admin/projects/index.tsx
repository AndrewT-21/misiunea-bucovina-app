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

type ProjectStatus =
  | 'active'
  | 'seasonal'
  | 'permanent'
  | 'planned'
  | 'draft';

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  display_order: number;
};

export default function AdminProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [listSearch,setListSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState<'all' | ProjectStatus>('all');
  const [searchFocused,setSearchFocused]=useState(false);
  const [loading, setLoading] = useState(true);
  const [changingOrder, setChangingOrder] = useState(false);

  async function loadProjects() {
    setLoading(true);

    const { data, error } = await supabase
      .from('projects')
      .select(
        'id, title, description, status, display_order'
      )
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.log(
        'Eroare încărcare proiecte:',
        error
      );
    } else {
      setProjects((data ?? []) as Project[]);
    }

    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [])
  );

  async function moveProject(
    index: number,
    direction: 'up' | 'down'
  ) {
    if (changingOrder) return;

    const targetIndex =
      direction === 'up'
        ? index - 1
        : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= projects.length
    ) {
      return;
    }

    const currentProject = projects[index];
    const targetProject = projects[targetIndex];

    setChangingOrder(true);

    try {
      /*
       * Schimbăm între ele valorile display_order.
       *
       * Exemplu:
       * Proiect A = 1
       * Proiect B = 2
       *
       * Dacă B urcă:
       * B devine 1
       * A devine 2
       */

      const currentOrder =
        currentProject.display_order;

      const targetOrder =
        targetProject.display_order;

      const { error: currentError } =
        await supabase
          .from('projects')
          .update({
            display_order: targetOrder,
          })
          .eq('id', currentProject.id);

      if (currentError) {
        throw currentError;
      }

      const { error: targetError } =
        await supabase
          .from('projects')
          .update({
            display_order: currentOrder,
          })
          .eq('id', targetProject.id);

      if (targetError) {
        throw targetError;
      }

      /*
       * Actualizăm imediat și interfața,
       * fără să așteptăm o nouă încărcare.
       */

      const updatedProjects = [...projects];

      updatedProjects[index] = {
        ...targetProject,
        display_order: currentOrder,
      };

      updatedProjects[targetIndex] = {
        ...currentProject,
        display_order: targetOrder,
      };

      setProjects(updatedProjects);
    } catch (error) {
      console.log(
        'Eroare schimbare ordine proiecte:',
        error
      );

      /*
       * Dacă apare o eroare, încărcăm din nou
       * ordinea reală din Supabase.
       */
      await loadProjects();
    } finally {
      setChangingOrder(false);
    }
  }

  function getStatusLabel(
    status: ProjectStatus
  ) {
    if (status === 'active') {
      return 'Activ';
    }

    if (status === 'seasonal') {
      return 'Sezonier';
    }

    if (status === 'permanent') {
      return 'Permanent';
    }

    if (status === 'planned') {
      return 'În perspectivă';
    }

    return 'Draft';
  }

  function getStatusIcon(
    status: ProjectStatus
  ) {
    if (status === 'seasonal') {
      return 'calendar-outline';
    }

    if (status === 'permanent') {
      return 'infinite-outline';
    }

    if (status === 'planned') {
      return 'time-outline';
    }

    if (status === 'draft') {
      return 'document-outline';
    }

    return 'checkmark-circle-outline';
  }

  const filteredProjects = projects.filter(item => (statusFilter === 'all' || item.status === statusFilter) && item.title.toLocaleLowerCase('ro').includes(listSearch.trim().toLocaleLowerCase('ro')));

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      {/* HEADER */}

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
            Proiecte
          </Text>
        </View>

        
      </View>
      <View style={{paddingHorizontal:16,marginBottom:14,gap:12,...(Platform.OS === "web" ? {width:"100%" as const,maxWidth:1040,alignSelf:"center" as const,paddingHorizontal:32} : {})}}>
        <TouchableOpacity
          style={{backgroundColor:RED,borderRadius:14,paddingHorizontal:18,minHeight:46,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9,alignSelf:"flex-start"}}
          onPress={() =>
            router.push(
              '/admin/projects/new'
            )
          }
        >
          <Ionicons
            name="add"
            size={27}
            color="#FFFFFF"
          />
        <Text style={{fontSize:14,fontWeight:"800",color:"#FFF"}}>Adaugă proiect</Text></TouchableOpacity>
        <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:14,paddingHorizontal:13,minHeight:46,gap:9,...(Platform.OS==='web'?{width:searchFocused? '100%' as const:230,maxWidth:'100%' as const}: {})}}>
          <Ionicons name="search-outline" size={19} color="#888" />
          <TextInput style={{flex:1,fontSize:14,color:'#171717'}} placeholder="Caută după nume..." placeholderTextColor="#999" value={listSearch} onChangeText={setListSearch} autoCorrect={false} onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)} />
        </View>
      </View>

      <View style={{width:'100%',maxWidth:1040,alignSelf:'center',paddingHorizontal:16,marginBottom:14}}>
        <Text style={{fontWeight:'800',color:DARK,fontSize:17,marginBottom:10}}>Proiecte · {projects.length}</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          {([['all','Toate'],['active','Active'],['permanent','Permanente'],['seasonal','Sezoniere'],['planned','Planificate'],['draft','Ciorne']] as const).map(([key,label]) => (
            <TouchableOpacity key={key} onPress={()=>setStatusFilter(key)} style={{backgroundColor:statusFilter===key?RED:'#FFF',paddingVertical:10,paddingHorizontal:14,borderRadius:22,borderWidth:1,borderColor:statusFilter===key?RED:'#EAEAEA'}}>
              <Text style={{color:statusFilter===key?'#FFF':DARK,fontWeight:'700'}}>{label} · {key==='all'?projects.length:projects.filter(p=>p.status===key).length}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {/* LOADING */}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă proiectele...
          </Text>
        </View>
      ) : projects.length === 0 ? (
        /* EMPTY */

        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="folder-open-outline"
              size={38}
              color={RED}
            />
          </View>

          <Text style={styles.emptyTitle}>
            Nu există proiecte
          </Text>

          <Text style={styles.emptyText}>
            Adaugă primul proiect folosind
            butonul + din partea de sus.
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() =>
              router.push(
                '/admin/projects/new'
              )
            }
          >
            <Ionicons
              name="add"
              size={18}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.emptyButtonText
              }
            >
              Adaugă proiect
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* PROJECT LIST */

        <FlatList
          data={filteredProjects}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={styles.projectCard}>
              <View style={styles.orderColumn}>
                <Text style={styles.orderNumber}>
                  {index + 1}
                </Text>

                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    projects.findIndex(p=>p.id===item.id) === 0 && styles.orderButtonDisabled,
                  ]}
                  disabled={projects.findIndex(p=>p.id===item.id) === 0 || changingOrder}
                  onPress={() => moveProject(projects.findIndex(p=>p.id===item.id), 'up')}
                >
                  <Ionicons
                    name="chevron-up"
                    size={17}
                    color={index === 0 ? '#CCCCCC' : RED}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    projects.findIndex(p=>p.id===item.id) === projects.length - 1 &&
                      styles.orderButtonDisabled,
                  ]}
                  disabled={
                    projects.findIndex(p=>p.id===item.id) === projects.length - 1 ||
                    changingOrder
                  }
                  onPress={() => moveProject(projects.findIndex(p=>p.id===item.id), 'down')}
                >
                  <Ionicons
                    name="chevron-down"
                    size={17}
                    color={
                      index === projects.length - 1
                        ? '#CCCCCC'
                        : RED
                    }
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.projectMain}
                activeOpacity={0.8}
                onPress={() =>
                  router.push(`/admin/projects/${item.id}`)
                }
              >
                <View style={styles.projectIcon}>
                  <Ionicons
                    name={getStatusIcon(item.status)}
                    size={25}
                    color={
                      item.status === 'draft'
                        ? '#777777'
                        : RED
                    }
                  />
                </View>

                <View style={styles.projectInfo}>
                  <Text
                    style={styles.projectTitle}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>

                  {item.description ? (
                    <Text
                      style={styles.description}
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                  ) : null}

                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        item.status === 'draft' &&
                          styles.statusDotDraft,
                      ]}
                    />

                    <Text style={styles.statusText}>
                      {getStatusLabel(item.status)}
                    </Text>

                    {index < 3 &&
                    item.status !== 'draft' ? (
                      <View style={styles.homeBadge}>
                        <Ionicons
                          name="home-outline"
                          size={11}
                          color={RED}
                        />
                        <Text style={styles.homeBadgeText}>
                          ACASĂ
                        </Text>
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
        />
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
    marginLeft: 13,
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
  },

  loadingText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 10,
  },

  emptyIcon: {
    width: 72,
    height: 72,
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
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },

  emptyButton: {
    minHeight: 48,
    backgroundColor: RED,
    borderRadius: 14,
    paddingHorizontal: 20,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  list: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 35,
   ...(Platform.OS === "web" ? { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 28, paddingTop: 22, paddingBottom: 65 } : {})},

  projectCard: {
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

  projectMain: {
    flex: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },

  projectIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  projectInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },

  projectTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
   ...(Platform.OS === "web" ? { fontSize: 17 } : {})},

  description: {
    color: '#888888',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 7,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: RED,
    marginRight: 5,
  },

  statusDotDraft: {
    backgroundColor: '#999999',
  },

  statusText: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '800',
  },

  homeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 8,
    gap: 3,
  },

  homeBadgeText: {
    color: RED,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

});