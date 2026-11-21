import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image,  KeyboardAvoidingView, Modal, Platform, StatusBar, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const INK = '#22252B';
const BG = '#F7F6F3';
type Person = { id: string; label: string; nickname?: string | null; avatar_url?: string | null; email?: string | null };
type Activity = { id: string; title: string; description: string | null; starts_at: string; ends_at: string | null };
const pad = (n: number) => String(n).padStart(2, '0');
const monday = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7 + offset * 7); d.setHours(0, 0, 0, 0); return d; };
const formatDate = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
const parseDateTime = (date: string, hour: string, minute: string): Date | null => {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date.trim());
  if (!match || !/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
  const day = +match[1], month = +match[2], year = +match[3], h = +hour, m = +minute;
  if (year < 2000 || year > 2100 || h > 23 || m > 59) return null;
  const d = new Date(year, month - 1, day, h, m);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
};

export default function WeeklyScheduleAdmin() {
  const [offset, setOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Activity[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startHour, setStartHour] = useState('09');
  const [startMinute, setStartMinute] = useState('00');
  const [endDate, setEndDate] = useState('');
  const [endHour, setEndHour] = useState('10');
  const [endMinute, setEndMinute] = useState('00');
  const [selected, setSelected] = useState<string[]>([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = (key: string) => setFieldErrors(prev => { if (!prev[key] && !prev.range) return prev; const next = { ...prev }; delete next[key]; delete next.range; return next; });
  const updateField = (key: string, setter: (value: string) => void) => (value: string) => { setter(value); clearFieldError(key); };
  const updateSelected = (fn: (value: string[]) => string[]) => setSelected(prev => { const next = fn(prev); if (next.length) clearFieldError('people'); return next; });

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!session) { router.replace('/admin-login'); return; }
      const { data: role, error: roleError } = await supabase.from('admins').select('role').eq('user_id', session.user.id).maybeSingle();
      if (roleError) throw roleError;
      if (role?.role !== 'super_admin') {
        const { data: permission, error: permissionError } = await supabase.from('weekly_schedule_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
        if (permissionError) throw permissionError;
        if (!permission) { setError('Nu ai permisiunea de administrare a programului.'); return; }
      }
      const [activities, peopleResult] = await Promise.all([
        supabase.from('weekly_schedule_activities').select('id,title,description,starts_at,ends_at').gte('starts_at', monday(offset).toISOString()).lt('starts_at', monday(offset + 1).toISOString()).order('starts_at'),
        supabase.rpc('weekly_schedule_people'),
      ]);
      if (activities.error) throw activities.error;
      if (peopleResult.error) throw peopleResult.error;
      setItems(activities.data ?? []);
      const basePeople: Person[] = (peopleResult.data ?? []).map((p: any) => ({ id: p.id, label: p.label, email: p.email ?? null }));
      // Îmbogățim datele numai cu profilurile vizibile utilizatorului autentificat.
      // Dacă RLS nu permite accesul, lista de asignare rămâne funcțională.
      const userIds = basePeople.map(p => p.id);
      const profileMap = new Map<string, { full_name?: string | null; nickname?: string | null; avatar_url?: string | null }>();
      if (userIds.length) {
        const [volunteers, admins] = await Promise.all([
          supabase.from('volunteer_profiles').select('user_id,full_name,nickname,avatar_url').in('user_id', userIds),
          supabase.from('admin_profiles').select('user_id,full_name,nickname,avatar_url').in('user_id', userIds),
        ]);
        for (const profile of volunteers.data ?? []) profileMap.set(profile.user_id, profile);
        for (const profile of admins.data ?? []) profileMap.set(profile.user_id, profile);
      }
      setPeople(basePeople.map(p => {
        const profile = profileMap.get(p.id);
        return { ...p, label: profile?.full_name?.trim() || p.label, nickname: profile?.nickname, avatar_url: profile?.avatar_url };
      }));
      const ids = (activities.data ?? []).map(a => a.id);
      if (ids.length) {
        const { data, error: assignmentError } = await supabase.from('weekly_schedule_assignments').select('activity_id,user_id').in('activity_id', ids);
        if (assignmentError) throw assignmentError;
        const map: Record<string, string[]> = {};
        (data ?? []).forEach(x => { (map[x.activity_id] ??= []).push(x.user_id); });
        setAssignments(map);
      } else setAssignments({});
    } catch (e: any) { setError(e?.message ?? 'Nu am putut încărca programul.'); }
    finally { setLoading(false); }
  }, [offset]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  function openNew() {
    const d = selectedDay === null ? new Date() : new Date(monday(offset).getFullYear(), monday(offset).getMonth(), monday(offset).getDate() + selectedDay);
    setEditing(null); setTitle(''); setDescription('');
    setStartDate(formatDate(d)); setStartHour('09'); setStartMinute('00');
    setEndDate(formatDate(d)); setEndHour('10'); setEndMinute('00');
    setSelected([]); setSearch(''); setPeopleOpen(false); setFieldErrors({}); setModal(true);
  }
  function openEdit(a: Activity) {
    const start = new Date(a.starts_at), end = a.ends_at ? new Date(a.ends_at) : new Date(start.getTime() + 3600000);
    setEditing(a.id); setTitle(a.title); setDescription(a.description ?? '');
    setStartDate(formatDate(start)); setStartHour(pad(start.getHours())); setStartMinute(pad(start.getMinutes()));
    setEndDate(formatDate(end)); setEndHour(pad(end.getHours())); setEndMinute(pad(end.getMinutes()));
    setSelected(assignments[a.id] ?? []); setSearch(''); setPeopleOpen(false); setFieldErrors({}); setModal(true);
  }
  async function save() {
    const start = parseDateTime(startDate, startHour, startMinute);
    const end = parseDateTime(endDate, endHour, endMinute);
    const invalid: Record<string, string> = {};
    if (!title.trim()) invalid.title = 'Introdu titlul activității.';
    const validatePart = (prefix: 'start' | 'end', date: string, hour: string, minute: string) => {
      if (!date.trim()) invalid[`${prefix}Date`] = 'Data este obligatorie.';
      else if (!/^\d{2}-\d{2}-\d{4}$/.test(date.trim()) || !parseDateTime(date, '00', '00')) invalid[`${prefix}Date`] = 'Folosește o dată validă: ZZ-LL-AAAA.';
      if (!hour.trim()) invalid[`${prefix}Hour`] = 'Ora este obligatorie.';
      else if (!/^\d{1,2}$/.test(hour) || +hour > 23) invalid[`${prefix}Hour`] = 'Ora: 00–23.';
      if (!minute.trim()) invalid[`${prefix}Minute`] = 'Minutele sunt obligatorii.';
      else if (!/^\d{1,2}$/.test(minute) || +minute > 59) invalid[`${prefix}Minute`] = 'Minute: 00–59.';
    };
    validatePart('start', startDate, startHour, startMinute);
    validatePart('end', endDate, endHour, endMinute);
    if (!start && !Object.keys(invalid).some(k => k.startsWith('start'))) invalid.startDate = 'Verifică data și ora de început.';
    if (!end && !Object.keys(invalid).some(k => k.startsWith('end'))) invalid.endDate = 'Verifică data și ora de final.';
    if (start && end && end <= start) invalid.range = 'Finalul trebuie să fie după început.';
    if (start && start.getTime() < Date.now()) invalid.startDate = 'Nu poți programa o activitate în trecut.';
    if (!selected.length) invalid.people = 'Selectează cel puțin o persoană.';
    if (Object.keys(invalid).length) {
      setFieldErrors(invalid);
      if (invalid.people) setPeopleOpen(true);
      return;
    }
    // Verificare rapidă pentru conflicte; protecția definitivă este în Supabase.
    if (start && end && selected.length) {
      const { data: overlapping, error: conflictError } = await supabase
        .from('weekly_schedule_activities')
        .select('id,title,starts_at,ends_at')
        .lt('starts_at', end.toISOString())
        .gt('ends_at', start.toISOString());
      if (conflictError) {
        Alert.alert('Verificare indisponibilă', conflictError.message);
        return;
      }
      const candidates = (overlapping ?? []).filter(a => a.id !== editing);
      if (candidates.length) {
        const { data: conflictingAssignments, error: assignmentError } = await supabase
          .from('weekly_schedule_assignments')
          .select('activity_id,user_id')
          .in('activity_id', candidates.map(a => a.id))
          .in('user_id', selected);
        if (assignmentError) {
          Alert.alert('Verificare indisponibilă', assignmentError.message);
          return;
        }
        const match = (conflictingAssignments ?? [])[0];
        if (match) {
          const person = people.find(p => p.id === match.user_id)?.label ?? 'Persoana selectată';
          const activity = candidates.find(a => a.id === match.activity_id);
          setFieldErrors({ people: `${person} are deja activitatea „${activity?.title ?? 'programată'}” în acest interval.` });
          setPeopleOpen(true);
          return;
        }
      }
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const { error: saveError } = await supabase.rpc('weekly_schedule_save_activity', {
        p_id: editing, p_title: title.trim(), p_description: description.trim() || null,
        p_starts_at: start.toISOString(), p_ends_at: end.toISOString(), p_user_ids: selected,
      });
      if (saveError) throw saveError;
      setModal(false); await refresh();
    } catch (e: any) {
      const msg = e?.message ?? 'Salvarea a eșuat.';
      if (msg.includes('WEEKLY_OVERLAP')) {
        setFieldErrors({ people: 'Una dintre persoanele selectate are deja o activitate în acest interval.' });
        setPeopleOpen(true);
      } else if (msg.includes('WEEKLY_PAST')) {
        setFieldErrors({ startDate: 'Nu poți programa activități în trecut.' });
      } else Alert.alert('Eroare', msg);
    }
    finally { setBusy(false); }
  }
  function remove(id: string) {
    Alert.alert('Ștergere activitate', 'Ștergi activitatea și toate asignările?', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: async () => {
        const { error: deleteError } = await supabase.rpc('weekly_schedule_delete_activity', { p_id: id });
        if (deleteError) Alert.alert('Eroare', deleteError.message); else await refresh();
      } },
    ]);
  }
  const filteredPeople = useMemo(() => people.filter(p => [p.label, p.nickname, p.email].some(value => (value ?? '').toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro')))), [people, search]);
  const base = monday(offset);
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(base); date.setDate(base.getDate() + i); return { date, activities: items.filter(a => new Date(a.starts_at).toDateString() === date.toDateString()) }; });
  const displayed = selectedDay === null ? items : days[selectedDay].activities;
  const occupied = days.filter(d => d.activities.length > 0).length;
  const isDesktop = Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth >= 850;
  const dateFields = (label: string, prefix: 'start' | 'end', date: string, setDate: (v: string) => void, hour: string, setHour: (v: string) => void, minute: string, setMinute: (v: string) => void) => (
    <View style={s.dateGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.dateRow}>
        <View style={{ flex: 1.4 }}><Text style={s.inputHint}>Data · ZZ-LL-AAAA</Text><TextInput style={[s.field, fieldErrors[`${prefix}Date`] && s.fieldInvalid]} value={date} onChangeText={updateField(`${prefix}Date`, setDate)} placeholder="04-11-2026" keyboardType="numbers-and-punctuation" maxLength={10} /></View>
        <View style={{ flex: 0.5 }}><Text style={s.inputHint}>Ora · HH</Text><TextInput style={[s.field, s.center, fieldErrors[`${prefix}Hour`] && s.fieldInvalid]} value={hour} onChangeText={updateField(`${prefix}Hour`, setHour)} keyboardType="number-pad" maxLength={2} placeholder="09" /></View>
        <View style={{ flex: 0.5 }}><Text style={s.inputHint}>Min · MM</Text><TextInput style={[s.field, s.center, fieldErrors[`${prefix}Minute`] && s.fieldInvalid]} value={minute} onChangeText={updateField(`${prefix}Minute`, setMinute)} keyboardType="number-pad" maxLength={2} placeholder="00" /></View>
      </View>
      {(['Date', 'Hour', 'Minute'] as const).map(part => fieldErrors[`${prefix}${part}`] ? <Text key={part} style={s.validationText}>{fieldErrors[`${prefix}${part}`]}</Text> : null)}
      {prefix === 'end' && fieldErrors.range ? <Text style={s.validationText}>{fieldErrors.range}</Text> : null}
    </View>
  );
  return <SafeAreaView style={s.screen} edges={['top']}>
    <View style={s.fixedTop}>
      <View style={s.headingRow}><TouchableOpacity accessibilityLabel="Înapoi la Dashboard" style={s.headerBack} onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={INK} /></TouchableOpacity><View style={s.headingTitle}><Text style={s.eyebrow}>ADMINISTRARE</Text><Text style={s.title} numberOfLines={2}>Program săptămânal</Text></View></View>
      <Text style={s.shortSubtitle}>Planifică și asignează activități</Text>
      <View style={s.toolbar}><TouchableOpacity accessibilityLabel="Adaugă activitate" style={s.addButton} onPress={openNew}><Ionicons name="add" size={20} color="white" /><Text style={s.addText}>Adaugă</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Revenire la săptămâna curentă și actualizare" style={s.returnWeekButton} onPress={() => {setSelectedDay(null);if(offset!==0)setOffset(0);else void refresh();}}><Ionicons name="refresh" size={17} color={RED}/><Text style={s.returnWeekText}>Săptămâna curentă</Text></TouchableOpacity></View>
      <View style={s.weekBar}><TouchableOpacity accessibilityLabel="Săptămâna precedentă" style={s.arrow} onPress={() => {setOffset(v => v - 1);setSelectedDay(null);}}><Ionicons name="chevron-back" size={21} color={RED} /></TouchableOpacity><View style={{ alignItems: 'center', flex: 1 }}><Text style={s.weekTitle}>{base.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })} – {new Date(base.getFullYear(), base.getMonth(), base.getDate() + 6).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}</Text><Text style={s.weekHint}>{offset === 0 ? 'Săptămâna curentă' : offset > 0 ? `Peste ${offset} săptămâni` : `Cu ${-offset} săptămâni în urmă`}</Text></View><TouchableOpacity accessibilityLabel="Săptămâna următoare" style={s.arrow} onPress={() => {setOffset(v => v + 1);setSelectedDay(null);}}><Ionicons name="chevron-forward" size={21} color={RED} /></TouchableOpacity></View>
      
      <View style={s.calendarStrip}>{days.map((day,i) => { const active = selectedDay === i; const today = day.date.toDateString() === new Date().toDateString(); return <TouchableOpacity key={i} accessibilityLabel={`${day.date.toLocaleDateString('ro-RO', {weekday:'long',day:'numeric',month:'long'})}, ${day.activities.length} activități`} onPress={() => setSelectedDay(v => v === i ? null : i)} style={[s.calendarDay,active && s.calendarDayActive,today && !active && s.calendarDayToday]}><Text style={[s.calendarDayLabel,active && s.calendarDayLabelActive]}>{['Lu','Ma','Mi','Jo','Vi','Sâ','Du'][i]}</Text><Text style={[s.calendarDayNumber,active && s.calendarDayNumberActive]}>{day.date.getDate()}</Text><View style={[s.calendarDot,day.activities.length>0 && s.calendarDotBusy,active && s.calendarDotActive]}/></TouchableOpacity>; })}</View>
      <View style={s.statsRow}><View style={s.statBox}><Text style={s.statValue}>{items.length}</Text><Text style={s.statLabel}>Activități</Text></View><View style={s.statBox}><Text style={s.statValue}>{occupied}</Text><Text style={s.statLabel}>Zile ocupate</Text></View><View style={s.statBox}><Text style={s.statValue}>{7-occupied}</Text><Text style={s.statLabel}>Zile libere</Text></View></View>
      <View style={s.listHeading}><View><Text style={s.listTitle}>{selectedDay === null ? 'Activitățile săptămânii' : days[selectedDay].date.toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})}</Text><Text style={s.listHint}>{selectedDay === null ? 'Selectează o zi pentru filtrare' : 'Apasă din nou pe zi pentru a vedea toate activitățile'}</Text></View>{selectedDay !== null && <TouchableOpacity onPress={() => setSelectedDay(null)} style={s.clearDay}><Text style={s.clearDayText}>Toate</Text></TouchableOpacity>}</View>
    </View>
    <ScrollView style={s.listScroll} contentContainerStyle={[s.listContent,isDesktop && s.desktopList]} keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator color={RED} size="large" style={{marginTop:30}} /> : error ? <View style={s.card}><Text style={{ color: RED }}>{error}</Text><TouchableOpacity onPress={() => void refresh()}><Text style={s.action}>Reîncearcă</Text></TouchableOpacity></View> : displayed.length === 0 ? <View style={s.emptyCard}><Ionicons name="calendar-outline" size={35} color={RED}/><Text style={s.emptyTitle}>Nicio activitate programată</Text><Text style={s.emptyDescription}>Alege o altă zi sau adaugă prima activitate.</Text><TouchableOpacity style={s.addButton} onPress={openNew}><Ionicons name="add" size={19} color="white"/><Text style={s.addText}>Adaugă activitate</Text></TouchableOpacity></View> : displayed.map(a => <View key={a.id} style={[s.activityCard,isDesktop && s.activityCardDesktop]}><View style={s.activityDateLine}><Ionicons name="calendar-outline" size={15} color={RED}/><Text style={s.activityDateText}>{new Date(a.starts_at).toLocaleDateString('ro-RO',{weekday:'long',day:'numeric',month:'long'})}</Text></View><Text style={s.activityTitle}>{a.title}</Text><View style={s.metaRow}><Ionicons name="time-outline" size={15} color={RED} /><Text style={s.time}>{timeLabel(a.starts_at)}{a.ends_at ? ` – ${timeLabel(a.ends_at)}` : ''}</Text></View><View style={s.metaRow}><Ionicons name="people-outline" size={15} color="#7B808A" /><Text style={s.assignees}>{(assignments[a.id] ?? []).map(id => people.find(p => p.id === id)?.label ?? id).join(', ') || 'Fără persoane'}</Text></View>{!!a.description && <Text style={s.description}>{a.description}</Text>}<View style={s.actions}><TouchableOpacity style={s.edit} onPress={() => openEdit(a)}><Ionicons name="create-outline" size={16} color={RED} /><Text style={s.action}>Editează</Text></TouchableOpacity><TouchableOpacity style={s.delete} onPress={() => remove(a.id)}><Ionicons name="trash-outline" size={16} color="#A64040" /><Text style={[s.action, { color: '#A64040' }]}>Șterge</Text></TouchableOpacity></View></View>)}
    </ScrollView>
    <Modal visible={modal} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent={false} navigationBarTranslucent={false} onRequestClose={() => !busy && setModal(false)}>
      <SafeAreaProvider><StatusBar barStyle="dark-content" translucent={false} backgroundColor="#FFFFFF" /><SafeAreaView style={s.screen} edges={['top', 'bottom']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalHeader}><TouchableOpacity style={s.close} disabled={busy} onPress={() => setModal(false)}><Ionicons name="close" size={23} color={INK} /></TouchableOpacity><View style={{ flex: 1 }}><Text style={s.eyebrow}>PROGRAM SĂPTĂMÂNAL</Text><Text style={s.modalTitle}>{editing ? 'Editează activitatea' : 'Activitate nouă'}</Text></View></View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={s.form}>
          <Text style={s.fieldLabel}>Titlul activității</Text><TextInput style={[s.field, fieldErrors.title && s.fieldInvalid]} value={title} onChangeText={updateField('title', setTitle)} placeholder="Ex. Fotografiere eveniment" placeholderTextColor="#A0A0A0" />{fieldErrors.title ? <Text style={s.validationText}>{fieldErrors.title}</Text> : null}
          <Text style={s.fieldLabel}>Descriere (opțional)</Text><TextInput style={[s.field, { minHeight: 78, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} multiline placeholder="Detalii pentru persoanele asignate" placeholderTextColor="#A0A0A0" />
          {dateFields('Început', 'start', startDate, setStartDate, startHour, setStartHour, startMinute, setStartMinute)}
          {dateFields('Final', 'end', endDate, setEndDate, endHour, setEndHour, endMinute, setEndMinute)}
          <View style={s.dateGroup}><Text style={s.fieldLabel}>Persoane asignate ({selected.length})</Text><TouchableOpacity style={[s.picker, fieldErrors.people && s.fieldInvalid]} onPress={() => setPeopleOpen(v => !v)}><Ionicons name="people-outline" size={20} color={RED} /><Text style={{ flex: 1, color: INK, fontWeight: '700' }}>{selected.length ? `${selected.length} persoane selectate` : 'Alege persoanele'}</Text><Ionicons name={peopleOpen ? 'chevron-up' : 'chevron-down'} size={20} color={RED} /></TouchableOpacity>
            {fieldErrors.people ? <Text style={s.validationText}>{fieldErrors.people}</Text> : null}
            {selected.length > 0 && <View style={s.selectedPeople}>{selected.map(id => { const p = people.find(item => item.id === id); return <View key={id} style={s.selectedChip}>{p?.avatar_url ? <Image source={{ uri: p.avatar_url }} style={s.chipAvatar} /> : <Ionicons name="person-circle-outline" size={20} color={RED} />}<Text style={s.selectedChipText} numberOfLines={1}>{p?.label ?? id}</Text></View>; })}</View>}
            {peopleOpen && <View style={s.peoplePanel}>
              <View style={s.searchRow}><Ionicons name="search" size={18} color="#888" /><TextInput style={{ flex: 1, color: INK, paddingVertical: 8 }} placeholder="Caută nume, nickname sau e-mail..." value={search} onChangeText={setSearch} autoCapitalize="none" /></View>
              <Text style={s.peopleCount}>{filteredPeople.length} persoane găsite</Text>
              {filteredPeople.map(p => <TouchableOpacity key={p.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(p.id) }} style={s.personRow} onPress={() => updateSelected(v => v.includes(p.id) ? v.filter(x => x !== p.id) : [...v, p.id])}>
                {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={s.personAvatar} /> : <View style={s.personAvatarFallback}><Ionicons name="person-outline" size={22} color={RED} /></View>}
                <View style={s.personDetails}><Text style={s.personName} numberOfLines={1}>{p.label}</Text>{!!p.nickname && <Text style={s.personSecondary} numberOfLines={1}>@{p.nickname.replace(/^@/, '')}</Text>}{!!p.email && <Text style={s.personSecondary} numberOfLines={1}>{p.email}</Text>}</View>
                <Ionicons name={selected.includes(p.id) ? 'checkbox' : 'square-outline'} size={25} color={RED} />
              </TouchableOpacity>)}
              {filteredPeople.length === 0 && <Text style={s.empty}>Nu am găsit persoane.</Text>}
            </View>}
          </View>
          <TouchableOpacity disabled={busy} style={[s.save, busy && { opacity: 0.6 }]} onPress={() => void save()}>{busy ? <ActivityIndicator color="white" /> : <><Ionicons name="checkmark-circle-outline" size={20} color="white" /><Text style={s.saveText}>Salvează activitatea</Text></>}</TouchableOpacity>
          <TouchableOpacity disabled={busy} style={s.cancel} onPress={() => setModal(false)}><Text style={s.cancelText}>Anulează</Text></TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView></SafeAreaView></SafeAreaProvider>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  fixedTop: { paddingHorizontal: 16, paddingTop: 9, gap: 10, ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}) },
  topActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, shortSubtitle: { color: '#777D86', fontSize: 13, lineHeight: 20, alignSelf: 'flex-start', marginTop: 2, marginBottom: 4 },
  calendarStrip: { flexDirection: 'row', gap: 5, paddingVertical: 2 }, calendarDay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 9, gap: 5, borderWidth: 1, borderColor: '#EDEBE8' }, calendarDayActive: { backgroundColor: RED, borderColor: RED }, calendarDayToday: { borderColor: RED }, calendarDayLabel: { color: '#8B8D93', fontSize: 10, fontWeight: '700' }, calendarDayLabelActive: { color: '#FFE6E6' }, calendarDayNumber: { color: INK, fontSize: 15, fontWeight: '900' }, calendarDayNumberActive: { color: 'white' }, calendarDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#E4E4E4' }, calendarDotBusy: { backgroundColor: RED }, calendarDotActive: { backgroundColor: '#FFFFFF' },
  statsRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' }, statBox: { flex: 1, minWidth: 0, backgroundColor: 'white', borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EEECE8' }, statValue: { fontSize: 20, fontWeight: '900', color: INK }, statLabel: { fontSize: 10, color: '#7D8087', marginTop: 2, flexWrap: 'wrap' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 4 }, listTitle: { fontSize: 17, fontWeight: '900', color: INK, textTransform: 'capitalize' }, listHint: { fontSize: 10, color: '#898B92', marginTop: 3 }, clearDay: { padding: 9, borderRadius: 10, backgroundColor: '#FFF0F0' }, clearDayText: { color: RED, fontWeight: '800', fontSize: 11 },
  listScroll: { flex: 1 }, listContent: { padding: 16, paddingTop: 5, paddingBottom: 45, gap: 10, ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}) }, desktopList: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  activityCard: { backgroundColor: 'white', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#EEECE8', gap: 9 }, activityCardDesktop: { width: '48.5%' }, activityDateLine: { flexDirection: 'row', gap: 6, alignItems: 'center' }, activityDateText: { color: RED, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  emptyCard: { backgroundColor: 'white', borderRadius: 18, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 220 }, emptyTitle: { color: INK, fontSize: 17, fontWeight: '900', textAlign: 'center' }, emptyDescription: { color: '#85858C', fontSize: 12, textAlign: 'center' },
  fieldInvalid: { borderColor: '#C62828', borderWidth: 1.5, backgroundColor: '#FFF5F5' }, validationText: { color: '#B4232C', fontSize: 12, fontWeight: '700', marginTop: 3 },
  screen: { flex: 1, backgroundColor: BG }, content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}), padding: 16, paddingBottom: 60, gap: 13 }, back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 }, backText: { color: RED, fontWeight: '800' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3, marginBottom: 2 }, headerBack: { width:44, height:44, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }, headingTitle: { flex: 1, minWidth: 0 }, eyebrow: { fontSize: 10, fontWeight: '900', color: RED, letterSpacing: 1.1, marginBottom: 5 }, title: { fontSize: 27, fontWeight: '900', color: INK, lineHeight: 30 }, subtitle: { color: '#777D86', lineHeight: 20, fontSize: 13 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }, returnWeekButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF2F2', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, flexShrink: 1 }, returnWeekText: { color: RED, fontWeight: '800', fontSize: 12, flexShrink: 1 }, addButton: { backgroundColor: RED, borderRadius: 14, minHeight: 46, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, addText: { color: 'white', fontWeight: '900', fontSize: 12 }, refreshIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF2F2' },
  todayButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 4, backgroundColor: '#FFF0F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 6 }, todayText: { color: RED, fontWeight: '800', fontSize: 11 },
  weekBar: { backgroundColor: 'white', borderRadius: 17, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, borderWidth: 1, borderColor: '#EEECE8' }, arrow: { backgroundColor: '#FFF2F2', borderRadius: 12, padding: 9 }, weekTitle: { fontWeight: '900', color: INK, fontSize: 14 }, weekHint: { color: '#8B8D93', fontSize: 11, marginTop: 3 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, gap: 10 }, dayCard: { backgroundColor: 'white', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#EEECE8', gap: 10 }, dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 }, dayNumber: { width: 45, height: 45, borderRadius: 13, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' }, dayNumberText: { color: RED, fontWeight: '900', fontSize: 18 }, dayName: { fontSize: 16, fontWeight: '900', color: INK, textTransform: 'capitalize' }, dayMeta: { fontSize: 12, color: '#85858C', marginTop: 2 }, count: { fontSize: 11, color: '#8B8D93', fontWeight: '700' }, empty: { color: '#9A9CA2', fontSize: 13, paddingVertical: 8 },
  activity: { borderTopWidth: 1, borderColor: '#F0F0F0', paddingTop: 12, gap: 7 }, activityTitle: { color: INK, fontWeight: '900', fontSize: 15 }, metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 }, time: { color: RED, fontWeight: '800', fontSize: 13 }, assignees: { color: '#6C727B', fontSize: 12, flex: 1 }, description: { color: '#747984', fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', gap: 9, marginTop: 5 }, edit: { backgroundColor: '#FFF0F0', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 5 }, delete: { backgroundColor: '#FFF4F4', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 5 }, action: { color: RED, fontWeight: '800', fontSize: 12 },
  selectedPeople: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#FBEDEE', borderRadius: 20, maxWidth: 210 }, chipAvatar: { width: 20, height: 20, borderRadius: 10 }, selectedChipText: { fontSize: 12, fontWeight: '700', color: RED, flexShrink: 1 }, personAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F7EAEA' }, personAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FBEDEE', alignItems: 'center', justifyContent: 'center' }, personDetails: { flex: 1, gap: 2, minWidth: 0 }, personName: { fontSize: 15, fontWeight: '700', color: INK }, personSecondary: { fontSize: 12, color: '#81848B' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#EEE' }, close: { backgroundColor: '#F3F3F3', borderRadius: 12, padding: 9 }, modalTitle: { fontSize: 22, fontWeight: '900', color: INK }, form: { padding: 18, paddingBottom: 65, gap: 13 }, fieldLabel: { fontSize: 13, fontWeight: '900', color: INK }, field: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E7E6E3', paddingHorizontal: 12, paddingVertical: 13, fontSize: 15, color: INK }, dateGroup: { gap: 9, marginTop: 4 }, dateRow: { flexDirection: 'row', gap: 8 }, inputHint: { fontSize: 10, color: '#82868E', marginBottom: 5, fontWeight: '700' }, center: { textAlign: 'center', paddingHorizontal: 4 }, picker: { backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#E7E6E3', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, selectedNames: { color: '#737780', fontSize: 12, lineHeight: 19 }, peoplePanel: { backgroundColor: 'white', borderRadius: 13, borderWidth: 1, borderColor: '#E7E6E3', padding: 12, gap: 5 }, searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, backgroundColor: BG, paddingHorizontal: 10 }, peopleCount: { fontSize: 11, color: '#888', marginVertical: 6 }, personRow: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F1F1', flexDirection: 'row', alignItems: 'center', gap: 10 }, save: { backgroundColor: RED, borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginTop: 9 }, saveText: { color: 'white', fontWeight: '900', fontSize: 15 }, cancel: { padding: 12, alignItems: 'center' }, cancelText: { color: '#777', fontWeight: '800' },
});
