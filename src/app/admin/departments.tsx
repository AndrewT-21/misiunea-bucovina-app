import { Platform } from 'react-native';
import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Switch } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BG = '#F6F6F6';
type AdminUser = { user_id: string; full_name: string | null; nickname: string | null; email: string | null };
type AdminPermission = { admin_user_id: string; department_id: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; admin_enabled: boolean };
type Rights = Pick<AdminPermission, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'>;
const DEPARTMENT_ROUTES: Record<string,string> = {
  'scoala-crestina': '/admin/school',
  'solicitari-ajutor': '/admin/help-requests',
  'calendar-activitati': '/admin/calendar-proposals',
  'post-rugaciune': '/admin/prayer',
  'post-si-rugaciune': '/admin/prayer',
  'cazuri': '/admin/cases',
  'proiecte': '/admin/projects',
  'comunicare': '/admin/news',
  'donatii': '/admin/donations',
  'rapoarte': '/admin/reports',
  'cereri-voluntariat': '/admin/volunteers',
  'voluntariat': '/admin/volunteer-page'
};
const PAGE_OPTIONS = [
  { label: 'Calendar și propuneri', slug: 'calendar-activitati' },
  { label: 'Post și rugăciune', slug: 'post-rugaciune' },
  { label: 'Cazuri', slug: 'cazuri' },
  { label: 'Proiecte', slug: 'proiecte' },
  { label: 'Cereri voluntariat', slug: 'cereri-voluntariat' },
  { label: 'Școala Creștină', slug: 'scoala-crestina' },
  { label: 'Solicitări ajutor', slug: 'solicitari-ajutor' },
  { label: 'Comunicare', slug: 'comunicare' },
  { label: 'Donații', slug: 'donatii' },
  { label: 'Rapoarte', slug: 'rapoarte' },
  { label: 'Voluntariat', slug: 'voluntariat' },
];
const EMPTY_RIGHTS: Rights = { can_view: false, can_create: false, can_edit: false, can_delete: false };
const RIGHT_FIELDS: { key: keyof Rights; label: string }[] = [
  { key: 'can_view', label: 'Vizualizare' }, { key: 'can_create', label: 'Creare' },
  { key: 'can_edit', label: 'Editare' }, { key: 'can_delete', label: 'Ștergere' },
];


type Department = {
  id: string; slug: string; name: string; description: string | null;
  is_active: boolean; admin_count: number;
};

export default function DepartmentsScreen() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchFocused,setSearchFocused]=useState(false);
  const [departmentStatus, setDepartmentStatus] = useState<'active' | 'inactive'>('active');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [manageDept, setManageDept] = useState<Department | null>(null);
  const [draftRights, setDraftRights] = useState<Record<string, Rights>>({});
  const [adminSearch, setAdminSearch] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [configureOnCreate, setConfigureOnCreate] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.replace('/admin-login'); return;
      }
      const { data: allowed, error: roleError } = await supabase.rpc('misibi_is_super_admin');
      if (roleError) throw roleError;
      if (allowed !== true) {
        router.replace('/admin-login'); return;
      }
      const { data, error: rpcError } = await supabase.rpc('super_admin_manage_departments_list');
      if (rpcError) throw rpcError;
      setItems((data ?? []) as Department[]);
    } catch (e: any) {
      setError(e?.message || 'Nu am putut încărca departamentele.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const filtered = useMemo(() => items.filter(d =>
    (departmentStatus === 'active' ? d.is_active : !d.is_active) &&
    d.name.toLocaleLowerCase('ro')
      .includes(search.trim().toLocaleLowerCase('ro'))
  ), [items, departmentStatus, search]);

  function openCreate() {
    setEditing(null); setName(''); setSlug(''); setDescription(''); setConfigureOnCreate(false); setPagePickerOpen(false); setModal(true);
  }
  function openEdit(d: Department) {
    setEditing(d); setName(d.name); setSlug(d.slug);
    setDescription(d.description || ''); setPagePickerOpen(false); setModal(true);
  }
  function normalizeSlug(v: string) {
    return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  }
  async function save() {
    const finalName = name.trim();
    const finalSlug = normalizeSlug(slug || name);
    if (!finalName || !/^[a-z][a-z0-9_-]*$/.test(finalSlug)) {
      Alert.alert('Date invalide', 'Introdu un nume și un identificator care începe cu o literă.');
      return;
    }
    if (PAGE_OPTIONS.some(option => option.slug === finalSlug) && items.some(d => d.slug === finalSlug && d.id !== editing?.id)) {
      Alert.alert('Pagină deja asociată', 'Există deja un departament cu această pagină. Editează departamentul existent sau alege altă pagină.');
      return;
    }
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('super_admin_save_department', {
        p_id: editing?.id ?? null,
        p_name: finalName,
        p_slug: finalSlug,
        p_description: description.trim() || null,
      });
      if (rpcError) throw rpcError;
      setModal(false);
      await refresh();
      if (!editing && configureOnCreate) {
        const { data: newRows, error: listError } = await supabase.rpc('super_admin_manage_departments_list');
        if (listError) throw listError;
        const created = ((newRows ?? []) as Department[]).find(d => d.slug === finalSlug);
        if (created) await openManage(created);
        else Alert.alert('Departament salvat', 'Deschide „Administratori” din card pentru a atribui drepturile.');
      }
    } catch (e: any) {
      Alert.alert('Eroare', e?.message || 'Nu am putut salva departamentul.');
    } finally { setBusy(false); }
  }
  async function openManage(d: Department) {
    setManageDept(d);
    setAdminSearch('');
    setAdminLoading(true);
    setAdminError('');
    try {
      const [usersResult, permissionsResult] = await Promise.all([
        supabase.rpc('super_admin_list_users'),
        supabase.rpc('misibi_admin_permissions_list'),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (permissionsResult.error) throw permissionsResult.error;
      const rows = (permissionsResult.data ?? []) as AdminPermission[];
      const users = (usersResult.data ?? []) as AdminUser[];
      // The permission list contains one row per admin/department, including unassigned admins.
      const eligibleIds = new Set(rows.map(r => r.admin_user_id));
      setAdmins(users.filter(u => eligibleIds.has(u.user_id)));
      setPermissions(rows);
      const next: Record<string, Rights> = {};
      for (const row of rows.filter(r => r.department_id === d.id)) {
        next[row.admin_user_id] = {
          can_view: !!row.can_view, can_create: !!row.can_create,
          can_edit: !!row.can_edit, can_delete: !!row.can_delete,
        };
      }
      setDraftRights(next);
    } catch (e: any) {
      setAdminError(e?.message || 'Nu am putut încărca administratorii.');
    } finally { setAdminLoading(false); }
  }
  function updateDraft(id: string, key: keyof Rights, value: boolean) {
    setDraftRights(old => {
      const next = { ...(old[id] ?? EMPTY_RIGHTS), [key]: value };
      if (key === 'can_view' && !value) {
        next.can_create = false; next.can_edit = false; next.can_delete = false;
      } else if (key !== 'can_view' && value) next.can_view = true;
      return { ...old, [id]: next };
    });
  }
  async function saveRights(id: string, rights: Rights) {
    if (!manageDept || busy) return;
    setBusy(true);
    try {
      const { error: saveError } = await supabase.rpc('misibi_set_admin_permissions', {
        p_admin_user_id: id, p_department_id: manageDept.id,
        p_can_view: rights.can_view, p_can_create: rights.can_create,
        p_can_edit: rights.can_edit, p_can_delete: rights.can_delete,
      });
      if (saveError) throw saveError;
      await refresh();
      Alert.alert('Salvat', rights.can_view ? 'Permisiunile au fost actualizate.' : 'Administratorul a fost eliminat din departament.');
    } catch (e: any) {
      Alert.alert('Eroare', e?.message || 'Nu am putut salva permisiunile.');
    } finally { setBusy(false); }
  }
  const adminLabel = (u: AdminUser) => u.nickname?.trim() || u.full_name?.trim() || u.email || 'Administrator';
  function deleteDepartment(d: Department) {
    if (busy) return;
    Alert.alert(
      'Șterge departamentul?',
      `Departamentul „${d.name}” va fi șters definitiv. Această operație nu poate fi anulată.\n\nDepartamentele cu administratori atribuiți trebuie mai întâi golite.`,
      [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Șterge departamentul', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            const { error: rpcError } = await supabase.rpc('super_admin_delete_department', { p_id: d.id });
            if (rpcError) throw rpcError;
            await refresh();
          } catch (e: any) {
            Alert.alert('Nu s-a putut șterge', e?.message || 'Încearcă din nou.');
          } finally { setBusy(false); }
        } },
      ],
    );
  }

  function toggleActive(d: Department) {
    Alert.alert(
      d.is_active ? 'Dezactivezi departamentul?' : 'Reactivezi departamentul?',
      d.is_active
        ? `„${d.name}” nu va mai apărea în lista departamentelor active. Datele și asignările nu se șterg.`
        : `„${d.name}” va fi din nou activ.`,
      [
        { text: 'Anulează', style: 'cancel' },
        { text: 'Confirmă', style: d.is_active ? 'destructive' : 'default', onPress: async () => {
          setBusy(true);
          try {
            const { error: rpcError } = await supabase.rpc('super_admin_set_department_active', {
              p_id: d.id, p_active: !d.is_active,
            });
            if (rpcError) throw rpcError;
            await refresh();
          } catch (e: any) {
            Alert.alert('Eroare', e?.message || 'Operația nu a reușit.');
          } finally { setBusy(false); }
        } },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={DARK} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>ADMINISTRARE</Text>
          <Text style={styles.title}>Departamente și administratori</Text>
        </View>
        
      </View>
      <View style={{paddingHorizontal:16,marginBottom:14,gap:12,...(Platform.OS === "web" ? {width:"100%" as const,maxWidth:1040,alignSelf:"center" as const,paddingHorizontal:32} : {})}}>
        <TouchableOpacity style={{backgroundColor:RED,borderRadius:14,paddingHorizontal:18,minHeight:46,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9,alignSelf:"flex-start"}} onPress={openCreate} disabled={busy}>
          <Ionicons name="add" size={25} color="#FFFFFF" />
        <Text style={{fontSize:14,fontWeight:"800",color:"#FFF"}}>Adaugă departament</Text></TouchableOpacity>
        <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:14,paddingHorizontal:13,minHeight:46,gap:9,...(Platform.OS==='web'?{width:searchFocused? '100%' as const:230,maxWidth:'100%' as const}: {})}}>
          <Ionicons name="search-outline" size={19} color="#888" />
          <TextInput style={{flex:1,fontSize:14,color:'#171717'}} placeholder="Caută după nume..." placeholderTextColor="#999" value={search} onChangeText={setSearch} autoCorrect={false} onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)} />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>Departamente interne și administratori atribuiți</Text>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>ORGANIZARE</Text>
            <Text style={styles.sectionTitle}>{departmentStatus === 'active' ? 'Departamente active' : 'Departamente inactive'}</Text>
          </View>
          <View style={styles.countBadge}><Text style={styles.countText}>{filtered.length}</Text></View>
        </View>
        <View style={styles.statusTabs}>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: departmentStatus === 'active' }}
            style={[styles.statusTab, departmentStatus === 'active' && styles.statusTabSelected]}
            onPress={() => setDepartmentStatus('active')}>
            <Text style={[styles.statusTabText, departmentStatus === 'active' && styles.statusTabTextSelected]}>Active ({items.filter(d => d.is_active).length})</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: departmentStatus === 'inactive' }}
            style={[styles.statusTab, departmentStatus === 'inactive' && styles.statusTabSelected]}
            onPress={() => setDepartmentStatus('inactive')}>
            <Text style={[styles.statusTabText, departmentStatus === 'inactive' && styles.statusTabTextSelected]}>Inactive ({items.filter(d => !d.is_active).length})</Text>
          </TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator color={RED} size="large" style={{ marginTop: 30 }} />
        : error ? <View style={styles.card}><Text style={styles.error}>{error}</Text>
            <TouchableOpacity onPress={() => void refresh()}><Text style={styles.link}>Reîncearcă</Text></TouchableOpacity></View>
        : filtered.length === 0 ? <View style={styles.card}><Text style={styles.muted}>Nu există departamente pentru această selecție.</Text></View>
        : filtered.map(d => <View key={d.id} style={styles.card}>
            <View style={styles.itemRow}>
              <View style={styles.iconBox}><Ionicons name="school-outline" size={23} color={RED} /></View>
              <View style={{ flex: 1, paddingRight: 108 }}>
                <Text style={styles.itemName}>{d.name}</Text>
                <Text style={styles.muted}>{d.description || 'Fără descriere'}</Text>
                <Text style={styles.meta}>{d.admin_count} administratori · {d.is_active ? 'ACTIV' : 'INACTIV'}</Text>
              </View>
            </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Șterge departamentul ${d.name}`}
                disabled={busy}
                onPress={() => deleteDepartment(d)}
                style={styles.compactDeleteButton}>
                <Ionicons name="trash-outline" size={14} color={RED} />
                <Text style={styles.compactDeleteText}>Șterge</Text>
              </TouchableOpacity>
            <View style={styles.actions}>
              {d.is_active && DEPARTMENT_ROUTES[d.slug] && (
                <TouchableOpacity style={styles.outlineButton} onPress={() => router.push(DEPARTMENT_ROUTES[d.slug] as any)} disabled={busy}>
                  <Ionicons name="enter-outline" size={17} color={RED} />
                  <Text style={styles.outlineText}>Deschide</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.outlineButton} onPress={() => void openManage(d)} disabled={busy}>
                <Ionicons name="people-outline" size={17} color={RED} /><Text style={styles.outlineText}>Administratori</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={() => openEdit(d)} disabled={busy}>
                <Ionicons name="create-outline" size={17} color={RED} /><Text style={styles.outlineText}>Editează</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineButton} onPress={() => toggleActive(d)} disabled={busy}>
                <Ionicons name={d.is_active ? 'pause-circle-outline' : 'checkmark-circle-outline'} size={17} color={RED} />
                <Text style={styles.outlineText}>{d.is_active ? 'Dezactivează' : 'Reactivează'}</Text>
              </TouchableOpacity>
            </View>
          </View>)}
        <Text style={styles.footnote}>Atribuie administratori din butonul „Administratori”. Folosește „Deschide” pentru a intra în modulul departamentului.</Text>
      </ScrollView>
      <Modal visible={modal} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => !busy && setModal(false)}>
        <SafeAreaProvider>
        <SafeAreaView style={styles.editorScreen} edges={['top', 'bottom']}>
          <View style={styles.editorHeader}>
            <TouchableOpacity accessibilityLabel="Înapoi" style={styles.editorBack} onPress={() => !busy && setModal(false)}>
              <Ionicons name="chevron-back" size={24} color={DARK} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.editorEyebrow}>ADMINISTRARE</Text>
              <Text style={styles.editorTitle}>{editing ? 'Editează departamentul' : 'Departament nou'}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <View style={styles.editorPanel}>
              <Text style={styles.editorSectionTitle}>Detalii departament</Text>
              <Text style={styles.editorHelp}>Configurează numele, descrierea și pagina pe care o va deschide departamentul.</Text>
              <Text style={styles.fieldLabel}>Nume departament</Text>
              <TextInput style={styles.field} value={name} onChangeText={setName} placeholder="Ex. Calendar și activități" placeholderTextColor="#999" />
              <Text style={styles.fieldLabel}>Pagina asociată</Text>
              <TouchableOpacity accessibilityRole="button" style={styles.pageSelect} onPress={() => setPagePickerOpen(v => !v)}>
                <Ionicons name="layers-outline" size={19} color={RED} />
                <Text style={styles.pageSelectText}>{PAGE_OPTIONS.find(option => option.slug === slug)?.label || 'Fără pagină asociată'}</Text>
                <Ionicons name={pagePickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={RED} />
              </TouchableOpacity>
              {pagePickerOpen && <View style={styles.pageOptions}>
                <TouchableOpacity style={styles.pageOption} onPress={() => { setPagePickerOpen(false); if (PAGE_OPTIONS.some(option => option.slug === slug)) setSlug(''); }}>
                  <Text style={styles.pageOptionText}>Fără pagină asociată</Text>
                </TouchableOpacity>
                {PAGE_OPTIONS.map(option => <TouchableOpacity key={option.slug} style={styles.pageOption}
                  onPress={() => { setSlug(option.slug); setPagePickerOpen(false); }}>
                  <Text style={[styles.pageOptionText, slug === option.slug && { color: RED, fontWeight: '900' }]}>{option.label}</Text>
                  {slug === option.slug && <Ionicons name="checkmark-circle" size={19} color={RED} />}
                </TouchableOpacity>)}
              </View>}
              <Text style={styles.fieldLabel}>Identificator (slug)</Text>
              <TextInput style={styles.field} value={slug} onChangeText={setSlug} autoCapitalize="none" autoCorrect={false} placeholder="ex. calendar-activitati" placeholderTextColor="#999" />
              <Text style={styles.editorHelp}>Pagina selectată completează automat identificatorul. Pentru pagini noi este necesară și configurarea rutei în aplicație.</Text>
              <Text style={styles.fieldLabel}>Descriere</Text>
              <TextInput style={[styles.field, { minHeight: 100, textAlignVertical: 'top' }]} multiline value={description}
                onChangeText={setDescription} placeholder="Descrie responsabilitățile departamentului" placeholderTextColor="#999" />
              {!editing && <TouchableOpacity style={styles.optionRow} onPress={() => setConfigureOnCreate(v => !v)}>
                <Ionicons name={configureOnCreate ? 'checkbox' : 'square-outline'} color={RED} size={22} />
                <Text style={styles.optionText}>Atribuie administratori după creare (opțional)</Text>
              </TouchableOpacity>}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} disabled={busy} onPress={() => setModal(false)}><Text style={styles.cancelText}>Anulează</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} disabled={busy} onPress={() => void save()}>
                {busy ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>{editing ? 'Salvează modificările' : 'Creează departamentul'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
      <Modal visible={!!manageDept} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) { Keyboard.dismiss(); setManageDept(null); } }}>
        <SafeAreaProvider>
        <SafeAreaView style={styles.editorScreen} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.manageCard}>
            <View style={styles.editorHeader}>
              <TouchableOpacity accessibilityLabel="Înapoi" style={styles.editorBack} onPress={() => { if (!busy) { Keyboard.dismiss(); setManageDept(null); } }}>
                <Ionicons name="chevron-back" size={24} color={DARK} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.editorEyebrow}>ADMINISTRARE</Text>
                <Text style={[styles.editorTitle, { fontSize: 22 }]}>Administratori și permisiuni</Text>
              </View>
            </View>
            <Text style={[styles.muted, { marginBottom: 12 }]}>{manageDept?.name}</Text>
            <TextInput style={[styles.field, { marginTop: 16, marginBottom: 10 }]} placeholder="Caută administrator..."
              value={adminSearch} onChangeText={setAdminSearch} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator>
              {adminLoading ? <ActivityIndicator color={RED} /> : adminError ? <Text style={styles.error}>{adminError}</Text>
                : admins.length === 0 ? <Text style={styles.muted}>Nu există administratori obișnuiți disponibili.</Text>
                : admins.filter(u => `${adminLabel(u)} ${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(adminSearch.trim().toLowerCase())).map(u => {
                  const rights = draftRights[u.user_id] ?? EMPTY_RIGHTS;
                  const original = permissions.find(p => p.admin_user_id === u.user_id && p.department_id === manageDept?.id);
                  const changed = (Object.keys(EMPTY_RIGHTS) as (keyof Rights)[]).some(key => rights[key] !== !!original?.[key]);
                  return <View key={u.user_id} style={styles.adminCard}>
                    <Text style={styles.itemName}>{adminLabel(u)}</Text>
                    {!!u.email && <Text style={styles.muted}>{u.email}</Text>}
                    {RIGHT_FIELDS.map(({ key, label }) => <View key={key} style={styles.permissionRow}>
                      <Text style={{ color: DARK, flex: 1 }}>{label}</Text>
                      <Switch value={rights[key]} disabled={busy} onValueChange={v => updateDraft(u.user_id, key, v)}
                        trackColor={{ false: '#D1D1D6', true: '#2CC65D' }} thumbColor="#FFFFFF" />
                    </View>)}
                    <TouchableOpacity style={[styles.saveButton, { marginTop: 12, opacity: changed && !busy ? 1 : 0.5 }]}
                      disabled={!changed || busy} onPress={() => void saveRights(u.user_id, rights)}>
                      <Text style={styles.saveText}>{rights.can_view ? 'Salvează permisiunile' : original?.can_view ? 'Elimină din departament' : 'Fără acces'}</Text>
                    </TouchableOpacity>
                  </View>;
                })}
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG , ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},
  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), paddingHorizontal: 15, paddingTop: 12, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, marginLeft: 13 },
  eyebrow: { color: RED, fontSize:10, fontWeight: '900', letterSpacing: 1 },
  title: { color: DARK, fontSize: 27, fontWeight: '900', marginTop: 1 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), paddingHorizontal: 15, paddingBottom: 35 , ...(Platform.OS === "web" ? { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 28, paddingBottom: 65 } : {})},
  intro: { color: '#888', fontSize: 11, marginBottom: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 15, paddingHorizontal: 13, minHeight: 48, marginBottom: 22 },
  searchInput: { flex: 1, fontSize: 13, color: DARK },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  sectionEyebrow: { color: RED, fontSize: 8, fontWeight: '900', letterSpacing: 1, marginBottom: 3 },
  sectionTitle: { color: DARK, fontSize: 19, fontWeight: '900' },
  countBadge: { minWidth: 31, height: 31, paddingHorizontal: 9, borderRadius: 16, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  countText: { color: RED, fontSize: 11, fontWeight: '900' },
  statusTabs: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statusTab: { flex: 1, minHeight: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E8E8E8' },
  statusTabSelected: { backgroundColor: RED, borderColor: RED },
  statusTabText: { color: DARK, fontSize: 13, fontWeight: '800' },
  statusTabTextSelected: { color: '#FFF' },
  toggleText: { fontSize: 11, color: '#777', fontWeight: '700' },
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 15, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactDeleteButton: { position: 'absolute', top: 15, right: 15, zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 9, minHeight: 32, borderRadius: 9, backgroundColor: '#FFF2F2', borderWidth: 1, borderColor: '#F3D0D0', alignSelf: 'center' },
  compactDeleteText: { fontSize: 11, fontWeight: '800', color: RED },
  iconBox: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  itemName: { color: DARK, fontSize: 14, fontWeight: '900' },
  muted: { color: '#888', fontSize: 11, marginTop: 4 },
  meta: { color: RED, fontSize: 9, fontWeight: '900', marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 10, marginTop: 15 },
  outlineButton: { width: '48%', minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#FFF0F0' },
  outlineText: { color: RED, fontSize: 11, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  error: { color: RED, marginBottom: 10 }, link: { color: RED, fontWeight: '800' },
  footnote: { color: '#999', fontSize: 10, textAlign: 'center', marginTop: 18, lineHeight: 16 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  manageOverlay: { flex: 1, justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', backgroundColor: 'rgba(0,0,0,0.35)' },
  manageCard: { flex: 1, backgroundColor: BG, paddingHorizontal: 18, paddingBottom: 12, width: '100%', maxWidth: 760, alignSelf: 'center' },
  editorScreen: { flex: 1, backgroundColor: BG },
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 18, paddingVertical: 18 },
  editorBack: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  editorEyebrow: { color: RED, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  editorTitle: { color: DARK, fontSize: 25, fontWeight: '900', marginTop: 3 },
  editorContent: { paddingHorizontal: 18, paddingBottom: 45, maxWidth: 760, width: '100%', alignSelf: 'center' },
  editorPanel: { backgroundColor: '#FFF', borderRadius: 22, padding: 20 },
  editorSectionTitle: { color: DARK, fontSize: 19, fontWeight: '900' },
  editorHelp: { color: '#777', fontSize: 12, lineHeight: 19, marginTop: 7, marginBottom: 8 },
  pageSelect: { backgroundColor: BG, borderRadius: 12, minHeight: 49, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageSelectText: { flex: 1, color: DARK, fontSize: 13, fontWeight: '700' },
  pageOptions: { borderRadius: 12, borderWidth: 1, borderColor: '#E9E9E9', marginTop: 6, overflow: 'hidden' },
  pageOption: { paddingHorizontal: 13, minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  pageOptionText: { color: DARK, fontSize: 13 },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 35 },
  modalTitle: { color: DARK, fontSize: 20, fontWeight: '900', marginBottom: 16 },
  fieldLabel: { color: DARK, fontSize: 11, fontWeight: '800', marginBottom: 5, marginTop: 10 },
  field: { backgroundColor: BG, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: DARK, fontSize: 13 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 },
  optionText: { color: DARK, fontSize: 12, fontWeight: '700', flex: 1 },
  adminCard: { borderWidth: 1, borderColor: '#EEEEEE', borderRadius: 14, padding: 13, marginBottom: 12 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 45, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: '#EEE' },
  cancelText: { color: DARK, fontWeight: '800' },
  saveButton: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 12, backgroundColor: RED },
  saveText: { color: '#FFF', fontWeight: '900' },
});
