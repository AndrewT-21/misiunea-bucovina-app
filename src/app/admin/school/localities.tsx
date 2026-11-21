import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal,
  Platform,
  ScrollView, useWindowDimensions, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SchoolAdminGate from '../../../components/SchoolAdminGate';
import { useSchoolAdminPermissions } from '../../../hooks/useSchoolAdminPermissions';
import { Alert } from '../../../lib/platform-alert';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BG = '#F6F6F6';
type Locality = { id: string; name: string; notes: string | null; is_active: boolean; created_at: string };

function SchoolLocalitiesScreen() {
  const { rights, loadingRights } = useSchoolAdminPermissions();
  const [items, setItems] = useState<Locality[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive'>('active');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Locality | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace('/admin-login'); return; }
      const { data, error: rpcError } = await supabase.rpc('school_list_localities');
      if (rpcError) throw rpcError;
      setItems((data ?? []) as Locality[]);
    } catch (e: any) { setError(e?.message || 'Nu am putut încărca localitățile.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const filtered = useMemo(() => items.filter(x =>
    (statusFilter === 'active' ? x.is_active : !x.is_active) &&
    `${x.name} ${x.notes || ''}`.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))
  ), [items, statusFilter, search]);

  function openCreate() { if (!rights.can_create) return; setEditing(null); setName(''); setNotes(''); setModal(true); }
  function openEdit(item: Locality) { if (!rights.can_edit) return; setEditing(item); setName(item.name); setNotes(item.notes || ''); setModal(true); }
  async function save() {
    if (loadingRights || !(editing ? rights.can_edit : rights.can_create)) { Alert.alert('Acces restricționat', 'Nu ai permisiunea necesară.'); return; }
    if (name.trim().length < 2) { Alert.alert('Nume invalid', 'Introdu numele localității.'); return; }
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('school_save_locality', {
        p_id: editing?.id ?? null, p_name: name.trim(), p_notes: notes.trim() || null,
      });
      if (rpcError) throw rpcError;
      setModal(false); await refresh();
    } catch (e: any) { Alert.alert('Eroare', e?.message || 'Nu am putut salva localitatea.'); }
    finally { setBusy(false); }
  }
  function toggle(item: Locality) {
    if (loadingRights || !rights.can_edit) return;
    Alert.alert(item.is_active ? 'Dezactivează localitatea?' : 'Reactivează localitatea?',
      'Localitatea nu va fi ștearsă din baza de date.', [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Confirmă', onPress: async () => {
          setBusy(true);
          try {
            const { error: rpcError } = await supabase.rpc('school_set_locality_active', {
              p_id: item.id, p_active: !item.is_active,
            });
            if (rpcError) throw rpcError;
            await refresh();
          } catch (e: any) { Alert.alert('Eroare', e?.message || 'Operația nu a reușit.'); }
          finally { setBusy(false); }
        } },
      ]);
  }

  const { height: screenHeight } = useWindowDimensions();
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={DARK} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.eyebrow}>ȘCOALA CREȘTINĂ</Text>
        <Text style={styles.title}>Localități</Text>
      </View>
      {!loadingRights && rights.can_create && <TouchableOpacity style={styles.addButton} onPress={openCreate} disabled={busy}>
        <Ionicons name="add" size={25} color="#FFF" />
      </TouchableOpacity>}
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>Organizare internă pe localități, fără grupe</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={19} color="#888" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Caută localitate"
          placeholderTextColor="#999" style={styles.searchInput} />
      </View>
      <View style={styles.filterRow}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: statusFilter === 'active' }} style={[styles.filterButton, statusFilter === 'active' && styles.filterSelected]} onPress={() => setStatusFilter('active')}>
          <Ionicons name="checkmark-circle-outline" size={17} color={statusFilter === 'active' ? '#FFF' : RED}/>
          <Text style={[styles.filterText, statusFilter === 'active' && styles.filterTextSelected]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: statusFilter === 'inactive' }} style={[styles.filterButton, statusFilter === 'inactive' && styles.filterSelected]} onPress={() => setStatusFilter('inactive')}>
          <Ionicons name="pause-circle-outline" size={17} color={statusFilter === 'inactive' ? '#FFF' : RED}/>
          <Text style={[styles.filterText, statusFilter === 'inactive' && styles.filterTextSelected]}>Inactive</Text>
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={RED} size="large" style={{ marginTop: 30 }} />
        : error ? <View style={styles.card}><Text style={styles.error}>{error}</Text>
            <TouchableOpacity onPress={() => void refresh()}><Text style={styles.actionText}>Reîncearcă</Text></TouchableOpacity></View>
        : filtered.length === 0 ? <View style={styles.card}><Text style={styles.muted}>Nu există localități pentru filtrul selectat.</Text></View>
        : <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={filtered.length > 4} style={[styles.localitiesList, { maxHeight: Math.min(860, screenHeight * 0.60) }]} contentContainerStyle={{ paddingBottom: 8 }}>
          {filtered.map(item => <View key={item.id} style={styles.card}>
            <View style={styles.itemRow}>
              <View style={styles.iconBox}><Ionicons name="location-outline" size={23} color={RED} /></View>
              <View style={{ flex: 1 }}><Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.muted}>{item.notes || 'Fără observații'}</Text>
                <Text style={styles.meta}>{item.is_active ? 'ACTIVĂ' : 'INACTIVĂ'}</Text></View>
            </View>
            <View style={styles.actions}>
              {rights.can_edit && <TouchableOpacity style={styles.outlineButton} onPress={() => openEdit(item)} disabled={busy}>
                <Ionicons name="create-outline" size={17} color={RED} /><Text style={styles.actionText}>Editează</Text>
              </TouchableOpacity>}
              {rights.can_edit && <TouchableOpacity style={styles.outlineButton} onPress={() => toggle(item)} disabled={busy}>
                <Ionicons name={item.is_active ? 'pause-circle-outline' : 'checkmark-circle-outline'} size={17} color={RED} />
                <Text style={styles.actionText}>{item.is_active ? 'Dezactivează' : 'Reactivează'}</Text>
              </TouchableOpacity>}
            </View>
            {item.is_active && <TouchableOpacity style={styles.manageButton} onPress={() => router.push({ pathname: '/admin/school/[localityId]', params: { localityId: item.id } } as any)}>
              <Ionicons name="settings-outline" size={18} color="#FFF"/>
              <Text style={styles.manageText}>Gestionează</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF"/>
            </TouchableOpacity>}
          </View>)}
          </ScrollView>}
    </ScrollView>
    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => !busy && setModal(false)}>
      <View style={styles.overlay}><View style={styles.modalCard}>
        <Text style={styles.modalTitle}>{editing ? 'Editează localitatea' : 'Localitate nouă'}</Text>
        <Text style={styles.fieldLabel}>Numele localității</Text>
        <TextInput style={styles.field} value={name} onChangeText={setName} placeholder="Ex. Vadu Vejei" />
        <Text style={styles.fieldLabel}>Observații (opțional)</Text>
        <TextInput style={[styles.field, { minHeight: 75 }]} multiline value={notes} onChangeText={setNotes}
          placeholder="Detalii interne" />
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelButton} disabled={busy} onPress={() => setModal(false)}>
            <Text style={styles.cancelText}>Anulează</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} disabled={busy} onPress={() => void save()}>
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Salvează</Text>}
          </TouchableOpacity>
        </View>
      </View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), paddingHorizontal: 15, paddingTop: 12, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, marginLeft: 13 },
  eyebrow: { color: RED, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: DARK, fontSize: 27, fontWeight: '900', marginTop: 1 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), paddingHorizontal: 15, paddingBottom: 35 },
  intro: { color: '#888', fontSize: 11, marginBottom: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE7E7', borderRadius: 16, paddingHorizontal: 13, minHeight: 48, marginBottom: 22 },
  searchInput: { flex: 1, fontSize: 13, color: DARK },
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  filterButton: { flex: 1, minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: '#E9DEDE', backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  filterSelected: { backgroundColor: RED, borderColor: RED },
  filterText: { fontSize: 13, fontWeight: '800', color: RED },
  filterTextSelected: { color: '#FFF' },
  localitiesList: { maxHeight: 4 * 215 },
  manageButton: { marginTop: 10, backgroundColor: RED, minHeight: 42, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  manageText: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionEyebrow: { color: RED, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginBottom: 3 },
  sectionTitle: { color: DARK, fontSize: 19, fontWeight: '900' },
  countBadge: { minWidth: 31, height: 31, paddingHorizontal: 9, borderRadius: 16, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  countText: { color: RED, fontSize: 11, fontWeight: '900' },
  toggle: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 15 },
  toggleText: { fontSize: 11, color: RED, fontWeight: '900' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE7E7', borderRadius: 20, padding: 17, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  itemName: { color: DARK, fontSize: 17, fontWeight: '900' },
  muted: { color: '#777', fontSize: 13, marginTop: 4 },
  meta: { color: RED, fontSize: 9, fontWeight: '900', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  outlineButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#FFF0F0' },
  actionText: { color: RED, fontSize: 11, fontWeight: '800' },
  error: { color: RED, marginBottom: 10 },
  footnote: { color: '#999', fontSize: 10, textAlign: 'center', marginTop: 18, lineHeight: 16 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 35 },
  modalTitle: { color: DARK, fontSize: 20, fontWeight: '900', marginBottom: 16 },
  fieldLabel: { color: DARK, fontSize: 11, fontWeight: '800', marginBottom: 5, marginTop: 10 },
  field: { backgroundColor: BG, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: DARK, fontSize: 13 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#EEE' },
  cancelText: { color: DARK, fontWeight: '800' },
  saveButton: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: RED },
  saveText: { color: '#FFF', fontWeight: '900' },
});

export default function ProtectedSchoolLocalitiesScreen() {
  return <SchoolAdminGate permission="can_view"><SchoolLocalitiesScreen /></SchoolAdminGate>;
}
