import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SchoolAdminGate from '../../../../components/SchoolAdminGate';
import { supabase } from '../../../../lib/supabase';

const RED = '#A61E22';
const INK = '#202124';
type Meeting = { id: string; meeting_date: string; title: string | null; closed_at: string | null; cancelled_at?: string | null; meeting_time?: string | null; start_time?: string | null; notes?: string | null };
type Child = { id: string; first_name: string; last_name: string };
type Entry = { child_id: string; status: string; reason: string | null };
type Staff = { user_id: string; full_name: string; is_present: boolean | null; response?: string | null; removed_at?: string | null };
const dateLabel = (d: string) => { const x = /^(\d{4})-(\d\d)-(\d\d)/.exec(d); return x ? `${x[3]}.${x[2]}.${x[1]}` : d; };
const statusLabel = (s?: string | null) => s === 'present' ? 'Prezent' : s === 'absent' ? 'Absent' : s === 'uncertain' ? 'De clarificat' : 'Nemarcat';
const responseLabel = (s?: string | null) => s === 'confirmed' ? 'Confirmat' : s === 'declined' ? 'Refuzat' : s === 'pending' ? 'În așteptare' : s === 'withdrawn' ? 'Retras' : 'Neconfirmat';
const getTime = (m: Meeting) => { const raw = m.meeting_time || m.start_time || (m.meeting_date?.includes('T') ? m.meeting_date.split('T')[1] : ''); return raw && /^\d\d:\d\d/.test(raw) ? raw.slice(0,5) : null; };
const activityTitle = (a: any) => a.activity_name || a.activity_label || a.activity || a.title || a.name || 'Activitate';
const activityPerson = (a: any) => a.full_name || a.instructor_name || a.assigned_to_name || a.user_name || null;

function Metric({ value, label }: { value: string | number; label: string }) { return <View style={styles.metric}><Text style={styles.metricNumber}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function SectionTitle({ icon, title }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string }) { return <View style={styles.sectionHeading}><Ionicons name={icon} size={18} color={RED}/><Text style={styles.section}>{title}</Text></View>; }
function MeetingsReadOnly() {
  const { localityId } = useLocalSearchParams<{ localityId: string }>();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingSearch, setMeetingSearch] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<Entry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [detail, setDetail] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError(''); setSelected(null);
    try {
      if (!localityId || typeof localityId !== 'string') throw new Error('Localitate invalidă.');
      const [m, c] = await Promise.all([
        supabase.rpc('school_attendance_list_meetings_with_time', { p_locality_id: localityId }),
        supabase.rpc('school_attendance_list_children', { p_locality_id: localityId }),
      ]);
      if (m.error) throw m.error;
      if (c.error) throw c.error;
      setMeetings(((m.data ?? []) as Meeting[]).slice().sort((a,b) => b.meeting_date.localeCompare(a.meeting_date)));
      setChildren((c.data ?? []) as Child[]);
    } catch (e: any) { setError(e?.message ?? 'Nu s-au putut încărca întâlnirile.'); }
    finally { setLoading(false); }
  }, [localityId]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const openMeeting = async (id: string) => {
    if (selected === id) { setSelected(null); return; }
    setSelected(id); setDetailsLoading(true); setDetailsError(''); setAttendance([]); setStaff([]); setActivities([]); setDetail({});
    try {
      const [a, s, p] = await Promise.all([
        supabase.rpc('school_attendance_get_details', { p_meeting_id: id }),
        supabase.rpc('school_staff_attendance_list', { p_meeting_id: id }),
        supabase.rpc('school_planning_details', { p_meeting_id: id }),
      ]);
      if (a.error) setDetailsError(a.error.message);
      else setAttendance((a.data ?? []) as Entry[]);
      if (!s.error) setStaff((s.data ?? []) as Staff[]);
      if (!p.error && p.data && typeof p.data === 'object') {
        const d = Array.isArray(p.data) ? (p.data[0] ?? {}) : p.data as any;
        setDetail(d);
        setActivities(Array.isArray(d.activities) ? d.activities : Array.isArray(d.meeting_activities) ? d.meeting_activities : []);
      }
    } catch (e: any) { setDetailsError(e?.message ?? 'Nu s-au putut încărca detaliile.'); }
    finally { setDetailsLoading(false); }
  };
  const filtered = useMemo(() => meetings.filter(m => `${m.title || ''} ${dateLabel(m.meeting_date)}`.toLocaleLowerCase('ro').includes(meetingSearch.trim().toLocaleLowerCase('ro'))), [meetings,meetingSearch]);
  const current = meetings.find(m => m.id === selected);
  const activeStaff = staff.filter(s => !s.removed_at);
  const confirmed = activeStaff.filter(s => s.response === 'confirmed');
  const presentStaff = activeStaff.filter(s => s.is_present === true).length;
  const childPresent = children.filter(c => attendance.some(a => a.child_id === c.id && a.status === 'present')).length;
  const childMarked = children.filter(c => attendance.some(a => a.child_id === c.id && ['present','absent','uncertain'].includes(a.status))).length;
  const detailNotes = typeof detail.notes === 'string' ? detail.notes : typeof detail.description === 'string' ? detail.description : null;
  return <SafeAreaView style={styles.root} edges={['top']}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={24} color={INK}/></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.eyebrow}>ȘCOALA CREȘTINĂ · CONSULTARE</Text><Text style={styles.title}>Întâlniri și prezențe</Text></View>
    </View>
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}><Ionicons name="calendar-outline" size={21} color={RED}/><View style={{flex:1}}><Text style={styles.introTitle}>Evidența întâlnirilor</Text><Text style={styles.muted}>Program, echipă, activități și prezențe într-un singur loc. Datele sunt doar pentru consultare.</Text></View></View>
      <View style={styles.summary}><Metric value={meetings.length} label="Întâlniri"/><Metric value={meetings.filter(m=>!!m.closed_at).length} label="Finalizate"/><Metric value={meetings.filter(m=>!m.closed_at && !m.cancelled_at).length} label="Deschise"/></View>
      <View style={styles.searchBox}><Ionicons name="search-outline" size={20} color="#888"/><TextInput style={styles.searchInput} placeholder="Caută după titlu sau dată..." placeholderTextColor="#999" value={meetingSearch} onChangeText={setMeetingSearch}/></View>
      <Text style={styles.listTitle}>ÎNTÂLNIRI {filtered.length ? `· ${filtered.length}` : ''}</Text>
      {loading ? <ActivityIndicator color={RED} style={{marginTop:25}}/> : error ? <Text style={styles.error}>{error}</Text> : meetings.length === 0 ? <Text style={styles.empty}>Nu există întâlniri pentru această localitate.</Text> : filtered.length === 0 ? <Text style={styles.empty}>Nu am găsit întâlniri pentru această căutare.</Text> : filtered.map(m => <View key={m.id} style={styles.card}>
        <TouchableOpacity onPress={() => void openMeeting(m.id)} style={styles.meeting} accessibilityRole="button" accessibilityLabel={`Detalii ${m.title || 'întâlnire'}`}>
          <View style={styles.dateIcon}><Ionicons name="calendar-outline" size={22} color={RED}/></View>
          <View style={{ flex: 1, gap: 6 }}><Text style={styles.name}>{m.title || 'Întâlnire'}</Text><View style={styles.metaRow}><Ionicons name="time-outline" size={14} color="#777"/><Text style={styles.muted}>{dateLabel(m.meeting_date)}{getTime(m) ? ` · ${getTime(m)}` : ''}</Text></View><View style={[styles.pill, m.cancelled_at ? styles.pillCancelled : m.closed_at ? styles.pillClosed : styles.pillOpen]}><Text style={styles.pillText}>{m.cancelled_at ? 'Anulată' : m.closed_at ? 'Finalizată' : 'Deschisă'}</Text></View></View>
          <Ionicons name={selected === m.id ? 'chevron-up' : 'chevron-down'} size={21} color={RED}/>
        </TouchableOpacity>
        {selected === m.id && <View style={styles.details}>
          {detailsLoading ? <ActivityIndicator color={RED} style={{margin:20}}/> : <>
            {!!detailsError && <Text style={styles.error}>{detailsError}</Text>}
            <SectionTitle icon="information-circle-outline" title="DESPRE ÎNTÂLNIRE"/>
            <View style={styles.detailRow}><Text style={styles.muted}>Data</Text><Text style={styles.detailValue}>{dateLabel(m.meeting_date)}</Text></View>
            {!!getTime(m) && <View style={styles.detailRow}><Text style={styles.muted}>Ora</Text><Text style={styles.detailValue}>{getTime(m)}</Text></View>}
            <View style={styles.detailRow}><Text style={styles.muted}>Stare</Text><Text style={styles.detailValue}>{m.cancelled_at ? 'Anulată' : m.closed_at ? 'Finalizată' : 'Deschisă'}</Text></View>
            {!!(detailNotes || m.notes) && <Text style={styles.note}>{detailNotes || m.notes}</Text>}
            <SectionTitle icon="people-outline" title="ECHIPĂ ȘI PARTICIPARE"/>
            {activeStaff.length > 0 ? <>
              <View style={styles.metricsInline}><Metric value={activeStaff.length} label="Membri"/><Metric value={confirmed.length} label="Confirmați"/><Metric value={presentStaff} label="Prezenți"/></View>
              {activeStaff.map((s,i) => <View key={`${s.user_id}-${i}`} style={styles.line}><Text style={styles.person}>{s.full_name || 'Membru echipă'}</Text><Text style={styles.muted}>Participare: {responseLabel(s.response)}</Text><Text style={styles.muted}>Prezență: {s.is_present === true ? 'Prezent' : s.is_present === false ? 'Absent' : 'Nemarcat'}</Text></View>)}
            </> : <Text style={styles.muted}>Nu există informații despre echipă disponibile pentru consultare.</Text>}
            <SectionTitle icon="school-outline" title="PREZENȚA COPIILOR"/>
            <View style={styles.metricsInline}><Metric value={children.length} label="Înregistrați"/><Metric value={childPresent} label="Prezenți"/><Metric value={childMarked} label="Marcați"/></View>
            {children.length === 0 ? <Text style={styles.muted}>Nu există copii înregistrați în această localitate.</Text> : children.map(c => { const a = attendance.find(x => x.child_id === c.id); return <View key={c.id} style={styles.line}><Text style={styles.person}>{c.last_name} {c.first_name}</Text><Text style={styles.muted}>{statusLabel(a?.status)}{a?.reason ? ` · Motiv: ${a.reason}` : ''}</Text></View>; })}
            <SectionTitle icon="book-outline" title="ACTIVITĂȚI"/>
            {activities.length ? activities.map((a,i) => <View key={i} style={styles.line}><Text style={styles.person}>{activityTitle(a)}</Text>{!!activityPerson(a) && <Text style={styles.muted}>Responsabil: {activityPerson(a)}</Text>}{!!a.notes && <Text style={styles.muted}>{a.notes}</Text>}</View>) : <Text style={styles.muted}>Nu există activități disponibile pentru vizualizare.</Text>}
          </>}
        </View>}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:'#F6F6F6'}, header:{...(Platform.OS==='web'?{width:'100%' as const,maxWidth:1040,alignSelf:'center' as const}:{}),flexDirection:'row',alignItems:'center',padding:15,gap:12}, back:{width:44,height:44,borderRadius:14,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'}, eyebrow:{fontSize:10,fontWeight:'900',color:RED},title:{fontSize:23,fontWeight:'900',color:INK},
  body:{...(Platform.OS==='web'?{width:'100%' as const,maxWidth:1040,alignSelf:'center' as const}:{}),padding:15,paddingBottom:80},intro:{flexDirection:'row',gap:12,backgroundColor:'#FFF',padding:17,borderRadius:18,marginBottom:13},introTitle:{fontSize:15,fontWeight:'800',color:INK,marginBottom:4},muted:{fontSize:12,lineHeight:19,color:'#777'},
  summary:{flexDirection:'row',gap:9,marginBottom:17},metric:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#F9F7F7',borderRadius:12,paddingVertical:12,paddingHorizontal:5},metricNumber:{fontSize:19,fontWeight:'900',color:INK},metricLabel:{fontSize:10,color:'#777',marginTop:4,textAlign:'center'},
  searchBox:{backgroundColor:'#FFF',borderRadius:15,borderWidth:1,borderColor:'#EAE4E4',paddingHorizontal:14,flexDirection:'row',gap:9,alignItems:'center',marginBottom:17},searchInput:{flex:1,height:50,color:INK,fontSize:14},listTitle:{fontSize:11,fontWeight:'900',letterSpacing:1.3,color:'#777',marginBottom:3},
  card:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#EEE7E7',borderRadius:18,marginTop:12,overflow:'hidden'},meeting:{flexDirection:'row',alignItems:'center',padding:16,gap:12},dateIcon:{width:45,height:45,borderRadius:13,backgroundColor:'#FFF1F1',alignItems:'center',justifyContent:'center'},name:{fontSize:16,fontWeight:'800',color:INK},metaRow:{flexDirection:'row',alignItems:'center',gap:5},pill:{alignSelf:'flex-start',borderRadius:9,paddingVertical:4,paddingHorizontal:9},pillOpen:{backgroundColor:'#EAF7EE'},pillClosed:{backgroundColor:'#F1F1F1'},pillCancelled:{backgroundColor:'#FFF0F0'},pillText:{fontSize:10,fontWeight:'800',color:'#555'},
  details:{padding:16,paddingTop:4,borderTopWidth:1,borderTopColor:'#EEE'},sectionHeading:{flexDirection:'row',alignItems:'center',gap:8,marginTop:21,marginBottom:10},section:{color:'#555',fontSize:11,fontWeight:'900',letterSpacing:0.9},detailRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6,gap:10},detailValue:{fontSize:12,color:INK,fontWeight:'700'},note:{color:'#555',fontSize:12,lineHeight:19,backgroundColor:'#FAF8F8',padding:12,borderRadius:10,marginTop:8},metricsInline:{flexDirection:'row',gap:7,marginBottom:10},line:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#F2F2F2'},person:{fontSize:14,fontWeight:'700',color:INK,marginBottom:3},error:{color:RED,marginVertical:10},empty:{fontSize:13,color:'#777',padding:20,backgroundColor:'#FFF',borderRadius:14,marginTop:10}
});
export default function ProtectedMeetingsReadOnly() { return <SchoolAdminGate permission="can_view"><MeetingsReadOnly /></SchoolAdminGate>; }
