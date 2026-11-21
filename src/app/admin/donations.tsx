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

type DonationSettings = {
  id: string;
  bank_transfer_details: string | null;
  online_donation_url: string | null;
  monthly_donation_url: string | null;
  two_cents_text: string | null;
  tax_redirect_text: string | null;
};

export default function DonationsAdminScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);

  const [bankTransferDetails, setBankTransferDetails] =
    useState('');

  const [onlineDonationUrl, setOnlineDonationUrl] =
    useState('');

  const [monthlyDonationUrl, setMonthlyDonationUrl] =
    useState('');

  const [twoCentsText, setTwoCentsText] = useState('');
  const [taxRedirectText, setTaxRedirectText] =
    useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from('donation_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(
        'Eroare încărcare donații:',
        error
      );

      Alert.alert(
        'Eroare',
        'Setările pentru donații nu au putut fi încărcate.'
      );

      setLoading(false);
      return;
    }

    if (data) {
      const settings = data as DonationSettings;

      setId(settings.id);
      setBankTransferDetails(
        settings.bank_transfer_details ?? ''
      );

      setOnlineDonationUrl(
        settings.online_donation_url ?? ''
      );

      setMonthlyDonationUrl(
        settings.monthly_donation_url ?? ''
      );

      setTwoCentsText(
        settings.two_cents_text ?? ''
      );

      setTaxRedirectText(
        settings.tax_redirect_text ?? ''
      );
    }

    setLoading(false);
  }

  async function saveSettings() {
    if (!id) {
      Alert.alert(
        'Eroare',
        'Setările pentru donații nu au fost găsite.'
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('donation_settings')
      .update({
        bank_transfer_details:
          bankTransferDetails.trim() || null,

        online_donation_url:
          onlineDonationUrl.trim() || null,

        monthly_donation_url:
          monthlyDonationUrl.trim() || null,

        two_cents_text:
          twoCentsText.trim() || null,

        tax_redirect_text:
          taxRedirectText.trim() || null,

        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);

    if (error) {
      console.log(
        'Eroare salvare donații:',
        error
      );

      Alert.alert(
        'Eroare',
        'Setările nu au putut fi salvate.'
      );

      return;
    }

    Alert.alert(
      'Donații actualizate',
      'Informațiile au fost salvate cu succes.',
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
          Se încarcă setările...
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
              Donații
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.infoCard}>
  <View style={styles.infoIcon}>
    <Ionicons
      name="information-circle-outline"
      size={23}
      color={RED}
    />
  </View>

  <Text style={styles.infoText}>
    Gestionează metodele prin care susținătorii pot dona. Modificările salvate sunt folosite în pagina publică.
  </Text>
</View>

<TouchableOpacity
  style={styles.bankAccountsButton}
  onPress={() =>
    router.push('/admin/bank-accounts')
  }
>
  <View style={styles.bankAccountsIcon}>
    <Ionicons
      name="business-outline"
      size={25}
      color={RED}
    />
  </View>

  <View style={styles.bankAccountsContent}>
    <Text style={styles.bankAccountsTitle}>
      Conturi bancare
    </Text>

    <Text style={styles.bankAccountsDescription}>
      Adaugă și administrează conturile pentru RON, EUR, USD și alte monede.
    </Text>
  </View>

  <Ionicons
    name="chevron-forward"
    size={21}
    color="#999999"
  />
</TouchableOpacity>

<Text style={styles.sectionLabel}>TRANSFER BANCAR</Text>

          <View style={styles.card}>
            <Text style={styles.cardHeading}>Instrucțiuni pentru transfer</Text>
            <Text style={styles.cardHint}>Conturile și monedele se gestionează separat din „Conturi bancare”.</Text>
            <Field
              label="Detalii suplimentare"
              value={bankTransferDetails}
              onChangeText={setBankTransferDetails}
              placeholder="Instrucțiuni generale pentru transfer..."
              multiline
            />
          </View>

          <Text style={styles.sectionLabel}>DONAȚII ONLINE</Text>

          <View style={styles.card}>
            <Text style={styles.cardHeading}>Linkuri pentru donații</Text>
            <Text style={styles.cardHint}>Adaugă adrese complete, începând cu https://.</Text>
            <Field
              label="Link donație online"
              value={onlineDonationUrl}
              onChangeText={setOnlineDonationUrl}
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />

            <Field
              label="Link donație lunară"
              value={monthlyDonationUrl}
              onChangeText={setMonthlyDonationUrl}
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.sectionLabel}>ALTE INFORMAȚII</Text>
          <View style={styles.card}>
            <Field
              label="Redirecționare fiscală"
              value={taxRedirectText}
              onChangeText={setTaxRedirectText}
              placeholder="Informații despre redirecționarea fiscală..."
              multiline
            />
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
                  Salvează informațiile
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
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
   ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},

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
   ...(Platform.OS === "web" ? { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 28, paddingBottom: 65 } : {})},

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
    lineHeight: 20,
    marginLeft: 12,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 9,
    marginLeft: 5,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  field: {
    marginBottom: 14,
  },

  label: {
    color: DARK,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 9,
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
    minHeight: 105,
    paddingTop: 13,
    paddingBottom: 13,
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
  cardHeading: { fontSize: 16, fontWeight: '800', color: DARK, marginBottom: 5 },
  cardHint: { fontSize: 12, lineHeight: 18, color: '#777777', marginBottom: 18 },
  bankAccountsButton: {
  backgroundColor: '#FFFFFF',
  borderRadius: 18,
  padding: 15,
  marginTop: 14,
  flexDirection: 'row',
  alignItems: 'center',
},

bankAccountsIcon: {
  width: 50,
  height: 50,
  borderRadius: 15,
  backgroundColor: '#FFF0F0',
  alignItems: 'center',
  justifyContent: 'center',
},

bankAccountsContent: {
  flex: 1,
  marginLeft: 13,
  marginRight: 8,
},

bankAccountsTitle: {
  color: DARK,
  fontSize: 14,
  fontWeight: '900',
},

bankAccountsDescription: {
  color: '#777777',
  fontSize: 10,
  lineHeight: 15,
  marginTop: 4,
},
});