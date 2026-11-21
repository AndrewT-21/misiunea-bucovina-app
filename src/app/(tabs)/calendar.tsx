import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator,  Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const INK = '#1D1D1F';
const MUTED = '#77716E';
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

type PrayerEvent = { id: string; title: string; description: string; event_type: 'prayer' | 'fasting_prayer'; category: string; event_date: string; bible_verse: string | null; related_id: string | null };

type Activity = { id: string; title: string; description: string | null; location: string; starts_at: string; ends_at: string | null; max_volunteers: number | null };

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = new Date();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [prayerEvents, setPrayerEvents] = useState<PrayerEvent[]>([]);
  const [prayerError, setPrayerError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [registrations, setRegistrations] = useState<Record<string, { status: string; admin_message: string | null }>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Record<string, { confirmed: number; pending: number }>>({});

  function notify(title: string, message: string) {
    if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert(`${title}\n${message}`); }
    else Alert.alert(title, message);
  }

  async function loadRegistrationState() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCurrentUserId(null);
      setIsVolunteer(false);
      setRegistrations({});
      return;
    }
    setCurrentUserId(user.id);
    const { data: admin, error: adminError } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (adminError) { setIsVolunteer(false); return; }
    if (admin) { setIsVolunteer(false); setRegistrations({}); return; }
    const { data: volunteer, error: volunteerError } = await supabase.from('volunteer_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
    if (volunteerError || !volunteer) { setIsVolunteer(false); setRegistrations({}); return; }
    setIsVolunteer(true);
    const { data, error } = await supabase.from('activity_registrations')
      .select('activity_id,status,admin_message').eq('volunteer_id', user.id);
    if (error) { console.log('Eroare înscrieri:', error.message); return; }
    const map: Record<string, { status: string; admin_message: string | null }> = {};
    (data ?? []).forEach((item) => { map[item.activity_id] = { status: item.status, admin_message: item.admin_message }; });
    setRegistrations(map);
  }

  async function loadAvailability() {
    const { data, error } = await supabase.rpc('calendar_activity_availability');
    if (error) { console.log('Eroare locuri disponibile:', error.message); return; }
    const next: Record<string, { confirmed: number; pending: number }> = {};
    for (const row of data ?? []) next[row.activity_id] = { confirmed: Number(row.confirmed_count), pending: Number(row.pending_count) };
    setAvailability(next);
  }

  async function registerForActivity(activity: Activity) {
    if (submittingId) return;
    if (!currentUserId) { router.push('/voluntar/login'); return; }
    if (!isVolunteer) { notify('Cont de voluntar necesar', 'Pentru înscriere trebuie să fii conectat cu un cont de voluntar.'); return; }
    if (registrations[activity.id]) return;
    if (activity.max_volunteers !== null && activity.max_volunteers - (availability[activity.id]?.confirmed ?? 0) <= 0) {
      notify('Locuri epuizate', 'Nu mai există locuri disponibile pentru această activitate.'); return;
    }
    if (new Date(activity.starts_at).getTime() <= Date.now()) {
      notify('Înscriere indisponibilă', 'Această activitate a început deja.'); return;
    }
    setSubmittingId(activity.id);
    try {
      const { error } = await supabase.from('activity_registrations').insert({
        activity_id: activity.id, volunteer_id: currentUserId, status: 'pending',
      });
      if (error) {
        if (error.code === '23505') {
          await loadRegistrationState();
          notify('Înscriere existentă', 'Ai trimis deja o solicitare pentru această activitate.');
        } else throw error;
      } else {
        setRegistrations(prev => ({ ...prev, [activity.id]: { status: 'pending', admin_message: null } }));
        await loadAvailability();
        notify('Solicitare trimisă', 'Înscrierea ta este în așteptarea aprobării administratorului.');
      }
    } catch (e: any) {
      notify('Nu s-a putut trimite înscrierea', e?.message ?? 'Încearcă din nou.');
    } finally { setSubmittingId(null); }
  }

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await supabase
        .from('activities')
        .select('id,title,description,location,starts_at,ends_at,max_volunteers')
        .eq('is_published', true)
        .order('starts_at', { ascending: true });
      if (!active) return;
      if (fetchError) setError(fetchError.message);
      else setActivities((data ?? []) as Activity[]);
      setLoading(false);
    }
    load();
    loadRegistrationState();
    loadAvailability();
    return () => { active = false; };
  }, []));

  const selectedPrayerEvents = useMemo(() => prayerEvents.filter(p => {
    const [year, month, day] = p.event_date.split('-').map(Number);
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month - 1 && selectedDate.getDate() === day;
  }), [prayerEvents, selectedDate]);
  const prayerDays = useMemo(() => new Set(prayerEvents.filter(p => {
    const [year, month] = p.event_date.split('-').map(Number);
    return visibleMonth.getFullYear() === year && visibleMonth.getMonth() === month - 1;
  }).map(p => Number(p.event_date.slice(8, 10)))), [prayerEvents, visibleMonth]);

  const selectedActivities = useMemo(() => activities.filter(a => sameDay(new Date(a.starts_at), selectedDate)), [activities, selectedDate]);
  const activityDays = useMemo(() => new Set(activities.filter(a => {
    const d = new Date(a.starts_at);
    return d.getFullYear() === visibleMonth.getFullYear() && d.getMonth() === visibleMonth.getMonth();
  }).map(a => new Date(a.starts_at).getDate())), [activities, visibleMonth]);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= count; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleMonth]);

  function changeMonth(offset: number) {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(next);
    setSelectedDate(next);
  }

  function jumpToToday() {
    const now = new Date();
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  }

  const dateLabel = `${selectedDate.getDate()} ${MONTHS[selectedDate.getMonth()].toLowerCase()} ${selectedDate.getFullYear()}`;

  const isDesktop = Platform.OS === 'web';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View pointerEvents="none" style={styles.decorations}>
        <View style={[styles.circle, styles.circleTop]} />
        <View style={[styles.circle, styles.circleLeft]} />
        <View style={[styles.circle, styles.circleBottom]} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.webDesktopContent]} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.headingIcon}>
            <Ionicons name="calendar-outline" size={25} color={RED} />
          </View>
          <View style={styles.headingText}>
            <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
            <Text style={styles.title}>Calendar activități</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Descoperă activitățile și alege ziua în care vrei să te implici.
        </Text>

        <View style={styles.calendarCard}>
          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.arrowButton} onPress={() => changeMonth(-1)} accessibilityLabel="Luna anterioară">
              <Ionicons name="chevron-back" size={21} color={INK} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</Text>
            <TouchableOpacity style={styles.arrowButton} onPress={() => changeMonth(1)} accessibilityLabel="Luna următoare">
              <Ionicons name="chevron-forward" size={21} color={INK} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map(day => <Text key={day} style={styles.weekday}>{day}</Text>)}
          </View>
          <View style={styles.daysGrid}>
            {days.map((day, index) => {
              if (day === null) return <View key={`empty-${index}`} style={styles.dayCell} />;
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
              const selected = sameDay(date, selectedDate);
              const isToday = sameDay(date, today);
              const hasActivity = activityDays.has(day);
              const hasPrayer = prayerDays.has(day);
              return (
                <View key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${day}`} style={styles.dayCell}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`${day} ${MONTHS[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`}
                    accessibilityState={{ selected }}
                    style={[styles.dayButton, selected && styles.selectedDay, isToday && !selected && styles.todayDay]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text style={[styles.dayText, selected && styles.selectedDayText, isToday && !selected && styles.todayText]}>{day}</Text>
                    {isToday && <View style={[styles.todayDot, selected && styles.todayDotSelected]} />}
                    {hasActivity && <View style={[styles.activityDot, selected && styles.todayDotSelected]} />}
                    {hasPrayer && <View style={[styles.prayerDot, selected && styles.todayDotSelected]} />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
          <TouchableOpacity style={styles.todayLink} onPress={jumpToToday}>
            <Ionicons name="locate-outline" size={15} color={RED} />
            <Text style={styles.todayLinkText}>Mergi la ziua de azi</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/rugaciune/propune' as any)} style={{backgroundColor:'#FCE8E5',borderRadius:13,padding:13,marginTop:12,marginBottom:10,alignItems:'center'}}><Text style={{color:RED,fontWeight:'800'}}>＋ Propune o zi de post sau rugăciune</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/activitati/propune' as any)} style={{backgroundColor:'#FCE8E5',borderRadius:13,padding:13,marginBottom:10,alignItems:'center'}}><Text style={{color:RED,fontWeight:'800'}}>＋ Propune o activitate</Text></TouchableOpacity>
        <View style={styles.prayerLegend}>
          <View style={styles.legendItem}><View style={styles.legendActivityDot}/><Text style={styles.legendText}>Activități</Text></View>
          <View style={styles.legendItem}><View style={styles.legendPrayerDot}/><Text style={styles.legendText}>Post și rugăciune / Rugăciune</Text></View>
        </View>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Post și Rugăciune</Text>
            <Text style={styles.sectionDate}>{dateLabel}</Text>
          </View>
          <View style={styles.dateBadge}><Ionicons name="heart-outline" size={18} color={RED}/></View>
        </View>
        {!!prayerError && <Text style={styles.prayerError}>Nu s-au putut încărca zilele de rugăciune: {prayerError}</Text>}
        {!loading && !prayerError && selectedPrayerEvents.length === 0 && (
          <View style={styles.emptyCard}><Text style={styles.emptyDescription}>Nu există zile de post sau rugăciune publicate pentru această dată.</Text></View>
        )}
        {selectedPrayerEvents.map(event => (
          <TouchableOpacity key={event.id} style={styles.prayerCard} activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/rugaciune/[id]' as any, params: { id: event.id } })}>
            <View style={styles.activityRow}>
              <View style={styles.prayerIcon}><Ionicons name={event.event_type === 'fasting_prayer' ? 'sunny-outline' : 'heart-outline'} size={22} color={RED}/></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>{event.title}</Text>
                <Text style={styles.activityMeta}>{event.event_type === 'fasting_prayer' ? 'Zi de post și rugăciune' : 'Zi de rugăciune'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={RED}/>
            </View>
            <Text style={styles.prayerExcerpt} numberOfLines={2}>{event.description}</Text>
            <Text style={styles.prayerLink}>Vezi motivele de rugăciune  →</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Activități programate</Text>
            <Text style={styles.sectionDate}>{dateLabel}</Text>
          </View>
          <View style={styles.dateBadge}><Ionicons name="calendar-clear-outline" size={18} color={RED} /></View>
        </View>
        {loading ? (
          <View style={styles.emptyCard}><ActivityIndicator size="small" color={RED} /><Text style={styles.emptyDescription}>Se încarcă activitățile...</Text></View>
        ) : error ? (
          <View style={styles.emptyCard}><Ionicons name="alert-circle-outline" size={30} color={RED}/><Text style={styles.emptyTitle}>Nu am putut încărca activitățile</Text><Text style={styles.emptyDescription}>{error}</Text></View>
        ) : selectedActivities.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Ionicons name="calendar-clear-outline" size={28} color={RED} /></View>
            <Text style={styles.emptyTitle}>Nicio activitate programată</Text>
            <Text style={styles.emptyDescription}>Nu există activități publicate pentru această zi. Selectează o zi marcată cu un punct vișiniu.</Text>
          </View>
        ) : selectedActivities.map(a => {
          const expanded = expandedId === a.id;
          const confirmedCount = availability[a.id]?.confirmed ?? 0;
          const pendingCount = availability[a.id]?.pending ?? 0;
          const remaining = a.max_volunteers === null ? null : Math.max(0, a.max_volunteers - confirmedCount);
          const full = remaining !== null && remaining <= 0;
          const start = new Date(a.starts_at);
          const end = a.ends_at ? new Date(a.ends_at) : null;
          const fmt = (d: Date) => d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
          return (
            <View key={a.id} style={styles.activityCard}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setExpandedId(expanded ? null : a.id)} accessibilityRole="button">
              <View style={styles.activityRow}>
                <View style={styles.activityIcon}><Ionicons name="heart-outline" size={23} color={RED}/></View>
                <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{a.title}</Text><Text style={styles.activityMeta}><Ionicons name="time-outline" size={13}/> {fmt(start)}{end ? ` – ${fmt(end)}` : ''}</Text></View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={RED}/>
              </View>
              <Text style={styles.activityLocation}><Ionicons name="location-outline" size={15} color={RED}/> {a.location}</Text>
              </TouchableOpacity>
              {expanded && <View style={styles.activityDetails}>
                <TouchableOpacity onPress={() => router.push({ pathname: '/activitati/[id]' as any, params: { id: a.id } })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 8 }} accessibilityRole="button">
                  <Text style={{ color: RED, fontWeight: '800', fontSize: 14 }}>Vezi detaliile activității</Text>
                  <Ionicons name="arrow-forward" size={18} color={RED}/>
                </TouchableOpacity>
                {!!a.description && <Text style={styles.activityDescription}>{a.description}</Text>}
                {a.max_volunteers != null ? (
                  <View style={styles.capacityBox}>
                    <Text style={styles.capacityNumber}>{remaining} din {a.max_volunteers} locuri disponibile</Text>
                    <Text style={styles.capacityNote}>{confirmedCount} confirmate · {pendingCount} în așteptare</Text>
                  </View>
                ) : <Text style={styles.activityMeta}>Locuri nelimitate · {confirmedCount} confirmate</Text>}
                {registrations[a.id] ? (
                  <View style={styles.registrationInfo}>
                    <Ionicons name={registrations[a.id].status === 'confirmed' ? 'checkmark-circle' : registrations[a.id].status === 'rejected' ? 'close-circle' : 'time-outline'} size={19} color={RED}/>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.registrationText}>{registrations[a.id].status === 'confirmed' ? 'Participare confirmată' : registrations[a.id].status === 'rejected' ? 'Înscriere respinsă' : 'În așteptarea aprobării'}</Text>
                      {!!registrations[a.id].admin_message && <Text style={styles.registrationMessage}>{registrations[a.id].admin_message}</Text>}
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.registerButton, (submittingId === a.id || full || new Date(a.starts_at).getTime() <= Date.now()) && styles.registerButtonDisabled]} disabled={submittingId !== null || full || new Date(a.starts_at).getTime() <= Date.now()} onPress={() => registerForActivity(a)} activeOpacity={0.8}>
                    {submittingId === a.id ? <ActivityIndicator color="#FFFFFF"/> : <Ionicons name="hand-left-outline" size={18} color="#FFFFFF"/>}
                    <Text style={styles.registerButtonText}>{new Date(a.starts_at).getTime() <= Date.now() ? 'Înscrieri închise' : full ? 'Locuri epuizate' : currentUserId && isVolunteer ? 'Înscrie-te la activitate' : 'Autentifică-te pentru înscriere'}</Text>
                  </TouchableOpacity>
                )}
              </View>}
            </View>
          );
        })}
        <Text style={styles.footer}>Împreună pentru oameni  ♥</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  prayerDot: { position: 'absolute', bottom: 2, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: '#D5A133' },
  prayerLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12, marginBottom: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { color: MUTED, fontSize: 11 },
  legendActivityDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: RED },
  legendPrayerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D5A133' },
  prayerCard: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#EBDDD1', padding: 16, marginBottom: 12 },
  prayerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF2E3', alignItems: 'center', justifyContent: 'center' },
  prayerExcerpt: { color: MUTED, fontSize: 13, lineHeight: 20, marginTop: 10 },
  prayerLink: { color: RED, fontSize: 12, fontWeight: '800', marginTop: 12 },
  prayerError: { color: RED, fontSize: 12, marginBottom: 12 },
  capacityBox: { marginTop: 12, padding: 12, backgroundColor: '#FFF4F1', borderRadius: 12 },
  capacityNumber: { color: RED, fontWeight: '900', fontSize: 13 },
  capacityNote: { color: MUTED, fontSize: 11, marginTop: 4 },
  screen: { flex: 1, backgroundColor: '#FAF6F2' },
  decorations: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: '#F4DCD9' },
  circleTop: { width: 250, height: 250, top: -125, right: -110, opacity: 0.8 },
  circleLeft: { width: 175, height: 175, top: 340, left: -135, opacity: 0.6 },
  circleBottom: { width: 240, height: 240, bottom: -130, right: -145, opacity: 0.65 },
  content: { paddingHorizontal: 20, paddingTop: 23, paddingBottom: 44 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  headingIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#FCE8E5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F4D8D4' },
  headingText: { flex: 1 },
  eyebrow: { color: RED, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: INK, fontSize: 25, fontWeight: '900', marginTop: 4, letterSpacing: -0.4 },
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 20, marginTop: 15, marginBottom: 23 },
  calendarCard: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 13, paddingTop: 17, paddingBottom: 17, borderWidth: 1, borderColor: '#F0E5E1', shadowColor: '#5B3531', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  monthTitle: { color: INK, fontSize: 17, fontWeight: '900' },
  arrowButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F9F4F1', alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: { width: '14.2857%', textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#9B908C' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', height: 43, justifyContent: 'center', alignItems: 'center' },
  dayButton: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  selectedDay: { backgroundColor: RED },
  todayDot: { position: 'absolute', bottom: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: RED },
  activityDot: { position: 'absolute', bottom: 2, right: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: RED },
  todayDotSelected: { backgroundColor: '#FFFFFF' },
  todayDay: { backgroundColor: '#FBE8E5', borderWidth: 1, borderColor: '#E4AAA5' },
  dayText: { fontSize: 13, color: INK, fontWeight: '600' },
  selectedDayText: { color: '#FFFFFF', fontWeight: '900' },
  todayText: { color: RED, fontWeight: '900' },
  todayLink: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingTop: 14, paddingHorizontal: 12 },
  todayLinkText: { color: RED, fontSize: 12, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 29, marginBottom: 13 },
  sectionTitle: { color: INK, fontSize: 18, fontWeight: '900' },
  sectionDate: { color: MUTED, fontSize: 12, marginTop: 5 },
  dateBadge: { width: 40, height: 40, backgroundColor: '#FCE8E5', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#F0E5E1', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 27 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#FBEAE7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: INK, fontSize: 15, fontWeight: '900', textAlign: 'center' },
  emptyDescription: { color: MUTED, fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 9 },
  activityCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#F0E5E1', padding: 17, marginBottom: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activityIcon: { width: 47, height: 47, borderRadius: 15, backgroundColor: '#FCE8E5', alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 16, fontWeight: '900', color: INK },
  activityMeta: { fontSize: 12, color: MUTED, marginTop: 5 },
  activityLocation: { fontSize: 13, color: '#625B58', marginTop: 14 },
  activityDetails: { borderTopWidth: 1, borderTopColor: '#F0E5E1', paddingTop: 13, marginTop: 13 },
  activityDescription: { fontSize: 13, lineHeight: 20, color: INK },
  activityHint: { fontSize: 12, lineHeight: 18, color: RED, marginTop: 12 },
  registrationInfo: { marginTop: 14, padding: 13, borderRadius: 13, backgroundColor: '#FCE8E5', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  registrationText: { color: RED, fontSize: 13, fontWeight: '800' },
  registrationMessage: { color: INK, fontSize: 12, lineHeight: 19, marginTop: 5 },
  registerButton: { backgroundColor: RED, borderRadius: 13, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 15, paddingHorizontal: 12 },
  registerButtonDisabled: { opacity: 0.55 },
  registerButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  footer: { color: '#9B817C', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 29 },
  webDesktopContent: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 56 },
});
