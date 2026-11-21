import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const GREEN = '#198754';
const DARK = '#171717';
type Status = 'present' | 'absent' | 'uncertain';
type Entry = { status: Status; reason: string | null };
type Meeting = { id: string; locality_id: string; meeting_date: string; meeting_time?: string | null; title: string | null; created_at: string; closed_at: string | null; first_closed_at?: string | null };
type Child = { id: string; first_name: string; last_name: string };
type Staff = { user_id: string; full_name: string; is_present: boolean | null };
type Candidate = { user_id: string; full_name: string; is_coordinator: boolean; is_local: boolean; other_localities: string[] };
// Calculează momentul întâlnirii în Europe/Bucharest, inclusiv ora de vară.
const canRequestWithdrawal = (date: string, time: string | null | undefined): boolean => {
  if (!date || !time) return false;
  try {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    if (![year, month, day, hour, minute].every(Number.isFinite)) return false;
    const wallTime = Date.UTC(year, month - 1, day, hour, minute);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    let utcTime = wallTime - 2 * 60 * 60 * 1000;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(utcTime)).map(x => [x.type, x.value]));
      const shown = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
      utcTime += wallTime - shown;
    }
    return utcTime - Date.now() >= 72 * 60 * 60 * 1000;
  } catch { return false; }
};

type PlannedStaff = { user_id: string; name: string; is_coordinator: boolean; response: 'confirmed' | 'declined' | null; removed_at?: string | null; withdrawal_requested_at?: string | null; withdrawal_reason?: string | null };
type ActivityRow = { user_id: string; activity: string; chosen_by_self: boolean; notes?: string; material_url?: string | null };
type VolunteerSearchResult = { user_id: string; full_name: string; nickname: string | null; email: string | null; avatar_url: string | null; is_local: boolean };
type GuestInvite = { id: string; user_id: string; full_name: string; status: 'pending_approval' | 'approved' | 'rejected' | 'cancelled'; proposed_at: string; reviewed_at: string | null; review_reason: string | null };
type ChangeRequest = { id: string; user_id: string; old_activity: string; new_activity: string; status: string };
const ACTIVITIES = ['Lecția Biblică', 'Lecția Misionară', 'Verset', 'Cântare', 'Lucru Manual/Activitate', 'Joc Recapitulativ'];

const todayDisplay = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};
const displayDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
};
const databaseDate = (value: string): string | null => {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const year = Number(yyyy), month = Number(mm), day = Number(dd);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() + 1 !== month || d.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
};
const formatMeetingTime = (value?: string | null) => {
  const match = /^(\d{2}):(\d{2})/.exec(value || '');
  return match ? `${match[1]}:${match[2]}` : 'Ora nestabilită';
};
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
const mayShowGuests = (manage: boolean, create: boolean) => manage || create;
const statusLabel = (entry?: Entry) =>
  !entry ? 'Nemarcat' : entry.status === 'present' ? 'Prezent' : entry.status === 'absent' ? 'Absent' : '? De clarificat';

export default function PrezentaScreen() {
  const { localityId, meetingId, view } = useLocalSearchParams<{ localityId: string; meetingId?: string; view?: 'instructor' | 'coordinator' }>();
  const instructorView = view === 'instructor';
  const openedNotificationMeeting = useRef<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [childDelegateId, setChildDelegateId] = useState<string | null>(null);
  const [canEditChildren, setCanEditChildren] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chosenInstructors, setChosenInstructors] = useState<string[]>([]);
  const [plannedStaff, setPlannedStaff] = useState<PlannedStaff[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState('');
  const [newMeetingTime, setNewMeetingTime] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
  const [materialNotes, setMaterialNotes] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const [canMarkStaff, setCanMarkStaff] = useState(false);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [attendance, setAttendance] = useState<Record<string, Entry>>({});
  const [date, setDate] = useState(todayDisplay);
  const [title, setTitle] = useState('');
  const [meetingNote, setMeetingNote] = useState('');
  const [detailNote, setDetailNote] = useState('');
  const [editingMeetingNote, setEditingMeetingNote] = useState(false);
  const [editedMeetingNote, setEditedMeetingNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'create'|'reschedule'>('create');
  const [draftPickerDate, setDraftPickerDate] = useState(new Date());
  const openPicker = (mode: 'date' | 'time', target: 'create'|'reschedule'='create') => {
    setPickerTarget(target);
    const sql = databaseDate(target==='create'?date:newMeetingDate);
    const base = sql ? new Date(`${sql}T12:00:00`) : new Date();
    const currentTime=target==='create'?meetingTime:newMeetingTime;
    if (mode === 'time' && validTime(currentTime)) {
      const [hours, minutes] = currentTime.split(':').map(Number);
      base.setHours(hours, minutes, 0, 0);
    }
    setDraftPickerDate(base);
    setPicker(mode);
  };
  const savePicker = (mode: 'date' | 'time', chosen: Date) => {
    if (mode === 'date') {
      const day = String(chosen.getDate()).padStart(2, '0');
      const month = String(chosen.getMonth() + 1).padStart(2, '0');
      const year = chosen.getFullYear();
      if(pickerTarget==='create') setDate(`${day}-${month}-${year}`); else setNewMeetingDate(`${day}-${month}-${year}`);
    } else {
      const hours = String(chosen.getHours()).padStart(2, '0');
      const minutes = String(chosen.getMinutes()).padStart(2, '0');
      if(pickerTarget==='create') setMeetingTime(`${hours}:${minutes}`); else setNewMeetingTime(`${hours}:${minutes}`);
    }
  };
  const [error, setError] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [guestOnly, setGuestOnly] = useState(false);
  const [reasonChildId, setReasonChildId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [teamReason, setTeamReason] = useState('');
  const [withdrawalReviewBusy, setWithdrawalReviewBusy] = useState<string | null>(null);
  const [guestInvites, setGuestInvites] = useState<GuestInvite[]>([]);
  const [guestUserId, setGuestUserId] = useState('');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [globalResults, setGlobalResults] = useState<VolunteerSearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedVolunteer, setSelectedVolunteer] = useState<VolunteerSearchResult | null>(null);
  const [teamAvatars, setTeamAvatars] = useState<Record<string, string | null>>({});
  const [candidateProfiles, setCandidateProfiles] = useState<Record<string, { nickname: string | null; avatar_url: string | null }>>({});
  const [activeSection, setActiveSection] = useState<'echipa'|'activitati'|'prezenta'|'detalii'>('echipa');
  const [staffUncertain, setStaffUncertain] = useState<Record<string,string>>({});
  const [guestReviewReason, setGuestReviewReason] = useState<Record<string,string>>({});
  const [canReviewGuests, setCanReviewGuests] = useState(false);
  const [teamAction, setTeamAction] = useState<{userId:string; type:'remove'|'withdraw'}|null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (!localityId) throw new Error('Localitate invalidă.');
      const [m, permission, rosterPermission] = await Promise.all([
        supabase.rpc('school_attendance_list_meetings_with_time', { p_locality_id: localityId }),
        supabase.rpc('school_attendance_can_create', { p_locality_id: localityId }),
        supabase.rpc('school_planning_is_coordinator', { p_locality: localityId }),
      ]);
      if (permission.error) throw permission.error;
      if (rosterPermission.error) throw rosterPermission.error;
      const { data: authData } = await supabase.auth.getUser();
      setMyId(authData.user?.id ?? null);
      // Invitații pot vedea doar întâlnirile lor, fără acces la copii.
      const personal = await supabase.rpc('school_planning_my_meetings_with_time');
      if (personal.error) throw personal.error;
      const ownMeetings = ((personal.data ?? []) as Meeting[]).filter(x => x.locality_id === localityId);
      if (m.error && ownMeetings.length === 0) throw m.error;
      const isGuest = instructorView || !!m.error;
      setGuestOnly(isGuest);
      const allMeetings = isGuest ? ownMeetings : (m.data ?? []) as Meeting[];
      setMeetings(allMeetings);
      const canEditAttendance = permission.data === true && !isGuest;
      setCanCreate(canEditAttendance);
      setCanReviewGuests(canEditAttendance);
      const candidatesResult = await supabase.rpc('school_planning_all_candidates', { p_locality_id: localityId });
      const mayManage = !isGuest && rosterPermission.data === true && !candidatesResult.error;
      setCanManageMembers(mayManage);
      const allowedCandidates = mayManage ? ((candidatesResult.data ?? []) as Candidate[]) : [];
      setCandidates(allowedCandidates);
      if (allowedCandidates.length) {
        // Citește numai profilurile vizibile prin politicile RLS existente.
        const profileResult = await supabase.from('volunteer_profiles')
          .select('user_id,nickname,avatar_url')
          .in('user_id', allowedCandidates.map(c => c.user_id));
        if (!profileResult.error) {
          const map: Record<string, { nickname: string | null; avatar_url: string | null }> = {};
          for (const profile of profileResult.data ?? []) map[profile.user_id] = { nickname: profile.nickname, avatar_url: profile.avatar_url };
          setCandidateProfiles(map);
        }
      }
      // Copiii se încarcă numai în contextul întâlnirii, după verificarea delegării pe server.
      setChildren([]);
    } catch (e: any) { setError(e?.message ?? 'Nu am putut încărca prezența.'); }
    finally { setLoading(false); }
  }, [localityId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const openMeeting = async (meeting: Meeting) => {
    setBusy(true);
    setReasonChildId(null);
    try {
      let fresh = meeting;
      // RPC-ul securizat întoarce copiii doar coordonatorului sau delegatului confirmat.
      const context = await supabase.rpc('misibi_meeting_child_attendance_context', { p_meeting_id: meeting.id });
      if (context.error) throw context.error;
      const ctx = context.data ?? {};
      setChildren((ctx.children ?? []) as Child[]);
      setChildDelegateId(ctx.delegate_user_id ?? null);
      setCanEditChildren(ctx.can_edit === true);
      const values: Record<string, Entry> = {};
      for (const item of (ctx.attendance ?? []) as { child_id: string; status: Status; reason: string | null }[]) {
        values[item.child_id] = { status: item.status, reason: item.reason };
      }
      setAttendance(values);
      if (!guestOnly) {
        const updated = await supabase.rpc('school_attendance_list_meetings_with_time', { p_locality_id: localityId });
        if (updated.error) throw updated.error;
        const list = (updated.data ?? []) as Meeting[];
        setMeetings(list);
        fresh = list.find(m => m.id === meeting.id) ?? meeting;
      }
      const { data: statusData, error: statusError } = await supabase.rpc('school_planning_status', { p_meeting_id: meeting.id });
      if (statusError) throw statusError;
      setCancelled(!!statusData?.[0]?.cancelled_at);
      setNewMeetingDate(displayDate(fresh.meeting_date));
      setNewMeetingTime((fresh.meeting_time || '').slice(0,5));
      setEditingMaterial(null);
      // Coordonatorii/administratorii văd lista echipei; numai coordonatorii marchează.
      const { data: assigned, error: assignedError } = guestOnly ? { data: [], error: null } : await supabase.rpc('school_staff_attendance_list', { p_meeting_id: meeting.id });
      if (assignedError && canCreate) throw assignedError;
      setStaff((assigned ?? []) as Staff[]);
      if (!guestOnly) {
        const uncertainResult = await supabase.rpc('misibi_staff_uncertain_list', { p_meeting_id: meeting.id });
        if (uncertainResult.error) throw uncertainResult.error;
        const uncertainMap: Record<string,string> = {};
        for (const row of uncertainResult.data ?? []) uncertainMap[row.user_id] = row.reason || '';
        setStaffUncertain(uncertainMap);
      } else setStaffUncertain({});
      const { data: ownRole, error: ownRoleError } = guestOnly ? { data: false, error: null } : await supabase.rpc('school_staff_attendance_is_coordinator', { p_locality_id: localityId });
      if (ownRoleError && canCreate) throw ownRoleError;
      setCanMarkStaff(ownRole === true);
      const { data: plan, error: planError } = await supabase.rpc('school_planning_details', { p_meeting_id: meeting.id });
      if (planError) throw planError;
      setPlannedStaff((plan?.staff ?? []) as PlannedStaff[]);
      const teamIds = ((plan?.staff ?? []) as PlannedStaff[]).map(p => p.user_id);
      if (teamIds.length) {
        const profiles = await supabase.from('volunteer_profiles').select('user_id,avatar_url').in('user_id', teamIds);
        if (!profiles.error) {
          const avatars: Record<string, string | null> = {};
          for (const profile of profiles.data ?? []) avatars[profile.user_id] = profile.avatar_url;
          setTeamAvatars(avatars);
        } else setTeamAvatars({});
      } else setTeamAvatars({});
      setActivities((plan?.activities ?? []) as ActivityRow[]);
      setRequests((plan?.requests ?? []) as ChangeRequest[]);
      const { data: savedNote, error: noteError } = await supabase.rpc('school_meeting_get_note', { p_meeting_id: meeting.id });
      if (noteError) throw noteError;
      setDetailNote(typeof savedNote === 'string' ? savedNote : '');
      setEditedMeetingNote(typeof savedNote === 'string' ? savedNote : '');
      setEditingMeetingNote(false);
      setSelected(fresh);
      setActiveSection(instructorView ? 'detalii' : 'echipa');
      setCandidateSearch(''); setSelectedVolunteer(null);
      if (!guestOnly && mayShowGuests(canManageMembers, canCreate)) {
        try { await reloadGuestInvites(meeting.id); } catch { setGuestInvites([]); }
      } else { setGuestInvites([]); }
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut deschide întâlnirea.'); }
    finally { setBusy(false); }
  };

  // Deschide automat întâlnirea când utilizatorul vine din Notificări private.
  useEffect(() => {
    if (!meetingId || loading || selected || openedNotificationMeeting.current === meetingId) return;
    const match = meetings.find(item => item.id === meetingId);
    if (!match) return;
    openedNotificationMeeting.current = meetingId;
    void openMeeting(match);
  }, [meetingId, loading, meetings, selected]);

  const saveMeetingNote = async () => {
    if (!selected || busy || !canCreate || cancelled || selected.closed_at || selected.first_closed_at) return;
    if (editedMeetingNote.length > 2000) {
      Alert.alert('Notă prea lungă', 'Maximum 2.000 de caractere.');
      return;
    }
    setBusy(true);
    try {
      const nextNote = editedMeetingNote.trim();
      const { error: rpcError } = await supabase.rpc('school_meeting_update_note', {
        p_meeting_id: selected.id, p_note: nextNote || null,
      });
      if (rpcError) throw rpcError;
      setDetailNote(nextNote);
      setEditingMeetingNote(false);
    } catch (e: any) {
      Alert.alert('Eroare', e?.message ?? 'Nota nu a putut fi salvată.');
    } finally { setBusy(false); }
  };

  const createMeeting = async () => {
    if (!canManageMembers || instructorView) return;
    const sqlDate = databaseDate(date);
    if (!sqlDate) { Alert.alert('Dată invalidă', 'Introdu data în format ZZ-LL-AAAA.'); return; }
    if (!validTime(meetingTime)) { Alert.alert('Oră invalidă', 'Introdu ora în format HH:MM (00:00–23:59).'); return; }
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('school_planning_create_meeting', {
        p_locality_id: localityId, p_meeting_date: sqlDate, p_title: title.trim() || null,
        p_instructors: chosenInstructors, p_meeting_time: meetingTime.trim(),
        p_note: meetingNote.trim() || null,
      });
      if (rpcError) throw rpcError;
      const { data: updated, error: listError } = await supabase.rpc('school_attendance_list_meetings_with_time', {
        p_locality_id: localityId,
      });
      if (listError) throw listError;
      setMeetings((updated ?? []) as Meeting[]);
      setTitle(''); setMeetingTime(''); setMeetingNote(''); setChosenInstructors([]); setShowCreateForm(false);
      // Rămâne pe lista întâlnirilor; coordonatorul poate deschide întâlnirea manual.
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut crea întâlnirea.'); }
    finally { setBusy(false); }
  };

  const mark = async (childId: string, status: Status, newReason: string | null = null) => {
    if (!selected || busy || selected.closed_at || selected.first_closed_at || !canEditChildren) return;
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('school_attendance_save_status', {
        p_meeting_id: selected.id, p_child_id: childId,
        p_status: status, p_reason: status === 'uncertain' ? newReason : null,
      });
      if (rpcError) throw rpcError;
      setAttendance(prev => ({ ...prev, [childId]: { status, reason: status === 'uncertain' ? (newReason?.trim() || null) : null } }));
      setReasonChildId(null); setReason('');
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut salva prezența.'); }
    finally { setBusy(false); }
  };

  const markStaff = async (userId: string, present: boolean) => {
    if (!selected || busy || selected.closed_at || !canMarkStaff || !plannedStaff.some(p => p.user_id === userId && !p.removed_at && p.response === 'confirmed')) return;
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('school_staff_attendance_save', {
        p_meeting_id: selected.id, p_user_id: userId, p_is_present: present,
      });
      if (rpcError) throw rpcError;
      setStaff(prev => prev.map(person => person.user_id === userId ? { ...person, is_present: present } : person));
      setStaffUncertain(prev => { const next = {...prev}; delete next[userId]; return next; });
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut salva prezența echipei.'); }
    finally { setBusy(false); }
  };

  const markStaffUncertain = async (userId: string) => {
    if (!selected || busy || selected.closed_at || !canMarkStaff || !plannedStaff.some(p => p.user_id === userId && !p.removed_at && p.response === 'confirmed')) return;
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('misibi_staff_uncertain_save', {
        p_meeting_id: selected.id, p_user_id: userId, p_reason: 'De clarificat',
      });
      if (rpcError) throw rpcError;
      setStaff(prev => prev.map(p => p.user_id === userId ? {...p, is_present: null} : p));
      setStaffUncertain(prev => ({...prev, [userId]: 'De clarificat'}));
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut marca statusul.'); }
    finally { setBusy(false); }
  };

  const reloadPlan = async (meetingId: string) => {
    const { data, error: rpcError } = await supabase.rpc('school_planning_details', { p_meeting_id: meetingId });
    if (rpcError) throw rpcError;
    setPlannedStaff((data?.staff ?? []) as PlannedStaff[]);
    setActivities((data?.activities ?? []) as ActivityRow[]);
    setRequests((data?.requests ?? []) as ChangeRequest[]);
  };
  const chooseActivity = async (activity: string) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('school_planning_choose', { p_meeting_id: selected.id, p_activity: activity });
      if (rpcError) throw rpcError;
      await reloadPlan(selected.id);
      Alert.alert(data === 'pending' ? 'Cerere trimisă' : 'Salvat', data === 'pending' ? 'Coordonatorul va decide dacă aprobă schimbarea.' : 'Activitatea a fost salvată.');
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut salva.'); }
    finally { setBusy(false); }
  };
  const requestExtra = async (activity: string) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('school_planning_request_extra', { p_meeting_id: selected.id, p_activity: activity });
      if (rpcError) throw rpcError;
      await reloadPlan(selected.id);
      Alert.alert('Cerere trimisă', 'Coordonatorul trebuie să aprobe activitatea suplimentară.');
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut trimite cererea.'); }
    finally { setBusy(false); }
  };
  const assignActivity = async (userId: string, activity: string, add: boolean) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('school_planning_assign', { p_meeting_id: selected.id, p_user_id: userId, p_activity: activity, p_add: add });
      if (rpcError) throw rpcError;
      await reloadPlan(selected.id);
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut modifica activitatea.'); }
    finally { setBusy(false); }
  };
  const reviewRequest = async (id: string, approve: boolean) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc('school_planning_review', { p_request_id: id, p_approve: approve });
      if (rpcError) throw rpcError;
      await reloadPlan(selected.id);
    } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Nu s-a putut procesa cererea.'); }
    finally { setBusy(false); }
  };
  const updatePlan = async (fn: () => Promise<{error: any}>, success?: string) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const {error: e} = await fn();
      if (e) throw e;
      await reloadPlan(selected.id);
      if (success) Alert.alert('Salvat',success);
    } catch(e:any) { Alert.alert('Eroare',e?.message || 'Operațiunea nu a reușit.'); }
    finally {setBusy(false);}
  };
  const respond = (confirm: boolean) => {
    if (!selected) return;
    void updatePlan(async () => await supabase.rpc('school_planning_respond',{p_meeting_id:selected.id,p_confirm:confirm}),confirm?'Participarea a fost confirmată.':'Coordonatorul a fost informat că nu poți participa.');
  };
  const reloadGuestInvites = async (meetingId: string) => {
    const result = await supabase.rpc('school_meeting_list_guest_invitations', { p_meeting_id: meetingId });
    if (result.error) throw result.error;
    setGuestInvites((result.data ?? []) as GuestInvite[]);
  };
  const proposeGuest = async (userId?: string) => {
    if (!selected || busy) return;
    const id = (userId || guestUserId).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      Alert.alert('Identificator invalid', 'Introdu ID-ul UUID al contului voluntarului.'); return;
    }
    setBusy(true);
    try {
      const r = await supabase.rpc('school_meeting_propose_guest', { p_meeting_id: selected.id, p_user_id: id });
      if (r.error) throw r.error;
      setGuestUserId('');
      await reloadGuestInvites(selected.id);
      Alert.alert('Invitație trimisă', 'Voluntarul a primit invitația și poate confirma sau refuza participarea.');
    } catch (e: any) { Alert.alert('Eroare', e?.message || 'Nu s-a putut trimite propunerea.'); }
    finally { setBusy(false); }
  };
  const reviewGuest = async (invitation: GuestInvite, approve: boolean) => {
    if (!selected || busy) return;
    const reasonText = (guestReviewReason[invitation.id] || '').trim();
    if (!approve && reasonText.length < 3) { Alert.alert('Motiv obligatoriu', 'Scrie motivul respingerii (minimum 3 caractere).'); return; }
    setBusy(true);
    try {
      const r = await supabase.rpc('school_meeting_review_guest', { p_invitation_id: invitation.id, p_approve: approve, p_reason: reasonText || null });
      if (r.error) throw r.error;
      await reloadGuestInvites(selected.id);
      await reloadPlan(selected.id);
      Alert.alert('Salvat', approve ? 'Invitația a fost aprobată. Voluntarul trebuie să confirme participarea.' : 'Propunerea a fost respinsă.');
    } catch (e: any) { Alert.alert('Eroare', e?.message || 'Nu s-a putut procesa invitația.'); }
    finally { setBusy(false); }
  };
  const setMember = (userId: string, add: boolean) => {
    if (!selected) return;
    if (!add) { setTeamReason(''); setTeamAction({userId, type:'remove'}); return; }
    Alert.alert('Adaugă instructorul?', 'Instructorul va primi o notificare.', [
      {text:'Anulează',style:'cancel'},
      {text:'Confirmă',onPress:()=>void updatePlan(async()=>{
        const result=await supabase.rpc('school_planning_set_member',{p_meeting_id:selected.id,p_user_id:userId,p_add:true});
        if(!result.error){const x=await supabase.rpc('school_staff_attendance_list',{p_meeting_id:selected.id});if(!x.error)setStaff((x.data??[]) as Staff[]);}
        return result;
      })}
    ]);
  };
  const submitTeamReason = () => {
    if (!selected || !teamAction || busy) return;
    const reasonText=teamReason.trim();
    if (reasonText.length<3 || reasonText.length>500) {
      Alert.alert('Motiv obligatoriu','Introdu un motiv între 3 și 500 de caractere.'); return;
    }
    const {type,userId}=teamAction;
    void updatePlan(async()=>{
      const result=type==='withdraw'
        ? await supabase.rpc('school_meeting_request_withdrawal',{p_meeting_id:selected.id,p_reason:reasonText})
        : await supabase.rpc('school_meeting_remove_member',{p_meeting_id:selected.id,p_user_id:userId,p_reason:reasonText});
      if(!result.error){
        setTeamAction(null); setTeamReason('');
        const x=await supabase.rpc('school_staff_attendance_list',{p_meeting_id:selected.id});
        if(!x.error)setStaff((x.data??[]) as Staff[]);
      }
      return result;
    },type==='withdraw'?(canRequestWithdrawal(selected.meeting_date,selected.meeting_time)?'Te-ai retras din întâlnire.':'Solicitarea de retragere a fost trimisă coordonatorului.'):'Participantul a fost eliminat.');
  };
  const reviewWithdrawal = async (userId: string, approve: boolean) => {
    if (!selected || busy || withdrawalReviewBusy) return;
    setWithdrawalReviewBusy(userId);
    try {
      const {error: rpcError} = await supabase.rpc('school_meeting_review_withdrawal', {
        p_meeting_id: selected.id, p_user_id: userId, p_approve: approve, p_reason: null,
      });
      if (rpcError) throw rpcError;
      await reloadPlan(selected.id);
      const roster = await supabase.rpc('school_staff_attendance_list', {p_meeting_id:selected.id});
      if (!roster.error) setStaff((roster.data ?? []) as Staff[]);
      Alert.alert('Salvat', approve ? 'Retragerea a fost aprobată.' : 'Retragerea a fost respinsă. Instructorul rămâne în echipă.');
    } catch (e:any) { Alert.alert('Eroare',e?.message ?? 'Nu s-a putut procesa solicitarea.'); }
    finally { setWithdrawalReviewBusy(null); }
  };
  const delegateAttendance = (userId: string) => {
    if (!selected) return;
    Alert.alert('Delegi prezența copiilor?', 'Instructorul confirmat va putea marca numai prezența copiilor până la prima închidere.', [
      {text:'Anulează',style:'cancel'},
      {text:'Deleghează',onPress:()=>void updatePlan(async()=>{ const result=await supabase.rpc('school_meeting_delegate_child_attendance',{p_meeting_id:selected.id,p_user_id:userId}); if(!result.error)setChildDelegateId(userId); return result; }, 'Delegarea a fost salvată.')}
    ]);
  };
  const reschedule = () => {
    if(!selected)return;
    const parsed=databaseDate(newMeetingDate);
    if(!parsed){Alert.alert('Dată invalidă','Folosește ZZ-LL-AAAA.');return;}
    if(!validTime(newMeetingTime)){Alert.alert('Oră invalidă','Folosește HH:MM.');return;}
    Alert.alert('Reprogramezi întâlnirea?','Instructorii vor primi notificare și mementourile se vor recalcula.',[
      {text:'Anulează',style:'cancel'},
      {text:'Reprogramează',onPress:async()=>{
        setBusy(true);
        try{
          const r=await supabase.rpc('school_planning_reschedule',{p_meeting_id:selected.id,p_new_date:parsed,p_new_time:newMeetingTime.trim()});if(r.error)throw r.error;
          const x=await supabase.rpc('school_attendance_list_meetings_with_time',{p_locality_id:localityId});if(x.error)throw x.error;
          const list=(x.data??[]) as Meeting[];setMeetings(list);setSelected(list.find(m=>m.id===selected.id)??null);
        }catch(e:any){Alert.alert('Eroare',e?.message||'Reprogramarea a eșuat.');}finally{setBusy(false);}
      }}
    ]);
  };
  const cancelMeeting = () => {
    if(!selected)return;
    Alert.alert('Anulezi întâlnirea?','Instructorii vor fi notificați. Această acțiune nu se poate anula din interfață.',[
      {text:'Renunță',style:'cancel'},
      {text:'Anulează întâlnirea',style:'destructive',onPress:async()=>{
        setBusy(true);
        try{const r=await supabase.rpc('school_planning_cancel',{p_meeting_id:selected.id,p_reason:null});if(r.error)throw r.error;setCancelled(true);}
        catch(e:any){Alert.alert('Eroare',e?.message||'Nu s-a putut anula.');}finally{setBusy(false);}
      }}
    ]);
  };
  const saveMaterial = (activity: string) => {
    if(!selected)return;
    void updatePlan(async ()=>await supabase.rpc('school_planning_save_material',{
      p_meeting_id:selected.id,p_activity:activity,p_notes:materialNotes,p_material_url:materialUrl.trim()||null
    }), 'Materialul a fost salvat.');
    setEditingMaterial(null);
  };
  const unmarkedStaff = staff.filter(person => plannedStaff.some(p => p.user_id === person.user_id && !p.removed_at && p.response === 'confirmed') && person.is_present === null && !Object.prototype.hasOwnProperty.call(staffUncertain, person.user_id));
  const toggleClosed = () => {
    if (!selected || !canCreate || busy || cancelled) return;
    const meeting = selected;
    const closing = !meeting.closed_at;
    if (closing && unmarked.length > 0) {
      Alert.alert('Prezență incompletă', `Mai sunt ${unmarked.length} copii nemarcați. Selectează Prezent, Absent sau ? pentru fiecare copil înainte de închidere.`);
      return;
    }
    if (closing && unmarkedStaff.length > 0) {
      Alert.alert('Echipă incompletă', `Mai sunt ${unmarkedStaff.length} membri ai echipei nemarcați.`);
      return;
    }
    Alert.alert(
      closing ? 'Închide prezența?' : 'Redeschide prezența?',
      closing ? 'Se va afișa sumarul. Prezențele nu vor mai putea fi modificate.' : 'Instructorii vor putea modifica din nou prezența.',
      [{ text: 'Anulează', style: 'cancel' }, { text: closing ? 'Închide' : 'Redeschide', onPress: async () => {
        setBusy(true);
        try {
          const { error: rpcError } = await supabase.rpc('school_attendance_set_closed', {
            p_meeting_id: meeting.id, p_closed: closing,
          });
          if (rpcError) throw rpcError;
          const { data, error: listError } = await supabase.rpc('school_attendance_list_meetings_with_time', { p_locality_id: localityId });
          if (listError) throw listError;
          const list = (data ?? []) as Meeting[];
          setMeetings(list);
          setSelected(list.find(m => m.id === meeting.id) ?? null);
          setReasonChildId(null);
        } catch (e: any) { Alert.alert('Eroare', e?.message ?? 'Operațiunea a eșuat.'); }
        finally { setBusy(false); }
      }}]
    );
  };

  useEffect(() => {
    if (!selected || !canManageMembers || !candidateSearch.trim() || candidateSearch.trim().length < 2) {
      setGlobalResults([]); setSearchError(''); setSearchBusy(false); return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSearchBusy(true); setSearchError('');
      const result = await supabase.rpc('school_meeting_search_volunteers', { p_meeting_id: selected.id, p_query: candidateSearch.trim() });
      if (!active) return;
      if (result.error) { setSearchError(result.error.message); setGlobalResults([]); }
      else setGlobalResults((result.data ?? []) as VolunteerSearchResult[]);
      setSearchBusy(false);
    }, 320);
    return () => { active = false; clearTimeout(timer); };
  }, [selected?.id, canManageMembers, candidateSearch]);
  const matchingCandidates = candidates.filter(c => !plannedStaff.some(p => p.user_id === c.user_id) && (c.full_name + ' ' + (candidateProfiles[c.user_id]?.nickname || '')).toLocaleLowerCase('ro').includes(candidateSearch.trim().toLocaleLowerCase('ro')));
  const byStatus = (status: Status) => children.filter(c => attendance[c.id]?.status === status);
  const present = byStatus('present');
  const absent = byStatus('absent');
  const uncertain = byStatus('uncertain');
  const unmarked = children.filter(c => !attendance[c.id]);
  const markedCount = children.length - unmarked.length;
  const nameOf = (child: Child) => `${child.last_name} ${child.first_name}`;

  const summaryGroup = (heading: string, list: Child[], color: string, showReason = false) => (
    <View style={s.summaryGroup}>
      <Text style={[s.groupTitle, { color }]}>{heading} ({list.length})</Text>
      {list.length === 0 ? <Text style={s.hint}>Niciun copil</Text> : list.map(c => (
        <View key={c.id} style={s.summaryRow}>
          <Text style={s.name}>{nameOf(c)}</Text>
          {showReason && <Text style={s.hint}>Motiv: {attendance[c.id]?.reason || 'Nespecificat'}</Text>}
        </View>
      ))}
    </View>
  );

  return <SafeAreaView style={s.root} edges={['top']}>
    <View style={s.header}>
      <TouchableOpacity onPress={() => selected ? (setSelected(null), setReasonChildId(null)) : (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))} accessibilityLabel="Înapoi">
        <Ionicons name="chevron-back" size={26} color={DARK} />
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.eyebrow}>ȘCOALA CREȘTINĂ</Text>
        <Text style={s.heading}>{selected ? 'Prezența întâlnirii' : 'Prezență'}</Text>
      </View>
    </View>
    {!selected && !showCreateForm && !loading && !error ? <View style={{flex:1, width:'100%', maxWidth:1120, alignSelf:'center', paddingHorizontal:18, paddingTop:16}}>
      {canManageMembers && !instructorView && <TouchableOpacity style={[s.button,{marginBottom:16}]} onPress={()=>setShowCreateForm(true)} accessibilityRole="button"><Ionicons name="add-circle-outline" size={21} color="#FFF"/><Text style={s.buttonText}>Creează întâlnire</Text></TouchableOpacity>}
      <Text style={[s.section,{marginTop:4}]}>Întâlniri</Text>
      <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:36}} keyboardShouldPersistTaps="handled">
        {meetings.map(m=><TouchableOpacity key={m.id} style={s.meetingCard} disabled={busy} onPress={()=>openMeeting(m)}>
          <Ionicons name="calendar-outline" size={23} color={RED}/><View style={{flex:1}}><Text style={s.name}>{m.title || 'Întâlnire'}</Text><Text style={s.hint}>{displayDate(m.meeting_date)} · {formatMeetingTime(m.meeting_time)} · {m.closed_at?'Închisă':'Deschisă'}</Text></View><Ionicons name="chevron-forward" size={20} color="#AAA"/>
        </TouchableOpacity>)}
        {meetings.length===0 && <Text style={s.hint}>Nu există încă întâlniri înregistrate.</Text>}
      </ScrollView>
    </View> : <ScrollView contentContainerStyle={[s.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]} keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator color={RED} /> : error ? <Text style={s.error}>{error}</Text> : selected ? <>
        <View style={s.meetingHero}>
          <Text style={s.meetingHeroEyebrow}>{instructorView ? 'PROGRAMAREA MEA' : 'GESTIONARE ÎNTÂLNIRE'}</Text>
          <Text style={s.meetingHeroTitle}>{selected.title || 'Întâlnire'}</Text>
          <Text style={s.meetingHeroMeta}>{displayDate(selected.meeting_date)}  ·  {formatMeetingTime(selected.meeting_time)}  ·  {selected.closed_at ? 'Închisă' : 'Deschisă'}</Text>
          <View style={s.heroStats}><View style={s.heroStat}><Text style={s.heroNumber}>{plannedStaff.filter(p=>p.response==='confirmed'&&!p.removed_at).length}/{plannedStaff.filter(p=>!p.removed_at).length}</Text><Text style={s.heroLabel}>Confirmați</Text></View><View style={s.heroStat}><Text style={s.heroNumber}>{new Set(activities.map(a=>a.activity)).size}/6</Text><Text style={s.heroLabel}>Activități</Text></View><View style={s.heroStat}><Text style={s.heroNumber}>{staff.filter(p=>p.is_present===true).length}</Text><Text style={s.heroLabel}>Prezenți</Text></View></View>
          <Text style={[s.meetingHeroMeta,{display:'none'}]}>{plannedStaff.filter(p=>p.response==='confirmed'&&!p.removed_at).length}/{plannedStaff.filter(p=>!p.removed_at).length} confirmați  ·  {new Set(activities.map(a=>a.activity)).size}/6 activități</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:18}} contentContainerStyle={{gap:8}}>
          {(instructorView ? ['detalii','activitati','echipa','prezenta'] as const : ['echipa','activitati','prezenta','detalii'] as const).map(section => <TouchableOpacity key={section} onPress={()=>setActiveSection(section)} style={[s.sectionTab,activeSection===section&&s.sectionTabActive]}><Text style={[s.sectionTabText,activeSection===section&&s.sectionTabTextActive]}>{section==='echipa'?'Echipă':section==='activitati'?'Activități':section==='prezenta'?'Prezență':'Detalii'}</Text></TouchableOpacity>)}
        </ScrollView>
        {activeSection==='detalii' && <>
        {instructorView && <>
        {plannedStaff.filter(p=>p.user_id===myId && !p.removed_at).map(person=><View key={person.user_id} style={s.planCard}>
          <Text style={s.planHeading}>Participarea mea</Text>
          {!cancelled && !selected.closed_at && <View style={s.activityWrap}>
            {person.response !== 'confirmed' && <TouchableOpacity style={s.smallButton} disabled={busy} onPress={()=>respond(true)}><Text style={s.buttonText}>Confirm participarea</Text></TouchableOpacity>}
            {person.response === 'confirmed' ? (
              person.withdrawal_requested_at ? <Text style={s.hint}>Solicitarea de retragere a fost trimisă.</Text> :
              <TouchableOpacity style={[s.smallButton,{backgroundColor:'#777'}]} disabled={busy} onPress={()=>{
                setTeamReason('');
                setTeamAction({userId:person.user_id,type:'withdraw'});
              }}><Text style={s.buttonText}>Retrage-te</Text></TouchableOpacity>
            ) : person.response !== 'declined' ? <TouchableOpacity style={[s.smallButton,{backgroundColor:'#777'}]} disabled={busy} onPress={()=>respond(false)}><Text style={s.buttonText}>Nu pot participa</Text></TouchableOpacity> : null}
          </View>}
          {teamAction?.type==='withdraw' && <View style={{marginTop:14}}>
            <Text style={s.hint}>Motivul retragerii</Text>
            <TextInput style={s.input} multiline maxLength={500} value={teamReason} onChangeText={setTeamReason} placeholder="Explică motivul retragerii..." />
            <View style={s.activityWrap}>
              <TouchableOpacity style={s.smallButton} disabled={busy} onPress={submitTeamReason}><Text style={s.buttonText}>Confirmă retragerea</Text></TouchableOpacity>
              <TouchableOpacity style={[s.smallButton,{backgroundColor:'#777'}]} disabled={busy} onPress={()=>{setTeamAction(null);setTeamReason('');}}><Text style={s.buttonText}>Renunță</Text></TouchableOpacity>
            </View>
          </View>}
        </View>)}
        </>}
        <View style={s.planCard}>
          <Text style={s.planHeading}>Notă pentru întâlnire</Text>
          {detailNote ? <Text style={s.name}>{detailNote}</Text> : <Text style={s.hint}>Nu există o notă pentru această întâlnire.</Text>}
          {canCreate && !cancelled && !selected.closed_at && !selected.first_closed_at && <>
            <TouchableOpacity disabled={busy} onPress={() => { setEditedMeetingNote(detailNote); setEditingMeetingNote(!editingMeetingNote); }}>
              <Text style={[s.hint, { color: RED, marginTop: 10 }]}>{editingMeetingNote ? 'Renunță la editare' : 'Editează nota'}</Text>
            </TouchableOpacity>
            {editingMeetingNote && <>
              <TextInput style={s.input} multiline maxLength={2000} value={editedMeetingNote} onChangeText={setEditedMeetingNote} placeholder="Notă opțională pentru echipă" />
              <Text style={s.hint}>{editedMeetingNote.length}/2000 caractere</Text>
              <TouchableOpacity style={s.smallButton} disabled={busy} onPress={saveMeetingNote}><Text style={s.buttonText}>Salvează nota</Text></TouchableOpacity>
            </>}
          </>}
        </View>
        {cancelled && <View style={s.locked}><Text style={s.lockText}>Întâlnire anulată — doar vizualizare.</Text></View>}
        {canCreate && !cancelled && !selected.closed_at && <View style={s.planCard}>
          <Text style={s.planHeading}>Gestionarea întâlnirii</Text>
          <Text style={s.hint}>Reprogramare (ZZ-LL-AAAA și HH:MM, ora României).</Text>
          <TouchableOpacity style={[s.input,s.pickerRow]} onPress={()=>openPicker('date','reschedule')}><Text style={s.pickerText}>{newMeetingDate}</Text><Ionicons name="calendar-outline" size={22} color={RED}/></TouchableOpacity>
          <TouchableOpacity style={[s.input,s.pickerRow]} onPress={()=>openPicker('time','reschedule')}><Text style={s.pickerText}>{newMeetingTime || 'Selectează ora'}</Text><Ionicons name="time-outline" size={22} color={RED}/></TouchableOpacity>
          <TouchableOpacity style={s.smallButton} disabled={busy} onPress={reschedule}><Text style={s.buttonText}>Reprogramează</Text></TouchableOpacity>
          <TouchableOpacity style={[s.smallButton,{backgroundColor:'#666',marginTop:12}]} disabled={busy} onPress={cancelMeeting}><Text style={s.buttonText}>Anulează întâlnirea</Text></TouchableOpacity>
        </View>}
        {!instructorView && canCreate && !cancelled && <TouchableOpacity style={[s.button, { marginBottom: 15, backgroundColor: selected.closed_at ? '#287B54' : RED, opacity: !selected.closed_at && (unmarked.length > 0 || unmarkedStaff.length > 0) ? 0.55 : 1 }]} disabled={busy || (!selected.closed_at && (unmarked.length > 0 || unmarkedStaff.length > 0))} onPress={toggleClosed}>
          <Ionicons name={selected.closed_at ? 'lock-open-outline' : 'lock-closed-outline'} size={19} color="#FFF" />
          <Text style={s.buttonText}>{selected.closed_at ? 'Redeschide prezența' : 'Închide prezența'}</Text>
        </TouchableOpacity>}
        </>}
        {activeSection==='echipa' && <>
        {<View style={s.planCard}>
          <Text style={s.planHeading}>Echipa întâlnirii</Text>
          <Text style={[s.hint, {marginBottom:12}]}>{plannedStaff.filter(p=>!p.removed_at).length} persoane selectate pentru această întâlnire</Text>
          {plannedStaff.filter(p=>!p.removed_at).map(person=><View key={person.user_id} style={s.planPerson}>
            <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
              {teamAvatars[person.user_id] ? <Image source={{uri:teamAvatars[person.user_id]!}} style={s.profileAvatar}/> : <View style={s.profileAvatarPlaceholder}><Ionicons name="person-outline" size={22} color={RED}/></View>}
              <View style={{flex:1}}>
                <Text style={s.name}>{person.name || 'Instructor'}</Text>
                <Text style={[s.hint,{fontSize:13,marginTop:3,color:person.response==='confirmed'?GREEN:person.response==='declined'?RED:'#8A6D3B'}]}>
                  {person.response==='confirmed'?'Participare confirmată':'Neconfirmată'}
                </Text>
              </View>
            </View>
          </View>)}
          {canManageMembers && plannedStaff.some(p=>!p.removed_at && !!p.withdrawal_requested_at) && <View style={{marginTop:14}}>
            <Text style={s.planHeading}>Solicitări de retragere</Text>
            {plannedStaff.filter(p=>!p.removed_at && !!p.withdrawal_requested_at).map(p=><View key={'withdraw-'+p.user_id} style={{paddingVertical:10}}>
              <Text style={s.name}>{p.name || 'Instructor'}</Text>
              <Text style={s.hint}>Motivul retragerii: {p.withdrawal_reason || 'Motiv indisponibil'}</Text>
              <View style={s.activityWrap}>
                <TouchableOpacity style={s.smallButton} disabled={busy || !!withdrawalReviewBusy } onPress={()=>void reviewWithdrawal(p.user_id,true)}><Text style={s.buttonText}>Aprobă</Text></TouchableOpacity>
                <TouchableOpacity style={[s.smallButton,{backgroundColor:'#777'}]} disabled={busy || !!withdrawalReviewBusy } onPress={()=>void reviewWithdrawal(p.user_id,false)}><Text style={s.buttonText}>Respinge</Text></TouchableOpacity>
              </View>
            </View>)}
          </View>}
          {plannedStaff.filter(p=>!p.removed_at).length===0 && <Text style={s.hint}>Nu a fost selectat încă niciun instructor.</Text>}
        </View>}
        {canManageMembers && <View style={s.planCard}>
          <Text style={s.planHeading}>Echipa permanentă a localității</Text>
          <Text style={s.hint}>Selectează instructorii pentru această întâlnire. Echipa permanentă nu este modificată. {plannedStaff.filter(p=>!p.removed_at).length} participanți selectați.</Text>
          {candidates.filter(c=>c.is_local).map(c=>{
            const added=plannedStaff.some(p=>p.user_id===c.user_id && !p.removed_at);
            const profile=candidateProfiles[c.user_id];
            return <View key={c.user_id} style={s.candidate}>
              {profile?.avatar_url?<Image source={{uri:profile.avatar_url}} style={s.profileAvatar}/>:<View style={s.profileAvatarPlaceholder}><Ionicons name="person-outline" size={23} color={RED}/></View>}
              <View style={{flex:1}}><Text style={s.name}>{c.full_name}{c.is_coordinator?' · Coordonator':''}</Text>{!!profile?.nickname && <Text style={s.profileNickname}>@{profile.nickname}</Text>}<Text style={s.hint}>{added?'Invitat la întâlnire':'Disponibil pentru selectare'}</Text></View>
              {!cancelled && !selected.closed_at && !selected.first_closed_at && <TouchableOpacity disabled={busy || added} onPress={()=>setMember(c.user_id,true)} style={[s.activityChip,added&&{opacity:0.5}]}><Text style={s.activityText}>{added?'Adăugat':'+ Adaugă'}</Text></TouchableOpacity>}
            </View>;
          })}
          {candidates.filter(c=>c.is_local).length===0 && <Text style={s.hint}>Nu există instructori disponibili în lista echipei.</Text>}
        </View>}
        {canManageMembers && !cancelled && !selected.closed_at && !selected.first_closed_at && <View style={s.planCard}>
          <Text style={s.planHeading}>Adaugă participanți la întâlnire</Text>
          <Text style={s.hint}>Caută un voluntar din afara echipei permanente și trimite-i o invitație directă. Nu este necesară aprobarea administratorului.</Text>
          <TextInput style={s.input} value={candidateSearch} onChangeText={setCandidateSearch} placeholder="Caută după nume, nickname sau e-mail" autoCorrect={false} />
          {canManageMembers && <>
            <Text style={s.hint}>Caută minimum 2 caractere. Selectează profilul și verifică persoana înainte de a trimite invitația.</Text>
            {searchBusy && <ActivityIndicator color={RED}/>}
            {!!searchError && <Text style={s.error}>{searchError}</Text>}
            {globalResults.filter(c=>!plannedStaff.some(p=>p.user_id===c.user_id && !p.removed_at)).map(c =>
              <TouchableOpacity key={c.user_id} style={s.candidate} disabled={busy} onPress={()=>setSelectedVolunteer(c)}>
                {c.avatar_url ? <Image source={{uri:c.avatar_url}} style={s.profileAvatar}/> : <View style={s.profileAvatarPlaceholder}><Ionicons name="person-outline" size={23} color={RED}/></View>}
                <View style={{flex:1}}><Text style={s.name}>{c.full_name}</Text>{!!c.nickname && <Text style={s.profileNickname}>@{c.nickname}</Text>}<Text style={s.hint}>{c.email || 'E-mail indisponibil'} · {c.is_local?'Local':'Altă localitate'}</Text></View>
                <Ionicons name="chevron-forward" size={20} color={RED}/>
              </TouchableOpacity>
            )}
            {candidateSearch.trim().length>=2 && !searchBusy && !searchError && globalResults.length===0 && <Text style={s.hint}>Niciun voluntar găsit.</Text>}
            {selectedVolunteer && <Modal visible transparent animationType="fade" onRequestClose={()=>setSelectedVolunteer(null)}><View style={s.pickerOverlay}><View style={s.profileModal}>
              <TouchableOpacity style={{alignSelf:'flex-end'}} onPress={()=>setSelectedVolunteer(null)}><Ionicons name="close" size={24} color={DARK}/></TouchableOpacity>
              {selectedVolunteer.avatar_url ? <Image source={{uri:selectedVolunteer.avatar_url}} style={s.profileAvatarLarge}/> : <View style={s.profileAvatarLargePlaceholder}><Ionicons name="person" size={42} color={RED}/></View>}
              <Text style={s.profileTitle}>{selectedVolunteer.full_name}</Text>
              {!!selectedVolunteer.nickname && <Text style={s.profileNickname}>@{selectedVolunteer.nickname}</Text>}
              <Text style={s.profileDetail}>{selectedVolunteer.email || 'E-mail indisponibil'}</Text>
              <Text style={s.profileDetail}>{selectedVolunteer.is_local?'Instructor / voluntar local':'Voluntar din altă localitate'}</Text>
              <Text style={s.hint}>{selectedVolunteer.is_local?'Va primi o invitație la întâlnire.':'Invitația temporară este trimisă direct voluntarului. Numai acesta confirmă dacă poate veni.'}</Text>
              <TouchableOpacity style={[s.button,{marginTop:15}]} disabled={busy} onPress={()=>{const v=selectedVolunteer;setSelectedVolunteer(null);if(v.is_local)setMember(v.user_id,true);else Alert.alert('Trimiți invitația?',`Trimiți invitația pentru ${v.full_name}?`,[{text:'Anulează',style:'cancel'},{text:'Trimite invitația',onPress:()=>void proposeGuest(v.user_id)}]);}}><Text style={s.buttonText}>{selectedVolunteer.is_local?'Adaugă în echipă':'Invită temporar'}</Text></TouchableOpacity>
            </View></View></Modal>}
          </>}
          {guestInvites.length > 0 && <>
            <Text style={[s.planHeading,{marginTop:18}]}>Invitații temporare trimise</Text>
            <Text style={s.hint}>Invitațiile nu modifică echipa permanentă. Fiecare voluntar confirmă sau refuză participarea.</Text>
          </>}
          {guestInvites.map(g => <View key={g.id} style={s.planPerson}>
             <Text style={s.name}>{g.full_name}</Text>
             <Text style={s.hint}>{g.status === 'pending_approval' ? 'Invitație în așteptarea voluntarului' : g.status === 'approved' ? 'Invitat · voluntarul trebuie să confirme' : g.status === 'rejected' ? 'Respinsă' : 'Anulată'}</Text>
             {!!g.review_reason && <Text style={s.hint}>Motiv: {g.review_reason}</Text>}
           </View>)}
         </View>}
{activeSection==='prezenta' && canCreate && <Text style={s.hint}>{present.length} prezenți · {markedCount} din {children.length} marcați</Text>}
        {teamAction?.type==='remove' && <View style={s.planCard}>
          <Text style={s.planHeading}>{teamAction.type==='withdraw'?'Solicitare retragere':'Eliminare participant'}</Text>
          <Text style={s.hint}>Motiv obligatoriu (3–500 de caractere)</Text>
          <TextInput style={s.input} multiline maxLength={500} value={teamReason} onChangeText={setTeamReason} placeholder="Scrie motivul..." />
          <View style={s.activityWrap}>
            <TouchableOpacity style={s.smallButton} disabled={busy} onPress={submitTeamReason}><Text style={s.buttonText}>Trimite</Text></TouchableOpacity>
            <TouchableOpacity style={[s.smallButton,{backgroundColor:'#777'}]} disabled={busy} onPress={()=>setTeamAction(null)}><Text style={s.buttonText}>Anulează</Text></TouchableOpacity>
          </View>
        </View>}
        </>}
        {activeSection==='activitati' && <View style={s.planCard}>
          <Text style={s.planHeading}>Activitățile întâlnirii</Text>
          <Text style={s.hint}>Fiecare activitate are un responsabil. Instructorul confirmat poate alege prima activitate; pentru a doua trimite o solicitare spre aprobare.</Text>
          <Text style={s.hint}>Activități repartizate: {new Set(activities.map(a=>a.activity)).size} / {ACTIVITIES.length}</Text>
          {activities.map(a=><View key={a.activity} style={s.planPerson}>
            <Text style={s.name}>{a.activity}</Text>
            <Text style={s.hint}>Responsabil: {plannedStaff.find(p=>p.user_id===a.user_id)?.name || 'Instructor'}</Text>
            {!!a.notes && <Text style={s.hint}>Material / observații: {a.notes}</Text>}
            {!!a.material_url && <Text style={s.hint}>Link: {a.material_url}</Text>}
            {canCreate && !instructorView && !cancelled && !selected.closed_at && <TouchableOpacity onPress={()=>{setEditingMaterial(editingMaterial===a.activity?null:a.activity);setMaterialNotes(a.notes||'');setMaterialUrl(a.material_url||'');}}><Text style={[s.hint,{color:RED}]}>Editează materialul</Text></TouchableOpacity>}
            {editingMaterial===a.activity && canCreate && !instructorView && <>
              <TextInput style={s.input} multiline maxLength={1200} placeholder="Comentariu pentru activitate" value={materialNotes} onChangeText={setMaterialNotes}/>
              <TextInput style={s.input} maxLength={1000} placeholder="Link HTTPS" value={materialUrl} onChangeText={setMaterialUrl}/>
              <TouchableOpacity style={s.smallButton} disabled={busy} onPress={()=>saveMaterial(a.activity)}><Text style={s.buttonText}>Salvează materialul</Text></TouchableOpacity>
            </>}
          </View>)}
          <Text style={[s.planHeading,{marginTop:18}]}>Activități disponibile</Text>
          {ACTIVITIES.filter(a=>!activities.some(x=>x.activity===a)).length===0 && <Text style={s.hint}>Toate activitățile au responsabil.</Text>}
          {ACTIVITIES.filter(a=>!activities.some(x=>x.activity===a)).map(a=>{
            const mine=plannedStaff.find(p=>p.user_id===myId && !p.removed_at);
            const myActivities=activities.filter(x=>x.user_id===myId);
            const pending=requests.some(r=>r.user_id===myId && r.status==='pending');
            const eligible=!!mine && mine.response==='confirmed' && !mine.withdrawal_requested_at && !cancelled && !selected.closed_at && !selected.first_closed_at;
            return <View key={a} style={[s.candidate,{justifyContent:'space-between'}]}><View style={{flex:1}}><Text style={s.name}>{a}</Text><Text style={s.hint}>Fără responsabil</Text></View>
              {eligible && <TouchableOpacity style={s.activityChip} disabled={busy||pending||myActivities.length>=2} onPress={()=>myActivities.length===0?void chooseActivity(a):myActivities.length===1?void requestExtra(a):undefined}><Text style={s.activityText}>{myActivities.length===0?'Alege':myActivities.length===1?'Solicită a doua':'Limită atinsă'}</Text></TouchableOpacity>}
            </View>;
          })}
          {plannedStaff.some(p=>p.user_id===myId && !p.removed_at && p.response!=='confirmed') && <Text style={s.hint}>Confirmă participarea în secțiunea Detalii înainte de a alege o activitate.</Text>}
          {requests.some(r=>r.user_id===myId && r.status==='pending') && <Text style={s.hint}>Ai o solicitare de activitate în așteptarea coordonatorului.</Text>}
          {canCreate && !cancelled && requests.filter(r => r.status === 'pending' && plannedStaff.some(p => p.user_id === r.user_id && !p.removed_at && p.response === 'confirmed')).map(r => <View key={r.id} style={s.planPerson}>
            <Text style={s.name}>Cerere: {plannedStaff.find(x=>x.user_id===r.user_id)?.name || 'Instructor'}</Text>
            <Text style={s.hint}>{r.old_activity ? `${r.old_activity} → ${r.new_activity}` : `Activitate suplimentară: ${r.new_activity}`}</Text>
            <View style={s.activityWrap}>
              <TouchableOpacity style={s.activityChip} disabled={busy || r.user_id===myId} onPress={() => void reviewRequest(r.id,true)}><Text style={s.activityText}>Aprobă</Text></TouchableOpacity>
              <TouchableOpacity style={s.activityChip} disabled={busy || r.user_id===myId} onPress={() => void reviewRequest(r.id,false)}><Text style={s.activityText}>Respinge</Text></TouchableOpacity>
            </View>
          </View>)}
        </View>}

        {activeSection==='prezenta' && <>
        {selected.closed_at && <View style={s.locked}>
          <Ionicons name="lock-closed-outline" size={18} color={RED} />
          <Text style={s.lockText}>{canCreate ? 'Prezență închisă · sumar disponibil mai jos' : 'Prezență închisă · doar vizualizare'}</Text>
        </View>}
        {canCreate && !cancelled && !selected.closed_at && unmarked.length > 0 && (
          <Text style={[s.hint, { color: RED, marginBottom: 12 }]}>Mai sunt {unmarked.length} copii nemarcați. Marchează fiecare copil pentru a putea închide prezența.</Text>
        )}
        {canCreate && !cancelled && !selected.closed_at && unmarkedStaff.length > 0 && (
          <Text style={[s.hint, { color: RED, marginBottom: 12 }]}>Mai sunt {unmarkedStaff.length} membri ai echipei nemarcați.</Text>
        )}
        {canCreate && <View style={s.summary}>
          <Text style={s.summaryTitle}>Prezența instructorilor</Text>
          <Text style={s.hint}>Confirmarea participării este diferită de prezența efectivă. Marchează ✓ prezent, ✕ absent sau ? de clarificat.</Text>
          <Text style={s.hint}>{staff.filter(p => p.is_present === true).length} prezenți · {staff.length} membri</Text>
          {staff.length === 0 && <Text style={s.hint}>Nu sunt membri înregistrați pentru această întâlnire.</Text>}
          {staff.map(person => {
            const participant = plannedStaff.find(p => p.user_id === person.user_id && !p.removed_at);
            const confirmed = participant?.response === 'confirmed';
            return <View key={person.user_id} style={[s.childRow, { paddingVertical: 9 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{person.full_name}</Text>
              <Text style={s.hint}>{!confirmed ? 'Participare neconfirmată · prezența indisponibilă' : Object.prototype.hasOwnProperty.call(staffUncertain,person.user_id) ? 'De clarificat (?)' : person.is_present === null ? 'Nemarcat' : person.is_present ? 'Prezent' : 'Absent'}</Text>
            </View>
            {!selected.closed_at && !cancelled && canMarkStaff && <>
              <TouchableOpacity disabled={busy || !confirmed} onPress={() => markStaff(person.user_id, true)} style={[s.choice, !confirmed && {opacity:0.3}, person.is_present === true && s.present]}>
                <Ionicons name="checkmark" size={19} color={person.is_present === true ? '#FFF' : GREEN} />
              </TouchableOpacity>
              <TouchableOpacity disabled={busy || !confirmed} onPress={() => markStaff(person.user_id, false)} style={[s.choice, !confirmed && {opacity:0.3}, person.is_present === false && s.absent]}>
                <Ionicons name="close" size={19} color={person.is_present === false ? '#FFF' : RED} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel={`De clarificat: ${person.full_name}`} disabled={busy || !confirmed} onPress={() => void markStaffUncertain(person.user_id)} style={[s.choice, !confirmed && {opacity:0.3}, Object.prototype.hasOwnProperty.call(staffUncertain,person.user_id) && s.uncertain]}>
                <Text style={[s.question, Object.prototype.hasOwnProperty.call(staffUncertain,person.user_id) && {color:'#FFF'}]}>?</Text>
              </TouchableOpacity>
            </>}
          </View>})}
          {!selected.closed_at && !canMarkStaff && <Text style={s.hint}>Doar coordonatorul poate marca prezența echipei.</Text>}
        </View>}
        <View style={s.summary}>
        <Text style={s.summaryTitle}>Prezența copiilor</Text>
        {!instructorView && canManageMembers && !selected.closed_at && !selected.first_closed_at && <View style={{marginVertical:12}}>
          <Text style={s.hint}>Responsabil: {plannedStaff.find(p=>p.user_id===childDelegateId)?.name || 'Nedesemnat'}</Text>
          <Text style={s.hint}>Desemnează un instructor confirmat pentru această întâlnire:</Text>
          {plannedStaff.filter(p=>!p.removed_at && p.response==='confirmed').map(p=><TouchableOpacity key={p.user_id} style={[s.activityChip,{marginTop:8,alignSelf:'flex-start'}]} disabled={busy || p.user_id===childDelegateId} onPress={()=>delegateAttendance(p.user_id)}><Text style={s.activityText}>{p.user_id===childDelegateId?'✓ ':''}{p.name}</Text></TouchableOpacity>)}
        </View>}
        {instructorView && <Text style={s.hint}>{childDelegateId===myId?'Ai fost desemnat responsabil cu prezența copiilor.':'Prezența copiilor este doar pentru vizualizare. Coordonatorul poate desemna un responsabil.'}</Text>}
        {(selected.closed_at || cancelled ? (
          <View>
            <Text style={s.summaryTitle}>Sumarul întâlnirii</Text>
            <Text style={s.hint}>Total copii: {children.length}</Text>
            <View style={s.stats}>
              <Text style={s.stat}>✓ {present.length} prezenți</Text>
              <Text style={s.stat}>✕ {absent.length} absenți</Text>
              <Text style={s.stat}>? {uncertain.length} de clarificat</Text>
            </View>
            {summaryGroup('Prezenți', present, GREEN)}
            {summaryGroup('Absenți', absent, RED)}
            {summaryGroup('De clarificat (?)', uncertain, '#946200', true)}
          </View>
        ) : <>
          <Text style={s.hint}>✓ Prezent · ✕ Absent · ? De clarificat (cu motiv)</Text>
          {children.map(child => {
            const entry = attendance[child.id];
            const editingReason = reasonChildId === child.id;
            return <View key={child.id} style={s.childCard}>
              <View style={s.childRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{nameOf(child)}</Text>
                  <Text style={s.hint}>{statusLabel(entry)}</Text>
                  {entry?.status === 'uncertain' && !!entry.reason && <Text style={s.reasonText}>Motiv: {entry.reason}</Text>}
                </View>
                <TouchableOpacity accessibilityLabel={`Prezent: ${nameOf(child)}`} disabled={busy || !canEditChildren} onPress={() => mark(child.id, 'present')} style={[s.choice, entry?.status === 'present' && s.present]}>
                  <Ionicons name="checkmark" size={19} color={entry?.status === 'present' ? '#FFF' : GREEN} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel={`Absent: ${nameOf(child)}`} disabled={busy || !canEditChildren} onPress={() => mark(child.id, 'absent')} style={[s.choice, entry?.status === 'absent' && s.absent]}>
                  <Ionicons name="close" size={19} color={entry?.status === 'absent' ? '#FFF' : RED} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel={`De clarificat: ${nameOf(child)}`} disabled={busy || !canEditChildren} onPress={() => {
                  setReasonChildId(editingReason ? null : child.id);
                  setReason(entry?.status === 'uncertain' ? (entry.reason || '') : '');
                }} style={[s.choice, entry?.status === 'uncertain' && s.uncertain]}>
                  <Text style={[s.question, entry?.status === 'uncertain' && { color: '#FFF' }]}>?</Text>
                </TouchableOpacity>
              </View>
              {editingReason && <View style={s.reasonPanel}>
                <Text style={s.hint}>Motiv / explicație (opțional)</Text>
                <TextInput
                  style={[s.input, { marginBottom: 9 }]}
                  placeholder="Ex.: Bolnav, răcit, motiv familial..."
                  value={reason}
                  onChangeText={setReason}
                  maxLength={300}
                  multiline
                />
                <View style={s.reasonActions}>
                  <TouchableOpacity style={s.cancelButton} onPress={() => setReasonChildId(null)}>
                    <Text style={s.cancelText}>Anulează</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.smallButton, busy && { opacity: 0.5 }]} disabled={busy || !canEditChildren} onPress={() => mark(child.id, 'uncertain', reason)}>
                    <Text style={s.buttonText}>Salvează ?</Text>
                  </TouchableOpacity>
                </View>
              </View>}
            </View>;
          })}
          {children.length === 0 && <Text style={s.hint}>Nu există copii activi în această localitate.</Text>}
        </>)}
        </View>


        </>}
      </> : <>
        {!canManageMembers && <Text style={s.hint}>{guestOnly?'Vezi doar întâlnirile la care ai fost invitat.':'Coordonatorul creează întâlnirile. Tu poți marca prezența în întâlnirile existente.'}</Text>}
        {canManageMembers && !instructorView && !showCreateForm && <TouchableOpacity style={[s.button, { marginBottom: 15 }]} onPress={() => setShowCreateForm(true)} accessibilityRole="button"><Ionicons name="add-circle-outline" size={21} color="#FFF"/><Text style={s.buttonText}>Creează întâlnire</Text></TouchableOpacity>}
        {!showCreateForm && <Text style={s.section}>Întâlniri</Text>}
        {!showCreateForm && meetings.map(m => <TouchableOpacity key={m.id} style={s.meetingCard} disabled={busy} onPress={() => openMeeting(m)}>
          <Ionicons name="calendar-outline" size={23} color={RED} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{m.title || 'Întâlnire'}</Text>
            <Text style={s.hint}>{displayDate(m.meeting_date)} · {formatMeetingTime(m.meeting_time)} · {m.closed_at ? 'Închisă · sumar' : 'Deschisă'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#AAA" />
        </TouchableOpacity>)}
        {!showCreateForm && meetings.length === 0 && <Text style={s.hint}>Nu există încă întâlniri înregistrate.</Text>}
        {canManageMembers && !instructorView && showCreateForm && <>
          <Text style={s.section}>Întâlnire nouă</Text>
          <Text style={s.hint}>Data întâlnirii</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Alege data întâlnirii" style={[s.input, s.pickerRow]} onPress={() => openPicker('date')}>
            <Text style={s.pickerText}>{date}</Text><Ionicons name="calendar-outline" size={22} color={RED} />
          </TouchableOpacity>
          <Text style={s.hint}>Ora începerii (ora României)</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Alege ora întâlnirii" style={[s.input, s.pickerRow]} onPress={() => openPicker('time')}>
            <Text style={[s.pickerText, !meetingTime && { color: '#999' }]}>{meetingTime || 'Selectează ora'}</Text><Ionicons name="time-outline" size={22} color={RED} />
          </TouchableOpacity>
          <Text style={s.hint}>Lecție / titlu (opțional)</Text>
          <TextInput style={s.input} value={title} onChangeText={setTitle} maxLength={160} placeholder="Ex.: Lecția despre Iosif" />
          <Text style={s.hint}>Notă pentru întâlnire (opțional)</Text>
          <TextInput
            style={[s.input, { minHeight: 92, textAlignVertical: 'top' }]}
            value={meetingNote}
            onChangeText={setMeetingNote}
            maxLength={2000}
            multiline
            placeholder="Ex.: Materiale necesare, indicații pentru echipă..."
          />
          <Text style={s.section}>Instructori programați</Text>
          <Text style={s.hint}>Selectează explicit participanții, inclusiv coordonatorii dacă vor participa. Nicio persoană nu trebuie inclusă automat.</Text>
          {([true,false] as const).map(local => <View key={String(local)}>
            <Text style={s.planHeading}>{local ? 'Echipa localității' : 'Instructori din alte localități'}</Text>
            {candidates.filter(c => c.is_local === local).map(c => <TouchableOpacity key={c.user_id} style={s.candidate} onPress={() => setChosenInstructors(prev => prev.includes(c.user_id) ? prev.filter(x => x!==c.user_id) : [...prev,c.user_id])}>
              <Ionicons name={chosenInstructors.includes(c.user_id) ? 'checkbox' : 'square-outline'} size={22} color={RED}/>
              <View style={{flex:1}}><Text style={s.name}>{c.full_name}</Text>{!local && <Text style={s.hint}>{c.other_localities.join(', ')}</Text>}</View>
            </TouchableOpacity>)}
          </View>)}
          <TouchableOpacity style={s.button} disabled={busy} onPress={createMeeting}>
            <Ionicons name="add-circle-outline" size={21} color="#FFF" />
            <Text style={s.buttonText}>Creează întâlnirea</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 14, alignItems: 'center' }} onPress={() => { setShowCreateForm(false); setPicker(null); }}><Text style={{ color: RED, fontWeight: '700' }}>Anulează</Text></TouchableOpacity>
        </>}

      </>}
    </ScrollView>}
          {Platform.OS === 'ios' ? (
            <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
              <View style={s.pickerOverlay}>
                <View style={s.pickerPanel}>
                  <Text style={s.pickerHeading}>{picker === 'date' ? 'Alege data întâlnirii' : 'Alege ora începerii'}</Text>
                  {picker && <DateTimePicker
                    value={draftPickerDate}
                    mode={picker}
                    display={picker === 'date' ? 'inline' : 'spinner'}
                    is24Hour={true}
                    locale="ro-RO"
                    themeVariant="light"
                    accentColor={RED}
                    style={picker === 'date' ? s.inlineCalendar : s.inlineClock}
                    onChange={(_, chosen) => { if (chosen) setDraftPickerDate(chosen); }}
                  />}
                  <View style={s.pickerActions}>
                    <TouchableOpacity onPress={() => setPicker(null)} style={s.pickerCancel} accessibilityRole="button"><Text style={s.pickerCancelText}>Anulează</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { if (picker) savePicker(picker, draftPickerDate); setPicker(null); }} style={s.pickerConfirm} accessibilityRole="button"><Text style={s.buttonText}>Confirmă</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          ) : picker ? (
            <DateTimePicker
              value={draftPickerDate}
              mode={picker}
              display="default"
              is24Hour={true}
              onChange={(event, chosen) => {
                const mode = picker;
                setPicker(null);
                if (event.type === 'set' && chosen) savePicker(mode, chosen);
              }}
            />
          ) : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  heroStats:{flexDirection:'row',gap:8,marginTop:15},
  heroStat:{flex:1,backgroundColor:'#F8F5F5',borderRadius:13,padding:12,alignItems:'center'},
  heroNumber:{fontSize:18,fontWeight:'900',color:DARK},
  heroLabel:{fontSize:11,color:'#777',marginTop:4},
  profileModal:{backgroundColor:'#FFF',borderRadius:22,padding:22,alignItems:'center'},
  profileAvatarLarge:{width:92,height:92,borderRadius:46},
  profileAvatarLargePlaceholder:{width:92,height:92,borderRadius:46,backgroundColor:'#FBEDED',alignItems:'center',justifyContent:'center'},
  profileTitle:{fontSize:21,fontWeight:'900',color:DARK,marginTop:12},
  profileDetail:{fontSize:14,color:'#666',marginTop:7},
  meetingHero:{backgroundColor:'#FFF',borderRadius:22,padding:20,marginBottom:14},
  meetingHeroEyebrow:{fontSize:11,color:RED,fontWeight:'800',letterSpacing:1.2,marginBottom:6},
  meetingHeroTitle:{fontSize:24,fontWeight:'900',color:DARK,marginBottom:8},
  meetingHeroMeta:{fontSize:14,color:'#686868',marginTop:5},
  sectionTab:{paddingVertical:11,paddingHorizontal:17,borderRadius:24,backgroundColor:'#FFF',borderWidth:1,borderColor:'#E5E5E5'},
  sectionTabActive:{backgroundColor:RED,borderColor:RED},
  sectionTabText:{fontSize:14,fontWeight:'700',color:'#555'},
  sectionTabTextActive:{color:'#FFF'},
  profileAvatar:{width:48,height:48,borderRadius:24},
  profileAvatarPlaceholder:{width:48,height:48,borderRadius:24,backgroundColor:'#FBEDED',alignItems:'center',justifyContent:'center'},
  profileNickname:{color:RED,fontSize:12,fontWeight:'700',marginTop:2},
  planCard: { backgroundColor:'#FFF', borderRadius:15, padding:14, marginVertical:12 },
  planHeading: { color:DARK, fontSize:16, fontWeight:'900', marginBottom:8 },
  planPerson: { paddingVertical:12, borderTopWidth:1, borderTopColor:'#EEE' },
  activityWrap: { flexDirection:'row', flexWrap:'wrap', gap:7, marginTop:6 },
  activityChip: { borderRadius:10, borderWidth:1, borderColor:'#DDD', paddingHorizontal:10, paddingVertical:9, backgroundColor:'#F7F7F7' },
  activityActive: { backgroundColor:GREEN, borderColor:GREEN },
  activityText: { fontSize:12, color:DARK, fontWeight:'700' },
  candidate: { flexDirection:'row', gap:10, alignItems:'center', backgroundColor:'#FFF', padding:12, borderRadius:10, marginBottom:7 },
  itemNotification: { color:DARK, fontSize:13, fontWeight:'600' },
  root: { flex: 1, backgroundColor: '#F6F6F6' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#FFF' },
  eyebrow: { color: RED, fontSize: 10, fontWeight: '800' },
  heading: { color: DARK, fontSize: 23, fontWeight: '900' },
  content: { padding: 17, paddingBottom: 45 },
  section: { fontSize: 17, fontWeight: '900', color: DARK, marginTop: 18, marginBottom: 12 },
  hint: { color: '#777', fontSize: 12, marginTop: 5, marginBottom: 7 },
  error: { color: RED },
  input: { backgroundColor: '#FFF', padding: 14, borderRadius: 13, marginBottom: 13, color: DARK },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 53 },
  pickerText: { color: DARK, fontSize: 15 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 18 },
  pickerPanel: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, overflow: 'hidden' },
  pickerHeading: { color: DARK, fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  inlineCalendar: { alignSelf: 'center', width: '100%' },
  inlineClock: { alignSelf: 'center', width: '100%', height: 205 },
  pickerActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 12 },
  pickerCancel: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F1F1F1' },
  pickerCancelText: { color: DARK, fontWeight: '700' },
  pickerConfirm: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: RED },
  button: { backgroundColor: RED, padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonText: { color: '#FFF', fontWeight: '800' },
  meetingCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  childCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 15, marginBottom: 10 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: DARK, fontWeight: '800', fontSize: 14 },
  choice: { width: 38, height: 38, borderWidth: 1, borderColor: '#EEE', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  present: { backgroundColor: GREEN },
  absent: { backgroundColor: RED },
  uncertain: { backgroundColor: '#946200' },
  question: { color: '#946200', fontSize: 21, fontWeight: '900' },
  reasonText: { color: '#946200', fontSize: 12, marginTop: 5 },
  reasonPanel: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEE' },
  reasonActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, alignItems: 'center' },
  cancelButton: { padding: 11 },
  cancelText: { color: '#777', fontWeight: '700' },
  smallButton: { backgroundColor: RED, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0ED', borderRadius: 12, padding: 12, marginBottom: 12 },
  lockText: { color: RED, fontSize: 13, fontWeight: '700' },
  summary: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginTop: 6 },
  summaryTitle: { color: DARK, fontSize: 18, fontWeight: '900' },
  stats: { gap: 6, marginVertical: 12 },
  stat: { color: DARK, fontSize: 14, fontWeight: '700' },
  summaryGroup: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 12 },
  groupTitle: { fontWeight: '900', fontSize: 14, marginBottom: 5 },
  summaryRow: { paddingVertical: 6 },
});