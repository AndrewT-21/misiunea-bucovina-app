import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator,
  
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type TwoCentsSettings = {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  daily_amount: string | null;
  supporters_goal: number | null;
  supporters_current: number | null;
  donation_url: string | null;
  weekly_text: string | null;
  monthly_text: string | null;
  quarterly_text: string | null;
  bag_title: string | null;
  bag_description: string | null;
  bag_url: string | null;
  how_it_works: string | null;
  story: string | null;
  bank_transfer_note: string | null;
  additional_info: string | null;
};

export default function TwoCentsAdminScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 800;
  const [expanded, setExpanded] = useState<string[]>(['PREZENTARE', 'SUSȚINĂTORI']);
  const toggleSection = (key: string) => setExpanded(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [dailyAmount, setDailyAmount] = useState('');

  const [supportersGoal, setSupportersGoal] = useState('');
  const [supportersCurrent, setSupportersCurrent] = useState('');

  const [donationUrl, setDonationUrl] = useState('');

  const [weeklyText, setWeeklyText] = useState('');
  const [monthlyText, setMonthlyText] = useState('');
  const [quarterlyText, setQuarterlyText] = useState('');

  const [bagTitle, setBagTitle] = useState('');
  const [bagDescription, setBagDescription] = useState('');
  const [bagUrl, setBagUrl] = useState('');

  const [howItWorks, setHowItWorks] = useState('');
  const [story, setStory] = useState('');

  const [bankTransferNote, setBankTransferNote] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from('two_cents_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('Eroare încărcare Doi Bănuți:', error);

      Alert.alert(
        'Eroare',
        'Informațiile pentru Doi Bănuți pe Zi nu au putut fi încărcate.'
      );

      setLoading(false);
      return;
    }

    if (data) {
      const settings = data as TwoCentsSettings;

      setId(settings.id);

      setTitle(settings.title ?? '');
      setSubtitle(settings.subtitle ?? '');
      setDescription(settings.description ?? '');
      setDailyAmount(settings.daily_amount ?? '');

      setSupportersGoal(
        settings.supporters_goal?.toString() ?? ''
      );

      setSupportersCurrent(
        settings.supporters_current?.toString() ?? ''
      );

      setDonationUrl(settings.donation_url ?? '');

      setWeeklyText(settings.weekly_text ?? '');
      setMonthlyText(settings.monthly_text ?? '');
      setQuarterlyText(settings.quarterly_text ?? '');

      setBagTitle(settings.bag_title ?? '');
      setBagDescription(settings.bag_description ?? '');
      setBagUrl(settings.bag_url ?? '');

      setHowItWorks(settings.how_it_works ?? '');
      setStory(settings.story ?? '');

      setBankTransferNote(
        settings.bank_transfer_note ?? ''
      );

      setAdditionalInfo(
        settings.additional_info ?? ''
      );
    }

    setLoading(false);
  }

  async function saveSettings() {
    if (!id) {
      Alert.alert(
        'Eroare',
        'Setările Doi Bănuți pe Zi nu au fost găsite.'
      );
      return;
    }

    const goal = Number(supportersGoal);
    const current = Number(supportersCurrent);

    if (
      supportersGoal.trim() &&
      (!Number.isFinite(goal) || goal < 0)
    ) {
      Alert.alert(
        'Verifică obiectivul',
        'Obiectivul de susținători trebuie să fie un număr valid.'
      );
      return;
    }

    if (
      supportersCurrent.trim() &&
      (!Number.isFinite(current) || current < 0)
    ) {
      Alert.alert(
        'Verifică susținătorii',
        'Numărul actual de susținători trebuie să fie valid.'
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('two_cents_settings')
      .update({
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        daily_amount: dailyAmount.trim() || null,

        supporters_goal:
          supportersGoal.trim() ? goal : null,

        supporters_current:
          supportersCurrent.trim() ? current : null,

        donation_url: donationUrl.trim() || null,

        weekly_text: weeklyText.trim() || null,
        monthly_text: monthlyText.trim() || null,
        quarterly_text: quarterlyText.trim() || null,

        bag_title: bagTitle.trim() || null,
        bag_description: bagDescription.trim() || null,
        bag_url: bagUrl.trim() || null,

        how_it_works: howItWorks.trim() || null,
        story: story.trim() || null,

        bank_transfer_note:
          bankTransferNote.trim() || null,

        additional_info:
          additionalInfo.trim() || null,

        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);

    if (error) {
      console.log('Eroare salvare Doi Bănuți:', error);

      Alert.alert(
        'Eroare',
        'Informațiile nu au putut fi salvate.'
      );

      return;
    }

    Alert.alert(
  'Salvat',
  'Pagina Doi Bănuți pe Zi a fost actualizată cu succes.',
  [
    {
      text: 'OK',
      onPress: () => router.back(),
    },
  ]
);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={RED} />

        <Text style={styles.loadingText}>
          Se încarcă informațiile...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={DARK}
            />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>
              ADMINISTRARE
            </Text>

            <Text style={styles.headerTitle}>
              Doi Bănuți pe Zi
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, wide && styles.wideContent]}
        >
          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="wallet-outline"
                size={23}
                color={RED}
              />
            </View>

            <Text style={styles.infoText}>
              Informațiile modificate aici vor fi
              afișate în pagina publică Doi Bănuți
              pe Zi.
            </Text>
          </View>

          <View style={styles.overviewCard}>
            <View style={styles.overviewHeading}>
              <Ionicons name="heart-outline" size={21} color={RED} />
              <Text style={styles.overviewTitle}>Campania pe scurt</Text>
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metric}><Text style={styles.metricValue}>{dailyAmount || '—'}</Text><Text style={styles.metricLabel}>Contribuție zilnică</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{supportersCurrent || '0'}</Text><Text style={styles.metricLabel}>Susținători</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{supportersGoal || '—'}</Text><Text style={styles.metricLabel}>Obiectiv</Text></View>
            </View>
            {Number(supportersGoal) > 0 && <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, Number(supportersCurrent || 0) / Number(supportersGoal) * 100))}%` }]} /></View>}
          </View>
          <View style={styles.sectionBlock}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('PREZENTARE')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="PREZENTARE">
              <View style={styles.sectionIcon}><Ionicons name="document-text-outline" size={20} color={RED} /></View>
              <Text style={styles.sectionTitle}>PREZENTARE</Text>
              <Ionicons name={expanded.includes('PREZENTARE') ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
            </TouchableOpacity>
            {expanded.includes('PREZENTARE') && <View style={styles.sectionBody}>
            <Field
              label="Titlu"
              value={title}
              onChangeText={setTitle}
              placeholder="Doi Bănuți pe Zi"
            />

            <Field
              label="Subtitlu"
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="Un gest mic..."
              multiline
            />

            <Field
              label="Descriere"
              value={description}
              onChangeText={setDescription}
              placeholder="Descrierea proiectului..."
              multiline
            />

            <Field
              label="Suma zilnică"
              value={dailyAmount}
              onChangeText={setDailyAmount}
              placeholder="2 lei"
            />
            </View>}
          </View>
          <View style={styles.sectionBlock}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('SUSȚINĂTORI')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="SUSȚINĂTORI">
              <View style={styles.sectionIcon}><Ionicons name="people-outline" size={20} color={RED} /></View>
              <Text style={styles.sectionTitle}>SUSȚINĂTORI</Text>
              <Ionicons name={expanded.includes('SUSȚINĂTORI') ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
            </TouchableOpacity>
            {expanded.includes('SUSȚINĂTORI') && <View style={styles.sectionBody}>
            <Field
              label="Obiectiv susținători"
              value={supportersGoal}
              onChangeText={setSupportersGoal}
              placeholder="1000"
              keyboardType="numeric"
            />

            <Field
              label="Susținători actuali"
              value={supportersCurrent}
              onChangeText={setSupportersCurrent}
              placeholder="0"
              keyboardType="numeric"
            />
            </View>}
          </View>
          <View style={styles.sectionBlock}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('SUSȚINERE ONLINE')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="SUSȚINERE ONLINE">
              <View style={styles.sectionIcon}><Ionicons name="card-outline" size={20} color={RED} /></View>
              <Text style={styles.sectionTitle}>SUSȚINERE ONLINE</Text>
              <Ionicons name={expanded.includes('SUSȚINERE ONLINE') ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
            </TouchableOpacity>
            {expanded.includes('SUSȚINERE ONLINE') && <View style={styles.sectionBody}>
            <Field
              label="Link donație"
              value={donationUrl}
              onChangeText={setDonationUrl}
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />

            <Field
              label="Susținere săptămânală"
              value={weeklyText}
              onChangeText={setWeeklyText}
              placeholder="Text pentru susținerea săptămânală..."
              multiline
            />

            <Field
              label="Susținere lunară"
              value={monthlyText}
              onChangeText={setMonthlyText}
              placeholder="Text pentru susținerea lunară..."
              multiline
            />

            <Field
              label="Susținere trimestrială"
              value={quarterlyText}
              onChangeText={setQuarterlyText}
              placeholder="Text pentru susținerea trimestrială..."
              multiline
            />
            </View>}
          </View>
          <View style={styles.sectionBlock}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('SĂCULEȚ')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="SĂCULEȚ">
              <View style={styles.sectionIcon}><Ionicons name="bag-handle-outline" size={20} color={RED} /></View>
              <Text style={styles.sectionTitle}>SĂCULEȚ</Text>
              <Ionicons name={expanded.includes('SĂCULEȚ') ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
            </TouchableOpacity>
            {expanded.includes('SĂCULEȚ') && <View style={styles.sectionBody}>
            <Field
              label="Titlu"
              value={bagTitle}
              onChangeText={setBagTitle}
              placeholder="Comandă săculețul"
            />

            <Field
              label="Descriere"
              value={bagDescription}
              onChangeText={setBagDescription}
              placeholder="Informații despre săculeț..."
              multiline
            />

            <Field
              label="Link comandă"
              value={bagUrl}
              onChangeText={setBagUrl}
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />
            </View>}
          </View>
          <View style={styles.sectionBlock}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('CONȚINUT')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="CONȚINUT">
              <View style={styles.sectionIcon}><Ionicons name="reader-outline" size={20} color={RED} /></View>
              <Text style={styles.sectionTitle}>CONȚINUT</Text>
              <Ionicons name={expanded.includes('CONȚINUT') ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
            </TouchableOpacity>
            {expanded.includes('CONȚINUT') && <View style={styles.sectionBody}>
            <Field
              label="Cum funcționează"
              value={howItWorks}
              onChangeText={setHowItWorks}
              placeholder="Explică modul de funcționare..."
              multiline
              large
            />

            <Field
              label="Povestea proiectului"
              value={story}
              onChangeText={setStory}
              placeholder="Povestea Doi Bănuți pe Zi..."
              multiline
              large
            />
            </View>}
          </View>
          <View style={styles.sectionBlock}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('TRANSFER BANCAR')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="TRANSFER BANCAR">
              <View style={styles.sectionIcon}><Ionicons name="business-outline" size={20} color={RED} /></View>
              <Text style={styles.sectionTitle}>TRANSFER BANCAR</Text>
              <Ionicons name={expanded.includes('TRANSFER BANCAR') ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
            </TouchableOpacity>
            {expanded.includes('TRANSFER BANCAR') && <View style={styles.sectionBody}>
            <Field
              label="Mențiune transfer"
              value={bankTransferNote}
              onChangeText={setBankTransferNote}
              placeholder="Donație Doi bănuți pe zi"
              multiline
            />
            </View>}
          </View>
          <View style={styles.sectionBlock}>
            <TouchableOpacity style={styles.sectionHeader} onPress={() => toggleSection('INFORMAȚII SUPLIMENTARE')} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel="INFORMAȚII SUPLIMENTARE">
              <View style={styles.sectionIcon}><Ionicons name="information-circle-outline" size={20} color={RED} /></View>
              <Text style={styles.sectionTitle}>INFORMAȚII SUPLIMENTARE</Text>
              <Ionicons name={expanded.includes('INFORMAȚII SUPLIMENTARE') ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
            </TouchableOpacity>
            {expanded.includes('INFORMAȚII SUPLIMENTARE') && <View style={styles.sectionBody}>
            <Field
              label="Informații suplimentare"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              placeholder="Alte informații..."
              multiline
              large
            />
            </View>}
          </View>
          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveSettings}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text style={styles.saveButtonText}>
                  Salvează modificările
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text style={styles.sectionLabel}>
      {text}
    </Text>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  large?: boolean;
  keyboardType?: 'default' | 'url' | 'numeric';
  autoCapitalize?:
    | 'none'
    | 'sentences'
    | 'words'
    | 'characters';
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  large = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        style={[
          styles.input,
          multiline && styles.textArea,
          large && styles.largeTextArea,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#AAAAAA"
        multiline={multiline}
        textAlignVertical={
          multiline ? 'top' : 'center'
        }
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 12,
  },

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 15,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
    marginLeft: 13,
  },

  eyebrow: {
    color: RED,
    fontSize:10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  headerTitle: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15,
    paddingBottom: 45,
  },

  wideContent: { maxWidth: 940, width: '100%', alignSelf: 'center' },
  overviewCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginTop: 18, borderWidth: 1, borderColor: '#EFE7E7' },
  overviewHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  overviewTitle: { fontSize: 17, fontWeight: '800', color: DARK },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: '#FAF6F6', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 9, alignItems: 'center' },
  metricValue: { color: RED, fontSize: 19, fontWeight: '900' },
  metricLabel: { color: '#777', fontSize: 11, textAlign: 'center', marginTop: 5 },
  progressTrack: { height: 7, borderRadius: 8, backgroundColor: '#F0E4E4', overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', backgroundColor: RED, borderRadius: 8 },
  sectionBlock: { marginTop: 14, borderRadius: 18, backgroundColor: '#FFF', overflow: 'hidden', borderWidth: 1, borderColor: '#ECECEC' },
  sectionHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  sectionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '900', color: DARK, letterSpacing: 0.5 },
  sectionBody: { paddingHorizontal: 17, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F2F2F2' },
  infoCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoText: {
    flex: 1,
    color: '#6F4A4A',
    fontSize: 13,
    lineHeight: 19,
    marginLeft: 12,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 22,
    marginBottom: 9,
    marginLeft: 5,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
  },

  field: {
    marginBottom: 14,
  },

  label: {
    color: DARK,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 7,
  },

  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    minHeight: 48,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 15,
  },

  textArea: {
    minHeight: 95,
    paddingTop: 13,
    paddingBottom: 13,
  },

  largeTextArea: {
    minHeight: 150,
  },

  saveButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: RED,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },
});