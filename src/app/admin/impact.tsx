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

type ImpactStats = {
  id: string;
  children_helped: string;
  families_supported: string;
  wood_tons: string;
  food_tons: string;
};

export default function AdminImpactScreen() {
  const [impactId, setImpactId] =
    useState<string | null>(null);

  const [childrenHelped, setChildrenHelped] =
    useState('');

  const [familiesSupported, setFamiliesSupported] =
    useState('');

  const [woodTons, setWoodTons] =
    useState('');

  const [foodTons, setFoodTons] =
    useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadImpact();
  }, []);

  async function loadImpact() {
    setLoading(true);

    const { data, error } = await supabase
      .from('impact_stats')
      .select(`
        id,
        children_helped,
        families_supported,
        wood_tons,
        food_tons
      `)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(
        'Eroare încărcare impact:',
        error
      );

      Alert.alert(
        'Eroare',
        'Datele de impact nu au putut fi încărcate.'
      );

      setLoading(false);
      return;
    }

    if (data) {
      const impact = data as ImpactStats;

      setImpactId(impact.id);
      setChildrenHelped(impact.children_helped);
      setFamiliesSupported(
        impact.families_supported
      );
      setWoodTons(impact.wood_tons);
      setFoodTons(impact.food_tons);
    }

    setLoading(false);
  }

  async function saveImpact() {
    if (
      !childrenHelped.trim() ||
      !familiesSupported.trim() ||
      !woodTons.trim() ||
      !foodTons.trim()
    ) {
      Alert.alert(
        'Câmpuri incomplete',
        'Completează toate valorile de impact.'
      );

      return;
    }

    if (!impactId) {
      Alert.alert(
        'Eroare',
        'Nu a fost găsit setul de date pentru impact.'
      );

      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('impact_stats')
        .update({
          children_helped: childrenHelped.trim(),
          families_supported:
            familiesSupported.trim(),
          wood_tons: woodTons.trim(),
          food_tons: foodTons.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', impactId);

      if (error) {
        console.log(
          'Eroare salvare impact:',
          error
        );

        Alert.alert(
          'Eroare',
          'Modificările nu au putut fi salvate.'
        );

        return;
      }

      Alert.alert(
  'Impact actualizat',
  'Valorile au fost salvate cu succes.',
  [
    {
      text: 'OK',
      onPress: () => router.back(),
    },
  ]
);
    } catch (error) {
      console.log(
        'Eroare neașteptată:',
        error
      );

      Alert.alert(
        'Eroare',
        'A apărut o problemă neașteptată.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator
          size="large"
          color={RED}
        />

        <Text style={styles.loadingText}>
          Se încarcă impactul...
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

            <Text style={styles.title}>
              Impact
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
                name="stats-chart-outline"
                size={24}
                color={RED}
              />
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                Impactul Misiunii Bucovina
              </Text>

              <Text style={styles.infoText}>
                Modificările salvate aici vor fi
                afișate în aplicație.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>
            VALORI DE IMPACT
          </Text>

          <View style={styles.card}>
            <ImpactField
              icon="school-outline"
              label="Copii ajutați pentru școală"
              value={childrenHelped}
              onChangeText={setChildrenHelped}
              placeholder="Ex: 5.500+"
            />

            <ImpactField
              icon="basket-outline"
              label="Familii susținute cu hrană"
              value={familiesSupported}
              onChangeText={setFamiliesSupported}
              placeholder="Ex: 1.000+"
            />

            <ImpactField
              icon="flame-outline"
              label="Tone de lemne oferite"
              value={woodTons}
              onChangeText={setWoodTons}
              placeholder="Ex: 900+"
            />

            <ImpactField
              icon="nutrition-outline"
              label="Tone de alimente donate"
              value={foodTons}
              onChangeText={setFoodTons}
              placeholder="Ex: 400+"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveImpact}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={20}
                  color="#FFFFFF"
                />

                <Text style={styles.saveText}>
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

type ImpactFieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
};

function ImpactField({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
}: ImpactFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <View style={styles.fieldIcon}>
          <Ionicons
            name={icon}
            size={20}
            color={RED}
          />
        </View>

        <Text style={styles.label}>
          {label}
        </Text>
      </View>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#AAAAAA"
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  center: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 10,
  },

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: 13,
  },

  eyebrow: {
    color: RED,
    fontSize:10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  title: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 40,
  },

  infoCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 19,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoContent: {
    flex: 1,
    marginLeft: 12,
  },

  infoTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
  },

  infoText: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginLeft: 5,
    marginTop: 24,
    marginBottom: 9,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
    gap: 18,
  },

  field: {
    gap: 8,
  },

  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  fieldIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    flex: 1,
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 10,
  },

  input: {
    minHeight: 50,
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 14,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  saveButton: {
    minHeight: 55,
    borderRadius: 16,
    backgroundColor: RED,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});