import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator,
    
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type Report = {
  id: string;
  title: string;
  year: number;
  description: string | null;
  pdf_url: string | null;
};

type ReportCase = {
  id: string;
  title: string;
  story: string | null;
  location: string | null;
  urgent_need: string | null;
  image_url: string | null;
};

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [report, setReport] = useState<Report | null>(null);
  const [cases, setCases] = useState<ReportCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [id]);

  async function loadReport() {
    if (!id) return;

    setLoading(true);

    const { data: reportData, error: reportError } = await supabase
      .from('reports')
      .select('id, title, year, description, pdf_url')
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();

    if (reportError || !reportData) {
      console.log('Eroare încărcare raport:', reportError);
      setLoading(false);

      Alert.alert(
        'Raport indisponibil',
        'Raportul nu a putut fi găsit sau nu este publicat.',
        [{ text: 'OK', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe')) }]
      );
      return;
    }

    setReport(reportData as Report);

    const { data: links, error: linksError } = await supabase
      .from('report_cases')
      .select('case_id, display_order')
      .eq('report_id', id)
      .order('display_order', { ascending: true });

    if (linksError) {
      console.log('Eroare încărcare cazuri raport:', linksError);
      setCases([]);
      setLoading(false);
      return;
    }

    const caseIds = (links ?? []).map((item) => item.case_id);

    if (caseIds.length === 0) {
      setCases([]);
      setLoading(false);
      return;
    }

    const { data: casesData, error: casesError } = await supabase
      .from('cases')
      .select('id, title, story, location, urgent_need, image_url')
      .in('id', caseIds);

    if (casesError) {
      console.log('Eroare încărcare detalii cazuri:', casesError);
      setCases([]);
    } else {
      const byId = new Map(
        (casesData ?? []).map((item) => [item.id, item as ReportCase])
      );

      const orderedCases = caseIds
        .map((caseId) => byId.get(caseId))
        .filter((item): item is ReportCase => Boolean(item));

      setCases(orderedCases);
    }

    setLoading(false);
  }

  async function openPdf() {
    if (!report?.pdf_url) return;

    try {
      const supported = await Linking.canOpenURL(report.pdf_url);

      if (!supported) {
        Alert.alert(
          'Eroare',
          'Documentul nu poate fi deschis pe acest dispozitiv.'
        );
        return;
      }

      await Linking.openURL(report.pdf_url);
    } catch (error) {
      console.log('Eroare deschidere PDF:', error);
      Alert.alert('Eroare', 'PDF-ul nu a putut fi deschis.');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={RED} />
        <Text style={styles.loadingText}>Se încarcă raportul...</Text>
      </SafeAreaView>
    );
  }

  if (!report) return null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}
        >
          <Ionicons name="chevron-back" size={24} color={DARK} />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>RAPORT ANUAL</Text>
          <Text style={styles.headerTitle}>{report.year}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
      >
        <View style={styles.hero}>
          <View style={styles.yearBadge}>
            <Text style={styles.yearText}>{report.year}</Text>
          </View>

          <Text style={styles.heroTitle}>{report.title}</Text>

          {report.description ? (
            <Text style={styles.heroText}>{report.description}</Text>
          ) : null}

          {report.pdf_url ? (
            <TouchableOpacity
              style={styles.pdfButton}
              onPress={openPdf}
              activeOpacity={0.8}
            >
              <Ionicons
                name="document-text-outline"
                size={19}
                color={RED}
              />
              <Text style={styles.pdfButtonText}>
                Deschide raportul PDF
              </Text>
              <Ionicons name="open-outline" size={17} color={RED} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>MISIUNI ÎNDEPLINITE</Text>
            <Text style={styles.sectionTitle}>
              Cazurile anului {report.year}
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countText}>{cases.length}</Text>
          </View>
        </View>

        {cases.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="heart-outline"
              size={29}
              color={RED}
            />
            <Text style={styles.emptyTitle}>
              Nu există încă cazuri în acest raport
            </Text>
            <Text style={styles.emptyText}>
              Cazurile arhivate pentru acest an vor apărea aici.
            </Text>
          </View>
        ) : (
          cases.map((item) => (
  <TouchableOpacity
    key={item.id}
    style={styles.caseCard}
    activeOpacity={0.85}
    onPress={() =>
      router.push({
        pathname: '/caz/[id]',
        params: { id: item.id },
      })
    }
  >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.caseImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.caseImagePlaceholder}>
                  <Ionicons
                    name="heart-outline"
                    size={31}
                    color={RED}
                  />
                </View>
              )}

              <View style={styles.caseContent}>
                {item.location ? (
                  <View style={styles.locationRow}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color={RED}
                    />
                    <Text style={styles.locationText}>
                      {item.location}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.caseTitle}>{item.title}</Text>

                {item.story ? (
                  <Text
                    style={styles.caseStory}
                    numberOfLines={4}
                  >
                    {item.story}
                  </Text>
                ) : null}

                {item.urgent_need ? (
                  <View style={styles.helpBox}>
                    <Text style={styles.helpLabel}>NEVOIA PREZENTATĂ</Text>
                    <Text style={styles.helpText}>
                      {item.urgent_need}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={styles.footerCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={RED}
          />
          <View style={styles.footerContent}>
            <Text style={styles.footerTitle}>
              Transparență și responsabilitate
            </Text>
            <Text style={styles.footerText}>
              Acest raport prezintă activitatea și cazurile asociate anului
              selectat.
            </Text>
          </View>
        </View>
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 10,
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
    fontSize: 26,
    fontWeight: '900',
    marginTop: 1,
  },
  content: {
    paddingHorizontal: 15,
    paddingBottom: 45,
  },
  hero: {
    backgroundColor: RED,
    borderRadius: 24,
    padding: 21,
    marginTop: 8,
  },
  yearBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: 15,
  },
  yearText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  heroText: {
    color: '#F7DADA',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 9,
  },
  pdfButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginTop: 18,
    gap: 8,
  },
  pdfButtonText: {
    flex: 1,
    color: RED,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 11,
    paddingHorizontal: 4,
  },
  sectionEyebrow: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 3,
  },
  countBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: {
    color: RED,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 11,
    textAlign: 'center',
  },
  emptyText: {
    color: '#888888',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 6,
    textAlign: 'center',
  },
  caseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    overflow: 'hidden',
    marginBottom: 13,
  },
  caseImage: {
    width: '100%',
    height: 190,
    backgroundColor: '#EEEEEE',
  },
  caseImagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caseContent: {
    padding: 17,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  locationText: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 4,
  },
  caseTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },
  caseStory: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
  },
  helpBox: {
    backgroundColor: '#FFF7F7',
    borderRadius: 13,
    padding: 12,
    marginTop: 13,
  },
  helpLabel: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  helpText: {
    color: DARK,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
    fontWeight: '700',
  },
  footerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 7,
  },
  footerContent: {
    flex: 1,
    marginLeft: 12,
  },
  footerTitle: {
    color: DARK,
    fontSize: 11,
    fontWeight: '900',
  },
  footerText: {
    color: '#888888',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },
});
