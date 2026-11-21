import { Alert } from '../../../lib/platform-alert';
import SchoolAdminGate from '../../../components/SchoolAdminGate';

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ActivityIndicator,
  
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BG = '#F7F6F3';

type ApplicationStatus =
  | 'noua'
  | 'in_analiza'
  | 'acceptata'
  | 'respinsa';

type Application = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  city: string;
  county: string | null;
  experience: string | null;
  domains: string[];
  status: ApplicationStatus;
  created_at: string;
};

const STATUS_OPTIONS: {
  value: ApplicationStatus;
  label: string;
  color: string;
}[] = [
  { value: 'noua', label: 'Nouă', color: '#B7791F' },
  { value: 'in_analiza', label: 'În analiză', color: '#2563EB' },
  { value: 'acceptata', label: 'Acceptată', color: '#15803D' },
  { value: 'respinsa', label: 'Respinsă', color: '#B91C1C' },
];

function getErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String(error.message);
  }

  return 'A apărut o eroare necunoscută.';
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SchoolApplicationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadApplication = useCallback(async () => {
    if (!id) {
      Alert.alert('Eroare', 'ID-ul înscrierii lipsește.');
      router.back();
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          'Acces restricționat',
          'Trebuie să fii autentificat ca administrator.'
        );
        router.back();
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (adminError) throw adminError;

      if (!admin) {
        Alert.alert(
          'Acces interzis',
          'Nu ai permisiunea să vezi această înscriere.'
        );
        router.back();
        return;
      }

      const { data, error } = await supabase
        .from('school_instructor_applications')
        .select(
          'id, full_name, phone, email, city, county, experience, domains, status, created_at'
        )
        .eq('id', id)
        .single();

      if (error) throw error;

      setApplication(data as Application);
    } catch (error) {
      Alert.alert('Eroare la încărcare', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadApplication();
    }, [loadApplication])
  );

  async function changeStatus(newStatus: ApplicationStatus) {
    if (!application || saving || deleting) return;
    if (application.status === newStatus) return;

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('school_instructor_applications')
        .update({ status: newStatus })
        .eq('id', application.id)
        .select('id, status')
        .single();

      if (error) throw error;

      setApplication((previous) =>
        previous
          ? { ...previous, status: data.status as ApplicationStatus }
          : previous
      );

      Alert.alert(
        'Status actualizat',
        'Statusul înscrierii a fost modificat cu succes.'
      );
    } catch (error) {
      Alert.alert('Eroare la salvare', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!application || saving || deleting) return;

    Alert.alert(
      'Șterge înscrierea?',
      `Ești sigur că vrei să ștergi definitiv înscrierea lui ${application.full_name}? Această acțiune nu poate fi anulată.`,
      [
        {
          text: 'Anulează',
          style: 'cancel',
        },
        {
          text: 'Șterge definitiv',
          style: 'destructive',
          onPress: () => {
            void deleteApplication();
          },
        },
      ]
    );
  }

  async function deleteApplication() {
    if (!application || deleting || saving) return;

    setDeleting(true);

    try {
      const { data, error } = await supabase
        .from('school_instructor_applications')
        .delete()
        .eq('id', application.id)
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error(
          'Înscrierea nu a fost ștearsă. Verifică permisiunile din Supabase.'
        );
      }

      Alert.alert(
        'Înscriere ștearsă',
        'Înscrierea a fost eliminată definitiv.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Eroare la ștergere', getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  async function openPhone() {
    if (!application) return;

    try {
      await Linking.openURL(`tel:${application.phone}`);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut deschide aplicația Telefon.');
    }
  }

  async function openEmail() {
    if (!application) return;

    try {
      await Linking.openURL(`mailto:${application.email}`);
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut deschide aplicația de e-mail.');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RED} />
          <Text style={styles.loadingText}>Se încarcă înscrierea...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Înscrierea nu a putut fi încărcată.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Înapoi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatus = STATUS_OPTIONS.find(
    (item) => item.value === application.status
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBack}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={DARK} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.eyebrow}>ADMINISTRARE</Text>
          <Text style={styles.headerTitle}>Detalii înscriere</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={30} color={RED} />
          </View>

          <Text style={styles.name}>{application.full_name}</Text>

          <Text style={styles.date}>
            Înscris la {formatDate(application.created_at)}
          </Text>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  (currentStatus?.color ?? RED) + '15',
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: currentStatus?.color ?? RED },
              ]}
            >
              {currentStatus?.label ?? application.status}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>DATE PERSONALE</Text>

        <View style={styles.card}>
          <InfoRow
            icon="person-outline"
            label="Nume și prenume"
            value={application.full_name}
          />

          <InfoRow
            icon="location-outline"
            label="Localitate"
            value={application.city}
          />

          <InfoRow
            icon="map-outline"
            label="Județ"
            value={application.county || 'Nespecificat'}
          />

          <TouchableOpacity onPress={openPhone}>
            <InfoRow
              icon="call-outline"
              label="Telefon"
              value={application.phone}
              accent
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={openEmail}>
            <InfoRow
              icon="mail-outline"
              label="E-mail"
              value={application.email}
              accent
              last
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>EXPERIENȚĂ</Text>

        <View style={styles.card}>
          <Text style={styles.bodyText}>
            {application.experience?.trim() ||
              'Nu a fost specificată experiența.'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>DOMENII SELECTATE</Text>

        <View style={styles.card}>
          <View style={styles.domainsContainer}>
            {(application.domains ?? []).map((domain) => (
              <View key={domain} style={styles.domainChip}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={RED}
                />
                <Text style={styles.domainText}>{domain}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.sectionLabel}>STATUSUL ÎNSCRIERII</Text>

        <View style={styles.card}>
          <Text style={styles.helperText}>
            Selectează statusul pe care dorești să îl atribui
            acestei înscrieri.
          </Text>

          {STATUS_OPTIONS.map((option) => {
            const selected = application.status === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  selected && styles.statusOptionSelected,
                ]}
                onPress={() => void changeStatus(option.value)}
                disabled={saving || deleting}
              >
                <View style={styles.statusOptionLeft}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: option.color },
                    ]}
                  />
                  <Text style={styles.statusOptionText}>
                    {option.label}
                  </Text>
                </View>

                {saving && selected ? (
                  <ActivityIndicator size="small" color={RED} />
                ) : (
                  <Ionicons
                    name={
                      selected
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                    color={selected ? RED : '#C8C8C8'}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>ADMINISTRARE</Text>

        <View style={styles.deleteCard}>
          <View style={styles.deleteInfo}>
            <Ionicons
              name="trash-outline"
              size={23}
              color="#B91C1C"
            />

            <View style={styles.deleteInfoText}>
              <Text style={styles.deleteTitle}>
                Șterge înscrierea
              </Text>
              <Text style={styles.deleteDescription}>
                Elimină definitiv această înscriere din baza de date.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.deleteButton,
              (saving || deleting) && styles.disabled,
            ]}
            onPress={confirmDelete}
            disabled={saving || deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="trash-outline"
                  size={19}
                  color="#FFFFFF"
                />
                <Text style={styles.deleteButtonText}>
                  Șterge înscrierea
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  accent = false,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={19} color={RED} />
      </View>

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={[
            styles.infoValue,
            accent && styles.infoValueAccent,
          ]}
        >
          {value}
        </Text>
      </View>

      {accent && (
        <Ionicons
          name="open-outline"
          size={17}
          color="#AAAAAA"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  loadingText: {
    marginTop: 12,
    color: '#777777',
  },
  emptyText: {
    color: DARK,
    fontSize: 15,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: RED,
    paddingHorizontal: 25,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 15,
  },
  headerBack: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    marginLeft: 13,
    flex: 1,
  },
  eyebrow: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerTitle: {
    color: DARK,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 2,
  },
  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 16,
    paddingBottom: 45,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 23,
    alignItems: 'center',
  },
  avatar: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    color: DARK,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'center',
  },
  date: {
    color: '#888888',
    fontSize: 11,
    marginTop: 7,
    textAlign: 'center',
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginTop: 14,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  sectionLabel: {
    color: '#999999',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 23,
    marginBottom: 10,
    marginLeft: 5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: '#FFF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: '#999999',
    fontSize: 11,
    marginBottom: 4,
  },
  infoValue: {
    color: DARK,
    fontSize: 14,
    fontWeight: '700',
  },
  infoValueAccent: {
    color: RED,
  },
  bodyText: {
    color: '#555555',
    fontSize: 13,
    lineHeight: 21,
  },
  domainsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  domainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FFF1F1',
  },
  domainText: {
    color: RED,
    fontSize: 12,
    fontWeight: '700',
  },
  helperText: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  statusOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  statusOptionSelected: {
    borderColor: RED,
    backgroundColor: '#FFF7F7',
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOptionText: {
    color: DARK,
    fontSize: 13,
    fontWeight: '800',
  },
  deleteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 18,
  },
  deleteInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  deleteInfoText: {
    flex: 1,
  },
  deleteTitle: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '900',
  },
  deleteDescription: {
    color: '#777777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  deleteButton: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#B91C1C',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
});

export default function ProtectedSchoolApplicationDetailsScreen() {
  return <SchoolAdminGate permission="can_view"><SchoolApplicationDetailsScreen /></SchoolAdminGate>;
}
