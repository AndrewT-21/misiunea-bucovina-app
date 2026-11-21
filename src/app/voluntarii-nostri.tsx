import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { supabase } from '../lib/supabase';

type Volunteer = { id: string; display_name: string; role: string; photo_url?: string | null; featured: boolean; is_new?: boolean; sort_order?: number; photo_zoom?: number; photo_position_x?: number; photo_position_y?: number };
const RED = '#A61E22';
// Lista de referință este publică pe site-ul asociației. Fotografiile nu sunt copiate automat:
// ele trebuie publicate numai după confirmarea consimțământului.
const featuredNames: [string, string][] = [
  ['Abel și Andreea P.', 'Organizatori proiecte'], ['Agnes G.', 'Școala Creștină MB'],
  ['Alexandra H.', 'Școala Creștină MB'], ['Amalia D.', 'Școala Creștină MB'],
  ['Ana-Maria G.', 'Lider Școala Creștină'], ['Andrei T.', 'Programator'],
  ['Catalin C.', 'Consilier dezvoltare'], ['Cosmin M.', 'Fotograf'],
  ['Daniela C.', 'Școala Creștină MB'], ['Daniela G.', 'Școala Creștină MB'],
  ['Darius S.', 'Coordonator logistică transport'], ['Ema B.', 'Școala Creștină MB'],
  ['Francesca G.', 'Școala Creștină MB'], ['Matteo H.', 'Coordonator proiecte și cazuri'],
  ['Naomi R.', 'Școala Creștină MB'], ['Rebeca S.', 'Coordonator media și editor'],
  ['Sabrina T.', 'Școala Creștină MB'], ['Sergio F.', 'Programator'],
  ['Silviu C.', 'Școala Creștină MB'], ['Simina L.', 'Școala Creștină MB'],
  ['Tabita A.', 'Videograf și editor'], ['Veronica U.', 'Lider Școala Creștină'],
];
const otherNames = `Ada G.|Adrian T.|Alessia H.|Alina F.|Alisa A.|Amaris C.|Ana B.|Ana U.|Andreea A.|Andrei L.|Andrei V.|Bianca G.|Damaris L.|Damaris P.|Damaris R.|Daniel|Daniel C.|Daniel și Denisa H.|Daniela G.|Daniela L.|Daniela P.|Daniele H.|David M.|David T.|Delia N.|Denis P.|Denisa D.|Denisa I.|Denisa V.|Diana B.|Domnica M.|Dumitru și Brenda H.|Eduard P.|Elisa N.|Elisa V.|Elisei A.|Eliza S.|Emanuel I.|Emanuel M.|Emanuel S.|Emanuela J.|Emanuela V.|Emima U.|Erika B.|Estera B.|Estera M.|Estera P.|Eusebiu L.|Evelina I.|Florentina T.|Gabriel C.|Hadasa U.|Iosua T.|Irina B.|Larisa C.|Lidia N.|Lois U.|Luca H.|Mădălina L.|Magda C.|Mirela G.|Naomi K.|Naomi M.|Naomi U.|Narcis T.|Natan U.|Onisim I.|Paul și Loredana S.|Rahela F.|Rahela L.|Raisa C.|Ramona B.|Rebeca B.|Rebeca E.|Rebeca F.|Rebeca N.|Robert O.|Ruben și Bianca T.|Ruth V.|Samuel D.|Sara C.|Sara L.|Sara P.|Sebi M.|Sefora L.|Simon F.|Simona P.|Tabita D.|Tabita M.|Tamara C.|Valentin T.|Valentina L.|Veronica D.|Stanciu S.|Stanciu R.|Tataru R.|Panțiru M.|Saghin I.`.split('|');
const fallback: Volunteer[] = [
  ...featuredNames.map(([display_name, role], i) => ({ id: `featured-${i}`, display_name, role, featured: true })),
  ...otherNames.map((display_name, i) => ({ id: `volunteer-${i}`, display_name, role: 'Voluntar', featured: false })),
];
export default function VolunteersPage() {
  const { width, height } = useWindowDimensions();
  const outerScrollRef = useRef<ScrollView>(null);
  const allSectionY = useRef(0);
  const cols = width < 700 ? 2 : width < 1000 ? 3 : 4;
  const [gridWidth, setGridWidth] = useState(0);
  // Measure the actual inner list width, not the screen width: nested padding and borders matter on iOS.
  const availableGridWidth = gridWidth || Math.max(0, Math.min(width, 1120) - 52);
  const cardWidth = Math.max(0, (availableGridWidth - (cols - 1) * 12) / cols);
  // Ca în dashboard: exact două rânduri complete, fără începutul rândului al treilea.
  // Cardul are înălțime fixă; numele și rolul au spațiu rezervat.
  const cardHeight = Math.ceil((cardWidth - 18) / 0.78 + 98);
  const listHeight = cardHeight * 2 + 12 + 20;
  const leaderWidth = Math.max(0, (Math.min(width, 1120) - 44) / 2);
  const [people, setPeople] = useState<Volunteer[]>(fallback);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'new'>('all');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Doar profilurile aprobate explicit pentru afișare publică sunt preluate.
    supabase.from('volunteer_public_profiles').select('id,display_name,role,photo_url,featured,is_new,sort_order,photo_zoom,photo_position_x,photo_position_y')
      .eq('is_published', true).order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (alive && !error && data && data.length) setPeople(data as Volunteer[]);
      }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  const filtered = useMemo(() => people.filter(p => (tab === 'all' || p.is_new) &&
    `${p.display_name} ${p.role}`.toLocaleLowerCase('ro').includes(query.toLocaleLowerCase('ro'))), [people, query, tab]);
  const isLeader = (p: Volunteer) => ['daniel ursachi', 'emanuel ursachi'].includes(p.display_name.trim().toLocaleLowerCase('ro'));
  const leaders = (tab === 'all' ? people.filter(p => isLeader(p) && `${p.display_name} ${p.role}`.toLocaleLowerCase('ro').includes(query.toLocaleLowerCase('ro'))) : []).sort((a, b) => (a.display_name.toLocaleLowerCase('ro').startsWith('daniel ') ? -1 : 1));
  const featured = filtered.filter(p => p.featured && !isLeader(p));
  const all = filtered.filter(p => !p.featured && !isLeader(p));
  const Card = ({ item, leader = false }: { item: Volunteer; leader?: boolean }) => <View style={[styles.person, { width: leader ? leaderWidth : cardWidth, ...(!leader ? { height: cardHeight } : {}) }, leader && styles.leaderCard]}>
    <View style={[styles.photoBox, { aspectRatio: width < 700 ? 0.78 : leader ? 0.82 : 0.75 }]}>{item.photo_url ? <Image source={{ uri: item.photo_url }} style={[styles.photo,{transform:[{scale:item.photo_zoom??1},{translateX:(item.photo_position_x??0)*cardWidth*0.25},{translateY:(item.photo_position_y??0)*cardWidth*0.31}]}]} resizeMode="cover" /> : <Ionicons name="person" size={43} color="#C9A5A6" />}</View>
    <Text numberOfLines={2} style={[styles.personName, leader && styles.leaderName]}>{item.display_name}</Text><Text numberOfLines={2} style={[styles.personRole, leader && styles.leaderRole]}>{item.role}</Text>
  </View>;
  return <SafeAreaView style={styles.root} edges={['top']}>
    <MisiBiPageHeader title="Voluntarii noștri" eyebrow="MISIUNEA BUCOVINA" />
    <ScrollView ref={outerScrollRef} contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <View style={styles.hero}><Ionicons name="people" color="#FFFFFF" size={35} />
          <Text style={styles.heroTitle}>Voluntarii noștri</Text>
          <Text style={styles.heroSubtitle}>Oameni cu inimă mare care transformă credința în faptă, zi de zi.</Text>
          <Text style={styles.heroStat}>750+ voluntari în comunitate la începutul anului 2026</Text>
          <TouchableOpacity onPress={() => router.push('/voluntariat')} style={styles.heroButton}><Text style={styles.heroButtonText}>Devino voluntar</Text><Ionicons name="arrow-forward" size={17} color={RED} /></TouchableOpacity>
        </View>
        {leaders.length > 0 && <View style={styles.leadershipSection}>
          <Text style={styles.sectionEyebrow}>ECHIPA DE CONDUCERE</Text>
          <Text style={styles.heading}>Conducerea Misiunii</Text>
          <View style={styles.leaderGrid}>{leaders.map(p => <Card key={p.id} item={p} leader />)}</View>
        </View>}
        <View style={styles.controls}>
          <TextInput placeholder="Caută după nume sau rol..." placeholderTextColor="#8B8B8B" value={query} onChangeText={setQuery} style={styles.search} />
          <View style={styles.tabs}><TouchableOpacity onPress={() => setTab('all')} style={[styles.tab, tab === 'all' && styles.tabActive]}><Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>Toți voluntarii</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setTab('new')} style={[styles.tab, tab === 'new' && styles.tabActive]}><Text style={[styles.tabText, tab === 'new' && styles.tabTextActive]}>Voluntarii noi</Text></TouchableOpacity></View>
        </View>
        {loading && <ActivityIndicator color={RED} style={{ marginVertical: 12 }} />}
        {featured.length > 0 && <View style={styles.volunteerSection}><View style={styles.listTitleRow}><Text style={styles.heading}>Voluntari implicați</Text><Text style={styles.scrollHint}>Derulează lista ↓</Text></View><ScrollView nestedScrollEnabled scrollEnabled showsVerticalScrollIndicator style={[styles.independentList, { height: listHeight }]} contentContainerStyle={styles.independentContent}><View style={styles.grid} onLayout={e => setGridWidth(e.nativeEvent.layout.width)}>{featured.map(p => <Card key={p.id} item={p} />)}</View></ScrollView><TouchableOpacity accessibilityRole="button" style={styles.exitScrollButton} onPress={() => outerScrollRef.current?.scrollTo({ y: Math.max(0, allSectionY.current - 10), animated: true })}><Text style={styles.exitScrollText}>Continuă la toți voluntarii</Text><Ionicons name="arrow-down" size={18} color={RED} /></TouchableOpacity></View>}
        <View onLayout={e => { allSectionY.current = e.nativeEvent.layout.y; }} style={styles.listTitleRow}><Text style={styles.heading}>{tab === 'new' ? 'Voluntarii noi' : 'Toți voluntarii'}</Text><Text style={styles.scrollHint}>Derulează lista ↓</Text></View>
        {all.length ? <ScrollView nestedScrollEnabled scrollEnabled showsVerticalScrollIndicator style={[styles.independentList, { height: listHeight }]} contentContainerStyle={styles.independentContent}><View style={styles.grid} onLayout={e => setGridWidth(e.nativeEvent.layout.width)}>{all.map(p => <Card key={p.id} item={p} />)}</View></ScrollView> : <Text style={styles.empty}>Nu am găsit voluntari pentru selecția actuală.</Text>}
        {all.length > 0 && <TouchableOpacity accessibilityRole="button" style={styles.exitScrollButton} onPress={() => outerScrollRef.current?.scrollTo({ y: 0, animated: true })}><Text style={styles.exitScrollText}>Înapoi sus</Text><Ionicons name="arrow-up" size={18} color={RED} /></TouchableOpacity>}
        <TouchableOpacity onPress={() => router.push('/voluntariat')} style={styles.bottomButton}><Text style={styles.bottomText}>Vreau să devin voluntar</Text><Ionicons name="arrow-forward" color="#FFF" size={19}/></TouchableOpacity>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F7F7F7'},scroll:{paddingBottom:70},content:{width:'100%',maxWidth:1120,alignSelf:'center',paddingHorizontal:16},
  hero:{backgroundColor:RED,borderRadius:24,padding:30,alignItems:'center',gap:13,marginTop:10,marginBottom:25},heroTitle:{fontSize:34,color:'#FFF',fontWeight:'900',textAlign:'center'},heroSubtitle:{color:'#FFF',fontSize:16,textAlign:'center',lineHeight:24},heroStat:{color:'#F8D6D6',fontSize:13,textAlign:'center',marginTop:4},heroButton:{backgroundColor:'#FFF',borderRadius:12,paddingHorizontal:20,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:10,marginTop:10},heroButtonText:{color:RED,fontWeight:'800'},
  controls:{gap:12,marginBottom:26},search:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E7E7E7',borderRadius:14,paddingHorizontal:18,paddingVertical:14,fontSize:15,color:'#222'},tabs:{flexDirection:'row',gap:9,flexWrap:'wrap'},tab:{paddingHorizontal:18,paddingVertical:12,backgroundColor:'#FFF',borderRadius:12,borderWidth:1,borderColor:'#E6E6E6'},tabActive:{backgroundColor:RED,borderColor:RED},tabText:{fontWeight:'700',color:'#555'},tabTextActive:{color:'#FFF'},
  exitScrollButton:{alignSelf:"flex-end",flexDirection:"row",alignItems:"center",gap:7,paddingVertical:11,paddingHorizontal:5,marginTop:5,marginBottom:16},exitScrollText:{fontSize:13,fontWeight:"700",color:RED},
  volunteerSection:{marginBottom:22},listTitleRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},scrollHint:{fontSize:11,color:'#777',fontWeight:'600'},independentList:{borderRadius:18,backgroundColor:'#F1F0EE',borderWidth:1,borderColor:'#E8E4E1'},independentContent:{padding:9},
  heading:{fontSize:23,fontWeight:'900',color:'#202020',marginBottom:16,marginTop:10},sectionEyebrow:{color:RED,fontWeight:'900',fontSize:12,letterSpacing:1.2,marginBottom:6},leadershipSection:{marginBottom:20},leaderGrid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:12},grid:{flexDirection:'row',flexWrap:'wrap',columnGap:12,rowGap:12},person:{backgroundColor:'#FFF',borderRadius:16,padding:9,alignItems:'center',borderWidth:1,borderColor:'#EEEEEE',minWidth:0},leaderCard:{borderColor:'#E9D4D5',padding:10},photoBox:{width:'100%',aspectRatio:0.72,borderRadius:12,backgroundColor:'#F8EBEB',alignItems:'center',justifyContent:'center',overflow:'hidden',marginBottom:11},leaderPhoto:{aspectRatio:0.72},photo:{width:'100%',height:'100%'},personName:{fontSize:15,fontWeight:'900',color:'#252525',textAlign:'center',minHeight:36},leaderName:{fontSize:16},personRole:{fontSize:12,color:'#777',textAlign:'center',marginTop:4,lineHeight:16},leaderRole:{color:RED,fontWeight:'700'},empty:{color:'#777',padding:20},bottomButton:{backgroundColor:RED,padding:18,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12},bottomText:{color:'#FFF',fontSize:16,fontWeight:'800'}
});
