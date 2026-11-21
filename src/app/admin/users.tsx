import { Platform } from 'react-native';
import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput,
    TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const SUPER_ADMIN_UID = 'b62c2956-112b-4a7a-9ec0-8e5e702e295f';

type UserDepartment = { id: string; slug: string; name: string };
type ManagedUser = {
  user_id: string; email: string | null; full_name: string | null;
  nickname: string | null; role: 'super_admin' | 'admin' | 'volunteer';
  departments: UserDepartment[] | null;
};

export default function ManageUsersScreen() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'volunteer' | 'admin'>('volunteer');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [errorText, setErrorText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorText('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { router.replace('/admin-login'); return; }
      const { data: admin, error: roleError } = await supabase
        .from('admins').select('role').eq('user_id', user.id).maybeSingle();
      if (roleError || admin?.role !== 'super_admin' || user.id !== SUPER_ADMIN_UID) {
        Alert.alert('Acces interzis', 'Această pagină este disponibilă doar Super Adminului.');
        router.replace('/(tabs)');
        return;
      }
      const usersResult = await supabase.rpc('super_admin_list_users');
      if (usersResult.error) throw usersResult.error;
      const listedUsers = (usersResult.data ?? []) as ManagedUser[];
      setUsers(listedUsers);
      // Profilurile sunt citite separat: RPC-ul existent nu returnează avatar_url.
      // Nu blocăm lista dacă politicile RLS nu permit citirea unor fotografii.
      const [volunteerPhotos, adminPhotos] = await Promise.all([
        supabase.from('volunteer_profiles').select('user_id,avatar_url'),
        supabase.from('admin_profiles').select('user_id,avatar_url'),
      ]);
      const photoMap: Record<string, string> = {};
      for (const profile of [...(volunteerPhotos.data ?? []), ...(adminPhotos.data ?? [])]) {
        if (profile.user_id && profile.avatar_url) photoMap[profile.user_id] = profile.avatar_url;
      }
      setAvatars(photoMap);
    } catch (err: any) {
      setErrorText(err?.message ?? 'Nu am putut încărca utilizatorii.');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ro');
    return users.filter(u => (tab === 'volunteer' ? u.role === 'volunteer' : u.role !== 'volunteer') &&
      [u.full_name, u.nickname, u.email].some(v => (v ?? '').toLocaleLowerCase('ro').includes(q)))
      .sort((a, b) => {
        // Super Admin rămâne primul, indiferent de ordinea returnată de Supabase.
        const rank = (u: ManagedUser) => (u.role === 'super_admin' || u.user_id === SUPER_ADMIN_UID) ? 0 : 1;
        return rank(a) - rank(b);
      });
  }, [users, search, tab]);

  const execute = async (rpc: string, params: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc(rpc, params);
      if (error) throw error;
      await refresh();
    } catch (err: any) {
      Alert.alert('Operația nu a reușit', err?.message ?? 'Încearcă din nou.');
    } finally { setBusy(false); }
  };

  const confirmRole = (u: ManagedUser) => {
    if (u.role === 'super_admin' || u.user_id === SUPER_ADMIN_UID) return;
    const promote = u.role === 'volunteer';
    Alert.alert(
      promote ? 'Promovezi voluntarul?' : 'Retrogradezi administratorul?',
      promote
        ? `${u.full_name || u.email || 'Acest utilizator'} va deveni administrator, fără permisiuni administrative implicite.`
        : `${u.full_name || u.email || 'Acest utilizator'} va pierde asignările la departamente. Profilul de voluntar nu va fi șters.`,
      [{ text: 'Anulează', style: 'cancel' }, {
        text: 'Confirmă', style: promote ? 'default' : 'destructive',
        onPress: () => void execute('super_admin_set_admin', { p_user_id: u.user_id, p_make_admin: promote }),
      }]
    );
  };

  const deleteUser = async (u: ManagedUser) => {
    if (busy || u.role === 'super_admin' || u.user_id === SUPER_ADMIN_UID) return;
    setBusy(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (sessionError || !session) throw new Error('Sesiunea a expirat. Autentifică-te din nou.');

      const { data, error } = await supabase.functions.invoke('superadmin-delete-user', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { mode: 'admin', user_id: u.user_id, confirm: 'DELETE_ACCOUNT' },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Ștergerea contului nu a reușit.');
      }
      if (data?.deleted !== true) {
        throw new Error('Serverul nu a confirmat ștergerea contului.');
      }

      setUsers(current => current.filter(item => item.user_id !== u.user_id));
      setAvatars(current => {
        const next = { ...current };
        delete next[u.user_id];
        return next;
      });

      if (data.storage_cleanup_pending === true) {
        Alert.alert(
          'Cont șters',
          'Contul a fost șters și arhiva istorică a fost păstrată. Fotografia originală nu a putut fi eliminată automat din Storage; verifică jurnalul funcției.'
        );
      } else {
        Alert.alert(
          'Cont șters',
          'Contul a fost șters definitiv din Supabase Auth. Identitatea și istoricul au fost păstrate în arhiva istorică.'
        );
      }
    } catch (err: any) {
      Alert.alert('Ștergerea nu a reușit', err?.message ?? 'Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (u: ManagedUser) => {
    if (busy || u.role === 'super_admin' || u.user_id === SUPER_ADMIN_UID) return;
    setDeleteConfirmation('');
    setDeleteTarget(u);
  };

  const submitDelete = () => {
    if (!deleteTarget || busy || deleteConfirmation !== 'DELETE') return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeleteConfirmation('');
    void deleteUser(target);
  };


  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) { setDeleteTarget(null); setDeleteConfirmation(''); } }}>
        <View style={styles.deleteBackdrop}>
          <View style={styles.deleteDialog} accessibilityViewIsModal>
            <View style={styles.deleteWarning}><Ionicons name="trash-outline" size={26} color={RED} /></View>
            <Text style={styles.deleteTitle}>Ștergere definitivă cont</Text>
            <Text style={styles.deleteDescription}>Vrei să ștergi contul {deleteTarget?.full_name || deleteTarget?.email || 'selectat'}? Toate datele asociate contului vor fi șterse definitiv. Acțiunea nu poate fi anulată.</Text>
            <Text style={styles.deleteInputLabel}>Introdu <Text style={{ fontWeight: '900', color: RED }}>DELETE</Text> pentru a confirma:</Text>
            <TextInput style={styles.deleteInput} value={deleteConfirmation} onChangeText={setDeleteConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="Scrie DELETE" accessibilityLabel="Introdu DELETE pentru confirmare" editable={!busy} />
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity style={[styles.deleteDialogButton, styles.deleteCancel]} onPress={() => { setDeleteTarget(null); setDeleteConfirmation(''); }} disabled={busy}><Text style={styles.deleteCancelText}>Anulează</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.deleteDialogButton, styles.deleteProceed, deleteConfirmation !== 'DELETE' && styles.deleteDisabled]} onPress={submitDelete} disabled={busy || deleteConfirmation !== 'DELETE'}><Text style={styles.deleteProceedText}>Șterge definitiv</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Înapoi"
          >
            <Ionicons name="chevron-back" size={24} color="#171717" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ADMINISTRARE</Text>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
              Gestionare utilizatori
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Conturi, roluri și acces la departamente</Text>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color="#888" />
          <TextInput style={styles.input} placeholder="Caută nume, nickname sau e-mail"
            placeholderTextColor="#999" value={search} onChangeText={setSearch} autoCapitalize="none" />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color="#999" /></TouchableOpacity>}
        </View>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'volunteer' && styles.activeTab]} onPress={() => { setTab('volunteer'); setExpanded(null); }}>
            <Text style={[styles.tabText, tab === 'volunteer' && styles.activeTabText]}>Utilizatori ({users.filter(u => u.role === 'volunteer').length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'admin' && styles.activeTab]} onPress={() => { setTab('admin'); setExpanded(null); }}>
            <Text style={[styles.tabText, tab === 'admin' && styles.activeTabText]}>Administratori ({users.filter(u => u.role !== 'volunteer').length})</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {loading ? <ActivityIndicator style={{ marginTop: 32 }} color={RED} size="large" /> : errorText ? (
          <View style={styles.card}><Text style={styles.error}>{errorText}</Text><TouchableOpacity onPress={() => void refresh()}><Text style={styles.link}>Reîncearcă</Text></TouchableOpacity></View>
        ) : filtered.length === 0 ? <View style={styles.card}><Text style={styles.muted}>Nu există utilizatori pentru această căutare.</Text></View> : (
          filtered.map(u => {
            const protectedUser = u.role === 'super_admin' || u.user_id === SUPER_ADMIN_UID;
            const open = expanded === u.user_id;
            return <View key={u.user_id} style={styles.card}>
              <View style={styles.personRow}>
                <View style={styles.avatar}>{avatars[u.user_id] ? <Image source={{ uri: avatars[u.user_id] }} style={styles.avatarImage} resizeMode="cover" /> : <Ionicons name={protectedUser ? 'shield-checkmark-outline' : 'person-outline'} size={25} color={RED} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName}>{u.full_name || u.email || 'Utilizator fără nume'}</Text>
                  {!!u.email && <Text style={styles.muted}>{u.email}</Text>}
                  {!!u.nickname && <Text style={styles.muted}>@{u.nickname}</Text>}
                  <Text style={styles.role}>{protectedUser ? 'SUPER ADMIN · PROTEJAT' : u.role === 'admin' ? 'ADMINISTRATOR' : 'UTILIZATOR'}</Text>
                </View>
              </View>
              {!protectedUser && <View style={styles.actions}>
                <View style={styles.primaryActionRow}>
                  <TouchableOpacity disabled={busy} style={[styles.actionButton, styles.roleButton]} onPress={() => confirmRole(u)} accessibilityRole="button">
                    <Text style={styles.roleButtonText} numberOfLines={2}>{u.role === 'volunteer' ? 'Promovează la Admin' : 'Retrogradează'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={busy} style={[styles.actionButton, styles.deleteButton]} onPress={() => confirmDelete(u)} accessibilityRole="button" accessibilityLabel={`Șterge contul ${u.full_name || u.email || ''}`}>
                    <Ionicons name="trash-outline" size={18} color="#A61E22" />
                    <Text style={styles.deleteButtonText} numberOfLines={2}>Șterge contul</Text>
                  </TouchableOpacity>
                </View>
                {u.role === 'admin' && <TouchableOpacity disabled={busy} style={styles.departmentButton} onPress={() => setExpanded(open ? null : u.user_id)} accessibilityRole="button">
                  <Text style={styles.departmentButtonText}>Departamente ({u.departments?.length ?? 0})</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} color={RED} size={17} />
                </TouchableOpacity>}
              </View>}
              {!protectedUser && u.role === 'admin' && open && <View style={styles.departmentList}>
                <Text style={styles.sectionTitle}>Departamente atribuite</Text>
                {(u.departments ?? []).length === 0 ? (
                  <Text style={styles.muted}>Acest administrator nu are departamente atribuite.</Text>
                ) : (u.departments ?? []).map(d => (
                  <View key={d.id} style={styles.departmentRow}>
                    <View style={styles.departmentAssignedIcon}><Ionicons name="checkmark" size={15} color={RED} /></View>
                    <Text style={styles.departmentName}>{d.name}</Text>
                  </View>
                ))}
                <Text style={styles.departmentHint}>Permisiunile se modifică din „Departamente și administratori”.</Text>
              </View>}
            </View>;
          })
        )}
        <TouchableOpacity style={styles.refresh} disabled={busy || loading} onPress={() => void refresh()}>
          <Ionicons name="refresh-outline" size={17} color={RED} /><Text style={styles.link}>Actualizează lista</Text>
        </TouchableOpacity>
        <Text style={styles.footer}>Doar Super Adminul poate modifica rolurile și șterge conturi. Departamentele sunt afișate informativ.</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  deleteBackdrop: { flex: 1, backgroundColor: 'rgba(10,18,30,0.62)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  deleteDialog: { width: '100%', maxWidth: 430, borderRadius: 20, padding: 24, backgroundColor: '#FFF', alignItems: 'center' },
  deleteWarning: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFF1F1', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  deleteTitle: { fontSize: 20, fontWeight: '800', color: '#202936', textAlign: 'center', marginBottom: 12 },
  deleteDescription: { fontSize: 14, lineHeight: 21, color: '#566171', textAlign: 'center', marginBottom: 20 },
  deleteInputLabel: { alignSelf: 'flex-start', color: '#273142', fontSize: 14, marginBottom: 9 },
  deleteInput: { width: '100%', minHeight: 48, borderWidth: 1.5, borderColor: '#D7DCE3', borderRadius: 11, paddingHorizontal: 14, fontSize: 16, color: '#202936', marginBottom: 20 },
  deleteDialogActions: { width: '100%', flexDirection: 'row', gap: 10 },
  deleteDialogButton: { flex: 1, minHeight: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  deleteCancel: { backgroundColor: '#F1F3F6' },
  deleteProceed: { backgroundColor: RED },
  deleteDisabled: { opacity: 0.45 },
  deleteCancelText: { color: '#273142', fontWeight: '700' },
  deleteProceedText: { color: '#FFF', fontWeight: '800', textAlign: 'center' },
  screen: { flex: 1, backgroundColor: '#F6F6F6' , ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},
  content: { flex: 1, width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 15, paddingTop: Platform.OS === 'web' ? 25 : 10, ...(Platform.OS === 'web' ? { paddingHorizontal: 28 } : {}) },
  listScroll: { flex: 1 },
  listContent: { paddingBottom: 40, paddingTop: 3 },
  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), paddingTop: 12, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, marginLeft: 13, marginRight: 8 },
  eyebrow: { color: RED, fontSize:10, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#171717', fontSize: 27, fontWeight: '900', marginTop: 1 , ...(Platform.OS === "web" ? { fontSize: 28 } : {})},
  subtitle: { color: '#777', fontSize: 12, marginTop: 0, marginBottom: 18 },
  searchBox: { backgroundColor: '#FFF', borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 51 , ...(Platform.OS === "web" ? { borderRadius: 14 } : {})},
  input: { flex: 1, fontSize: 13, color: '#171717', paddingVertical: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 13, alignItems: 'center', backgroundColor: '#FFF' },
  activeTab: { backgroundColor: RED },
  tabText: { color: '#555', fontSize: 12, fontWeight: '800' },
  activeTabText: { color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#ECECEC', ...(Platform.OS === 'web' ? { padding: 20 } : {}) },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  personName: { fontSize: 16, fontWeight: '800', color: '#171717', marginBottom: 3 },
  muted: { fontSize: 11, color: '#888', marginTop: 2 },
  role: { fontSize: 9, fontWeight: '900', color: RED, marginTop: 7, letterSpacing: 0.5 },
  actions: { gap: 10, marginTop: 14 },
  primaryActionRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  actionButton: { flex: 1, minWidth: 0, minHeight: 52, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  roleButton: { backgroundColor: '#FFF1F1', borderWidth: 1.5, borderColor: '#E4B4B4' },
  roleButtonText: { color: '#A61E22', fontSize: 12, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  departmentButton: { width: '100%', minHeight: 49, borderWidth: 1, borderColor: '#E4B4B4', backgroundColor: '#FFF9F9', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  departmentButtonText: { color: '#A61E22', fontSize: 13, fontWeight: '800' },
  deleteButton: { backgroundColor: '#FFF1F1', borderWidth: 1.5, borderColor: '#E4B4B4' },
  deleteButtonText: { color: '#A61E22', fontSize: 12, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  departmentList: { borderTopWidth: 1, borderTopColor: '#EEE', marginTop: 15, paddingTop: 13 },
  sectionTitle: { fontSize: 12, fontWeight: '800', marginBottom: 7, color: '#171717' },
  departmentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F3F3' },
  departmentName: { fontSize: 12, color: '#333', fontWeight: '600', flex: 1 },
  departmentAssignedIcon: { width: 25, height: 25, borderRadius: 9, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  departmentHint: { color: '#888', fontSize: 11, marginTop: 12, lineHeight: 17 },
  error: { color: '#A61E22', fontSize: 12, marginBottom: 10 },
  link: { color: RED, fontSize: 12, fontWeight: '800' },
  refresh: { alignSelf: 'center', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { color: '#AAA', fontSize: 10, textAlign: 'center', marginTop: 10 },
});
