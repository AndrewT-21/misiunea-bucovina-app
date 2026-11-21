import { Alert } from '../../../../lib/platform-alert';
import { useSchoolAdminPermissions } from '../../../../hooks/useSchoolAdminPermissions';
import SchoolAdminGate from '../../../../components/SchoolAdminGate';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ActivityIndicator,  Modal, ScrollView, useWindowDimensions, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../../lib/supabase';

type Locality = { id: string; name: string; is_active: boolean };
type Child = { id: string; first_name: string; last_name: string; locality_id: string; notes: string | null; is_active: boolean; created_at: string };
const RED = '#A61E22';
function SchoolChildrenScreen() {
  const { rights, loadingRights } = useSchoolAdminPermissions();
  const { localityId } = useLocalSearchParams<{ localityId: string }>();
  const [children, setChildren] = useState<Child[]>([]);
  const [childSearch, setChildSearch] = useState('');
  const [locality, setLocality] = useState<Locality | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [notes, setNotes] = useState('');
  const [errorText, setErrorText] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setErrorText(''); setCanEdit(false);
    try {
      if (!localityId || typeof localityId !== 'string') throw new Error('Localitate invalidă.');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.replace('/voluntar/login' as any); return; }
      const [l, permissions] = await Promise.all([
        supabase.rpc('school_list_accessible_localities'),
        supabase.rpc('school_can_manage_children', { p_locality_id: localityId }),
      ]);
      if (l.error) throw l.error;
      if (permissions.error) throw permissions.error;
      const current = ((l.data ?? []) as Locality[]).find(x => x.id === localityId);
      if (!current) throw new Error('Nu ai acces la această localitate.');
      setLocality(current);
      setCanEdit(permissions.data === true);
      const c = await supabase.rpc('school_list_children');
      if (c.error) throw c.error;
      setChildren(((c.data ?? []) as Child[]).filter(x => x.locality_id === localityId && x.is_active));
    } catch (e: any) { setErrorText(e?.message ?? 'Nu s-au putut încărca datele.'); setChildren([]); setLocality(null); }
    finally { setLoading(false); }
  }, [localityId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const openNew = () => { if (loadingRights || !rights.can_create || !canEdit) return; setEditing(null); setFirstName(''); setLastName(''); setNotes(''); setModal(true); };
  const openEdit = (c: Child) => { if (loadingRights || !rights.can_edit || !canEdit) return; setEditing(c); setFirstName(c.first_name); setLastName(c.last_name); setNotes(c.notes ?? ''); setModal(true); };
  const save = async () => {
    if (loadingRights || !(editing ? rights.can_edit : rights.can_create) || !canEdit || !locality?.is_active || !localityId) return;
    if (!firstName.trim() || !lastName.trim()) { Alert.alert('Date incomplete', 'Completează prenumele și numele.'); return; }
    if (editing && editing.locality_id !== localityId) { Alert.alert('Eroare', 'Copilul aparține altei localități.'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc('school_save_child', {
        p_id: editing?.id ?? null, p_first_name: firstName.trim(), p_last_name: lastName.trim(),
        p_locality_id: localityId, p_notes: notes.trim() || null,
      });
      if (error) throw error;
      setModal(false); await refresh();
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Salvarea a eșuat.'); }
    finally { setBusy(false); }
  };
  const { height: screenHeight } = useWindowDimensions();
  return <SafeAreaView style={s.root} edges={['top']}>
    <View style={s.header}>
      <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color="#171717" /></TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 12 }}><Text style={s.eyebrow}>ȘCOALA CREȘTINĂ</Text><Text style={s.title}>Evidența copiilor</Text></View>
      {!loading && !loadingRights && rights.can_create && canEdit && locality?.is_active && <TouchableOpacity style={s.add} onPress={openNew} disabled={busy}><Ionicons name="add" size={24} color="white" /></TouchableOpacity>}
    </View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator color={RED} /> : errorText ? <Text style={{ color: RED }}>{errorText}</Text> : <>
        <Text style={s.muted}>Localitate: {locality?.name}</Text>
        <Text style={s.muted}>{children.length} copii înregistrați · {canEdit && rights.can_edit ? 'Editare permisă' : 'Doar vizualizare'}</Text>
        <View style={s.searchBox}><Ionicons name="search-outline" size={20} color="#888"/><TextInput style={s.searchInput} value={childSearch} onChangeText={setChildSearch} placeholder="Caută după nume sau prenume..." placeholderTextColor="#999" /></View>
        {children.length === 0 && <View style={s.empty}><Ionicons name="people-outline" size={28} color="#AAA"/><Text style={s.emptyTitle}>Nu există copii înregistrați</Text></View>}
        {children.length > 0 && !children.some(c => `${c.last_name} ${c.first_name}`.toLocaleLowerCase('ro').includes(childSearch.trim().toLocaleLowerCase('ro'))) && <View style={s.empty}><Text style={s.emptyTitle}>Niciun rezultat pentru această căutare</Text></View>}
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={children.length > 5} style={{ maxHeight: Math.max(190, screenHeight * 0.52) }} contentContainerStyle={{ paddingBottom: 8 }}>
        {children.filter(c => `${c.last_name} ${c.first_name}`.toLocaleLowerCase('ro').includes(childSearch.trim().toLocaleLowerCase('ro'))).map(c => <TouchableOpacity key={c.id} style={s.card} disabled={!canEdit || !rights.can_edit || loadingRights} onPress={() => openEdit(c)}>
          <View style={{ flex: 1 }}><Text style={s.name}>{c.last_name} {c.first_name}</Text><Text style={s.muted}>{locality?.name}</Text></View>
          {canEdit && rights.can_edit && <Ionicons name="create-outline" size={21} color="#777" />}
        </TouchableOpacity>)}
        </ScrollView>
      </>}
    </ScrollView>
    <Modal visible={modal && canEdit && !loadingRights && (editing ? rights.can_edit : rights.can_create)} transparent animationType="slide" onRequestClose={() => setModal(false)}>
      <View style={s.overlay}><ScrollView style={s.sheet} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{editing ? 'Editează copilul' : 'Adaugă copil'}</Text>
        <Text style={s.label}>Prenume</Text><TextInput style={s.input} value={firstName} onChangeText={setFirstName} maxLength={100} />
        <Text style={s.label}>Nume</Text><TextInput style={s.input} value={lastName} onChangeText={setLastName} maxLength={100} />
        <Text style={s.label}>Localitate</Text><Text style={s.muted}>{locality?.name} (nu poate fi schimbată)</Text>
        <Text style={s.label}>Note interne (opțional; evită date sensibile)</Text><TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} multiline value={notes} onChangeText={setNotes} maxLength={500} />
        <TouchableOpacity style={s.save} onPress={save} disabled={busy}><Text style={{ color: 'white', fontWeight: '700' }}>{busy ? 'Se salvează...' : 'Salvează'}</Text></TouchableOpacity>
        <TouchableOpacity style={{ padding: 16, alignItems: 'center' }} onPress={() => setModal(false)} disabled={busy}><Text>Anulează</Text></TouchableOpacity>
      </ScrollView></View>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E9E2E2', borderRadius: 16, paddingHorizontal: 15, marginTop: 14, marginBottom: 12 },
  searchInput: { flex: 1, height: 50, fontSize: 14, color: '#171717' },
  empty: { alignItems: 'center', gap: 9, backgroundColor: '#FFF', borderRadius: 18, padding: 26, marginTop: 12 },
  emptyTitle: { color: '#777', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  root: { flex: 1, backgroundColor: '#F6F6F6' }, header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), padding: 18, flexDirection: 'row', alignItems: 'center' }, eyebrow: { color: RED, fontSize: 11, fontWeight: '700' }, title: { fontSize: 23, fontWeight: '800', color: '#171717' }, add: { backgroundColor: RED, padding: 9, borderRadius: 12 }, content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), padding: 18, paddingBottom: 40 }, muted: { color: '#777', fontSize: 13, marginBottom: 6 }, input: { backgroundColor: 'white', borderRadius: 12, padding: 13, marginBottom: 14, borderWidth: 1, borderColor: '#E8E8E8' }, card: { backgroundColor: 'white', borderWidth: 1, borderColor: '#EEE7E7', padding: 17, borderRadius: 18, flexDirection: 'row', alignItems: 'center', marginTop: 10 }, name: { fontSize: 16, fontWeight: '700', color: '#171717' }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0006' }, sheet: { backgroundColor: '#F6F6F6', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }, label: { fontWeight: '600', marginBottom: 6 }, save: { backgroundColor: RED, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
});

export default function ProtectedSchoolChildrenScreen() {
  return <SchoolAdminGate permission="can_view"><SchoolChildrenScreen /></SchoolAdminGate>;
}
