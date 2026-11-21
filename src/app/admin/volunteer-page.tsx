import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { defaultVolunteerPage, loadVolunteerPage, volunteerImageUrl, type VolunteerPageContent } from '../../lib/volunteer-page';
const RED = '#A61E22';
export default function AdminVolunteerPage() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>('hero');
  const [dirty, setDirty] = useState(false);
  const [content, setContent] = useState<VolunteerPageContent>(defaultVolunteerPage);
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = user ? await supabase.from('admins').select('role').eq('user_id', user.id).maybeSingle() : { data: null };
      if (!active) return;
      let canEdit = data?.role === 'super_admin';
      if (data?.role === 'admin') {
        const { data: permissions, error: permissionError } = await supabase.rpc('misibi_my_admin_permissions');
        if (permissionError) { Alert.alert('Permisiuni', permissionError.message); }
        canEdit = !permissionError && ((permissions ?? []) as { department_slug: string; can_edit: boolean }[]).some(p => p.department_slug === 'voluntariat' && p.can_edit);
      }
      setAllowed(canEdit);
      if (canEdit) {
        try { const result = await loadVolunteerPage(); if (active) setContent(result); }
        catch (e: any) { Alert.alert('Configurare Supabase', e.message || 'Rulează întâi scriptul SQL inclus.'); }
      }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []));
  function setField<K extends keyof VolunteerPageContent>(key: K, value: VolunteerPageContent[K]) { setDirty(true); setContent(p => ({ ...p, [key]: value })); }
  function setSection(index: number, key: keyof VolunteerPageContent['story_sections'][number], value: any) {
    setDirty(true); setContent(p => ({ ...p, story_sections: p.story_sections.map((s, i) => i === index ? { ...s, [key]: value } : s) }));
  }
  async function uploadImage(field: 'hero_image' | 'story', index?: number) {
    if (!allowed) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset?.base64) { Alert.alert('Eroare', 'Imaginea nu a putut fi citită.'); return; }
    setSaving(true);
    try {
      const mime = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const ext = mime === 'image/png' ? 'png' : 'jpg';
      const path = `voluntariat/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('volunteer-page').upload(path, decode(asset.base64), { contentType: mime, upsert: false });
      if (error) throw error;
      if (field === 'hero_image') setField('hero_image', path);
      else if (index !== undefined) setSection(index, 'image', path);
      Alert.alert('Imagine încărcată', 'Apasă „Salvează pagina” pentru a publica fotografia.');
    } catch (e: any) { Alert.alert('Eroare încărcare', e.message || 'Nu s-a putut încărca imaginea.'); }
    finally { setSaving(false); }
  }
  async function save() {
    if (!allowed) { Alert.alert('Acces interzis', 'Nu ai permisiunea de editare a paginii Voluntariat.'); return; }
    setSaving(true);
    const { error } = await supabase.from('volunteer_page_content').upsert({ id: 1, content: { ...content, hero_title: 'Voluntariat' }, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    setSaving(false);
    if (error) Alert.alert('Eroare salvare', error.message);
    else {
      setDirty(false);
      Alert.alert('Salvat', 'Pagina Voluntariat a fost actualizată.');
      router.replace('/admin');
    }
  }
  const field = (label: string, value: string, change: (v: string) => void, multiline = false) => <View style={s.field} key={label}>
    <Text style={s.label}>{label}</Text><TextInput style={[s.input, multiline && s.multiline]} multiline={multiline} value={value} onChangeText={change} placeholder={label} />
  </View>;
  const textField = (key: keyof VolunteerPageContent, label: string, multiline = false) => field(label, String(content[key] ?? ''), v => setField(key as any, v as any), multiline);
  const photo = (value: string, action: () => void) => <View style={s.photoBox}>
    {!!value && <Image source={{ uri: volunteerImageUrl(value) }} style={s.photo} resizeMode="cover" />}
    <TouchableOpacity onPress={action} disabled={saving} style={s.upload}><Ionicons name="image-outline" color={RED} size={20}/><Text style={s.uploadText}>{value ? 'Înlocuiește imaginea' : 'Încarcă imagine'}</Text></TouchableOpacity>
  </View>;
  const toggle = (id: string) => setOpenSection(current => current === id ? null : id);
  const section = (id: string, title: string, subtitle: string, children: React.ReactNode) => <View style={s.card} key={id}>
    <TouchableOpacity onPress={() => toggle(id)} style={s.sectionHead} accessibilityRole="button" accessibilityLabel={`${openSection === id ? 'Închide' : 'Deschide'} ${title}`}>
      <View style={{flex:1}}><Text style={s.cardTitle}>{title}</Text><Text style={s.hint}>{subtitle}</Text></View>
      <Ionicons name={openSection === id ? 'chevron-up' : 'chevron-down'} size={21} color={RED}/>
    </TouchableOpacity>
    {openSection === id && <View style={s.sectionBody}>{children}</View>}
  </View>;
  const goBack = () => {
    const leave = () => router.canGoBack() ? router.back() : router.replace('/admin');
    if (!dirty) { leave(); return; }
    Alert.alert('Modificări nesalvate', 'Vrei să ieși fără să salvezi?', [
      {text:'Rămâi',style:'cancel'}, {text:'Ieși fără salvare',style:'destructive',onPress:leave},
    ]);
  };
  return <SafeAreaView style={s.root} edges={['top']}>
    <View style={s.fixedHeader}><View style={s.heading}><TouchableOpacity onPress={goBack} style={s.back}><Ionicons name="chevron-back" size={24} color={RED}/></TouchableOpacity><View style={{flex:1}}><Text style={s.eyebrow}>ADMINISTRARE</Text><Text style={s.title}>Voluntariat</Text></View></View>
      <Text style={s.headerDescription}>Editează doar conținutul variabil al paginii publice.</Text>
    </View>
    {loading ? <ActivityIndicator style={{marginTop:35}} color={RED}/> : !allowed ? <Text style={[s.error,{padding:20}]}>Ai nevoie de permisiunea „Editare” pentru departamentul Voluntariat.</Text> : <>
      <ScrollView style={{flex:1}} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {section('hero','Imagine și introducere','Fotografia de copertă și mesajul introductiv',<>
          {photo(content.hero_image,()=>uploadImage('hero_image'))}
          {textField('hero_subtitle','Descriere principală',true)}
          <Text style={s.note}>Titlul public „Voluntariat” este fix.</Text>
        </>)}
        {section('intro','Prezentare','Mesajul de prezentare și beneficiile voluntariatului',<>
          {textField('intro_body','Text de prezentare',true)}
          <Text style={s.note}>Eticheta și titlul prezentării rămân fixe.</Text>
          {content.benefits.map((benefit,i)=><View key={i} style={s.subcard}>
            <Text style={s.subheading}>{benefit.title || `Beneficiu ${i+1}`}</Text>
            {field('Descriere',benefit.description,v=>setField('benefits',content.benefits.map((b,j)=>i===j?{...b,description:v}:b)),true)}
          </View>)}
          <Text style={s.note}>Titlurile și iconițele celor patru beneficii sunt fixe; poți modifica descrierile.</Text>
        </>)}
        {section('form','Formular de înscriere','Descriere, opțiuni și informații pentru înscriere',<>
          {textField('form_description','Descriere formular',true)}
          {field('Domenii de implicare (câte unul pe rând)',content.involvement_options.join('\n'),v=>setField('involvement_options',v.split('\n').map(x=>x.trim()).filter(Boolean)),true)}
          {textField('consent_text','Text acord pentru prelucrarea datelor',true)}
          {textField('privacy_text','Informații privind confidențialitatea',true)}
          <Text style={s.note}>Titlurile câmpurilor, subtitlurile și butonul de înscriere rămân fixe.</Text>
        </>)}
        {content.story_sections.map((item,i)=>section(`story-${i}`,item.title || `Secțiunea ${i+1}`,'Imagine, descriere și legătură către pagina asociată',<>
          {photo(item.image,()=>uploadImage('story',i))}
          {field('Descriere',item.description,v=>setSection(i,'description',v),true)}
          {field('Puncte listă (unul pe rând)',item.bullets.join('\n'),v=>setSection(i,'bullets',v.split('\n').map(x=>x.trim()).filter(Boolean)),true)}
          {field('Link buton',item.button_link,v=>setSection(i,'button_link',v))}
          <Text style={s.note}>Titlul, eticheta și textul butonului sunt fixe.</Text>
        </>))}
        <Text style={s.footerNote}>Secțiunile închise nu ocupă spațiu în formular. Modificările sunt publicate numai după salvare.</Text>
      </ScrollView>
      <View style={s.fixedFooter}><TouchableOpacity style={[s.save,saving && {opacity:.6}]} onPress={save} disabled={saving}>
        <Ionicons name="checkmark-circle-outline" size={20} color="#FFF"/><Text style={s.saveText}>{saving?'Se salvează...':dirty?'Salvează modificările':'Salvează pagina'}</Text>
      </TouchableOpacity></View>
    </>}
  </SafeAreaView>;

}
const s=StyleSheet.create({fixedHeader:{backgroundColor:'#F6F6F6',paddingHorizontal:18,paddingTop:12,paddingBottom:10,borderBottomWidth:1,borderBottomColor:'#EAEAEA'},headerDescription:{fontSize:12,color:'#777',marginLeft:56,marginTop:-8},sectionHead:{flexDirection:'row',alignItems:'center',gap:12,minHeight:58},sectionBody:{paddingTop:14,borderTopWidth:1,borderTopColor:'#F0F0F0'},hint:{fontSize:12,color:'#777',lineHeight:18},note:{fontSize:12,color:'#888',lineHeight:18,marginTop:5},footerNote:{fontSize:12,color:'#888',lineHeight:18,textAlign:'center',marginVertical:15},fixedFooter:{paddingHorizontal:18,paddingVertical:10,backgroundColor:'#FFF',borderTopWidth:1,borderTopColor:'#EEE'},root:{flex:1,backgroundColor:'#F6F6F6'},content:{width:'100%',maxWidth:1000,alignSelf:'center',padding:18,paddingBottom:30},heading:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12},back:{width:44,height:44,backgroundColor:'#FFF',borderRadius:14,alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:10,letterSpacing:1.4,fontWeight:'900',color:RED},title:{fontSize:25,fontWeight:'900',color:'#171717'},card:{backgroundColor:'#FFF',borderRadius:20,padding:18,marginBottom:16},cardTitle:{fontSize:19,fontWeight:'900',color:'#171717',marginBottom:0},field:{marginBottom:13},label:{fontSize:13,fontWeight:'700',color:'#333',marginBottom:6},input:{borderWidth:1,borderColor:'#E8E8E8',borderRadius:12,padding:12,fontSize:15,color:'#222',backgroundColor:'#FAFAFA'},multiline:{minHeight:90,textAlignVertical:'top'},photoBox:{marginBottom:15},photo:{width:'100%',height:150,borderRadius:15,marginBottom:10},upload:{flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',backgroundColor:'#FFF1F1',borderRadius:12,padding:13},uploadText:{color:RED,fontWeight:'800'},subcard:{padding:13,backgroundColor:'#FAF8F8',borderRadius:13,marginBottom:12},subheading:{fontWeight:'800',marginBottom:10},remove:{color:RED,fontWeight:'700',paddingVertical:9},secondary:{borderWidth:1,borderColor:RED,borderRadius:13,padding:14,alignItems:'center',marginBottom:18},secondaryText:{color:RED,fontWeight:'800'},save:{backgroundColor:RED,padding:14,borderRadius:14,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9},saveText:{color:'#FFF',fontWeight:'900'},error:{color:RED,fontSize:15}});
