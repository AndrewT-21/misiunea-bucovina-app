import { Alert } from '../../lib/platform-alert';
import { signOutWithPushCleanup } from '../../lib/push-logout';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, 
  Image,
  Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import AccountProfileCard, { AccountShortcuts } from '../../components/AccountProfileCard';

const RED = '#A61E22';
type Profile = { full_name: string; phone: string | null; nickname: string | null; avatar_url: string | null };
type Activity = {
  id: string; title: string; description: string | null; location: string | null;
  starts_at: string; ends_at: string | null;
};
type Registration = {
  id: string; activity_id: string; volunteer_id: string; status: string;
  admin_message: string | null; created_at: string;
};
type MyRegistration = Registration & { activity: Activity | null };

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}
function statusInfo(status: string) {
  if (status === 'confirmed') return { text: 'Confirmată', bg: '#E6F5EB', color: '#25734D', icon: 'checkmark-circle-outline' as const };
  if (status === 'rejected') return { text: 'Respinsă', bg: '#FDE9E9', color: RED, icon: 'close-circle-outline' as const };
  if (status === 'pending') return { text: 'În așteptare', bg: '#FFF2D6', color: '#8A6B2E', icon: 'time-outline' as const };
  return { text: status, bg: '#F2F2F2', color: '#555', icon: 'information-circle-outline' as const };
}

export default function ActivitatileMele() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [registrations, setRegistrations] = useState<MyRegistration[]>([]);
  const [registrationsError, setRegistrationsError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (isActive: () => boolean) => {
    setLoading(true);
    setRegistrationsError('');
    try {
      // O sesiune lipsă este o stare normală pentru vizitatori, nu o eroare.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!isActive()) return;
      if (!session?.user) {
        router.replace('/voluntar/login');
        return;
      }
      if (sessionError) throw sessionError;
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!isActive()) return;
      if (!user || authError?.message?.toLowerCase().includes('session missing')) {
        router.replace('/voluntar/login');
        return;
      }
      if (authError) throw authError;

      const { data: admin, error: adminError } = await supabase
        .from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!isActive()) return;
      if (adminError) throw adminError;
      const { getAccountKind } = await import('../../lib/accountAccess');
      const kind = await getAccountKind(user.id);
      if (!isActive()) return;
      setIsAdmin(!!admin || kind === 'super_admin');

      const [profileResult, registrationsResult] = await Promise.all([
        supabase.from(kind === 'admin' || kind === 'super_admin' ? 'admin_profiles' : 'volunteer_profiles').select('full_name,phone,nickname,avatar_url').eq('user_id', user.id).maybeSingle(),
        supabase.from('activity_registrations')
          .select('id,activity_id,volunteer_id,status,admin_message,created_at')
          .eq('volunteer_id', user.id).order('created_at', { ascending: false }),
      ]);
      if (!isActive()) return;
      if (profileResult.error) throw profileResult.error;
      setProfile(profileResult.data);
      setEmail(user.email ?? '');
      const name = user.user_metadata?.full_name;
      setDisplayName(typeof name === 'string' ? name.trim() : '');

      if (registrationsResult.error) {
        setRegistrationsError(registrationsResult.error.message);
        setRegistrations([]);
        return;
      }
      const regs = (registrationsResult.data ?? []) as Registration[];
      const ids = [...new Set(regs.map(r => r.activity_id).filter(Boolean))];
      const activityMap: Record<string, Activity> = {};
      if (ids.length) {
        const { data: activities, error } = await supabase
          .from('activities').select('id,title,description,location,starts_at,ends_at').in('id', ids);
        if (!isActive()) return;
        if (error) setRegistrationsError(`Detaliile activităților nu au putut fi încărcate: ${error.message}`);
        else for (const a of (activities ?? []) as Activity[]) activityMap[a.id] = a;
      }
      if (isActive()) setRegistrations(regs.map(r => ({ ...r, activity: activityMap[r.activity_id] ?? null })));
    } catch (error: any) {
      if (isActive()) notify('Eroare', error?.message ?? 'Nu am putut încărca profilul.');
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  async function logout() {
    const { error } = await signOutWithPushCleanup();
    if (error) return notify('Eroare', error.message);
    router.dismissTo('/(tabs)');
  }

  async function cancelRegistration(reg: MyRegistration) {
    if (cancelling) return;
    if (!reg.activity || new Date(reg.activity.starts_at).getTime() <= Date.now()) {
      notify('Anulare indisponibilă', 'Înscrierea nu mai poate fi anulată după începerea activității.');
      return;
    }
    setCancelling(reg.id);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Autentificarea a expirat.');
      const { data, error } = await supabase.from('activity_registrations')
        .delete().eq('id', reg.id).eq('volunteer_id', user.id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Înscrierea nu a fost anulată. Verifică permisiunea DELETE din Supabase.');
      setRegistrations(current => current.filter(r => r.id !== reg.id));
      notify('Înscriere anulată', 'Te-ai retras de la această activitate.');
    } catch (error: any) {
      notify('Nu am putut anula înscrierea', error?.message ?? 'Încearcă din nou.');
    } finally {
      setCancelling(null);
    }
  }

  function askCancel(reg: MyRegistration) {
    const message = `Sigur dorești să anulezi înscrierea la „${reg.activity?.title ?? 'această activitate'}”?`;
    Alert.alert('Anulează înscrierea', message, [
      { text: 'Păstrează înscrierea', style: 'cancel' },
      { text: 'Da, anulează', style: 'destructive', onPress: () => void cancelRegistration(reg) },
    ]);
  }

  if (loading) return <SafeAreaView style={styles.screen}><View style={styles.center}><ActivityIndicator color={RED} size="large" /></View></SafeAreaView>;

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}>
      <View style={styles.headingRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} accessibilityRole="button" accessibilityLabel="Înapoi">
          <Ionicons name="chevron-back" size={26} color="#22252B" />
        </TouchableOpacity>
        <View style={styles.headingTitle}>
          <Text style={styles.eyebrow}>SPAȚIUL MEU</Text>
          <Text style={styles.title}>Activitățile mele</Text>
        </View>
      </View>
      <Text style={{color:'#777',fontSize:14,marginBottom:18}}>Înscrierile tale la activități, confirmările și mesajele primite.</Text>
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}><Ionicons name="calendar-outline" size={22} color={RED} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Activitățile mele</Text>
            <Text style={styles.subheading}>{registrations.length} {registrations.length === 1 ? 'înscriere' : 'înscrieri'}</Text>
          </View>
        </View>
        {!!registrationsError && <View style={styles.errorBox}><Text style={styles.errorText}>{registrationsError}</Text></View>}
        {registrations.length === 0 ? <View style={styles.emptyBox}>
          <Ionicons name="calendar-clear-outline" size={29} color="#B79C98" />
          <Text style={styles.emptyTitle}>Nu ai încă înscrieri</Text>
          <Text style={styles.note}>Alege o activitate din calendar și înscrie-te ca voluntar.</Text>
          <TouchableOpacity style={styles.calendarLink} onPress={() => router.push('/(tabs)/calendar')}>
            <Text style={styles.calendarLinkText}>Vezi calendarul</Text><Ionicons name="arrow-forward" color={RED} size={16} />
          </TouchableOpacity>
        </View> : registrations.map(reg => {
          const a = reg.activity;
          const badge = statusInfo(reg.status);
          const canCancel = !!a && new Date(a.starts_at).getTime() > Date.now();
          const isExpanded = expanded === reg.id;
          return <View key={reg.id} style={styles.activityCard}>
            <View style={styles.activityTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>{a?.title ?? 'Activitate indisponibilă'}</Text>
                <Text style={styles.smallMuted}>Înscris la {formatDate(reg.created_at)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Ionicons name={badge.icon} size={14} color={badge.color} />
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
              </View>
            </View>
            {a && <>
              <View style={styles.detailLine}><Ionicons name="calendar-outline" size={16} color={RED} /><Text style={styles.detailText}>{formatDate(a.starts_at)}</Text></View>
              <View style={styles.detailLine}><Ionicons name="time-outline" size={16} color={RED} /><Text style={styles.detailText}>{formatTime(a.starts_at)}{a.ends_at ? ` – ${formatTime(a.ends_at)}` : ''}</Text></View>
              {!!a.location && <View style={styles.detailLine}><Ionicons name="location-outline" size={16} color={RED} /><Text style={styles.detailText}>{a.location}</Text></View>}
            </>}
            {!!reg.admin_message && <View style={styles.messageBox}>
              <View style={styles.messageHeading}><Ionicons name="chatbubble-ellipses-outline" size={16} color={RED} /><Text style={styles.messageTitle}>Mesaj de la administrator</Text></View>
              <Text style={styles.messageText}>{reg.admin_message}</Text>
            </View>}
            {!!a?.description && <>
              <TouchableOpacity style={styles.moreButton} onPress={() => setExpanded(isExpanded ? null : reg.id)}>
                <Text style={styles.moreText}>{isExpanded ? 'Ascunde descrierea' : 'Vezi descrierea'}</Text>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} color={RED} size={16} />
              </TouchableOpacity>
              {isExpanded && <Text style={styles.description}>{a.description}</Text>}
            </>}
            {canCancel && <TouchableOpacity disabled={!!cancelling} style={styles.cancelButton} onPress={() => askCancel(reg)}>
              {cancelling === reg.id ? <ActivityIndicator color={RED} size="small" /> : <Ionicons name="close-circle-outline" color={RED} size={18} />}
              <Text style={styles.cancelText}>{cancelling === reg.id ? 'Se anulează...' : 'Anulează înscrierea'}</Text>
            </TouchableOpacity>}
          </View>;
        })}
      </View>

    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F6F4' },
  profileCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#F0E8E8' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatarCircle: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  profileIdentity: { flex: 1 },
  profileName: { fontSize: 21, fontWeight: '900', color: '#171717' },
  nickname: { color: RED, fontWeight: '800', fontSize: 14, marginTop: 3 },
  profileRole: { color: '#888', fontSize: 11, marginTop: 5 },
  editProfileButton: { marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: '#EBC9C9', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editProfileText: { color: RED, fontWeight: '800', fontSize: 13 },
  profileDivider: { height: 1, backgroundColor: '#F0E8E8', marginVertical: 18 },
  profileInfoLine: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  profileInfoText: { color: '#555', fontSize: 13, flex: 1 },
  profileStats: { flexDirection: 'row', gap: 12, marginTop: 8 },
  profileStat: { flex: 1, borderRadius: 13, padding: 12, backgroundColor: '#FAF6F5', alignItems: 'center' },
  profileStatNumber: { fontSize: 21, fontWeight: '900', color: RED },
  profileStatLabel: { fontSize: 11, color: '#777', marginTop: 3 }, center: { flex: 1, justifyContent: 'center' },
  content: { padding: 22, paddingBottom: 50 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3, marginBottom: 14 },
  headerBack: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headingTitle: { flex: 1, minWidth: 0 },
  eyebrow: { color: RED, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 5 },
  title: { fontSize: 27, fontWeight: '900', color: '#171717', lineHeight: 30 },
  homeLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 18 },
  homeLinkText: { color: RED, fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#F0E8E8', elevation: 1 },
  shortcutRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  shortcut: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0E8E8', borderRadius: 17, padding: 16, alignItems: 'center', gap: 9 },
  shortcutText: { color: '#262626', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  label: { fontSize: 10, fontWeight: '900', color: '#999', marginTop: 12 },
  value: { fontSize: 15, fontWeight: '700', color: '#171717', marginTop: 4 },
  heading: { fontSize: 16, fontWeight: '900', color: '#171717' },
  note: { fontSize: 13, color: '#777', lineHeight: 21, marginTop: 10 },
  button: { borderWidth: 1, borderColor: RED, borderRadius: 13, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  buttonText: { color: RED, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  sectionIcon: { backgroundColor: '#FFF0F0', width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  subheading: { color: '#999', fontSize: 12, marginTop: 4 },
  errorBox: { backgroundColor: '#FFF0F0', padding: 12, borderRadius: 12, marginBottom: 10 },
  errorText: { color: RED, fontSize: 12, lineHeight: 18 },
  emptyBox: { alignItems: 'center', paddingVertical: 22 },
  emptyTitle: { color: '#292929', fontWeight: '800', fontSize: 14, marginTop: 10 },
  calendarLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  calendarLinkText: { color: RED, fontWeight: '800', fontSize: 13 },
  activityCard: { borderWidth: 1, borderColor: '#F0E7E3', borderRadius: 15, padding: 14, marginBottom: 12, backgroundColor: '#FFFCFA' },
  activityTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 11 },
  activityTitle: { color: '#171717', fontWeight: '900', fontSize: 15, lineHeight: 20 },
  smallMuted: { color: '#999', fontSize: 11, marginTop: 5 },
  badge: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: 118 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 8 },
  detailText: { flex: 1, color: '#595959', fontSize: 12, lineHeight: 19 },
  messageBox: { backgroundColor: '#FFF0F0', padding: 12, borderRadius: 12, marginTop: 14 },
  messageHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  messageTitle: { color: RED, fontSize: 12, fontWeight: '900' },
  messageText: { color: '#5C4442', fontSize: 12, lineHeight: 19, marginTop: 7 },
  moreButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 15 },
  moreText: { color: RED, fontSize: 12, fontWeight: '800' },
  description: { color: '#666', fontSize: 12, lineHeight: 19, marginTop: 9 },
  cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, borderWidth: 1, borderColor: '#F0D5D3', borderRadius: 11, minHeight: 43, backgroundColor: '#FFF7F7' },
  cancelText: { color: RED, fontSize: 12, fontWeight: '800' },
});
