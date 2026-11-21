import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
type Department = { department_id: string; department_slug: string; department_name: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean };
export default function AdminMyDepartments() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManageWeeklySchedule, setCanManageWeeklySchedule] = useState(false);
  const [errorText, setErrorText] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setErrorText('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.replace('/admin-login'); return; }
      const { data: admin, error: roleError } = await supabase.from('admins').select('role').eq('user_id', user.id).maybeSingle();
      if (roleError) throw roleError;
      if (admin?.role !== 'admin') { router.replace('/admin'); return; }
      const [departmentsResult, weeklyResult] = await Promise.all([
        supabase.rpc('misibi_my_admin_permissions'),
        supabase.rpc('weekly_schedule_can_manage'),
      ]);
      if (departmentsResult.error) throw departmentsResult.error;
      if (weeklyResult.error) throw weeklyResult.error;
      setItems(((departmentsResult.data ?? []) as Department[]).filter(d => d.can_view));
      setCanManageWeeklySchedule(weeklyResult.data === true);
    } catch (e: any) { setErrorText(e?.message ?? 'Nu am putut încărca departamentele.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return <SafeAreaView style={s.screen} edges={['top']}>
    <View style={s.header}><TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={24} color="#171717"/></TouchableOpacity><Text style={s.title}>Departamentele mele</Text></View>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.description}>Departamentele la care ai acces administrativ, în funcție de permisiunile acordate.</Text>
      {loading ? <ActivityIndicator color={RED}/> : errorText ? <Text style={s.error}>{errorText}</Text> : <>
      {canManageWeeklySchedule && <TouchableOpacity style={s.card} onPress={() => router.push('/admin/weekly-schedule' as any)}>
        <Ionicons name="calendar-outline" size={25} color={RED}/>
        <View style={{ flex: 1 }}><Text style={s.name}>Program săptămânal</Text><Text style={s.small}>Planificare și asignare activități</Text></View>
        <Ionicons name="chevron-forward" size={20} color={RED}/>
      </TouchableOpacity>}
      {items.length === 0 && !canManageWeeklySchedule ? <Text style={s.description}>Nu ai încă departamente sau module cu acces administrativ.</Text> : null}
      {items.map(d => <TouchableOpacity key={d.department_id} style={s.card} onPress={() => {
        if (['post-rugaciune', 'post-si-rugaciune'].includes(d.department_slug)) router.push('/admin/prayer' as any);
        else if (d.department_slug === 'calendar-activitati') router.push('/admin/calendar-proposals' as any);
        else if (d.department_slug === 'cazuri') router.push('/admin/cases' as any);
        else if (d.department_slug === 'proiecte') router.push('/admin/projects' as any);
        else if (d.department_slug === 'comunicare') router.push('/admin/news' as any);
        else if (d.department_slug === 'donatii') router.push('/admin/donations' as any);
        else if (d.department_slug === 'rapoarte') router.push('/admin/reports' as any);
        else if (d.department_slug === 'cereri-voluntariat') router.push('/admin/volunteers' as any);
        else if (d.department_slug === 'solicitari-ajutor') router.push('/admin/help-requests' as any);
        else if (d.department_slug === 'scoala-crestina') router.push('/admin/school');
        else if (d.department_slug === 'voluntariat') router.push('/admin/volunteer-page' as any);
        else setErrorText(`Pagina departamentului „${d.department_name}” nu este configurată încă.`);
      }}>
        <Ionicons name="grid-outline" size={25} color={RED}/>
        <View style={{ flex: 1 }}><Text style={s.name}>{d.department_name}</Text><Text style={s.small}>{[d.can_view && 'Vizualizare', d.can_create && 'Creare', d.can_edit && 'Editare', d.can_delete && 'Ștergere'].filter(Boolean).join(' · ')}</Text></View>
        <Ionicons name="chevron-forward" size={20} color={RED}/>
      </TouchableOpacity>)}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F6F6F6' }, header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }, back: { width:44, height:44, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 27, fontWeight: '900', color: '#171717' }, content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), padding: 16 }, description: { color: '#777', lineHeight: 21, marginBottom: 18 }, card: { backgroundColor: '#FFF', borderRadius: 15, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, name: { fontSize: 16, fontWeight: '800', color: '#171717' }, small: { color: '#777', fontSize: 12, marginTop: 6 }, error: { color: RED, marginBottom: 14 } });
