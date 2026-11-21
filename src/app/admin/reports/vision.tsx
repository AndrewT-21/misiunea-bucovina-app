import { Alert } from '../../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
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

import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type Vision = {
  id: string;
  year: number;
  title: string;
  message: string | null;
  pdf_url: string | null;
  status: 'published' | 'draft';
};

export default function AnnualVisionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const visionId = Array.isArray(id) ? id[0] : id;

  const [title, setTitle] = useState('');
  const [year, setYear] = useState(
    new Date().getFullYear().toString()
  );
  const [message, setMessage] = useState('');
  const [status, setStatus] =
    useState<'published' | 'draft'>('published');

  const [existingVision, setExistingVision] =
    useState<Vision | null>(null);
  const [pdfFile, setPdfFile] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const [loading, setLoading] = useState(!!visionId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visionId) {
      loadVision();
    }
  }, [visionId]);

  async function loadVision() {
    if (!visionId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('annual_vision')
      .select('id, year, title, message, pdf_url, status')
      .eq('id', visionId)
      .single();

    if (error) {
      console.log('Eroare încărcare viziune:', error);
      Alert.alert(
        'Eroare',
        'Viziunea anuală nu a putut fi încărcată.'
      );
    } else {
      const vision = data as Vision;
      setExistingVision(vision);
      setTitle(vision.title);
      setYear(String(vision.year));
      setMessage(vision.message || '');
      setStatus(vision.status);
    }

    setLoading(false);
  }

  async function pickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      setPdfFile(result.assets[0]);
    }
  }

  async function uploadPdf() {
    if (!pdfFile) {
      return existingVision?.pdf_url || null;
    }

    const response = await fetch(pdfFile.uri);
    const arrayBuffer = await response.arrayBuffer();

    const safeName = pdfFile.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );

    const filePath =
      `vision/${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from('report-files')
      .upload(filePath, arrayBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from('report-files')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function deleteOldPdf(url: string | null) {
    if (!url) return;

    try {
      const marker = '/report-files/';
      const path = url.split(marker)[1];

      if (path) {
        await supabase.storage
          .from('report-files')
          .remove([decodeURIComponent(path)]);
      }
    } catch (error) {
      console.log('Eroare ștergere PDF vechi:', error);
    }
  }

  async function saveVision() {
    const cleanTitle = title.trim();
    const cleanYear = year.trim();

    if (!cleanTitle) {
      Alert.alert(
        'Titlu necesar',
        'Introdu titlul viziunii.'
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

    try {
      const pdfUrl = await uploadPdf();

      const payload = {
        title: cleanTitle,
        year: yearNumber,
        message: message.trim() || null,
        pdf_url: pdfUrl,
        status,
        updated_at: new Date().toISOString(),
      };

      let error;

      if (existingVision) {
        const result = await supabase
          .from('annual_vision')
          .update(payload)
          .eq('id', existingVision.id);

        error = result.error;
      } else {
        const result = await supabase
          .from('annual_vision')
          .insert(payload);

        error = result.error;
      }

      if (error) {
        console.log('Eroare salvare viziune:', error);

        if (error.code === '23505') {
          Alert.alert(
            'An deja existent',
            `Există deja o viziune pentru anul ${yearNumber}.`
          );
        } else {
          Alert.alert(
            'Eroare',
            'Viziunea anuală nu a putut fi salvată.'
          );
        }
        return;
      }

      if (
        pdfFile &&
        existingVision?.pdf_url &&
        existingVision.pdf_url !== pdfUrl
      ) {
        await deleteOldPdf(existingVision.pdf_url);
      }

      Alert.alert(
        existingVision
          ? 'Viziune actualizată'
          : 'Viziune creată',
        status === 'published'
          ? 'Viziunea este publicată.'
          : 'Viziunea a fost salvată ca draft.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.log('Eroare PDF/viziune:', error);

      Alert.alert(
        'Eroare',
        'Viziunea sau documentul PDF nu au putut fi salvate.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RED} />
          <Text style={styles.loadingText}>
            Se încarcă viziunea...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              {existingVision
                ? 'Editează viziunea'
                : 'Viziune anuală'}
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
            <Text style={styles.label}>An *</Text>
            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              placeholder="2027"
              placeholderTextColor="#AAAAAA"
              keyboardType="number-pad"
              maxLength={4}
            />

            <Text style={styles.label}>Titlu *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Viziunea pentru anul 2027"
              placeholderTextColor="#AAAAAA"
            />

            <Text style={styles.label}>
              Mesaj
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Scrie mesajul și direcția pentru acest an..."
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
                  pdfFile || existingVision?.pdf_url
                    ? 'checkmark-circle-outline'
                    : 'document-text-outline'
                }
                size={27}
                color={RED}
              />
            </View>

            <View style={styles.pdfContent}>
              <Text
                style={styles.pdfTitle}
                numberOfLines={1}
              >
                {pdfFile
                  ? pdfFile.name
                  : existingVision?.pdf_url
                    ? 'PDF atașat'
                    : 'Alege PDF'}
              </Text>

              <Text style={styles.pdfSubtitle}>
                {pdfFile
                  ? 'PDF nou selectat. Apasă pentru a-l schimba.'
                  : existingVision?.pdf_url
                    ? 'Există deja un document. Apasă pentru a-l înlocui.'
                    : 'Apasă pentru a selecta documentul de pe dispozitiv.'}
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
              onPress={() => setStatus('published')}
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
                  Viziunea va fi vizibilă în aplicație.
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
              onPress={() => setStatus('draft')}
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
                  Doar administratorii o pot vedea.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={saveVision}
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
                  {existingVision
                    ? 'Salvează modificările'
                    : 'Salvează viziunea'}
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
    minHeight: 135,
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
  center: {
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
