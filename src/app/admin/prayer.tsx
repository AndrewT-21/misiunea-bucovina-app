import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator,  Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type PrayerEditable } from '../../components/PrayerEditor';
import { supabase } from '../../lib/supabase';
const RED='#A61E22';
const DARK='#1F2937';
type Proposal={id:string;title:string;description:string;event_date:string;event_type:string;category:string;created_at:string};
export default function PrayerAdminScreen(){
 const [allowed,setAllowed]=useState(false);const [canCreate,setCanCreate]=useState(false);const [canEdit,setCanEdit]=useState(false);
 const [search,setSearch]=useState('');const [searchFocused,setSearchFocused]=useState(false);const [loading,setLoading]=useState(true);const [items,setItems]=useState<Proposal[]>([]);const [published,setPublished]=useState<PrayerEditable[]>([]);const [selected,setSelected]=useState<PrayerEditable|null>(null);const [drafts,setDrafts]=useState<PrayerEditable[]>([]);const [error,setError]=useState('');const [tab,setTab]=useState<'pending'|'published'|'draft'>('pending');const [reasons,setReasons]=useState<Record<string,string>>({});const [busy,setBusy]=useState('');
 const refresh=useCallback(async()=>{setLoading(true);setError('');try{
 const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/admin-login');return;}
 const [view,create,edit]=await Promise.all(['view','create','edit'].map(p=>supabase.rpc('misibi_prayer_allowed',{p_action:p})));
 if(view.error||create.error||edit.error)throw view.error||create.error||edit.error;
 const v=!!view.data,c=!!create.data,e=!!edit.data;setAllowed(v||c||e);setCanCreate(c);setCanEdit(e);
 if(v){const {data,error:err}=await supabase.rpc('prayer_list_pending_proposals');if(err)throw err;setItems((data??[]) as Proposal[]);}else setItems([]);
 if(e||c){const {data,error:err}=await supabase.from('prayer_events').select('id,title,description,event_type,category,event_date,related_id,bible_verse').eq('status','approved').order('event_date',{ascending:false}).limit(200);if(err)throw err;setPublished((data??[]) as PrayerEditable[]);}else setPublished([]);
 if(v||c||e){const {data,error:err}=await supabase.from('prayer_event_drafts').select('id,title,description,event_type,category,event_date,related_id,bible_verse').order('created_at',{ascending:false}).limit(200);if(err)throw err;setDrafts((data??[]) as PrayerEditable[]);}else setDrafts([]);
 }catch(e:any){setError(e?.message||'Nu s-au putut încărca propunerile.');}finally{setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
 async function review(id:string,approve:boolean){if(busy)return;if(!approve&&(reasons[id]||'').trim().length<5){setError('Introdu un motiv al respingerii de minimum 5 caractere.');return;}
 setBusy(id);setError('');try{const {error:err}=await supabase.rpc('prayer_review_proposal',{p_event_id:id,p_approve:approve,p_rejection_reason:approve?null:reasons[id].trim()});if(err)throw err;
 if(Platform.OS==='web'){if(typeof window!=='undefined')window.alert(approve?'Propunere aprobată.':'Propunere respinsă.');}else Alert.alert('Succes',approve?'Propunere aprobată.':'Propunere respinsă.');await refresh();
 }catch(e:any){setError(e?.message||'Operațiunea a eșuat.');}finally{setBusy('');}}
 async function cancelEvent(item:PrayerEditable){
  if(busy)return;
  const perform=async()=>{setBusy(item.id);setError('');try{const {error:err}=await supabase.rpc('prayer_cancel_event',{p_event_id:item.id});if(err)throw err;setSelected(null);setTab('published');await refresh();}catch(e:any){setError(e?.message||'Nu s-a putut anula evenimentul.');}finally{setBusy('');}};
  Alert.alert('Anulează evenimentul','Evenimentul nu va mai apărea în calendar. Utilizatorii vor fi notificați.',[{text:'Renunță',style:'cancel'},{text:'Anulează',style:'destructive',onPress:()=>{void perform();}}]);
 }
 const btn=(label:string,action:()=>void,secondary=false)=><TouchableOpacity onPress={action} style={{backgroundColor:secondary?'#FCE8E5':RED,padding:13,borderRadius:12,marginTop:10}}><Text style={{color:secondary?RED:'#fff',fontWeight:'800',textAlign:'center'}}>{label}</Text></TouchableOpacity>;
 return <SafeAreaView style={{flex:1,backgroundColor:'#F6F6F6'}} edges={['top']}>
 <View style={{width:'100%',maxWidth:1040,alignSelf:'center',paddingHorizontal:20,paddingTop:16,paddingBottom:10,flexDirection:'row',alignItems:'center',gap:14}}>
  <TouchableOpacity onPress={()=>router.back()} style={{width:44,height:44,borderRadius:19,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'}} accessibilityRole="button" accessibilityLabel="Înapoi">
   <Ionicons name="chevron-back" size={31} color={DARK}/>
  </TouchableOpacity>
  <View style={{flex:1}}>
   <Text style={{color:RED,fontSize:10,fontWeight:'900',letterSpacing:1.5}}>ADMINISTRARE</Text>
   <Text style={{color:DARK,fontSize:27,fontWeight:'900',marginTop:3}} numberOfLines={2}>Post și Rugăciune</Text>
  </View>
 </View>
 {loading?<ActivityIndicator color={RED}/>:error&&!allowed?<Text style={{padding:20,color:RED}}>{error}</Text>:!allowed?<Text style={{padding:20}}>Nu ai permisiuni pentru administrarea acestui departament.</Text>:<>
 {<View style={{width:'100%',maxWidth:1040,alignSelf:'center',paddingHorizontal:16,marginBottom:12,gap:10,...(Platform.OS==='web'?{paddingHorizontal:32}:{})}}>
   {canCreate&&<TouchableOpacity onPress={()=>router.push('/admin/prayer-new' as any)} style={{backgroundColor:RED,borderRadius:14,paddingHorizontal:18,minHeight:46,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,alignSelf:'flex-start'}}><Ionicons name="add" size={28} color="#FFF"/><Text style={{fontSize:14,fontWeight:'800',color:'#FFF'}}>Adaugă zi de post</Text></TouchableOpacity>}
   <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:14,paddingHorizontal:13,minHeight:46,gap:9,...(Platform.OS==='web'?{width:searchFocused?'100%' as const:230,maxWidth:'100%' as const}:{})}}><Ionicons name="search-outline" size={19} color="#888"/><TextInput style={{flex:1,fontSize:14,color:'#171717'}} placeholder="Caută după nume..." placeholderTextColor="#999" value={search} onChangeText={setSearch} onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)}/></View>
  </View>}
 {<View style={{width:'100%',maxWidth:1040,alignSelf:'center',paddingHorizontal:16,flexDirection:'row',gap:9,marginBottom:10}}>{([{key:'pending',label:'Propuneri',count:items.length},{key:'published',label:'Publicate',count:published.length},{key:'draft',label:'Ciorne',count:drafts.length}] as const).map(t=><TouchableOpacity key={t.key} accessibilityRole="tab" accessibilityState={{selected:tab===t.key}} onPress={()=>setTab(t.key)} style={{flex:1,backgroundColor:'#FFF',borderRadius:16,borderWidth:1,borderColor:tab===t.key?RED:'#ECECEC',padding:13}}><Text style={{fontSize:24,fontWeight:'900',color:'#171717'}}>{t.count}</Text><Text style={{fontSize:12,color:tab===t.key?RED:'#777',fontWeight:'800'}}>{t.label}</Text></TouchableOpacity>)}</View>}
 {tab==='draft'?<ScrollView contentContainerStyle={{width:'100%',maxWidth:1040,alignSelf:'center',padding:16,paddingBottom:60}}>{drafts.filter(item=>item.title.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))).map(item=><View key={item.id} style={{backgroundColor:'#fff',borderRadius:18,padding:20,marginBottom:14,borderWidth:1,borderColor:'#EEEEEE'}}><Text style={{fontSize:18,fontWeight:'900'}}>{item.title}</Text><Text style={{color:'#777',marginTop:8}}>{item.event_date} · Ciornă</Text><Text style={{color:'#333',marginTop:8}} numberOfLines={3}>{item.description}</Text>{(canEdit||canCreate)&&btn('Deschide și editează',()=>router.push({pathname:'/admin/prayer-new',params:{draftId:item.id}} as any))}</View>)}{drafts.length===0&&<Text style={{color:'#777',padding:20}}>Nu există ciorne.</Text>}</ScrollView>:tab==='published'?<ScrollView contentContainerStyle={{width:'100%',maxWidth:1040,alignSelf:'center',padding:16,paddingBottom:60}}>{!!error&&<Text style={{color:RED,marginBottom:12}}>{error}</Text>}{published.filter(item=>item.title.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))).length===0?<View style={{backgroundColor:'#FFFFFF',borderRadius:18,padding:24,alignItems:'center',marginTop:12}}><Ionicons name="calendar-outline" size={34} color={RED}/><Text style={{color:'#777',marginTop:10,fontSize:14}}>Nu există evenimente publicate.</Text></View>:published.filter(item=>item.title.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))).map(item=><View key={item.id} style={{backgroundColor:'#fff',borderRadius:18,padding:20,marginBottom:14,borderWidth:1,borderColor:'#EEEEEE'}}><Text style={{fontSize:18,fontWeight:'900'}}>{item.title}</Text><Text style={{color:'#777',marginTop:8}}>{item.event_date} · {item.event_type==='fasting_prayer'?'Post și rugăciune':'Rugăciune'}</Text><Text style={{marginTop:8,color:'#333'}} numberOfLines={3}>{item.description}</Text>{canEdit&&<>{btn('Editează detaliile',()=>router.push({pathname:'/admin/prayer-new',params:{eventId:item.id}} as any))}{btn(busy===item.id?'Se anulează...':'Anulează evenimentul',()=>void cancelEvent(item),true)}</>}</View>)}</ScrollView>:<ScrollView contentContainerStyle={{width:'100%',maxWidth:1040,alignSelf:'center',padding:16,paddingBottom:60}}>
 {!!error&&<Text style={{color:RED,marginBottom:12}}>{error}</Text>}
 {items.filter(item=>item.title.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))).length===0?<View style={{backgroundColor:'#FFFFFF',borderRadius:18,padding:24,alignItems:'center',marginTop:12}}><Ionicons name="checkmark-circle-outline" size={34} color={RED}/><Text style={{color:'#777',marginTop:10,fontSize:14}}>Nu există propuneri în așteptare.</Text></View>:items.filter(item=>item.title.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))).map(item=><View key={item.id} style={{backgroundColor:'#fff',borderRadius:18,padding:20,marginBottom:14,borderWidth:1,borderColor:'#EEEEEE'}}>
 <Text style={{fontSize:18,fontWeight:'900',color:'#222'}}>{item.title}</Text><Text style={{color:'#777',marginTop:7}}>{item.event_date} · {item.event_type==='fasting_prayer'?'Post și rugăciune':'Rugăciune'}</Text>
 <Text style={{marginTop:12,lineHeight:22,color:'#333'}}>{item.description}</Text>
 {canEdit?<><TextInput multiline placeholder="Motivul respingerii (obligatoriu la respingere)" value={reasons[item.id]||''} onChangeText={v=>setReasons(prev=>({...prev,[item.id]:v}))} style={{borderWidth:1,borderColor:'#ddd',borderRadius:10,padding:12,marginTop:12,minHeight:55}}/>
 {btn(busy===item.id?'Se procesează...':'Aprobă și publică',()=>void review(item.id,true))}{btn('Respinge propunerea',()=>void review(item.id,false),true)}</>:<Text style={{color:'#777',marginTop:12}}>Ai acces de vizualizare, fără drept de aprobare.</Text>}
 </View>)}
 </ScrollView>}</>}
 </SafeAreaView>;
}
