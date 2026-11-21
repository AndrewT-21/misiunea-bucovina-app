import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, useWindowDimensions, View, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../../lib/platform-alert';
import { supabase } from '../../lib/supabase';
const RED = '#A61E22';
const isFixedLeader = (name: string) => ['emanuel ursachi', 'daniel ursachi'].includes(name.trim().toLocaleLowerCase('ro-RO'));
const leaderRank = (name: string) => name.trim().toLocaleLowerCase('ro-RO') === 'daniel ursachi' ? 0 : 1;
const CROP_W = 280;
const CROP_H = 350;
const OUTPUT_W = 800;
const OUTPUT_H = 1000;
type CropAsset = { uri: string; width: number; height: number; base64: string; mimeType?: string | null };
// Aceeasi geometrie este folosita la previzualizare si la exportul final.
function cropGeometry(asset: CropAsset, zoom: number, offsetX: number, offsetY: number) {
  const baseScale = Math.max(CROP_W / asset.width, CROP_H / asset.height);
  const scaledW = asset.width * baseScale * zoom;
  const scaledH = asset.height * baseScale * zoom;
  const extraX = Math.max(0, (scaledW - CROP_W) / 2);
  const extraY = Math.max(0, (scaledH - CROP_H) / 2);
  return { scaledW, scaledH, left: (CROP_W - scaledW) / 2 + offsetX * extraX, top: (CROP_H - scaledH) / 2 + offsetY * extraY };
}
async function cropWebImage(asset: CropAsset, zoom: number, offsetX: number, offsetY: number): Promise<string> {
  const doc = (globalThis as any).document;
  const BrowserImage = (globalThis as any).Image;
  if (!doc || !BrowserImage) throw new Error('Editorul web nu este disponibil.');
  const image: any = new BrowserImage();
  const src = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Fotografia nu poate fi deschisa.'));
    image.src = src;
  });
  const canvas: any = doc.createElement('canvas');
  canvas.width = OUTPUT_W;
  canvas.height = OUTPUT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Nu pot crea fotografia decupata.');
  const g = cropGeometry(asset, zoom, offsetX, offsetY);
  const factor = OUTPUT_W / CROP_W;
  ctx.drawImage(image, g.left * factor, g.top * factor, g.scaledW * factor, g.scaledH * factor);
  return canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
}
type Profile = { id: string; display_name: string; role: string; photo_url: string | null; featured: boolean; is_new: boolean; is_published: boolean; new_until: string | null; sort_order: number; photo_zoom: number; photo_position_x: number; photo_position_y: number };
const blank = (): Profile => ({ id: '', display_name: '', role: 'Voluntar', photo_url: null, featured: false, is_new: false, is_published: false, new_until: null, sort_order: 0, photo_zoom: 1, photo_position_x: 0, photo_position_y: 0 });
export default function VolunteerDirectoryAdmin() {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  // Măsurăm spațiul efectiv disponibil, nu lățimea ferestrei: containerul
  // poate avea padding suplimentar în layouturile mobile / web.
  const [directoryWidth, setDirectoryWidth] = useState(0);
  const availableWidth = directoryWidth || Math.max(0, Math.min(viewportWidth, 1320) - 36);
  const galleryColumns = availableWidth >= 1140 ? 5 : availableWidth >= 820 ? 4 : availableWidth >= 580 ? 3 : 2;
  const galleryGap = 12;
  const galleryInnerWidth = Math.max(0, availableWidth - 22); // 10px padding pe fiecare parte + border
  const galleryCardWidth = Math.max(0, (galleryInnerWidth - galleryGap * (galleryColumns - 1)) / galleryColumns);
  // Înălțimea este aceeași pentru fiecare card; viewportul arată exact două rânduri.
  const galleryCardHeight = Math.ceil(Math.max(0, galleryCardWidth - 18) * 1.25 + 118);
  const galleryViewportHeight = galleryCardHeight * 2 + galleryGap + 22;
  const mainScrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const [allowed,setAllowed] = useState(false);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [items,setItems] = useState<Profile[]>([]);
  const [editing,setEditing] = useState<Profile | null>(null);
  const [positionEditor,setPositionEditor] = useState(false);
  const [photoFrameWidth,setPhotoFrameWidth] = useState(280);
  const dragOrigin = useRef({x:0,y:0});
  const editingRef = useRef<Profile | null>(null);
  editingRef.current = editing;
  const panResponder = useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant:()=>{ const p=editingRef.current; dragOrigin.current={x:p?.photo_position_x??0,y:p?.photo_position_y??0}; },
    onPanResponderMove:(_,gesture)=>{
      const scale=Math.max(1,photoFrameWidth);
      const clamp=(n:number)=>Math.max(-1,Math.min(1,n));
      setEditing(old=>old?{...old,photo_position_x:clamp(dragOrigin.current.x+gesture.dx/scale*2),photo_position_y:clamp(dragOrigin.current.y+gesture.dy/(scale*1.25)*2)}:old);
    }
  }),[photoFrameWidth]);
  const [cropAsset,setCropAsset] = useState<CropAsset | null>(null);
  const [cropZoom,setCropZoom] = useState(1);
  const [cropX,setCropX] = useState(0);
  const [cropY,setCropY] = useState(0);
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState<'all'|'published'|'draft'>('all');
  const [error,setError] = useState('');
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('volunteer_public_profiles').select('id,display_name,role,photo_url,featured,is_new,is_published,new_until,sort_order,photo_zoom,photo_position_x,photo_position_y').order('sort_order', {ascending:true});
    if (error) throw error;
    setItems((data ?? []) as Profile[]);
  },[]);
  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError('');
      try {
        const {data:{user}} = await supabase.auth.getUser();
        if (!user) throw new Error('Autentifică-te pentru a administra voluntarii.');
        const {data:admin,error:adminError} = await supabase.from('admins').select('role').eq('user_id',user.id).maybeSingle();
        if (adminError) throw adminError;
        let canEdit = admin?.role === 'super_admin';
        if (!canEdit && admin?.role === 'admin') {
          const {data:perms,error:permsError} = await supabase.rpc('misibi_my_admin_permissions');
          if (permsError) throw permsError;
          canEdit = ((perms ?? []) as {department_slug:string;can_edit:boolean}[]).some(p=>p.department_slug==='voluntariat' && p.can_edit);
        }
        if (!alive) return;
        setAllowed(canEdit);
        if (canEdit) await refresh();
      } catch(e:any) { if(alive) setError(e.message || 'Nu am putut încărca datele.'); }
      finally {if(alive) setLoading(false);}
    })();
    return () => {alive=false;};
  },[refresh]));
  const update = (patch:Partial<Profile>) => setEditing(old=>old ? {...old,...patch}:old);
  async function uploadPhoto() {
    if (!editing || saving) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 1, base64: true,
        // Pe iOS/Android editorul sistemului permite alegerea cadrului 4:5.
        allowsEditing: Platform.OS !== 'web', aspect: [4, 5],
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64 || !asset.width || !asset.height) throw new Error('Fotografia nu a putut fi citita.');
      if (Platform.OS === 'web') {
        setCropZoom(1); setCropX(0); setCropY(0);
        setCropAsset({uri: asset.uri, width: asset.width, height: asset.height, base64: asset.base64, mimeType: asset.mimeType});
      } else {
        await sendPhoto(asset.base64, asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg');
      }
    } catch (e:any) { Alert.alert('Eroare fotografie', e.message || 'Selectarea a esuat.'); }
  }
  async function sendPhoto(base64: string, type: string) {
    setSaving(true);
    try {
      const ext = type === 'image/png' ? 'png' : 'jpg';
      const path = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const {error} = await supabase.storage.from('volunteer-directory').upload(path, decode(base64), {contentType:type, upsert:false});
      if (error) throw error;
      const {data} = supabase.storage.from('volunteer-directory').getPublicUrl(path);
      update({photo_url:data.publicUrl});
      setCropAsset(null);
    } catch(e:any) { Alert.alert('Eroare fotografie', e.message || 'Incarcarea a esuat.'); }
    finally {setSaving(false);}
  }
  async function confirmCrop() {
    if (!cropAsset || saving) return;
    try {
      const croppedBase64 = await cropWebImage(cropAsset, cropZoom, cropX, cropY);
      await sendPhoto(croppedBase64, 'image/jpeg');
    } catch(e:any) { Alert.alert('Eroare decupare', e.message || 'Decuparea a esuat.'); }
  }
  async function save() {
    if(!editing || saving || !allowed) return;
    if(!editing.display_name.trim()) {Alert.alert('Câmp obligatoriu','Completează numele voluntarului.');return;}
    setSaving(true);
    try {
      // Data se setează numai la prima publicare ca «voluntar nou»; editările nu reîncep cele 7 zile.
      const existing = items.find(item => item.id === editing.id);
      const newlyEnabled = editing.is_new && !existing?.is_new;
      const firstPublication = editing.is_published && !existing?.is_published;
      const newUntil = !editing.is_new ? null :
        (editing.is_published && (newlyEnabled || firstPublication) && !existing?.new_until)
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : (editing.new_until ?? null);
      const row = {display_name:editing.display_name.trim(),role:editing.role.trim()||'Voluntar',photo_url:editing.photo_url,featured:editing.featured,is_new:editing.is_new,is_published:editing.is_published,new_until:newUntil,sort_order:Number(editing.sort_order)||0,photo_zoom:editing.photo_zoom??1,photo_position_x:editing.photo_position_x??0,photo_position_y:editing.photo_position_y??0};
      const result = editing.id ? await supabase.from('volunteer_public_profiles').update(row).eq('id',editing.id).select('id').single() : await supabase.from('volunteer_public_profiles').insert(row).select('id').single();
      if(result.error) throw result.error;
      await refresh(); setEditing(null); 
      Alert.alert('Salvat','Profilul voluntarului a fost salvat.');
    } catch(e:any) {Alert.alert('Eroare salvare',e.message || 'Nu am putut salva.');}
    finally {setSaving(false);}
  }
  // Reordonarea folosește coloana sort_order existentă, fără migrare SQL.
  async function moveVolunteer(direction: -1 | 1) {
    if (!editing?.id || saving || !allowed || isFixedLeader(editing.display_name)) return;
    const group = items.filter(p => p.featured === editing.featured && !isFixedLeader(p.display_name)).sort((a,b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name));
    const index = group.findIndex(p => p.id === editing.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= group.length) return;
    const next = [...group];
    [next[index], next[target]] = [next[target], next[index]];
    await persistOrder(next, editing.id);
  }
  async function placeVolunteer(targetId: string, after: boolean) {
    if (!editing?.id || saving || !allowed || isFixedLeader(editing.display_name) || !targetId || targetId === editing.id) return;
    const group = items.filter(p => p.featured === editing.featured && !isFixedLeader(p.display_name)).sort((a,b) => a.sort_order - b.sort_order || a.display_name.localeCompare(b.display_name));
    const selected = group.find(p => p.id === editing.id);
    if (!selected) return;
    const next = group.filter(p => p.id !== editing.id);
    const targetIndex = next.findIndex(p => p.id === targetId);
    if (targetIndex < 0) return;
    next.splice(targetIndex + (after ? 1 : 0), 0, selected);
    await persistOrder(next, editing.id);
  }
  async function persistOrder(ordered: Profile[], selectedId: string) {
    setSaving(true);
    try {
      // Actualizăm doar membrii aceleiași secțiuni; ordinea publică este sort_order ASC.
      const results = await Promise.all(ordered.map((p, i) => supabase.from('volunteer_public_profiles').update({sort_order: (i + 1) * 10}).eq('id', p.id)));
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
      await refresh();
      setEditing(old => old?.id === selectedId ? {...old, sort_order: (ordered.findIndex(p => p.id === selectedId) + 1) * 10} : old);
      Alert.alert('Ordine salvată', 'Noua ordine este vizibilă și în pagina publică.');
    } catch (e: any) {
      try { await refresh(); } catch (_) {}
      Alert.alert('Eroare la reordonare', (e.message || 'Nu am putut salva ordinea.') + ' Verifică ordinea înainte de a încerca din nou.');
    } finally { setSaving(false); }
  }
  function remove() {
    if(!editing?.id || !allowed) return;
    Alert.alert('Ștergi profilul?', 'Profilul va fi eliminat din directorul public. Această acțiune elimină doar profilul public.',[
      {text:'Anulează',style:'cancel'},
      {text:'Șterge',style:'destructive',onPress:async()=>{
        setSaving(true);
        const {error}=await supabase.from('volunteer_public_profiles').delete().eq('id',editing.id);
        if(error) Alert.alert('Eroare',error.message);
        else {setEditing(null);try {await refresh();}catch(e:any){Alert.alert('Eroare',e.message);}}
        setSaving(false);
      }}
    ]);
  }
  const visibleItems = items.filter(item => (filter === 'all' || (filter === 'published' ? item.is_published : !item.is_published)) && `${item.display_name} ${item.role}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const leaders = visibleItems.filter(item => isFixedLeader(item.display_name)).sort((a,b) => leaderRank(a.display_name)-leaderRank(b.display_name));
  const regularFeatured = visibleItems.filter(item => item.featured && !isFixedLeader(item.display_name));
  const regularOthers = visibleItems.filter(item => !item.featured && !isFixedLeader(item.display_name));
  const renderVolunteerCard = (item: Profile) => <TouchableOpacity key={item.id} style={[s.galleryCard,{width:galleryCardWidth,height:galleryCardHeight}]} onPress={()=>setEditing({...item})}>
    {item.photo_url ? <Image source={{uri:item.photo_url}} style={s.galleryPhoto}/> : <View style={s.galleryPlaceholder}><Ionicons name="person" color="#C9A5A6" size={42}/></View>}
    <Text style={s.galleryName} numberOfLines={2}>{item.display_name}</Text><Text style={s.galleryRole} numberOfLines={2}>{item.role}</Text>
    <View style={[s.statusPill,!item.is_published&&s.statusPillDraft]}><Text style={[s.galleryStatus,!item.is_published&&s.galleryStatusDraft]}>{item.is_published?'● Publicat':'○ Nepublicat'}</Text></View>
  </TouchableOpacity>;
  const renderVolunteerSection = (title:string, group:Profile[], nextSection?: string) => group.length > 0 ? <View style={s.directorySection} onLayout={event => { sectionOffsets.current[title] = event.nativeEvent.layout.y; }}>
    <View style={s.sectionHeading}><Text style={s.sectionTitle}>{title}</Text><Text style={s.orderScrollHint}>Derulează lista ↓</Text></View>
    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={[s.directoryScroll,{height:galleryViewportHeight}]} contentContainerStyle={s.directoryScrollContent} keyboardShouldPersistTaps="handled">
      <View style={s.gallery}>{group.map(renderVolunteerCard)}</View>
    </ScrollView>
    {nextSection && <TouchableOpacity style={s.continuePage} onPress={() => { const offset = sectionOffsets.current[nextSection]; if (offset !== undefined) mainScrollRef.current?.scrollTo({y:Math.max(0,offset-12),animated:true}); }}><Text style={s.continuePageText}>Continuă la {nextSection.toLocaleLowerCase('ro-RO')}</Text><Ionicons name="arrow-down" size={16} color={RED}/></TouchableOpacity>}
    {title === 'Toți voluntarii' && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Înapoi sus, la începutul paginii" style={s.continuePage} onPress={() => mainScrollRef.current?.scrollTo({y:0,animated:true})}><Text style={s.continuePageText}>Înapoi sus</Text><Ionicons name="arrow-up" size={16} color={RED}/></TouchableOpacity>}
  </View> : null;
  const field=(label:string,value:string,onChange:(s:string)=>void,multiline=false)=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput style={[s.input,multiline&&{minHeight:75}]} value={value} onChangeText={onChange} multiline={multiline} placeholder={label}/></View>;
  const toggle=(label:string,value:boolean,key:'featured'|'is_new'|'is_published')=><View style={s.toggle}><Text style={s.label}>{label}</Text><Switch value={value} onValueChange={v=>update({[key]:v})} trackColor={{true:'#36B983'}}/></View>;
  const geometry = cropAsset ? cropGeometry(cropAsset, cropZoom, cropX, cropY) : null;
  return <SafeAreaView edges={['top']} style={s.root}>
    <Modal visible={!!cropAsset} transparent animationType="fade" onRequestClose={()=>!saving&&setCropAsset(null)}>
      <View style={s.cropOverlay}><View style={s.cropDialog}>
        <Text style={s.cardTitle}>Alege cadrul fotografiei</Text>
        <Text style={s.cropHelp}>Fotografia va fi salvata exact cum apare in cadrul 4:5.</Text>
        {cropAsset && geometry && <View style={s.cropFrame}>
          <Image source={{uri:cropAsset.uri}} resizeMode="stretch" style={{position:'absolute',width:geometry.scaledW,height:geometry.scaledH,left:geometry.left,top:geometry.top}} />
        </View>}
        <Text style={s.cropLabel}>Marire: {Math.round(cropZoom*100)}%</Text>
        <View style={s.cropControls}>
          <TouchableOpacity style={s.cropControl} onPress={()=>setCropZoom(v=>Math.max(1,Math.round((v-0.1)*10)/10))}><Ionicons name="remove" size={24} color={RED}/></TouchableOpacity>
          <TouchableOpacity style={s.cropControl} onPress={()=>setCropZoom(v=>Math.min(3,Math.round((v+0.1)*10)/10))}><Ionicons name="add" size={24} color={RED}/></TouchableOpacity>
        </View>
        <Text style={s.cropLabel}>Muta fotografia in cadru</Text>
        <View style={s.cropControls}>
          <TouchableOpacity style={s.cropControl} onPress={()=>setCropX(v=>Math.max(-1,+(v-0.1).toFixed(2)))}><Ionicons name="arrow-back" size={22} color={RED}/></TouchableOpacity>
          <TouchableOpacity style={s.cropControl} onPress={()=>setCropY(v=>Math.max(-1,+(v-0.1).toFixed(2)))}><Ionicons name="arrow-up" size={22} color={RED}/></TouchableOpacity>
          <TouchableOpacity style={s.cropControl} onPress={()=>setCropY(v=>Math.min(1,+(v+0.1).toFixed(2)))}><Ionicons name="arrow-down" size={22} color={RED}/></TouchableOpacity>
          <TouchableOpacity style={s.cropControl} onPress={()=>setCropX(v=>Math.min(1,+(v+0.1).toFixed(2)))}><Ionicons name="arrow-forward" size={22} color={RED}/></TouchableOpacity>
        </View>
        <View style={s.cropActions}>
          <TouchableOpacity style={s.cropCancel} onPress={()=>setCropAsset(null)} disabled={saving}><Text style={s.secondaryText}>Anuleaza</Text></TouchableOpacity>
          <TouchableOpacity style={s.cropConfirm} onPress={confirmCrop} disabled={saving}><Text style={s.saveText}>{saving?'Se incarca...':'Salveaza cadrul'}</Text></TouchableOpacity>
        </View>
      </View></View>
    </Modal>
    <Modal visible={positionEditor && !!editing?.photo_url} transparent animationType="fade" onRequestClose={()=>setPositionEditor(false)}>
      <View style={s.cropOverlay}><View style={s.cropDialog}>
        <Text style={s.cardTitle}>Poziționează fotografia</Text>
        <Text style={s.cropHelp}>Trage fotografia cu degetul sau mouse-ul. Folosește + și − pentru zoom.</Text>
        <View style={s.positionFrame} onLayout={e=>setPhotoFrameWidth(e.nativeEvent.layout.width)} {...panResponder.panHandlers}>
          {!!editing?.photo_url && <Image source={{uri:editing.photo_url}} resizeMode="cover" style={[s.positionImage,{transform:[{scale:editing.photo_zoom??1},{translateX:(editing.photo_position_x??0)*photoFrameWidth*0.25},{translateY:(editing.photo_position_y??0)*photoFrameWidth*0.3125}]}]}/>}
        </View>
        <Text style={s.cropLabel}>Mărire: {Math.round((editing?.photo_zoom??1)*100)}%</Text>
        <View style={s.cropControls}>
          <TouchableOpacity style={s.cropControl} onPress={()=>update({photo_zoom:Math.max(1,Math.round(((editing?.photo_zoom??1)-0.1)*10)/10)})}><Ionicons name="remove" size={23} color={RED}/></TouchableOpacity>
          <TouchableOpacity style={s.cropControl} onPress={()=>update({photo_zoom:Math.min(3,Math.round(((editing?.photo_zoom??1)+0.1)*10)/10)})}><Ionicons name="add" size={23} color={RED}/></TouchableOpacity>
          <TouchableOpacity style={s.cropControl} onPress={()=>update({photo_zoom:1,photo_position_x:0,photo_position_y:0})}><Ionicons name="refresh" size={23} color={RED}/></TouchableOpacity>
        </View>
        <View style={s.cropActions}>
          <TouchableOpacity style={s.cropCancel} onPress={()=>setPositionEditor(false)}><Text style={s.secondaryText}>Înapoi</Text></TouchableOpacity>
          <TouchableOpacity style={s.cropConfirm} onPress={()=>setPositionEditor(false)}><Text style={s.saveText}>Aplică poziția</Text></TouchableOpacity>
        </View>
        <Text style={s.cropHelp}>Pentru păstrarea modificării, apasă apoi „Salvează voluntarul”.</Text>
      </View></View>
    </Modal>
    <View style={s.content}>

    {loading ? <ActivityIndicator color={RED}/> : error ? <Text style={s.error}>{error}</Text> : !allowed ? <Text style={s.error}>Nu ai permisiunea de administrare a profilurilor publice din departamentul Voluntariat.</Text> : <>
      {editing ? <ScrollView style={s.listScroll} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
        <View style={s.header}><TouchableOpacity style={s.back} onPress={()=>router.canGoBack()?router.back():router.replace('/voluntar/departamente')}><Ionicons name="chevron-back" size={22} color={RED}/></TouchableOpacity><View><Text style={s.eyebrow}>ADMINISTRARE</Text><Text style={s.title}>Voluntarii noștri</Text></View></View>
        <Text style={s.hint}>Gestionează profilurile și publică numai voluntarii care și-au dat acordul pentru afișarea numelui și fotografiei.</Text>
        <View style={s.card}>
        <View style={s.editorHeader}><Text style={s.cardTitle}>{editing.id?'Editează voluntarul':'Adaugă voluntar'}</Text><TouchableOpacity accessibilityLabel="Înapoi la lista voluntarilor" onPress={()=>setEditing(null)} disabled={saving} style={s.closeEditor}><Ionicons name="close" size={21} color={RED}/></TouchableOpacity></View>
        {field('Nume afișat *',editing.display_name,v=>update({display_name:v}))}
        {field('Rol / responsabilitate',editing.role,v=>update({role:v}))}
        {!!editing.id && !isFixedLeader(editing.display_name) && <View style={s.orderPanel}>
          <View style={s.orderTop}><View style={{flex:1}}><Text style={s.orderTitle}>Ordinea afișării</Text><Text style={s.orderHint}>{editing.featured ? 'Voluntari implicați' : 'Toți voluntarii'} · modificările se salvează imediat</Text></View></View>
          <View style={s.orderActions}>
            <TouchableOpacity style={s.orderButton} disabled={saving || !items.filter(p=>p.featured===editing.featured && !isFixedLeader(p.display_name)).sort((a,b)=>a.sort_order-b.sort_order).some((p,i)=>p.id===editing.id&&i>0)} onPress={()=>moveVolunteer(-1)}><Ionicons name="arrow-up" size={16} color={RED}/><Text style={s.orderButtonText}>Mai sus</Text></TouchableOpacity>
            <TouchableOpacity style={s.orderButton} disabled={saving || !items.filter(p=>p.featured===editing.featured && !isFixedLeader(p.display_name)).sort((a,b)=>a.sort_order-b.sort_order).some((p,i,arr)=>p.id===editing.id&&i<arr.length-1)} onPress={()=>moveVolunteer(1)}><Ionicons name="arrow-down" size={16} color={RED}/><Text style={s.orderButtonText}>Mai jos</Text></TouchableOpacity>
          </View>
          <View style={s.orderListHeading}><Text style={s.orderListLabel}>Poziționează față de alt voluntar</Text><Text style={s.orderScrollHint}>Derulează lista ↓</Text></View>
          <ScrollView style={s.orderListScroll} contentContainerStyle={s.orderListContent} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {items.filter(p=>p.featured===editing.featured && p.id!==editing.id && !isFixedLeader(p.display_name)).sort((a,b)=>a.sort_order-b.sort_order).map(p=><View key={p.id} style={s.orderPerson}>
              <Text style={s.orderPersonName} numberOfLines={1}>{p.display_name}</Text>
              <TouchableOpacity disabled={saving} onPress={()=>placeVolunteer(p.id,false)} style={s.orderSmall}><Text style={s.orderSmallText}>Înainte</Text></TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={()=>placeVolunteer(p.id,true)} style={s.orderSmall}><Text style={s.orderSmallText}>După</Text></TouchableOpacity>
            </View>)}
          </ScrollView>
          <Text style={s.orderFooter}>Pentru schimbarea secțiunii, modifică „Voluntar implicat” și salvează profilul.</Text>
        </View>}
        {!!editing.id && isFixedLeader(editing.display_name) && <Text style={s.leaderNotice}>Acest profil are o poziție fixă în partea de sus a paginii publice. Poți edita informațiile, dar nu ordinea afișării.</Text>}
        {!editing.id && <Text style={s.orderHint}>Salvează voluntarul pentru a putea modifica poziția lui în listă.</Text>}
        {editing.photo_url ? <TouchableOpacity onPress={()=>setPositionEditor(true)} style={s.photoTap} accessibilityLabel="Modifică poziția fotografiei"><Image source={{uri:editing.photo_url}} style={s.photo}/><Text style={s.photoTapText}>Atinge poza pentru poziționare</Text></TouchableOpacity> : null}
        <TouchableOpacity style={s.secondary} onPress={uploadPhoto} disabled={saving}><Ionicons name="image-outline" size={18} color={RED}/><Text style={s.secondaryText}>{editing.photo_url?'Schimbă fotografia':'Încarcă fotografie'}</Text></TouchableOpacity>
        {!!editing.photo_url && <TouchableOpacity onPress={()=>update({photo_url:null})}><Text style={s.remove}>Elimină fotografia</Text></TouchableOpacity>}
        {toggle('Voluntar implicat (secțiunea principală)',editing.featured,'featured')}
        {toggle('Voluntar nou (7 zile de la publicare)',editing.is_new,'is_new')}
        {editing.is_new && <Text style={s.hint}>{editing.new_until ? `Termen existent: ${new Date(editing.new_until).toLocaleString('ro-RO')}. Nu se prelungește la editare.` : 'La prima publicare, voluntarul va apărea 7 zile în secțiunea Voluntarii noi.'}</Text>}
        {toggle('Publicat pe site',editing.is_published,'is_published')}
        <TouchableOpacity style={s.save} onPress={save} disabled={saving}><Text style={s.saveText}>{saving?'Se salvează...':'Salvează voluntarul'}</Text></TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={()=>{setEditing(null);}} disabled={saving}><Text style={s.secondaryText}>Anulează</Text></TouchableOpacity>
        {!!editing.id && <TouchableOpacity onPress={remove} disabled={saving}><Text style={s.remove}>Șterge profilul</Text></TouchableOpacity>}
      </View></ScrollView> : <ScrollView ref={mainScrollRef} style={s.listScroll} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator>
        <View style={s.header}><TouchableOpacity style={s.back} onPress={()=>router.canGoBack()?router.back():router.replace('/voluntar/departamente')}><Ionicons name="chevron-back" size={22} color={RED}/></TouchableOpacity><View><Text style={s.eyebrow}>ADMINISTRARE</Text><Text style={s.title}>Voluntarii noștri</Text></View></View>
        <Text style={s.hint}>Gestionează profilurile și publică numai voluntarii care și-au dat acordul pentru afișarea numelui și fotografiei.</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryCard}><Ionicons name="people-outline" size={19} color={RED}/><Text style={s.summaryNumber}>{items.length}</Text><Text style={s.summaryLabel}>Total profiluri</Text></View>
          <View style={s.summaryCard}><Ionicons name="eye-outline" size={19} color={RED}/><Text style={s.summaryNumber}>{items.filter(x=>x.is_published).length}</Text><Text style={s.summaryLabel}>Publicate</Text></View>
          <View style={s.summaryCard}><Ionicons name="eye-off-outline" size={19} color={RED}/><Text style={s.summaryNumber}>{items.filter(x=>!x.is_published).length}</Text><Text style={s.summaryLabel}>Nepublicate</Text></View>
        </View>
        <TouchableOpacity style={s.addButton} onPress={()=>setEditing(blank())}><Ionicons name="add-circle-outline" color="#FFF" size={20}/><Text style={s.saveText}>Adaugă voluntar</Text></TouchableOpacity>
        <View style={s.searchBox}><Ionicons name="search-outline" size={19} color="#777"/><TextInput style={s.searchInput} placeholder="Caută după nume sau rol..." placeholderTextColor="#999" value={search} onChangeText={setSearch}/>{search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Ionicons name="close-circle" size={19} color="#999"/></TouchableOpacity>}</View>
        <View style={s.filters}>{([{key:'all',label:'Toți'},{key:'published',label:'Publicați'},{key:'draft',label:'Nepublicați'}] as const).map(option=><TouchableOpacity key={option.key} style={[s.filterButton,filter===option.key&&s.filterActive]} onPress={()=>setFilter(option.key)}><Text style={[s.filterText,filter===option.key&&s.filterTextActive]}>{option.label}</Text></TouchableOpacity>)}</View>
        <View style={s.directoryBody} onLayout={event => {
            const measured = event.nativeEvent.layout.width;
            if (measured > 0 && Math.abs(measured - directoryWidth) > 1) setDirectoryWidth(measured);
          }}>
          {visibleItems.length===0 && <View style={s.empty}><Ionicons name="people-outline" size={32} color="#999"/><Text style={s.emptyTitle}>{items.length===0?'Nu există voluntari adăugați':'Nu am găsit voluntari'}</Text><Text style={s.emptyHint}>{items.length===0?'Apasă „Adaugă voluntar” pentru a crea primul profil.':'Modifică filtrul sau termenul de căutare.'}</Text></View>}
          {leaders.length > 0 && <View style={s.directorySection}>
            <Text style={s.sectionTitle}>Conducerea misiunii</Text>
            <Text style={s.leaderCaption}>Daniel și Emanuel au poziții fixe. Atinge un profil pentru a-l edita.</Text>
            <View style={[s.gallery, {paddingHorizontal:11}]}>{leaders.map(renderVolunteerCard)}</View>
          </View>}
          {renderVolunteerSection('Voluntari implicați',regularFeatured,regularOthers.length ? 'Toți voluntarii' : undefined)}
          {renderVolunteerSection('Toți voluntarii',regularOthers)}
        </View>
      </ScrollView>}
    </>}
  </View></SafeAreaView>;
}
const s=StyleSheet.create({fixedHeader:{flexShrink:0,backgroundColor:'#F7F7F7',zIndex:2},continuePage:{alignSelf:"flex-end",flexDirection:"row",alignItems:"center",gap:6,paddingVertical:11,paddingHorizontal:5},continuePageText:{color:RED,fontSize:12,fontWeight:"700"},directoryBody:{paddingBottom:20},directorySection:{marginBottom:18},directoryScroll:{flexGrow:0,backgroundColor:"#F0F0F0",borderRadius:16,borderWidth:1,borderColor:"#E5E5E5"},directoryScrollContent:{padding:10,paddingBottom:12},sectionHeading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},leaderCaption:{color:"#777",fontSize:12,marginBottom:12,lineHeight:18},leaderNotice:{backgroundColor:"#FFF4F4",padding:12,borderRadius:10,color:"#8D2429",fontSize:12,lineHeight:18},orderPanel:{backgroundColor:"#FFF8F8",borderRadius:14,padding:12,gap:9,borderWidth:1,borderColor:"#F2DEDE"},orderTop:{flexDirection:"row",alignItems:"center"},orderTitle:{fontSize:16,fontWeight:"900",color:"#222"},orderHint:{fontSize:11,lineHeight:16,color:"#777",marginTop:2},orderActions:{flexDirection:"row",gap:8},orderButton:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,paddingVertical:9,paddingHorizontal:8,borderRadius:10,backgroundColor:"#FFF",borderWidth:1,borderColor:"#EACACA"},orderButtonText:{color:RED,fontSize:12,fontWeight:"800"},orderListHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},orderListLabel:{fontSize:11,fontWeight:"700",color:"#555",flex:1},orderScrollHint:{fontSize:10,color:"#888"},orderListScroll:{height:196,flexGrow:0,backgroundColor:"#FFF",borderRadius:10,borderWidth:1,borderColor:"#F0E5E5"},orderListContent:{paddingHorizontal:9},orderPerson:{height:48,flexDirection:"row",alignItems:"center",gap:6,borderBottomWidth:1,borderBottomColor:"#F0E5E5"},orderPersonName:{flex:1,fontSize:12,fontWeight:"700",color:"#333"},orderSmall:{paddingHorizontal:8,paddingVertical:7,borderRadius:8,backgroundColor:"#FFF",borderWidth:1,borderColor:"#EACACA"},orderSmallText:{fontSize:10,color:RED,fontWeight:"800"},orderFooter:{fontSize:10,lineHeight:15,color:"#888"},positionFrame:{width:280,height:350,overflow:"hidden",borderRadius:12,backgroundColor:"#EEE"},positionImage:{width:"100%",height:"100%"},photoTap:{alignSelf:"flex-start",gap:5},photoTapText:{fontSize:12,color:RED,fontWeight:"700"},cropOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.65)',justifyContent:'center',alignItems:'center',padding:12},cropDialog:{width:'100%',maxWidth:400,backgroundColor:'#FFF',borderRadius:18,padding:16,alignItems:'center',gap:10},cropHelp:{fontSize:12,color:'#666',textAlign:'center'},cropFrame:{width:CROP_W,height:CROP_H,overflow:'hidden',borderRadius:12,backgroundColor:'#EEE'},cropLabel:{fontWeight:'700',fontSize:13,color:'#333',marginTop:5},cropControls:{flexDirection:'row',gap:12,justifyContent:'center'},cropControl:{borderWidth:1,borderColor:'#E6C5C5',borderRadius:9,padding:9,minWidth:48,alignItems:'center'},cropActions:{flexDirection:'row',gap:12,width:'100%',marginTop:8},cropCancel:{flex:1,borderWidth:1,borderColor:'#E6C5C5',borderRadius:10,padding:13,alignItems:'center'},cropConfirm:{flex:1,backgroundColor:RED,borderRadius:10,padding:13,alignItems:'center'},summaryRow:{flexDirection:'row',gap:9,marginBottom:15},summaryCard:{flex:1,minWidth:0,backgroundColor:'#FFF',borderWidth:1,borderColor:'#EEEEEE',borderRadius:15,padding:12,gap:5},summaryNumber:{fontSize:23,fontWeight:'900',color:'#222'},summaryLabel:{fontSize:11,color:'#777',fontWeight:'600'},addButton:{alignSelf:'flex-start',backgroundColor:RED,borderRadius:10,paddingHorizontal:16,paddingVertical:10,alignItems:'center',flexDirection:'row',gap:7,marginBottom:14},sectionTitle:{fontSize:20,fontWeight:'900',color:'#222',marginTop:12,marginBottom:12},gallery:{width:'100%',flexDirection:'row',flexWrap:'wrap',justifyContent:'flex-start',columnGap:12,rowGap:12,alignItems:'stretch'},galleryCard:{backgroundColor:'#FFF',borderRadius:16,padding:9,borderWidth:1,borderColor:'#ECECEC',alignItems:'center',minWidth:0},galleryPhoto:{width:'100%',aspectRatio:4/5,borderRadius:10,marginBottom:10},galleryPlaceholder:{width:'100%',aspectRatio:4/5,borderRadius:10,marginBottom:10,backgroundColor:'#F8EBEB',justifyContent:'center',alignItems:'center'},galleryName:{fontSize:14,fontWeight:'900',color:'#222',textAlign:'center',minHeight:34},galleryRole:{fontSize:12,color:'#777',textAlign:'center',marginTop:4,lineHeight:17},galleryStatus:{fontSize:11,color:RED,fontWeight:'700'},statusPill:{backgroundColor:'#FCEEEE',paddingHorizontal:9,paddingVertical:5,borderRadius:20,marginTop:5,marginBottom:2},statusPillDraft:{backgroundColor:'#F0F0F0'},galleryStatusDraft:{color:'#666'},editorHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},closeEditor:{padding:8,backgroundColor:'#FCECEC',borderRadius:10},searchBox:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'#FFF',borderRadius:12,borderWidth:1,borderColor:'#EAEAEA',paddingHorizontal:14,marginBottom:12},searchInput:{flex:1,paddingVertical:13,color:'#222',fontSize:14},filters:{flexDirection:'row',gap:8,marginBottom:18,flexWrap:'wrap'},filterButton:{backgroundColor:'#FFF',paddingVertical:9,paddingHorizontal:15,borderRadius:20,borderWidth:1,borderColor:'#EAEAEA'},filterActive:{backgroundColor:RED,borderColor:RED},filterText:{fontWeight:'700',color:'#666',fontSize:12},filterTextActive:{color:'#FFF'},empty:{backgroundColor:'#FFF',borderRadius:16,alignItems:'center',padding:35,gap:10},emptyTitle:{fontSize:16,fontWeight:'800',color:'#222'},emptyHint:{color:'#777',textAlign:'center'},root:{flex:1,backgroundColor:'#F7F7F7'},content:{flex:1,maxWidth:1320,width:'100%',alignSelf:'center',paddingHorizontal:18,paddingTop:18,paddingBottom:12},listScroll:{flex:1,minHeight:0},listContent:{paddingBottom:55},header:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:24},back:{backgroundColor:'#FFF',borderRadius:14,padding:12},eyebrow:{fontSize:11,color:RED,fontWeight:'800'},title:{fontSize:25,fontWeight:'900',color:'#181818'},hint:{color:'#777',fontSize:13,marginBottom:20,flexShrink:0},error:{color:RED,fontSize:15},card:{backgroundColor:'#FFF',borderRadius:20,padding:20,gap:13},cardTitle:{fontSize:20,fontWeight:'900'},field:{gap:6},label:{fontWeight:'700',color:'#242424'},input:{borderWidth:1,borderColor:'#DDD',borderRadius:11,padding:12,fontSize:15,color:'#222',backgroundColor:'#FFF'},toggle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#EEE'},save:{backgroundColor:RED,borderRadius:12,padding:16,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10,marginBottom:10},saveText:{color:'#FFF',fontWeight:'800'},secondary:{borderWidth:1,borderColor:'#E6C5C5',borderRadius:12,padding:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},secondaryText:{color:RED,fontWeight:'800'},remove:{color:RED,textAlign:'center',fontWeight:'700',padding:10},photo:{width:110,height:110,borderRadius:14},count:{color:'#777',marginBottom:12},person:{backgroundColor:'#FFF',borderRadius:14,padding:12,marginBottom:9,flexDirection:'row',alignItems:'center',gap:12},thumb:{width:48,height:48,borderRadius:12},placeholder:{width:48,height:48,borderRadius:12,backgroundColor:'#FCECEC',alignItems:'center',justifyContent:'center'},personName:{fontWeight:'900',color:'#222'},personRole:{fontSize:12,color:'#777',marginTop:3}});
