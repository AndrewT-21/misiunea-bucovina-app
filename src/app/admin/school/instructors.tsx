import SchoolAdminGate from '../../../components/SchoolAdminGate';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#191919';
const BG = '#F7F6F3';
type Instructor = { id: string; full_name: string; city: string; county: string | null; email: string; phone: string | null; domains: string[] | null; experience: string | null; created_at: string; status: string };
const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(x => x[0] ?? '').join('').toUpperCase();

function InstructorDirectory() {
  const [items, setItems] = useState<Instructor[]>([]);
  const [search, setSearch] = useState('');
  const [county, setCounty] = useState('toate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { width } = useWindowDimensions();
  const wide = width >= 750;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.from('school_instructor_applications')
      .select('id, full_name, city, county, email, phone, domains, experience, created_at, status')
      .eq('status', 'acceptata').order('full_name', { ascending: true });
    if (loadError) { setError(loadError.message); setItems([]); }
    else setItems((data ?? []) as Instructor[]);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const counties = useMemo(() => [...new Set(items.map(x => x.county?.trim()).filter((x): x is string => Boolean(x)))].sort((a,b) => a.localeCompare(b,'ro')), [items]);
  const filtered = useMemo(() => items.filter(item => {
    const q = search.trim().toLocaleLowerCase('ro');
    const match = !q || [item.full_name, item.city, item.county ?? '', item.email, ...(item.domains ?? [])].join(' ').toLocaleLowerCase('ro').includes(q);
    return match && (county === 'toate' || item.county === county);
  }), [items, search, county]);
  return <SafeAreaView style={s.root} edges={['top']}><View style={s.content}>
    <View style={s.header}>
      <TouchableOpacity style={s.back} accessibilityLabel="Înapoi" onPress={() => router.canGoBack() ? router.back() : router.replace('/admin/school' as any)}><Ionicons name="chevron-back" size={25} color={DARK}/></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={s.eyebrow}>ȘCOALA CREȘTINĂ</Text><Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>Instructori acceptați</Text></View>
    </View>
    <Text style={s.subtitle}>Catalogul instructorilor</Text>
    <View style={s.stats}>
      <View style={s.stat}><View style={s.statIcon}><Ionicons name="people-outline" size={23} color={RED}/></View><Text style={s.statNumber}>{items.length}</Text><Text style={s.statLabel}>Instructori acceptați</Text></View>
      <View style={s.stat}><View style={s.statIcon}><Ionicons name="location-outline" size={23} color={RED}/></View><Text style={s.statNumber}>{new Set(items.map(x => x.city.trim().toLocaleLowerCase('ro')).filter(Boolean)).size}</Text><Text style={s.statLabel}>Localități reprezentate</Text></View>
      <View style={s.stat}><View style={s.statIcon}><Ionicons name="map-outline" size={23} color={RED}/></View><Text style={s.statNumber}>{counties.length}</Text><Text style={s.statLabel}>Județe</Text></View>
    </View>
    <View style={s.searchBox}><Ionicons name="search-outline" size={21} color="#888"/><TextInput style={s.searchInput} placeholder="Caută după nume, localitate, domeniu..." placeholderTextColor="#999" value={search} onChangeText={setSearch} autoCapitalize="none"/><TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Șterge căutarea">{search ? <Ionicons name="close-circle" size={20} color="#888"/> : null}</TouchableOpacity></View>
    <ScrollView horizontal style={s.filtersScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {['toate', ...counties].map(value => <TouchableOpacity key={value} onPress={() => setCounty(value)} style={[s.chip, county === value && s.chipActive]}><Text style={[s.chipText, county === value && s.chipTextActive]}>{value === 'toate' ? 'Toate județele' : value}</Text></TouchableOpacity>)}
    </ScrollView>
    <View style={s.sectionRow}><Text style={s.sectionTitle}>Instructori</Text><Text style={s.resultCount}>{filtered.length} rezultate</Text></View>
    <ScrollView style={s.instructorScroll} contentContainerStyle={s.instructorScrollContent} showsVerticalScrollIndicator={true} nestedScrollEnabled>
    {loading ? <ActivityIndicator color={RED} style={{marginTop:36}} size="large"/> : error ? <View style={s.empty}><Ionicons name="alert-circle-outline" size={30} color={RED}/><Text style={s.emptyText}>Nu s-au putut încărca instructorii: {error}</Text><TouchableOpacity onPress={() => void load()}><Text style={s.retry}>Reîncearcă</Text></TouchableOpacity></View> : filtered.length === 0 ? <View style={s.empty}><Ionicons name="people-outline" size={34} color="#AAA"/><Text style={s.emptyText}>{items.length === 0 ? 'Nu există încă instructori cu cererea acceptată.' : 'Nu am găsit instructori pentru filtrele selectate.'}</Text></View> :
      <View style={s.grid}>{filtered.map(item => <TouchableOpacity key={item.id} activeOpacity={0.85} style={[s.card, wide && s.cardWide]} onPress={() => router.push({ pathname: '/admin/school-applications/[id]', params: { id: item.id } })}>
        <View style={s.cardTop}><View style={s.avatar}><Text style={s.initials}>{initials(item.full_name)}</Text></View><View style={{flex:1}}><Text style={s.personName} numberOfLines={2}>{item.full_name}</Text><Text style={s.location} numberOfLines={1}><Ionicons name="location-outline" size={13}/> {item.city}{item.county ? `, ${item.county}` : ''}</Text></View><View style={s.accepted}><Ionicons name="checkmark-circle" size={14} color="#1C7B4D"/><Text style={s.acceptedText}>Acceptat</Text></View></View>
        <View style={s.divider}/>
        <View style={s.info}><Ionicons name="mail-outline" size={16} color="#8A8A8A"/><Text style={s.infoText} numberOfLines={1}>{item.email}</Text></View>
        {item.phone ? <View style={s.info}><Ionicons name="call-outline" size={16} color="#8A8A8A"/><Text style={s.infoText}>{item.phone}</Text></View> : null}
        {item.domains?.length ? <View style={s.domains}>{item.domains.slice(0,3).map((d,i) => <View key={`${d}-${i}`} style={s.domain}><Text style={s.domainText}>{d}</Text></View>)}</View> : null}
        <View style={s.open}><Text style={s.openText}>Vezi profilul și detaliile</Text><Ionicons name="arrow-forward" size={17} color={RED}/></View>
      </TouchableOpacity>)}</View>}
    </ScrollView>
  </View></SafeAreaView>;
}
export default function ProtectedInstructorDirectory() { return <SchoolAdminGate permission="can_view"><InstructorDirectory/></SchoolAdminGate>; }
const s = StyleSheet.create({
 root:{flex:1,backgroundColor:BG}, content:{flex:1,width:'100%',maxWidth:1120,alignSelf:'center',paddingHorizontal:18,paddingTop:16,paddingBottom:12},instructorScroll:{flex:1,minHeight:0},instructorScrollContent:{paddingBottom:32},
 header:{flexDirection:'row',alignItems:'center',gap:15,marginBottom:12},back:{width:52,height:52,borderRadius:16,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.2,color:RED,marginBottom:4},title:{fontSize:26,fontWeight:'900',color:DARK,flexShrink:1},subtitle:{color:'#737373',fontSize:14,lineHeight:21,marginBottom:24},
 stats:{flexDirection:'row',gap:10,marginBottom:20},stat:{flex:1,minWidth:0,backgroundColor:'#FFF',borderRadius:17,padding:14,borderWidth:1,borderColor:'#EDEBE8'},statIcon:{marginBottom:8},statNumber:{fontSize:25,fontWeight:'900',color:DARK},statLabel:{fontSize:11,color:'#777',marginTop:3},
 searchBox:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E8E6E3',borderRadius:14,paddingHorizontal:14,flexDirection:'row',alignItems:'center',height:50,marginBottom:13},searchInput:{flex:1,color:DARK,fontSize:14,marginLeft:10,paddingVertical:0},filtersScroll:{flexGrow:0,flexShrink:0,height:42,marginBottom:12},chips:{gap:7,alignItems:'center',paddingRight:8},chip:{backgroundColor:'#FFF',borderColor:'#E7E4E0',borderWidth:1,borderRadius:18,paddingHorizontal:12,paddingVertical:6,alignSelf:'center'},chipActive:{backgroundColor:RED,borderColor:RED},chipText:{fontSize:11,fontWeight:'700',color:'#686868'},chipTextActive:{color:'#FFF'},sectionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:13},sectionTitle:{fontSize:19,fontWeight:'900',color:DARK},resultCount:{fontSize:12,color:'#777'},
 grid:{flexDirection:'row',flexWrap:'wrap',gap:14},card:{width:'100%',backgroundColor:'#FFF',borderRadius:18,borderWidth:1,borderColor:'#E9E7E4',padding:17},cardWide:{width:'48.9%'},cardTop:{flexDirection:'row',alignItems:'center',gap:10},avatar:{width:48,height:48,borderRadius:15,backgroundColor:'#FCE8E9',alignItems:'center',justifyContent:'center'},initials:{fontSize:17,fontWeight:'900',color:RED},personName:{fontSize:16,fontWeight:'900',color:DARK},location:{fontSize:12,color:'#777',marginTop:5},accepted:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'#E6F5EC',paddingHorizontal:7,paddingVertical:5,borderRadius:9},acceptedText:{color:'#1C7B4D',fontSize:10,fontWeight:'800'},divider:{height:1,backgroundColor:'#F0EFED',marginVertical:14},info:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},infoText:{fontSize:12,color:'#666',flex:1},domains:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:7},domain:{backgroundColor:'#F5F3F0',borderRadius:7,paddingHorizontal:9,paddingVertical:6},domainText:{fontSize:11,color:'#666',fontWeight:'600'},open:{marginTop:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},openText:{fontSize:12,fontWeight:'800',color:RED},empty:{alignItems:'center',gap:12,padding:30,backgroundColor:'#FFF',borderRadius:16},emptyText:{textAlign:'center',color:'#777',fontSize:14},retry:{color:RED,fontWeight:'800'}
});
