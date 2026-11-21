import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator,
  
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';

export default function CreateBankAccountScreen() {
  const [currency, setCurrency] = useState('');
  const [accountName, setAccountName] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [swiftBic, setSwiftBic] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  async function saveAccount() {
    const cleanCurrency = currency.trim().toUpperCase();

    const cleanIban = iban
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!cleanCurrency) {
      Alert.alert(
        'Monedă necesară',
        'Introdu moneda contului, de exemplu RON, EUR sau USD.'
      );
      return;
    }

    if (!cleanIban) {
      Alert.alert(
        'IBAN necesar',
        'Introdu IBAN-ul contului bancar.'
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('bank_accounts')
      .insert({
        currency: cleanCurrency,
        account_name: accountName.trim() || null,
        beneficiary: beneficiary.trim() || null,
        bank_name: bankName.trim() || null,
        iban: cleanIban,
        swift_bic:
          swiftBic.trim().toUpperCase() || null,
        is_active: isActive,
      });

    setSaving(false);

    if (error) {
      console.log(
        'Eroare creare cont bancar:',
        error
      );

      Alert.alert(
        'Eroare',
        'Contul bancar nu a putut fi salvat.'
      );

      return;
    }

    Alert.alert(
      'Cont adăugat',
      'Contul bancar a fost adăugat cu succes.',
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
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
              size={23}
              color={DARK}
            />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>
              CONTURI BANCARE
            </Text>

            <Text style={styles.headerTitle}>
              Adaugă cont
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={23}
              color={RED}
            />

            <Text style={styles.infoText}>
              Adaugă un cont separat pentru fiecare
              monedă în care pot fi primite donații.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>
            INFORMAȚII CONT
          </Text>

          <View style={styles.card}>
            <Field
              label="Monedă *"
              value={currency}
              onChangeText={setCurrency}
              placeholder="RON, EUR, USD..."
              autoCapitalize="characters"
            />

            <Field
              label="Denumire cont"
              value={accountName}
              onChangeText={setAccountName}
              placeholder="Ex: Cont donații RON"
            />

            <Field
              label="Beneficiar"
              value={beneficiary}
              onChangeText={setBeneficiary}
              placeholder="Ex: Misiunea Bucovina"
            />

            <Field
              label="Bancă"
              value={bankName}
              onChangeText={setBankName}
              placeholder="Numele băncii"
            />

            <Field
              label="IBAN *"
              value={iban}
              onChangeText={setIban}
              placeholder="RO..."
              autoCapitalize="characters"
            />

            <Field
              label="SWIFT / BIC"
              value={swiftBic}
              onChangeText={setSwiftBic}
              placeholder="Cod SWIFT / BIC"
              autoCapitalize="characters"
            />
          </View>

          <Text style={styles.sectionLabel}>
            VIZIBILITATE
          </Text>

          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>
                  Cont activ
                </Text>

                <Text style={styles.switchDescription}>
                  Dacă este activ, contul va fi
                  afișat în aplicație pentru donații.
                </Text>
              </View>

              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{
                  false: '#D8D8D8',
                  true: '#DCA8AA',
                }}
                thumbColor={
                  isActive ? RED : '#FFFFFF'
                }
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveAccount}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="add-circle-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text style={styles.saveButtonText}>
                  Adaugă contul
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
  autoCapitalize = 'sentences',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#AAAAAA"
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
    marginLeft: 13,
  },

  eyebrow: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  headerTitle: {
    color: DARK,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 1,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 45,
  },

  infoCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 17,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoText: {
    flex: 1,
    color: '#6F4A4A',
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 11,
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

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  switchContent: {
    flex: 1,
    marginRight: 15,
  },

  switchTitle: {
    color: DARK,
    fontSize: 12,
    fontWeight: '800',
  },

  switchDescription: {
    color: '#888888',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
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