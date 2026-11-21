import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAccountItem, setAccountItem } from '../lib/account-storage';
import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type AppNotification = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  target_type: string | null;
  target_id: string | null;
};

type PrivateNotification = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  activity_registration_id: string | null;
  target_type: string | null;
  target_id: string | null;
  source?: 'school' | 'prayer';
};

export default function NotificariScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'general' | 'private'>('general');
  const [privateNotifications, setPrivateNotifications] = useState<PrivateNotification[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    // Notificarile generale sunt publice si nu depind de sesiunea Auth.
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, created_at, target_type, target_id')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Eroare notificari generale:', error);
        setNotifications([]);
        setUnreadIds([]);
      } else {
        const items = (data ?? []) as AppNotification[];
        let lastRead: string | null = null;
        try { lastRead = await getAccountItem('notifications_last_read'); }
        catch (storageError) { console.log('Citire notificari:', storageError); }
        const lastReadTime = lastRead ? new Date(lastRead).getTime() : 0;
        setNotifications(items);
        setUnreadIds(items
          .filter(item => new Date(item.created_at).getTime() > lastReadTime)
          .map(item => item.id));
        if (items.length > 0) {
          try { await setAccountItem('notifications_last_read', new Date().toISOString()); }
          catch (storageError) { console.log('Salvare notificari citite:', storageError); }
        }
      }
    } catch (error) {
      console.log('Eroare notificari generale:', error);
      setNotifications([]);
      setUnreadIds([]);
    } finally {
      setLoading(false);
    }

    // Doar notificarile private necesita autentificare.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      setSignedIn(Boolean(user));
      if (!user) {
        setIsAdmin(false);
        setPrivateNotifications([]);
        return;
      }
      const [adminResult, privateResult] = await Promise.all([
        supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_notifications')
          .select('id,title,message,created_at,read_at,activity_registration_id,target_type,target_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
      if (adminResult.error) console.log('Eroare verificare admin:', adminResult.error);
      setIsAdmin(Boolean(adminResult.data) && !adminResult.error);
      if (privateResult.error) console.log('Eroare notificari private:', privateResult.error);
      // Integrare în lista existentă: notificările Școlii Creștine rămân în
      // tabelul lor, dar apar în același tab «Private».
      const { data: schoolRows, error: schoolError } = await supabase.rpc('school_planning_my_notifications');
      if (schoolError) console.log('Eroare notificări Școala Creștină:', schoolError);
      const schoolItems: PrivateNotification[] = (schoolRows ?? []).map((n: {
        id: string; meeting_id: string; kind: string; message: string;
        sent_at: string; read_at: string | null;
      }) => ({
        id: n.id,
        title: 'Școala Creștină',
        message: n.message,
        created_at: n.sent_at,
        read_at: n.read_at,
        activity_registration_id: null,
        target_type: 'school_meeting',
        target_id: n.id, // ID-ul notificării, pentru verificarea destinatarului
        source: 'school',
      }));
      // Notificările modulului Post și Rugăciune, păstrate în același tab Private.
      const { data: prayerRows, error: prayerError } = await supabase
        .from('prayer_notifications')
        .select('id,event_id,notification_type,title,message,is_read,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(150);
      if (prayerError) console.log('Eroare notificări Post și Rugăciune:', prayerError);
      const prayerItems: PrivateNotification[] = (prayerRows ?? []).map((n: {
        id: string; event_id: string | null; notification_type: string;
        title: string; message: string; is_read: boolean; created_at: string;
      }) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        created_at: n.created_at,
        read_at: n.is_read ? n.created_at : null,
        activity_registration_id: null,
        target_type: n.notification_type === 'new_proposal' ? 'prayer_proposal' : 'prayer_event',
        target_id: n.event_id,
        source: 'prayer',
      }));
      setPrivateNotifications([
        ...((privateResult.error ? [] : (privateResult.data ?? [])) as PrivateNotification[]),
        ...schoolItems,
        ...prayerItems,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error) {
      console.log('Eroare verificare cont/notificari private:', error);
      setSignedIn(false);
      setIsAdmin(false);
      setPrivateNotifications([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  async function markPrivateRead(item: PrivateNotification) {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    const { error } = item.source === 'school'
      ? await supabase.rpc('school_planning_mark_read', { p_id: item.id })
      : item.source === 'prayer'
      ? await supabase.rpc('prayer_mark_notification_read', { p_notification_id: item.id })
      : await supabase
          .from('user_notifications')
          .update({ read_at: readAt })
          .eq('id', item.id);
    if (error) {
      console.log('Eroare marcare notificare privată:', error);
      return;
    }
    setPrivateNotifications((current) => current.map((entry) =>
      entry.id === item.id ? { ...entry, read_at: readAt } : entry
    ));
  }

  function getPrivateDestination(item: PrivateNotification): boolean {
    if (item.source === 'school' || item.source === 'prayer') return true;
    if (item.target_type === 'weekly_schedule') return true;
    if (isAdmin && item.target_type === 'volunteer_application' && !!item.target_id) return true;
    if (isAdmin && item.target_type === 'instructor_application' && !!item.target_id) return true;
    if (isAdmin && item.target_type === 'activity_registration') return true;
    if (item.activity_registration_id) return true;
    return item.title.startsWith('Activitate nouă:');
  }

  async function openPrivateNotification(item: PrivateNotification) {
    await markPrivateRead(item);

    if (item.target_type === 'weekly_schedule') {
      router.push('/programul-meu');
      return;
    }

    if (item.source === 'prayer') {
      if (item.target_type === 'prayer_proposal') {
        // Administratorii autorizați pot deschide lista propunerilor.
        const { data: canView } = await supabase.rpc('misibi_prayer_allowed', { p_action: 'view' });
        if (canView) router.push('/admin/prayer');
      } else if (item.target_id) {
        router.push({ pathname: '/rugaciune/[id]', params: { id: item.target_id } });
      }
      return;
    }

    if (item.source === 'school') {
      const { data, error } = await supabase.rpc('school_planning_notification_destination', {
        p_notification_id: item.id,
      });
      if (error) {
        console.log('Eroare deschidere întâlnire:', error);
        return;
      }
      const destination = data?.[0];
      if (destination?.locality_id) {
        router.push({
          pathname: '/voluntar/prezenta/[localityId]',
          params: { localityId: destination.locality_id, meetingId: destination.meeting_id },
        });
      }
      return;
    }

    if (isAdmin && item.target_id) {
      if (item.target_type === 'volunteer_application') {
        router.push({ pathname: '/admin/volunteers/[id]', params: { id: item.target_id } });
        return;
      }
      if (item.target_type === 'instructor_application') {
        router.push({ pathname: '/admin/school-applications/[id]', params: { id: item.target_id } });
        return;
      }
    }

    if (isAdmin && item.target_type === 'activity_registration') {
      router.push({ pathname: '/admin/activities', params: { registrationId: item.target_id ?? item.activity_registration_id ?? '' } });
      return;
    }

    // Compatibilitate cu notificările private existente ale voluntarilor.
    if (item.activity_registration_id) {
      router.push('/voluntar/contul-meu');
    } else if (item.title.startsWith('Activitate nouă:')) {
      router.push('/(tabs)/calendar');
    }
  }

  function openNotification(item: AppNotification) {
    if (!item.target_id) return;

    switch (item.target_type) {
      case 'news':
        router.push({ pathname: '/noutate/[id]', params: { id: item.target_id } });
        break;
      case 'case':
        router.push({ pathname: '/caz/[id]', params: { id: item.target_id } });
        break;
      case 'project':
        router.push({ pathname: '/proiect/[id]', params: { id: item.target_id } });
        break;
      case 'report':
        router.push({ pathname: '/raport/[id]', params: { id: item.target_id } });
        break;
      default:
        break;
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}>
          <Ionicons name="chevron-back" size={24} color={DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificări</Text>
        <View style={styles.headerSpace} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'general' && styles.tabActive]} onPress={() => setTab('general')}>
          <Text style={[styles.tabText, tab === 'general' && styles.tabTextActive]}>Generale</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'private' && styles.tabActive]} onPress={() => setTab('private')}>
          <Text style={[styles.tabText, tab === 'private' && styles.tabTextActive]}>Private{privateNotifications.filter(n => !n.read_at).length > 0 ? ` (${privateNotifications.filter(n => !n.read_at).length})` : ''}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RED} />
        </View>
      ) : tab === 'private' && !signedIn ? (
        <View style={styles.emptyContent}>
          <Ionicons name="lock-closed-outline" size={38} color={RED} />
          <Text style={styles.emptyTitle}>Cont necesar</Text>
          <Text style={styles.emptyDescription}>Autentifică-te pentru a vedea notificările tale private.</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.push({
  pathname: '/voluntar/login',
  params: { from: 'notificari' },
})}>
            <Text style={styles.loginButtonText}>Autentificare / Creează cont</Text>
          </TouchableOpacity>
        </View>
      ) : tab === 'private' ? (
        privateNotifications.length === 0 ? (
          <View style={styles.emptyContent}>
            <Ionicons name="mail-outline" size={38} color={RED} />
            <Text style={styles.emptyTitle}>Nicio notificare privată</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.list, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}>
            {privateNotifications.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.notificationCard, !item.read_at && styles.notificationCardUnread]}
                activeOpacity={0.8} onPress={() => { void openPrivateNotification(item); }}>
                <View style={styles.notificationIcon}><Ionicons name={item.source === 'prayer' ? 'heart-outline' : item.source === 'school' ? 'school-outline' : item.title.startsWith('Voluntar nou înregistrat') ? 'person-add-outline' : item.title.startsWith('Cerere nouă de instructor') ? 'school-outline' : item.title.startsWith('Înscriere nouă la activitate') ? 'calendar-outline' : item.target_type === 'volunteer_application' ? 'people-outline' : item.target_type === 'instructor_application' ? 'school-outline' : item.target_type === 'activity_registration' ? 'calendar-outline' : item.activity_registration_id ? 'checkmark-circle-outline' : item.title.startsWith('Activitate nouă:') ? 'calendar-outline' : 'mail-outline'} size={21} color={RED} /></View>
                <View style={styles.notificationContent}>
                  {!item.read_at && <View style={styles.newRow}><View style={styles.newDot} /><Text style={styles.newText}>NOU</Text></View>}
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationMessage}>{item.message}</Text>
                  <Text style={styles.notificationDate}>{new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(item.created_at))}</Text>
                </View>
                {Boolean(getPrivateDestination(item)) && <Ionicons name="chevron-forward" size={18} color="#999999" style={styles.forwardIcon} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-outline" size={38} color={RED} />
          </View>
          <Text style={styles.emptyTitle}>Nicio notificare</Text>
          <Text style={styles.emptyDescription}>
            Aici vei găsi actualizări despre cazuri, proiecte și activitatea Misiunii Bucovina.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {notifications.map((item) => {
            const unread = unreadIds.includes(item.id);
            const hasDestination = Boolean(
              item.target_id &&
              ['news', 'case', 'project', 'report'].includes(item.target_type ?? '')
            );

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.notificationCard,
                  unread && styles.notificationCardUnread,
                ]}
                activeOpacity={hasDestination ? 0.75 : 1}
                disabled={!hasDestination}
                onPress={() => openNotification(item)}
                accessibilityRole={hasDestination ? 'button' : undefined}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons name="notifications" size={21} color={RED} />
                </View>
                <View style={styles.notificationContent}>
                  {unread && (
                    <View style={styles.newRow}>
                      <View style={styles.newDot} />
                      <Text style={styles.newText}>NOU</Text>
                    </View>
                  )}
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationMessage}>{item.message}</Text>
                  <Text style={styles.notificationDate}>
                    {new Intl.DateTimeFormat('ro-RO', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }).format(new Date(item.created_at))}
                  </Text>
                </View>
                {hasDestination && (
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#999999"
                    style={styles.forwardIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACKGROUND , ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingBottom: 10, gap: 10 , ...(Platform.OS === "web" ? { width: "100%", maxWidth: 980, alignSelf: "center", paddingHorizontal: 0, paddingTop: 22, paddingBottom: 14, backgroundColor: "transparent", gap: 14 } : {})},
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F4F4F4', alignItems: 'center' , ...(Platform.OS === "web" ? { paddingVertical: 15, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E9EC" } : {})},
  tabActive: { backgroundColor: '#FFF0F0' , ...(Platform.OS === "web" ? { backgroundColor: "#FFF0F0", borderColor: "#EECBCD" } : {})},
  tabText: { color: '#666666', fontWeight: '800' , ...(Platform.OS === "web" ? { fontSize: 14 } : {})},
  tabTextActive: { color: RED },
  loginButton: { backgroundColor: RED, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, marginTop: 18 , ...(Platform.OS === "web" ? { paddingHorizontal: 25, paddingVertical: 16, borderRadius: 13 } : {})},
  loginButtonText: { color: '#FFFFFF', fontWeight: '800' },
  header: {
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
   ...(Platform.OS === "web" ? { height: 82, paddingHorizontal: 32, borderBottomWidth: 1, borderBottomColor: "#E9E9EC" } : {})},
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: DARK, fontSize: 18, fontWeight: '900' , ...(Platform.OS === "web" ? { fontSize: 24 } : {})},
  headerSpace: { width: 42 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
    paddingBottom: 80,
   ...(Platform.OS === "web" ? { width: "100%", maxWidth: 620, alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 22, paddingHorizontal: 48, paddingVertical: 48, marginTop: 70, flex: 0, minHeight: 300, borderWidth: 1, borderColor: "#ECECEF" } : {})},
  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: DARK, fontSize: 21, fontWeight: '900' , ...(Platform.OS === "web" ? { fontSize: 24 } : {})},
  emptyDescription: {
    color: '#777777',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 300,
   ...(Platform.OS === "web" ? { fontSize: 15, lineHeight: 24, maxWidth: 420 } : {})},
  list: { padding: 16, paddingBottom: 35, gap: 11 , ...(Platform.OS === "web" ? { width: "100%", maxWidth: 980, alignSelf: "center", paddingHorizontal: 0, paddingTop: 12, paddingBottom: 55, gap: 12 } : {})},
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
   ...(Platform.OS === "web" ? { padding: 22, borderRadius: 16, borderWidth: 1, borderColor: "#ECECEF", minHeight: 100 } : {})},
  notificationIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
   ...(Platform.OS === "web" ? { width: 52, height: 52, borderRadius: 16, marginRight: 18 } : {})},
  notificationContent: { flex: 1 },
  notificationTitle: { color: DARK, fontSize: 15, fontWeight: '900' , ...(Platform.OS === "web" ? { fontSize: 16 } : {})},
  notificationMessage: {
    color: '#666666',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
   ...(Platform.OS === "web" ? { fontSize: 14, lineHeight: 22 } : {})},
  notificationDate: { color: '#999999', fontSize: 10, marginTop: 9 , ...(Platform.OS === "web" ? { fontSize: 12, marginTop: 12 } : {})},
  notificationCardUnread: {
    backgroundColor: '#FFF7F7',
    borderWidth: 1,
    borderColor: '#F3DADA',
  },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: RED },
  newText: { color: RED, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  forwardIcon: { marginLeft: 6 },
});
