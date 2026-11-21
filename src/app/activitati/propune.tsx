import DateField, { displayToDate } from '../../components/DateField';
import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
const RED='#A61E22';
function parseDate(date:string,time:string) {
  if(!/^\d{2}\.\d{2}\.\d{4}$/.test(date)||!/^\d{2}:\d{2}$/.test(time))return null;
  const iso=displayToDate(date);if(!iso)return null;const [y,m,d]=iso.split('-').map(Number);const [h,min]=time.split(':').map(Number);
  const value=new Date(y,m-1,d,h,min);
  return value.getFullYear()===y&&value.getMonth()===m-1&&value.getDate()===d&&value.getHours()===h&&value.getMinutes()===min?value:null;
}
export default function ProposeActivity(){
  const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [location,setLocation]=useState('');
  const [date,setDate]=useState('');const [time,setTime]=useState('');const [sending,setSending]=useState(false);const [error,setError]=useState('');
  async function submit(){
    if(sending)return;setError('');const start=parseDate(date.trim(),time.trim());
    if(title.trim().length<5||description.trim().length<10||!location.trim()){setError('Completează titlul (minim 5 caractere), descrierea (minim 10) și locația.');return;}
    if(!start||start.getTime()<=Date.now()){setError('Introdu o dată și o oră viitoare valide (ZZ.LL.AAAA și HH:MM).');return;}
    setSending(true);
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser();if(authError)throw authError;
      if(!user){router.push('/voluntar/login' as any);return;}
      const {error:submitError}=await supabase.rpc('activity_submit_proposal',{p_title:title.trim(),p_description:description.trim(),p_location:location.trim(),p_starts_at:start.toISOString()});
      if(submitError)throw submitError;
      if(Platform.OS==='web')window.alert('Propunerea a fost trimisă spre aprobarea administratorului.');
      else Alert.alert('Propunere trimisă','Activitatea va apărea în calendar după aprobare.');
      router.back();
    }catch(e:any){setError(e?.message||'Propunerea nu a putut fi trimisă.');}finally{setSending(false);}
  }
  return <SafeAreaView style={s.screen} edges={['top']}><View style={s.header}><TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={25} color={RED}/></TouchableOpacity><Text style={s.heading}>Propune o activitate</Text></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.info}>Completează detaliile activității. Propunerea va fi verificată înainte de publicarea în calendar.</Text>
      <Text style={s.label}>Titlul activității</Text><TextInput style={s.input} value={title} onChangeText={setTitle} maxLength={160} placeholder="Ex.: Vizită la familii"/>
      <Text style={s.label}>Descriere</Text><TextInput style={[s.input,s.multi]} multiline textAlignVertical="top" value={description} onChangeText={setDescription} maxLength={5000} placeholder="Ce presupune activitatea?"/>
      <Text style={s.label}>Locația</Text><TextInput style={s.input} value={location} onChangeText={setLocation} maxLength={250} placeholder="Localitate / adresă"/>
      <Text style={s.label}>Data (ZZ.LL.AAAA)</Text><DateField value={date} onChange={setDate}/>
      <Text style={s.label}>Ora (HH:MM)</Text><TextInput style={s.input} value={time} onChangeText={setTime} placeholder="14:30"/>
      {!!error&&<Text style={s.error}>{error}</Text>}
      <TouchableOpacity onPress={()=>void submit()} disabled={sending} style={[s.submit,sending&&{opacity:.6}]}>{sending?<ActivityIndicator color="#fff"/>:<Text style={s.submitText}>Trimite propunerea</Text>}</TouchableOpacity>
    </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#FAF6F2'},header:{flexDirection:'row',alignItems:'center',padding:16,gap:12},back:{width:46,height:46,borderRadius:14,backgroundColor:'#FCE8E5',alignItems:'center',justifyContent:'center'},heading:{fontSize:21,fontWeight:'900',color:'#1D1D1F'},content:{padding:18,paddingBottom:65},info:{color:'#625D5A',lineHeight:22,marginBottom:8},label:{fontSize:14,fontWeight:'800',color:'#242424',marginTop:17,marginBottom:8},input:{backgroundColor:'#fff',borderColor:'#E8DDDA',borderWidth:1,borderRadius:13,padding:14,fontSize:15,color:'#222'},multi:{minHeight:125},error:{color:RED,marginTop:15},submit:{marginTop:25,backgroundColor:RED,borderRadius:15,padding:17,alignItems:'center'},submitText:{color:'#fff',fontWeight:'900',fontSize:15}});
