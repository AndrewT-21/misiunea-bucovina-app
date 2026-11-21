import { Alert } from '../../lib/platform-alert';
import DeleteAccountButton from '../../components/DeleteAccountButton';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator,  Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import NicknameAvailability from '../../components/NicknameAvailability';
import { checkNicknameAvailability } from '../../lib/nicknameAvailability';

const RED = '#A61E22';
function message(title: string, body: string) { if (Platform.OS === 'web') window.alert(`${title}\n${body}`); else Alert.alert(title, body); }
export default function EditeazaProfil() {
  const [userId, setUserId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [county, setCounty] = useState('');
  const [city, setCity] = useState('');
  const [nickname, setNickname] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [nicknameAvailable, setNicknameAvailable] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPhoto, setNewPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/voluntar/login'); return; }
        const { data, error } = await supabase.from('volunteer_profiles').select('full_name,phone,nickname,avatar_url,county,city').eq('user_id', user.id).single();
        if (error) throw error;
        if (!active) return;
        setUserId(user.id); setFullName(data.full_name ?? ''); setPhone(data.phone ?? '');
        setNickname(data.nickname ?? ''); setOriginalNickname(data.nickname ?? ''); setCounty(data.county ?? ''); setCity(data.city ?? ''); setAvatarUrl(data.avatar_url ?? null);
      } catch (e: any) { message('Eroare', e.message ?? 'Nu am putut încărca profilul.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []));

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75, base64: true });
    if (!result.canceled && result.assets[0]) setNewPhoto(result.assets[0]);
  }

  async function save() {
    const normalized = nickname.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) return message('Nickname invalid', 'Folosește 3–20 de caractere: litere mici, cifre sau _.');
    if (!fullName.trim()) return message('Nume obligatoriu', 'Completează numele.');
    if (!userId || saving) return;
    if (!nicknameAvailable) return message('Nickname', 'Așteaptă verificarea sau alege un nickname disponibil.');
    setSaving(true);
    try {
      if (normalized && normalized !== originalNickname.trim().toLowerCase()) {
        if (!(await checkNicknameAvailability(normalized))) throw new Error('Acest nickname este deja folosit.');
      }
      let nextAvatar = avatarUrl;
      if (newPhoto) {
        if (!newPhoto.base64) throw new Error('Fotografia nu a putut fi citită.');
        const path = `${userId}/avatar-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('volunteer-avatars').upload(path, decode(newPhoto.base64), { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        nextAvatar = supabase.storage.from('volunteer-avatars').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('volunteer_profiles').update({ full_name: fullName.trim(), phone: phone.trim() || null, nickname: normalized, county: county.trim() || null, city: city.trim() || null, avatar_url: nextAvatar }).eq('user_id', userId);
      if (error) {
        if (error.code === '23505') throw new Error('Acest nickname este deja folosit. Alege altul.');
        throw error;
      }
      message('Profil actualizat', 'Modificările au fost salvate.');
      (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'));
    } catch (e: any) { message('Nu am putut salva', e.message ?? 'Încearcă din nou.'); }
    finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={styles.screen}><ActivityIndicator color={RED} style={{ marginTop: 80 }} /></SafeAreaView>;
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]} keyboardShouldPersistTaps="handled">
    <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))} style={styles.back}><Ionicons name="arrow-back" size={21} color={RED}/><Text style={styles.backText}>Contul meu</Text></TouchableOpacity>
    <Text style={styles.title}>Editează profilul</Text>
    <TouchableOpacity style={styles.photoButton} onPress={choosePhoto}>
      {newPhoto?.uri || avatarUrl ? <Image source={{ uri: newPhoto?.uri ?? avatarUrl! }} style={styles.photo}/> : <View style={styles.photoEmpty}><Ionicons name="person-outline" size={42} color={RED}/></View>}
      <Text style={styles.photoLabel}>Schimbă fotografia</Text>
    </TouchableOpacity>
    <Text style={styles.label}>Nume complet</Text><TextInput style={styles.input} value={fullName} onChangeText={setFullName} autoCapitalize="words"/>
    <Text style={styles.label}>Nickname unic</Text><TextInput style={styles.input} value={nickname} onChangeText={setNickname} autoCapitalize="none" autoCorrect={false} maxLength={21} placeholder="ex: andrei_24"/>
    <NicknameAvailability nickname={nickname} original={originalNickname} onAvailabilityChange={setNicknameAvailable}/>
    <Text style={styles.hint}>3–20 caractere. Litere, cifre și _. Fără spații. Nickname-ul va putea fi folosit la conectare după configurarea autentificării.</Text>
    <Text style={styles.label}>Județ</Text><TextInput style={styles.input} value={county} onChangeText={setCounty} autoCapitalize="words" placeholder="Ex.: Suceava" maxLength={100}/>
    <Text style={styles.label}>Localitate</Text><TextInput style={styles.input} value={city} onChangeText={setCity} autoCapitalize="words" placeholder="Ex.: Rădăuți" maxLength={100}/>
    <Text style={styles.label}>Telefon</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad"/>
    <TouchableOpacity style={styles.save} onPress={save} disabled={saving || !nicknameAvailable}>{saving ? <ActivityIndicator color="#FFF"/> : <Text style={styles.saveText}>Salvează modificările</Text>}</TouchableOpacity>
    <View style={styles.accountDangerZone}>
      <Text style={styles.accountDangerTitle}>Ștergerea contului</Text>
      <Text style={styles.accountDangerDescription}>Poți solicita ștergerea definitivă a contului tău. Datele istorice care trebuie păstrate vor fi arhivate înainte de ștergere.</Text>
      <DeleteAccountButton/>
    </View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F6F3' }, content: { padding: 22, paddingBottom: 60 },
  back: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 12 }, backText: { color: RED, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '900', color: '#171717', marginTop: 25, marginBottom: 20 },
  photoButton: { alignItems: 'center', marginBottom: 25 }, photo: { width: 100, height: 100, borderRadius: 50 },
  photoEmpty: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  photoLabel: { color: RED, fontWeight: '800', marginTop: 10 }, label: { fontSize: 13, fontWeight: '800', color: '#333', marginBottom: 8, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#E9DFDD', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, minHeight: 52, fontSize: 15, color: '#171717' },
  hint: { color: '#777', fontSize: 12, lineHeight: 18, marginTop: 7 },
  save: { backgroundColor: RED, minHeight: 54, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  saveText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
});
