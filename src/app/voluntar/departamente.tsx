import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
type Locality = { id: string; name: string; is_active: boolean };
type Role = 'Instructor' | 'Coordonator';
type AssignedLocality = Locality & { roles: Role[] };
type LocalityRow = Locality & { is_instructor: boolean; is_coordinator: boolean };

export default function VolunteerDepartmentsScreen() {
  const [localities, setLocalities] = useState<AssignedLocality[]>([]);
  const [isSchoolManager, setIsSchoolManager] = useState(false);
  const [canEditVolunteering, setCanEditVolunteering] = useState(false);
  const [canViewVolunteering, setCanViewVolunteering] = useState(false);
  const [hasDatabaseAccess, setHasDatabaseAccess] = useState(false);
  const [canManageWeeklySchedule, setCanManageWeeklySchedule] = useState(false);
  const [databaseAccessError, setDatabaseAccessError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    setDatabaseAccessError('');
    setHasDatabaseAccess(false);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setLocalities([]);
        setIsSchoolManager(false);
        setCanEditVolunteering(false);
        setCanViewVolunteering(false);
        setHasDatabaseAccess(false);
        router.replace('/voluntar/login' as any);
        return;
      }

      const [localitiesResult, managerResult, weeklyResult, volunteeringResult, superAdminResult] = await Promise.all([
        supabase.rpc('school_my_localities'),
        supabase.rpc('school_is_manager'),
        supabase.rpc('weekly_schedule_can_manage'),
        supabase.rpc('misibi_my_admin_permissions'),
        supabase.rpc('misibi_is_super_admin'),
      ]);
      if (localitiesResult.error) throw localitiesResult.error;
      if (managerResult.error) throw managerResult.error;

      setIsSchoolManager(managerResult.data === true);
      const volunteerPermission = ((volunteeringResult.data ?? []) as { department_slug: string; can_view: boolean; can_edit: boolean }[])
        .find(permission => permission.department_slug === 'voluntariat');
      const isSuperAdmin = !superAdminResult.error && superAdminResult.data === true;
      setCanViewVolunteering(isSuperAdmin || (!volunteeringResult.error && (volunteerPermission?.can_view === true || volunteerPermission?.can_edit === true)));
      setCanEditVolunteering(isSuperAdmin || (!volunteeringResult.error && volunteerPermission?.can_edit === true));
      // Permisiunea pentru program este independentă de departamentele școlii.
      // O eroare aici nu trebuie să blocheze afișarea celorlalte departamente.
      if (weeklyResult.error) {
        console.warn('Nu am putut verifica permisiunea pentru programul săptămânal:', weeklyResult.error.message);
        setCanManageWeeklySchedule(false);
      } else {
        setCanManageWeeklySchedule(weeklyResult.data === true);
      }
      // Verificare separată: erorile bazei de date nu trebuie să blocheze Școala Creștină.
      const { data: databasePermissions, error: databaseError } = await supabase
        .from('mdb_permissions')
        .select('database_id')
        .eq('user_id', user.id)
        .eq('can_view', true)
        .limit(1);
      if (databaseError) {
        setDatabaseAccessError('Nu am putut verifica accesul la bazele de date: ' + databaseError.message);
      } else {
        setHasDatabaseAccess((databasePermissions ?? []).length > 0);
      }
      setLocalities(((localitiesResult.data ?? []) as LocalityRow[]).map(l => ({
        id: l.id,
        name: l.name,
        is_active: l.is_active,
        roles: [
          ...(l.is_instructor ? ['Instructor' as Role] : []),
          ...(l.is_coordinator ? ['Coordonator' as Role] : []),
        ],
      })));
    } catch (e: any) {
      setLocalities([]);
      setIsSchoolManager(false);
      setCanEditVolunteering(false);
      setCanViewVolunteering(false);
      setError(e?.message ?? 'Nu am putut încărca departamentele.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const openAttendance = (localityId: string, view: 'instructor' | 'coordinator') => {
    router.push({
      pathname: '/voluntar/prezenta/[localityId]',
      params: { localityId, view },
    } as any);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.headerOuter}>
        <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))} accessibilityLabel="Înapoi">
          <Ionicons name="chevron-back" size={24} color={DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>SPAȚIUL MEU</Text>
          <Text style={s.title}>Departamentele mele</Text>
        </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={[s.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}>
        <Text style={s.pageDescription}>Accesează departamentele și modulele pentru care ai permisiuni.</Text>
        <Text style={s.sectionLabel}>ADMINISTRARE</Text>

        {loading ? <ActivityIndicator color={RED} style={{ marginTop: 24 }} /> : error ? (
          <View>
            <Text style={s.error}>{error}</Text>
            <TouchableOpacity onPress={() => void refresh()} style={s.retry}>
              <Text style={s.retryText}>Reîncearcă</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {isSchoolManager && (
              <TouchableOpacity
                style={s.adminCard}
                onPress={() => router.push('/admin/school' as any)}
                accessibilityRole="button"
                accessibilityLabel="Deschide administrarea Școlii Creștine"
              >
                <View style={s.adminIcon}><Ionicons name="shield-checkmark-outline" size={25} color="#FFF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.adminTitle}>Administrare Școala Creștină</Text>
                  <Text style={s.adminSubtitle}>Panou administrator · toate localitățile și rapoartele</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            )}

            {canViewVolunteering && (
              <TouchableOpacity
                style={s.databaseCard}
                onPress={() => router.push((canEditVolunteering ? '/admin/volunteer-page' : '/voluntariat') as any)}
                accessibilityRole="button"
                accessibilityLabel={canEditVolunteering ? 'Editează pagina Voluntariat' : 'Vizualizează pagina Voluntariat'}
              >
                <View style={s.databaseIcon}><Ionicons name="people-outline" size={25} color={RED} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.databaseTitle}>Voluntariat</Text>
                  <Text style={s.databaseSubtitle}>{canEditVolunteering ? 'Editează textele, imaginile și formularul de voluntariat' : 'Vizualizează pagina publică de voluntariat'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={RED} />
              </TouchableOpacity>
            )}

            {canEditVolunteering && (
              <TouchableOpacity style={s.databaseCard} onPress={() => router.push('/admin/volunteer-directory' as any)} accessibilityRole="button">
                <View style={s.databaseIcon}><Ionicons name="images-outline" size={25} color={RED} /></View>
                <View style={{ flex: 1 }}><Text style={s.databaseTitle}>Voluntarii noștri</Text><Text style={s.databaseSubtitle}>Adaugă, editează și publică profilurile voluntarilor</Text></View>
                <Ionicons name="chevron-forward" size={20} color={RED}/>
              </TouchableOpacity>
            )}

            {canManageWeeklySchedule && (
              <TouchableOpacity
                style={s.databaseCard}
                onPress={() => router.push('/admin/weekly-schedule' as any)}
                accessibilityRole="button"
                accessibilityLabel="Deschide administrarea programului săptămânal"
              >
                <View style={s.databaseIcon}><Ionicons name="calendar-outline" size={25} color={RED} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.databaseTitle}>Program săptămânal</Text>
                  <Text style={s.databaseSubtitle}>Planifică și asignează activități</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={RED} />
              </TouchableOpacity>
            )}

            {hasDatabaseAccess && (
              <TouchableOpacity
                style={s.databaseCard}
                onPress={() => router.push('/admin/databases' as any)}
                accessibilityRole="button"
                accessibilityLabel="Deschide bazele de date"
              >
                <View style={s.databaseIcon}><Ionicons name="server-outline" size={25} color={RED} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.databaseTitle}>Baze de date</Text>
                  <Text style={s.databaseSubtitle}>Bazele de date la care ai primit acces</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={RED} />
              </TouchableOpacity>
            )}
            {!!databaseAccessError && <Text style={s.databaseError}>{databaseAccessError}</Text>}

            <View style={s.department}>
              <View style={s.departmentIcon}><Ionicons name="school-outline" size={23} color={RED} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.departmentName}>Școala Creștină</Text>
                <Text style={s.subtitle}>Acces separat în funcție de responsabilitatea ta</Text>
              </View>
            </View>

            {localities.some(l => l.roles.includes('Coordonator')) && (
              <View style={{ marginBottom: 14 }}>
                <Text style={s.sectionLabel}>COORDONARE</Text>
                {localities.filter(l => l.roles.includes('Coordonator')).map(locality => (
                  <TouchableOpacity key={`coordinator-${locality.id}`} style={[s.databaseCard, !locality.is_active && s.inactive]}
                    disabled={!locality.is_active} onPress={() => openAttendance(locality.id, 'coordinator')} accessibilityRole="button"
                    accessibilityLabel={`Coordonare întâlniri - ${locality.name}`}>
                    <View style={s.databaseIcon}><Ionicons name="calendar-outline" size={24} color={RED}/></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.databaseTitle}>Coordonator · {locality.name}</Text>
                      <Text style={s.databaseSubtitle}>Organizează echipa întâlnirii, activitățile și prezențele{!locality.is_active ? ' · Localitate inactivă' : ''}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={19} color={RED}/>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {localities.some(l => l.roles.includes('Instructor')) && (
              <View style={{ marginBottom: 14 }}>
                <Text style={s.sectionLabel}>INSTRUCTOR</Text>
                {localities.filter(l => l.roles.includes('Instructor')).map(locality => (
                  <TouchableOpacity key={`instructor-${locality.id}`} style={[s.databaseCard, !locality.is_active && s.inactive]}
                    disabled={!locality.is_active} onPress={() => openAttendance(locality.id, 'instructor')} accessibilityRole="button"
                    accessibilityLabel={`Activitatea mea ca instructor - ${locality.name}`}>
                    <View style={s.databaseIcon}><Ionicons name="person-outline" size={24} color={RED}/></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.databaseTitle}>Instructor · {locality.name}</Text>
                      <Text style={s.databaseSubtitle}>Programări, confirmări și activități{!locality.is_active ? ' · Localitate inactivă' : ''}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={19} color={RED}/>
                  </TouchableOpacity>
                ))}
              </View>
            )}


            {localities.length === 0 && !isSchoolManager && (
              <Text style={s.empty}>Nu ai încă localități atribuite în acest departament.</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F6F6' },
  headerOuter: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 16 },
  header: { paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: RED },
  title: { fontSize: 24, fontWeight: '900', color: DARK },
  content: { padding: 16, paddingBottom: 40 }, pageDescription: { color: '#777', fontSize: 13, lineHeight: 20, marginBottom: 18 }, sectionLabel: { color: '#999', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12 },
  department: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginBottom: 18 },
  departmentIcon: { width: 54, height: 54, backgroundColor: '#FFF0ED', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  departmentName: { fontSize: 19, fontWeight: '900', color: DARK },
  subtitle: { color: '#777', fontSize: 12, marginTop: 5 },
  adminCard: { backgroundColor: RED, padding: 15, borderRadius: 17, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  databaseCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 17, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#F1DDDD' },
  databaseIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center' },
  databaseTitle: { color: DARK, fontSize: 15, fontWeight: '900' },
  databaseSubtitle: { color: '#777', fontSize: 11, marginTop: 4, lineHeight: 16 },
  databaseError: { color: RED, fontSize: 12, marginBottom: 14 },
  adminTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  adminSubtitle: { color: '#FFE7E7', fontSize: 11, marginTop: 4, lineHeight: 16 },
  card: { backgroundColor: '#FFF', padding: 15, borderRadius: 17, marginBottom: 11 },
  inactive: { opacity: 0.55 },
  localityHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center' },
  localityName: { fontSize: 15, fontWeight: '800', color: DARK },
  actions: { marginTop: 14, gap: 9 },
  actionButton: { minHeight: 48, backgroundColor: '#FFF5F3', borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionText: { color: RED, fontSize: 13, fontWeight: '800', flex: 1 },
  error: { color: RED, marginTop: 15 },
  empty: { color: '#777', marginTop: 14, lineHeight: 21 },
  retry: { paddingVertical: 12 },
  retryText: { color: RED, fontWeight: '800' },
});
