import DeactivateAccountButton from '../../components/DeactivateAccountButton';
import DeleteAccountButton from '../../components/DeleteAccountButton';
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

export default function ContulMeu() {
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!isActive()) return;
      if (authError) throw authError;
      if (!user) { router.replace('/voluntar/login'); return; }

      const { data: admin, error: adminError } = await supabase
        .from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!isActive()) return;
      if (adminError) throw adminError;
      const { getAccountKind } = await import('../../lib/accountAccess');
      const kind = await getAccountKind(user.id);
      if (!isActive()) return;
      if (kind === 'super_admin') {
        router.replace('/admin');
        return;
      }
      setIsAdmin(!!admin);

      const [profileResult, registrationsResult] = await Promise.all([
        supabase.from('volunteer_profiles').select('full_name,phone,nickname,avatar_url').eq('user_id', user.id).maybeSingle(),
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
      <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
      <Text style={styles.title}>Contul meu</Text>
      <TouchableOpacity onPress={() => router.dismissTo('/(tabs)')} style={styles.homeLink}>
        <Ionicons name="home-outline" size={18} color={RED} /><Text style={styles.homeLinkText}>Mergi la Acasă</Text>
      </TouchableOpacity>

      <AccountProfileCard name={profile?.full_name || displayName || email || 'Utilizator'} nickname={profile?.nickname} role={isAdmin ? 'Administrator · Voluntar' : 'Voluntar'} email={email} phone={profile?.phone} avatar={profile?.avatar_url} onEdit={() => router.push('/voluntar/editeaza-profil')}/>
      <AccountShortcuts/>

      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/voluntar/activitatile-mele' as any)} style={[styles.card,{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:19}]}>
        <View style={styles.sectionIcon}><Ionicons name="calendar-outline" size={23} color={RED}/></View>
        <View style={{flex:1}}>
          <Text style={styles.heading}>Activitățile mele</Text>
          <Text style={styles.subheading}>{registrations.length} {registrations.length===1?'înscriere':'înscrieri'} · {registrations.filter(r=>r.status==='confirmed').length} confirmate</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={RED}/>
      </TouchableOpacity>

      <View style={styles.accountActions}><DeactivateAccountButton/><DeleteAccountButton/></View>

      <TouchableOpacity style={styles.button} onPress={() => { Alert.alert('Deconectare', 'Sigur dorești să te deconectezi?', [{text:'Anulează',style:'cancel'},{text:'Deconectare',style:'destructive',onPress:()=>void logout()}]); }}><Text style={styles.buttonText}>Deconectare</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F6F4' },
  accountActions: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 18 },
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
  eyebrow: { color: RED, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 18 },
  title: { fontSize: 32, fontWeight: '900', color: '#171717', marginTop: 8, marginBottom: 20 },
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
