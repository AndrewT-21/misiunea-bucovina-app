import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SchoolAdminGate from '../../../components/SchoolAdminGate';
import { useSchoolAdminPermissions } from '../../../hooks/useSchoolAdminPermissions';
import { exportSchoolAnnualPdf } from '../../../lib/pdfRaport';
import { Alert } from '../../../lib/platform-alert';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const GREEN = '#198754';
const DARK = '#171717';
type Locality = { id: string; name: string };
type ChildRow = { child_id: string; name: string; status: 'present' | 'absent' | 'uncertain'; reason: string | null };
type StaffRow = { user_id: string; name: string; is_present: boolean | null };
type Meeting = { id: string; locality_id: string; locality_name: string; meeting_date: string; title: string | null; closed_at: string | null; children: ChildRow[]; staff: StaffRow[] };
type StaffSummary = { user_id: string; full_name: string; present: number; absent: number; unmarked: number };
type Totals = { meetings: number; closed_meetings: number; registered_children: number; children_present: number; children_absent: number; children_uncertain: number; staff_present: number; staff_absent: number; unique_staff_participants: number };
type Report = { start_year: number; localities: Locality[]; totals: Totals; staff: StaffSummary[]; meetings: Meeting[] };
const dateRO = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };
const initialYear = () => { const d = new Date(); return d.getMonth() >= 9 ? d.getFullYear() : d.getFullYear()-1; };

function RaportAnualSchool() {
  const { rights, loadingRights } = useSchoolAdminPermissions();
  const [year, setYear] = useState(initialYear);
  const [localityId, setLocalityId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvals, setApprovals] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('school_annual_report', {
      p_start_year: year, p_locality_id: localityId,
    });
    if (rpcError) { setError(rpcError.message); setReport(null); }
    else {
      const result = data as Report;
      setReport(result);
      if (localityId === null) setLocalities(result.localities ?? []);
    }
    const approvalResult = await supabase.rpc('school_annual_approval_status', { p_start_year: year });
    if (approvalResult.error) { setError(approvalResult.error.message); }
    else {
      const next: Record<string, string> = {};
      for (const a of (approvalResult.data ?? []) as {locality_id: string; approved_at: string}[]) next[a.locality_id] = a.approved_at;
      setApprovals(next);
    }
    setLoading(false);
  }, [year, localityId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const closedMeetings = useMemo(() => (report?.meetings ?? []).filter(m => Boolean(m.closed_at)), [report]);
  const openMeetings = useMemo(() => (report?.meetings ?? []).filter(m => !m.closed_at), [report]);
  const schoolYearEnded = new Date() > new Date(year + 1, 5, 30, 23, 59, 59);
  const applicableLocalities = localityId ? localities.filter(l => l.id === localityId) : localities;
  const approvedCount = applicableLocalities.filter(l => Boolean(approvals[l.id])).length;
  const allApproved = applicableLocalities.length > 0 && approvedCount === applicableLocalities.length;
  const reportStatus = allApproved ? 'Finalizat și aprobat' : !schoolYearEnded ? 'În desfășurare' : openMeetings.length > 0 ? 'De verificat: întâlniri neînchise' : 'Pregătit pentru verificare finală';
  const approve = useCallback(() => {
    if (loadingRights || !rights.can_edit || !schoolYearEnded || openMeetings.length > 0 || approving) return;
    const pending = applicableLocalities.filter(l => !approvals[l.id]);
    if (!pending.length) return;
    Alert.alert('Aprobă raportul anual', `Confirmi finalizarea raportului pentru ${pending.length} localități?`, [
      { text: 'Renunță', style: 'cancel' },
      { text: 'Aprobă', onPress: async () => {
        setApproving(true);
        try {
          for (const loc of pending) {
            const { error: e } = await supabase.rpc('school_annual_approve', { p_start_year: year, p_locality_id: loc.id });
            if (e) throw new Error(`${loc.name}: ${e.message}`);
          }
          await load();
          Alert.alert('Raport aprobat', 'Aprobarea a fost salvată în Supabase.');
        } catch (e: any) { Alert.alert('Nu s-a putut aproba', e?.message ?? 'Eroare necunoscută'); await load(); }
        finally { setApproving(false); }
      } }
    ]);
  }, [schoolYearEnded, openMeetings.length, approving, applicableLocalities, approvals, year, load, loadingRights, rights.can_edit]);
  const exportPdf = useCallback(async () => {
    if (!report || exporting || loading) return;
    setExporting(true);
    try {
      // Reîncarcă înainte de export pentru a evita folosirea unor statistici vechi.
      const { data, error: rpcError } = await supabase.rpc('school_annual_report', { p_start_year: year, p_locality_id: localityId });
      if (rpcError) throw rpcError;
      const fresh = data as Report;
      const { data: approvalData, error: approvalError } = await supabase.rpc('school_annual_approval_status', { p_start_year: year });
      if (approvalError) throw approvalError;
      const approvedIds = new Set(((approvalData ?? []) as {locality_id:string}[]).map(x=>x.locality_id));
      const included = localityId ? localities.filter(l=>l.id===localityId) : localities;
      const isApproved = included.length>0 && included.every(l=>approvedIds.has(l.id));
      const localityName = localityId ? (localities.find(l=>l.id===localityId)?.name ?? 'Localitate') : 'Întregul departament';
      await exportSchoolAnnualPdf(fresh, year, localityName, isApproved);
    } catch (e: any) { Alert.alert('Export PDF indisponibil', e?.message ?? 'Nu s-a putut genera raportul.'); }
    finally { setExporting(false); }
  }, [report, exporting, loading, year, localityId, localities]);
  const totals = report?.totals;
  const rate = useMemo(() => {
    if (!totals) return 0;
    const total = totals.children_present + totals.children_absent + totals.children_uncertain;
    return total ? Math.round(totals.children_present * 100 / total) : 0;
  }, [totals]);
  const stat = (label: string, value: number | string) => <View style={s.statBox}><Text style={s.statValue}>{value}</Text><Text style={s.muted}>{label}</Text></View>;
  const group = (title: string, rows: ChildRow[], color: string) => <View style={s.group}>
    <Text style={[s.groupHeading, { color }]}>{title} ({rows.length})</Text>
    {rows.map(c => <View key={c.child_id} style={s.detailRow}><Text style={s.itemText}>{c.name}</Text>{c.status === 'uncertain' && <Text style={s.muted}>Motiv: {c.reason || 'Nespecificat'}</Text>}</View>)}
    {rows.length === 0 && <Text style={s.muted}>Niciun copil</Text>}
  </View>;
  return <SafeAreaView style={s.root} edges={['top']}>
    <View style={s.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={DARK}/></TouchableOpacity><View style={{ marginLeft: 12, flex: 1 }}><Text style={s.eyebrow}>ȘCOALA CREȘTINĂ</Text><Text style={s.heading}>Rapoarte anuale</Text></View></View>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.intro}>Analizează activitatea Școlii Creștine pe ani școlari și localități. Consultă prezențele, echipa și întâlnirile, apoi exportă raportul în PDF.</Text>
      <View style={s.filterCard}><Text style={s.filterTitle}>Perioada raportului</Text><Text style={s.label}>An școlar</Text>
      <View style={s.pickerRow}><TouchableOpacity style={s.arrow} onPress={() => setYear(v => Math.max(2000,v-1))}><Ionicons name="chevron-back" size={20} color={RED}/></TouchableOpacity><Text style={s.year}>{year}–{year+1}</Text><TouchableOpacity style={s.arrow} onPress={() => setYear(v => Math.min(2100,v+1))}><Ionicons name="chevron-forward" size={20} color={RED}/></TouchableOpacity></View>
      <Text style={s.muted}>01-10-{year} – 30-06-{year+1}</Text>
      <Text style={s.label}>Localitate</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 7 }}>
        <TouchableOpacity style={[s.chip,!localityId && s.chipSelected]} onPress={() => {setLocalityId(null);setExpanded(null);}}><Text style={[s.chipText,!localityId && s.chipSelectedText]}>Toate localitățile</Text></TouchableOpacity>
        {localities.map(l => <TouchableOpacity key={l.id} style={[s.chip,localityId===l.id && s.chipSelected]} onPress={() => {setLocalityId(l.id);setExpanded(null);}}><Text style={[s.chipText,localityId===l.id && s.chipSelectedText]}>{l.name}</Text></TouchableOpacity>)}
      </ScrollView>
      </View>
      {loading ? <ActivityIndicator color={RED} style={{ marginTop: 28 }}/> : error ? <View style={s.card}><Text style={{ color: RED }}>{error}</Text><TouchableOpacity onPress={() => void load()}><Text style={s.link}>Reîncearcă</Text></TouchableOpacity></View> : report && totals ? <>
        <View style={s.card}><View style={s.statusTop}><View style={{flex:1}}><Text style={s.cardEyebrow}>STADIUL RAPORTULUI</Text><Text style={s.statusTitle}>{reportStatus}</Text></View><Ionicons name={allApproved ? 'checkmark-circle-outline' : 'document-text-outline'} size={26} color={allApproved ? GREEN : RED}/></View>
        <View style={s.statusDivider}/><View style={s.statusMetrics}><View style={s.statusMetric}><Text style={s.metricNumber}>{closedMeetings.length}</Text><Text style={s.muted}>Întâlniri închise</Text></View><View style={s.statusMetric}><Text style={s.metricNumber}>{openMeetings.length}</Text><Text style={s.muted}>Neînchise</Text></View><View style={s.statusMetric}><Text style={s.metricNumber}>{approvedCount}/{applicableLocalities.length}</Text><Text style={s.muted}>Aprobări</Text></View></View>
        <Text style={s.helper}>Nu există un număr obligatoriu de întâlniri. Vacanțele și pauzele nu sunt considerate întâlniri lipsă.</Text>
        {rights.can_edit && !loadingRights && schoolYearEnded && openMeetings.length === 0 && !allApproved && applicableLocalities.length > 0 && <TouchableOpacity style={s.approveButton} disabled={approving} onPress={approve}><Text style={s.approveText}>{approving ? 'Se salvează...' : localityId ? 'Aprobă raportul localității' : 'Aprobă rapoartele tuturor localităților'}</Text></TouchableOpacity>}
        {allApproved && <Text style={{color:GREEN,fontWeight:'800',marginTop:10}}>✓ Aprobare salvată în Supabase</Text>}
        </View>
        <TouchableOpacity style={s.pdfButton} disabled={exporting} onPress={() => void exportPdf()}>
          <Ionicons name="document-text-outline" size={20} color="#FFF" />
          <Text style={s.pdfText}>{exporting ? 'Se generează PDF-ul...' : localityId ? 'Exportă PDF pentru localitate' : 'Exportă PDF pentru întregul departament'}</Text>
        </TouchableOpacity>
        <Text style={s.section}>Prezența copiilor</Text><Text style={s.sectionHint}>Date centralizate din evidențele întâlnirilor selectate</Text>
        <View style={s.statsGrid}>{stat('Copii înregistrați*',totals.registered_children)}{stat('Întâlniri organizate',totals.meetings)}{stat('Prezențe copii',totals.children_present)}{stat('Rata prezenței**',`${rate}%`)}{stat('Absențe copii',totals.children_absent)}{stat('De clarificat (?)',totals.children_uncertain)}</View>
        <Text style={s.muted}>* Totalul copiilor înregistrați în localitățile selectate, inclusiv cei inactivi. ** Din marcajele Prezent / Absent / ?; nu reprezintă procentul din toți copiii înregistrați.</Text>
        <Text style={s.section}>Participarea echipei</Text><Text style={s.sectionHint}>Prezența efectivă înregistrată, nu doar confirmările de participare</Text>
        <View style={s.statsGrid}>{stat('Membri unici prezenți',totals.unique_staff_participants)}{stat('Participări înregistrate',totals.staff_present)}{stat('Absențe echipă',totals.staff_absent)}{stat('Întâlniri închise',totals.closed_meetings)}</View>
        <View style={[s.card, s.staffCard]}><Text style={s.cardTitle}>Participări pe persoană</Text>{report.staff.length===0 ? <Text style={s.muted}>Nu există înregistrări pentru echipă.</Text> : report.staff.map(x => <View key={x.user_id} style={s.staffSummary}><Text style={s.itemText}>{x.full_name}</Text><Text style={s.muted}>{x.present} prezențe · {x.absent} absențe{x.unmarked ? ` · ${x.unmarked} nemarcate` : ''}</Text></View>)}</View>
        <Text style={s.section}>Istoricul întâlnirilor</Text><Text style={s.sectionHint}>Apasă pe o întâlnire pentru prezențele nominale ale copiilor și echipei</Text>
        {report.meetings.length===0 && <Text style={s.muted}>Nu există întâlniri în acest an școlar.</Text>}
        <View style={{ paddingBottom: 8 }}>
        {report.meetings.map(m => {
          const open = expanded === m.id;
          const present = m.children.filter(c => c.status==='present');
          const absent = m.children.filter(c => c.status==='absent');
          const uncertain = m.children.filter(c => c.status==='uncertain');
          return <View key={m.id} style={s.card}>
            <TouchableOpacity onPress={() => setExpanded(open ? null : m.id)} style={s.meetingHead}><View style={{ flex: 1 }}><Text style={s.cardTitle}>{m.title || 'Întâlnire'}</Text><Text style={s.muted}>{dateRO(m.meeting_date)} · {m.locality_name}</Text><View style={s.meetingMeta}><Text style={[s.meetingBadge, m.closed_at ? s.closedBadge : s.openBadge]}>{m.closed_at ? 'Închisă' : 'Deschisă'}</Text><Text style={s.muted}>{m.children.length} marcaje copii · {m.staff.length} membri echipă</Text></View><Text style={s.muted}>Copii: {present.length} prezenți · {absent.length} absenți · {uncertain.length} de clarificat</Text></View><Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={RED}/></TouchableOpacity>
            {open && <View style={s.details}>
              <Text style={s.detailSection}>Prezența copiilor</Text>{group('Prezenți',present,GREEN)}{group('Absenți',absent,RED)}{group('De clarificat (?)',uncertain,'#946200')}
              <Text style={s.detailSection}>Prezența echipei ({m.staff.length})</Text>
              {m.staff.map(x => <View key={x.user_id} style={s.detailRow}><Text style={s.itemText}>{x.name}</Text><Text style={[s.muted,{color:x.is_present===true ? GREEN : x.is_present===false ? RED : '#946200'}]}>{x.is_present===true ? 'Prezent' : x.is_present===false ? 'Absent' : 'Nemarcat'}</Text></View>)}
              {m.staff.length===0 && <Text style={s.muted}>Nu există membri înregistrați pentru întâlnire.</Text>}
            </View>}
          </View>;
        })}
        </View>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  intro:{fontSize:13,color:'#666',lineHeight:20,marginBottom:14},filterCard:{backgroundColor:'#FFF',borderRadius:18,padding:15,marginBottom:14,borderWidth:1,borderColor:'#EDEDED'},filterTitle:{fontSize:16,fontWeight:'900',color:DARK},cardEyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.1,color:RED},statusTop:{flexDirection:'row',alignItems:'center',gap:10},statusTitle:{fontSize:17,fontWeight:'900',color:DARK,marginTop:5},statusDivider:{height:1,backgroundColor:'#EFEFEF',marginVertical:13},statusMetrics:{flexDirection:'row',gap:8},statusMetric:{flex:1,alignItems:'center'},metricNumber:{fontSize:19,fontWeight:'900',color:DARK},helper:{fontSize:12,color:'#777',lineHeight:18,marginTop:13},sectionHint:{fontSize:12,color:'#777',marginTop:-8,marginBottom:12,lineHeight:18},meetingMeta:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap',marginTop:7,marginBottom:4},meetingBadge:{fontSize:11,fontWeight:'800',overflow:'hidden',paddingHorizontal:9,paddingVertical:4,borderRadius:10},closedBadge:{color:GREEN,backgroundColor:'#EAF7F0'},openBadge:{color:'#946200',backgroundColor:'#FFF6DF'},detailSection:{fontSize:14,fontWeight:'900',color:DARK,marginTop:10,marginBottom:9},
  pdfButton:{backgroundColor:RED,borderRadius:12,padding:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12},pdfText:{color:'#FFF',fontWeight:'800',flexShrink:1},
  approveButton:{backgroundColor:GREEN,borderRadius:12,padding:14,alignItems:'center',marginTop:14},approveText:{color:'#FFF',fontWeight:'800'},
  root:{flex:1,backgroundColor:'#F6F6F6'},header:{
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),flexDirection:'row',alignItems:'center',padding:18,backgroundColor:'#FFF'},eyebrow:{color:RED,fontSize:10,fontWeight:'800'},heading:{color:DARK,fontSize:23,fontWeight:'900'},content:{ ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),padding:17,paddingBottom:55},label:{fontWeight:'800',color:DARK,marginTop:11,marginBottom:6},pickerRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderRadius:14,padding:10},arrow:{padding:9},year:{fontSize:18,fontWeight:'900',color:DARK},muted:{fontSize:12,color:'#777',marginTop:3,lineHeight:17},chip:{borderRadius:20,borderWidth:1,borderColor:'#DDD',backgroundColor:'#FFF',paddingHorizontal:14,paddingVertical:10,marginRight:8},chipSelected:{backgroundColor:RED,borderColor:RED},chipText:{fontSize:12,fontWeight:'700',color:DARK},chipSelectedText:{color:'#FFF'},section:{fontSize:18,fontWeight:'900',color:DARK,marginTop:12,marginBottom:12},statsGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},statBox:{width:'48%',flexGrow:1,backgroundColor:'#FFF',borderRadius:14,padding:12},statValue:{fontSize:23,fontWeight:'900',color:DARK},card:{backgroundColor:'#FFF',borderRadius:15,padding:13,marginBottom:12},cardTitle:{fontSize:14,fontWeight:'900',color:DARK},staffCard:{marginTop:12,marginBottom:0},staffSummary:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#EEE'},itemText:{fontSize:13,fontWeight:'700',color:DARK},meetingHead:{flexDirection:'row',alignItems:'center',gap:10},details:{marginTop:10,borderTopWidth:1,borderTopColor:'#EEE',paddingTop:10},group:{marginBottom:10},groupHeading:{fontWeight:'900',fontSize:14,color:DARK,marginBottom:7},detailRow:{paddingVertical:6,borderBottomWidth:1,borderBottomColor:'#F5F5F5'},link:{color:RED,fontWeight:'800',marginTop:12}
});

export default function ProtectedRaportAnualSchool() {
  return <SchoolAdminGate permission="can_view"><RaportAnualSchool /></SchoolAdminGate>;
}
