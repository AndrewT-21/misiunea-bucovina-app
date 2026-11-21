import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator,  FlatList, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SchoolAdminGate from '../../../components/SchoolAdminGate';
import { useSchoolAdminPermissions } from '../../../hooks/useSchoolAdminPermissions';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';

type Assignment = { locality_id: string; locality_name: string; role: 'instructor' | 'coordinator' };
type Person = { user_id: string; full_name: string | null; nickname: string | null; email?: string | null; avatar_url?: string | null; county?: string | null; city?: string | null; eligible?: boolean; assignments?: Assignment[] };
type Locality = { id: string; name: string; is_active: boolean };
type Role = 'instructor' | 'coordinator';

// Coordonatorul are implicit si calitatea de instructor in aceeasi localitate.
// Atribuirea explicita de instructor ramane separata, pentru cazul in care
// persoana nu mai este coordonator.
const isEffectiveInstructor = (assignments: Assignment[], localityId: string) =>
  assignments.some(a => a.locality_id === localityId && (a.role === 'instructor' || a.role === 'coordinator'));


function displayName(person: Person) {
  return person.full_name?.trim() || person.nickname?.trim() || 'Voluntar fără nume';
}

function SchoolTeamScreen() {
  const { localityId } = useLocalSearchParams<{ localityId?: string }>();
  const selectedLocalityId = typeof localityId === 'string' ? localityId : undefined;
  const { rights, loadingRights } = useSchoolAdminPermissions();
  const [team, setTeam] = useState<Person[]>([]);
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const t = await supabase.rpc('school_team_directory_v2');
      if (t.error) throw t.error;
      const directory = (t.data ?? []) as Person[];
      setTeam(directory.filter(p => (p.assignments ?? []).length > 0));
      setCandidates(directory.filter(p => (p.assignments ?? []).length === 0));
      // Datele pentru editare se încarcă doar la cerere, nu pentru consultare.
      const l = await supabase.rpc('school_team_localities');
      if (!l.error) setLocalities((l.data ?? []) as Locality[]);
    } catch (e: any) {
      setError(e?.message ?? 'Nu am putut încărca echipa.');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const people = useMemo(() => {
    const list = adding
      ? candidates.filter(p => !team.some(t => t.user_id === p.user_id))
      : selectedLocalityId
        ? team.filter(p => (p.assignments ?? []).some(a => a.locality_id === selectedLocalityId))
        : team;
    const q = query.trim().toLocaleLowerCase('ro');
    return list.filter(p => [p.full_name, p.nickname, p.email, p.county, p.city].some(v => (v ?? '').toLocaleLowerCase('ro').includes(q)));
  }, [adding, candidates, query, team, selectedLocalityId]);

  function openPerson(person: Person) {
    if (loadingRights || !(rights.can_edit || rights.can_create)) return;
    if (person.eligible === false) return;
    const fromTeam = team.find(p => p.user_id === person.user_id);
    const initial: Record<string, boolean> = {};
    for (const a of fromTeam?.assignments ?? []) {
      initial[`${a.locality_id}:${a.role}`] = true;
    }
    setEnabled(initial);
    setSelected(person);
  }

  const visibleLocalities = selectedLocalityId ? localities.filter(l => l.id === selectedLocalityId) : localities;

  const coordinatorLocalityId = localities.find(
    locality => enabled[`${locality.id}:coordinator`]
  )?.id;

  function toggleRole(localityId: string, role: Role) {
    if (saving) return;
    const isCurrentlyEnabled = !!enabled[`${localityId}:${role}`];
    if (isCurrentlyEnabled ? !rights.can_delete : !rights.can_create) return;
    setEnabled(previous => {
      const key = `${localityId}:${role}`;
      if (role === 'coordinator' && !previous[key]) {
        const alreadySelectedElsewhere = localities.some(
          locality => locality.id !== localityId && previous[`${locality.id}:coordinator`]
        );
        if (alreadySelectedElsewhere) return previous;
      }
      return { ...previous, [key]: !previous[key] };
    });
  }

  async function save() {
    if (!selected || saving || loadingRights || !(rights.can_create || rights.can_edit || rights.can_delete)) return;
    const original = team.find(p => p.user_id === selected.user_id)?.assignments ?? [];
    const changes: { locality_id: string; role: Role; value: boolean }[] = [];
    for (const locality of visibleLocalities) {
      for (const role of ['instructor', 'coordinator'] as Role[]) {
        const was = original.some(a => a.locality_id === locality.id && a.role === role);
        const now = !!enabled[`${locality.id}:${role}`];
        if (was !== now) changes.push({ locality_id: locality.id, role, value: now });
      }
    }
    const coordinatorCount = localities.filter(locality => enabled[`${locality.id}:coordinator`]).length;
    if (coordinatorCount > 1) {
      Alert.alert('Restricție', 'O persoană poate coordona o singură localitate.');
      return;
    }
    // Întâi eliminăm rolurile vechi; abia apoi adăugăm atribuiri noi.
    // Astfel, schimbarea localității coordonate respectă indexul unic din Supabase.
    const orderedChanges = [
      ...changes.filter(change => !change.value),
      ...changes.filter(change => change.value),
    ];
    if (orderedChanges.some(change => change.value ? !rights.can_create : !rights.can_delete)) { Alert.alert('Acces restricționat', 'Nu ai drepturile de adăugare sau eliminare necesare.'); return; }
    setSaving(true);
    try {
      for (const change of orderedChanges) {
        const { error: rpcError } = await supabase.rpc('school_team_set_assignment', {
          p_user_id: selected.user_id,
          p_locality_id: change.locality_id,
          p_role: change.role,
          p_enabled: change.value,
        });
        if (rpcError) throw rpcError;
      }
      setSelected(null); setAdding(false); setQuery('');
      await refresh();
      Alert.alert('Salvat', 'Atribuirile au fost actualizate.');
    } catch (e: any) {
      Alert.alert('Eroare', `${e?.message ?? 'Nu s-au putut salva modificările.'}\nReîncarcă pagina pentru a verifica atribuțiile.`);
      await refresh();
    } finally { setSaving(false); }
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>ȘCOALA CREȘTINĂ</Text>
          <Text style={s.title}>{selectedLocalityId ? 'Instructori și echipă' : 'Echipă și acces'}</Text>
        </View>
      </View>
      <View style={s.body}>
        {selectedLocalityId && <Text style={s.section}>{localities.find(l => l.id === selectedLocalityId)?.name ?? 'LOCALITATE SELECTATĂ'}</Text>}
        <Text style={s.hint}>{selectedLocalityId ? 'Membrii repartizați în această localitate. Această pagină este doar pentru consultare.' : !loadingRights && !rights.can_edit && !rights.can_create ? 'Consultă instructorii și coordonatorii repartizați în localități.' : 'Selectează membri dintre conturile MisiBi eligibile și atribuie localități și roluri.'}</Text>
        {!selectedLocalityId && !loadingRights && rights.can_create && <TouchableOpacity style={s.add} onPress={() => { setAdding(v => !v); setQuery(''); }}>
          <Ionicons name={adding ? 'people-outline' : 'person-add-outline'} size={20} color="#FFF" />
          <Text style={s.addText}>{adding ? 'Înapoi la echipă' : 'Adaugă membri'}</Text>
        </TouchableOpacity>}
        <View style={s.search}>
          <Ionicons name="search-outline" size={21} color="#888" />
          <TextInput style={s.input} value={query} onChangeText={setQuery}
            placeholder="Nume, nickname, e-mail, județ, localitate..." placeholderTextColor="#999" autoCapitalize="none" />
        </View>
        <Text style={s.section}>{adding ? 'ADAUGĂ MEMBRI · CONTURI MISIBI' : selectedLocalityId ? 'ECHIPA LOCALITĂȚII' : 'ECHIPA ȘCOLII CREȘTINE'}</Text>
        {loading ? <ActivityIndicator color={RED} style={{ marginTop: 25 }} /> : error ?
          <View><Text style={s.error}>{error}</Text><TouchableOpacity onPress={refresh}><Text style={s.retry}>Reîncearcă</Text></TouchableOpacity></View> :
          <FlatList data={people} keyExtractor={p => p.user_id} contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={<Text style={s.hint}>{adding ? 'Nu există conturi disponibile.' : selectedLocalityId ? 'Nu există instructori sau coordonatori repartizați acestei localități.' : 'Nu există persoane în echipă. Adaugă un membru.'}</Text>}
            renderItem={({ item }) => <TouchableOpacity style={[s.person, item.eligible === false && { opacity: 0.72 }]} disabled={!!selectedLocalityId || loadingRights || item.eligible === false || !(adding ? rights.can_create : rights.can_edit)} onPress={() => { if (!selectedLocalityId) openPerson(item); }}>
              <View style={s.avatar}>{item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={s.avatarImage} /> : <Ionicons name="person-outline" size={22} color={RED} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{displayName(item)}</Text>
                {!!item.nickname && <Text style={s.small}>@{item.nickname}</Text>}
                <Text style={s.small}>{item.email || 'E-mail nespecificat'}</Text>
                <Text style={s.small}>{[item.city || 'Localitate nespecificată', item.county ? `jud. ${item.county}` : 'Județ nespecificat'].join(' · ')}</Text>
                <Text style={s.small}>{adding ? (item.eligible === false ? 'Cont fără profil eligibil' : 'Atribuie localități și roluri') : selectedLocalityId ? [(item.assignments ?? []).some(a => a.locality_id === selectedLocalityId && a.role === 'coordinator') ? 'Coordonator' : '', isEffectiveInstructor(item.assignments ?? [], selectedLocalityId) ? 'Instructor' : ''].filter(Boolean).join(' + ') : `${new Set((item.assignments ?? []).map(a => a.locality_id)).size} localități · ${[...(item.assignments ?? []).some(a => a.role === 'coordinator') ? ['Coordonator'] : [], ...(item.assignments ?? []).some(a => a.role === 'instructor' || a.role === 'coordinator') ? ['Instructor'] : []].join(' + ')}`}</Text>
              </View>
              {!selectedLocalityId && !loadingRights && item.eligible !== false && (adding ? rights.can_create : rights.can_edit) && <Ionicons name="chevron-forward" size={19} color="#AAA" />}
            </TouchableOpacity>} />}
      </View>

      <Modal visible={!selectedLocalityId && !!selected && (rights.can_create || rights.can_edit || rights.can_delete) && !loadingRights} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!saving) setSelected(null); }}>
        <SafeAreaView style={s.modalRoot} edges={['top', 'bottom']}>
          <View style={s.modalHeader}>
            <TouchableOpacity style={s.modalHeaderSide} onPress={() => setSelected(null)} disabled={saving} accessibilityRole="button">
              <Text style={s.cancel}>Anulează</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>{selectedLocalityId ? 'Roluri în localitate' : 'Editează rolurile'}</Text>
            <View style={s.modalHeaderSide} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
            <View style={s.profileSummary}>
              <View style={s.modalAvatar}>
                {selected?.avatar_url ? <Image source={{ uri: selected.avatar_url }} style={s.modalAvatarImage} /> : <Ionicons name="person-outline" size={26} color={RED} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.selectedName}>{selected ? displayName(selected) : ''}</Text>
                {!!selected?.nickname && <Text style={s.profileSub}>@{selected.nickname}</Text>}
                {!!selected?.email && <Text style={s.profileSub} numberOfLines={1}>{selected.email}</Text>}
              </View>
            </View>
            <View style={s.infoCard}>
              <Ionicons name="information-circle-outline" size={20} color="#777" />
              <Text style={s.infoText}>{selectedLocalityId ? 'Editezi exclusiv rolurile din această localitate. Repartizările din alte localități rămân neschimbate.' : 'Poate fi instructor în mai multe localități și coordonator într-una singură. Coordonatorul are automat și atribuții de instructor.'}</Text>
            </View>
            <View style={s.listHeading}>
              <Text style={s.sectionHeading}>LOCALITĂȚI ȘI ROLURI</Text>
              <Text style={s.countHeading}>{visibleLocalities.length} {visibleLocalities.length === 1 ? 'localitate' : 'localități'}</Text>
            </View>
            {visibleLocalities.map(locality => {
              const instructorKey = `${locality.id}:instructor`;
              const coordinatorKey = `${locality.id}:coordinator`;
              const explicitInstructor = !!enabled[instructorKey];
              const isCoordinator = !!enabled[coordinatorKey];
              const effectiveInstructor = explicitInstructor || isCoordinator;
              const coordinatorLocked = !!coordinatorLocalityId && coordinatorLocalityId !== locality.id;
              const instructorLocked = isCoordinator || (explicitInstructor ? !rights.can_delete : !rights.can_create);
              const coordinatorPermissionLocked = isCoordinator ? !rights.can_delete : !rights.can_create;
              return <View key={locality.id} style={s.locality}>
                <View style={s.localityHeading}>
                  <Ionicons name="location-outline" size={19} color={RED} />
                  <Text style={s.localityName}>{locality.name}</Text>
                  {!locality.is_active && <Text style={s.inactiveTag}>Inactivă</Text>}
                  {isCoordinator ? <View style={s.roleTag}><Text style={s.roleTagText}>Coordonator</Text></View> : effectiveInstructor ? <View style={s.roleTag}><Text style={s.roleTagText}>Instructor</Text></View> : null}
                </View>
                <View style={s.roleDivider} />
                <TouchableOpacity style={s.roleRow} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: effectiveInstructor, disabled: saving || instructorLocked }} disabled={saving || instructorLocked} onPress={() => toggleRole(locality.id, 'instructor')}>
                  <Ionicons name="book-outline" size={19} color="#777" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.roleText}>Instructor</Text>
                    {isCoordinator && <Text style={s.roleDescription}>{explicitInstructor ? 'Atribuire păstrată separat' : 'Inclus automat prin coordonare'}</Text>}
                  </View>
                  <Ionicons name={effectiveInstructor ? 'checkbox' : 'square-outline'} size={25} color={effectiveInstructor ? RED : '#A5A5A5'} />
                </TouchableOpacity>
                <TouchableOpacity style={s.roleRow} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: isCoordinator, disabled: saving || coordinatorLocked || coordinatorPermissionLocked }} disabled={saving || coordinatorLocked || coordinatorPermissionLocked} onPress={() => toggleRole(locality.id, 'coordinator')}>
                  <Ionicons name="shield-checkmark-outline" size={19} color="#777" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.roleText, coordinatorLocked && s.roleTextDisabled]}>Coordonator</Text>
                    {coordinatorLocked && <Text style={s.roleDescription}>Deja coordonator în altă localitate</Text>}
                  </View>
                  <Ionicons name={coordinatorLocked ? 'lock-closed-outline' : isCoordinator ? 'checkbox' : 'square-outline'} size={coordinatorLocked ? 21 : 25} color={coordinatorLocked ? '#B3B3B3' : isCoordinator ? RED : '#A5A5A5'} />
                </TouchableOpacity>
              </View>;
            })}
          </ScrollView>
          <View style={s.modalFooter}>
            <TouchableOpacity style={[s.saveButton, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} accessibilityRole="button">
              {saving ? <ActivityIndicator color="#FFF" /> : <Ionicons name="checkmark-circle-outline" size={21} color="#FFF" />}
              <Text style={s.saveButtonText}>{saving ? 'Se salvează...' : 'Salvează modificările'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F6F6' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: RED },
  title: { fontSize: 25, fontWeight: '900', color: DARK },
  body: { flex: 1, paddingHorizontal: 15 },
  hint: { color: '#777', fontSize: 13, lineHeight: 20, marginBottom: 15 },
  add: { backgroundColor: RED, borderRadius: 15, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  addText: { color: '#FFF', fontWeight: '800' },
  search: { backgroundColor: '#FFF', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, marginBottom: 19 },
  input: { flex: 1, height: 49, paddingHorizontal: 10, color: DARK },
  section: { fontSize: 11, fontWeight: '900', color: '#777', marginBottom: 12, letterSpacing: 1 },
  person: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE7E7', borderRadius: 18, padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { backgroundColor: '#FFF0F0', width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { color: DARK, fontSize: 15, fontWeight: '800' },
  avatarImage: { width: 45, height: 45, borderRadius: 14 },
  small: { color: '#888', fontSize: 13, marginTop: 4 },
  error: { color: RED, marginTop: 10 },
  retry: { color: RED, fontWeight: '800', marginTop: 10 },
  modalRoot: { flex: 1, backgroundColor: '#F6F6F6' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, paddingVertical: 18, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0EEEE' },
  modalHeaderSide: { minWidth: 76 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: DARK },
  cancel: { color: '#777', fontSize: 14 },
  modalContent: { paddingHorizontal: 17, paddingTop: 20, paddingBottom: 30 },
  profileSummary: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 18 },
  modalAvatar: { width: 55, height: 55, borderRadius: 18, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  modalAvatarImage: { width: 55, height: 55, borderRadius: 18 },
  selectedName: { fontSize: 20, fontWeight: '900', color: DARK },
  profileSub: { color: '#858585', fontSize: 12, marginTop: 3 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#EBEBEB', borderRadius: 14, padding: 13, marginBottom: 23 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#666' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionHeading: { fontSize: 11, letterSpacing: 1, fontWeight: '900', color: '#777' },
  countHeading: { fontSize: 12, color: '#888' },
  locality: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAE6E6', borderRadius: 17, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 4, marginBottom: 11 },
  localityHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 28 },
  localityName: { flex: 1, color: DARK, fontSize: 16, fontWeight: '800' },
  inactiveTag: { color: '#999', fontSize: 11 },
  roleTag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#FCEDEE' },
  roleTagText: { color: RED, fontSize: 10, fontWeight: '800' },
  roleDivider: { height: 1, backgroundColor: '#F0EEEE', marginTop: 12, marginBottom: 3 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 53, paddingVertical: 8 },
  roleText: { color: DARK, fontSize: 14, fontWeight: '700' },
  roleDescription: { color: '#929292', fontSize: 11, marginTop: 3 },
  roleTextDisabled: { color: '#999' },
  modalFooter: { paddingHorizontal: 17, paddingTop: 12, paddingBottom: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE' },
  saveButton: { backgroundColor: RED, borderRadius: 14, minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveButtonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});

export default function ProtectedSchoolTeamScreen() {
  return <SchoolAdminGate permission="can_view"><SchoolTeamScreen /></SchoolAdminGate>;
}
