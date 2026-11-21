import { Alert } from '../../lib/platform-alert';
import MisiBiPageHeader from '../../components/MisiBiPageHeader';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { POLICY_TITLES } from '../../lib/legal-policy';
import { normalizeLegalBody } from '../../lib/normalize-legal-text';
import { router } from 'expo-router';
type Section={title:string;body:string};
const RED='#A61E22';
export default function EditPolicy(){
 const [sections,setSections]=useState<Section[]>(POLICY_TITLES.map(title=>({title,body:''})));const [date,setDate]=useState('6 iulie 2026');const [open,setOpen]=useState<number|null>(null);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let alive=true;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){if(alive)setLoading(false);return;}const {data:admin}=await supabase.rpc('misibi_is_super_admin');if(!alive)return;if(admin!==true){setLoading(false);return;}setAllowed(true);const {data,error}=await supabase.from('legal_documents').select('sections,updated_label').eq('slug','privacy-terms').maybeSingle();if(error)console.warn('Politica admin:',error.message);if(Array.isArray(data?.sections))setSections((data.sections as Section[]).map((item)=>({title:item?.title||'',body:normalizeLegalBody(item?.body||'')})));if(data?.updated_label)setDate(data.updated_label);setLoading(false)})();return()=>{alive=false}},[]);
 const change=(i:number,k:keyof Section,value:string)=>setSections(p=>p.map((s,j)=>j===i?{...s,[k]:value}:s));
 
const save = async () => {
  if (saving || !allowed) return;

  setSaving(true);

  try {
    const { error } = await supabase
      .from('legal_documents')
      .upsert(
        {
          slug: 'privacy-terms',
          updated_label: date,
          sections: sections.map(item => ({
            ...item,
            body: normalizeLegalBody(item.body),
          })),
        },
        { onConflict: 'slug' }
      );

    if (error) throw error;

    // Revine la pagina precedentă după salvarea reușită
    router.back();

  } catch (e: any) {
    Alert.alert(
      'Eroare',
      e?.message || 'Nu s-au putut salva modificările.'
    );
  } finally {
    setSaving(false);
  }
};

 return <SafeAreaView style={s.screen} edges={['top']}><MisiBiPageHeader title="Politică și termeni" eyebrow="ADMINISTRARE"/><ScrollView contentContainerStyle={s.scroll}>{loading?<ActivityIndicator color={RED}/>:!allowed?<Text>Nu ai permisiunea de administrare a acestei pagini.</Text>:<><Text style={s.info}>Editează documentul în aceeași ordine în care apare public. Textele sunt afișate cu paragrafe clare, fără indentările din importul WordPress. La salvare, spațierea este normalizată automat.</Text><Text style={s.label}>Ultima actualizare (afișată public)</Text><TextInput style={s.input} value={date} onChangeText={setDate}/>{sections.map((item,i)=><View key={i} style={s.card}><TouchableOpacity style={s.row} onPress={()=>setOpen(open===i?null:i)}><Text style={s.heading}>{i+1}. {item.title}</Text><Ionicons name={open===i?'chevron-up':'chevron-down'} size={20} color={RED}/></TouchableOpacity>{open===i&&<View style={s.fields}><Text style={s.label}>Titlu</Text><TextInput style={s.input} value={item.title} onChangeText={v=>change(i,'title',v)}/><Text style={s.label}>Conținut integral</Text><TextInput style={[s.input,s.bodyInput]} multiline textAlignVertical="top" value={item.body} onChangeText={v=>change(i,'body',v)} placeholder="Inserează textul integral al secțiunii..."/></View>}</View>)}<TouchableOpacity disabled={saving} onPress={save} style={s.save}><Text style={s.saveText}>{saving?'Se salvează...':'Salvează modificările'}</Text></TouchableOpacity></>}</ScrollView></SafeAreaView>
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#F6F6F6'},scroll:{padding:16,paddingBottom:100,maxWidth:900,width:'100%',alignSelf:'center'},info:{color:'#5F6570',lineHeight:23,marginBottom:18},label:{fontSize:14,fontWeight:'800',marginTop:12,marginBottom:8},input:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#E5E5E5',borderRadius:13,padding:15,fontSize:15,color:'#171717'},bodyInput:{minHeight:280,lineHeight:24,textAlign:'left'},card:{backgroundColor:'#FFF',borderRadius:15,marginTop:10,borderWidth:1,borderColor:'#E9E9E9'},row:{padding:16,flexDirection:'row',alignItems:'center',gap:12},heading:{flex:1,fontSize:15,fontWeight:'800',color:'#171717'},fields:{padding:16,borderTopWidth:1,borderTopColor:'#EEE'},save:{backgroundColor:RED,borderRadius:15,padding:19,alignItems:'center',marginTop:25},saveText:{color:'#FFF',fontWeight:'900',fontSize:16}});
