import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Platform, ActivityIndicator,
  
  ScrollView,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type Status =
  | 'new'
  | 'contacted'
  | 'accepted'
  | 'rejected';

type VolunteerApplication = {
  id: string;
  name: string;
  profile_photo_path: string | null;
  birth_date: string | null;
  country: string | null;
  city: string | null;
  phone: string | null;
  email: string;
  message: string | null;
  involvement_options: string[] | null;
  status: Status;
  created_at: string;
};

const statusOptions: {
  value: Status;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'new',
    label: 'Nou',
    icon: 'sparkles-outline',
  },
  {
    value: 'contacted',
    label: 'Contactat',
    icon: 'call-outline',
  },
  {
    value: 'accepted',
    label: 'Acceptat',
    icon: 'checkmark-circle-outline',
  },
  {
    value: 'rejected',
    label: 'Respins',
    icon: 'close-circle-outline',
  },
];

export default function VolunteerDetailsScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [application, setApplication] =
    useState<VolunteerApplication | null>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      loadApplication();
    }
  }, [id]);

  async function loadApplication() {
    setLoading(true);

    const { data, error } = await supabase
      .from('volunteer_applications')
      .select(
        `
          id,
          name,
          profile_photo_path,
          birth_date,
          country,
          city,
          phone,
          email,
          message,
          involvement_options,
          status,
          created_at
        `
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.log(
        'Eroare încărcare cerere:',
        error
      );
    }

    setApplication(
      error
        ? null
        : (data as VolunteerApplication | null)
    );

    setPhotoUrl(null);
    if (!error && data?.profile_photo_path) {
      const {data: signed, error: signError} = await supabase.storage.from('volunteer-profile-photos')
        .createSignedUrl(data.profile_photo_path, 3600);
      if (!signError && signed?.signedUrl) setPhotoUrl(signed.signedUrl);
    }
    setLoading(false);
  }

  async function changeStatus(status: Status) {
    if (!application || updating) {
      return;
    }

    if (application.status === status) {
      return;
    }

    setUpdating(true);

    const { error } = await supabase
      .from('volunteer_applications')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', application.id);

    setUpdating(false);

    if (error) {
      console.log(
        'Eroare actualizare status:',
        error
      );

      Alert.alert(
        'Eroare',
        'Statusul nu a putut fi actualizat.'
      );

      return;
    }

    setApplication({
      ...application,
      status,
    });
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString(
      'ro-RO',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color={RED}
          />

          <Text style={styles.loadingText}>
            Se încarcă cererea...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/admin/volunteers')}
          >
            <Ionicons
              name="chevron-back"
              size={23}
              color={DARK}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Cerere voluntariat
          </Text>

          <View style={styles.headerSpace} />
        </View>

        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={45}
            color={RED}
          />

          <Text style={styles.notFoundTitle}>
            Cererea nu a fost găsită
          </Text>
        </View>
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
          onPress={() => router.canGoBack() ? router.back() : router.replace('/admin/volunteers')}
        >
          <Ionicons
            name="chevron-back"
            size={23}
            color={DARK}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Cerere voluntariat
        </Text>

        <View style={styles.headerSpace} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* VOLUNTEER */}

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {photoUrl ? <Image source={{uri:photoUrl}} style={{width:72,height:72,borderRadius:36}} /> : <Ionicons
              name="person"
              size={31}
              color={RED}
            />}
          </View>

          <Text style={styles.name}>
            {application.name}
          </Text>

          <Text style={styles.email}>
            {application.email}
          </Text>

          <View style={styles.submittedBadge}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color="#777777"
            />

            <Text style={styles.submittedText}>
              Înscris la{' '}
              {formatDate(application.created_at)}
            </Text>
          </View>
        </View>

        {/* STATUS */}

        <View style={styles.section}>
          <Text style={styles.sectionSmall}>
            ADMINISTRARE
          </Text>

          <Text style={styles.sectionTitle}>
            Status cerere
          </Text>

          <Text style={styles.sectionDescription}>
            Selectează stadiul actual al acestei
            cereri.
          </Text>

          <View style={styles.statusGrid}>
            {statusOptions.map((option) => {
              const selected =
                application.status === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.statusOption,
                    selected &&
                      styles.statusOptionSelected,
                  ]}
                  disabled={updating}
                  onPress={() =>
                    changeStatus(option.value)
                  }
                >
                  <Ionicons
                    name={option.icon}
                    size={20}
                    color={
                      selected ? '#FFFFFF' : RED
                    }
                  />

                  <Text
                    style={[
                      styles.statusOptionText,
                      selected &&
                        styles.statusOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {updating ? (
            <View style={styles.updatingRow}>
              <ActivityIndicator
                size="small"
                color={RED}
              />

              <Text style={styles.updatingText}>
                Se actualizează...
              </Text>
            </View>
          ) : null}
        </View>

        {/* CONTACT */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Date de contact
          </Text>

          <InfoRow
            icon="mail-outline"
            label="Email"
            value={application.email}
          />

          {application.phone ? (
            <InfoRow
              icon="logo-whatsapp"
              label="WhatsApp"
              value={application.phone}
            />
          ) : null}

          {application.birth_date ? (
            <InfoRow
              icon="calendar-outline"
              label="Data nașterii"
              value={application.birth_date}
            />
          ) : null}

          {application.city ? (
            <InfoRow
              icon="location-outline"
              label="Localitate"
              value={application.city}
            />
          ) : null}

          {application.country ? (
            <InfoRow
              icon="globe-outline"
              label="Țara"
              value={application.country}
            />
          ) : null}
        </View>

        {/* INVOLVEMENT */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Domenii de implicare
          </Text>

          {application.involvement_options &&
          application.involvement_options.length >
            0 ? (
            <View style={styles.options}>
              {application.involvement_options.map(
                (option) => (
                  <View
                    key={option}
                    style={styles.option}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={RED}
                    />

                    <Text style={styles.optionText}>
                      {option}
                    </Text>
                  </View>
                )
              )}
            </View>
          ) : (
            <Text style={styles.noData}>
              Nu au fost selectate domenii.
            </Text>
          )}
        </View>

        {/* MESSAGE */}

        {application.message ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Mesaj
            </Text>

            <View style={styles.messageBox}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={21}
                color={RED}
              />

              <Text style={styles.message}>
                {application.message}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.id}>
          ID cerere: {application.id}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={RED}
        />
      </View>

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
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

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    minHeight: 76,
    backgroundColor: BACKGROUND,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? {} : { borderBottomWidth: 1, borderBottomColor: '#EEEEEE' }),
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
  },

  headerSpace: {
    width: 0,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 10,
  },

  notFoundTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
  },

  profileCard: {
    backgroundColor: RED,
    borderRadius: 23,
    padding: 23,
    alignItems: 'center',
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 13,
  },

  email: {
    color: '#FFFFFF',
    opacity: 0.8,
    fontSize: 11,
    marginTop: 4,
  },

  submittedBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
  },

  submittedText: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 9,
  },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 13,
  },

  sectionSmall: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  sectionTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
  },

  sectionDescription: {
    color: '#888888',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 15,
  },

  statusOption: {
    width: '48%',
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#FFF0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  statusOptionSelected: {
    backgroundColor: RED,
  },

  statusOptionText: {
    color: RED,
    fontSize: 10,
    fontWeight: '900',
  },

  statusOptionTextSelected: {
    color: '#FFFFFF',
  },

  updatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
  },

  updatingText: {
    color: '#777777',
    fontSize: 9,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },

  infoIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoLabel: {
    color: '#999999',
    fontSize: 8,
    fontWeight: '800',
  },

  infoValue: {
    color: DARK,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  options: {
    marginTop: 10,
    gap: 7,
  },

  option: {
    minHeight: 43,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  optionText: {
    flex: 1,
    color: '#555555',
    fontSize: 11,
    fontWeight: '700',
  },

  noData: {
    color: '#888888',
    fontSize: 10,
    marginTop: 10,
  },

  messageBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
    marginTop: 11,
  },

  message: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 9,
  },

  id: {
    color: '#AAAAAA',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 14,
  },
});