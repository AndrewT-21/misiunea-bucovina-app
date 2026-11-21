import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Edition = { id: string; year: number; title: string; description: string | null; event_date: string | null; location: string | null };
type Photo = { id: string; edition_id: string; storage_path: string };
const RED = '#A61E22';
export default function VolunteerDayPublic() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let mounted = true; (async () => {
    const [e, p] = await Promise.all([
      supabase.from('volunteer_day_editions').select('id,year,title,description,event_date,location').order('year', { ascending: false }),
      supabase.from('volunteer_day_photos').select('id,edition_id,storage_path')
    ]);
    if (!mounted) return;
    if (e.error || p.error) setError('Edițiile nu pot fi încărcate momentan. Verifică permisiunile publice de citire în Supabase.');
    setEditions((e.data ?? []) as Edition[]); setPhotos((p.data ?? []) as Photo[]); setLoading(false);
  })(); return () => { mounted = false; }; }, []);
  return <SafeAreaView style={s.root} edges={['top']}>
    <MisiBiPageHeader title="Ziua Voluntarului" eyebrow="MISIUNEA BUCOVINA" />
    <ScrollView contentContainerStyle={[s.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}>
    <View style={s.hero}><Ionicons name="heart-circle-outline" size={43} color="#FFF"/><Text style={s.eyebrow}>COMUNITATEA MISIUNEA BUCOVINA</Text><Text style={s.title}>Ziua Voluntarului</Text><Text style={s.subtitle}>Celebrăm oamenii care oferă din timpul, energia și dragostea lor pentru ceilalți.</Text></View>
    <Text style={s.section}>Edițiile evenimentului</Text>
    {loading ? <ActivityIndicator color={RED}/> : error ? <Text style={s.note}>{error}</Text> : editions.length === 0 ? <Text style={s.note}>Nu sunt încă ediții publicate.</Text> : editions.map(edition => <View key={edition.id} style={s.card}>
      <Text style={s.year}>{edition.year}</Text><Text style={s.cardTitle}>{edition.title}</Text>
      {!!edition.description && <Text style={s.description}>{edition.description}</Text>}
      {!!edition.event_date && <Text style={s.meta}><Ionicons name="calendar-outline" size={15}/>  {edition.event_date}</Text>}
      {!!edition.location && <Text style={s.meta}><Ionicons name="location-outline" size={15}/>  {edition.location}</Text>}
      <View style={s.gallery}>{photos.filter(photo => photo.edition_id === edition.id).map(photo => <Image key={photo.id} source={{uri:supabase.storage.from('volunteer-day').getPublicUrl(photo.storage_path).data.publicUrl}} style={s.image}/>)}</View>
    </View>)}
    <TouchableOpacity style={s.cta} onPress={() => router.push('/voluntariat')}><Text style={s.ctaText}>Vreau să devin voluntar</Text><Ionicons name="arrow-forward" size={19} color="#FFF"/></TouchableOpacity>
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({root:{flex:1,backgroundColor:'#F7F6F3'},content:{ width:'100%',maxWidth:1120,alignSelf:'center',padding:18,paddingBottom:60},back:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:14},hero:{backgroundColor:RED,borderRadius:25,padding:30,marginBottom:25,minHeight:235,justifyContent:'center'},eyebrow:{color:'#FFE0E0',fontSize:11,fontWeight:'800',letterSpacing:1.4,marginTop:13},title:{color:'#FFF',fontSize:34,fontWeight:'900',marginTop:7},subtitle:{color:'#FFF',fontSize:15,lineHeight:23,maxWidth:650,marginTop:12},section:{fontSize:23,fontWeight:'900',color:'#171717',marginBottom:15},note:{color:'#666',padding:20},card:{backgroundColor:'#FFF',borderRadius:19,padding:20,marginBottom:16},year:{color:RED,fontSize:12,fontWeight:'900'},cardTitle:{fontSize:22,fontWeight:'900',color:'#171717',marginTop:4},description:{fontSize:15,color:'#444',lineHeight:23,marginTop:10},meta:{fontSize:13,color:'#666',marginTop:10},gallery:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:14},image:{width:145,height:112,borderRadius:12},cta:{backgroundColor:RED,borderRadius:14,padding:18,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:12},ctaText:{color:'#FFF',fontWeight:'900',fontSize:16}});
