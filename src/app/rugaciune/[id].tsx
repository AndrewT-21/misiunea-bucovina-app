import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
type PrayerEvent = { id: string; title: string; description: string; event_type: string; category: string; event_date: string; bible_verse: string | null; related_id: string | null };
const CATEGORIES: Record<string, string> = { mission: 'Pentru misiune', case: 'Pentru un caz', project: 'Pentru un proiect', activity: 'Pentru o activitate' };
export default function PrayerEventDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<PrayerEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      if (typeof id !== 'string') { setError('Eveniment invalid.'); setLoading(false); return; }
      const { data, error: err } = await supabase.from('prayer_events')
        .select('id,title,description,event_type,category,event_date,bible_verse,related_id')
        .eq('id', id).eq('status', 'approved').maybeSingle();
      if (!active) return;
      setEvent((data ?? null) as PrayerEvent | null);
      setError(err?.message ?? (!data ? 'Evenimentul nu este disponibil.' : ''));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id]);
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/calendar'))}><Ionicons name="arrow-back" size={20} color={RED}/><Text style={styles.backText}>Înapoi la calendar</Text></TouchableOpacity>
      {loading ? <ActivityIndicator color={RED}/> : error ? <Text style={styles.error}>{error}</Text> : event ? <>
        <View style={styles.headerIcon}><Ionicons name={event.event_type === 'fasting_prayer' ? 'sunny-outline' : 'heart-outline'} size={30} color={RED}/></View>
        <Text style={styles.eyebrow}>MISIUNEA BUCOVINA · POST ȘI RUGĂCIUNE</Text>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.meta}>{event.event_type === 'fasting_prayer' ? 'Zi de post și rugăciune' : 'Zi de rugăciune'} · {CATEGORIES[event.category] ?? event.category}</Text>
        <View style={styles.card}><Text style={styles.label}>DATA</Text><Text style={styles.strong}>{event.event_date.split('-').reverse().join('.')}</Text></View>
        <View style={styles.card}><Text style={styles.label}>DESCRIERE ȘI MOTIVE DE RUGĂCIUNE</Text><Text style={styles.body}>{event.description}</Text></View>
        {!!event.bible_verse && <View style={styles.card}><Text style={styles.label}>VERSET BIBLIC</Text><Text style={styles.body}>{event.bible_verse}</Text></View>}
        {event.category === 'case' && event.related_id && <TouchableOpacity style={styles.link} onPress={() => router.push({ pathname: '/caz/[id]', params: { id: event.related_id! } })}><Text style={styles.linkText}>Vezi cazul asociat  →</Text></TouchableOpacity>}
        {event.category === 'project' && event.related_id && <TouchableOpacity style={styles.link} onPress={() => router.push({ pathname: '/proiect/[id]', params: { id: event.related_id! } })}><Text style={styles.linkText}>Vezi proiectul asociat  →</Text></TouchableOpacity>}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF6F2' }, content: { padding: 22, paddingBottom: 50, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 30 }, backText: { color: RED, fontWeight: '800' },
  headerIcon: { width: 62, height: 62, borderRadius: 19, backgroundColor: '#FCE8E5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, color: RED, fontWeight: '900' }, title: { fontSize: 27, color: '#1D1D1F', fontWeight: '900', marginTop: 8, marginBottom: 10 },
  meta: { color: '#77716E', fontSize: 13, marginBottom: 22 }, card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 13, borderWidth: 1, borderColor: '#F0E5E1' },
  label: { color: RED, fontSize: 10, letterSpacing: 0.7, fontWeight: '900', marginBottom: 10 }, strong: { fontSize: 17, fontWeight: '800', color: '#1D1D1F', marginBottom: 5 },
  body: { color: '#343434', fontSize: 15, lineHeight: 24 }, link: { padding: 15, backgroundColor: '#FCE8E5', borderRadius: 14, marginTop: 5 }, linkText: { color: RED, fontWeight: '800' },
  error: { color: RED, fontSize: 14 },
});
