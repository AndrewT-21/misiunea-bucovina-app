import DateField, { dateToDisplay, displayToDate } from './DateField';
import { Alert } from '../lib/platform-alert';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator,  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

type Mode = 'proposal' | 'create' | 'edit' | 'draft';
export type PrayerEditable = { id: string; title: string; description: string; event_type: 'prayer'|'fasting_prayer'; category: Category; event_date: string; related_id: string | null; bible_verse: string | null }; 
type Category = 'mission' | 'case' | 'project' | 'activity';
type Related = { id: string; title: string };
const RED = '#A61E22';
const labels: Record<Category, string> = { mission: 'Misiune', case: 'Caz', project: 'Proiect', activity: 'Activitate' };
const dateToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export default function PrayerEditor({ mode, onSaved, initial }: { mode: Mode; onSaved?: () => void; initial?: PrayerEditable }) {
  const [title,setTitle] = useState(initial?.title ?? ''); const [description,setDescription] = useState(initial?.description ?? '');
  const [type,setType] = useState<'prayer'|'fasting_prayer'>(initial?.event_type ?? 'fasting_prayer');
  const [category,setCategory] = useState<Category>(initial?.category ?? 'mission');
  const [date,setDate] = useState(dateToDisplay(initial?.event_date ?? dateToday())); const [verse,setVerse] = useState(initial?.bible_verse ?? '');
  const [related,setRelated] = useState(initial?.related_id ?? ''); const [options,setOptions] = useState<Related[]>([]);
  const [loadingOptions,setLoadingOptions] = useState(false); const [saving,setSaving] = useState(false);
  const [errorText,setErrorText] = useState('');
  useEffect(() => { let active = true; setRelated(category === initial?.category ? (initial.related_id ?? '') : ''); setOptions([]);
    if (category === 'mission' || category === 'activity') return () => { active = false; };
    setLoadingOptions(true);
    void (async () => { const {data,error} = await supabase.from(category === 'case' ? 'cases' : 'projects').select('id,title').order('created_at',{ascending:false}).limit(100);
      if (!active) return; setLoadingOptions(false); if(error) setErrorText(error.message); else setOptions((data ?? []) as Related[]); })();
    return () => { active = false; };
  },[category]);
  function validDate(v:string) { return displayToDate(v)!==null; }
  async function submit(saveDraft=false) {
    if(saving) return;
    setErrorText('');
    if(title.trim().length<5 || description.trim().length<10) { setErrorText('Completează un titlu de minimum 5 caractere și o descriere de minimum 10.'); return; }
    if(!validDate(date) || (!saveDraft && mode !== 'edit' && (displayToDate(date) ?? '')<dateToday())) { setErrorText('Introdu o dată viitoare validă în format ZZ.LL.AAAA.'); return; }
    if((category==='case'||category==='project')&&!related) { setErrorText('Selectează un caz sau un proiect.'); return; }
    setSaving(true);
    try {
      const {data:{user},error:authError}=await supabase.auth.getUser(); if(authError) throw authError;
      if(!user) { setErrorText('Autentifică-te pentru a trimite o propunere.'); return; }
      const payload={title:title.trim(),description:description.trim(),event_type:type,category,event_date:displayToDate(date),related_id:related||null,bible_verse:verse.trim()||null};
      if(saveDraft){
        const result=mode==='draft'&&initial?.id
          ? await supabase.from('prayer_event_drafts').update(payload).eq('id',initial.id).select('id').single()
          : await supabase.from('prayer_event_drafts').insert({...payload,created_by:user.id}).select('id').single();
        if(result.error) throw result.error;
      }else{
        const {error}=await supabase.rpc(mode==='proposal'?'prayer_submit_proposal':mode==='edit'?'prayer_update_event':'prayer_create_event',{
          p_title:payload.title,p_description:payload.description,p_event_type:payload.event_type,p_category:payload.category,
          p_event_date:payload.event_date,p_related_id:payload.related_id,p_bible_verse:payload.bible_verse,
          ...(mode==='edit'?{p_event_id:initial?.id}:{})
        });
        if(error) throw error;
        if(mode==='draft'&&initial?.id){
          const {error:removeError}=await supabase.from('prayer_event_drafts').delete().eq('id',initial.id);
          if(removeError) throw new Error('Evenimentul a fost publicat, dar ciorna nu a putut fi eliminată. Nu publica din nou înainte de verificare: '+removeError.message);
        }
      }
      const message=saveDraft?'Ciorna a fost salvată.':mode==='proposal'?'Propunerea a fost trimisă spre aprobare.':mode==='edit'?'Evenimentul a fost actualizat.':'Evenimentul a fost publicat în calendar.';
      if(Platform.OS==='web') { if(typeof window!=='undefined') window.alert(message); } else Alert.alert('Succes',message);
      if(onSaved) onSaved(); else router.back();
    } catch(e:any) { setErrorText(e?.message||'Nu am putut salva.'); } finally { setSaving(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
    {mode==='proposal'&&<Text style={s.info}>Completează detaliile zilei de post sau rugăciune. Propunerea va fi verificată înainte de publicarea în calendar.</Text>}
    <View style={mode==='proposal'?undefined:s.formCard}>
    {mode!=='proposal'&&<View style={s.formHeading}><View style={s.formHeadingIcon}><Text style={{color:RED,fontSize:20}}>✎</Text></View><View><Text style={s.formHeadingHint}>DETALII EVENIMENT</Text><Text style={{fontSize:18,fontWeight:'900',color:'#171717'}}>{mode==='draft'?'Editează ciorna':mode==='edit'?'Modifică evenimentul':'Zi de post nouă'}</Text></View></View>}
    <Text style={s.label}>Tipul zilei</Text><View style={s.row}>{([['fasting_prayer','Post și rugăciune'],['prayer','Doar rugăciune']] as const).map(([value,label])=><TouchableOpacity key={value} onPress={()=>setType(value)} style={[s.chip,type===value&&s.active]}><Text style={[s.chipText,type===value&&s.activeText]}>{label}</Text></TouchableOpacity>)}</View>
    <Text style={s.label}>Pentru ce ne rugăm?</Text><View style={s.row}>{(Object.keys(labels) as Category[]).map(value=><TouchableOpacity key={value} onPress={()=>setCategory(value)} style={[s.chip,category===value&&s.active]}><Text style={[s.chipText,category===value&&s.activeText]}>{labels[value]}</Text></TouchableOpacity>)}</View>
    {(category==='case'||category==='project')&&<><Text style={s.label}>Selectează {category==='case'?'cazul':'proiectul'}</Text>{loadingOptions?<ActivityIndicator color={RED}/>:options.length===0?<Text style={s.hint}>Nu există elemente disponibile.</Text>:<View style={s.options}>{options.map(o=><TouchableOpacity key={o.id} onPress={()=>setRelated(o.id)} style={[s.option,related===o.id&&s.selected]}><Text style={s.optionText}>{related===o.id?'✓  ':''}{o.title}</Text></TouchableOpacity>)}</View>}</>}
    <Text style={s.label}>Titlu</Text><TextInput style={s.input} value={title} onChangeText={setTitle} maxLength={160} placeholder="Ex.: Rugăciune pentru familiile sprijinite"/>
    <Text style={s.label}>Data (ZZ.LL.AAAA)</Text><DateField value={date} onChange={setDate}/>
    <Text style={s.label}>Detalii și motive de rugăciune</Text><TextInput style={[s.input,s.multiline]} multiline textAlignVertical="top" value={description} onChangeText={setDescription} maxLength={5000} placeholder="Scrie motivele concrete de rugăciune..."/>
    <Text style={s.label}>Verset biblic (opțional)</Text><TextInput style={s.input} value={verse} onChangeText={setVerse} maxLength={500} placeholder="Ex.: 1 Tesaloniceni 5:17"/>
    {category==='activity'&&<Text style={s.hint}>Descrie activitatea în titlu și în motivele de rugăciune. Asocierea directă cu o activitate va fi adăugată ulterior.</Text>}
    {!!errorText&&<Text style={s.error}>{errorText}</Text>}
    {(mode==='create'||mode==='draft')&&<View style={s.draftRow}><Text style={{fontSize:13,color:'#625D5A',flex:1}}>Poți salva fără publicare și reveni ulterior.</Text><TouchableOpacity disabled={saving} style={s.draftButton} onPress={()=>void submit(true)}><Text style={{color:RED,fontWeight:'800'}}>Salvează ca ciornă</Text></TouchableOpacity></View>}
    <TouchableOpacity disabled={saving} style={[s.button,saving&&{opacity:0.6}]} onPress={()=>void submit(false)}><Text style={s.buttonText}>{saving?'Se salvează...':mode==='proposal'?'Trimite propunerea':mode==='edit'?'Salvează modificările':'Salvează și publică'}</Text></TouchableOpacity>
    </View>
  </ScrollView>;
}
const s=StyleSheet.create({body:{width:'100%',maxWidth:1040,alignSelf:'center',padding:20,paddingBottom:60},formCard:{backgroundColor:'#fff',borderRadius:19,padding:17,borderWidth:1,borderColor:'#F0E7E3'},formHeading:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:14},formHeadingIcon:{width:38,height:38,borderRadius:11,backgroundColor:'#FFF0F0',alignItems:'center',justifyContent:'center'},formHeadingHint:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:RED,marginBottom:4},draftRow:{marginTop:22,flexDirection:'row',alignItems:'center',gap:10},draftButton:{backgroundColor:'#FFF0F0',borderRadius:12,padding:13,borderWidth:1,borderColor:'#F0D5D3'},info:{color:'#625D5A',lineHeight:22,marginBottom:8},label:{fontSize:14,fontWeight:'800',color:'#242424',marginTop:16,marginBottom:8},row:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{backgroundColor:'#fff',borderColor:'#E8DDDA',borderWidth:1,borderRadius:14,paddingVertical:11,paddingHorizontal:12},active:{backgroundColor:'#A61E22',borderColor:'#A61E22'},chipText:{fontWeight:'700',color:'#444'},activeText:{color:'#fff'},input:{backgroundColor:'#fff',borderColor:'#E8DDDA',borderWidth:1,borderRadius:13,padding:14,fontSize:15,color:'#222'},multiline:{minHeight:145},options:{maxHeight:220,overflow:'scroll'},option:{padding:12,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#eee'},selected:{backgroundColor:'#FBE7E5'},optionText:{color:'#222'},hint:{color:'#777',marginTop:8,lineHeight:19},error:{color:RED,marginTop:16},button:{marginTop:25,backgroundColor:RED,borderRadius:15,padding:17,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'900',fontSize:15}});
