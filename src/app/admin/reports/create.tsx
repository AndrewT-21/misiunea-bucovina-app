import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
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

import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

export default function CreateReportScreen() {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState(
    new Date().getFullYear().toString()
  );
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<
    'published' | 'draft'
  >('published');

  const [saving, setSaving] = useState(false);
  const [pdfFile, setPdfFile] =
  useState<DocumentPicker.DocumentPickerAsset | null>(null);

  async function pickPdf() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return;
  }

  setPdfFile(result.assets[0]);
}

  async function saveReport() {
    const cleanTitle = title.trim();
    const cleanYear = year.trim();

    if (!cleanTitle) {
      Alert.alert(
        'Titlu necesar',
        'Introdu titlul raportului.'
      );
      return;
    }

    if (!cleanYear) {
      Alert.alert(
        'An necesar',
        'Introdu anul raportului.'
      );
      return;
    }

    const yearNumber = Number(cleanYear);

    if (
      !Number.isInteger(yearNumber) ||
      yearNumber < 1900 ||
      yearNumber > 2100
    ) {
      Alert.alert(
        'An invalid',
        'Introdu un an valid.'
      );
      return;
    }

    setSaving(true);

    const { data: createdReport, error } = await supabase
      .from('reports')
      .insert({
        title: cleanTitle,
        year: yearNumber,
        description:
          description.trim() || null,
        status,
      })
      .select('id')
      .single();

    if (error || !createdReport) {
      console.log(
        'Eroare creare raport:',
        error
      );

      Alert.alert(
        'Eroare',
        'Raportul nu a putut fi creat.'
      );

      setSaving(false);
      return;
    }

    // Găsim automat toate cazurile arhivate din anul raportului.
    const { data: archivedCases, error: casesError } = await supabase
      .from('cases')
      .select('id')
      .eq('status', 'archived')
      .eq('report_year', yearNumber);

    if (casesError) {
      console.log(
        'Eroare încărcare cazuri pentru raport:',
        casesError
      );

      setSaving(false);

      Alert.alert(
        'Raport creat',
        'Raportul a fost creat, dar cazurile arhivate nu au putut fi sincronizate.'
      );

      router.back();
      return;
    }

    if (archivedCases && archivedCases.length > 0) {
      const reportCaseRows = archivedCases.map(
        (caseItem, index) => ({
          report_id: createdReport.id,
          case_id: caseItem.id,
          display_order: index,
        })
      );

      const { error: reportCasesError } = await supabase
        .from('report_cases')
        .upsert(reportCaseRows, {
          onConflict: 'report_id,case_id',
          ignoreDuplicates: true,
        });

      if (reportCasesError) {
        console.log(
          'Eroare sincronizare report_cases:',
          reportCasesError
        );

        setSaving(false);

        Alert.alert(
          'Raport creat',
          'Raportul a fost creat, dar asocierea automată a cazurilor nu a putut fi finalizată.'
        );

        router.back();
        return;
      }
    }

    // Notificare automată doar pentru un raport nou publicat.
    if (status === 'published') {
      try {
        const { data: notification, error: notificationError } =
          await supabase.from('notifications').insert({
            title: 'Raport nou: ' + cleanTitle,
            message: 'Descoperă noul raport publicat de Misiunea Bucovina.',
            status: 'published',
            target_type: 'report',
            target_id: createdReport.id,
            updated_at: new Date().toISOString(),
          }).select('id').single();

        if (notificationError) {
          console.log('Eroare creare notificare raport:', notificationError);
        } else if (notification?.id) {
          const { error: pushError } = await supabase.functions.invoke(
            'send-push-notification',
            { body: { notification_id: notification.id } }
          );
          if (pushError) console.log('Eroare push raport:', pushError);
        }
      } catch (notificationError) {
        console.log('Eroare notificare raport:', notificationError);
      }
    }

    setSaving(false);

    Alert.alert(
      'Raport creat',
      status === 'published'
        ? 'Raportul a fost publicat.'
        : 'Raportul a fost salvat ca draft.',
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]
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
              Adaugă raport
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.sectionLabel}>
            INFORMAȚII
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>
              Titlu *
            </Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Raport anual 2026"
              placeholderTextColor="#AAAAAA"
            />

            <Text style={styles.label}>
              An *
            </Text>

            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              placeholder="2026"
              placeholderTextColor="#AAAAAA"
              keyboardType="number-pad"
              maxLength={4}
            />

            <Text style={styles.label}>
              Descriere
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.textArea,
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="O scurtă descriere a raportului..."
              placeholderTextColor="#AAAAAA"
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.sectionLabel}>
            DOCUMENT
          </Text>

          <TouchableOpacity
  style={styles.pdfCard}
  activeOpacity={0.8}
  onPress={pickPdf}
>
  <View style={styles.pdfIcon}>
    <Ionicons
      name={
        pdfFile
          ? 'checkmark-circle-outline'
          : 'document-text-outline'
      }
      size={27}
      color={RED}
    />
  </View>

  <View style={styles.pdfContent}>
    <Text style={styles.pdfTitle}>
      {pdfFile ? pdfFile.name : 'Alege PDF'}
    </Text>

    <Text style={styles.pdfSubtitle}>
      {pdfFile
        ? 'PDF selectat. Apasă pentru a alege alt fișier.'
        : 'Apasă pentru a selecta raportul de pe dispozitiv.'}
    </Text>
  </View>

  <Ionicons
    name="chevron-forward"
    size={19}
    color="#BBBBBB"
  />
</TouchableOpacity>

          <Text style={styles.sectionLabel}>
            VIZIBILITATE
          </Text>

          <View style={styles.statusCard}>
            <TouchableOpacity
              style={[
                styles.statusOption,
                status === 'published' &&
                  styles.statusOptionActive,
              ]}
              onPress={() =>
                setStatus('published')
              }
            >
              <View
                style={[
                  styles.radio,
                  status === 'published' &&
                    styles.radioActive,
                ]}
              >
                {status === 'published' ? (
                  <View
                    style={styles.radioDot}
                  />
                ) : null}
              </View>

              <View style={styles.statusTextContainer}>
                <Text style={styles.statusTitle}>
                  Publicat
                </Text>

                <Text style={styles.statusDescription}>
                  Raportul va fi vizibil în
                  aplicație.
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[
                styles.statusOption,
                status === 'draft' &&
                  styles.statusOptionActive,
              ]}
              onPress={() =>
                setStatus('draft')
              }
            >
              <View
                style={[
                  styles.radio,
                  status === 'draft' &&
                    styles.radioActive,
                ]}
              >
                {status === 'draft' ? (
                  <View
                    style={styles.radioDot}
                  />
                ) : null}
              </View>

              <View style={styles.statusTextContainer}>
                <Text style={styles.statusTitle}>
                  Draft
                </Text>

                <Text style={styles.statusDescription}>
                  Doar administratorii îl pot
                  vedea.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveReport}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text style={styles.saveButtonText}>
                  Salvează raportul
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
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
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  headerTitle: {
    color: DARK,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 1,
  },

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15,
    paddingBottom: 45,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 18,
    marginBottom: 9,
    marginLeft: 5,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 17,
  },

  label: {
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 7,
    marginTop: 5,
  },

  input: {
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    minHeight: 48,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 12,
    marginBottom: 14,
  },

  textArea: {
    minHeight: 115,
    paddingTop: 13,
    paddingBottom: 13,
  },

  pdfCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  pdfIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pdfContent: {
    flex: 1,
    marginLeft: 12,
  },

  pdfTitle: {
    color: DARK,
    fontSize: 12,
    fontWeight: '900',
  },

  pdfSubtitle: {
    color: '#888888',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },

  statusOption: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusOptionActive: {
    backgroundColor: '#FFF8F8',
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioActive: {
    borderColor: RED,
  },

  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: RED,
  },

  statusTextContainer: {
    flex: 1,
    marginLeft: 11,
  },

  statusTitle: {
    color: DARK,
    fontSize: 12,
    fontWeight: '900',
  },

  statusDescription: {
    color: '#888888',
    fontSize: 9,
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },

  saveButton: {
    height: 53,
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