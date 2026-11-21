import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import type { ElementRef } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator,  Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SchoolAdminGate from '../../components/SchoolAdminGate';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BUCKET = 'school-images';

type SchoolContent = {
  title: string;
  subtitle: string;
  description: string;
  mission: string;
  development_text: string;
  hero_image_url: string | null;
};
type GalleryImage = { id: string; image_url: string; storage_path: string | null; sort_order: number };
const initial: SchoolContent = { title: '', subtitle: '', description: '', mission: '', development_text: '', hero_image_url: null };

function SchoolEditScreen() {
  const scrollRef = useRef<ElementRef<typeof ScrollView>>(null);
  const [content, setContent] = useState<SchoolContent>(initial);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [newHeroUri, setNewHeroUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Acces restricționat', 'Autentifică-te ca administrator.'); router.replace('/admin-login'); return; }
      const { data: admin, error: adminError } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (adminError || !admin) { Alert.alert('Acces interzis', 'Acest cont nu este administrator.'); router.back(); return; }
      const { data, error } = await supabase.from('school_content').select('title, subtitle, description, mission, development_text, hero_image_url').eq('id', 1).single();
      if (error) throw error;
      setContent({ title: data.title ?? '', subtitle: data.subtitle ?? '', description: data.description ?? '', mission: data.mission ?? '', development_text: data.development_text ?? '', hero_image_url: data.hero_image_url ?? null });
      await loadGallery();
    } catch (e) { Alert.alert('Eroare la încărcare', errorMessage(e)); }
    finally { setLoading(false); }
  }

  async function loadGallery() {
    const { data, error } = await supabase.from('school_gallery').select('id, image_url, storage_path, sort_order').order('sort_order', { ascending: true });
    if (error) throw error;
    setGallery((data ?? []) as GalleryImage[]);
  }

  function update(field: keyof Omit<SchoolContent, 'hero_image_url'>, value: string) {
    setContent(old => ({ ...old, [field]: value }));
  }

  async function chooseHero() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permisiune necesară', 'Permite accesul la fotografii.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 1 });
    if (!result.canceled && result.assets[0]) setNewHeroUri(result.assets[0].uri);
  }

  async function uploadImage(uri: string, folder: string) {
    const optimized = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG });
    const response = await fetch(optimized.uri);
    const bytes = await response.arrayBuffer();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  function storagePath(url: string) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = url.indexOf(marker);
    return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
  }

  async function save() {
    if (saving || uploading) return;
    if (!content.title.trim()) { Alert.alert('Titlu obligatoriu', 'Completează titlul școlii.'); return; }
    setSaving(true);
    let uploadedPath: string | null = null;
    try {
      let imageUrl = content.hero_image_url;
      if (newHeroUri) {
        const uploaded = await uploadImage(newHeroUri, 'hero');
        uploadedPath = uploaded.path;
        imageUrl = uploaded.url;
      }
      const { error } = await supabase.from('school_content').update({
        title: content.title.trim(), subtitle: content.subtitle.trim(), description: content.description.trim(),
        mission: content.mission.trim(), development_text: content.development_text.trim(),
        hero_image_url: imageUrl, updated_at: new Date().toISOString(),
      }).eq('id', 1).select('id').single();
      if (error) throw error;
      const previousUrl = content.hero_image_url;
      setContent(old => ({ ...old, hero_image_url: imageUrl }));
      setNewHeroUri(null);
      if (newHeroUri && previousUrl) {
        const oldPath = storagePath(previousUrl);
        if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
      }
      Alert.alert('Salvat', 'Modificările școlii au fost salvate.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      if (uploadedPath) await supabase.storage.from(BUCKET).remove([uploadedPath]);
      Alert.alert('Nu s-a putut salva', errorMessage(e));
    } finally { setSaving(false); }
  }

  async function addPhotos() {
    if (uploading || saving) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permisiune necesară', 'Permite accesul la fotografii.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (result.canceled || !result.assets.length) return;
    setUploading(true);
    try {
      let order = gallery.length ? Math.max(...gallery.map(photo => photo.sort_order)) + 1 : 0;
      for (const asset of result.assets) {
        const uploaded = await uploadImage(asset.uri, 'gallery');
        const { error } = await supabase.from('school_gallery').insert({ image_url: uploaded.url, storage_path: uploaded.path, sort_order: order++ });
        if (error) { await supabase.storage.from(BUCKET).remove([uploaded.path]); throw error; }
      }
      await loadGallery();
      Alert.alert('Fotografii adăugate', 'Galeria a fost actualizată.');
    } catch (e) { Alert.alert('Eroare galerie', errorMessage(e)); }
    finally { setUploading(false); }
  }

  function confirmRemove(photo: GalleryImage) {
    Alert.alert('Șterge fotografia?', 'Fotografia va fi eliminată din galeria școlii.', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: () => { void removePhoto(photo); } },
    ]);
  }

  async function removePhoto(photo: GalleryImage) {
    setUploading(true);
    try {
      const { error } = await supabase.from('school_gallery').delete().eq('id', photo.id);
      if (error) throw error;
      setGallery(old => old.filter(p => p.id !== photo.id));
      const path = photo.storage_path || storagePath(photo.image_url);
      if (path) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove([path]);
        if (storageError) Alert.alert('Atenție', 'Fotografia a fost eliminată din galerie, dar nu și din Storage.');
      }
    } catch (e) { Alert.alert('Eroare', errorMessage(e)); }
    finally { setUploading(false); }
  }

  if (loading) return <SafeAreaView style={styles.screen}><View style={styles.center}><ActivityIndicator size="large" color={RED} /><Text style={styles.hint}>Se încarcă școala...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Înapoi"><Ionicons name="chevron-back" size={24} color={DARK} /></TouchableOpacity>
        <View style={styles.headerText}><Text style={styles.eyebrow}>ADMINISTRARE</Text><Text style={styles.title}>Editează școala</Text></View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
        <Text style={styles.sectionLabel}>FOTOGRAFIE PRINCIPALĂ</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={chooseHero} disabled={saving || uploading}>
          {newHeroUri || content.hero_image_url ? <><Image source={{ uri: newHeroUri || content.hero_image_url! }} style={styles.heroImage} /><View style={styles.changeImageButton}><Ionicons name="camera-outline" size={18} color="#FFF" /><Text style={styles.changeImageText}>Schimbă fotografia</Text></View></> : <><Ionicons name="image-outline" size={35} color={RED} /><Text style={styles.emptyImageTitle}>Adaugă fotografie</Text><Text style={styles.hint}>Alege o imagine din telefon</Text></>}
        </TouchableOpacity>
        <Text style={styles.sectionLabel}>GALERIE FOTO</Text>
        <View style={styles.card}>
          <Text style={styles.help}>Adaugă fotografii care vor apărea în galeria publică a școlii.</Text>
          <TouchableOpacity style={styles.galleryButton} onPress={addPhotos} disabled={uploading || saving}>
            {uploading ? <ActivityIndicator color={RED} /> : <><Ionicons name="images-outline" size={20} color={RED} /><Text style={styles.galleryButtonText}>Adaugă fotografii</Text></>}
          </TouchableOpacity>
          {gallery.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>{gallery.map(photo => <View key={photo.id} style={styles.galleryPhotoWrap}><Image source={{ uri: photo.image_url }} style={styles.galleryPhoto} /><TouchableOpacity style={styles.removePhoto} onPress={() => confirmRemove(photo)} disabled={uploading}><Ionicons name="trash-outline" size={16} color="#FFF" /></TouchableOpacity></View>)}</ScrollView>}
        </View>
        <Text style={styles.sectionLabel}>INFORMAȚII PRINCIPALE</Text>
        <View style={styles.card}>
          <Field onFocusInput={event => { const target = event.target; setTimeout(() => { if (typeof target === 'number') { scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 130, true); } }, 180); }} label="Titlu" value={content.title} onChangeText={v => update('title', v)} />
          <Field onFocusInput={event => { const target = event.target; setTimeout(() => { if (typeof target === 'number') { scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 130, true); } }, 180); }} label="Subtitlu" value={content.subtitle} onChangeText={v => update('subtitle', v)} multiline />
          <Field onFocusInput={event => { const target = event.target; setTimeout(() => { if (typeof target === 'number') { scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 130, true); } }, 180); }} label="Despre școală" value={content.description} onChangeText={v => update('description', v)} multiline />
        </View>
        <Text style={styles.sectionLabel}>MISIUNEA ȘCOLII</Text>
        <View style={styles.card}><Field onFocusInput={event => { const target = event.target; setTimeout(() => { if (typeof target === 'number') { scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 130, true); } }, 180); }} label="Misiunea noastră" value={content.mission} onChangeText={v => update('mission', v)} multiline /></View>
        <Text style={styles.sectionLabel}>DEZVOLTAREA ȘCOLII</Text>
        <View style={styles.card}><Field onFocusInput={event => { const target = event.target; setTimeout(() => { if (typeof target === 'number') { scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target, 130, true); } }, 180); }} label="Creștem împreună" value={content.development_text} onChangeText={v => update('development_text', v)} multiline /></View>
        <TouchableOpacity style={[styles.saveButton, (saving || uploading) && styles.disabled]} onPress={save} disabled={saving || uploading}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Ionicons name="save-outline" size={21} color="#FFF" />}<Text style={styles.saveText}>{saving ? 'Se salvează...' : 'Salvează modificările'}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, multiline = false, onFocusInput }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; onFocusInput?: NonNullable<React.ComponentProps<typeof TextInput>['onFocus']> }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={[styles.input, multiline && styles.textArea]} value={value} onChangeText={onChangeText} onFocus={onFocusInput} placeholder={`Completează ${label.toLowerCase()}`} placeholderTextColor="#AAA" multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} /></View>;
}
function errorMessage(e: unknown) { return e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : 'Încearcă din nou.'; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F6F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), paddingHorizontal: 15, paddingTop: 12, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  headerText: { marginLeft: 13, flex: 1 },
  eyebrow: { color: RED, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: DARK, fontSize: 27, fontWeight: '900', marginTop: 1 },
  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), padding: 15, paddingBottom: 40 },
  sectionLabel: { color: '#999', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginLeft: 5, marginTop: 15, marginBottom: 9 },
  imagePicker: { height: 220, backgroundColor: '#FFF', borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EEE' },
  heroImage: { width: '100%', height: '100%' },
  changeImageButton: { position: 'absolute', bottom: 12, right: 12, backgroundColor: RED, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  changeImageText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  emptyImageTitle: { color: DARK, fontSize: 14, fontWeight: '900', marginTop: 10 },
  hint: { color: '#888', fontSize: 11, marginTop: 8 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  help: { color: '#777', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  galleryButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#F1D6D6', backgroundColor: '#FFF8F8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  galleryButtonText: { color: RED, fontSize: 12, fontWeight: '900' },
  galleryRow: { gap: 10, paddingTop: 14 },
  galleryPhotoWrap: { width: 125, height: 100, borderRadius: 14, overflow: 'hidden', backgroundColor: '#EEE' },
  galleryPhoto: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', top: 7, right: 7, width: 30, height: 30, borderRadius: 15, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 14 },
  label: { color: DARK, fontSize: 12, fontWeight: '800', marginBottom: 7 },
  input: { minHeight: 49, backgroundColor: '#F7F7F7', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, color: DARK, fontSize: 13, borderWidth: 1, borderColor: '#EEE' },
  textArea: { minHeight: 115, paddingTop: 13 },
  saveButton: { minHeight: 56, backgroundColor: RED, borderRadius: 16, marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});

export default function ProtectedSchoolEditScreen() {
  return <SchoolAdminGate permission="can_edit"><SchoolEditScreen /></SchoolAdminGate>;
}
