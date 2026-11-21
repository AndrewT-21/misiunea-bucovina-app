import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type TaxRedirectSettings = {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;

  individual_title: string | null;
  individual_description: string | null;
  individual_form_url: string | null;

  company_title: string | null;
  company_description: string | null;
  company_form_url: string | null;

  organization_name: string | null;
  fiscal_code: string | null;
  bank_account: string | null;

  how_it_works: string | null;
  deadline_text: string | null;
  additional_info: string | null;
};

export default function TaxRedirectAdminScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [id, setId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');

  const [individualTitle, setIndividualTitle] =
    useState('');

  const [
    individualDescription,
    setIndividualDescription,
  ] = useState('');

  const [individualFormUrl, setIndividualFormUrl] =
    useState('');

  const [companyTitle, setCompanyTitle] =
    useState('');

  const [
    companyDescription,
    setCompanyDescription,
  ] = useState('');

  const [companyFormUrl, setCompanyFormUrl] =
    useState('');

  const [organizationName, setOrganizationName] =
    useState('');

  const [fiscalCode, setFiscalCode] =
    useState('');

  const [bankAccount, setBankAccount] =
    useState('');

  const [howItWorks, setHowItWorks] =
    useState('');

  const [deadlineText, setDeadlineText] =
    useState('');

  const [additionalInfo, setAdditionalInfo] =
    useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from('tax_redirect_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(
        'Eroare încărcare redirecționare fiscală:',
        error
      );

      Alert.alert(
        'Eroare',
        'Informațiile pentru redirecționarea fiscală nu au putut fi încărcate.'
      );

      setLoading(false);
      return;
    }

    if (data) {
      const settings =
        data as TaxRedirectSettings;

      setId(settings.id);

      setTitle(settings.title ?? '');
      setSubtitle(settings.subtitle ?? '');
      setDescription(settings.description ?? '');

      setIndividualTitle(
        settings.individual_title ?? ''
      );

      setIndividualDescription(
        settings.individual_description ?? ''
      );

      setIndividualFormUrl(
        settings.individual_form_url ?? ''
      );

      setCompanyTitle(
        settings.company_title ?? ''
      );

      setCompanyDescription(
        settings.company_description ?? ''
      );

      setCompanyFormUrl(
        settings.company_form_url ?? ''
      );

      setOrganizationName(
        settings.organization_name ?? ''
      );

      setFiscalCode(
        settings.fiscal_code ?? ''
      );

      setBankAccount(
        settings.bank_account ?? ''
      );

      setHowItWorks(
        settings.how_it_works ?? ''
      );

      setDeadlineText(
        settings.deadline_text ?? ''
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
        'Setările pentru redirecționarea fiscală nu au fost găsite.'
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('tax_redirect_settings')
      .update({
        title: title.trim() || null,
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,

        individual_title:
          individualTitle.trim() || null,

        individual_description:
          individualDescription.trim() || null,

        individual_form_url:
          individualFormUrl.trim() || null,

        company_title:
          companyTitle.trim() || null,

        company_description:
          companyDescription.trim() || null,

        company_form_url:
          companyFormUrl.trim() || null,

        organization_name:
          organizationName.trim() || null,

        fiscal_code:
          fiscalCode.trim() || null,

        bank_account:
          bankAccount.trim() || null,

        how_it_works:
          howItWorks.trim() || null,

        deadline_text:
          deadlineText.trim() || null,

        additional_info:
          additionalInfo.trim() || null,

        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);

    if (error) {
      console.log(
        'Eroare salvare redirecționare fiscală:',
        error
      );

      Alert.alert(
        'Eroare',
        'Informațiile nu au putut fi salvate.'
      );

      return;
    }

    Alert.alert(
      'Salvat',
      'Pagina Redirecționare fiscală a fost actualizată cu succes.',
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
        <ActivityIndicator
          size="large"
          color={RED}
        />

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
        {/* HEADER */}

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

          <View style={[styles.headerText, { flex: 1, minWidth: 0 }]}>
            <Text style={styles.eyebrow}>
              ADMINISTRARE
            </Text>

            <Text style={styles.headerTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
              Redirecționare fiscală
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* INFO */}

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="document-text-outline"
                size={23}
                color={RED}
              />
            </View>

            <Text style={styles.infoText}>
              Informațiile introduse aici vor fi
              afișate în pagina publică pentru
              redirecționarea fiscală.
            </Text>
          </View>

          {/* GENERAL */}

          <ExpandableSection title="PREZENTARE" initiallyOpen={true}>

            <Field
              label="Titlu"
              value={title}
              onChangeText={setTitle}
              placeholder="Redirecționare fiscală"
            />

            <Field
              label="Subtitlu"
              value={subtitle}
              onChangeText={setSubtitle}
              placeholder="Transformă o parte din impozitul tău..."
              multiline
            />

            <Field
              label="Descriere"
              value={description}
              onChangeText={setDescription}
              placeholder="Descrierea acestei modalități de susținere..."
              multiline
              large
            />
          
</ExpandableSection>

          {/* INDIVIDUAL */}

          <ExpandableSection title="PERSOANE FIZICE" initiallyOpen={false}>

            <Field
              label="Titlu"
              value={individualTitle}
              onChangeText={setIndividualTitle}
              placeholder="Persoane fizice"
            />

            <Field
              label="Descriere"
              value={individualDescription}
              onChangeText={
                setIndividualDescription
              }
              placeholder="Explică modul de redirecționare pentru persoanele fizice..."
              multiline
              large
            />

            <Field
              label="Link formular"
              value={individualFormUrl}
              onChangeText={
                setIndividualFormUrl
              }
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />
          
</ExpandableSection>

          {/* COMPANY */}

          <ExpandableSection title="COMPANII" initiallyOpen={false}>

            <Field
              label="Titlu"
              value={companyTitle}
              onChangeText={setCompanyTitle}
              placeholder="Companii"
            />

            <Field
              label="Descriere"
              value={companyDescription}
              onChangeText={
                setCompanyDescription
              }
              placeholder="Explică modul de redirecționare pentru companii..."
              multiline
              large
            />

            <Field
              label="Link formular"
              value={companyFormUrl}
              onChangeText={setCompanyFormUrl}
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />
          
</ExpandableSection>

          {/* ORGANIZATION */}

          <ExpandableSection title="DATELE ORGANIZAȚIEI" initiallyOpen={false}>

            <Field
              label="Numele organizației"
              value={organizationName}
              onChangeText={
                setOrganizationName
              }
              placeholder="Misiunea Bucovina"
            />

            <Field
              label="Cod fiscal"
              value={fiscalCode}
              onChangeText={setFiscalCode}
              placeholder="Cod fiscal"
              autoCapitalize="characters"
            />

            <Field
              label="Cont bancar / IBAN"
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder="RO..."
              autoCapitalize="characters"
            />
          
</ExpandableSection>

          {/* HOW */}

          <ExpandableSection title="CUM FUNCȚIONEAZĂ" initiallyOpen={false}>

            <Field
              label="Instrucțiuni"
              value={howItWorks}
              onChangeText={setHowItWorks}
              placeholder="Explică pașii necesari..."
              multiline
              large
            />
          
</ExpandableSection>

          {/* DEADLINE */}

          <ExpandableSection title="TERMEN" initiallyOpen={false}>

            <Field
              label="Informații despre termen"
              value={deadlineText}
              onChangeText={setDeadlineText}
              placeholder="Introdu termenul sau alte informații importante..."
              multiline
            />
          
</ExpandableSection>

          {/* EXTRA */}

          <ExpandableSection title="INFORMAȚII SUPLIMENTARE" initiallyOpen={false}>

            <Field
              label="Alte informații"
              value={additionalInfo}
              onChangeText={setAdditionalInfo}
              placeholder="Alte informații utile..."
              multiline
              large
            />
          
</ExpandableSection>

          {/* SAVE */}

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
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.saveButtonText}
                >
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


function ExpandableSection({ title, initiallyOpen = false, children }: { title: string; initiallyOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ marginBottom: 14, backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden' }}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 }}>
        <Text style={{ color: '#242424', fontSize: 14, fontWeight: '800', letterSpacing: 1 }}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={RED} />
      </TouchableOpacity>
      {open && <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>{children}</View>}
    </View>
  );
}

function SectionLabel({
  text,
}: {
  text: string;
}) {
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
  keyboardType?: 'default' | 'url';
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
    fontSize: 10,
    lineHeight: 16,
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
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 7,
  },

  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    minHeight: 48,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 12,
  },

  textArea: {
    minHeight: 95,
    paddingTop: 13,
    paddingBottom: 13,
  },

  largeTextArea: {
    minHeight: 145,
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