import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrayerEditor, { type PrayerEditable } from '../../components/PrayerEditor';
import { supabase } from '../../lib/supabase';
const RED='#A61E22';
export default function PrayerNewScreen(){
 const params=useLocalSearchParams<{draftId?:string;eventId?:string}>();
 const draftId=typeof params.draftId==='string'?params.draftId:undefined;
 const eventId=typeof params.eventId==='string'?params.eventId:undefined;
 const [initial,setInitial]=useState<PrayerEditable|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let active=true;(async()=>{try{
  const action=eventId?'edit':draftId?'create':'create';
  const {data,error:permissionError}=await supabase.rpc('misibi_prayer_allowed',{p_action:action});
  if(permissionError)throw permissionError;
  if(!data){if(draftId){const {data:editPermission}=await supabase.rpc('misibi_prayer_allowed',{p_action:'edit'});if(!editPermission)throw new Error('Nu ai permisiune pentru această operațiune.');}else throw new Error('Nu ai permisiune pentru această operațiune.');}
  if(!active)return;setAllowed(true);
  if(draftId||eventId){const {data:record,error:fetchError}=await supabase.from(draftId?'prayer_event_drafts':'prayer_events').select('id,title,description,event_type,category,event_date,related_id,bible_verse').eq('id',draftId||eventId).single();if(fetchError)throw fetchError;if(active)setInitial(record as PrayerEditable);}
 }catch(e:any){if(active)setError(e?.message||'Nu s-a putut încărca formularul.');}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[draftId,eventId]);
 return <SafeAreaView style={{flex:1,backgroundColor:'#F6F6F6'}} edges={['top']}>
  <View style={{width:'100%',maxWidth:1040,alignSelf:'center',paddingHorizontal:20,paddingTop:16,paddingBottom:10,flexDirection:'row',alignItems:'center',gap:14}}>
   <TouchableOpacity onPress={()=>router.back()} style={{width:44,height:44,borderRadius:19,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'}} accessibilityLabel="Înapoi"><Ionicons name="chevron-back" size={31} color="#171717"/></TouchableOpacity>
   <View style={{flex:1}}><Text style={{color:RED,fontSize:10,fontWeight:'900',letterSpacing:1.5}}>ADMINISTRARE</Text><Text style={{fontSize:27,fontWeight:'900',color:'#171717',marginTop:3}}>{draftId?'Editează ciorna':eventId?'Editează ziua de post':'Zi de post nouă'}</Text></View>
  </View>
  {loading?<ActivityIndicator color={RED} style={{marginTop:30}}/>:error?<Text style={{color:RED,padding:20}}>{error}</Text>:allowed?<PrayerEditor key={draftId||eventId||'new'} mode={draftId?'draft':eventId?'edit':'create'} initial={initial??undefined} onSaved={()=>router.back()}/>:null}
 </SafeAreaView>;
}
