import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator,
  
  Linking,
  RefreshControl,
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

type Report = {
  id: string;
  title: string;
  year: number;
  description: string | null;
  pdf_url: string | null;
  created_at: string;
};

type AnnualVision = {
  id: string;
  year: number;
  title: string;
  message: string | null;
  pdf_url: string | null;
};

export default function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [vision, setVision] = useState<AnnualVision | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [])
  );

  async function loadReports(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [reportsResult, visionResult] = await Promise.all([
      supabase
        .from('reports')
        .select(
          'id, title, year, description, pdf_url, created_at'
        )
        .eq('status', 'published')
        .order('year', { ascending: false })
        .order('created_at', { ascending: false }),

      supabase
        .from('annual_vision')
        .select('id, year, title, message, pdf_url')
        .eq('status', 'published')
        .order('year', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (reportsResult.error) {
      console.log(
        'Eroare încărcare rapoarte:',
        reportsResult.error
      );

      Alert.alert(
        'Eroare',
        'Rapoartele nu au putut fi încărcate.'
      );
    } else {
      setReports(reportsResult.data ?? []);
    }

    if (visionResult.error) {
      console.log(
        'Eroare încărcare viziune anuală:',
        visionResult.error
      );
      setVision(null);
    } else {
      setVision(
        (visionResult.data as AnnualVision | null) ?? null
      );
    }

    setLoading(false);
    setRefreshing(false);
  }

  async function openPdf(url: string | null) {
    if (!url) {
      Alert.alert(
        'PDF indisponibil',
        'Acest raport nu are încă un document PDF.'
      );
      return;
    }

    try {
      const supported =
        await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert(
          'Eroare',
          'Documentul nu poate fi deschis pe acest dispozitiv.'
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.log(
        'Eroare deschidere PDF:',
        error
      );

      Alert.alert(
        'Eroare',
        'PDF-ul nu a putut fi deschis.'
      );
    }
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <MisiBiPageHeader title="Rapoarte" eyebrow="MISIUNEA BUCOVINA" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadReports(true)}
            tintColor={RED}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="document-text-outline"
              size={28}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.heroTitle}>
            Rapoartele Misiunea Bucovina
          </Text>

          <Text style={styles.heroText}>
            Descoperă rapoartele organizației și
            modul în care resursele sunt folosite
            pentru a ajuta oamenii și comunitățile.
          </Text>
        </View>

        {!loading && vision ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                VIZIUNEA PENTRU ANUL {vision.year}
              </Text>
            </View>

            <View style={styles.visionCard}>
              <View style={styles.visionTop}>
                <View style={styles.visionIcon}>
                  <Ionicons
                    name="compass-outline"
                    size={25}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.visionYearBadge}>
                  <Text style={styles.visionYearText}>
                    {vision.year}
                  </Text>
                </View>
              </View>

              <Text style={styles.visionTitle}>
                {vision.title}
              </Text>

              {vision.message ? (
                <Text style={styles.visionMessage}>
                  {vision.message}
                </Text>
              ) : null}

              {vision.pdf_url ? (
                <TouchableOpacity
                  style={styles.visionButton}
                  activeOpacity={0.8}
                  onPress={() => openPdf(vision.pdf_url)}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.visionButtonText}>
                    Deschide documentul
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={17}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>
            RAPOARTE PUBLICATE
          </Text>

          {!loading && reports.length > 0 ? (
            <Text style={styles.reportCount}>
              {reports.length}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={RED}
            />

            <Text style={styles.loadingText}>
              Se încarcă rapoartele...
            </Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="documents-outline"
                size={30}
                color={RED}
              />
            </View>

            <Text style={styles.emptyTitle}>
              Nu există rapoarte publicate
            </Text>

            <Text style={styles.emptyText}>
              Rapoartele organizației vor apărea
              aici atunci când vor fi publicate.
            </Text>
          </View>
        ) : (
          reports.map((report) => (
            <View
              key={report.id}
              style={styles.reportCard}
            >
              <View style={styles.reportTop}>
                <View style={styles.yearBadge}>
                  <Text style={styles.yearText}>
                    {report.year}
                  </Text>
                </View>

                <View style={styles.documentIcon}>
                  <Ionicons
                    name="document-text-outline"
                    size={23}
                    color={RED}
                  />
                </View>
              </View>

              <Text style={styles.reportTitle}>
                {report.title}
              </Text>

              {report.description ? (
                <Text style={styles.reportDescription}>
                  {report.description}
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.openButton}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: '/raport/[id]',
                    params: { id: report.id },
                  })
                }
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#FFFFFF"
                />

                <Text
                  style={styles.openButtonText}
                >
                  Vezi raportul
                </Text>
              </TouchableOpacity>
            </View>
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
              Ne dorim ca activitatea organizației
              să fie prezentată într-un mod clar și
              accesibil.
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
    letterSpacing: 1.1,
  },

  headerTitle: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
  },

  content: { maxWidth: 1120, width: '100%', alignSelf: 'center',
    paddingHorizontal: 15,
    paddingBottom: 40,
  },

  hero: {
    backgroundColor: RED,
    borderRadius: 24,
    padding: 21,
    marginTop: 8,
  },

  heroIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },

  heroText: {
    color: '#F7DADA',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 310,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 5,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  reportCount: {
    color: RED,
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },

  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 55,
  },

  loadingText: {
    color: '#888888',
    fontSize: 10,
    marginTop: 12,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  emptyTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: '900',
  },

  emptyText: {
    color: '#888888',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 270,
  },

  visionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 4,
  },

  visionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  visionIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  visionYearBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  visionYearText: {
    color: RED,
    fontSize: 10,
    fontWeight: '900',
  },

  visionTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 23,
  },

  visionMessage: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 17,
    marginTop: 8,
  },

  visionButton: {
  minHeight: 50,
  borderRadius: 14,
  backgroundColor: RED,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 16,
  gap: 7,
  paddingHorizontal: 14,
},

  visionButtonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },

  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    padding: 17,
    marginBottom: 11,
  },

  reportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  yearBadge: {
    backgroundColor: '#FFF0F0',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  yearText: {
    color: RED,
    fontSize: 10,
    fontWeight: '900',
  },

  documentIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FFF7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reportTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 21,
  },

  reportDescription: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
  },

  openButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: RED,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 7,
  },

  openButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  disabledButton: {
    backgroundColor: '#EEEEEE',
  },

  disabledButtonText: {
    color: '#999999',
  },

  footerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
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