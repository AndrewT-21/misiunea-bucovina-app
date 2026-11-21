import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SchoolAdminGate from '../../../components/SchoolAdminGate';
import { useSchoolAdminPermissions } from '../../../hooks/useSchoolAdminPermissions';
import { supabase } from '../../../lib/supabase';
const RED='#A61E22';
function LocalityDashboard(){
  const { localityId }=useLocalSearchParams<{localityId:string}>();
  const { rights } = useSchoolAdminPermissions();
  const canManage = rights.can_create || rights.can_edit || rights.can_delete;
  const [name,setName]=useState('');const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useFocusEffect(useCallback(()=>{let active=true;(async()=>{setLoading(true);try{
    const {data,error:rpcError}=await supabase.rpc('school_list_accessible_localities');
    if(rpcError)throw rpcError;
    const found=(data??[]).find((x:{id:string})=>x.id===localityId);
    if(!found || !found.is_active)throw new Error('Nu ai acces la această localitate.');
    if(active)setName(found.name);
  }catch(e:any){if(active)setError(e?.message??'Acces interzis');}finally{if(active)setLoading(false);}})();return()=>{active=false};},[localityId]));
  return <SafeAreaView style={s.root} edges={['top']}><View style={s.header}>
    <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="chevron-back" size={24} color="#171717"/></TouchableOpacity>
    <View><Text style={s.eyebrow}>ȘCOALA CREȘTINĂ · LOCALITATE</Text><Text style={s.title}>{name||'Localitate'}</Text></View>
  </View>{loading?<ActivityIndicator color={RED} style={{marginTop:35}}/>:error?<Text style={s.error}>{error}</Text>:<ScrollView contentContainerStyle={s.content}>
    <View style={{backgroundColor:'#FFF0F0',padding:16,borderRadius:16,marginBottom:14,flexDirection:'row',gap:10,alignItems:'center'}}><Ionicons name="location-outline" size={21} color={RED}/><Text style={[s.help,{flex:1}]}>Datele și evidențele sunt organizate separat pentru această localitate.</Text></View>
    <TouchableOpacity style={s.card} onPress={()=>router.push({pathname:'/admin/school/[localityId]/children',params:{localityId}} as any)}><Ionicons name="people-outline" size={25} color={RED}/><View style={{flex:1}}><Text style={s.item}>Copii</Text><Text style={s.help}>Înregistrare și evidență</Text></View><Ionicons name="chevron-forward" size={20} color="#AAA"/></TouchableOpacity>
    <TouchableOpacity style={s.card} onPress={()=>router.push({pathname:'/admin/school/[localityId]/meetings',params:{localityId}} as any)}><Ionicons name="calendar-outline" size={25} color={RED}/><View style={{flex:1}}><Text style={s.item}>Întâlniri și prezențe</Text><Text style={s.help}>Programări, activități, participare și situația întâlnirilor</Text></View><Ionicons name="chevron-forward" size={20} color="#AAA"/></TouchableOpacity>
    <TouchableOpacity style={s.card} onPress={()=>router.push({ pathname: '/admin/school/team', params: { localityId } } as any)}><Ionicons name="people-circle-outline" size={25} color={RED}/><View style={{flex:1}}><Text style={s.item}>Instructori și echipă</Text><Text style={s.help}>Consultă echipa și repartizările</Text></View><Ionicons name="chevron-forward" size={20} color="#AAA"/></TouchableOpacity>
  </ScrollView>}</SafeAreaView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#F6F6F6'},header:{
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),padding:15,flexDirection:'row',alignItems:'center',gap:12},back:{width:44,height:44,borderRadius:14,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:9,fontWeight:'900',color:RED},title:{fontSize:25,fontWeight:'900',color:'#171717'},content:{ ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),padding:15},help:{fontSize:12,color:'#888',lineHeight:19},card:{marginTop:18,padding:18,backgroundColor:'#FFF',borderRadius:17,flexDirection:'row',alignItems:'center',gap:14},item:{fontSize:16,fontWeight:'900',color:'#171717'},future:{marginTop:30,color:'#888',fontSize:12,lineHeight:20},error:{margin:20,color:RED}});

export default function ProtectedLocalityDashboard() {
  return <SchoolAdminGate permission="can_view"><LocalityDashboard /></SchoolAdminGate>;
}
