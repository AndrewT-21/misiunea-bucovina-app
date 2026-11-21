import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ActivityIndicator,
  
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../../lib/supabase';

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
  display_order: number;
  is_active: boolean;
};

export default function BankAccountsAdminScreen() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

useFocusEffect(
  useCallback(() => {
    loadAccounts();
  }, [])
);

  async function loadAccounts() {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.log('Eroare conturi bancare:', error);

      Alert.alert(
        'Eroare',
        'Conturile bancare nu au putut fi încărcate.'
      );

      setLoading(false);
      setRefreshing(false);
      return;
    }

    setAccounts((data ?? []) as BankAccount[]);
    setLoading(false);
    setRefreshing(false);
  }

  async function refreshAccounts() {
    setRefreshing(true);
    await loadAccounts();
  }

  function getCurrencySymbol(currency: string) {
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

  return (
    <SafeAreaView style={styles.screen}>
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
            ADMINISTRARE
          </Text>

          <Text style={styles.headerTitle}>
            Conturi bancare
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            router.push('/admin/bank-accounts/create')
          }
        >
          <Ionicons
            name="add"
            size={25}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă conturile...
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshAccounts}
              tintColor={RED}
            />
          }
        >
          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={RED}
            />

            <Text style={styles.infoText}>
              Administrează conturile și monedele disponibile pentru donații. Atinge un cont pentru a-l edita.
            </Text>
          </View>

          <View style={styles.countRow}>
            <Text style={styles.sectionTitle}>
              CONTURI
            </Text>

            <Text style={styles.countText}>
              {accounts.length} total · {accounts.filter((account) => account.is_active).length} active
            </Text>
          </View>

          {accounts.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="business-outline"
                  size={30}
                  color={RED}
                />
              </View>

              <Text style={styles.emptyTitle}>
                Niciun cont bancar
              </Text>

              <Text style={styles.emptyText}>
                Adaugă primul cont bancar pentru
                donații.
              </Text>

              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() =>
                  router.push(
                    '/admin/bank-accounts/create'
                  )
                }
              >
                <Ionicons
                  name="add"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.emptyButtonText}>
                  Adaugă cont
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            accounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={styles.accountCard}
                activeOpacity={0.75}
                onPress={() =>
                  router.push(
                    `/admin/bank-accounts/${account.id}`
                  )
                }
              >
                <View style={styles.currencyBox}>
                  <Text style={styles.flag}>
                    {getCurrencySymbol(
                      account.currency
                    )}
                  </Text>
                </View>

                <View style={styles.accountContent}>
                  <View style={styles.accountTop}>
                    <Text style={styles.currency}>
                      {account.currency.toUpperCase()}
                    </Text>

                    <View
                      style={[
                        styles.statusBadge,
                        !account.is_active &&
                          styles.inactiveBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          !account.is_active &&
                            styles.inactiveText,
                        ]}
                      >
                        {account.is_active
                          ? 'Activ'
                          : 'Inactiv'}
                      </Text>
                    </View>
                  </View>

                  {account.account_name && (
                    <Text style={styles.accountName}>
                      {account.account_name}
                    </Text>
                  )}

                  <Text
                    style={styles.iban}
                    numberOfLines={1}
                  >
                    {account.iban ? `IBAN ···· ${account.iban.replace(/\s/g, '').slice(-4)}` : 'IBAN necompletat'}
                  </Text>

                  {account.bank_name && (
                    <Text style={styles.bankName}>
                      {account.bank_name}
                    </Text>
                  )}
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="#AAAAAA"
                />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
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
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 23,
    fontWeight: '900',
    marginTop: 1,
  },

  addButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
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

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 4,
  },

  sectionTitle: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  countText: {
    color: '#999999',
    fontSize: 11,
    fontWeight: '800',
  },

  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  currencyBox: {
    width: 51,
    height: 51,
    borderRadius: 15,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  flag: {
    fontSize: 24,
  },

  accountContent: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },

  accountTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  currency: {
    color: DARK,
    fontSize: 15,
    fontWeight: '900',
  },

  statusBadge: {
    backgroundColor: '#EAF7EE',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    marginLeft: 7,
  },

  inactiveBadge: {
    backgroundColor: '#EEEEEE',
  },

  statusText: {
    color: '#39804D',
    fontSize: 8,
    fontWeight: '900',
  },

  inactiveText: {
    color: '#777777',
  },

  accountName: {
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },

  iban: {
    color: '#777777',
    fontSize: 10,
    marginTop: 4,
  },

  bankName: {
    color: '#999999',
    fontSize: 9,
    marginTop: 3,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },

  emptyButton: {
    backgroundColor: RED,
    borderRadius: 13,
    minHeight: 45,
    paddingHorizontal: 18,
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 5,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#888888',
    fontSize: 11,
    marginTop: 10,
  },
});