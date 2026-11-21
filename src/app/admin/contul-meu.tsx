import DeactivateAccountButton from '../../components/DeactivateAccountButton';
import DeleteAccountButton from '../../components/DeleteAccountButton';
import { Alert } from '../../lib/platform-alert';
import { signOutWithPushCleanup } from '../../lib/push-logout';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator,  Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import AccountProfileCard, { AccountShortcuts } from '../../components/AccountProfileCard';

const RED = '#A61E22';
type Role = 'admin' | 'super_admin';
type Profile = { full_name: string | null; nickname: string | null; phone: string | null; avatar_url: string | null };
function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}
export default function AdminAccountScreen() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [fallbackName, setFallbackName] = useState('');
  const [error, setError] = useState('');
  const [activityStats, setActivityStats] = useState({total:0,confirmed:0});

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) { router.replace('/alege-cont'); return; }
        const { data: admin, error: roleError } = await supabase.from('admins').select('role').eq('user_id', user.id).maybeSingle();
        if (roleError) throw roleError;
        if (admin?.role !== 'admin' && admin?.role !== 'super_admin') {
          router.replace('/(tabs)');
          return;
        }
        const { data: current, error: profileError } = await supabase.from('admin_profiles')
          .select('full_name,nickname,phone,avatar_url').eq('user_id', user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!active) return;
        const { data: myActivities, error: activitiesError } = await supabase.from('activity_registrations').select('status').eq('volunteer_id',user.id);
        if (!active) return;
        if (!activitiesError) setActivityStats({total:(myActivities||[]).length,confirmed:(myActivities||[]).filter(r=>r.status==='confirmed').length});
        setRole(admin.role);
        setProfile(current);
        setEmail(user.email ?? '');
        setFallbackName(typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '');
      } catch (e: any) {
        if (active) setError(e?.message ?? 'Profilul nu a putut fi încărcat.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []));

  async function logout() {
    const { error: signOutError } = await signOutWithPushCleanup();
    if (signOutError) return notify('Eroare', signOutError.message);
    router.dismissTo('/(tabs)');
  }

  if (loading) return <SafeAreaView style={s.screen}><View style={s.center}><ActivityIndicator color={RED} size="large" /></View></SafeAreaView>;
  return <SafeAreaView style={s.screen} edges={['top']}>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>MISIUNEA BUCOVINA</Text>
      <Text style={s.title}>Contul meu</Text>
      <TouchableOpacity style={s.homeLink} onPress={() => router.dismissTo('/(tabs)')}>
        <Ionicons name="home-outline" size={18} color={RED}/><Text style={s.homeLinkText}>Mergi la Acasă</Text>
      </TouchableOpacity>
      {!!error && <Text style={s.error}>{error}</Text>}
      {!!role && <>
        <AccountProfileCard name={profile?.full_name || fallbackName || email || 'Utilizator'} nickname={profile?.nickname} role={role === 'super_admin' ? 'Super Administrator' : 'Administrator'} email={email} phone={profile?.phone} avatar={profile?.avatar_url} onEdit={() => router.push('/admin/profil')}/>
        <AccountShortcuts/>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/admin/activitatile-mele' as any)} style={s.navCard}>
          <View style={s.activityIcon}><Ionicons name="calendar-outline" size={23} color={RED}/></View>
          <View style={{flex:1}}><Text style={s.navText}>Activitățile mele</Text><Text style={s.activityCaption}>{activityStats.total} {activityStats.total===1?'înscriere':'înscrieri'} · {activityStats.confirmed} confirmate</Text></View>
          <Ionicons name="chevron-forward" size={21} color={RED}/>
        </TouchableOpacity>
        {role === 'admin' && <TouchableOpacity style={s.navCard} onPress={() => router.push('/admin/departamentele-mele')}>
          <Ionicons name="grid-outline" size={22} color={RED}/><Text style={s.navText}>Departamentele mele</Text><Ionicons name="chevron-forward" size={19} color={RED}/>
        </TouchableOpacity>}
        {role === 'super_admin' && <TouchableOpacity style={s.navCard} onPress={() => router.push('/admin')}>
          <Ionicons name="shield-checkmark-outline" size={22} color={RED}/><Text style={s.navText}>Admin Dashboard</Text><Ionicons name="chevron-forward" size={19} color={RED}/>
        </TouchableOpacity>}
        {role === 'admin' && <View style={s.accountActions}><DeactivateAccountButton/><DeleteAccountButton/></View>}
        <TouchableOpacity style={s.logout} onPress={() => { Alert.alert('Deconectare', 'Sigur dorești să te deconectezi?', [{text:'Anulează',style:'cancel'},{text:'Deconectare',style:'destructive',onPress:()=>void logout()}]); }}><Text style={s.logoutText}>Deconectare</Text></TouchableOpacity>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F6F4' },
  accountActions: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginTop: 18 }, center: { flex: 1, justifyContent: 'center' }, content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), padding: 22, paddingBottom: 50 },
  eyebrow: { color: RED, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 18 },
  title: { fontSize: 32, fontWeight: '900', color: '#171717', marginTop: 8, marginBottom: 20 },
  homeLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 18 },
  homeLinkText: { color: RED, fontSize: 13, fontWeight: '800' },
  profileCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#F0E8E8' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatarCircle: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' }, profileIdentity: { flex: 1 },
  profileName: { fontSize: 21, fontWeight: '900', color: '#171717' },
  nickname: { color: RED, fontWeight: '800', fontSize: 14, marginTop: 3 },
  profileRole: { color: '#888', fontSize: 11, marginTop: 5 },
  editProfileButton: { marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: '#EBC9C9', padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  editProfileText: { color: RED, fontWeight: '800', fontSize: 13 },
  profileDivider: { height: 1, backgroundColor: '#F0E8E8', marginVertical: 18 },
  profileInfoLine: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  profileInfoText: { color: '#555', fontSize: 13, flex: 1 },
  shortcutRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  shortcut: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0E8E8', borderRadius: 17, padding: 16, alignItems: 'center', gap: 9 },
  shortcutText: { color: '#262626', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  navCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F0E8E8', borderRadius: 17, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  navText: { color: '#171717', fontWeight: '800', fontSize: 14 },
  activityIcon: {width:44,height:44,borderRadius:13,backgroundColor:'#FFF0F0',alignItems:'center',justifyContent:'center'},
  activityCaption: {color:'#777',fontSize:12,marginTop:4},
  logout: { borderWidth: 1, borderColor: RED, borderRadius: 13, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  logoutText: { color: RED, fontWeight: '900' }, error: { color: RED, marginBottom: 14 },
});
