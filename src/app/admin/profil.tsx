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
function notify(title: string, body: string) { if (Platform.OS === 'web') window.alert(`${title}\n${body}`); else Alert.alert(title, body); }
export default function AdminProfileScreen() {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin' | null>(null);
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [nicknameAvailable, setNicknameAvailable] = useState(true);
  const [phone, setPhone] = useState('');
  const [county, setCounty] = useState('');
  const [city, setCity] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setLoading(true); setErrorText('');
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace('/admin-login'); return; }
        const { data: admin, error: roleError } = await supabase.from('admins').select('role').eq('user_id', user.id).maybeSingle();
        if (roleError) throw roleError;
        if (!admin || !['admin', 'super_admin'].includes(admin.role)) throw new Error('Acest cont nu are acces administrativ.');
        const { data: profile, error: profileError } = await supabase.from('admin_profiles').select('full_name,nickname,phone,avatar_url,county,city').eq('user_id', user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;
        setUserId(user.id); setRole(admin.role as 'admin' | 'super_admin');
        setFullName(profile?.full_name ?? ''); setNickname(profile?.nickname ?? ''); setOriginalNickname(profile?.nickname ?? '');
        setPhone(profile?.phone ?? ''); setCounty(profile?.county ?? ''); setCity(profile?.city ?? ''); setAvatarUrl(profile?.avatar_url ?? null);
      } catch (e: any) { if (active) setErrorText(e?.message ?? 'Profilul nu a putut fi încărcat.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []));

  async function choosePhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75, base64: true });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    } catch (e: any) { notify('Fotografie', e?.message ?? 'Nu am putut selecta fotografia.'); }
  }

  async function save() {
    if (!userId || !role || saving) return;
    if (!fullName.trim()) return notify('Nume obligatoriu', 'Completează numele.');
    const normalized = nickname.trim().toLowerCase().replace(/^@/, '');
    if (normalized && !/^[a-z0-9_]{3,20}$/.test(normalized)) return notify('Nickname invalid', 'Folosește 3–20 caractere: litere mici, cifre sau _.');
    if (!nicknameAvailable) return notify('Nickname', 'Așteaptă verificarea sau alege un nickname disponibil.');
    setSaving(true);
    try {
      if (normalized && normalized !== originalNickname.trim().toLowerCase()) {
        if (!(await checkNicknameAvailability(normalized))) throw new Error('Acest nickname este deja folosit.');
      }
      let nextAvatar = avatarUrl;
      if (photo) {
        if (!photo.base64) throw new Error('Fotografia nu a putut fi citită.');
        const path = `${userId}/admin-avatar-${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage.from('volunteer-avatars').upload(path, decode(photo.base64), { contentType: 'image/jpeg', upsert: false });
        if (uploadError) throw uploadError;
        nextAvatar = supabase.storage.from('volunteer-avatars').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('admin_profiles').upsert({
        user_id: userId, full_name: fullName.trim(), nickname: normalized || null,
        phone: phone.trim() || null, county: county.trim() || null, city: city.trim() || null, avatar_url: nextAvatar, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      notify('Profil actualizat', 'Modificările au fost salvate.');
      router.back();
    } catch (e: any) { notify('Nu am putut salva', e?.message ?? 'Încearcă din nou.'); }
    finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={s.screen}><ActivityIndicator color={RED} style={{ marginTop: 80 }} /></SafeAreaView>;
  return <SafeAreaView style={s.screen} edges={['top']}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <TouchableOpacity style={s.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={21} color={RED}/><Text style={s.backText}>Contul meu</Text></TouchableOpacity>
    <Text style={s.title}>Profilul meu</Text>
    <Text style={s.subtitle}>{role === 'super_admin' ? 'Super Administrator' : 'Administrator'}</Text>
    {errorText ? <Text style={s.error}>{errorText}</Text> : <>
      <TouchableOpacity style={s.photoButton} onPress={choosePhoto}>
        {photo?.uri || avatarUrl ? <Image source={{ uri: photo?.uri ?? avatarUrl! }} style={s.photo}/> : <View style={s.photoEmpty}><Ionicons name="person-outline" size={42} color={RED}/></View>}
        <Text style={s.photoLabel}>Schimbă fotografia</Text>
      </TouchableOpacity>
      <Text style={s.label}>Nume complet</Text><TextInput style={s.input} value={fullName} onChangeText={setFullName} autoCapitalize="words"/>
      <Text style={s.label}>Nickname</Text><TextInput style={s.input} value={nickname} onChangeText={setNickname} autoCapitalize="none" autoCorrect={false} maxLength={21} placeholder="ex: Misionel"/>
      <NicknameAvailability nickname={nickname} original={originalNickname} onAvailabilityChange={setNicknameAvailable}/>
      <Text style={s.hint}>Opțional, 3–20 caractere: litere mici, cifre și _. Nu schimbă datele de autentificare.</Text>
      <Text style={s.label}>Județ</Text><TextInput style={s.input} value={county} onChangeText={setCounty} autoCapitalize="words" placeholder="Ex.: Suceava" maxLength={100}/>
    <Text style={s.label}>Localitate</Text><TextInput style={s.input} value={city} onChangeText={setCity} autoCapitalize="words" placeholder="Ex.: Rădăuți" maxLength={100}/>
    <Text style={s.label}>Telefon</Text><TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad"/>
      <TouchableOpacity style={s.save} onPress={() => void save()} disabled={saving || !nicknameAvailable}>{saving ? <ActivityIndicator color="#FFF"/> : <Text style={s.saveText}>Salvează modificările</Text>}</TouchableOpacity>
      {role === 'admin' && <TouchableOpacity style={s.departmentButton} onPress={() => router.push('/admin/departamentele-mele' as any)}><Ionicons name="grid-outline" size={21} color={RED}/><Text style={s.departmentText}>Departamentele mele</Text><Ionicons name="chevron-forward" size={20} color={RED}/></TouchableOpacity>}
    </>}
    {role === 'admin' && <View style={s.accountDangerZone}>
      <Text style={s.accountDangerTitle}>Ștergerea contului</Text>
      <Text style={s.accountDangerDescription}>Poți solicita ștergerea definitivă a contului tău. Datele istorice care trebuie păstrate vor fi arhivate înainte de ștergere.</Text>
      <DeleteAccountButton/>
    </View>}
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F6F3' }, content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), padding: 22, paddingBottom: 60 },
  back: { flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 12 }, backText: { color: RED, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '900', color: '#171717', marginTop: 25 }, subtitle: { color: '#777', marginTop: 5, marginBottom: 22 },
  photoButton: { alignItems: 'center', marginBottom: 25 }, photo: { width: 100, height: 100, borderRadius: 50 },
  photoEmpty: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  photoLabel: { color: RED, fontWeight: '800', marginTop: 10 }, label: { fontSize: 13, fontWeight: '800', color: '#333', marginBottom: 8, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#E9DFDD', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, minHeight: 52, fontSize: 15, color: '#171717' },
  hint: { color: '#777', fontSize: 12, lineHeight: 18, marginTop: 7 }, error: { color: RED, marginVertical: 20 },
  save: { backgroundColor: RED, minHeight: 54, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  saveText: { color: '#FFF', fontWeight: '900', fontSize: 15 },
  departmentButton: { backgroundColor: '#FFF', borderRadius: 14, marginTop: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  departmentText: { color: '#171717', fontWeight: '800', flex: 1 },
  accountDangerZone: { marginTop: 30, paddingTop: 22, borderTopWidth: 1, borderTopColor: '#EADDDD' },
  accountDangerTitle: { color: '#A61E22', fontSize: 15, fontWeight: '900' },
  accountDangerDescription: { color: '#777', fontSize: 12, lineHeight: 18, marginTop: 6 },
});
