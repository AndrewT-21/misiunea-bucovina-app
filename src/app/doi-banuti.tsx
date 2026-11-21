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

export default function TwoCentsScreen() {
  const [settings, setSettings] =
    useState<TwoCentsSettings | null>(null);

  const [loading, setLoading] = useState(true);

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
      console.log(
        'Eroare încărcare Doi Bănuți:',
        error
      );

      Alert.alert(
        'Eroare',
        'Informațiile nu au putut fi încărcate.'
      );

      setLoading(false);
      return;
    }

    setSettings(data as TwoCentsSettings | null);
    setLoading(false);
  }

  async function openLink(url: string | null) {
    if (!url) {
      Alert.alert(
        'Indisponibil',
        'Linkul nu este disponibil momentan.'
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

  const current = settings?.supporters_current ?? 0;
  const goal = settings?.supporters_goal ?? 0;

  const progress =
    goal > 0
      ? Math.min(Math.max(current / goal, 0), 1)
      : 0;

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
          Doi Bănuți pe Zi
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
              name="heart"
              size={30}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.heroEyebrow}>
            MISIUNEA BUCOVINA
          </Text>

          <Text style={styles.heroTitle}>
            {settings?.title ||
              'Doi Bănuți pe Zi'}
          </Text>

          {!!settings?.subtitle && (
            <Text style={styles.heroSubtitle}>
              {settings.subtitle}
            </Text>
          )}

          <View style={styles.amountBadge}>
            <Text style={styles.amountSmall}>
              DOAR
            </Text>

            <Text style={styles.amount}>
              {settings?.daily_amount || '2 lei'}
            </Text>

            <Text style={styles.amountSmall}>
              PE ZI
            </Text>
          </View>
        </View>

        {/* DESCRIPTION */}

        {!!settings?.description && (
          <View style={styles.introCard}>
            <Ionicons
              name="heart-outline"
              size={25}
              color={RED}
            />

            <Text style={styles.introText}>
              {settings.description}
            </Text>
          </View>
        )}

        {/* PROGRESS */}

        {goal > 0 && (
          <>
            <Text style={styles.sectionLabel}>
              ÎMPREUNĂ SPRE OBIECTIV
            </Text>

            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <View>
                  <Text style={styles.progressNumber}>
                    {current}
                  </Text>

                  <Text style={styles.progressCaption}>
                    susținători
                  </Text>
                </View>

                <View style={styles.goalBlock}>
                  <Text style={styles.goalLabel}>
                    OBIECTIV
                  </Text>

                  <Text style={styles.goalNumber}>
                    {goal}
                  </Text>
                </View>
              </View>

              <View style={styles.progressBackground}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress * 100}%`,
                    },
                  ]}
                />
              </View>

              <Text style={styles.progressText}>
                {Math.round(progress * 100)}% din
                obiectiv
              </Text>
            </View>
          </>
        )}

        {/* DONATION OPTIONS */}

        <Text style={styles.sectionLabel}>
          ALEGE CUM VREI SĂ SUSȚII
        </Text>

        <View style={styles.optionsCard}>
          {!!settings?.weekly_text && (
            <SupportOption
              icon="calendar-outline"
              title="Săptămânal"
              description={settings.weekly_text}
            />
          )}

          {!!settings?.monthly_text && (
            <SupportOption
              icon="repeat-outline"
              title="Lunar"
              description={settings.monthly_text}
            />
          )}

          {!!settings?.quarterly_text && (
            <SupportOption
              icon="calendar-number-outline"
              title="Trimestrial"
              description={settings.quarterly_text}
              last
            />
          )}
        </View>

        {!!settings?.donation_url && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              openLink(settings.donation_url)
            }
            activeOpacity={0.85}
          >
            <Ionicons
              name="heart"
              size={20}
              color="#FFFFFF"
            />

            <Text style={styles.primaryButtonText}>
              Susține proiectul
            </Text>
          </TouchableOpacity>
        )}

        {/* HOW IT WORKS */}

        {!!settings?.how_it_works && (
          <>
            <Text style={styles.sectionLabel}>
              CUM FUNCȚIONEAZĂ?
            </Text>

            <View style={styles.textCard}>
              <View style={styles.textCardIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={25}
                  color={RED}
                />
              </View>

              <Text style={styles.bodyText}>
                {settings.how_it_works}
              </Text>
            </View>
          </>
        )}

        {/* BAG */}

        {(settings?.bag_title ||
          settings?.bag_description) && (
          <>
            <Text style={styles.sectionLabel}>
              SĂCULEȚUL DOI BĂNUȚI
            </Text>

            <View style={styles.bagCard}>
              <View style={styles.bagIcon}>
                <Ionicons
                  name="wallet-outline"
                  size={30}
                  color={RED}
                />
              </View>

              <Text style={styles.bagTitle}>
                {settings?.bag_title ||
                  'Săculețul Doi Bănuți'}
              </Text>

              {!!settings?.bag_description && (
                <Text style={styles.bagDescription}>
                  {settings.bag_description}
                </Text>
              )}

              {!!settings?.bag_url && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() =>
                    openLink(settings.bag_url)
                  }
                >
                  <Text
                    style={styles.secondaryButtonText}
                  >
                    Comandă săculețul
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={RED}
                  />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* STORY */}

        {!!settings?.story && (
          <>
            <Text style={styles.sectionLabel}>
              POVESTEA PROIECTULUI
            </Text>

            <View style={styles.textCard}>
              <Text style={styles.bodyText}>
                {settings.story}
              </Text>
            </View>
          </>
        )}

        {/* BANK TRANSFER */}

        <Text style={styles.sectionLabel}>
          TRANSFER BANCAR
        </Text>

        <TouchableOpacity
          style={styles.bankCard}
          onPress={() =>
            router.push('/transfer-bancar')
          }
          activeOpacity={0.8}
        >
          <View style={styles.bankIcon}>
            <Ionicons
              name="business-outline"
              size={25}
              color={RED}
            />
          </View>

          <View style={styles.bankContent}>
            <Text style={styles.bankTitle}>
              Donează prin transfer bancar
            </Text>

            {!!settings?.bank_transfer_note && (
              <Text style={styles.bankDescription}>
                Mențiune:{' '}
                {settings.bank_transfer_note}
              </Text>
            )}
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#999999"
          />
        </TouchableOpacity>

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

        {/* END MESSAGE */}

        <View style={styles.thankYouCard}>
          <Ionicons
            name="heart"
            size={27}
            color={RED}
          />

          <Text style={styles.thankYouTitle}>
            Mulțumim că alegi să ajuți!
          </Text>

          <Text style={styles.thankYouText}>
            Un gest mic, făcut cu credincioșie, poate
            aduce o schimbare mare în viața cuiva.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type SupportOptionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  last?: boolean;
};

function SupportOption({
  icon,
  title,
  description,
  last = false,
}: SupportOptionProps) {
  return (
    <View
      style={[
        styles.supportOption,
        last && styles.supportOptionLast,
      ]}
    >
      <View style={styles.supportIcon}>
        <Ionicons
          name={icon}
          size={22}
          color={RED}
        />
      </View>

      <View style={styles.supportContent}>
        <Text style={styles.supportTitle}>
          {title}
        </Text>

        <Text style={styles.supportDescription}>
          {description}
        </Text>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
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
    borderRadius: 26,
    padding: 24,
  },

  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 19,
  },

  heroEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
    marginTop: 5,
  },

  heroSubtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },

  amountBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginTop: 20,
  },

  amount: {
    color: RED,
    fontSize: 24,
    fontWeight: '900',
    marginHorizontal: 5,
  },

  amountSmall: {
    color: '#777777',
    fontSize: 8,
    fontWeight: '900',
  },

  introCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 19,
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
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

  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },

  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  progressNumber: {
    color: RED,
    fontSize: 31,
    fontWeight: '900',
  },

  progressCaption: {
    color: '#777777',
    fontSize: 10,
  },

  goalBlock: {
    alignItems: 'flex-end',
  },

  goalLabel: {
    color: '#AAAAAA',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  goalNumber: {
    color: DARK,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },

  progressBackground: {
    height: 9,
    backgroundColor: '#F0E4E4',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 16,
  },

  progressFill: {
    height: '100%',
    backgroundColor: RED,
    borderRadius: 10,
  },

  progressText: {
    color: '#888888',
    fontSize: 9,
    marginTop: 8,
  },

  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },

  supportOption: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },

  supportOptionLast: {
    borderBottomWidth: 0,
  },

  supportIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  supportContent: {
    flex: 1,
    marginLeft: 12,
  },

  supportTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
  },

  supportDescription: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  primaryButton: {
    height: 55,
    borderRadius: 17,
    backgroundColor: RED,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 8,
  },

  textCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },

  textCardIcon: {
    width: 44,
    height: 44,
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

  bagCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },

  bagIcon: {
    width: 53,
    height: 53,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bagTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 14,
  },

  bagDescription: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 7,
  },

  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    marginTop: 15,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  secondaryButtonText: {
    color: RED,
    fontSize: 11,
    fontWeight: '900',
  },

  bankCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  bankIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bankContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  bankTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
  },

  bankDescription: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  thankYouCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginTop: 25,
  },

  thankYouTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
  },

  thankYouText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },
});