import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator,  Image, Keyboard, Linking, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, UIManager, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
const RED = '#A61E22';
type DB = { id: string; name: string; description: string | null };
type TB = { id: string; database_id: string; name: string; description: string | null };
type Field = { id: string; table_id: string; name: string; field_type: string; settings: any; position: number };
type RecordRow = { id: string; table_id: string; values_json: Record<string, any>; created_at: string };
type Attachment = { id:string; table_id:string; record_id:string; field_id:string; storage_path:string; file_name:string; mime_type:string|null; file_size:number };
type Permission = { user_id: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; can_manage: boolean };
type Admin = { user_id: string; full_name?: string | null; email?: string | null; avatar_url?: string | null };
type AccessLevel = 'view' | 'edit' | 'manage';
const accessLevels: {key: AccessLevel; label: string; detail: string}[] = [
 {key:'view',label:'Vizualizare',detail:'Doar consultă datele'},
 {key:'edit',label:'Editare',detail:'Creează, modifică și șterge rânduri'},
 {key:'manage',label:'Gestionare',detail:'Toate drepturile, inclusiv coloane și tabele'},
];
const levelOf = (p: Permission): AccessLevel => p.can_manage ? 'manage' : (p.can_create && p.can_edit && p.can_delete) ? 'edit' : 'view';
const permissionFor = (id: string, level: AccessLevel): Permission => ({
 user_id:id,can_view:true,can_create:level!=='view',can_edit:level!=='view',can_delete:level!=='view',can_manage:level==='manage'
});
type Mode = 'databases' | 'tables' | 'records' | 'permissions';
type FilterOperator = 'contains'|'not_contains'|'equals'|'not_equals'|'starts'|'ends'|'greater'|'less'|'empty'|'not_empty';
type FilterRule = {id:string;fieldId:string;operator:FilterOperator;value:string};
type SortRule = {id:string;fieldId:string;ascending:boolean};
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const FILTER_OPERATORS: {key:FilterOperator;label:string}[] = [
 {key:'contains',label:'Conține'},{key:'not_contains',label:'Nu conține'},
 {key:'equals',label:'Este egal cu'},{key:'not_equals',label:'Nu este egal cu'},
 {key:'starts',label:'Începe cu'},{key:'ends',label:'Se termină cu'},
 {key:'greater',label:'Mai mare decât'},{key:'less',label:'Mai mic decât'},
 {key:'empty',label:'Este gol'},{key:'not_empty',label:'Nu este gol'},
];
const compareCell = (a:any,b:any):number => {
 if(a===null||a===undefined||a==='')return b===null||b===undefined||b===''?0:1;
 if(b===null||b===undefined||b==='')return -1;
 if(typeof a==='number'&&typeof b==='number')return a-b;
 if(typeof a==='boolean'&&typeof b==='boolean')return Number(a)-Number(b);
 return String(Array.isArray(a)?a.join(', '):a).localeCompare(String(Array.isArray(b)?b.join(', '):b),'ro',{numeric:true,sensitivity:'base'});
};


const applyGridRules=(records:RecordRow[],fields:Field[],search:string,filterRules:FilterRule[],filterJoin:'and'|'or',sortRules:SortRule[]):RecordRow[]=>{
const activeFilters=filterRules.filter(rule=>fields.some(f=>f.id===rule.fieldId));
   const matches=(row:RecordRow,rule:FilterRule)=>{
    const field=fields.find(f=>f.id===rule.fieldId);
    if(!field)return true;
    const raw=row.values_json?.[rule.fieldId];
    const blank=raw===undefined||raw===null||raw===''||(Array.isArray(raw)&&raw.length===0);
    if(rule.operator==='empty')return blank;
    if(rule.operator==='not_empty')return !blank;
    const value=field.field_type==='date'?displayRoDate(raw):Array.isArray(raw)?raw.join(', '):String(raw??'');
    const needle=rule.value.trim();
    const left=value.toLocaleLowerCase('ro');const right=needle.toLocaleLowerCase('ro');
    if(rule.operator==='contains')return left.includes(right);
    if(rule.operator==='not_contains')return !left.includes(right);
    if(rule.operator==='equals')return left===right;
    if(rule.operator==='not_equals')return left!==right;
    if(rule.operator==='starts')return left.startsWith(right);
    if(rule.operator==='ends')return left.endsWith(right);
    const a=['number','currency'].includes(field.field_type)?Number(raw):field.field_type==='date'?String(raw??''):left;
    const b=['number','currency'].includes(field.field_type)?Number(needle):field.field_type==='date'?(/^\d{2}\.\d{2}\.\d{4}$/.test(needle)?needle.split('.').reverse().join('-'):needle):right;
    if(['number','currency'].includes(field.field_type)&&(!Number.isFinite(a)||!Number.isFinite(b)))return false;
    return rule.operator==='greater'?a>b:a<b;
   };
   const query=search.trim().toLocaleLowerCase('ro');
   return records.filter(r=>(!query||fields.some(f=>(f.field_type==='date'?displayRoDate(r.values_json?.[f.id]):Array.isArray(r.values_json?.[f.id])?r.values_json?.[f.id].join(', '):String(r.values_json?.[f.id]??'')).toLocaleLowerCase('ro').includes(query)))&&
    (!activeFilters.length||(filterJoin==='and'?activeFilters.every(rule=>matches(r,rule)):activeFilters.some(rule=>matches(r,rule)))))
    .sort((a,b)=>{for(const rule of sortRules){const result=compareCell(a.values_json?.[rule.fieldId],b.values_json?.[rule.fieldId]);if(result)return rule.ascending?result:-result;}return 0;});
  };

const TYPES = ['text','long_text','number','currency','date','time','checkbox','single_select','multi_select','email','phone','url','image','file'];
// Datele se păstrează ISO în Supabase, dar se introduc și se afișează ZZ.LL.AAAA.
const displayRoDate = (value: unknown): string => {
 if (typeof value !== 'string' || !value) return '';
 const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
 return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
};
const parseRoDate = (value: string, fieldName: string): string => {
 const input = value.trim();
 const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input);
 if (!match) throw Error(`Data pentru „${fieldName}” trebuie să fie în format ZZ.LL.AAAA (ex.: 24.10.2026).`);
 const [, day, month, year] = match;
 const iso = `${year}-${month}-${day}`;
 const parsed = new Date(`${iso}T12:00:00Z`);
 if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() + 1 !== Number(month) || parsed.getUTCDate() !== Number(day)) {
  throw Error(`Data pentru „${fieldName}” nu este validă.`);
 }
 return iso;
};
const labels: Record<string,string> = { text:'Text',long_text:'Text lung',number:'Număr',currency:'Sumă',date:'Dată (ZZ.LL.AAAA)',time:'Oră (HH:MM)',checkbox:'Bifă',single_select:'Selecție',multi_select:'Selecție multiplă',email:'Email',phone:'Telefon',url:'Link',image:'Imagine',file:'Fișier' };
function Button({ title, onPress, outline=false, danger=false, disabled=false }: { title:string;onPress:()=>void;outline?:boolean;danger?:boolean;disabled?:boolean }) {
 return <TouchableOpacity disabled={disabled} onPress={onPress} style={[s.button,outline&&s.outline,danger&&{backgroundColor:'#7F1D1D'},disabled&&{opacity:.5}]}><Text style={[s.buttonText,outline&&{color:RED}]}>{title}</Text></TouchableOpacity>;
}
export default function DatabasesScreen() {
 const insets = useSafeAreaInsets();
 const [mode,setMode]=useState<Mode>('databases');
 const [databaseSearch,setDatabaseSearch]=useState('');
 const scrollRef=useRef<ScrollView>(null);
 const formScrollRef=useRef<ScrollView>(null);
 const formScrollY=useRef(0);
 const activeInput=useRef<number|null>(null);
 const keyboardTop=useRef<number|null>(null);
 const [keyboardHeight,setKeyboardHeight]=useState(0);
 const revealFocusedInput=useCallback(()=>{
   const target=activeInput.current;
   const top=keyboardTop.current;
   if(target==null || top==null)return;
   // Measure the actual focused field, and move ONLY the amount hidden by keyboard.
   UIManager.measureInWindow(target,(_x,y,_width,height)=>{
     const overlap=y+height+10-top;
     if(overlap>0)formScrollRef.current?.scrollTo({y:formScrollY.current+overlap,animated:true});
   });
 },[]);
 useEffect(()=>{
   const show=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',event=>{
     keyboardTop.current=event.endCoordinates.screenY;
     setKeyboardHeight(event.endCoordinates.height);
     setTimeout(revealFocusedInput,Platform.OS==='ios'?100:50);
   });
   const hide=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',()=>{
     keyboardTop.current=null;
     setKeyboardHeight(0);
   });
   return ()=>{show.remove();hide.remove();};
 },[revealFocusedInput]);
 const onFieldFocus=(event:any)=>{
   activeInput.current=event.nativeEvent.target;
   setTimeout(revealFocusedInput,120);
 };
 const goToMode=(next:Mode)=>{setMode(next);};
 const [tableSearch,setTableSearch]=useState('');const [duplicatingTable,setDuplicatingTable]=useState<string|null>(null);
 const [dbs,setDbs]=useState<DB[]>([]);const [tables,setTables]=useState<TB[]>([]);const [fields,setFields]=useState<Field[]>([]);const [records,setRecords]=useState<RecordRow[]>([]);
   // Etapa 1: paginare reală prin Supabase (filtrele existente sunt locale paginii).
  const [page,setPage]=useState(0);
  const [pageSize,setPageSize]=useState(25);
  const [totalRows,setTotalRows]=useState(0);
  const [importVisible,setImportVisible]=useState(false);
  const [importBusy,setImportBusy]=useState(false);
  const [importHeaders,setImportHeaders]=useState<string[]>([]);
  const [importRows,setImportRows]=useState<any[][]>([]);
  const [importMapping,setImportMapping]=useState<Record<number,string>>({});
  const [importFilename,setImportFilename]=useState('');
  const [exportBusy,setExportBusy]=useState(false);
 const [dataMenuOpen,setDataMenuOpen]=useState(false);
 const [tipsOpen,setTipsOpen]=useState(false);
 const [hiddenFieldIds,setHiddenFieldIds]=useState<string[]>([]);
const [db,setDb]=useState<DB|null>(null);const [table,setTable]=useState<TB|null>(null);
 const [superAdmin,setSuperAdmin]=useState(false);const [myPermissions,setMyPermissions]=useState<Permission|null>(null);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 const [dialog,setDialog]=useState<'database'|'table'|'field'|'record'|null>(null);
 const [editingId,setEditingId]=useState<string|null>(null);const [name,setName]=useState('');const [description,setDescription]=useState('');
 const [fieldType,setFieldType]=useState('text');const [options,setOptions]=useState('');const [values,setValues]=useState<Record<string,any>>({});
 const [permissions,setPermissions]=useState<Permission[]>([]);const [admins,setAdmins]=useState<Admin[]>([]);const [chosenAdmin,setChosenAdmin]=useState<string|null>(null);
 const [draftPerm,setDraftPerm]=useState<Permission>({user_id:'',can_view:true,can_create:false,can_edit:false,can_delete:false,can_manage:false});
 const [grantAdmins,setGrantAdmins]=useState<Admin[]>([]);
 const [grantSelections,setGrantSelections]=useState<Record<string,Permission>>({});
 const [grantLoading,setGrantLoading]=useState(false);
 const [search,setSearch]=useState('');
 const [sortField,setSortField]=useState<string|null>(null);
 const [sortAscending,setSortAscending]=useState(true);
 const [cellEdit,setCellEdit]=useState<{row:RecordRow;field:Field}|null>(null);
 const [cellValue,setCellValue]=useState<any>('');
 const [cellSaving,setCellSaving]=useState(false);
  const [panel,setPanel]=useState<'sort'|'filter'|'columns'|null>(null);
  const [sortRules,setSortRules]=useState<SortRule[]>([]);
  const [filterRules,setFilterRules]=useState<FilterRule[]>([]);
  const [filterJoin,setFilterJoin]=useState<'and'|'or'>('and');
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [selectionMode,setSelectionMode]=useState(false);
  const [bulkBusy,setBulkBusy]=useState(false);
  const [imageLoadError,setImageLoadError]=useState(false);
 const [attachments,setAttachments]=useState<Attachment[]>([]);
 const [attachmentBusy,setAttachmentBusy]=useState(false);
  const [attachmentPreview,setAttachmentPreview]=useState<{uri:string;kind:'image'|'pdf';name:string}|null>(null);
  const [viewerVisible,setViewerVisible]=useState(false);
  const previewTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [previewKey,setPreviewKey]=useState(0);
  const [viewerSize,setViewerSize]=useState({width:350,height:600});
 const [imageLoading,setImageLoading]=useState(false);
 const attachmentsFor=(recordId:string,fieldId:string)=>attachments.filter(a=>a.record_id===recordId&&a.field_id===fieldId);
 const refreshAttachments=async(tableId:string)=>{
  const {data,error:e}=await supabase.from('mdb_attachments').select('id,table_id,record_id,field_id,storage_path,file_name,mime_type,file_size').eq('table_id',tableId);
  if(e)throw e;
  setAttachments((data||[]) as Attachment[]);
 };
 // Convert base64 to bytes without requiring an additional npm dependency.
 const bytesFromBase64=(input:string):Uint8Array=>{
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean=input.replace(/[^A-Za-z0-9+/=]/g,'');
  const out=new Uint8Array(Math.floor(clean.length*3/4)-(clean.endsWith('==')?2:clean.endsWith('=')?1:0));
  let buffer=0,bits=0,index=0;
  for(const char of clean){if(char==='=')break;const value=alphabet.indexOf(char);if(value<0)continue;buffer=(buffer<<6)|value;bits+=6;if(bits>=8){bits-=8;out[index++]=(buffer>>bits)&255;}}
  return out;
 };
 const addAttachment=async(row:RecordRow,field:Field)=>{
  if(!db||!table||!can('edit')||attachmentBusy)return;
  try{
   let picked:{uri:string;name:string;mimeType:string;size?:number}|null=null;
   if(field.field_type==='image'){
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){Alert.alert('Permisiune necesară','Permite accesul la fotografii.');return;}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:1});
    if(result.canceled||!result.assets.length)return;
    const asset=result.assets[0];picked={uri:asset.uri,name:asset.fileName||`imagine-${Date.now()}.jpg`,mimeType:asset.mimeType||'image/jpeg',size:asset.fileSize};
   }else{
    const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true,multiple:false});
    if(result.canceled||!result.assets.length)return;
    const asset=result.assets[0];picked={uri:asset.uri,name:asset.name||`document-${Date.now()}`,mimeType:asset.mimeType||'application/octet-stream',size:asset.size};
   }
   if(!picked)return;
   if((picked.size||0)>50*1024*1024)throw Error('Fișierul depășește limita de 50 MB.');
   setAttachmentBusy(true);
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw Error('Sesiune expirată.');
   const safeName=picked.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'fisier';
   const randomId=`${Date.now()}-${Math.random().toString(36).slice(2,12)}`;
   const path=`${db.id}/${table.id}/${row.id}/${randomId}-${safeName}`;
   const base64=await FileSystem.readAsStringAsync(picked.uri,{encoding:FileSystem.EncodingType.Base64});
   const bytes=bytesFromBase64(base64);
   if(bytes.byteLength>50*1024*1024)throw Error('Fișierul depășește limita de 50 MB.');
   const {error:uploadError}=await supabase.storage.from('mdb-private').upload(path,bytes.buffer as ArrayBuffer,{contentType:picked.mimeType,upsert:false});
   if(uploadError)throw uploadError;
   const {error:metaError}=await supabase.from('mdb_attachments').insert({table_id:table.id,record_id:row.id,field_id:field.id,storage_path:path,file_name:picked.name,mime_type:picked.mimeType,file_size:bytes.byteLength,uploaded_by:user.id});
   if(metaError){await supabase.storage.from('mdb-private').remove([path]);throw metaError;}
   await refreshAttachments(table.id);
  }catch(e:any){Alert.alert('Încărcare eșuată',e.message||String(e));}finally{setAttachmentBusy(false);}
 };
   const closeViewer=()=>{
    setViewerVisible(false);
    setImageLoading(false);
    setImageLoadError(false);
    // Unmount heavy native views only after iOS finishes dismissing the modal.
    setTimeout(()=>setAttachmentPreview(null),300);
  };
  const viewAttachment=async(a:Attachment)=>{
    if(attachmentBusy||viewerVisible)return;
    try{
      setAttachmentBusy(true);
      const {data,error:e}=await supabase.storage.from('mdb-private').createSignedUrl(a.storage_path,60*15);
      if(e||!data?.signedUrl)throw e||Error('Nu se poate deschide fișierul.');
      const isImage=a.mime_type?.startsWith('image/')||/\.(jpe?g|png|webp|gif|heic)$/i.test(a.file_name);
      const isPdf=a.mime_type==='application/pdf'||/\.pdf$/i.test(a.file_name);
      if(!isImage&&!isPdf){await Linking.openURL(data.signedUrl);return;}
      // Do not show a second native Modal while the attachment editor is visible.
      if(previewTimer.current)clearTimeout(previewTimer.current);
      setCellEdit(null);
      setImageLoadError(false);
      setImageLoading(true);
      setPreviewKey(x=>x+1);
      const next={uri:data.signedUrl,kind:isImage?'image' as const:'pdf' as const,name:a.file_name};
      previewTimer.current=setTimeout(()=>{
        setAttachmentPreview(next);
        setViewerVisible(true);
        previewTimer.current=null;
      },500);
    }catch(e:any){Alert.alert('Nu se poate deschide',e.message||String(e));}
    finally{setAttachmentBusy(false);}
  };
const deleteAttachment=(a:Attachment)=>{
  if(!can('edit'))return;
  Alert.alert('Șterge atașamentul',`Ștergi „${a.file_name}”?`,[
   {text:'Anulează',style:'cancel'},
   {text:'Șterge',style:'destructive',onPress:async()=>{
    setAttachmentBusy(true);
    try{
     // Remove the object first; retain metadata if storage deletion fails.
     const {error:storageError}=await supabase.storage.from('mdb-private').remove([a.storage_path]);if(storageError)throw storageError;
     const {error:metadataError}=await supabase.from('mdb_attachments').delete().eq('id',a.id);if(metadataError)throw metadataError;
     if(table)await refreshAttachments(table.id);
    }catch(e:any){Alert.alert('Ștergere incompletă',`${e.message||String(e)}. Dacă fișierul a fost șters din Storage, reîncearcă ștergerea intrării.`);}finally{setAttachmentBusy(false);}
   }}
  ]);
 };
 const attachmentControls=(row:RecordRow,field:Field)=><View style={{gap:8}}>
  {attachmentsFor(row.id,field.id).map(a=><View key={a.id} style={{flexDirection:'row',alignItems:'center',gap:8}}>
   <TouchableOpacity style={{flex:1,flexDirection:'row',alignItems:'center',gap:8,paddingVertical:7}} onPress={()=>void viewAttachment(a)} disabled={attachmentBusy}>
    <Ionicons name={a.mime_type?.startsWith('image/')?'image-outline':'document-outline'} size={20} color={RED}/>
    <Text style={{flex:1,color:RED}} numberOfLines={2}>{a.file_name}</Text>
   </TouchableOpacity>
   {can('edit')&&<TouchableOpacity disabled={attachmentBusy} onPress={()=>deleteAttachment(a)}><Ionicons name="trash-outline" size={21} color={RED}/></TouchableOpacity>}
  </View>)}
  {!attachmentsFor(row.id,field.id).length&&<Text style={s.muted}>Niciun atașament.</Text>}
  {can('edit')&&<Button title={attachmentBusy?'Se procesează...':field.field_type==='image'?'Adaugă imagine':'Adaugă document'} disabled={attachmentBusy} onPress={()=>void addAttachment(row,field)}/>}
 </View>;

 const formatValue=(f:Field,v:any)=>f.field_type==='checkbox'?(v?'☑':'☐'):Array.isArray(v)?v.join(', '):f.field_type==='date'?displayRoDate(v)||'—':v===undefined||v===null||v===''?'—':String(v);
 const normalizeValue=(f:Field,raw:any)=>{
  if(f.field_type==='checkbox')return !!raw;
  if(raw===undefined||raw===null||(typeof raw==='string'&&raw.trim()==='')||(Array.isArray(raw)&&raw.length===0))return null;
  if(['number','currency'].includes(f.field_type)){const n=Number(raw);if(!Number.isFinite(n))throw Error('Număr invalid.');return n;}
  if(f.field_type==='date')return parseRoDate(String(raw),f.name);
  if(f.field_type==='time'){const v=String(raw).trim();if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('Ora trebuie să fie HH:MM.');return v;}
  return raw;
 };
 const updateCell=async(row:RecordRow,f:Field,raw:any)=>{
  if(!can('edit'))return;
  setCellSaving(true);
  try{
   const v=normalizeValue(f,raw);
   const next={...(row.values_json||{})};if(v===null)delete next[f.id];else next[f.id]=v;
   await check(supabase.from('mdb_records').update({values_json:next}).eq('id',row.id));
   setRecords(prev=>prev.map(r=>r.id===row.id?{...r,values_json:next}:r));setCellEdit(null);
  }catch(e:any){Alert.alert('Nu s-a salvat',e.message||String(e));}finally{setCellSaving(false);}
 };
 const editCell=(row:RecordRow,f:Field)=>{
  if(!can('edit')&&!['image','file'].includes(f.field_type))return;
  if(f.field_type==='checkbox'){void updateCell(row,f,!row.values_json?.[f.id]);return;}
  setCellEdit({row,field:f});
  const v=row.values_json?.[f.id];setCellValue(f.field_type==='date'?displayRoDate(v):v??(f.field_type==='multi_select'?[]:''));
 };
 const duplicateRow=async(row:RecordRow)=>{
  if(!can('create')||!table)return;
  try{await check(supabase.from('mdb_records').insert({table_id:table.id,values_json:row.values_json||{}}));await openTable(table);}catch(e:any){Alert.alert('Eroare',e.message||String(e));}
 };
 const moveField=async(f:Field,delta:number)=>{
  if(!can('manage'))return;
  const index=fields.findIndex(x=>x.id===f.id),other=fields[index+delta];if(!other)return;
  try{await check(supabase.from('mdb_fields').update({position:other.position}).eq('id',f.id));await check(supabase.from('mdb_fields').update({position:f.position}).eq('id',other.id));if(table)await openTable(table);}catch(e:any){Alert.alert('Eroare',e.message||String(e));}
 };
     const visibleFields=useMemo(()=>fields.filter(f=>!hiddenFieldIds.includes(f.id)),[fields,hiddenFieldIds]);
      const shownRecords=useMemo(()=>applyGridRules(records,fields,search,filterRules,filterJoin,sortRules),[records,fields,search,filterRules,filterJoin,sortRules]);
 const can=(action:'view'|'create'|'edit'|'delete'|'manage')=>superAdmin || !!myPermissions?.[`can_${action}` as keyof Permission];
 // Lățimea întregii grile este fixată explicit: antetele nu se pot împacheta vertical.
 const gridWidth=48+(selectionMode?48:0)+visibleFields.length*170+(can('manage')?48:0)+(can('create')?48:0)+(can('delete')?48:0);
const toggleSelection=(id:string)=>setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const deleteSelected=()=>{
   if(!can('delete')||!selectedIds.length||bulkBusy)return;
   const ids=selectedIds.filter(id=>records.some(r=>r.id===id));
   Alert.alert('Ștergere multiplă',`Ștergi ${ids.length} rânduri selectate?`,[
    {text:'Anulează',style:'cancel'},
    {text:'Șterge',style:'destructive',onPress:async()=>{
     setBulkBusy(true);
     try{
      // Soft delete in batches, preserving the existing deleted_at convention.
      for(let i=0;i<ids.length;i+=50)await check(supabase.rpc('mdb_soft_delete_records',{p_ids:ids.slice(i,i+50)}));
      setRecords(prev=>prev.filter(r=>!ids.includes(r.id)));setSelectedIds([]);setSelectionMode(false);
     }catch(e:any){Alert.alert('Ștergere incompletă',e.message||String(e));if(table)await openTable(table);}
     finally{setBulkBusy(false);}
    }}]);
  };
 const check=async <T,>(promise:PromiseLike<{data:T|null;error:any}>):Promise<T>=>{const r=await promise;if(r.error)throw r.error;return r.data as T;};
 const loadDbs=useCallback(async()=>{setLoading(true);setError('');try{
   const {data:{session}}=await supabase.auth.getSession();if(!session){router.replace('/admin-login');return;}
   const isSuper=await check<boolean>(supabase.rpc('mdb_is_superadmin'));setSuperAdmin(isSuper===true);
   const list=await check<DB[]>(supabase.from('mdb_databases').select('id,name,description').is('archived_at',null).order('created_at',{ascending:false}));setDbs(list||[]);
 }catch(e:any){setError(e.message||String(e));}finally{setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{void loadDbs();},[loadDbs]));
 const openDb=async(item:DB)=>{setDb(item);setTable(null);setLoading(true);setError('');try{
   const [list, rights]=await Promise.all([check<TB[]>(supabase.from('mdb_tables').select('id,database_id,name,description').eq('database_id',item.id).order('position')),superAdmin?Promise.resolve(null):Promise.all((['view','create','edit','delete','manage'] as const).map(async action=>({action,allowed:await check<boolean>(supabase.rpc('mdb_can',{p_database:item.id,p_action:action}))})))]);
   setTables(list||[]);setMyPermissions(rights?{user_id:'',...Object.fromEntries(rights.map(r=>['can_'+r.action,r.allowed]))} as Permission:null);goToMode('tables');
 }catch(e:any){setError(e.message||String(e));}finally{setLoading(false);}};
    const loadRecordPage=async(item:TB,targetPage:number,size:number)=>{
    const from=targetPage*size;
    const response=await supabase.from('mdb_records')
      .select('id,table_id,values_json,created_at',{count:'exact'})
      .eq('table_id',item.id).is('deleted_at',null)
      .order('created_at',{ascending:false}).range(from,from+size-1);
    if(response.error)throw response.error;
    const count=response.count||0;
    setTotalRows(count);
    setRecords((response.data||[]) as RecordRow[]);
    setPage(targetPage);
  };
  const openTable=async(item:TB,targetPage=0,size=pageSize)=>{
    setTable(item);setSearch('');setSelectedIds([]);setSelectionMode(false);
    setLoading(true);setError('');
    try{
      const f=await check<Field[]>(supabase.from('mdb_fields')
        .select('id,table_id,name,field_type,settings,position')
        .eq('table_id',item.id).order('position'));
      setFields(f||[]);
      await Promise.all([loadRecordPage(item,targetPage,size),refreshAttachments(item.id)]);
      goToMode('records');
    }catch(e:any){setError(e.message||String(e));}finally{setLoading(false);}
  };
  const changePage=async(target:number,size=pageSize)=>{
    if(!table||loading)return;
    setLoading(true);setError('');
    try{await loadRecordPage(table,target,size);setSelectedIds([]);}
    catch(e:any){setError(e.message||String(e));}finally{setLoading(false);}
  };
  const readImportFile=async()=>{
    if(!can('create')||importBusy)return;
    try{
      const result=await DocumentPicker.getDocumentAsync({type:['text/csv','text/comma-separated-values','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'],copyToCacheDirectory:true});
      if(result.canceled||!result.assets.length)return;
      const asset=result.assets[0];
      if(!/\.(csv|xlsx|xls)$/i.test(asset.name))throw Error('Alege un fișier .csv, .xlsx sau .xls.');
      if((asset.size||0)>12*1024*1024)throw Error('Fișierul depășește 12 MB.');
      setImportBusy(true);
      const encoded=await FileSystem.readAsStringAsync(asset.uri,{encoding:FileSystem.EncodingType.Base64});
      const workbook=XLSX.read(encoded,{type:'base64',cellDates:false});
      const first=workbook.Sheets[workbook.SheetNames[0]];
      if(!first)throw Error('Fișierul nu conține foi cu date.');
      const matrix=XLSX.utils.sheet_to_json<any[]>(first,{header:1,defval:'',raw:false,blankrows:false});
      if(matrix.length<2)throw Error('Fișierul trebuie să conțină antete și cel puțin un rând.');
      const headers=(matrix[0]||[]).map((v:any,i:number)=>String(v||`Coloana ${i+1}`).trim());
      const rows=matrix.slice(1).filter((r:any[])=>r.some(v=>String(v??'').trim()!==''));
      if(!rows.length)throw Error('Nu există înregistrări de importat.');
      if(rows.length>5000)throw Error('Importă maximum 5.000 de rânduri într-un fișier.');
      const mapping:Record<number,string>={};const used=new Set<string>();
      headers.forEach((h:string,i:number)=>{const match=fields.find(f=>f.name.trim().toLocaleLowerCase('ro')===h.toLocaleLowerCase('ro')&&!used.has(f.id)&&!['image','file'].includes(f.field_type));if(match){mapping[i]=match.id;used.add(match.id);}});
      setImportHeaders(headers);setImportRows(rows);setImportMapping(mapping);setImportFilename(asset.name);setImportVisible(true);
    }catch(e:any){Alert.alert('Import',e.message||String(e));}finally{setImportBusy(false);}
  };
  const importData=async()=>{
    if(!table||!can('create')||importBusy)return;
    const mapped=Object.entries(importMapping).filter(([,id])=>!!id);
    if(!mapped.length){Alert.alert('Import','Asociază cel puțin o coloană.');return;}
    setImportBusy(true);
    let imported=0;
    try{
      const payload=importRows.map((row,index)=>{
        const values:Record<string,any>={};
        for(const [indexStr,fieldId] of mapped){
          const f=fields.find(x=>x.id===fieldId);if(!f)continue;
          if(['image','file'].includes(f.field_type))continue;
          const raw=row[Number(indexStr)];
          if(raw===undefined||raw===null||String(raw).trim()==='')continue;
          try{
            let normalized:any;
            if(f.field_type==='checkbox')normalized=['1','true','da','yes','x','☑'].includes(String(raw).trim().toLocaleLowerCase('ro'));
            else if(f.field_type==='multi_select')normalized=String(raw).split(/[,;]+/).map(v=>v.trim()).filter(Boolean);
            else if(f.field_type==='date'){
              const text=String(raw).trim();
              normalized=/^\d{4}-\d{2}-\d{2}$/.test(text)?parseRoDate(displayRoDate(text),f.name):parseRoDate(text,f.name);
            }else normalized=normalizeValue(f,raw);
            if(normalized!==null)values[f.id]=normalized;
          }catch(e:any){throw Error(`Rândul ${index+2}, „${f.name}”: ${e.message||String(e)}`);}
        }
        return {table_id:table.id,values_json:values};
      });
      // Validate every row before the first write; only then insert batches.
      for(let i=0;i<payload.length;i+=50){
        await check(supabase.from('mdb_records').insert(payload.slice(i,i+50)));
        imported+=Math.min(50,payload.length-i);
      }
      setImportVisible(false);
      await openTable(table,0,pageSize);
      Alert.alert('Import finalizat',`${imported} rânduri importate.`);
    }catch(e:any){
      Alert.alert('Import întrerupt',`${imported} rânduri au fost salvate. ${e.message||String(e)}\nNu relua importul fără să verifici duplicatele.`);
      if(imported>0)await openTable(table,0,pageSize);
    }finally{setImportBusy(false);}
  };
  const exportData=async(format:'csv'|'xlsx',filtered:boolean)=>{
    if(!table||exportBusy)return;
    setExportBusy(true);
    try{
      // Export all records via server-side batches, not just the visible page.
      const all:RecordRow[]=[];
      for(let from=0;from<50000;from+=1000){
        const {data,error:e}=await supabase.from('mdb_records')
          .select('id,table_id,values_json,created_at').eq('table_id',table.id)
          .is('deleted_at',null).order('created_at',{ascending:false}).range(from,from+999);
        if(e)throw e;
        all.push(...((data||[]) as RecordRow[]));
        if(!data||data.length<1000)break;
        if(from===49000)throw Error('Exportul depășește limita de 50.000 de rânduri.');
      }
      // Reuse the same search, filter and sort rules as the visible grid.
      const rows=filtered?applyGridRules(all,fields,search,filterRules,filterJoin,sortRules):all;
      const body=rows.map(r=>fields.map(f=>{
        if(['image','file'].includes(f.field_type))return attachmentsFor(r.id,f.id).map(a=>a.file_name).join('; ');
        const v=r.values_json?.[f.id];
        if(f.field_type==='date')return displayRoDate(v);
        if(f.field_type==='checkbox')return v?'Da':'Nu';
        return Array.isArray(v)?v.join('; '):v??'';
      }));
      const sheet=XLSX.utils.aoa_to_sheet([fields.map(f=>f.name),...body]);
      const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Date');
      const encoded=XLSX.write(book,{bookType:format,type:'base64'});
      const safe=(table.name||'tabel').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,45);
      const uri=FileSystem.cacheDirectory+`${safe}_${Date.now()}.${format}`;
      await FileSystem.writeAsStringAsync(uri,encoded,{encoding:FileSystem.EncodingType.Base64});
      if(!(await Sharing.isAvailableAsync()))throw Error('Distribuirea fișierelor nu este disponibilă pe acest dispozitiv.');
      await Sharing.shareAsync(uri,{mimeType:format==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',dialogTitle:'Exportă tabelul MisiBi'});
    }catch(e:any){Alert.alert('Export eșuat',e.message||String(e));}finally{setExportBusy(false);}
  };
const refresh=async()=>{if(mode==='databases')await loadDbs();else if(mode==='records'&&table)await openTable(table);else if(db)await openDb(db);};
 const fetchEligibleAdmins=async():Promise<Admin[]>=>{
  const [roles,users]=await Promise.all([supabase.rpc('misibi_admin_permissions_list'),supabase.rpc('super_admin_list_users')]);
  if(roles.error)throw roles.error;
  if(users.error)throw users.error;
  const ids=[...new Set(((roles.data||[]) as {admin_user_id:string;admin_role:string}[]).filter(a=>a.admin_role==='admin').map(a=>a.admin_user_id))];
  const directory=new Map(((users.data||[]) as {user_id:string;full_name?:string|null;nickname?:string|null;email?:string|null}[]).map(u=>[u.user_id,u]));
  // Folosim aceeași sursă pentru fotografii ca în Program săptămânal.
  const profiles = ids.length ? await supabase.from('admin_profiles').select('user_id,full_name,nickname,avatar_url').in('user_id',ids) : {data:[],error:null};
  const profileMap=new Map(((profiles.data||[]) as {user_id:string;full_name?:string|null;nickname?:string|null;avatar_url?:string|null}[]).map(u=>[u.user_id,u]));
  return ids.map(id=>({user_id:id,full_name:profileMap.get(id)?.full_name?.trim()||directory.get(id)?.full_name||profileMap.get(id)?.nickname||directory.get(id)?.nickname||null,email:directory.get(id)?.email||null,avatar_url:profileMap.get(id)?.avatar_url||null}));
 };
 const loadGrantChoices=async(databaseId?:string)=>{
  setGrantLoading(true);setGrantAdmins([]);setGrantSelections({});
  try{
   const [eligible,existing]=await Promise.all([fetchEligibleAdmins(),databaseId?check<Permission[]>(supabase.from('mdb_permissions').select('user_id,can_view,can_create,can_edit,can_delete,can_manage').eq('database_id',databaseId)):Promise.resolve([])]);
   setGrantAdmins(eligible);
   setGrantSelections(Object.fromEntries(existing.map(p=>[p.user_id,permissionFor(p.user_id,levelOf(p))])));
  }catch(e:any){Alert.alert('Administratori indisponibili',e.message||String(e));}finally{setGrantLoading(false);}
 };
 const toggleGrant=(id:string)=>setGrantSelections(prev=>{const next={...prev};if(next[id])delete next[id];else next[id]={user_id:id,can_view:true,can_create:true,can_edit:true,can_delete:true,can_manage:true};return next;});
 const setGrantLevel=(id:string,level:AccessLevel)=>setGrantSelections(prev=>({...prev,[id]:permissionFor(id,level)}));
 const begin=(kind:'database'|'table'|'field'|'record',item?:any)=>{setEditingId(item?.id||null);setName(item?.name||'');setDescription(item?.description||'');setFieldType(item?.field_type||'text');setOptions((item?.settings?.options||[]).join(', '));setValues(kind==='record'?Object.fromEntries(Object.entries(item?.values_json||{}).map(([key,value])=>[key,fields.find(f=>f.id===key)?.field_type==='date'?displayRoDate(value):value])):(item?.values_json||{}));setDialog(kind);if(kind==='database'&&superAdmin)void loadGrantChoices(item?.id);};
 const save=async()=>{if(!dialog||saving)return;setSaving(true);try{
  if(dialog==='database'){
   if(!name.trim())throw Error('Introdu un nume.');if(!superAdmin)throw Error('Doar superadminul creează baze de date.');
   if(grantLoading)throw Error('Așteaptă încărcarea administratorilor.');
   let targetId=editingId;
   if(targetId)await check(supabase.from('mdb_databases').update({name:name.trim(),description:description.trim()}).eq('id',targetId));
   else {
    const created=await check<{id:string}>(supabase.from('mdb_databases').insert({name:name.trim(),description:description.trim()}).select('id').single());
    targetId=created.id;
    setEditingId(targetId); // În caz de eroare la permisiuni, o nouă încercare nu dublează baza.
   }
   const selected=Object.values(grantSelections);
   const selectedIds=new Set(selected.map(p=>p.user_id));
   const existing=await check<{user_id:string}[]>(supabase.from('mdb_permissions').select('user_id').eq('database_id',targetId));
   for(const p of selected){await check(supabase.from('mdb_permissions').upsert({database_id:targetId,...p},{onConflict:'database_id,user_id'}));}
   for(const p of existing||[]){if(!selectedIds.has(p.user_id))await check(supabase.from('mdb_permissions').delete().eq('database_id',targetId).eq('user_id',p.user_id));}
  }else if(dialog==='table'){
   if(!db||!name.trim())throw Error('Introdu un nume.');if(!can('manage'))throw Error('Nu ai drept de administrare.');
   if(editingId)await check(supabase.from('mdb_tables').update({name:name.trim(),description:description.trim()}).eq('id',editingId));
   else await check(supabase.from('mdb_tables').insert({database_id:db.id,name:name.trim(),description:description.trim()}));
  }else if(dialog==='field'){
   if(!table||!name.trim())throw Error('Introdu numele coloanei.');if(!can('manage'))throw Error('Nu ai drept de administrare.');
   const settings=['single_select','multi_select'].includes(fieldType)?{options:options.split(',').map(x=>x.trim()).filter(Boolean)}:{};
   if(editingId)await check(supabase.from('mdb_fields').update({name:name.trim(),field_type:fieldType,settings}).eq('id',editingId));
   else await check(supabase.from('mdb_fields').insert({table_id:table.id,name:name.trim(),field_type:fieldType,settings,position:fields.length}));
  }else if(dialog==='record'){
   if(!table)throw Error('Tabel indisponibil.');const clean:Record<string,any>={};
   for(const f of fields){const raw=values[f.id];if(f.field_type==='checkbox')clean[f.id]=!!raw;
    else if(['number','currency'].includes(f.field_type)){if(raw!==undefined&&String(raw).trim()!==''){const n=Number(raw);if(!Number.isFinite(n))throw Error(`Valoare numerică invalidă: ${f.name}`);clean[f.id]=n;}}
    else if(f.field_type==='date'){if(raw!==undefined&&String(raw).trim()!=='')clean[f.id]=parseRoDate(String(raw),f.name);}else if(f.field_type==='time'){if(raw!==undefined&&String(raw).trim()!==''){const hour=String(raw).trim();if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hour))throw Error(`Ora pentru „${f.name}” trebuie să fie în format HH:MM (ex.: 14:30).`);clean[f.id]=hour;}}else if(f.field_type==='multi_select'){if(Array.isArray(raw)&&raw.length)clean[f.id]=raw;}else if(raw!==undefined&&String(raw).trim()!=='')clean[f.id]=raw;}
   if(editingId){if(!can('edit'))throw Error('Nu ai drept de editare.');await check(supabase.from('mdb_records').update({values_json:clean}).eq('id',editingId));}
   else {if(!can('create'))throw Error('Nu ai drept de creare.');await check(supabase.from('mdb_records').insert({table_id:table.id,values_json:clean}));}
  }
  setDialog(null);await refresh();
 }catch(e:any){Alert.alert('Nu s-a salvat',e.message||String(e));}finally{setSaving(false);}};
 const duplicateTable=(source:TB)=>{
  if(!db||!can('manage')||duplicatingTable)return;
  Alert.alert('Duplică structura tabelului',`Creezi o copie a tabelului „${source.name}”, inclusiv coloanele și setările lor. Înregistrările și atașamentele NU vor fi copiate.`,[
   {text:'Anulează',style:'cancel'},
   {text:'Duplică',onPress:async()=>{
    setDuplicatingTable(source.id);
    let createdId:string|null=null;
    try{
     const sourceFields=await check<Field[]>(supabase.from('mdb_fields').select('id,table_id,name,field_type,settings,position').eq('table_id',source.id).order('position'));
     const created=await check<{id:string}>(supabase.from('mdb_tables').insert({database_id:db.id,name:`${source.name} (copie)`,description:source.description||''}).select('id').single());
     createdId=created.id;
     if(sourceFields.length){
      await check(supabase.from('mdb_fields').insert(sourceFields.map(f=>({table_id:created.id,name:f.name,field_type:f.field_type,settings:f.settings||{},position:f.position}))));
     }
     await openDb(db);
     Alert.alert('Tabel duplicat','Structura și coloanele au fost copiate. Înregistrările nu au fost copiate.');
    }catch(e:any){
     if(createdId){const cleanup=await supabase.from('mdb_tables').delete().eq('id',createdId);if(cleanup.error)Alert.alert('Atenție',`Copierea a eșuat și tabelul parțial nu a putut fi eliminat: ${cleanup.error.message}`);}
     Alert.alert('Duplicarea a eșuat',e.message||String(e));
    }finally{setDuplicatingTable(null);}
   }}
  ]);
 };
 const confirmDelete=(kind:'database'|'table'|'field'|'record',id:string)=>Alert.alert('Confirmare','Sigur dorești să ștergi?', [{text:'Anulează',style:'cancel'},{text:'Șterge',style:'destructive',onPress:async()=>{try{
  if(kind==='database'){if(!superAdmin)throw Error('Doar superadminul poate șterge baze de date.');await check(supabase.from('mdb_databases').update({archived_at:new Date().toISOString()}).eq('id',id));}
  if(kind==='table'){if(!can('manage'))throw Error('Acces refuzat.');await check(supabase.from('mdb_tables').delete().eq('id',id));}
  if(kind==='field'){if(!can('manage'))throw Error('Acces refuzat.');await check(supabase.from('mdb_fields').delete().eq('id',id));}
  if(kind==='record'){if(!can('delete'))throw Error('Acces refuzat.');await check(supabase.rpc('mdb_soft_delete_records',{p_ids:[id]}));}
  await refresh();
 }catch(e:any){Alert.alert('Eroare',e.message||String(e));}}}]);
 const loadPermissions=async()=>{if(!db||!superAdmin)return;setLoading(true);try{
  // Folosim RPC-urile deja folosite de pagina de permisiuni MisiBi.
  // Citirea directă din admins poate întoarce 0 rânduri din cauza RLS.
  const [p, departmentRoles, usersResult] = await Promise.all([
   supabase.from('mdb_permissions').select('user_id,can_view,can_create,can_edit,can_delete,can_manage').eq('database_id',db.id),
   supabase.rpc('misibi_admin_permissions_list'),
   supabase.rpc('super_admin_list_users'),
  ]);
  if(p.error)throw p.error;
  if(departmentRoles.error)throw departmentRoles.error;
  if(usersResult.error)throw usersResult.error;
  const roleRows=(departmentRoles.data||[]) as {admin_user_id:string;admin_role:string}[];
  const adminIds=[...new Set(roleRows.filter(a=>a.admin_role==='admin').map(a=>a.admin_user_id))];
  const userRows=(usersResult.data||[]) as {user_id:string;full_name?:string|null;nickname?:string|null;email?:string|null}[];
  const directory=new Map(userRows.map(u=>[u.user_id,u]));
  setPermissions(p.data||[]);
  setAdmins(adminIds.map(id=>({user_id:id,full_name:directory.get(id)?.full_name||directory.get(id)?.nickname||null,email:directory.get(id)?.email||null})));
  setChosenAdmin(null);goToMode('permissions');
 }catch(e:any){Alert.alert('Eroare',e.message||String(e));}finally{setLoading(false);}};
 const selectAdmin=(id:string)=>{setChosenAdmin(id);setDraftPerm(permissionFor(id,levelOf(permissions.find(p=>p.user_id===id)||permissionFor(id,'view'))));};
 const savePermission=async()=>{if(!db||!chosenAdmin||!superAdmin)return;setSaving(true);try{
  await check(supabase.from('mdb_permissions').upsert({database_id:db.id,user_id:chosenAdmin,...draftPerm},{onConflict:'database_id,user_id'}));await loadPermissions();
 }catch(e:any){Alert.alert('Eroare',e.message||String(e));}finally{setSaving(false);}};
 const revokePermission=()=>{if(!db||!chosenAdmin)return;Alert.alert('Revocă accesul','Administratorul nu va mai putea vedea această bază de date.',[{text:'Anulează',style:'cancel'},{text:'Revocă',style:'destructive',onPress:async()=>{const {error:e}=await supabase.from('mdb_permissions').delete().eq('database_id',db.id).eq('user_id',chosenAdmin);if(e)Alert.alert('Eroare',e.message);else await loadPermissions();}}]);};
 const back=()=>{setError('');if(mode==='permissions'){goToMode('tables');return;}if(mode==='records'){goToMode('tables');return;}if(mode==='tables'){goToMode('databases');setDb(null);void loadDbs();return;}router.back();};
 const renderRow=(title:string,subtitle:string|undefined,onPress:()=>void,onEdit?:()=>void,onDelete?:()=>void)=>
  <View style={s.row}><TouchableOpacity style={{flex:1}} onPress={onPress}><Text style={s.rowTitle}>{title}</Text>{!!subtitle&&<Text style={s.muted} numberOfLines={2}>{subtitle}</Text>}</TouchableOpacity>{onEdit&&<TouchableOpacity onPress={onEdit} style={s.icon}><Ionicons name="pencil-outline" size={19} color={RED}/></TouchableOpacity>}{onDelete&&<TouchableOpacity onPress={onDelete} style={s.icon}><Ionicons name="trash-outline" size={19} color={RED}/></TouchableOpacity>}<Ionicons name="chevron-forward" size={18} color="#888"/></View>;
 const heading=mode==='databases'?'Baze de date':mode==='tables'?(db?.name||'Tabele'):mode==='permissions'?'Permisiuni':(table?.name||'Înregistrări');
 return <SafeAreaView style={s.page} edges={['top']}><View style={s.header}><TouchableOpacity accessibilityLabel="Înapoi" onPress={back} style={s.backButton}><Ionicons name="chevron-back" size={24} color="#171717"/></TouchableOpacity><View style={{flex:1}}><Text style={s.overline}>ADMINISTRARE</Text><Text style={s.title}>{heading}</Text></View></View>
 {loading?<ActivityIndicator color={RED} style={{marginTop:50}}/>:<ScrollView key={mode} ref={scrollRef} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 {!!error&&<Text style={s.error}>{error}</Text>}
 {mode==='databases'&&<>
 <View style={s.dbIntro}><View style={s.dbIntroIcon}><Ionicons name="server-outline" size={25} color={RED}/></View><View style={{flex:1}}><Text style={s.dbIntroTitle}>Spațiul tău de date</Text><Text style={s.dbIntroDescription}>Organizează informațiile în baze de date și tabele. Accesul este controlat prin permisiuni.</Text></View></View>
 <View style={s.dbOverview}><View><Text style={s.dbCount}>{dbs.length}</Text><Text style={s.dbCountCaption}>{dbs.length===1?'Bază de date disponibilă':'Baze de date disponibile'}</Text></View><Ionicons name="layers-outline" size={26} color="#B38B8B"/></View>
 {superAdmin&&<TouchableOpacity accessibilityRole="button" style={s.dbCreateButton} onPress={()=>begin('database')}><Ionicons name="add" size={23} color="#FFF"/><Text style={s.dbCreateText}>Bază de date nouă</Text></TouchableOpacity>}
 <View style={s.dbSearchBox}><Ionicons name="search-outline" size={21} color="#929292"/><TextInput accessibilityLabel="Caută baze de date" style={s.dbSearchInput} placeholder="Caută după nume sau descriere..." placeholderTextColor="#999" value={databaseSearch} onChangeText={setDatabaseSearch}/>{databaseSearch.length>0&&<TouchableOpacity accessibilityLabel="Șterge căutarea" onPress={()=>setDatabaseSearch('')}><Ionicons name="close-circle" size={20} color="#999"/></TouchableOpacity>}</View>
 <View style={s.dbSectionTitleRow}><Text style={s.dbSectionTitle}>Bazele tale de date</Text><Text style={s.dbSectionCount}>{dbs.filter(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(databaseSearch.trim().toLocaleLowerCase('ro'))).length}</Text></View>
 <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={dbs.filter(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(databaseSearch.trim().toLocaleLowerCase('ro'))).length>3} style={dbs.filter(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(databaseSearch.trim().toLocaleLowerCase('ro'))).length>3?s.dbListScroller:undefined} contentContainerStyle={s.dbListContent}>
 {dbs.filter(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(databaseSearch.trim().toLocaleLowerCase('ro'))).map(x=><View key={x.id} style={s.dbCard}><TouchableOpacity accessibilityRole="button" style={s.dbCardMain} onPress={()=>openDb(x)}><View style={s.dbCardIcon}><Ionicons name="folder-open-outline" size={25} color={RED}/></View><View style={{flex:1}}><Text style={s.dbCardName} numberOfLines={2}>{x.name}</Text><Text style={s.dbCardDescription} numberOfLines={2}>{x.description?.trim()||'Deschide pentru a gestiona tabelele și înregistrările'}</Text></View><Ionicons name="chevron-forward" size={20} color="#AAA"/></TouchableOpacity>{superAdmin&&<View style={s.dbCardActions}><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Editează ${x.name}`} onPress={()=>begin('database',x)} style={s.dbCardAction}><Ionicons name="create-outline" size={18} color={RED}/><Text style={s.dbCardActionText}>Editează</Text></TouchableOpacity><View style={s.dbActionDivider}/><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Arhivează ${x.name}`} onPress={()=>confirmDelete('database',x.id)} style={s.dbCardAction}><Ionicons name="archive-outline" size={18} color={RED}/><Text style={s.dbCardActionText}>Arhivează</Text></TouchableOpacity></View>}</View>)}
 </ScrollView>
 {!dbs.length&&<View style={s.dbEmpty}><Ionicons name="folder-open-outline" size={32} color="#A9A9A9"/><Text style={s.dbEmptyTitle}>Nu există baze de date</Text><Text style={s.dbEmptyText}>Bazele de date la care ai acces vor apărea aici.</Text></View>}
 {!!dbs.length&&!dbs.some(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(databaseSearch.trim().toLocaleLowerCase('ro')))&&<View style={s.dbEmpty}><Ionicons name="search-outline" size={30} color="#AAA"/><Text style={s.dbEmptyTitle}>Niciun rezultat</Text><Text style={s.dbEmptyText}>Încearcă un alt termen de căutare.</Text></View>}
 </>}
 {mode==='tables'&&<>
 <View style={s.dbIntro}><View style={s.dbIntroIcon}><Ionicons name="grid-outline" size={25} color={RED}/></View><View style={{flex:1}}><Text style={s.dbIntroTitle}>{db?.name}</Text><Text style={s.dbIntroDescription}>{db?.description||'Organizează informațiile în tabele, coloane și înregistrări.'}</Text></View></View>
 <View style={s.dbSectionTitleRow}><Text style={s.dbSectionTitle}>Tabele disponibile</Text><Text style={s.dbSectionCount}>{tables.length}</Text></View>
 {can('manage')&&<TouchableOpacity accessibilityRole="button" style={s.dbCreateButton} onPress={()=>begin('table')}><Ionicons name="add" size={23} color="#FFF"/><Text style={s.dbCreateText}>Tabel nou</Text></TouchableOpacity>}
 <View style={s.dbSearchBox}><Ionicons name="search-outline" size={21} color="#929292"/><TextInput accessibilityLabel="Caută tabele" style={s.dbSearchInput} placeholder="Caută tabele după nume..." placeholderTextColor="#999" value={tableSearch} onChangeText={setTableSearch}/>{!!tableSearch&&<TouchableOpacity onPress={()=>setTableSearch('')}><Ionicons name="close-circle" size={20} color="#999"/></TouchableOpacity>}</View>
 <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={tables.filter(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(tableSearch.trim().toLocaleLowerCase('ro'))).length>5} style={tables.filter(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(tableSearch.trim().toLocaleLowerCase('ro'))).length>5?s.tableListScroller:undefined} contentContainerStyle={s.dbListContent}>
 {tables.filter(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(tableSearch.trim().toLocaleLowerCase('ro'))).map(x=><View key={x.id} style={s.dbCard}>
  <TouchableOpacity accessibilityRole="button" style={s.dbCardMain} onPress={()=>openTable(x)}><View style={s.dbCardIcon}><Ionicons name="table-outline" size={25} color={RED}/></View><View style={{flex:1}}><Text style={s.dbCardName} numberOfLines={2}>{x.name}</Text><Text style={s.dbCardDescription} numberOfLines={2}>{x.description||'Deschide tabelul pentru a gestiona înregistrările'}</Text></View><Ionicons name="chevron-forward" size={20} color="#AAA"/></TouchableOpacity>
  {can('manage')&&<View style={s.dbCardActions}><TouchableOpacity accessibilityRole="button" style={s.dbCardAction} onPress={()=>begin('table',x)}><Ionicons name="create-outline" size={18} color={RED}/><Text style={s.dbCardActionText}>Editează</Text></TouchableOpacity><View style={s.dbActionDivider}/><TouchableOpacity accessibilityRole="button" disabled={!!duplicatingTable} style={s.dbCardAction} onPress={()=>duplicateTable(x)}><Ionicons name="copy-outline" size={18} color={RED}/><Text style={s.dbCardActionText}>{duplicatingTable===x.id?'Se copiază...':'Duplică'}</Text></TouchableOpacity><View style={s.dbActionDivider}/><TouchableOpacity accessibilityRole="button" style={s.dbCardAction} onPress={()=>confirmDelete('table',x.id)}><Ionicons name="trash-outline" size={18} color={RED}/><Text style={s.dbCardActionText}>Șterge</Text></TouchableOpacity></View>}
 </View>)}
 </ScrollView>
 {!tables.length&&<View style={s.dbEmpty}><Ionicons name="grid-outline" size={30} color="#AAA"/><Text style={s.dbEmptyTitle}>Nu există tabele</Text><Text style={s.dbEmptyText}>Adaugă primul tabel pentru a organiza datele.</Text></View>}
 {!!tables.length&&!tables.some(x=>`${x.name} ${x.description||''}`.toLocaleLowerCase('ro').includes(tableSearch.trim().toLocaleLowerCase('ro')))&&<View style={s.dbEmpty}><Ionicons name="search-outline" size={30} color="#AAA"/><Text style={s.dbEmptyTitle}>Niciun rezultat</Text></View>}

 </>}
 {mode==='records'&&<>
  <TextInput style={[s.input,{minHeight:46,paddingVertical:9}]} placeholder="Caută în toate coloanele..." placeholderTextColor="#999" value={search} onChangeText={setSearch}/>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={s.toolbarScroller} contentContainerStyle={s.toolbarContent}>
    <TouchableOpacity accessibilityRole="button" style={[s.controlButton,s.toolbarButton,panel==='sort'&&s.controlActive]} onPress={()=>setPanel(p=>p==='sort'?null:'sort')}><Ionicons name="swap-vertical-outline" size={17} color={RED}/><Text style={s.controlText}>Sortare{sortRules.length?` (${sortRules.length})`:''}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={[s.controlButton,s.toolbarButton,panel==='filter'&&s.controlActive]} onPress={()=>setPanel(p=>p==='filter'?null:'filter')}><Ionicons name="funnel-outline" size={17} color={RED}/><Text style={s.controlText}>Filtre{filterRules.length?` (${filterRules.length})`:''}</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={[s.controlButton,s.toolbarButton,panel==='columns'&&s.controlActive]} onPress={()=>setPanel(p=>p==='columns'?null:'columns')}><Ionicons name="options-outline" size={17} color={RED}/><Text style={s.controlText}>Coloane</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" style={[s.controlButton,s.toolbarButton,selectionMode&&s.controlActive]} onPress={()=>{setSelectionMode(v=>!v);setSelectedIds([]);}}><Ionicons name="checkbox-outline" size={18} color={RED}/><Text style={s.controlText}>{selectionMode?'Închide selecția':'Selectare multiplă'}</Text></TouchableOpacity>
   </ScrollView>
   {panel==='sort'&&<View style={s.toolPanel}>
    <Text style={s.toolTitle}>Sortare pe mai multe coloane</Text>
    {sortRules.map((rule,index)=><View key={rule.id} style={s.ruleCard}>
     <Text style={s.muted}>Prioritate {index+1}</Text>
     <ScrollView horizontal showsHorizontalScrollIndicator={false}>{fields.map(f=><TouchableOpacity key={f.id} style={[s.chip,rule.fieldId===f.id&&s.chipActive]} onPress={()=>setSortRules(prev=>prev.map(r=>r.id===rule.id?{...r,fieldId:f.id}:r))}><Text style={{color:rule.fieldId===f.id?'white':'#333'}}>{f.name}</Text></TouchableOpacity>)}</ScrollView>
     <View style={s.controlBar}><TouchableOpacity style={s.controlButton} onPress={()=>setSortRules(prev=>prev.map(r=>r.id===rule.id?{...r,ascending:!r.ascending}:r))}><Text style={s.controlText}>{rule.ascending?'↑ Crescător':'↓ Descrescător'}</Text></TouchableOpacity><TouchableOpacity onPress={()=>setSortRules(prev=>prev.filter(r=>r.id!==rule.id))}><Ionicons name="trash-outline" size={21} color={RED}/></TouchableOpacity></View>
    </View>)}
    <View style={s.controlBar}><TouchableOpacity style={s.controlButton} disabled={!fields.length} onPress={()=>setSortRules(prev=>[...prev,{id:newId(),fieldId:fields[0].id,ascending:true}])}><Text style={s.controlText}>+ Adaugă sortare</Text></TouchableOpacity><TouchableOpacity onPress={()=>setSortRules([])}><Text style={s.controlText}>Resetează</Text></TouchableOpacity></View>
   </View>}
   {panel==='filter'&&<View style={s.toolPanel}>
    <Text style={s.toolTitle}>Filtre avansate</Text>
    <Text style={s.muted}>Combină condițiile:</Text>
    <View style={s.controlBar}>{(['and','or'] as const).map(join=><TouchableOpacity key={join} style={[s.controlButton,filterJoin===join&&s.controlActive]} onPress={()=>setFilterJoin(join)}><Text style={s.controlText}>{join==='and'?'Toate (ȘI)':'Oricare (SAU)'}</Text></TouchableOpacity>)}</View>
    {filterRules.map(rule=><View key={rule.id} style={s.ruleCard}>
     <View style={s.controlBar}><Text style={[s.toolTitle,{flex:1,fontSize:14}]}>Condiție</Text><TouchableOpacity onPress={()=>setFilterRules(prev=>prev.filter(r=>r.id!==rule.id))}><Ionicons name="close-circle-outline" size={23} color={RED}/></TouchableOpacity></View>
     <ScrollView horizontal showsHorizontalScrollIndicator={false}>{fields.map(f=><TouchableOpacity key={f.id} style={[s.chip,rule.fieldId===f.id&&s.chipActive]} onPress={()=>setFilterRules(prev=>prev.map(r=>r.id===rule.id?{...r,fieldId:f.id}:r))}><Text style={{color:rule.fieldId===f.id?'white':'#333'}}>{f.name}</Text></TouchableOpacity>)}</ScrollView>
     <ScrollView horizontal showsHorizontalScrollIndicator={false}>{FILTER_OPERATORS.map(op=><TouchableOpacity key={op.key} style={[s.chip,rule.operator===op.key&&s.chipActive]} onPress={()=>setFilterRules(prev=>prev.map(r=>r.id===rule.id?{...r,operator:op.key}:r))}><Text style={{color:rule.operator===op.key?'white':'#333'}}>{op.label}</Text></TouchableOpacity>)}</ScrollView>
     {!['empty','not_empty'].includes(rule.operator)&&<TextInput style={s.input} placeholder="Valoare de comparat" placeholderTextColor="#999" value={rule.value} onChangeText={value=>setFilterRules(prev=>prev.map(r=>r.id===rule.id?{...r,value}:r))}/>}
    </View>)}
    <View style={s.controlBar}><TouchableOpacity style={s.controlButton} disabled={!fields.length} onPress={()=>setFilterRules(prev=>[...prev,{id:newId(),fieldId:fields[0].id,operator:'contains',value:''}])}><Text style={s.controlText}>+ Adaugă condiție</Text></TouchableOpacity><TouchableOpacity onPress={()=>setFilterRules([])}><Text style={s.controlText}>Șterge filtrele</Text></TouchableOpacity></View>
    <Text style={s.muted}>Căutarea, filtrele și sortarea se aplică paginii curente. Exportul filtrat aplică aceleași reguli întregului tabel.</Text>
   </View>}
   {panel==='columns'&&<View style={s.toolPanel}><Text style={s.toolTitle}>Afișare și ordine coloane</Text><Text style={s.muted}>Ascunde temporar coloanele de care nu ai nevoie. Datele rămân salvate.</Text>{fields.map(f=><View key={f.id} style={[s.controlBar,{justifyContent:'space-between',paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#F1F1F1'}]}><TouchableOpacity onPress={()=>setHiddenFieldIds(prev=>prev.includes(f.id)?prev.filter(id=>id!==f.id):[...prev,f.id])} style={{flex:1,flexDirection:'row',alignItems:'center',gap:9}}><Ionicons name={hiddenFieldIds.includes(f.id)?'eye-off-outline':'eye-outline'} size={20} color={hiddenFieldIds.includes(f.id)?'#999':RED}/><Text style={{flex:1,color:'#333'}} numberOfLines={1}>{f.name}</Text></TouchableOpacity>{can('manage')&&<><TouchableOpacity onPress={()=>void moveField(f,-1)}><Ionicons name="arrow-up-circle-outline" size={24} color={RED}/></TouchableOpacity><TouchableOpacity onPress={()=>void moveField(f,1)}><Ionicons name="arrow-down-circle-outline" size={24} color={RED}/></TouchableOpacity></>}</View>)}<TouchableOpacity onPress={()=>setHiddenFieldIds([])}><Text style={s.controlText}>Arată toate coloanele</Text></TouchableOpacity></View>}
   {selectionMode&&<View style={s.selectionBar}><Text style={{flex:1,color:'#333',fontWeight:'700'}}>{selectedIds.length} selectate</Text><TouchableOpacity accessibilityRole="button" onPress={()=>setSelectedIds(prev=>shownRecords.length>0&&shownRecords.every(r=>prev.includes(r.id))?prev.filter(id=>!shownRecords.some(r=>r.id===id)):[...new Set([...prev,...shownRecords.map(r=>r.id)])])}><Text style={{color:RED,fontWeight:'700',fontSize:12}}>{shownRecords.length>0&&shownRecords.every(r=>selectedIds.includes(r.id))?'Deselectează':'Selectează toate'}</Text></TouchableOpacity>{can('delete')&&<TouchableOpacity disabled={!selectedIds.length||bulkBusy} onPress={deleteSelected} style={[s.controlButton,{backgroundColor:selectedIds.length?RED:'#DDD'}]}><Ionicons name="trash-outline" size={17} color="#FFF"/><Text style={{color:'#FFF',fontWeight:'700'}}>{bulkBusy?'Se șterg...':'Șterge selectate'}</Text></TouchableOpacity>}</View>}

<View style={s.gridToolbar}>
   <View style={{flex:1}}><Text style={s.muted}>{totalRows} rânduri · {fields.length} coloane</Text></View>
   <TouchableOpacity accessibilityRole="button" accessibilityLabel="Import și export" onPress={()=>setDataMenuOpen(v=>!v)} style={s.smallGridTool}><Ionicons name="swap-vertical-outline" size={19} color={RED}/></TouchableOpacity>
   <TouchableOpacity accessibilityLabel="Reîncarcă tabelul" onPress={()=>table&&void openTable(table,page,pageSize)} style={s.smallGridTool}><Ionicons name="refresh-outline" size={19} color={RED}/></TouchableOpacity>
   {can('manage')&&<TouchableOpacity style={s.gridAction} onPress={()=>begin('field')}><Ionicons name="add-circle-outline" size={19} color={RED}/><Text style={s.gridActionText}>Coloană</Text></TouchableOpacity>}
   {can('create')&&<TouchableOpacity style={[s.gridAction,{backgroundColor:RED}]} onPress={()=>begin('record')}><Ionicons name="add" size={19} color="white"/><Text style={[s.gridActionText,{color:'white'}]}>Rând</Text></TouchableOpacity>}
 </View>
   {dataMenuOpen&&<View style={s.toolPanel}>
      <Text style={s.toolTitle}>Transfer de date</Text>
      {can('create')&&<TouchableOpacity style={s.menuAction} disabled={importBusy} onPress={()=>{setDataMenuOpen(false);void readImportFile();}}><Ionicons name="cloud-upload-outline" size={20} color={RED}/><Text style={s.menuActionText}>{importBusy?'Se citește...':'Importă Excel / CSV'}</Text></TouchableOpacity>}
      <Text style={s.muted}>Exportă toate rândurile</Text>
      <View style={s.menuActionRow}><TouchableOpacity style={s.menuActionHalf} disabled={exportBusy} onPress={()=>void exportData('xlsx',false)}><Text style={s.controlText}>Excel</Text></TouchableOpacity><TouchableOpacity style={s.menuActionHalf} disabled={exportBusy} onPress={()=>void exportData('csv',false)}><Text style={s.controlText}>CSV</Text></TouchableOpacity></View>
      <Text style={s.muted}>Exportă doar rezultatele filtrate</Text>
      <View style={s.menuActionRow}><TouchableOpacity style={s.menuActionHalf} disabled={exportBusy} onPress={()=>void exportData('xlsx',true)}><Text style={s.controlText}>Excel filtrat</Text></TouchableOpacity><TouchableOpacity style={s.menuActionHalf} disabled={exportBusy} onPress={()=>void exportData('csv',true)}><Text style={s.controlText}>CSV filtrat</Text></TouchableOpacity></View>
   </View>}
 <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator style={s.gridScroller} keyboardShouldPersistTaps="handled">
  <View style={{width:gridWidth,flexShrink:0}}>
   <View style={s.gridHeaderRow}>
     {selectionMode&&<View style={[s.gridNumberCell,s.gridHeaderCell]}><Ionicons name="checkbox-outline" size={20} color={RED}/></View>}
     <View style={[s.gridNumberCell,s.gridHeaderCell]}><Text style={s.gridHeaderText}>#</Text></View>
    {visibleFields.map(f=><TouchableOpacity key={f.id} disabled={!can('manage')} onPress={()=>begin('field',f)} onLongPress={()=>can('manage')&&confirmDelete('field',f.id)} style={[s.gridCell,s.gridHeaderCell]}>
     <Text numberOfLines={1} style={s.gridHeaderText}>{f.name}</Text><Text style={s.gridType}>{labels[f.field_type]||f.field_type}{can('manage')?' · ✎':''}</Text>
    </TouchableOpacity>)}
    {can('manage')&&<TouchableOpacity onPress={()=>begin('field')} style={[s.gridNumberCell,s.gridHeaderCell]}><Ionicons name="add" size={22} color={RED}/></TouchableOpacity>}
    {can('create')&&<View style={[s.gridNumberCell,s.gridHeaderCell]}/>}
    {can('delete')&&<View style={[s.gridNumberCell,s.gridHeaderCell]}/>}
   </View>
   <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={shownRecords.length>7} style={{maxHeight:7*60,flexGrow:0}} keyboardShouldPersistTaps="handled">
    {shownRecords.map((r,i)=><View key={r.id} style={[s.gridDataRow,i%2===1&&{backgroundColor:'#FAFAFC'}]}>
     {selectionMode&&<TouchableOpacity accessibilityLabel="Selectează rândul" onPress={()=>toggleSelection(r.id)} style={s.gridNumberCell}><Ionicons name={selectedIds.includes(r.id)?'checkbox':'square-outline'} size={22} color={RED}/></TouchableOpacity>}
    <TouchableOpacity style={s.gridNumberCell} onPress={()=>can('edit')?begin('record',r):undefined} onLongPress={()=>can('delete')&&confirmDelete('record',r.id)}><Text style={s.gridIndex}>{page*pageSize+i+1}</Text></TouchableOpacity>
    {visibleFields.map(f=>{const v=r.values_json?.[f.id];const display=['image','file'].includes(f.field_type)?`${attachmentsFor(r.id,f.id).length} atașamente`:f.field_type==='checkbox'?(v?'☑':'☐'):Array.isArray(v)?v.join(', '):f.field_type==='date'?displayRoDate(v)||'—':v===undefined||v===null||v===''?'—':String(v);return <TouchableOpacity key={f.id} disabled={!can('edit')&&!['image','file'].includes(f.field_type)} onPress={()=>editCell(r,f)} style={s.gridCell}><Text numberOfLines={2} style={[s.gridValue,f.field_type==='checkbox'&&{color:v?RED:'#999',fontSize:20}]}>{display}</Text></TouchableOpacity>})}
    {can('create')&&<TouchableOpacity accessibilityLabel="Duplică rândul" onPress={()=>void duplicateRow(r)} style={s.gridNumberCell}><Ionicons name="copy-outline" size={17} color={RED}/></TouchableOpacity>}
    {can('delete')&&<TouchableOpacity onPress={()=>confirmDelete('record',r.id)} style={s.gridNumberCell}><Ionicons name="trash-outline" size={17} color="#A61E22"/></TouchableOpacity>}
   </View>)}
   </ScrollView>
   {can('create')&&<TouchableOpacity style={s.gridNewRow} onPress={()=>begin('record')}><Ionicons name="add" size={19} color={RED}/><Text style={s.gridNewRowText}>Adaugă un rând nou</Text></TouchableOpacity>}
   {!records.length&&<View style={s.emptyState}><Ionicons name="grid-outline" size={27} color="#A1A1AA"/><Text style={s.emptyTitle}>Tabelul este gol</Text><Text style={s.emptyDescription}>{fields.length===0?'Adaugă prima coloană pentru a începe.':'Adaugă primul rând sau importă date.'}</Text>{can('create')&&<TouchableOpacity style={s.emptyAction} onPress={()=>begin('record')}><Ionicons name="add-circle-outline" size={17} color={RED}/><Text style={s.emptyActionText}>Adaugă primul rând</Text></TouchableOpacity>}</View>}
   {!!records.length&&!shownRecords.length&&<View style={s.emptyState}><Ionicons name="search-outline" size={27} color="#A1A1AA"/><Text style={s.emptyTitle}>Niciun rezultat</Text><Text style={s.emptyDescription}>Încearcă altă căutare sau elimină filtrele.</Text><TouchableOpacity style={s.emptyAction} onPress={()=>{setSearch('');setFilterRules([]);}}><Text style={s.emptyActionText}>Resetează căutarea și filtrele</Text></TouchableOpacity></View>}
  </View>
 </ScrollView>
 {totalRows>pageSize&&<>
   <View style={s.pagerBar}>
     <View style={s.pagerSizes}><Text style={s.pagerLabel}>Pe pagină</Text>{([25,50,100] as const).map(n=><TouchableOpacity key={n} onPress={()=>{setPageSize(n);void changePage(0,n);}} style={[s.pagerSize,pageSize===n&&s.pagerSizeActive]}><Text style={{fontSize:12,fontWeight:'700',color:pageSize===n?'#FFF':'#555'}}>{n}</Text></TouchableOpacity>)}</View>
     <View style={s.pagerNav}><TouchableOpacity accessibilityLabel="Pagina precedentă" disabled={page===0} onPress={()=>void changePage(page-1)} style={s.pagerArrow}><Ionicons name="chevron-back" size={18} color={page===0?'#CCC':RED}/></TouchableOpacity><Text style={s.pagerNumber}>{page+1}/{Math.max(1,Math.ceil(totalRows/pageSize))}</Text><TouchableOpacity accessibilityLabel="Pagina următoare" disabled={(page+1)*pageSize>=totalRows} onPress={()=>void changePage(page+1)} style={s.pagerArrow}><Ionicons name="chevron-forward" size={18} color={(page+1)*pageSize>=totalRows?'#CCC':RED}/></TouchableOpacity></View>
   </View>
</>}
 <TouchableOpacity style={s.helpToggle} onPress={()=>setTipsOpen(v=>!v)}><Ionicons name="help-circle-outline" size={17} color="#777"/><Text style={s.helpText}>{tipsOpen?"Ascunde instrucțiunile":"Cum editez tabelul?"}</Text><Ionicons name={tipsOpen?"chevron-up":"chevron-down"} size={15} color="#888"/></TouchableOpacity>{tipsOpen&&<Text style={s.gridFootnote}>Atinge o celulă pentru editare directă; atinge numărul rândului pentru formularul complet. Pictograma copiere duplică rândul. Atinge numele unei coloane pentru a-i modifica tipul. Ține apăsat pe antet pentru ștergerea coloanei (dacă ai dreptul „Gestionare”).</Text>}
 </>}
 {mode==='permissions'&&superAdmin&&<><Text style={s.hint}>Selectează administratorul</Text>{admins.length===0&&<Text style={s.empty}>Nu există administratori disponibili. Dacă ai un admin fără departament atribuit, acesta trebuie inclus în lista RPC de administratori.</Text>}{admins.map(a=><TouchableOpacity key={a.user_id} style={[s.row,chosenAdmin===a.user_id&&{borderColor:RED}]} onPress={()=>selectAdmin(a.user_id)}><Text style={s.rowTitle}>{a.full_name||a.email||`Administrator (${a.user_id.slice(0,8)})`}</Text></TouchableOpacity>)}{chosenAdmin&&<><Text style={s.hint}>Drepturi pentru administrator</Text>{accessLevels.map(l=><TouchableOpacity key={l.key} style={[s.row,{borderColor:levelOf(draftPerm)===l.key?RED:'#E5E7EB'}]} onPress={()=>setDraftPerm(permissionFor(chosenAdmin,l.key))}><Ionicons name={levelOf(draftPerm)===l.key?'radio-button-on':'radio-button-off'} size={22} color={RED}/><Text style={[s.rowTitle,{flex:1,marginLeft:10}]}>{l.label}</Text></TouchableOpacity>)}<Button title="Salvează permisiunile" onPress={()=>void savePermission()} disabled={saving}/>{permissions.some(p=>p.user_id===chosenAdmin)&&<Button title="Revocă accesul" danger onPress={revokePermission}/>}</>}</>}
 </ScrollView>}
   <Modal visible={importVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={()=>!importBusy&&setImportVisible(false)}>
    <SafeAreaView style={s.page}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>!importBusy&&setImportVisible(false)} style={s.backButton}><Ionicons name="close" size={24} color="#171717"/></TouchableOpacity>
        <View style={{flex:1}}><Text style={s.overline}>BAZE DE DATE</Text><Text style={s.title}>Import Excel / CSV</Text></View>
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.toolTitle}>{importFilename}</Text>
        <Text style={s.muted}>{importRows.length} rânduri · {importHeaders.length} coloane. Prima linie reprezintă antetele.</Text>
        <Text style={s.hint}>Asociază coloanele fișierului cu cele din MisiBi. Coloanele neasociate se ignoră.</Text>
        {importHeaders.map((header,index)=><View key={index} style={s.ruleCard}>
          <Text style={s.rowTitle}>{header}</Text>
          <Text style={s.muted}>Exemplu: {String(importRows[0]?.[index]??'—').slice(0,100)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
            <TouchableOpacity style={[s.chip,!importMapping[index]&&s.chipActive]} onPress={()=>setImportMapping(prev=>({...prev,[index]:''}))}><Text style={{color:!importMapping[index]?'white':'#333'}}>Ignoră</Text></TouchableOpacity>
            {fields.filter(f=>!['image','file'].includes(f.field_type)).map(f=><TouchableOpacity key={f.id} style={[s.chip,importMapping[index]===f.id&&s.chipActive]} onPress={()=>setImportMapping(prev=>{
              const next={...prev};Object.keys(next).forEach(k=>{if(next[Number(k)]===f.id)next[Number(k)]='';});next[index]=f.id;return next;
            })}><Text style={{color:importMapping[index]===f.id?'white':'#333'}}>{f.name}</Text></TouchableOpacity>)}
          </ScrollView>
        </View>)}
        <Text style={s.hint}>Previzualizare – primele 5 rânduri</Text>
        {importRows.slice(0,5).map((r,i)=><View key={i} style={s.ruleCard}><Text style={s.muted}>Rând {i+2}</Text><Text style={{color:'#222'}}>{importHeaders.map((h,j)=>`${h}: ${String(r[j]??'')}`).join(' · ').slice(0,400)}</Text></View>)}
        <Text style={s.muted}>Câmpurile Imagine și Fișier nu se importă automat. Importul adaugă rânduri noi, nu actualizează rânduri existente.</Text>
        <Button title={importBusy?'Se importă...':`Importă ${importRows.length} rânduri`} disabled={importBusy||!Object.values(importMapping).some(Boolean)} onPress={()=>void importData()}/>
        <Button title="Anulează" outline disabled={importBusy} onPress={()=>setImportVisible(false)}/>
      </ScrollView>
    </SafeAreaView>
  </Modal>
<Modal visible={cellEdit!==null} transparent animationType="fade" onRequestClose={()=>!cellSaving&&setCellEdit(null)}>
  <View style={s.cellOverlay}>
   <View style={s.cellCard}>
    <Text style={s.gridTitle}>{cellEdit?.field.name||'Editează celula'}</Text>
    {cellEdit&&(['image','file'].includes(cellEdit.field.field_type)?
     attachmentControls(cellEdit.row,cellEdit.field):
     ['single_select','multi_select'].includes(cellEdit.field.field_type)?
     <ScrollView style={{maxHeight:280}} keyboardShouldPersistTaps="handled"><View style={s.chips}>
      {(cellEdit.field.settings?.options||[]).map((option:string)=>{
       const multiple=cellEdit.field.field_type==='multi_select';
       const selected=multiple?(Array.isArray(cellValue)&&cellValue.includes(option)):cellValue===option;
       return <TouchableOpacity key={option} style={[s.chip,selected&&s.chipActive]} onPress={()=>setCellValue((old:any)=>multiple?(Array.isArray(old)?(old.includes(option)?old.filter((v:string)=>v!==option):[...old,option]):[option]):option)}><Text style={{color:selected?'white':'#333'}}>{option}</Text></TouchableOpacity>;
      })}
     </View></ScrollView>:
     <TextInput style={[s.input,cellEdit.field.field_type==='long_text'&&{minHeight:110,textAlignVertical:'top'}]} autoFocus value={cellValue==null?'':String(cellValue)} onChangeText={setCellValue} multiline={cellEdit.field.field_type==='long_text'} keyboardType={['number','currency'].includes(cellEdit.field.field_type)?'decimal-pad':'default'} placeholder={cellEdit.field.field_type==='date'?'ZZ.LL.AAAA':cellEdit.field.field_type==='time'?'HH:MM':'Introdu valoarea'}/>)}
    {cellEdit&&!['image','file'].includes(cellEdit.field.field_type)&&<>
     <Button title={cellSaving?'Se salvează...':'Salvează celula'} disabled={cellSaving} onPress={()=>void updateCell(cellEdit.row,cellEdit.field,cellValue)}/>
     <Button title="Golește celula" outline disabled={cellSaving} onPress={()=>void updateCell(cellEdit.row,cellEdit.field,null)}/>
    </>}
    <Button title="Închide" outline disabled={cellSaving} onPress={()=>setCellEdit(null)}/>
   </View>
  </View>
 </Modal>
    <Modal visible={viewerVisible} presentationStyle="fullScreen" animationType="slide" onRequestClose={closeViewer} statusBarTranslucent={false}>
    <View style={s.viewerPage}>
      <View style={[s.viewerHeader,{paddingTop:Math.max(insets.top,12)}]}>
        <View style={{flex:1,marginRight:12}}>
          <Text style={s.viewerTitle} numberOfLines={1}>{attachmentPreview?.name||'Previzualizare'}</Text>
          <Text style={s.viewerHint}>{attachmentPreview?.kind==='image'?'Apropie sau depărtează două degete pentru zoom':'PDF · folosește două degete pentru zoom'}</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Închide previzualizarea" onPress={closeViewer} style={s.viewerClose}>
          <Ionicons name="close" size={26} color="#FFF"/>
        </TouchableOpacity>
      </View>
      <View style={s.viewerBody} onLayout={e=>setViewerSize({width:e.nativeEvent.layout.width,height:e.nativeEvent.layout.height})}>
        {attachmentPreview?.kind==='image'&&<ScrollView
          key={'img-'+previewKey}
          style={{flex:1}}
          contentContainerStyle={{flexGrow:1,justifyContent:'center',alignItems:'center'}}
          minimumZoomScale={1}
          maximumZoomScale={5}
          bouncesZoom
          pinchGestureEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image source={{uri:attachmentPreview.uri}} resizeMode="contain" style={{width:viewerSize.width,height:viewerSize.height}}
            onLoadEnd={()=>setImageLoading(false)}
            onError={()=>{setImageLoading(false);setImageLoadError(true);}}/>
        </ScrollView>}
        {attachmentPreview?.kind==='pdf'&&<WebView
          key={'pdf-'+previewKey}
          source={{uri:attachmentPreview.uri}}
          style={{flex:1,backgroundColor:'#FFF'}}
          originWhitelist={['https://*']}
          scalesPageToFit
          onLoadEnd={()=>setImageLoading(false)}
          onError={()=>{setImageLoading(false);setImageLoadError(true);}}
          onHttpError={()=>{setImageLoading(false);setImageLoadError(true);}}
          startInLoadingState
          renderLoading={()=><View style={s.viewerLoader}><ActivityIndicator color={RED} size="large"/></View>}
        />}
        {imageLoading&&!imageLoadError&&<View pointerEvents="none" style={s.viewerLoader}><ActivityIndicator color="#FFF" size="large"/></View>}
        {imageLoadError&&<View style={s.viewerError}>
          <Text style={{color:'#FFF',textAlign:'center',marginBottom:12}}>Fișierul nu s-a putut afișa în aplicație.</Text>
          <TouchableOpacity onPress={()=>attachmentPreview&&Linking.openURL(attachmentPreview.uri).catch(()=>Alert.alert('Eroare','Nu se poate deschide linkul.'))} style={s.viewerFallback}>
            <Text style={{color:RED,fontWeight:'800'}}>Deschide în browser</Text>
          </TouchableOpacity>
        </View>}
      </View>
    </View>
  </Modal>
<Modal visible={dialog!==null} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent={false} navigationBarTranslucent={false} onRequestClose={()=>setDialog(null)}><View style={{flex:1}}><View style={[s.page,{paddingTop:Math.max(insets.top, 54),paddingBottom:insets.bottom}]}><View style={[s.header,s.modalHeader]}><TouchableOpacity accessibilityLabel="Închide" style={s.backButton} onPress={()=>setDialog(null)}><Ionicons name="close" size={24} color="#171717"/></TouchableOpacity><Text style={s.title}>{editingId?'Editează':'Adaugă'} {dialog==='database'?'bază de date':dialog==='table'?'tabel':dialog==='field'?'coloană':'înregistrare'}</Text></View><ScrollView ref={formScrollRef} style={{flex:1}} onScroll={e=>{formScrollY.current=e.nativeEvent.contentOffset.y;}} scrollEventThrottle={16} contentContainerStyle={[s.content,{paddingBottom:keyboardHeight>0?keyboardHeight+30:65}]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets={false}>
 {dialog!=='record'?<><Text style={s.label}>Nume</Text><TextInput onFocus={onFieldFocus} style={s.input} value={name} onChangeText={setName} placeholder="Introdu numele" placeholderTextColor="#9A9A9A"/>{dialog!=='field'&&<><Text style={s.label}>Descriere</Text><TextInput onFocus={onFieldFocus} style={[s.input,{minHeight:85}]} multiline value={description} onChangeText={setDescription} placeholder="Adaugă o descriere (opțional)" placeholderTextColor="#9A9A9A"/></>}{dialog==='database'&&superAdmin&&<View style={s.grantBox}><Text style={s.grantHeading}>Acces administratori</Text><Text style={s.grantInfo}>Alege administratorii care pot accesa această bază de date. Numai superadminul poate schimba aceste drepturi.</Text>{grantLoading?<ActivityIndicator color={RED}/>:grantAdmins.length===0?<Text style={s.muted}>Nu există administratori disponibili în lista de permisiuni.</Text>:grantAdmins.map(a=>{const selected=grantSelections[a.user_id];return <View key={a.user_id} style={s.grantCard}><TouchableOpacity style={s.grantTop} onPress={()=>toggleGrant(a.user_id)}><Ionicons name={selected?'checkbox':'square-outline'} size={24} color={selected?RED:'#777'}/><View style={s.adminIdentity}>{a.avatar_url?<Image source={{uri:a.avatar_url}} style={s.adminAvatar}/>:<View style={s.adminAvatarFallback}><Ionicons name="person-outline" size={21} color={RED}/></View>}<View style={{flex:1}}><Text style={s.adminName} numberOfLines={1}>{a.full_name||`Administrator (${a.user_id.slice(0,8)})`}</Text><Text style={s.adminEmail} numberOfLines={1}>{a.email||'E-mail indisponibil'}</Text></View></View></TouchableOpacity>{selected&&<View style={s.grantRights}>{accessLevels.map(l=><TouchableOpacity key={l.key} accessibilityRole="radio" accessibilityState={{selected:levelOf(selected)===l.key}} onPress={()=>setGrantLevel(a.user_id,l.key)} style={[s.grantRight,{borderColor:levelOf(selected)===l.key?RED:'#E5E7EB',borderWidth:1,borderRadius:12,padding:10,marginBottom:6}]}><Ionicons name={levelOf(selected)===l.key?'radio-button-on':'radio-button-off'} size={22} color={levelOf(selected)===l.key?RED:'#999'}/><View style={{flex:1,marginLeft:10}}><Text style={s.grantRightText}>{l.label}</Text><Text style={s.muted}>{l.detail}</Text></View></TouchableOpacity>)}</View>}</View>;})}</View>}{dialog==='field'&&<><Text style={s.label}>Tipul coloanei</Text><View style={s.chips}>{TYPES.map(t=><TouchableOpacity key={t} onPress={()=>setFieldType(t)} style={[s.chip,fieldType===t&&s.chipActive]}><Text style={{color:fieldType===t?'white':'#333'}}>{labels[t]}</Text></TouchableOpacity>)}</View>{['single_select','multi_select'].includes(fieldType)&&<><Text style={s.label}>Opțiuni (separate prin virgulă)</Text><TextInput onFocus={onFieldFocus} style={s.input} value={options} onChangeText={setOptions}/></>}</>}</>:fields.map(f=><View key={f.id}><Text style={s.label}>{f.name} • {labels[f.field_type]||f.field_type}</Text>{['image','file'].includes(f.field_type)?<View style={s.attachmentPlaceholder}><Ionicons name={f.field_type==='image'?'image-outline':'document-attach-outline'} size={22} color={RED}/><Text style={s.attachmentText}>Salvează mai întâi rândul, apoi atinge celula pentru a adăuga și gestiona atașamente private.</Text></View>:f.field_type==='checkbox'?<Switch value={!!values[f.id]} onValueChange={v=>setValues(p=>({...p,[f.id]:v}))}/>:['single_select','multi_select'].includes(f.field_type)?<View style={s.chips}>{(f.settings?.options||[]).map((o:string)=><TouchableOpacity key={o} style={[s.chip,(Array.isArray(values[f.id])?values[f.id].includes(o):values[f.id]===o)&&s.chipActive]} onPress={()=>setValues(p=>{if(f.field_type==='multi_select'){const arr=Array.isArray(p[f.id])?p[f.id]:[];return {...p,[f.id]:arr.includes(o)?arr.filter((x:string)=>x!==o):[...arr,o]};}return {...p,[f.id]:o};})}><Text style={{color:(Array.isArray(values[f.id])?values[f.id].includes(o):values[f.id]===o)?'white':'#333'}}>{o}</Text></TouchableOpacity>)}</View>:<TextInput onFocus={onFieldFocus} style={s.input} value={values[f.id]===undefined?'':String(values[f.id])} onChangeText={v=>setValues(p=>({...p,[f.id]:v}))} multiline={f.field_type==='long_text'} keyboardType={['number','currency'].includes(f.field_type)?'decimal-pad':'default'} placeholder={f.field_type==='date'?'ZZ.LL.AAAA (24.10.2026)':f.field_type==='time'?'HH:MM (14:30)':'Introdu valoarea'}/>}</View>)}
 <Button title={saving?'Se salvează...':'Salvează'} onPress={()=>void save()} disabled={saving||grantLoading}/><Button title="Anulează" outline onPress={()=>setDialog(null)}/>
 </ScrollView></View></View></Modal>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 dbIntro:{flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'#FCEEEE',borderRadius:20,padding:17},
 dbIntroIcon:{width:48,height:48,borderRadius:15,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},
 dbIntroTitle:{fontSize:17,fontWeight:'900',color:'#242424'},
 dbIntroDescription:{fontSize:12.5,color:'#755E5E',lineHeight:19,marginTop:4},
 dbOverview:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderRadius:20,padding:20},
 dbCount:{fontSize:32,fontWeight:'900',color:'#242424'},
 dbCountCaption:{fontSize:12,color:'#777',marginTop:3},
 dbCreateButton:{backgroundColor:RED,minHeight:53,borderRadius:16,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},
 dbCreateText:{fontSize:16,fontWeight:'800',color:'#FFF'},
 dbSearchBox:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#FFF',borderRadius:17,paddingHorizontal:15,minHeight:54},
 dbSearchInput:{flex:1,color:'#222',fontSize:15,paddingVertical:10},
 dbListScroller:{maxHeight:390},
 tableListScroller:{maxHeight:650},
 gridVerticalScroller:{maxHeight:60*8+48,flexGrow:0},
 adminIdentity:{flex:1,flexDirection:"row",alignItems:"center",gap:11},
 adminAvatar:{width:43,height:43,borderRadius:22,backgroundColor:"#F7EEEE"},
 adminAvatarFallback:{width:43,height:43,borderRadius:22,backgroundColor:"#FCEEEE",alignItems:"center",justifyContent:"center"},
 adminName:{fontSize:15,fontWeight:"800",color:"#222"},
 adminEmail:{fontSize:12,color:"#888",marginTop:3},
 dbListContent:{gap:12},
 dbSectionTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:9},
 dbSectionTitle:{fontSize:18,fontWeight:'900',color:'#222'},
 dbSectionCount:{fontSize:13,fontWeight:'800',color:RED,backgroundColor:'#FCEEEE',overflow:'hidden',borderRadius:15,paddingHorizontal:12,paddingVertical:7},
 dbCard:{backgroundColor:'#FFF',borderRadius:20,overflow:'hidden',borderWidth:1,borderColor:'#F0EBEB'},
 dbCardMain:{flexDirection:'row',alignItems:'center',gap:13,padding:17,minHeight:94},
 dbCardIcon:{width:54,height:54,borderRadius:17,backgroundColor:'#FCEEEE',alignItems:'center',justifyContent:'center'},
 dbCardName:{fontSize:17,fontWeight:'900',color:'#202020'},
 dbCardDescription:{fontSize:12.5,color:'#888',marginTop:5,lineHeight:18},
 dbCardActions:{flexDirection:'row',borderTopWidth:1,borderTopColor:'#F2EEEE',minHeight:44},
 dbCardAction:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:11},
 dbCardActionText:{fontSize:13,fontWeight:'700',color:RED},
 dbActionDivider:{width:1,backgroundColor:'#F2EEEE'},
 dbEmpty:{backgroundColor:'#FFF',borderRadius:20,padding:26,alignItems:'center',gap:8},
 dbEmptyTitle:{fontSize:16,fontWeight:'800',color:'#333'},
 dbEmptyText:{fontSize:13,color:'#888',textAlign:'center'},searchWrap:{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:15,borderWidth:1,borderColor:'#E1E1E1',paddingHorizontal:13,minHeight:48,gap:9},searchInput:{flex:1,fontSize:15,color:'#222',paddingVertical:10},searchClear:{padding:3},smallGridTool:{width:36,height:38,borderWidth:1,borderColor:'#E5E5E5',borderRadius:11,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},emptyAction:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:9,backgroundColor:'#FFF5F5',borderRadius:10,marginTop:4},emptyActionText:{color:RED,fontSize:12,fontWeight:'700'},compactActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},compactPrimary:{paddingVertical:9,minHeight:42},compactCount:{fontSize:11,color:'#777',flexShrink:1,textAlign:'right'},menuAction:{backgroundColor:'#FFF8F8',borderWidth:1,borderColor:'#F0DADA',borderRadius:12,padding:13,flexDirection:'row',alignItems:'center',gap:10},menuActionText:{color:RED,fontSize:14,fontWeight:'700'},menuActionRow:{flexDirection:'row',gap:8},menuActionHalf:{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:11,borderWidth:1,borderColor:'#E7E7E7',borderRadius:11,backgroundColor:'#FFF'},pagerBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},pagerSizes:{flexDirection:'row',alignItems:'center',gap:4},pagerLabel:{fontSize:11,color:'#777',marginRight:3},pagerSize:{minWidth:29,height:32,paddingHorizontal:5,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF',borderWidth:1,borderColor:'#E5E5E5',borderRadius:9},pagerSizeActive:{backgroundColor:RED,borderColor:RED},pagerNav:{flexDirection:'row',alignItems:'center',gap:3},pagerArrow:{width:31,height:32,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF',borderRadius:9,borderWidth:1,borderColor:'#E5E5E5'},pagerNumber:{fontSize:12,color:'#555',minWidth:28,textAlign:'center'},emptyState:{width:270,alignItems:'center',justifyContent:'center',paddingHorizontal:22,paddingVertical:28,gap:8},emptyTitle:{fontSize:15,fontWeight:'800',color:'#333'},emptyDescription:{fontSize:12,color:'#888',textAlign:'center',lineHeight:18,maxWidth:235},helpToggle:{flexDirection:'row',alignItems:'center',gap:7,paddingVertical:8},helpText:{fontSize:12,color:'#777',fontWeight:'600'},viewerPage:{flex:1,backgroundColor:'#0D0F13'},viewerHeader:{paddingHorizontal:16,paddingBottom:14,flexDirection:'row',alignItems:'center',backgroundColor:'#17191E'},viewerTitle:{fontSize:16,fontWeight:'800',color:'#FFF'},viewerHint:{fontSize:11,color:'#BFC2C9',marginTop:4},viewerClose:{width:44,height:44,borderRadius:22,backgroundColor:'#343740',justifyContent:'center',alignItems:'center'},viewerBody:{flex:1,backgroundColor:'#0D0F13'},viewerLoader:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},viewerError:{position:'absolute',bottom:35,left:20,right:20,backgroundColor:'#252830',borderRadius:14,padding:18,alignItems:'center'},viewerFallback:{backgroundColor:'#FFF',paddingVertical:12,paddingHorizontal:20,borderRadius:12},toolbarScroller:{flexGrow:0,marginHorizontal:-20},toolbarContent:{paddingHorizontal:20,alignItems:'center',gap:8,paddingVertical:2},toolbarButton:{minHeight:42,flexShrink:0},controlBar:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:9},controlButton:{flexDirection:'row',alignItems:'center',gap:5,paddingVertical:10,paddingHorizontal:12,backgroundColor:'#FFF',borderWidth:1,borderColor:'#E7E7E7',borderRadius:12},controlActive:{borderColor:RED,backgroundColor:'#FFF1F1'},controlText:{color:RED,fontWeight:'700',fontSize:13},toolPanel:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#EEE',borderRadius:16,padding:13,gap:12},toolTitle:{fontSize:16,fontWeight:'800',color:'#222'},ruleCard:{borderWidth:1,borderColor:'#E8E8E8',borderRadius:12,padding:10,gap:9},selectionBar:{flexDirection:'row',alignItems:'center',gap:8,padding:10,backgroundColor:'#FFF1F1',borderRadius:12},cellOverlay:{flex:1,backgroundColor:'rgba(0,0,0,.45)',justifyContent:'center',padding:20},cellCard:{backgroundColor:'#FFF',borderRadius:20,padding:20,gap:12,maxHeight:'85%'},gridToolbar:{flexDirection:'row',alignItems:'center',gap:7,marginTop:8,marginBottom:8},gridTitle:{fontSize:19,fontWeight:'900',color:'#161616'},gridAction:{borderWidth:1,borderColor:'#E5E5E5',backgroundColor:'#FFF',paddingHorizontal:10,paddingVertical:10,borderRadius:12,flexDirection:'row',alignItems:'center',gap:4},gridActionText:{fontWeight:'800',fontSize:12,color:RED},gridScroller:{borderWidth:1,borderColor:'#E4E4E4',borderRadius:12,backgroundColor:'#FFF',flexGrow:0},gridHeaderRow:{flexDirection:'row',flexWrap:'nowrap',height:60,backgroundColor:'#F2F3F5'},gridDataRow:{flexDirection:'row',flexWrap:'nowrap',height:60,backgroundColor:'#FFF'},gridCell:{width:170,minHeight:60,paddingHorizontal:12,paddingVertical:9,borderRightWidth:1,borderBottomWidth:1,borderColor:'#E7E7E7',justifyContent:'center'},gridNumberCell:{width:48,minHeight:60,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderBottomWidth:1,borderColor:'#E7E7E7'},gridHeaderCell:{backgroundColor:'#F2F3F5'},gridHeaderText:{fontSize:13,fontWeight:'900',color:'#202124'},gridType:{fontSize:10,color:'#7B7B7B',marginTop:3},gridValue:{fontSize:13,color:'#222'},gridIndex:{color:'#777',fontWeight:'700'},gridNewRow:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:15},gridNewRowText:{color:RED,fontWeight:'700'},gridEmpty:{padding:20,color:'#888'},gridFootnote:{fontSize:12,color:'#777',lineHeight:18,marginTop:8},attachmentPlaceholder:{backgroundColor:'#FFF4F4',borderRadius:12,padding:15,flexDirection:'row',alignItems:'center',gap:10},attachmentText:{fontSize:13,color:'#6B3434',flex:1},grantBox:{marginTop:16,gap:10},grantHeading:{fontSize:19,fontWeight:'900',color:'#171717'},grantInfo:{fontSize:13,color:'#666',lineHeight:20},grantCard:{backgroundColor:'#FFF',borderRadius:16,borderWidth:1,borderColor:'#E5E5E5',padding:14,gap:10},grantTop:{flexDirection:'row',alignItems:'center',gap:10,minHeight:38},grantRights:{borderTopWidth:1,borderTopColor:'#EEE',paddingTop:8},grantRight:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:49},grantRightText:{fontSize:14,fontWeight:'700',color:'#333',flex:1},backButton:{width:44,height:44,borderRadius:14,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},modalHeader:{paddingBottom:22,minHeight:90},page:{flex:1,backgroundColor:'#F6F6F6'},header:{
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),flexDirection:'row',alignItems:'center',paddingHorizontal:15,paddingTop:12,paddingBottom:15,gap:13,backgroundColor:'#F6F6F6'},overline:{fontSize:9,color:RED,fontWeight:'900',letterSpacing:1},title:{fontSize: 27,fontWeight:'900',color:'#171717',marginTop:1,flexShrink:1},content:{ ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),paddingHorizontal:20,paddingTop:18,paddingBottom:65,gap:14},button:{minHeight:46,paddingHorizontal:18,paddingVertical:11,borderRadius:14,backgroundColor:RED,alignItems:'center',justifyContent:'center',alignSelf:'flex-start',marginBottom:3},outline:{backgroundColor:'#FFF',borderWidth:1,borderColor:RED},buttonText:{color:'#FFF',fontWeight:'700',fontSize:15},row:{backgroundColor:'#FFF',padding:16,minHeight:64,borderRadius:16,borderWidth:1,borderColor:'#EEE',flexDirection:'row',alignItems:'center',gap:10,marginBottom:6},rowTitle:{fontSize:16,fontWeight:'800',color:'#171717'},muted:{fontSize:12,color:'#777',marginTop:4},hint:{fontSize:14,fontWeight:'800',color:'#555',marginTop:14},empty:{textAlign:'center',color:'#777',marginTop:28},icon:{padding:6},label:{fontSize:15,fontWeight:'800',color:'#333',marginTop:12},input:{backgroundColor:'#FFF',borderRadius:16,borderWidth:1,borderColor:'#E1E1E1',padding:16,minHeight:54,fontSize:16,color:'#222'},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{borderRadius:8,padding:10,backgroundColor:'#FFF',borderWidth:1,borderColor:'#DDD'},chipActive:{backgroundColor:RED,borderColor:RED},error:{color:RED,backgroundColor:'#FDEAEA',padding:12,borderRadius:8}});
