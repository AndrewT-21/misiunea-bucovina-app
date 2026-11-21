import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';

type DonationSettings = {
  id: string;
  bank_transfer_details: string | null;
  online_donation_url: string | null;
  monthly_donation_url: string | null;
  two_cents_text: string | null;
  tax_redirect_text: string | null;
};

export default function DonateScreen() {
  const { specification, sourceType } = useLocalSearchParams<{
    specification?: string;
    sourceType?: 'case' | 'project';
  }>();

  const donationSpecification = Array.isArray(specification)
    ? specification[0]
    : specification;

  const [settings, setSettings] =
    useState<DonationSettings | null>(null);

  const [loading, setLoading] = useState(true);

  async function loadDonationSettings() {
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

      setLoading(false);
      return;
    }

    setSettings(data as DonationSettings | null);
    setLoading(false);
  }

  useEffect(() => {
  loadDonationSettings();
}, []);
async function openLink(url: string | null) {
  if (!url) {
    Alert.alert(
      'Indisponibil',
      'Această opțiune de donație nu este disponibilă momentan.'
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

function showTextDetails(
  title: string,
  text: string | null
) {
  if (!text?.trim()) {
    Alert.alert(
      'Indisponibil',
      'Informațiile pentru această opțiune nu sunt disponibile momentan.'
    );
    return;
  }

  Alert.alert(title, text);
}



  return (
    <SafeAreaView style={styles.screen}>
      {/* HEADER */}
      <MisiBiPageHeader title="Donează" eyebrow="MISIUNEA BUCOVINA" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
      >
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="heart" size={32} color="#FFFFFF" />
          </View>

          <Text style={styles.heroTitle}>
            Împreună putem face{'\n'}o diferență
          </Text>

          <Text style={styles.heroText}>
            Prin donația ta, Misiunea Bucovina poate continua să
            ofere ajutor concret oamenilor și familiilor aflate în nevoie.
          </Text>
        </View>

        {donationSpecification ? (
          <View style={styles.specificationCard}>
            <View style={styles.specificationIcon}>
              <Ionicons
                name={sourceType === 'project' ? 'gift-outline' : 'heart-outline'}
                size={23}
                color={RED}
              />
            </View>

            <View style={styles.specificationContent}>
              <Text style={styles.specificationLabel}>
                {sourceType === 'project'
                  ? 'SPRIJIN PENTRU PROIECT'
                  : 'SPECIFICAȚIE DONAȚIE'}
              </Text>

              <Text style={styles.specificationValue}>
                {donationSpecification}
              </Text>

              <Text style={styles.specificationHelp}>
                Folosește această specificație atunci când faci donația.
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>
          Alege cum vrei să ajuți
        </Text>

        {/* DONAȚIE ONLINE */}
        <TouchableOpacity
  style={styles.optionCard}
  onPress={() =>
    openLink(settings?.online_donation_url ?? null)
  }
>
          <View style={styles.optionIcon}>
            <Ionicons name="card-outline" size={27} color={RED} />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Donează online
            </Text>

            <Text style={styles.optionDescription}>
              Donează rapid și în siguranță folosind cardul.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#999999"
          />
        </TouchableOpacity>

        {/* DONAȚIE LUNARĂ */}
        <TouchableOpacity
  style={styles.optionCard}
  onPress={() =>
    openLink(settings?.monthly_donation_url ?? null)
  }
>
          <View style={styles.optionIcon}>
            <Ionicons name="repeat-outline" size={27} color={RED} />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Donație lunară
            </Text>

            <Text style={styles.optionDescription}>
              Susține constant lucrarea Misiunii Bucovina.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#999999"
          />
        </TouchableOpacity>

        {/* TRANSFER BANCAR */}
        <TouchableOpacity
  style={styles.optionCard}
  onPress={() =>
    router.push({
      pathname: '/transfer-bancar',
      params: donationSpecification
        ? {
            specification: donationSpecification,
            sourceType: sourceType ?? 'case',
          }
        : {},
    })
  }
>
          <View style={styles.optionIcon}>
            <Ionicons name="business-outline" size={27} color={RED} />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Transfer bancar
            </Text>

            <Text style={styles.optionDescription}>
              Vezi conturile și informațiile necesare pentru transfer.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#999999"
          />
        </TouchableOpacity>

        {/* DOI BĂNUȚI */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => router.push('/doi-banuti')}
        >
          <View style={styles.optionIcon}>
            <Ionicons name="wallet-outline" size={27} color={RED} />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Doi Bănuți pe Zi
            </Text>

            <Text style={styles.optionDescription}>
              Un gest mic și constant poate avea un impact mare.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#999999"
          />
        </TouchableOpacity>

        {/* FISCAL */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={() =>
            router.push('/redirectionare-fiscala')
          }
        >
          <View style={styles.optionIcon}>
            <Ionicons name="document-text-outline" size={27} color={RED} />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Redirecționare fiscală
            </Text>

            <Text style={styles.optionDescription}>
              Susține Misiunea Bucovina prin redirecționarea
              unei părți din impozit.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#999999"
          />
        </TouchableOpacity>

        {/* MESSAGE */}
        <View style={styles.messageCard}>
          <Ionicons
            name="heart-outline"
            size={28}
            color={RED}
          />

          <Text style={styles.messageTitle}>
            Mulțumim pentru sprijin!
          </Text>

          <Text style={styles.messageText}>
            Fiecare contribuție ne ajută să continuăm lucrarea și
            să fim alături de cei care au nevoie.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F6F6',
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

  content: { maxWidth: 1120, width: '100%', alignSelf: 'center',
    padding: 15,
    paddingBottom: 40,
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

  specificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 16,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#F1D6D6',
  },

  specificationIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  specificationContent: {
    flex: 1,
    marginLeft: 13,
  },

  specificationLabel: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  specificationValue: {
    color: DARK,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: 4,
  },

  specificationHelp: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  sectionTitle: {
    color: DARK,
    fontSize: 21,
    fontWeight: '900',
    marginTop: 27,
    marginBottom: 13,
  },

  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  optionContent: {
    flex: 1,
    marginLeft: 13,
    marginRight: 7,
  },

  optionTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: '800',
  },

  optionDescription: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 22,
    marginTop: 18,
    alignItems: 'center',
  },

  messageTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 10,
  },

  messageText: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
});