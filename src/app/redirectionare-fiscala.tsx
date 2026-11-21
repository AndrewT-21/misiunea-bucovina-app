import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator,
    
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

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

export default function TaxRedirectScreen() {
  const [settings, setSettings] =
    useState<TaxRedirectSettings | null>(null);

  const [loading, setLoading] = useState(true);

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
        'Informațiile nu au putut fi încărcate.'
      );

      setLoading(false);
      return;
    }

    setSettings(
      data as TaxRedirectSettings | null
    );

    setLoading(false);
  }

  async function openLink(url: string | null) {
    if (!url?.trim()) {
      Alert.alert(
        'Indisponibil',
        'Formularul nu este disponibil momentan.'
      );
      return;
    }

    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert(
        'Eroare',
        'Linkul nu poate fi deschis.'
      );
      return;
    }

    await Linking.openURL(url);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={RED}
        />

        <Text style={styles.loadingText}>
          Se încarcă...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      {/* HEADER */}

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
          Redirecționare fiscală
        </Text>

        <View style={styles.headerSpace} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
      >
        {/* HERO */}

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="document-text"
              size={31}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.heroEyebrow}>
            SUSȚINE MISIUNEA BUCOVINA
          </Text>

          <Text style={styles.heroTitle}>
            {settings?.title ||
              'Redirecționare fiscală'}
          </Text>

          {!!settings?.subtitle && (
            <Text style={styles.heroSubtitle}>
              {settings.subtitle}
            </Text>
          )}
        </View>

        {/* DESCRIPTION */}

        {!!settings?.description && (
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <Ionicons
                name="heart-outline"
                size={24}
                color={RED}
              />
            </View>

            <Text style={styles.introText}>
              {settings.description}
            </Text>
          </View>
        )}

        {/* PERSONE FIZICE */}

        {(settings?.individual_title ||
          settings?.individual_description) && (
          <>
            <Text style={styles.sectionLabel}>
              PERSOANE FIZICE
            </Text>

            <View style={styles.optionCard}>
              <View style={styles.optionTop}>
                <View style={styles.optionIcon}>
                  <Ionicons
                    name="person-outline"
                    size={27}
                    color={RED}
                  />
                </View>

                <View style={styles.optionHeading}>
                  <Text style={styles.optionTitle}>
                    {settings?.individual_title ||
                      'Persoane fizice'}
                  </Text>

                  <Text style={styles.optionTag}>
                    REDIRECȚIONARE IMPOZIT
                  </Text>
                </View>
              </View>

              {!!settings?.individual_description && (
                <Text
                  style={styles.optionDescription}
                >
                  {settings.individual_description}
                </Text>
              )}

              {!!settings?.individual_form_url && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    openLink(
                      settings.individual_form_url
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text
                    style={styles.primaryButtonText}
                  >
                    Deschide formularul
                  </Text>

                  <Ionicons
                    name="open-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* COMPANII */}

        {(settings?.company_title ||
          settings?.company_description) && (
          <>
            <Text style={styles.sectionLabel}>
              COMPANII
            </Text>

            <View style={styles.optionCard}>
              <View style={styles.optionTop}>
                <View style={styles.optionIcon}>
                  <Ionicons
                    name="business-outline"
                    size={27}
                    color={RED}
                  />
                </View>

                <View style={styles.optionHeading}>
                  <Text style={styles.optionTitle}>
                    {settings?.company_title ||
                      'Companii'}
                  </Text>

                  <Text style={styles.optionTag}>
                    SUSȚINE MISIUNEA
                  </Text>
                </View>
              </View>

              {!!settings?.company_description && (
                <Text
                  style={styles.optionDescription}
                >
                  {settings.company_description}
                </Text>
              )}

              {!!settings?.company_form_url && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    openLink(
                      settings.company_form_url
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#FFFFFF"
                  />

                  <Text
                    style={styles.primaryButtonText}
                  >
                    Deschide formularul
                  </Text>

                  <Ionicons
                    name="open-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* CUM FUNCȚIONEAZĂ */}

        {!!settings?.how_it_works && (
          <>
            <Text style={styles.sectionLabel}>
              CUM FUNCȚIONEAZĂ?
            </Text>

            <View style={styles.textCard}>
              <View style={styles.textIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={26}
                  color={RED}
                />
              </View>

              <Text style={styles.bodyText}>
                {settings.how_it_works}
              </Text>
            </View>
          </>
        )}

        {/* DEADLINE */}

        {!!settings?.deadline_text && (
          <>
            <Text style={styles.sectionLabel}>
              TERMEN
            </Text>

            <View style={styles.deadlineCard}>
              <View style={styles.deadlineIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={25}
                  color={RED}
                />
              </View>

              <View style={styles.deadlineContent}>
                <Text style={styles.deadlineTitle}>
                  Termen important
                </Text>

                <Text style={styles.deadlineText}>
                  {settings.deadline_text}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ORGANIZATION */}

        {(settings?.organization_name ||
          settings?.fiscal_code ||
          settings?.bank_account) && (
          <>
            <Text style={styles.sectionLabel}>
              DATELE ORGANIZAȚIEI
            </Text>

            <View style={styles.organizationCard}>
              <View style={styles.organizationHeader}>
                <View style={styles.organizationIcon}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={25}
                    color={RED}
                  />
                </View>

                <View style={styles.organizationHeading}>
                  <Text
                    style={styles.organizationLabel}
                  >
                    BENEFICIAR
                  </Text>

                  <Text
                    style={styles.organizationName}
                  >
                    {settings?.organization_name ||
                      'Misiunea Bucovina'}
                  </Text>
                </View>
              </View>

              {!!settings?.fiscal_code && (
                <InfoRow
                  label="Cod fiscal"
                  value={settings.fiscal_code}
                />
              )}

              {!!settings?.bank_account && (
                <InfoRow
                  label="Cont / IBAN"
                  value={settings.bank_account}
                  last
                />
              )}
            </View>
          </>
        )}

        {/* ADDITIONAL */}

        {!!settings?.additional_info && (
          <>
            <Text style={styles.sectionLabel}>
              INFORMAȚII SUPLIMENTARE
            </Text>

            <View style={styles.textCard}>
              <Text style={styles.bodyText}>
                {settings.additional_info}
              </Text>
            </View>
          </>
        )}

        {/* FINAL */}

        <View style={styles.thankYouCard}>
          <View style={styles.thankYouIcon}>
            <Ionicons
              name="heart"
              size={27}
              color={RED}
            />
          </View>

          <Text style={styles.thankYouTitle}>
            Mulțumim pentru sprijin!
          </Text>

          <Text style={styles.thankYouText}>
            Prin redirecționarea fiscală poți
            susține lucrarea Misiunii Bucovina
            fără o donație suplimentară.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  last?: boolean;
};

function InfoRow({
  label,
  value,
  last = false,
}: InfoRowProps) {
  return (
    <View
      style={[
        styles.infoRow,
        last && styles.infoRowLast,
      ]}
    >
      <Text style={styles.infoRowLabel}>
        {label}
      </Text>

      <Text
        style={styles.infoRowValue}
        selectable
      >
        {value}
      </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
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
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: '900',
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
    borderRadius: 26,
    padding: 24,
  },

  heroIcon: {
    width: 57,
    height: 57,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 19,
  },

  heroEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    marginTop: 5,
  },

  heroSubtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
  },

  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  introIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  introText: {
    flex: 1,
    color: '#555555',
    fontSize: 12,
    lineHeight: 19,
    marginLeft: 12,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 25,
    marginBottom: 9,
    marginLeft: 5,
  },

  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },

  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionHeading: {
    flex: 1,
    marginLeft: 13,
  },

  optionTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '900',
  },

  optionTag: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginTop: 4,
  },

  optionDescription: {
    color: '#666666',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 15,
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: RED,
    marginTop: 17,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginHorizontal: 8,
  },

  textCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },

  textIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  bodyText: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 20,
  },

  deadlineCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  deadlineIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  deadlineContent: {
    flex: 1,
    marginLeft: 12,
  },

  deadlineTitle: {
    color: RED,
    fontSize: 12,
    fontWeight: '900',
  },

  deadlineText: {
    color: '#6F4A4A',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  organizationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
  },

  organizationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  organizationIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  organizationHeading: {
    flex: 1,
    marginLeft: 12,
  },

  organizationLabel: {
    color: '#999999',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  organizationName: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 3,
  },

  infoRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  infoRowLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '800',
  },

  infoRowValue: {
    color: DARK,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  thankYouCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginTop: 25,
  },

  thankYouIcon: {
    width: 51,
    height: 51,
    borderRadius: 17,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  thankYouTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 11,
  },

  thankYouText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },
});