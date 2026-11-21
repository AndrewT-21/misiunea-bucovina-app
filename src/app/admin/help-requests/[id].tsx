import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import AdminSectionHeader from '../../../components/AdminSectionHeader';
import { getHelpRequestPermissions, type HelpRequestPermissions } from '../../../lib/help-request-permissions';
const red='#A61E22';
const states=[['new','Nouă'],['reviewing','În analiză'],['approved','Aprobată'],['rejected','Respinsă']];
type Request = {request_number:number|null;submitted_at:string|null;form_data:Record<string,unknown>|null;id:string;name:string;phone:string;email:string|null;locality:string;county:string|null;category:string;description:string;status:string;created_at:string;consent_at:string};
export default function HelpRequestDetails(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [permissions,setPermissions]=useState<HelpRequestPermissions>({view:false,edit:false,delete:false});
 const [preview,setPreview]=useState<{url:string;name:string;path:string;type:string}|null>(null);const [deleting,setDeleting]=useState(false);
 const [transferAction,setTransferAction]=useState<'download'|'share'|null>(null);const [openingPath,setOpeningPath]=useState<string|null>(null);const [item,setItem]=useState<Request|null>(null);const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{let active=true;(async()=>{let access:HelpRequestPermissions={view:false,edit:false,delete:false};try{access=await getHelpRequestPermissions();}catch{}if(!access.view){if(active){setError('Acces interzis.');setLoading(false);}return;}if(active)setPermissions(access);const {data,error:e}=await supabase.from('help_requests').select('id,name,phone,email,locality,county,category,description,status,created_at,consent_at,request_number,submitted_at,form_data').eq('id',id).maybeSingle();if(active){setItem(data as Request|null);setError(e?.message||'');setLoading(false);}})();return()=>{active=false;};},[id]);
 async function changeStatus(status:string){if(!item||saving||!permissions.edit)return;setSaving(true);setError('');const {data,error:e}=await supabase.from('help_requests').update({status,updated_at:new Date().toISOString()}).eq('id',item.id).select('id,status').single();if(e)setError('Actualizarea a eșuat: '+e.message);else if(data)setItem({...item,status:data.status});setSaving(false);}
 const documents = Array.isArray(item?.form_data?.documents)
  ? (item?.form_data?.documents as unknown[]).filter((entry):entry is {kind:string;path:string;name:string;type:string} =>
      !!entry && typeof entry === 'object' && typeof (entry as {path?:unknown}).path === 'string' && typeof (entry as {name?:unknown}).name === 'string')
  : [];
 async function openDocument(path:string,name:string){
  if(!item || openingPath)return;
  setOpeningPath(path);setError('');
  try {
   const {data:sessionResult,error:sessionError}=await supabase.auth.getSession();
   if(sessionError || !sessionResult.session)throw new Error('Sesiunea a expirat. Autentifică-te din nou.');
   const {data,error:invokeError}=await supabase.functions.invoke('help-request-document-url',{
    body:{request_id:item.id,path},
    headers:{Authorization:`Bearer ${sessionResult.session.access_token}`},
   });
   if(invokeError || !data?.url)throw new Error('Documentul nu a putut fi deschis. Verifică funcția Supabase și permisiunile.');
   setPreview({url:data.url,name,path,type:documents.find(doc=>doc.path===path)?.type||'application/octet-stream'});
  }catch(e){setError(e instanceof Error?e.message:'Eroare la deschiderea documentului.');}
  finally{setOpeningPath(null);}
 }
 async function transferDocument(action:'download'|'share'){
  if(!preview || transferAction)return;
  setTransferAction(action);setError('');
  try {
   // Always request a fresh URL; never persist the signed URL or place it in a share message.
   if(!item)throw new Error('Solicitarea nu mai este disponibilă.');
   const path=preview.path;
   const {data:sessionResult}=await supabase.auth.getSession();
   if(!sessionResult.session)throw new Error('Sesiunea a expirat. Autentifică-te din nou.');
   const {data,error:invokeError}=await supabase.functions.invoke('help-request-document-url',{
    body:{request_id:item.id,path},headers:{Authorization:`Bearer ${sessionResult.session.access_token}`},
   });
   if(invokeError || typeof data?.url!=='string')throw new Error('Nu am putut obține documentul.');
   const safeName=(preview.name||'document').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,120)||'document';
   if(Platform.OS==='web'){
    const response=await fetch(data.url);
    if(!response.ok)throw new Error('Descărcarea a eșuat.');
    const blob=await response.blob();
    const file=new globalThis.File([blob],safeName,{type:blob.type||'application/octet-stream'});
    if(action==='share' && typeof navigator!=='undefined' && navigator.share && navigator.canShare?.({files:[file]})){
     await navigator.share({files:[file],title:safeName});
    }else{
     const blobUrl=URL.createObjectURL(blob);
     const link=document.createElement('a');link.href=blobUrl;link.download=safeName;
     document.body.appendChild(link);link.click();link.remove();
     setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);
     if(action==='share')Alert.alert('Partajare indisponibilă','Browserul nu permite partajarea directă a fișierelor. Documentul a fost descărcat.');
    }
   }else{
    const destination=new File(Paths.cache,`${Date.now()}-${safeName}`);
    const downloaded=await File.downloadFileAsync(data.url,destination);
    if(!(await Sharing.isAvailableAsync()))throw new Error('Partajarea sau salvarea nu este disponibilă pe acest dispozitiv.');
    await Sharing.shareAsync(downloaded.uri,{
     mimeType:preview.type||'application/octet-stream',dialogTitle:action==='download'?'Salvează documentul':'Partajează documentul',
     UTI:preview.type==='application/pdf'?'com.adobe.pdf':undefined,
    });
    // The system share sheet provides Save to Files / Save to device, depending on platform.
   }
  }catch(e){
   const message=e instanceof Error?e.message:'Nu am putut pregăti documentul.';
   if(!/cancel|dismiss|abort/i.test(message))Alert.alert('Document',message);
  }finally{setTransferAction(null);}
 }
 async function deleteRequest(){
  if(!item || deleting || !permissions.delete)return;
  setDeleting(true);setError('');
  try {
   const {data:sessionResult}=await supabase.auth.getSession();
   if(!sessionResult.session)throw new Error('Sesiunea a expirat.');
   const {data,error:invokeError}=await supabase.functions.invoke('delete-help-request',{
    body:{request_id:item.id},headers:{Authorization:`Bearer ${sessionResult.session.access_token}`},
   });
   if(invokeError || !data?.deleted)throw new Error(data?.error || 'Ștergerea nu a reușit. Verifică funcția și permisiunile.');
   if(Array.isArray(data.storage_errors)&&data.storage_errors.length) {
    Alert.alert('Solicitare ștearsă','Solicitarea a fost ștearsă, dar unele fișiere nu au putut fi eliminate din stocare. Verifică jurnalul funcției.');
   }
   router.replace('/admin/help-requests');
  }catch(e){setError(e instanceof Error?e.message:'Eroare la ștergere.');}
  finally{setDeleting(false);}
 }
 function confirmDelete(){
  if(!item || deleting || !permissions.delete)return;
  Alert.alert('Ștergere solicitare','Sigur vrei să ștergi definitiv solicitarea și documentele asociate? Această acțiune nu poate fi anulată.',[
   {text:'Anulează',style:'cancel'},
   {text:'Șterge definitiv',style:'destructive',onPress:()=>{void deleteRequest();}},
  ]);
 }
 const extendedLabels:Record<string,string>={name:'Nume și prenume',birthDate:'Data nașterii',country:'Țara',county:'Județul',locality:'Localitatea / Comuna',village:'Satul',street:'Strada și numărul casei',apartment:'Bloc / Scară / Etaj / Apartament',email:'Email',phone:'Telefon',whatsappSame:'Telefonul este WhatsApp?',whatsapp:'Număr WhatsApp',needs:'Nevoi detaliate',familyMembers:'Membri în familie',minorChildren:'Copii minori',childrenAges:'Vârstele copiilor',monthlyIncome:'Venit lunar aproximativ',illness:'Afecțiuni declarate',workplace:'Loc de muncă',previouslyHelped:'Ajutor anterior de la altă asociație?',previousAssociation:'Asociația anterioară',videoConsent:'Acord reportaj video',visitConsent:'Disponibilitate vizită',discovery:'Cum a aflat de Misiunea Bucovina'};
 const groups: {title:string; keys:string[]}[] = [
  {title:'Date personale',keys:['name','birthDate','email','phone','whatsappSame','whatsapp']},
  {title:'Adresă',keys:['country','county','locality','village','street','apartment']},
  {title:'Situația familiei și nevoile',keys:['needs','familyMembers','minorChildren','childrenAges','monthlyIncome','illness','workplace','previouslyHelped','previousAssociation']},
  {title:'Alte informații',keys:['videoConsent','visitConsent','discovery']},
 ];
 const hiddenKeys = new Set(['documents','files','identity','evidence']);
 const displayValue=(value:unknown):string=>typeof value==='string'?value:typeof value==='boolean'?(value?'Da':'Nu'):typeof value==='number'?String(value):JSON.stringify(value);
 const hasValue=(value:unknown)=>value!==null&&value!==undefined&&value!=='';
 const formEntries=Object.entries(item?.form_data||{}).filter(([key,value])=>!hiddenKeys.has(key)&&hasValue(value));
 const groupedKeys=new Set(groups.flatMap(group=>group.keys));
 const extraEntries=formEntries.filter(([key])=>!groupedKeys.has(key));
 const section=(title:string,entries:[string,unknown][])=>entries.length>0?<View key={title} style={{backgroundColor:'#fff',borderRadius:18,padding:20,marginTop:14}}><Text style={{fontSize:19,fontWeight:'800',color:'#171717'}}>{title}</Text>{entries.map(([key,value])=><View key={key}>{row(extendedLabels[key]||key,displayValue(value))}</View>)}</View>:null;
 const row=(label:string,value:string|null|undefined)=><View style={{marginTop:15}}><Text style={{color:'#888',fontSize:12,fontWeight:'700'}}>{label}</Text><Text selectable style={{color:'#171717',fontSize:15,marginTop:4,lineHeight:22}}>{value||'—'}</Text></View>;
 return <SafeAreaView style={{flex:1,backgroundColor:'#F6F6F6'}} edges={['top']}><AdminSectionHeader title="Solicitare de ajutor" backTo="/admin/help-requests" /><ScrollView contentContainerStyle={{padding:18,maxWidth:900,width:'100%',alignSelf:'center',paddingBottom:55}}>{loading?<ActivityIndicator color={red}/>:!item?<Text style={{color:red}}>{error||'Solicitarea nu a fost găsită.'}</Text>:<><Text style={{color:'#777',marginTop:5}}>Primită la {new Date(item.submitted_at||item.created_at).toLocaleString('ro-RO')}{item.request_number != null ? ` · Solicitarea #${item.request_number}` : ''}</Text>{groups.map(group=>section(group.title,group.keys.filter(key=>hasValue(item.form_data?.[key])&&!hiddenKeys.has(key)).map(key=>[key,item.form_data?.[key]] as [string,unknown])))}{section('Alte câmpuri',extraEntries)}<View style={{backgroundColor:'#fff',borderRadius:18,padding:20,marginTop:14}}><Text style={{fontSize:19,fontWeight:'800',color:'#171717',marginBottom:12}}>Documente justificative</Text>{documents.length===0?<Text style={{color:'#777'}}>Nu există documente atașate acestei solicitări.</Text>:documents.map((doc,index)=><TouchableOpacity key={doc.path} disabled={!!openingPath} onPress={()=>openDocument(doc.path,doc.name)} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:13,borderTopWidth:index?1:0,borderColor:'#eee'}}><Ionicons name={doc.kind==='identity'?'document-text-outline':'document-attach-outline'} size={22} color={red}/><View style={{flex:1}}><Text style={{fontWeight:'700',color:'#222'}}>{doc.kind==='identity'?'Carte de identitate':'Document justificativ'}</Text><Text style={{color:'#666',marginTop:3}} numberOfLines={2}>{doc.name}</Text></View>{openingPath===doc.path?<ActivityIndicator color={red}/>:<Ionicons name="open-outline" size={20} color={red}/>}</TouchableOpacity>)}<Text style={{color:'#888',fontSize:12,marginTop:12}}>Documentele rămân private. Un link temporar nou este generat la fiecare deschidere.</Text></View>{permissions.edit && <View style={{backgroundColor:'#fff',borderRadius:18,padding:20,marginTop:14}}><Text style={{fontSize:19,fontWeight:'800',color:'#171717',marginBottom:12}}>Status: {states.find(s=>s[0]===item.status)?.[1]||item.status}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:9}}>{states.map(([key,label])=><TouchableOpacity key={key} disabled={saving} onPress={()=>changeStatus(key)} style={{backgroundColor:item.status===key?red:'#F4F4F4',paddingVertical:12,paddingHorizontal:15,borderRadius:11,opacity:saving?0.6:1}}><Text style={{color:item.status===key?'#fff':'#333',fontWeight:'800'}}>{label}</Text></TouchableOpacity>)}</View>{saving&&<ActivityIndicator color={red} style={{marginTop:15}}/>}</View>}{permissions.delete && <View style={{backgroundColor:'#fff',borderRadius:18,padding:20,marginTop:14}}><Text style={{fontSize:19,fontWeight:'800',color:'#171717'}}>Ștergere solicitare</Text><Text style={{color:'#666',marginTop:8,marginBottom:15}}>Ștergerea este definitivă și include documentele asociate.</Text><TouchableOpacity disabled={deleting||saving} onPress={confirmDelete} style={{backgroundColor:'#A61E22',padding:14,borderRadius:12,alignItems:'center',opacity:deleting?0.5:1}}><Text style={{color:'white',fontWeight:'800'}}>{deleting?'Se șterge…':'Șterge solicitarea'}</Text></TouchableOpacity></View>}{!!error&&<Text style={{color:red,marginTop:12}}>{error}</Text>}</>}</ScrollView><Modal visible={!!preview} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setPreview(null)}><SafeAreaView style={{flex:1,backgroundColor:'#fff'}}><View style={{flexDirection:'row',alignItems:'center',padding:15,gap:12,borderBottomWidth:1,borderBottomColor:'#eee'}}><Text numberOfLines={1} style={{flex:1,fontWeight:'800',fontSize:16}}>{preview?.name||'Document'}</Text><TouchableOpacity accessibilityLabel="Descarcă documentul" disabled={!!transferAction} onPress={()=>void transferDocument('download')} style={{padding:8,opacity:transferAction?0.5:1}}><Ionicons name="download-outline" size={24} color={red}/></TouchableOpacity><TouchableOpacity accessibilityLabel="Partajează documentul" disabled={!!transferAction} onPress={()=>void transferDocument('share')} style={{padding:8,opacity:transferAction?0.5:1}}><Ionicons name="share-social-outline" size={24} color={red}/></TouchableOpacity>{transferAction?<ActivityIndicator color={red}/>:null}<TouchableOpacity accessibilityLabel="Închide documentul" onPress={()=>setPreview(null)} style={{padding:8}}><Ionicons name="close" size={26} color="#222"/></TouchableOpacity></View>{preview&&<WebView source={{uri:preview.url}} originWhitelist={['https://*']} startInLoadingState renderLoading={()=><ActivityIndicator color={red} style={{marginTop:30}}/>} style={{flex:1}} />}</SafeAreaView></Modal></SafeAreaView>;
}
