import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type NotificationItem = {
  id: string;
  title: string;
  message: string | null;
  status: 'published' | 'draft';
  created_at: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nu s-au putut încărca notificările.';
}

export default function AdminNotificationsScreen() {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 760;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter,setFilter] = useState<'all'|'published'|'draft'>('all');
  const [search,setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadNotifications = useCallback(async (isActive: () => boolean, refresh = false) => {
    if (isActive()) {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = supabase
        .from('notifications')
        .select('id, title, message, status, created_at')
        .order('created_at', { ascending: false });

      const { data, error: queryError } = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Cererea a depășit 12 secunde. Verifică conexiunea și încearcă din nou.')), 12000);
        }),
      ]);
      if (queryError) throw queryError;
      if (isActive()) setNotifications((data ?? []) as NotificationItem[]);
    } catch (err) {
      console.error('Eroare încărcare notificări admin:', err);
      if (isActive()) setError(errorMessage(err));
    } finally {
      if (timeout) clearTimeout(timeout);
      if (isActive()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadNotifications(() => active);
      return () => { active = false; };
    }, [loadNotifications, reloadKey])
  );

  const publishedCount = notifications.filter((item) => item.status === 'published').length;
  const draftCount = notifications.filter((item) => item.status === 'draft').length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, isWide && styles.wideContent]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={RED}
            onRefresh={() => setReloadKey((value) => value + 1)}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Înapoi">
            <Ionicons name="arrow-back" size={22} color={DARK} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ADMINISTRARE</Text>
            <Text style={styles.title}>Notificări</Text>
            <Text style={styles.subtitle}>Gestionează notificările trimise utilizatorilor aplicației.</Text>
          </View>
        </View>

        <View style={[styles.summaryRow, !isWide && styles.summaryRowCompact]}>
          {([{key:'all',label:'Total',count:notifications.length},{key:'published',label:'Publicate',count:publishedCount},{key:'draft',label:'Ciorne',count:draftCount}] as const).map(stat=>(
            <TouchableOpacity key={stat.key} accessibilityRole="tab" accessibilityState={{selected:filter===stat.key}} onPress={()=>setFilter(stat.key)} style={[styles.summaryCard,{borderColor:filter===stat.key?RED:'#ECECEC'}]}>
              <Text style={styles.summaryNumber}>{stat.count}</Text><Text style={[styles.summaryLabel,filter===stat.key&&{color:RED,fontWeight:'800'}]}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{gap:12,marginBottom:18}}>
          <Text style={styles.sectionTitle}>{filter==='all'?'Toate notificările':filter==='published'?'Notificări publicate':'Ciorne'}</Text>
          <TouchableOpacity style={[styles.addButton,{alignSelf:'flex-start',width:'auto',height:46,paddingHorizontal:18,flexDirection:'row',gap:8,borderRadius:14}]} onPress={()=>router.push('/admin/notifications/new' as any)}>
            <Ionicons name="add" size={24} color="#FFFFFF"/><Text style={styles.addText}>Adaugă notificare</Text>
          </TouchableOpacity>
          <View style={{backgroundColor:'#FFF',borderRadius:14,paddingHorizontal:13,minHeight:46,flexDirection:'row',alignItems:'center',gap:9}}>
            <Ionicons name="search-outline" size={19} color="#888"/>
            <TextInput style={{flex:1,fontSize:14,color:DARK}} placeholder="Caută după titlu..." placeholderTextColor="#999" value={search} onChangeText={setSearch}/>
          </View>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={RED} />
            <Text style={styles.stateText}>Se încarcă notificările...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Ionicons name="alert-circle-outline" size={35} color={RED} />
            <Text style={styles.stateTitle}>Nu am putut încărca notificările</Text>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => setReloadKey((value) => value + 1)}>
              <Text style={styles.retryText}>Reîncearcă</Text>
            </TouchableOpacity>
          </View>
        ) : notifications.filter(item=>(filter==='all'||item.status===filter)&&item.title.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))).length === 0 ? (
          <View style={styles.stateBox}>
            <Ionicons name="newspaper-outline" size={42} color="#AAAAAA" />
            <Text style={styles.stateTitle}>Nu există notificări încă</Text>
            <Text style={styles.stateText}>Adaugă prima notificare pentru a începe.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.filter(item=>(filter==='all'||item.status===filter)&&item.title.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.newsCard, !isWide && styles.newsCardCompact]}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: '/admin/notifications/[id]', params: { id: item.id } } as any)}
              >
                {<View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Ionicons name="notifications-outline" size={28} color={RED} />
                </View>}
                <View style={styles.newsInfo}>
                  <View style={styles.newsTopRow}>
                    <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={[styles.statusBadge, item.status === 'published' ? styles.publishedBadge : styles.draftBadge]}>
                      <Text style={[styles.statusText, item.status === 'published' ? styles.publishedText : styles.draftText]}>
                        {item.status === 'published' ? 'Publicat' : 'Draft'}
                      </Text>
                    </View>
                  </View>
                  {!!item.message && <Text style={styles.newsDescription} numberOfLines={2}>{item.message.replace(/\bMisiBi\b/gi, "Misiunea Bucovina")}</Text>}
                  <Text style={styles.newsDate}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('ro-RO') : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#B4B4B4" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACKGROUND },
  content: { width: '100%', padding: 16, paddingBottom: 60 },
  wideContent: { maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 25 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 24 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ECECEC' },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, color: RED, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '900', color: DARK, marginTop: 3 },
  subtitle: { color: '#777777', fontSize: 12, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 14, marginBottom: 28 },
  summaryRowCompact: { gap: 8 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 17, padding: 18, borderWidth: 1, borderColor: '#ECECEC' },
  summaryNumber: { color: DARK, fontSize: 25, fontWeight: '900' },
  summaryLabel: { color: '#777777', fontSize: 11, marginTop: 5 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, gap: 12 },
  actionsColumn: { alignItems: 'flex-start', flexDirection: 'column' },
  sectionTitle: { color: DARK, fontSize: 18, fontWeight: '900' },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  refreshButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E9E9' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: RED, borderRadius: 13, paddingHorizontal: 16, minHeight: 44 },
  addText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  stateBox: { minHeight: 250, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#ECECEC', padding: 22, gap: 12 },
  stateTitle: { color: DARK, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  stateText: { color: '#777777', fontSize: 12, textAlign: 'center', lineHeight: 19 },
  retryButton: { backgroundColor: RED, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 5 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  list: { gap: 12 },
  newsCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 13, borderWidth: 1, borderColor: '#ECECEC', flexDirection: 'row', alignItems: 'center', gap: 14 },
  newsCardCompact: { gap: 10, padding: 10 },
  thumbnail: { width: 100, height: 80, borderRadius: 11 },
  thumbnailPlaceholder: { backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' },
  newsInfo: { flex: 1, gap: 6 },
  newsTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between' },
  newsTitle: { flex: 1, color: DARK, fontSize: 13, fontWeight: '900' },
  newsDescription: { color: '#777777', fontSize: 11, lineHeight: 17 },
  newsDate: { color: '#999999', fontSize: 10 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  publishedBadge: { backgroundColor: '#EAF7EE' },
  draftBadge: { backgroundColor: '#F0F0F0' },
  statusText: { fontSize: 10, fontWeight: '800' },
  publishedText: { color: '#257A3E' },
  draftText: { color: '#777777' },
});
