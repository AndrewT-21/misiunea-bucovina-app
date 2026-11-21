import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type NewsItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

export default function NewsScreen() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const loadNews = useCallback(async (showLoading = true, isActive = () => true) => {
    if (showLoading) setLoading(true);
    if (isActive()) setLoadError(null);

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = supabase
        .from('news')
        .select('id, title, description, image_url, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      const { data, error } = await Promise.race([
        request,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Cererea a depășit 12 secunde.')), 12000);
        }),
      ]);
      if (error) throw error;
      if (isActive()) setNews((data ?? []) as NewsItem[]);
    } catch (err) {
      console.error('Eroare încărcare noutăți:', err);
      if (isActive()) {
        setLoadError(err instanceof Error ? err.message : 'Nu s-au putut încărca noutățile.');
      }
    } finally {
      if (timer) clearTimeout(timer);
      if (isActive()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
  useCallback(() => {
    console.log('NOUTATI: useFocusEffect a pornit');

    let active = true;

    void loadNews(true, () => active);

    return () => {
      active = false;
    };
  }, [loadNews, retry])
);

  function refreshNews() {
    setRefreshing(true);
    void loadNews(false);
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(date));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator
          size="large"
          color={RED}
        />

        <Text style={styles.loadingText}>
          Se încarcă noutățile...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top']}
    >
      <MisiBiPageHeader title="Noutăți" eyebrow="MISIUNEA BUCOVINA" />

      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          news.length === 0 &&
            styles.emptyList,
          { maxWidth: 1120, width: '100%', alignSelf: 'center' as const },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshNews}
            tintColor={RED}
          />
        }
        ListHeaderComponent={
          news.length > 0 ? (
            <View style={styles.intro}>
              <Text style={styles.introLabel}>
                ULTIMELE NOUTĂȚI
              </Text>

              <Text style={styles.introTitle}>
                Vezi ce se întâmplă în lucrarea noastră
              </Text>

              <Text style={styles.introText}>
                Descoperă cele mai recente actualizări,
                proiecte și momente din activitatea
                Misiunii Bucovina.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {loadError ? (
              <>
                <Ionicons name="alert-circle-outline" size={34} color={RED} />
                <Text style={styles.emptyTitle}>Noutățile nu s-au putut încărca</Text>
                <Text style={styles.emptyText}>{loadError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => setRetry(value => value + 1)}>
                  <Text style={styles.retryText}>Încearcă din nou</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="newspaper-outline"
                size={32}
                color={RED}
              />
            </View>

            <Text style={styles.emptyTitle}>
              Nu există noutăți
            </Text>

            <Text style={styles.emptyText}>
              Noutățile publicate de Misiunea Bucovina
              vor apărea aici.
            </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/noutate/[id]',
                params: { id: item.id },
              })
            }
          >
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.cardImage}
              />
            ) : (
              <View style={styles.noImage}>
                <Ionicons
                  name="newspaper-outline"
                  size={34}
                  color={RED}
                />
              </View>
            )}

            <View style={styles.cardContent}>
              <View style={styles.dateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={RED}
                />

                <Text style={styles.date}>
                  {formatDate(item.created_at)}
                </Text>
              </View>

              <Text
                style={styles.cardTitle}
                numberOfLines={2}
              >
                {item.title}
              </Text>

              {item.description ? (
                <Text
                  style={styles.cardDescription}
                  numberOfLines={3}
                >
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.readMore}>
                <Text style={styles.readMoreText}>
                  Citește mai mult
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={15}
                  color={RED}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
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
    minHeight: 70,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
  },

  headerSubtitle: {
    color: '#999999',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  headerSpace: {
    width: 42,
  },

  list: {
    padding: 15,
    paddingBottom: 40,
  },

  emptyList: {
    flexGrow: 1,
  },

  intro: {
    paddingVertical: 12,
    marginBottom: 7,
  },

  introLabel: {
    color: RED,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  introTitle: {
    color: DARK,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    marginTop: 7,
  },

  introText: {
    color: '#777777',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 330,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },

  cardImage: {
    width: '100%',
    height: 190,
    backgroundColor: '#EEEEEE',
  },

  noImage: {
    width: '100%',
    height: 145,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardContent: {
    padding: 16,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  date: {
    color: '#888888',
    fontSize: 9,
    fontWeight: '700',
  },

  cardTitle: {
    color: DARK,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    marginTop: 9,
  },

  cardDescription: {
    color: '#707070',
    fontSize: 10,
    lineHeight: 17,
    marginTop: 7,
  },

  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 13,
  },

  readMoreText: {
    color: RED,
    fontSize: 10,
    fontWeight: '900',
  },

  retryButton: {
    backgroundColor: RED,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 16,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 14,
  },

  emptyText: {
    color: '#888888',
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 6,
  },
});