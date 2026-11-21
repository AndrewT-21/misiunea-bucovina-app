import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator,
    
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';

type BankAccount = {
  id: string;
  currency: string;
  account_name: string | null;
  beneficiary: string | null;
  bank_name: string | null;
  iban: string;
  swift_bic: string | null;
};

export default function BankTransferScreen() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [bankTransferDetails, setBankTransferDetails] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const [
      { data: accountsData, error: accountsError },
      { data: settingsData, error: settingsError },
    ] = await Promise.all([
      supabase
        .from('bank_accounts')
        .select(
          'id, currency, account_name, beneficiary, bank_name, iban, swift_bic'
        )
        .eq('is_active', true)
        .order('created_at', { ascending: true }),

      supabase
        .from('donation_settings')
        .select('bank_transfer_details')
        .limit(1)
        .maybeSingle(),
    ]);

    if (accountsError) {
      console.log(
        'Eroare încărcare conturi bancare:',
        accountsError
      );

      Alert.alert(
        'Eroare',
        'Conturile bancare nu au putut fi încărcate.'
      );
    }

    if (settingsError) {
      console.log(
        'Eroare încărcare detalii transfer:',
        settingsError
      );
    }

    setAccounts(
      (accountsData as BankAccount[] | null) ?? []
    );

    setBankTransferDetails(
      settingsData?.bank_transfer_details ?? null
    );

    setLoading(false);
  }

  async function copyValue(
    key: string,
    value: string
  ) {
    await Clipboard.setStringAsync(value);

    setCopied(key);

    setTimeout(() => {
      setCopied(null);
    }, 1800);
  }

  function getCurrencyIcon(currency: string) {
    switch (currency.toUpperCase()) {
      case 'RON':
        return '🇷🇴';
      case 'EUR':
        return '🇪🇺';
      case 'USD':
        return '🇺🇸';
      case 'GBP':
        return '🇬🇧';
      case 'CHF':
        return '🇨🇭';
      default:
        return '🏦';
    }
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
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={DARK}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Transfer bancar
        </Text>

        <View style={styles.headerSpace} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="business-outline"
              size={30}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.heroTitle}>
            Donează prin{'\n'}transfer bancar
          </Text>

          <Text style={styles.heroText}>
            Alege moneda dorită și folosește
            informațiile contului pentru a susține
            lucrarea Misiunii Bucovina.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Conturi disponibile
        </Text>

        {accounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="business-outline"
              size={31}
              color="#BBBBBB"
            />

            <Text style={styles.emptyTitle}>
              Momentan nu sunt conturi disponibile
            </Text>

            <Text style={styles.emptyText}>
              Informațiile pentru transfer bancar
              vor fi afișate aici.
            </Text>
          </View>
        ) : (
          accounts.map((account) => (
            <View
              key={account.id}
              style={styles.accountCard}
            >
              <View style={styles.accountHeader}>
                <View style={styles.currencyIcon}>
                  <Text style={styles.currencyEmoji}>
                    {getCurrencyIcon(account.currency)}
                  </Text>
                </View>

                <View style={styles.accountHeaderContent}>
                  <Text style={styles.currency}>
                    {account.currency}
                  </Text>

                  {account.account_name && (
                    <Text style={styles.accountName}>
                      {account.account_name}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.bankFields}>
                {account.beneficiary && (
                  <BankField
                    label="BENEFICIAR"
                    value={account.beneficiary}
                    copied={
                      copied ===
                      `${account.id}-beneficiary`
                    }
                    onCopy={() =>
                      copyValue(
                        `${account.id}-beneficiary`,
                        account.beneficiary!
                      )
                    }
                  />
                )}

                {account.bank_name && (
                  <BankField
                    label="BANCĂ"
                    value={account.bank_name}
                    copied={
                      copied ===
                      `${account.id}-bank`
                    }
                    onCopy={() =>
                      copyValue(
                        `${account.id}-bank`,
                        account.bank_name!
                      )
                    }
                  />
                )}

                <BankField
                  label="IBAN"
                  value={account.iban}
                  copied={
                    copied === `${account.id}-iban`
                  }
                  onCopy={() =>
                    copyValue(
                      `${account.id}-iban`,
                      account.iban
                    )
                  }
                  important
                />

                {account.swift_bic && (
                  <BankField
                    label="SWIFT / BIC"
                    value={account.swift_bic}
                    copied={
                      copied ===
                      `${account.id}-swift`
                    }
                    onCopy={() =>
                      copyValue(
                        `${account.id}-swift`,
                        account.swift_bic!
                      )
                    }
                  />
                )}
              </View>
            </View>
          ))
        )}

        {bankTransferDetails && (
          <>
            <Text style={styles.sectionTitle}>
              Informații suplimentare
            </Text>

            <View style={styles.detailsCard}>
              <Ionicons
                name="information-circle-outline"
                size={24}
                color={RED}
              />

              <Text style={styles.detailsText}>
                {bankTransferDetails}
              </Text>
            </View>
          </>
        )}

        <View style={styles.noticeCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={27}
            color={RED}
          />

          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>
              Verifică informațiile
            </Text>

            <Text style={styles.noticeText}>
              Înainte de a confirma transferul,
              verifică informațiile introduse în
              aplicația băncii tale.
            </Text>
          </View>
        </View>

        <View style={styles.thankYouCard}>
          <Ionicons
            name="heart-outline"
            size={27}
            color={RED}
          />

          <Text style={styles.thankYouTitle}>
            Mulțumim pentru sprijin!
          </Text>

          <Text style={styles.thankYouText}>
            Fiecare contribuție ne ajută să fim
            alături de oamenii și familiile care au
            nevoie de ajutor.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type BankFieldProps = {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  important?: boolean;
};

function BankField({
  label,
  value,
  copied,
  onCopy,
  important = false,
}: BankFieldProps) {
  return (
    <View style={styles.bankField}>
      <View style={styles.bankFieldContent}>
        <Text style={styles.bankLabel}>
          {label}
        </Text>

        <Text
          style={[
            styles.bankValue,
            important && styles.importantValue,
          ]}
          selectable
        >
          {value}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.copyButton,
          copied && styles.copyButtonActive,
        ]}
        onPress={onCopy}
        activeOpacity={0.7}
      >
        <Ionicons
          name={
            copied
              ? 'checkmark-outline'
              : 'copy-outline'
          }
          size={18}
          color={copied ? '#FFFFFF' : RED}
        />

        <Text
          style={[
            styles.copyText,
            copied && styles.copyTextActive,
          ]}
        >
          {copied ? 'Copiat' : 'Copiază'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 12,
    marginTop: 12,
  },

  header: {
    height: 58,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F4F4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: DARK,
  },

  headerSpace: {
    width: 42,
  },

  content: {
    padding: 15,
    paddingBottom: 45,
  },

  hero: {
    backgroundColor: RED,
    borderRadius: 24,
    padding: 24,
  },

  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },

  heroText: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },

  sectionTitle: {
    color: DARK,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 26,
    marginBottom: 12,
  },

  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginBottom: 14,
    overflow: 'hidden',
  },

  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 17,
    backgroundColor: '#FFF7F7',
    borderBottomWidth: 1,
    borderBottomColor: '#F1E5E5',
  },

  currencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  currencyEmoji: {
    fontSize: 24,
  },

  accountHeaderContent: {
    flex: 1,
    marginLeft: 12,
  },

  currency: {
    color: RED,
    fontSize: 17,
    fontWeight: '900',
  },

  accountName: {
    color: '#777777',
    fontSize: 11,
    marginTop: 3,
  },

  bankFields: {
    paddingHorizontal: 17,
  },

  bankField: {
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  bankFieldContent: {
    marginBottom: 12,
  },

  bankLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 5,
  },

  bankValue: {
    color: DARK,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },

  importantValue: {
    fontSize: 16,
    letterSpacing: 0.5,
    fontWeight: '900',
  },

  copyButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 11,
    backgroundColor: '#FFF0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  copyButtonActive: {
    backgroundColor: RED,
  },

  copyText: {
    color: RED,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
  },

  copyTextActive: {
    color: '#FFFFFF',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },

  emptyTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
  },

  emptyText: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },

  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  detailsText: {
    flex: 1,
    color: '#666666',
    fontSize: 12,
    lineHeight: 19,
    marginLeft: 11,
  },

  noticeCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 22,
  },

  noticeContent: {
    flex: 1,
    marginLeft: 12,
  },

  noticeTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
  },

  noticeText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  thankYouCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 22,
    marginTop: 14,
    alignItems: 'center',
  },

  thankYouTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 9,
  },

  thankYouText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
});