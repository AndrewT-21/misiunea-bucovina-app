import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator,
    
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const DOMAINS = [
  'Lecția Biblică',
  'Lecția Misionară',
  'Versetul',
  'Lucrul Manual / Activitatea',
  'Jocul recapitulativ',
  'Cântarea',
] as const;

export default function ScoalaCrestinaInscriere() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [county, setCounty] = useState('');
  const [experience, setExperience] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleDomain(domain: string) {
    if (submitting) return;
    setDomains(previous => previous.includes(domain)
      ? previous.filter(item => item !== domain)
      : [...previous, domain]);
  }

  async function submit() {
    if (submitting) return;
    const name = fullName.trim();
    const contactPhone = phone.trim();
    const contactEmail = email.trim().toLowerCase();
    const locality = city.trim();
    const countyName = county.trim();

    if (!name || !contactPhone || !contactEmail || !locality || !countyName) {
      Alert.alert('Câmpuri obligatorii', 'Completează numele, telefonul, e-mailul, localitatea și județul.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      Alert.alert('E-mail invalid', 'Introdu o adresă de e-mail validă.');
      return;
    }
    if (domains.length === 0) {
      Alert.alert('Alege un domeniu', 'Selectează cel puțin un domeniu în care dorești să te implici.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('school_instructor_applications').insert({
        full_name: name,
        phone: contactPhone,
        email: contactEmail,
        city: locality,
        county: countyName,
        experience: experience.trim(),
        domains,
        status: 'noua',
      });
      if (error) throw error;
      Alert.alert(
        'Înscriere trimisă!',
        'Îți mulțumim! Înscrierea ta a fost înregistrată cu succes.',
        [{ text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe')) }],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message :
        (error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Încearcă din nou.');
      Alert.alert('Nu am putut trimite înscrierea', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))} accessibilityLabel="Înapoi">
          <Ionicons name="chevron-back" size={24} color={DARK} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>ȘCOALA CREȘTINĂ</Text>
          <Text style={styles.headerTitle}>Înscriere instructor</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <View style={styles.introIcon}><Ionicons name="heart-outline" size={23} color={RED} /></View>
            <Text style={styles.introTitle}>Implică-te alături de noi!</Text>
            <Text style={styles.introText}>
              Completează formularul pentru a te înscrie ca instructor în cadrul Școlii Creștine.
              Poți alege unul sau mai multe domenii în care dorești să slujești.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>DATE DE CONTACT</Text>
          <View style={styles.card}>
            <Field label="Nume și prenume *" value={fullName} onChangeText={setFullName} placeholder="Numele tău complet" autoCapitalize="words" />
            <Field label="Număr de telefon *" value={phone} onChangeText={setPhone} placeholder="Numărul tău de telefon" keyboardType="phone-pad" />
            <Field label="Adresă de e-mail *" value={email} onChangeText={setEmail} placeholder="exemplu@email.com" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Localitate *" value={city} onChangeText={setCity} placeholder="Localitatea în care locuiești" autoCapitalize="words" />
            <Field label="Județ *" value={county} onChangeText={setCounty} placeholder="Județul în care locuiești" autoCapitalize="words" last />
          </View>

          <Text style={styles.sectionLabel}>EXPERIENȚĂ</Text>
          <View style={styles.card}>
            <Field
              label="Experiență în lucrul cu copiii"
              value={experience}
              onChangeText={setExperience}
              placeholder="Povestește-ne pe scurt despre experiența ta (opțional)"
              multiline
              last
            />
          </View>

          <Text style={styles.sectionLabel}>DOMENII DE IMPLICARE</Text>
          <View style={styles.card}>
            <Text style={styles.domainHelp}>Selectează cel puțin un domeniu. Poți bifa mai multe variante.</Text>
            {DOMAINS.map(domain => {
              const selected = domains.includes(domain);
              return (
                <TouchableOpacity
                  key={domain}
                  style={[styles.domainRow, selected && styles.domainRowSelected]}
                  onPress={() => toggleDomain(domain)}
                  disabled={submitting}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color={selected ? RED : '#9B9B9B'} />
                  <Text style={[styles.domainText, selected && styles.domainTextSelected]}>{domain}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.requiredNote}>* Câmpuri obligatorii</Text>
          <TouchableOpacity style={[styles.submitButton, submitting && styles.disabled]} onPress={() => void submit()} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <Ionicons name="send-outline" size={20} color="#FFF" />}
            <Text style={styles.submitText}>{submitting ? 'Se trimite...' : 'Trimite înscrierea'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  multiline?: boolean;
  last?: boolean;
};

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', autoCapitalize = 'sentences', multiline = false, last = false }: FieldProps) {
  return (
    <View style={[styles.field, last && styles.lastField]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#AAA"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={keyboardType === 'default'}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        returnKeyType={multiline ? 'default' : 'next'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F6F6' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  headerText: { marginLeft: 13, flex: 1 },
  eyebrow: { color: RED, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { color: DARK, fontSize: 25, fontWeight: '900', marginTop: 2 },
  content: { padding: 15, paddingBottom: 60 },
  introCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 6 },
  introIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#FFF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  introTitle: { color: DARK, fontSize: 19, fontWeight: '900', marginBottom: 8 },
  introText: { color: '#666', fontSize: 13, lineHeight: 21 },
  sectionLabel: { color: '#999', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginLeft: 5, marginTop: 19, marginBottom: 9 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 18 },
  field: { marginBottom: 17 },
  lastField: { marginBottom: 0 },
  fieldLabel: { color: DARK, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { minHeight: 49, backgroundColor: '#F7F7F7', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, color: DARK, fontSize: 13, borderWidth: 1, borderColor: '#EEE' },
  textArea: { minHeight: 120, paddingTop: 13 },
  domainHelp: { color: '#777', fontSize: 12, lineHeight: 18, marginBottom: 13 },
  domainRow: { minHeight: 52, borderRadius: 13, borderWidth: 1, borderColor: '#EEE', flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 9, marginBottom: 9 },
  domainRowSelected: { borderColor: '#E8B9BB', backgroundColor: '#FFF7F7' },
  domainText: { color: DARK, fontSize: 13, fontWeight: '600', flex: 1 },
  domainTextSelected: { color: RED, fontWeight: '800' },
  requiredNote: { color: '#888', fontSize: 11, marginTop: 15, marginLeft: 4 },
  submitButton: { minHeight: 56, backgroundColor: RED, borderRadius: 16, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
