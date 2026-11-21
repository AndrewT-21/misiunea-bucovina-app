import { Platform, useWindowDimensions } from 'react-native';
import { Alert } from '../lib/platform-alert';
import { signOutWithPushCleanup } from '../lib/push-logout';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator,
  
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const compactWeb = Platform.OS === 'web' && width < 900;
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canEditVolunteerPage, setCanEditVolunteerPage] = useState(false);
  const [isSchoolManager, setIsSchoolManager] = useState(false);
  const [canScheduleAdmin, setCanScheduleAdmin] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [volunteerCount, setVolunteerCount] = useState(0);
  const [caseCount, setCaseCount] = useState(0);
const [projectCount, setProjectCount] = useState(0);
const [newsCount, setNewsCount] = useState(0);
const [messageCount, setMessageCount] = useState(0);
const [accountCount, setAccountCount] = useState<number | null>(null);
const [newMessageCount, setNewMessageCount] = useState(0);
  const [newInstructorCount, setNewInstructorCount] = useState(0);
  const [pendingActivityCount, setPendingActivityCount] = useState(0);

  useFocusEffect(
  useCallback(() => {
    checkSession();
  }, [])
);

async function loadNewMessageCount() {
  const { count, error } = await supabase
    .from('messages')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'new');

  if (error) {
    console.log(
      'Eroare actualizare mesaje noi:',
      error
    );
    return;
  }

  setNewMessageCount(count ?? 0);
}

async function checkSession() {
  setLoading(true);
  setAccessError('');
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
      router.replace('/admin-login');
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('user_id, role')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (adminError) throw adminError;
    if (!admin) {
      setAccessError('Contul nu are rol de administrator.');
      return;
    }

    if (admin.role !== 'super_admin' && admin.role !== 'admin') {
      setAccessError('Rol administrativ necunoscut.');
      return;
    }

    setEmail(session.user.email ?? '');
    const superAdmin = admin.role === 'super_admin';
    setIsSuperAdmin(superAdmin);
    if (superAdmin) setCanEditVolunteerPage(true);
    else {
      const { data: departmentPermissions, error: departmentError } = await supabase.rpc('misibi_my_admin_permissions');
      setCanEditVolunteerPage(!departmentError && ((departmentPermissions ?? []) as { department_slug: string; can_edit: boolean }[]).some(p => p.department_slug === 'voluntariat' && p.can_edit));
    }
    if (!superAdmin) {
      const { data: schedulePermission } = await supabase.from('weekly_schedule_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
      setCanScheduleAdmin(!!schedulePermission);
    } else setCanScheduleAdmin(true);
    if (!superAdmin) {
      // Nu presupunem că rolul admin acordă acces la toate modulele.
      const { data: manager, error: managerError } = await supabase.rpc('school_is_manager');
      if (managerError) throw managerError;
      setIsSchoolManager(manager === true);
      return;
    }
    setIsSchoolManager(true);
  // Actualizează numărul înscrierilor noi de fiecare dată când revii în dashboard.
  const { count: instructorCount, error: instructorError } = await supabase
    .from('school_instructor_applications')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'noua');

  if (instructorError) {
    console.log('Eroare număr înscrieri noi instructori:', instructorError);
  } else {
    setNewInstructorCount(instructorCount ?? 0);
  }

  // Numărul înscrierilor la activități care așteaptă aprobarea.
  const { count: activityPendingCount, error: activityPendingError } = await supabase
    .from('activity_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (activityPendingError) {
    console.log('Eroare număr înscrieri activități în așteptare:', activityPendingError);
  } else {
    setPendingActivityCount(activityPendingCount ?? 0);
  }

  const { count: casesCount, error: casesError } =
  await supabase
    .from('cases')
    .select('id', {
      count: 'exact',
      head: true,
    });

if (casesError) {
  console.log(
    'Eroare număr cazuri:',
    casesError
  );
} else {
  setCaseCount(casesCount ?? 0);
}

const { count: projectsCount, error: projectsError } =
  await supabase
    .from('projects')
    .select('id', {
      count: 'exact',
      head: true,
    });

if (projectsError) {
  console.log(
    'Eroare număr proiecte:',
    projectsError
  );
} else {
  setProjectCount(projectsCount ?? 0);
}

const { count: newsTotal, error: newsError } =
  await supabase
    .from('news')
    .select('id', {
      count: 'exact',
      head: true,
    });

if (newsError) {
  console.log(
    'Eroare număr noutăți:',
    newsError
  );
} else {
  setNewsCount(newsTotal ?? 0);
}

const { count: messagesTotal, error: messagesError } =
  await supabase
    .from('messages')
    .select('id', {
      count: 'exact',
      head: true,
    });

if (messagesError) {
  console.log(
    'Eroare număr mesaje:',
    messagesError
  );
} else {
  setMessageCount(messagesTotal ?? 0);
}

const { count: newMessagesTotal, error: newMessagesError } =
  await supabase
    .from('messages')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('status', 'new');

if (newMessagesError) {
  console.log(
    'Eroare număr mesaje noi:',
    newMessagesError
  );
} else {
  setNewMessageCount(newMessagesTotal ?? 0);
}

  // Conturile reale din Gestionare utilizatori (inclusiv administratorii).
  // Funcția existentă este accesibilă numai Super Adminului.
  const { data: managedAccounts, error: accountsError } = await supabase.rpc('super_admin_list_users');
  if (accountsError) {
    console.log('Eroare număr conturi:', accountsError);
    setAccountCount(null);
  } else {
    setAccountCount(Array.isArray(managedAccounts) ? managedAccounts.length : null);
  }

  // Număr unic: profiluri (publicate sau nu) + cereri acceptate fără profil asociat.
  const { data: totalVolunteers, error: countError } = await supabase
    .rpc('misibi_volunteer_dashboard_total');
  if (countError) {
    console.log('Eroare număr total voluntari:', countError);
  } else {
    setVolunteerCount(Number(totalVolunteers ?? 0));
  }


  } catch (error: any) {
    console.error('Eroare verificare acces admin:', error);
    setAccessError(error?.message ?? 'Nu s-au putut verifica permisiunile.');
  } finally {
    setLoading(false);
  }
}
  async function handleLogout() {
    Alert.alert(
      'Deconectare',
      'Sigur vrei să te deconectezi?',
      [
        {
          text: 'Anulează',
          style: 'cancel',
        },
        {
          text: 'Deconectare',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOutWithPushCleanup();
            if (error) {
              Alert.alert('Eroare', 'Deconectarea nu a reușit. Încearcă din nou.');
              return;
            }
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={RED} />
        <Text style={styles.loadingText}>
          Se verifică autentificarea...
        </Text>
      </SafeAreaView>
    );
  }

  if (accessError) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={{ padding: 24, gap: 18 }}>
          <Text style={styles.title}>Acces indisponibil</Text>
          <Text>{accessError}</Text>
          <TouchableOpacity onPress={() => void checkSession()}><Text style={{ color: RED }}>Reîncearcă</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')}><Text>Înapoi la aplicație</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, compactWeb && styles.compactWebContent]}>
          <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
          <Text style={styles.title}>Spațiul administratorului</Text>
          <Text style={styles.welcome}>{email}</Text>
          <Text style={styles.sectionLabel}>SECȚIUNI AUTORIZATE</Text>
          {canScheduleAdmin && <View style={styles.menu}><AdminMenuItem icon="calendar-outline" title="Program săptămânal" subtitle="Gestionează activitățile persoanelor" onPress={() => router.push('/admin/weekly-schedule' as any)} /></View>}
          {isSchoolManager ? (
            <View style={styles.menu}>
              <AdminMenuItem
                icon="school-outline"
                title="Administrare Școala Creștină"
                subtitle="Acces confirmat prin permisiunile Școlii Creștine"
                onPress={() => router.push('/admin/school')}
              />
            </View>
          ) : (
            <Text>Nu există încă secțiuni administrative confirmate pentru acest cont. Poți folosi în continuare profilul și funcțiile de voluntar.</Text>
          )}
          
          <TouchableOpacity style={styles.viewAppButton} onPress={() => router.push('/admin/departamentele-mele' as any)}>
            <Ionicons name="grid-outline" size={22} color={RED} />
            <Text style={styles.viewAppTitle}>Departamentele mele</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.viewAppButton} onPress={() => router.navigate('/(tabs)')}>
            <Ionicons name="home-outline" size={22} color={RED} />
            <Text style={styles.viewAppTitle}>Înapoi la aplicație</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={RED} />
            <Text style={styles.logoutText}>Deconectare</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, compactWeb && styles.compactWebContent]}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              MISIUNEA BUCOVINA
            </Text>

            <Text style={styles.title}>
              Admin Dashboard
            </Text>

            <Text style={styles.welcome}>
              Bine ai venit în zona de administrare.
            </Text>
          </View>

          <View style={styles.adminAvatar}>
            <Ionicons
              name="shield-checkmark"
              size={26}
              color="#FFFFFF"
            />
          </View>
        </View>

        {/* ACCOUNT */}
        <View style={styles.accountCard}>
          <View style={styles.accountIcon}>
            <Ionicons
              name="person-outline"
              size={22}
              color={RED}
            />
          </View>

          <View style={styles.accountContent}>
            <Text style={styles.accountLabel}>
              CONECTAT CA
            </Text>

            <Text
              style={styles.accountEmail}
              numberOfLines={1}
            >
              {email}
            </Text>
          </View>

          <View style={styles.online}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>
              ACTIV
            </Text>
          </View>
        </View>

        {/* ACCES LA APLICAȚIA PUBLICĂ */}
        <TouchableOpacity
          style={styles.viewAppButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Vezi aplicația"
          onPress={() => router.navigate('/(tabs)')}
        >
          <View style={styles.viewAppIcon}>
            <Ionicons name="phone-portrait-outline" size={23} color={RED} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.viewAppTitle}>Vezi aplicația</Text>
            <Text style={styles.viewAppSubtitle}>Navighează ca un utilizator obișnuit</Text>
          </View>
          <Ionicons name="arrow-forward" size={21} color={RED} />
        </TouchableOpacity>

        {/* OVERVIEW */}
        <Text style={styles.sectionLabel}>
          PREZENTARE GENERALĂ
        </Text>

        <View style={styles.statsRow}>
          <StatCard
            icon="heart-outline"
            number={caseCount.toString()}
            label="Cazuri"
          />

          <StatCard
            icon="people-outline"
            number={projectCount.toString()}
            label="Proiecte"
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
  icon="hand-left-outline"
  number={volunteerCount.toString()}
  label="Voluntari"
/>

          <StatCard
            icon="newspaper-outline"
            number={newsCount.toString()}
            label="Noutăți"
          />
        </View>
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, styles.compactOverviewCard]}
            activeOpacity={0.8}
            onPress={() => router.push('/admin/users' as any)}
            accessibilityRole="button"
            accessibilityLabel="Deschide gestionarea utilizatorilor"
          >
            <View style={styles.statIcon}>
              <Ionicons name="person-circle-outline" size={21} color={RED} />
            </View>
            <Text style={styles.statNumber}>{accountCount === null ? '—' : accountCount}</Text>
            <Text style={styles.statLabel}>Utilizatori</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, styles.compactOverviewCard, newMessageCount > 0 && { borderWidth: 2, borderColor: '#A61E22' }]}
            activeOpacity={0.8}
            onPress={() => router.push('/admin/messages')}
            accessibilityRole="button"
            accessibilityLabel="Deschide mesajele"
          >
            <View style={styles.compactMessageTop}>
              <View style={styles.statIcon}>
                <Ionicons name="mail-outline" size={21} color={RED} />
              </View>
              {newMessageCount > 0 && (
                <View style={styles.compactUnreadBadge}>
                  <Text style={styles.compactUnreadText}>{newMessageCount} noi</Text>
                </View>
              )}
            </View>
            <Text style={styles.statNumber}>{messageCount}</Text>
            <Text style={styles.statLabel}>Mesaje</Text>
            <Text style={styles.compactUnreadHint}>{newMessageCount} noi / necitite</Text>
          </TouchableOpacity>
        </View>

        {/* PLANIFICARE ȘI COMUNICARE */}
        <Text style={styles.sectionLabel}>PLANIFICARE ȘI COMUNICARE</Text>
        <View style={styles.menu}>
          <AdminMenuItem icon="calendar-outline" title="Program săptămânal" subtitle="Planifică și asignează activități" onPress={() => router.push('/admin/weekly-schedule' as any)} />
          <AdminMenuItem icon="school-outline" title="Pagina Școala Creștină" subtitle="Editează textele și imaginile paginii publice" onPress={() => router.push('/admin/school-edit' as any)} />
          {canEditVolunteerPage && <AdminMenuItem icon="create-outline" title="Voluntariat" subtitle="Texte, imagini, butoane și formular" onPress={() => router.push('/admin/volunteer-page' as any)} />}
          <AdminMenuItem icon="ribbon-outline" title="Ziua Voluntarului" subtitle="Administrează edițiile și galeriile foto" onPress={() => router.push('/admin/ziua-voluntarului' as any)} />
          <AdminMenuItem icon="calendar-outline" title="Calendar și propuneri" subtitle="Activități, post și rugăciune · propuneri și publicare" badgeCount={pendingActivityCount} onPress={() => router.push('/admin/calendar-proposals' as any)} />
          <AdminMenuItem icon="notifications-outline" title="Notificări" subtitle="Creează și publică notificări" onPress={() => router.push('/admin/notifications' as any)} />
          <AdminMenuItem icon="newspaper-outline" title="Noutăți" subtitle="Publică actualizări și noutăți" onPress={() => router.push('/admin/news' as any)} />
        </View>

        {/* MISIUNE ȘI PROIECTE */}
        <Text style={styles.sectionLabel}>MISIUNE ȘI PROIECTE</Text>
        <View style={styles.menu}>
          {isSuperAdmin && <AdminMenuItem icon="document-text-outline" title="Solicitări de ajutor" subtitle="Cereri primite prin formularul public" onPress={() => router.push('/admin/help-requests' as any)} />}
          <AdminMenuItem icon="heart-outline" title="Cazuri" subtitle="Adaugă și modifică cazurile" onPress={() => router.push('/admin/cases' as any)} />
          <AdminMenuItem icon="people-outline" title="Proiecte" subtitle="Administrează proiectele" onPress={() => router.push('/admin/projects' as any)} />
          <AdminMenuItem icon="card-outline" title="Donații" subtitle="Administrează metodele de donație" onPress={() => router.push('/admin/donations' as any)} />
          <AdminMenuItem icon="wallet-outline" title="Doi Bănuți pe Zi" subtitle="Administrează pagina și campania Doi Bănuți" onPress={() => router.push('/admin/two-cents' as any)} />
          <AdminMenuItem icon="document-text-outline" title="Redirecționare fiscală" subtitle="Administrează informațiile și formularele fiscale" onPress={() => router.push('/admin/tax-redirect' as any)} />
          <AdminMenuItem icon="document-text-outline" title="Rapoarte" subtitle="Adaugă și administrează rapoartele" onPress={() => router.push('/admin/reports' as any)} />
          <AdminMenuItem icon="stats-chart-outline" title="Impact" subtitle="Actualizează cifrele de impact" onPress={() => router.push('/admin/impact' as any)} />
        </View>

        {/* OAMENI ȘI ECHIPĂ */}
        <Text style={styles.sectionLabel}>OAMENI ȘI ECHIPĂ</Text>
        <View style={styles.menu}>
          <AdminMenuItem icon="people-outline" title="Voluntarii noștri" subtitle="Adaugă, editează și publică profilurile voluntarilor" onPress={() => router.push('/admin/volunteer-directory' as any)} />
          <AdminMenuItem icon="hand-left-outline" title="Cereri voluntariat" subtitle="Vezi persoanele care s-au înscris" onPress={() => router.push('/admin/volunteers' as any)} />
          <AdminMenuItem icon="document-text-outline" title="Cereri instructori" subtitle="Vezi și gestionează înscrierile instructorilor" badgeCount={newInstructorCount} onPress={() => router.push('/admin/school-applications' as any)} />
          <AdminMenuItem icon="people-circle-outline" title="Gestionare utilizatori" subtitle="Voluntari, administratori și departamente" onPress={() => router.push('/admin/users' as any)} />
        </View>

        {/* SISTEM ȘI ADMINISTRARE */}
        <Text style={styles.sectionLabel}>SISTEM ȘI ADMINISTRARE</Text>
        <View style={styles.menu}>
          <AdminMenuItem icon="shield-checkmark-outline" title="Departamente și permisiuni" subtitle="Gestionează departamentele, administratorii și drepturile" onPress={() => router.push('/admin/departments' as any)} />
          <AdminMenuItem icon="grid-outline" title="Baze de date" subtitle="Tabele, înregistrări și acces personalizat" onPress={() => router.push('/admin/databases' as any)} />
          <AdminMenuItem icon="shield-checkmark-outline" title="Politica de confidențialitate și termeni" subtitle="Editează cele 55 de secțiuni și data actualizării" onPress={() => router.push('/admin/politica-de-confidentialitate' as any)} />
          <AdminMenuItem icon="settings-outline" title="Setări" subtitle="Configurarea aplicației" onPress={() => router.push('/admin/settings' as any)} />
        </View>

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={RED}
          />

          <Text style={styles.logoutText}>
            Deconectare
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Misiunea Bucovina • Administrare
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  number: string;
  label: string;
};

function StatCard({
  icon,
  number,
  label,
}: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={RED}
        />
      </View>

      <Text style={styles.statNumber}>
        {number}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

type AdminMenuItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  badgeCount?: number;
};

function AdminMenuItem({
  icon,
  title,
  subtitle,
  onPress,
  badgeCount,
}: AdminMenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      activeOpacity={0.75}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.menuIcon}>
        <Ionicons
          name={icon}
          size={22}
          color={RED}
        />
      </View>

      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>
          {title}
        </Text>

        <Text style={styles.menuSubtitle}>
          {subtitle}
        </Text>
      </View>

      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <View style={styles.instructorBadge}>
          <Text style={styles.instructorBadgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      )}

      <Ionicons
        name="chevron-forward"
        size={19}
        color="#BBBBBB"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  viewAppButton: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, borderWidth: 1, borderColor: '#F1D6D6' },
  viewAppIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  viewAppTitle: { color: DARK, fontSize: 14, fontWeight: '900' },
  viewAppSubtitle: { color: '#888888', fontSize: 11, marginTop: 3 },
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
   ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},

  loadingScreen: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 12,
    marginTop: 12,
  },

  content: {
    paddingHorizontal: 15,
    paddingBottom: 35,
   ...(Platform.OS === "web" ? { width: "100%", maxWidth: 1250, alignSelf: "center", paddingHorizontal: 30, paddingTop: 28, paddingBottom: 70 } : {})},

  header: {
    paddingTop: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
   ...(Platform.OS === "web" ? { paddingTop: 24, paddingBottom: 22 } : {})},

  eyebrow: {
    color: RED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  title: {
    color: DARK,
    fontSize: 29,
    fontWeight: '900',
    marginTop: 4,
   ...(Platform.OS === "web" ? { fontSize: 32 } : {})},

  welcome: {
    color: '#777777',
    fontSize: 11,
    marginTop: 5,
   ...(Platform.OS === "web" ? { fontSize: 15 } : {})},

  adminAvatar: {
    width: 53,
    height: 53,
    borderRadius: 17,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },

  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
   ...(Platform.OS === "web" ? { borderRadius: 18, padding: 22 } : {})},

  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  accountContent: {
    flex: 1,
    marginLeft: 11,
  },

  accountLabel: {
    color: '#999999',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  accountEmail: {
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
  },

  online: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RED,
  },

  onlineText: {
    color: RED,
    fontSize: 7,
    fontWeight: '900',
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 24,
    marginBottom: 9,
    marginLeft: 5,
   ...(Platform.OS === "web" ? { fontSize: 17 } : {})},

  compactWebContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
   ...(Platform.OS === "web" ? { borderRadius: 18, padding: 22, borderWidth: 1, borderColor: "#EAEAED" } : {})},

  statIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statNumber: {
    color: DARK,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 11,
  },

  statLabel: {
    color: '#777777',
    fontSize: 10,
    marginTop: 2,
  },

  compactOverviewCard: {
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  compactMessageTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  compactUnreadBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  compactUnreadText: {
    color: RED,
    fontSize: 10,
    fontWeight: '800',
  },
  compactUnreadHint: {
    color: '#999999',
    fontSize: 10,
    marginTop: 5,
  },

  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    overflow: 'hidden',
  },

  menuItem: {
    minHeight: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
   ...(Platform.OS === "web" ? { borderRadius: 16, paddingVertical: 20, paddingHorizontal: 22, borderWidth: 1, borderColor: "#EAEAED" } : {})},

  menuIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  instructorBadge: {
    backgroundColor: RED,
    minWidth: 25,
    height: 25,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  instructorBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  menuContent: {
    flex: 1,
    marginLeft: 12,
  },

  menuTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '800',
   ...(Platform.OS === "web" ? { fontSize: 16 } : {})},

  menuSubtitle: {
    color: '#888888',
    fontSize: 10,
    marginTop: 3,
   ...(Platform.OS === "web" ? { fontSize: 13, lineHeight: 20 } : {})},

  logoutButton: {
    minHeight: 55,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1D6D6',
  },

  logoutText: {
    color: RED,
    fontSize: 13,
    fontWeight: '900',
  },

  footer: {
    color: '#AAAAAA',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 18,
  },

  messagesOverviewCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 18,
  padding: 15,
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
 ...(Platform.OS === "web" ? { borderRadius: 18, padding: 22 } : {})},

messagesOverviewLeft: {
  width: 125,
},

messagesDivider: {
  width: 1,
  height: 82,
  backgroundColor: '#EEEEEE',
  marginHorizontal: 18,
},

messagesOverviewRight: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 12,
},

newMessagesIcon: {
  width: 42,
  height: 42,
  borderRadius: 13,
  backgroundColor: '#FFF0F0',
  alignItems: 'center',
  justifyContent: 'center',
},

newMessagesNumber: {
  color: DARK,
  fontSize: 25,
  fontWeight: '900',
},

newMessagesLabel: {
  color: '#777777',
  fontSize: 10,
  marginTop: 2,
},
});