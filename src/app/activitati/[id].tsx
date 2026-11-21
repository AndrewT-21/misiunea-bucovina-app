import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
type Activity = { id: string; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string | null; max_volunteers: number | null };

export default function ActivityDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      if (typeof id !== 'string' || !id) {
        setError('Activitate invalidă.');
        setLoading(false);
        return;
      }
      const { data, error: fetchError } = await supabase.from('activities')
        .select('id,title,description,location,starts_at,ends_at,max_volunteers')
        .eq('id', id).eq('is_published', true).maybeSingle();
      if (!active) return;
      setActivity((data ?? null) as Activity | null);
      setError(fetchError?.message ?? (!data ? 'Activitatea nu este disponibilă.' : ''));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id]);

  const formatDate = (value: string) => new Date(value).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (value: string) => new Date(value).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/calendar')}>
        <Ionicons name="arrow-back" size={20} color={RED}/><Text style={styles.backText}>Înapoi la calendar</Text>
      </TouchableOpacity>
      {loading ? <ActivityIndicator color={RED}/> : error ? <Text style={styles.error}>{error}</Text> : activity ? <>
        <View style={styles.headerIcon}><Ionicons name="calendar-outline" size={30} color={RED}/></View>
        <Text style={styles.eyebrow}>MISIUNEA BUCOVINA · ACTIVITĂȚI</Text>
        <Text style={styles.title}>{activity.title}</Text>
        <Text style={styles.meta}>Activitate programată</Text>
        <View style={styles.card}>
          <Text style={styles.label}>DATA ȘI ORA</Text>
          <Text style={styles.strong}>{formatDate(activity.starts_at)}</Text>
          <Text style={styles.body}>{formatTime(activity.starts_at)}{activity.ends_at ? ` – ${formatTime(activity.ends_at)}` : ''}</Text>
        </View>
        {!!activity.location && <View style={styles.card}><Text style={styles.label}>LOCAȚIE</Text><Text style={styles.body}>{activity.location}</Text></View>}
        {!!activity.description && <View style={styles.card}><Text style={styles.label}>DESCRIERE</Text><Text style={styles.body}>{activity.description}</Text></View>}
        <View style={styles.card}><Text style={styles.label}>PARTICIPARE</Text><Text style={styles.body}>{activity.max_volunteers == null ? 'Locuri nelimitate' : `${activity.max_volunteers} locuri disponibile în total`}</Text><Text style={styles.hint}>Pentru înscriere și verificarea locurilor rămase, folosește calendarul.</Text></View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF6F2' },
  content: { padding: 22, paddingBottom: 50, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 30 },
  backText: { color: RED, fontWeight: '800' },
  headerIcon: { width: 62, height: 62, borderRadius: 19, backgroundColor: '#FCE8E5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  eyebrow: { fontSize: 10, letterSpacing: 1.2, color: RED, fontWeight: '900' },
  title: { fontSize: 27, color: '#1D1D1F', fontWeight: '900', marginTop: 8, marginBottom: 10 },
  meta: { color: '#77716E', fontSize: 13, marginBottom: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 13, borderWidth: 1, borderColor: '#F0E5E1' },
  label: { color: RED, fontSize: 10, letterSpacing: 0.7, fontWeight: '900', marginBottom: 10 },
  strong: { fontSize: 17, fontWeight: '800', color: '#1D1D1F', marginBottom: 5 },
  body: { color: '#343434', fontSize: 15, lineHeight: 24 },
  hint: { color: '#77716E', fontSize: 12, lineHeight: 19, marginTop: 10 },
  error: { color: RED, fontSize: 14 },
});
