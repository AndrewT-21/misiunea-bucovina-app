import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BG = '#F6F6F6';

type Kind = 'money' | 'volunteer' | 'goods' | 'other';
type Entry = {
  id: string;
  kind: Kind;
  title: string;
  date: string;
  amount?: number;
  currency?: string;
  hours?: number;
  quantity?: string;
  relatedTo?: string;
  notes?: string;
  createdAt: string;
};
const kinds: { id: Kind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'money', label: 'Donație financiară', icon: 'wallet-outline' },
  { id: 'volunteer', label: 'Voluntariat', icon: 'hand-left-outline' },
  { id: 'goods', label: 'Donație materială', icon: 'gift-outline' },
  { id: 'other', label: 'Altă contribuție', icon: 'heart-outline' },
];
const today = () => new Date().toISOString().slice(0, 10);
const initialForm = () => ({
  kind: 'money' as Kind, title: '', date: today(), amount: '', currency: 'RON',
  hours: '', quantity: '', relatedTo: '', notes: '',
});
type FormState = ReturnType<typeof initialForm>;

export default function ImplicareaMeaScreen() {
  const insets = useSafeAreaInsets();
  const { sourceType, sourceId, sourceTitle, add } = useLocalSearchParams<{
    sourceType?: string; sourceId?: string; sourceTitle?: string; add?: string;
  }>();
  const handledSource = useRef<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm());
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoaded(false);
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setEntries([]); return; }
      const { data: profile, error: profileError } = await supabase
        .from('volunteer_profiles').select('user_id').eq('user_id', uid).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) { setUserId(null); setEntries([]); return; }
      const { data, error } = await supabase.from('volunteer_contributions')
        .select('entry').eq('user_id', uid).order('created_at', { ascending: false });
      if (error) throw error;
      setEntries((data ?? []).map(row => row.entry as Entry));
    } catch (err: any) {
      setEntries([]);
      Alert.alert('Eroare', err?.message ?? 'Nu am putut încărca istoricul contribuțiilor.');
    } finally { setLoaded(true); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sorted = useMemo(() => [...entries].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [entries]);
  const totals = useMemo(() => {
    const amounts: Record<string, number> = {};
    let hours = 0;
    entries.forEach(e => {
      if (e.kind === 'money' && typeof e.amount === 'number') {
        const currency = e.currency || 'RON';
        amounts[currency] = (amounts[currency] || 0) + e.amount;
      }
      if (e.kind === 'volunteer') hours += e.hours || 0;
    });
    return { amounts, hours };
  }, [entries]);

  // Open a prefilled entry when arriving from a case/project detail page.
  useEffect(() => {
    if (add !== '1' || !sourceTitle || !sourceId) return;
    const key = `${sourceType || ''}:${sourceId}:${sourceTitle}`;
    if (handledSource.current === key) return;
    handledSource.current = key;
    setEditingId(null);
    setForm({ ...initialForm(), title: `Contribuție pentru ${sourceTitle}`,
      relatedTo: sourceTitle });
    setModalOpen(true);
  }, [add, sourceType, sourceId, sourceTitle]);

  function closeForm() {
    if (busy) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(initialForm());
  }
  function startNew() { if (!requireVolunteer()) return; setEditingId(null); setForm(initialForm()); setModalOpen(true); }
  function startEdit(entry: Entry) {
    if (!requireVolunteer()) return;
    setEditingId(entry.id);
    setForm({ kind: entry.kind, title: entry.title, date: entry.date,
      amount: entry.amount?.toString() || '', currency: entry.currency || 'RON',
      hours: entry.hours?.toString() || '', quantity: entry.quantity || '',
      relatedTo: entry.relatedTo || '', notes: entry.notes || '' });
    setModalOpen(true);
  }
  const update = (patch: Partial<FormState>) => setForm(old => ({ ...old, ...patch }));
  function requireVolunteer() {
    if (userId) return true;
    Alert.alert('Cont de voluntar necesar', 'Autentifică-te ca voluntar pentru a folosi Implicarea mea.', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Autentificare', onPress: () => router.push('/voluntar/login') },
    ]);
    return false;
  }
  async function save() {
    if (!requireVolunteer()) return;
    const title = form.title.trim();
    if (!title) { Alert.alert('Titlu necesar', 'Scrie ce ai făcut sau ce ai oferit.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) ||
      Number.isNaN(new Date(`${form.date}T12:00:00`).getTime()) ||
      new Date(`${form.date}T12:00:00`).toISOString().slice(0, 10) !== form.date) {
      Alert.alert('Dată invalidă', 'Folosește formatul AAAA-LL-ZZ (exemplu: 2026-10-16).'); return;
    }
    const amount = Number(form.amount.replace(',', '.'));
    const hours = Number(form.hours.replace(',', '.'));
    if (form.kind === 'money' && (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0)) {
      Alert.alert('Sumă invalidă', 'Introdu o sumă mai mare decât zero.'); return;
    }
    if (form.kind === 'volunteer' && form.hours.trim() && (!Number.isFinite(hours) || hours < 0)) {
      Alert.alert('Ore invalide', 'Introdu un număr de ore valid.'); return;
    }
    const old = entries.find(e => e.id === editingId);
    const entry: Entry = {
      id: old?.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: old?.createdAt || new Date().toISOString(),
      kind: form.kind, title, date: form.date,
      ...(form.kind === 'money' ? { amount, currency: form.currency } : {}),
      ...(form.kind === 'volunteer' && form.hours.trim() ? { hours } : {}),
      ...(form.kind === 'goods' && form.quantity.trim() ? { quantity: form.quantity.trim() } : {}),
      relatedTo: form.relatedTo.trim(), notes: form.notes.trim(),
    };
    setBusy(true);
    try {
      const { error } = await supabase.from('volunteer_contributions').upsert({
        user_id: userId!, id: entry.id, entry,
      }, { onConflict: 'user_id,id' });
      if (error) throw error;
      setEntries(old ? entries.map(e => e.id === old.id ? entry : e) : [entry, ...entries]);
      setModalOpen(false);
    } catch { Alert.alert('Eroare', 'Nu am putut salva contribuția. Încearcă din nou.'); }
    finally { setBusy(false); }
  }
  function remove(entry: Entry) {
    if (!requireVolunteer()) return;
    Alert.alert('Ștergi contribuția?', `„${entry.title}” va fi eliminată din contul tău.`, [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Șterge', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('volunteer_contributions')
            .delete().eq('user_id', userId!).eq('id', entry.id);
          if (error) throw error;
          setEntries(current => current.filter(e => e.id !== entry.id));
        }
        catch { Alert.alert('Eroare', 'Contribuția nu a putut fi ștearsă.'); }
      } },
    ]);
  }
  const number = (n: number) => n.toLocaleString('ro-RO', { maximumFractionDigits: 2 });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))} style={styles.back} accessibilityLabel="Înapoi" activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={24} color={DARK} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerLabel}>SPAȚIUL MEU</Text>
            <Text style={styles.title}>Implicarea mea</Text>
          </View>
        </View>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="heart" size={29} color="#FFFFFF" /></View>
          <Text style={styles.heroSmall}>AJUTÂND ÎN NUMELE LUI HRISTOS</Text>
          <Text style={styles.heroTitle}>Fiecare gest contează</Text>
          <Text style={styles.heroText}>Un jurnal personal al modurilor în care ai ales să ajuți. Păstrează aici contribuțiile și activitățile tale.</Text>
        </View>
        <Text style={styles.sectionLabel}>ACTIVITATEA MEA</Text>
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Ionicons name="heart-outline" size={23} color={RED} />
            <Text style={styles.statValue}>{entries.length}</Text>
            <Text style={styles.statCaption}>Contribuții înregistrate</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={23} color={RED} />
            <Text style={styles.statValue}>{number(totals.hours)}</Text>
            <Text style={styles.statCaption}>Ore de voluntariat</Text>
          </View>
        </View>
        {Object.keys(totals.amounts).length > 0 && (
          <View style={styles.totalCard}>
            <Text style={styles.totalTitle}>Donații financiare înregistrate</Text>
            {Object.entries(totals.amounts).map(([currency, value]) => (
              <Text key={currency} style={styles.totalValue}>{number(value)} {currency}</Text>
            ))}
            <Text style={styles.totalNote}>Sume declarate de tine, neverificate de organizație.</Text>
          </View>
        )}

        <View style={styles.warning}>
          <Ionicons name="information-circle-outline" size={22} color={RED} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Istoric asociat contului de voluntar</Text>
            <Text style={styles.warningText}>Contribuțiile sunt salvate în contul tău și pot fi accesate de pe alt dispozitiv. Sunt declarații personale, nu confirmări oficiale ale organizației.</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={startNew}>
          <Ionicons name="add-circle-outline" size={23} color="#FFFFFF" />
          <Text style={styles.addText}>Adaugă o contribuție</Text>
        </TouchableOpacity>
        <Text style={styles.sectionLabel}>ISTORICUL MEU</Text>
        {!loaded ? <Text style={styles.emptyText}>Se încarcă istoricul...</Text> : !userId ? (
          <View style={styles.empty}><Ionicons name="lock-closed-outline" size={36} color={RED} /><Text style={styles.emptyTitle}>Autentificare necesară</Text><Text style={styles.emptyText}>Conectează-te la contul de voluntar pentru a vedea implicarea ta.</Text><TouchableOpacity style={[styles.addButton, { alignSelf: 'stretch', paddingHorizontal: 16 }]} onPress={() => router.push('/voluntar/login')}><Text style={styles.addText}>Autentificare voluntar</Text></TouchableOpacity></View>
        ) : sorted.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={36} color={RED} />
            <Text style={styles.emptyTitle}>Jurnalul tău începe aici</Text>
            <Text style={styles.emptyText}>Adaugă prima donație, activitate de voluntariat sau alt gest de ajutor.</Text>
          </View>
        ) : sorted.map(entry => {
          const meta = kinds.find(k => k.id === entry.kind)!;
          return (
            <View key={entry.id} style={styles.entry}>
              <View style={styles.entryTop}>
                <View style={styles.entryIcon}><Ionicons name={meta.icon} size={22} color={RED} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryType}>{meta.label.toUpperCase()}</Text>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.entryDate}>{entry.date}</Text>
                </View>
              </View>
              {entry.kind === 'money' && entry.amount != null && <Text style={styles.detail}>{number(entry.amount)} {entry.currency || 'RON'}</Text>}
              {entry.kind === 'volunteer' && entry.hours != null && <Text style={styles.detail}>{number(entry.hours)} ore</Text>}
              {entry.quantity ? <Text style={styles.detail}>Cantitate: {entry.quantity}</Text> : null}
              {entry.relatedTo ? <Text style={styles.detail}>Caz / proiect / loc: {entry.relatedTo}</Text> : null}
              {entry.notes ? <Text style={styles.notes}>{entry.notes}</Text> : null}
              <View style={styles.entryActions}>
                <TouchableOpacity onPress={() => startEdit(entry)} style={styles.action}><Ionicons name="create-outline" size={17} color={RED} /><Text style={styles.actionText}>Editează</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remove(entry)} style={styles.action}><Ionicons name="trash-outline" size={17} color="#777" /><Text style={[styles.actionText, { color: '#777' }]}>Șterge</Text></TouchableOpacity>
              </View>
            </View>
          );
        })}
        <Text style={styles.disclaimer}>Acest jurnal este personal. Activitățile și donațiile introduse manual nu reprezintă confirmări oficiale din partea Misiunii Bucovina.</Text>
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={closeForm}>
        <SafeAreaView style={styles.modalScreen} edges={['bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={[styles.formContent, { paddingTop: Math.max(insets.top, 54) }]} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeForm} style={styles.back} accessibilityLabel="Înapoi fără salvare">
                  <Ionicons name="chevron-back" size={24} color={DARK} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                  <Text style={styles.headerLabel}>IMPLICAREA MEA</Text>
                  <Text style={styles.modalTitle}>{editingId ? 'Editează contribuția' : 'Contribuție nouă'}</Text>
                </View>
                <TouchableOpacity onPress={closeForm} style={styles.back} accessibilityLabel="Închide fără salvare"><Ionicons name="close" size={23} color={DARK} /></TouchableOpacity>
              </View>
              <Text style={styles.fieldLabel}>TIPUL CONTRIBUȚIEI</Text>
              <View style={styles.kindGrid}>{kinds.map(k => (
                <TouchableOpacity key={k.id} style={[styles.kindButton, form.kind === k.id && styles.kindSelected]} onPress={() => update({ kind: k.id })}>
                  <Ionicons name={k.icon} size={19} color={form.kind === k.id ? RED : '#777'} />
                  <Text style={[styles.kindText, form.kind === k.id && { color: RED }]}>{k.label}</Text>
                </TouchableOpacity>
              ))}</View>
              <Text style={styles.fieldLabel}>CE AI FĂCUT / OFERIT? *</Text>
              <TextInput style={styles.input} placeholder="Ex.: Ajutor pentru o familie" placeholderTextColor="#999" value={form.title} onChangeText={title => update({ title })} />
              <Text style={styles.fieldLabel}>DATA (AAAA-LL-ZZ) *</Text>
              <TextInput style={styles.input} value={form.date} onChangeText={date => update({ date })} placeholder="2026-10-16" placeholderTextColor="#999" autoCapitalize="none" />
              {form.kind === 'money' && <>
                <Text style={styles.fieldLabel}>SUMA DONATĂ *</Text>
                <TextInput style={styles.input} value={form.amount} onChangeText={amount => update({ amount })} keyboardType="decimal-pad" placeholder="Ex.: 150" placeholderTextColor="#999" />
                <Text style={styles.fieldLabel}>MONEDA</Text>
                <View style={styles.currencyRow}>{['RON', 'EUR', 'USD'].map(currency => <TouchableOpacity key={currency} onPress={() => update({ currency })} style={[styles.currency, form.currency === currency && styles.currencySelected]}><Text style={{ color: form.currency === currency ? RED : '#666', fontWeight: '800' }}>{currency}</Text></TouchableOpacity>)}</View>
              </>}
              {form.kind === 'volunteer' && <>
                <Text style={styles.fieldLabel}>NUMĂR DE ORE (OPȚIONAL)</Text>
                <TextInput style={styles.input} value={form.hours} onChangeText={hours => update({ hours })} keyboardType="decimal-pad" placeholder="Ex.: 4" placeholderTextColor="#999" />
              </>}
              {form.kind === 'goods' && <>
                <Text style={styles.fieldLabel}>CANTITATE / BUNURI (OPȚIONAL)</Text>
                <TextInput style={styles.input} value={form.quantity} onChangeText={quantity => update({ quantity })} placeholder="Ex.: 3 pachete cu alimente" placeholderTextColor="#999" />
              </>}
              <Text style={styles.fieldLabel}>CAZ, PROIECT SAU LOC (OPȚIONAL)</Text>
              <TextInput style={styles.input} value={form.relatedTo} onChangeText={relatedTo => update({ relatedTo })} placeholder="Ex.: Proiectul de iarnă" placeholderTextColor="#999" />
              <Text style={styles.fieldLabel}>DETALII ȘI OBSERVAȚII (OPȚIONAL)</Text>
              <TextInput style={[styles.input, styles.multiline]} value={form.notes} onChangeText={notes => update({ notes })} multiline textAlignVertical="top" placeholder="Descrie activitatea sau ce ai simțit..." placeholderTextColor="#999" />
              <Text style={styles.formHint}>Datele sunt salvate în contul tău de voluntar și nu sunt verificate de organizație.</Text>
              <TouchableOpacity disabled={busy} style={[styles.addButton, busy && { opacity: 0.6 }]} onPress={save}>
                <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
                <Text style={styles.addText}>{busy ? 'Se salvează...' : 'Salvează contribuția'}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} style={styles.cancelButton} onPress={closeForm} accessibilityRole="button">
                <Ionicons name="close-circle-outline" size={21} color={DARK} />
                <Text style={styles.cancelText}>Renunță fără salvare</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG }, content: { paddingHorizontal: 15, paddingBottom: 45 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 22, paddingBottom: 20 },
  back: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerLabel: { color: RED, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 32, fontWeight: '900', color: DARK, marginTop: 5 }, subtitle: { fontSize: 13, color: '#666', lineHeight: 19, marginTop: 6, marginBottom: 20 },
  warning: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: 15, backgroundColor: '#FFF0F0', marginTop: 15, marginBottom: 0 },
  warningTitle: { fontSize: 12, fontWeight: '900', color: DARK }, warningText: { fontSize: 11, lineHeight: 17, color: '#777777', marginTop: 5 },
  stats: { flexDirection: 'row', gap: 10 }, statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 17, padding: 16 },
  statValue: { fontSize: 27, color: DARK, fontWeight: '900', marginTop: 8 }, statCaption: { color: '#777', fontSize: 10, marginTop: 3 },
  totalCard: { backgroundColor: '#FFF', borderRadius: 17, padding: 16, marginTop: 10 },
  totalTitle: { color: '#777', fontSize: 11, fontWeight: '700' }, totalValue: { color: DARK, fontSize: 23, fontWeight: '900', marginTop: 7 },
  totalNote: { color: '#888', fontSize: 10, marginTop: 7 },
  addButton: { backgroundColor: RED, borderRadius: 15, minHeight: 55, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 20 },
  addText: { color: '#FFF', fontSize: 14, fontWeight: '900' }, sectionTitle: { fontSize: 21, fontWeight: '900', color: DARK, marginTop: 28, marginBottom: 12 },
  empty: { backgroundColor: '#FFF', borderRadius: 18, padding: 22, alignItems: 'center' }, emptyTitle: { fontSize: 15, fontWeight: '900', color: DARK, marginTop: 12 },
  emptyText: { color: '#777', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 6 },
  entry: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 10 }, entryTop: { flexDirection: 'row', gap: 11 },
  entryIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  entryType: { fontSize: 9, fontWeight: '900', color: RED, letterSpacing: 0.5 }, entryTitle: { fontSize: 15, fontWeight: '900', color: DARK, marginTop: 4 },
  entryDate: { fontSize: 10, color: '#888', marginTop: 5 }, detail: { fontSize: 12, fontWeight: '800', color: DARK, marginTop: 9 },
  notes: { fontSize: 12, lineHeight: 18, color: '#666', marginTop: 9 },
  entryActions: { flexDirection: 'row', gap: 24, borderTopWidth: 1, borderTopColor: '#F1F1F1', marginTop: 15, paddingTop: 13 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 }, actionText: { color: RED, fontSize: 11, fontWeight: '800' },
  disclaimer: { color: '#999', fontSize: 10, textAlign: 'center', lineHeight: 16, marginTop: 18 },
  cancelButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 10, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E6E6' },
  cancelText: { color: DARK, fontSize: 13, fontWeight: '800' },
  modalScreen: { flex: 1, backgroundColor: BG }, formContent: { paddingHorizontal: 17, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 15 },
  modalTitle: { fontSize: 23, fontWeight: '900', color: DARK }, fieldLabel: { color: '#666', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderRadius: 13, minHeight: 51, paddingHorizontal: 14, fontSize: 14, color: DARK, borderWidth: 1, borderColor: '#EEE' },
  multiline: { height: 115, paddingTop: 13 }, kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindButton: { width: '48.5%', minHeight: 66, borderRadius: 13, backgroundColor: '#FFF', padding: 11, justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#EEE' },
  kindSelected: { borderColor: RED, backgroundColor: '#FFF0F0' }, kindText: { color: '#666', fontSize: 11, fontWeight: '800' },
  currencyRow: { flexDirection: 'row', gap: 9 }, currency: { backgroundColor: '#FFF', borderRadius: 11, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: '#EEE' },
  currencySelected: { borderColor: RED, backgroundColor: '#FFF0F0' }, formHint: { fontSize: 11, color: '#888', lineHeight: 17, marginTop: 18 },
  headerText: { flex: 1, marginLeft: 15 },
  hero: { backgroundColor: RED, borderRadius: 21, padding: 19, marginTop: 8 },
  heroIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroSmall: { color: '#FFFFFF', opacity: 0.75, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 5 },
  heroText: { color: '#FFFFFF', opacity: 0.9, fontSize: 12, lineHeight: 18, marginTop: 6 },
  sectionLabel: { color: '#999999', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginTop: 19, marginBottom: 9, marginLeft: 5 },
});
