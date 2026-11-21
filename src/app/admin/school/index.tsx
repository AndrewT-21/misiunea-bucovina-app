import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SchoolAdminGate from '../../../components/SchoolAdminGate';
import { useSchoolAdminPermissions } from '../../../hooks/useSchoolAdminPermissions';
import { supabase } from '../../../lib/supabase';

type Locality = { id: string; name: string; is_active: boolean };
type IconName = ComponentProps<typeof Ionicons>['name'];
const RED = '#A61E22';
const INK = '#1C2026';

function NavigationCard({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} activeOpacity={0.82} style={s.navCard} onPress={onPress}>
    <View style={s.navIcon}><Ionicons name={icon} size={23} color={RED} /></View>
    <View style={s.navBody}><Text style={s.navTitle}>{title}</Text><Text style={s.navSubtitle}>{subtitle}</Text></View>
    <View style={s.arrow}><Ionicons name="chevron-forward" size={18} color="#858A92" /></View>
  </TouchableOpacity>;
}

function SchoolIndex() {
  const { rights, loadingRights } = useSchoolAdminPermissions();
  const canManage = rights.can_create || rights.can_edit || rights.can_delete;
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace('/admin-login'); return; }
      const result = await supabase.rpc('school_list_accessible_localities');
      if (result.error) throw result.error;
      setLocalities((result.data ?? []) as Locality[]);
    } catch (e: any) {
      setError(e?.message ?? 'Nu s-au putut încărca localitățile.');
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const activeLocalities = localities.filter(l => l.is_active).sort((a,b) => a.name.localeCompare(b.name, 'ro'));
  return <SafeAreaView style={s.root} edges={['top']}>
    <View style={s.header}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Înapoi" onPress={() => router.back()} style={s.back}>
        <Ionicons name="chevron-back" size={23} color={INK} />
      </TouchableOpacity>
      <View style={s.headerCopy}><Text style={s.eyebrow}>MISIUNEA BUCOVINA  /  ADMINISTRARE</Text><Text style={s.title}>Școala Creștină</Text></View>
    </View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.hero}>
        <View style={s.heroTop}><View style={s.heroSymbol}><Ionicons name="book-outline" size={24} color="#FFF" /></View><Text style={s.heroKicker}>ADMINISTRARE ȘCOALĂ</Text></View>
        <Text style={s.heroTitle}>Organizează școala, într-un singur loc.</Text>
        <Text style={s.heroDescription}>Localități, echipă, instructori și rapoarte — acces rapid la tot ce ai nevoie.</Text>
      </View>

      {loading || loadingRights ? <ActivityIndicator color={RED} style={s.loader} /> : <>
        {!!error && <View style={s.errorBox}><Ionicons name="alert-circle-outline" size={19} color={RED}/><Text style={s.errorText}>{error}</Text><TouchableOpacity onPress={() => void refresh()}><Text style={s.retry}>Reîncearcă</Text></TouchableOpacity></View>}

        {canManage && <View style={s.section}>
          <View style={s.sectionHead}><Text style={s.sectionTitle}>GESTIONARE</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Gestionează localitățile" activeOpacity={0.86} style={s.primaryAction} onPress={() => router.push('/admin/school/localities' as any)}>
            <View style={s.primaryIcon}><Ionicons name="location-outline" size={23} color="#FFF" /></View>
            <View style={{flex:1}}><Text style={s.primaryTitle}>Gestionează localitățile</Text><Text style={s.primarySubtitle}>Adaugă și organizează localitățile școlii</Text></View>
            <Ionicons name="arrow-forward" size={21} color="#FFF" />
          </TouchableOpacity>
        </View>}

        <View style={s.section}>
          <View style={s.sectionHead}><Text style={s.sectionTitle}>LOCALITĂȚI ACTIVE</Text><Text style={s.sectionCount}>{activeLocalities.length}</Text></View>
          {activeLocalities.length ? <View style={s.localitiesPanel}>{activeLocalities.map((loc, index) => <TouchableOpacity key={loc.id} activeOpacity={0.82} accessibilityRole="button" accessibilityLabel={`Deschide ${loc.name}`} style={[s.localityRow, index < activeLocalities.length - 1 && s.localityDivider]} onPress={() => router.push(`/admin/school/${loc.id}` as any)}>
            <View style={s.localityIcon}><Ionicons name="location-outline" size={19} color={RED}/></View>
            <Text style={s.localityName} numberOfLines={1}>{loc.name}</Text>
            <Ionicons name="chevron-forward" size={18} color="#969AA1"/>
          </TouchableOpacity>)}</View> : !error ? <View style={s.emptyBox}><Ionicons name="location-outline" size={24} color="#9BA0A8"/><Text style={s.emptyText}>Nu există localități active disponibile.</Text></View> : null}
        </View>

        {canManage && <View style={s.section}>
          <View style={s.sectionHead}><Text style={s.sectionTitle}>ADMINISTRARE ȘCOALĂ</Text></View>
          <NavigationCard icon="people-outline" title="Echipă și acces" subtitle="Membri, roluri și repartizări" onPress={() => router.push('/admin/school/team' as any)} />
          <NavigationCard icon="people-circle-outline" title="Instructori acceptați" subtitle="Catalogul instructorilor înscriși" onPress={() => router.push('/admin/school/instructors' as any)} />
          <NavigationCard icon="bar-chart-outline" title="Rapoarte anuale" subtitle="Situația pe ani școlari și localități" onPress={() => router.push('/admin/school/raport' as any)} />
        </View>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  root: {flex:1, backgroundColor:'#F7F7F8'},
  header: {...(Platform.OS==='web'?{width:'100%' as const,maxWidth:960,alignSelf:'center' as const}:{}), flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingTop:12,paddingBottom:19},
  back: {width:48,height:48,backgroundColor:'#FFF',borderRadius:16,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#EEEEF0'},
  headerCopy: {flex:1,marginLeft:15},
  eyebrow: {fontSize:10,fontWeight:'800',color:RED,letterSpacing:1.15},
  title: {fontSize:28,fontWeight:'900',color:INK,marginTop:3,letterSpacing:-0.6},
  content: {...(Platform.OS==='web'?{width:'100%' as const,maxWidth:960,alignSelf:'center' as const}:{}),paddingHorizontal:20,paddingBottom:54},
  hero: {backgroundColor:'#252A31',borderRadius:24,padding:23,marginTop:4,marginBottom:28,overflow:'hidden'},
  heroTop: {flexDirection:'row',alignItems:'center',gap:11,marginBottom:20},
  heroSymbol: {width:44,height:44,borderRadius:14,backgroundColor:RED,alignItems:'center',justifyContent:'center'},
  heroKicker: {fontSize:10,color:'#F3D8D8',fontWeight:'900',letterSpacing:1.4},
  heroTitle: {color:'#FFF',fontSize:23,fontWeight:'900',lineHeight:30,letterSpacing:-0.4,maxWidth:330},
  heroDescription: {color:'#C8CCD1',fontSize:13,lineHeight:21,marginTop:10,maxWidth:390},
  loader: {marginVertical:24},
  section: {marginBottom:25},
  sectionHead: {flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},
  sectionTitle: {fontSize:11,fontWeight:'900',letterSpacing:1.45,color:'#777E87'},
  sectionCount: {fontSize:12,fontWeight:'900',color:RED,backgroundColor:'#F9E8E9',paddingHorizontal:10,paddingVertical:4,borderRadius:10,overflow:'hidden'},
  primaryAction: {backgroundColor:RED,borderRadius:19,padding:17,flexDirection:'row',alignItems:'center',gap:13},
  primaryIcon: {width:42,height:42,borderRadius:13,backgroundColor:'rgba(255,255,255,0.15)',alignItems:'center',justifyContent:'center'},
  primaryTitle: {fontSize:16,fontWeight:'900',color:'#FFF'},
  primarySubtitle: {fontSize:11,color:'#F5D5D5',marginTop:4,lineHeight:16},
  localitiesPanel: {backgroundColor:'#FFF',borderRadius:19,borderWidth:1,borderColor:'#EBEBEE',paddingHorizontal:14},
  localityRow: {flexDirection:'row',alignItems:'center',paddingVertical:13,gap:12,minHeight:65},
  localityDivider: {borderBottomWidth:1,borderBottomColor:'#F0F0F2'},
  localityIcon: {width:38,height:38,borderRadius:12,backgroundColor:'#FDF0F0',alignItems:'center',justifyContent:'center'},
  localityName: {flex:1,fontSize:15,fontWeight:'800',color:INK},
  navCard: {backgroundColor:'#FFF',borderRadius:17,padding:14,marginBottom:10,flexDirection:'row',alignItems:'center',gap:13,borderWidth:1,borderColor:'#EBEBEE',minHeight:82},
  navIcon: {width:48,height:48,borderRadius:15,backgroundColor:'#FDF0F0',alignItems:'center',justifyContent:'center'},
  navBody: {flex:1},navTitle: {fontSize:15,fontWeight:'900',color:INK},navSubtitle: {fontSize:11,color:'#838891',marginTop:5,lineHeight:16},
  arrow: {width:26,height:26,alignItems:'center',justifyContent:'center'},
  errorBox: {backgroundColor:'#FFF0F0',borderRadius:14,padding:13,flexDirection:'row',alignItems:'center',gap:8,marginBottom:15},
  errorText: {flex:1,color:RED,fontSize:12},retry: {color:RED,fontWeight:'900',fontSize:12},
  emptyBox: {padding:25,backgroundColor:'#FFF',borderRadius:18,alignItems:'center',gap:10},
  emptyText: {color:'#848991',fontSize:12,textAlign:'center'},
});

export default function ProtectedSchoolIndex() {
  return <SchoolAdminGate permission="can_view"><SchoolIndex /></SchoolAdminGate>;
}
