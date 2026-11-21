import { showSaveSuccess } from '../../../lib/save-feedback';
import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator,
  
  KeyboardAvoidingView,
  Linking,
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

type Report = {
  id: string;
  title: string;
  year: number;
  description: string | null;
  pdf_url: string | null;
  status: 'published' | 'draft';
};

export default function EditReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalStatus, setOriginalStatus] = useState<'published' | 'draft' | null>(null);

  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<
    'published' | 'draft'
  >('published');

  const [pdfUrl, setPdfUrl] = useState<string | null>(
    null
  );

  const [newPdf, setNewPdf] =
    useState<DocumentPicker.DocumentPickerAsset | null>(
      null
    );

  useEffect(() => {
    loadReport();
  }, [id]);

  async function syncReportCases(
    reportId: string,
    reportYear: number
  ) {
    const { data: archivedCases, error: casesError } =
      await supabase
        .from('cases')
        .select('id')
        .eq('status', 'archived')
        .eq('report_year', reportYear);

    if (casesError) {
      throw casesError;
    }

    // Refacem lista astfel încât raportul să conțină exact
    // cazurile arhivate care au anul raportului.
    const { error: deleteError } = await supabase
      .from('report_cases')
      .delete()
      .eq('report_id', reportId);

    if (deleteError) {
      throw deleteError;
    }

    if (!archivedCases || archivedCases.length === 0) {
      return;
    }

    const rows = archivedCases.map((caseItem, index) => ({
      report_id: reportId,
      case_id: caseItem.id,
      display_order: index,
    }));

    const { error: insertError } = await supabase
      .from('report_cases')
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  async function loadReport() {
    if (!id) {
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('reports')
      .select(
        'id, title, year, description, pdf_url, status'
      )
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.log('Eroare încărcare raport:', error);

      setLoading(false);

      Alert.alert(
        'Eroare',
        'Raportul nu a putut fi încărcat.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );

      return;
    }

    const report = data as Report;

    setTitle(report.title);
    setYear(report.year.toString());
    setDescription(report.description ?? '');
    setStatus(report.status);
    setOriginalStatus(report.status);
    setPdfUrl(report.pdf_url);

    try {
      await syncReportCases(report.id, report.year);
    } catch (syncError) {
      console.log(
        'Eroare sincronizare cazuri la deschiderea raportului:',
        syncError
      );
    }

    setLoading(false);
  }

  async function pickPdf() {
    const result =
      await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

    if (result.canceled) {
      return;
    }

    setNewPdf(result.assets[0]);
  }

  async function uploadPdf() {
    if (!newPdf) {
      return pdfUrl;
    }

    const response = await fetch(newPdf.uri);
    const arrayBuffer = await response.arrayBuffer();

    const safeName = newPdf.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

    const filePath = `${Date.now()}-${safeName}`;

    const { error: uploadError } =
      await supabase.storage
        .from('report-files')
        .upload(filePath, arrayBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('report-files')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function openPdf() {
    if (!pdfUrl) {
      return;
    }

    try {
      await Linking.openURL(pdfUrl);
    } catch (error) {
      Alert.alert(
        'Eroare',
        'PDF-ul nu a putut fi deschis.'
      );
    }
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

    let finalPdfUrl = pdfUrl;

    try {
      if (newPdf) {
        finalPdfUrl = await uploadPdf();
      }
    } catch (error) {
      console.log('Eroare upload PDF:', error);

      setSaving(false);

      Alert.alert(
        'Eroare PDF',
        'Noul PDF nu a putut fi încărcat.'
      );

      return;
    }

    const { error } = await supabase
      .from('reports')
      .update({
        title: cleanTitle,
        year: yearNumber,
        description: description.trim() || null,
        pdf_url: finalPdfUrl,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.log('Eroare actualizare raport:', error);

      setSaving(false);

      Alert.alert(
        'Eroare',
        'Raportul nu a putut fi actualizat.'
      );

      return;
    }

    try {
      await syncReportCases(id, yearNumber);
    } catch (syncError) {
      console.log(
        'Eroare sincronizare cazuri raport:',
        syncError
      );

      setSaving(false);

      Alert.alert(
        'Raport actualizat',
        'Raportul a fost salvat, dar cazurile arhivate nu au putut fi sincronizate.'
      );

      return;
    }

    // Trimitem notificarea doar la prima trecere din Draft în Publicat.
    if (originalStatus === 'draft' && status === 'published') {
      try {
        const { data: existingNotification, error: checkError } =
          await supabase
            .from('notifications')
            .select('id')
            .eq('target_type', 'report')
            .eq('target_id', id)
            .eq('status', 'published')
            .limit(1)
            .maybeSingle();

        if (checkError) {
          console.log('Eroare verificare notificare raport:', checkError);
        } else if (!existingNotification) {
          const { data: notification, error: notificationError } =
            await supabase
              .from('notifications')
              .insert({
                title: 'Raport nou: ' + cleanTitle,
                message: 'Descoperă noul raport publicat de Misiunea Bucovina.',
                status: 'published',
                target_type: 'report',
                target_id: id,
                updated_at: new Date().toISOString(),
              })
              .select('id')
              .single();

          if (notificationError) {
            console.log('Eroare creare notificare raport:', notificationError);
          } else if (notification?.id) {
            const { error: pushError } = await supabase.functions.invoke(
              'send-push-notification',
              { body: { notification_id: notification.id } }
            );
            if (pushError) {
              console.log('Eroare push raport:', pushError);
            }
          }
        }
      } catch (notificationError) {
        console.log('Eroare notificare publicare raport:', notificationError);
      }
    }

    setOriginalStatus(status);
    setPdfUrl(finalPdfUrl);
    setNewPdf(null);
    setSaving(false);

    showSaveSuccess();
router.back();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={RED} />

        <Text style={styles.loadingText}>
          Se încarcă raportul...
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

            <Text style={styles.headerTitle}>
              Editează raport
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
              placeholder="Titlul raportului"
              placeholderTextColor="#AAAAAA"
            />

            <Text style={styles.label}>
              An *
            </Text>

            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="2026"
              placeholderTextColor="#AAAAAA"
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
              placeholder="Descriere..."
              placeholderTextColor="#AAAAAA"
              multiline
              textAlignVertical="top"
            />
          </View>

          <Text style={styles.sectionLabel}>
            DOCUMENT PDF
          </Text>

          {pdfUrl && !newPdf ? (
            <TouchableOpacity
              style={styles.pdfCard}
              onPress={openPdf}
              activeOpacity={0.8}
            >
              <View style={styles.pdfIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={27}
                  color={RED}
                />
              </View>

              <View style={styles.pdfContent}>
                <Text style={styles.pdfTitle}>
                  Deschide PDF-ul actual
                </Text>

                <Text style={styles.pdfSubtitle}>
                  Apasă pentru a vizualiza documentul.
                </Text>
              </View>

              <Ionicons
                name="open-outline"
                size={20}
                color={RED}
              />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.pdfCard}
            onPress={pickPdf}
            activeOpacity={0.8}
          >
            <View style={styles.pdfIcon}>
              <Ionicons
                name={
                  newPdf
                    ? 'checkmark-circle-outline'
                    : 'cloud-upload-outline'
                }
                size={27}
                color={RED}
              />
            </View>

            <View style={styles.pdfContent}>
              <Text style={styles.pdfTitle}>
                {newPdf
                  ? newPdf.name
                  : pdfUrl
                    ? 'Înlocuiește PDF-ul'
                    : 'Adaugă PDF'}
              </Text>

              <Text style={styles.pdfSubtitle}>
                {newPdf
                  ? 'Noul PDF este pregătit pentru salvare.'
                  : 'Selectează un document PDF.'}
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
                  <View style={styles.radioDot} />
                ) : null}
              </View>

              <View style={styles.statusTextContainer}>
                <Text style={styles.statusTitle}>
                  Publicat
                </Text>

                <Text style={styles.statusDescription}>
                  Raportul este vizibil în aplicație.
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
                  <View style={styles.radioDot} />
                ) : null}
              </View>

              <View style={styles.statusTextContainer}>
                <Text style={styles.statusTitle}>
                  Draft
                </Text>

                <Text style={styles.statusDescription}>
                  Doar administratorii îl pot vedea.
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
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={21}
                  color="#FFFFFF"
                />

                <Text style={styles.saveButtonText}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 12,
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
    marginBottom: 10,
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