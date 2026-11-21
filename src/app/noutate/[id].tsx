import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type NewsItem = {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  image_url: string | null;
  created_at: string;
};

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [newsItem, setNewsItem] =
    useState<NewsItem | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNews();
  }, [id]);

  async function loadNews() {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('news')
      .select(`
        id,
        title,
        description,
        content,
        image_url,
        created_at
      `)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.log(
        'Eroare încărcare noutate:',
        error
      );
    }

    setNewsItem(
      error ? null : (data as NewsItem | null)
    );

    setLoading(false);
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
          Se încarcă noutatea...
        </Text>
      </SafeAreaView>
    );
  }

  if (!newsItem) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.notFoundIcon}>
          <Ionicons
            name="newspaper-outline"
            size={32}
            color={RED}
          />
        </View>

        <Text style={styles.notFoundTitle}>
          Noutatea nu este disponibilă
        </Text>

        <Text style={styles.notFoundText}>
          Este posibil ca această noutate să fi
          fost retrasă sau să nu mai fie publicată.
        </Text>

        <TouchableOpacity
          style={styles.backToNewsButton}
          onPress={() => router.replace('/noutati')}
        >
          <Text style={styles.backToNewsText}>
            Înapoi la noutăți
          </Text>
        </TouchableOpacity>
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
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'))}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={DARK}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Noutăți
        </Text>

        <View style={styles.headerSpace} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
      >
        {newsItem.image_url ? (
          <Image
            source={{ uri: newsItem.image_url }}
            style={styles.heroImage}
          />
        ) : (
          <View style={styles.noImage}>
            <Ionicons
              name="newspaper-outline"
              size={42}
              color={RED}
            />
          </View>
        )}

        <View style={styles.article}>
          <View style={styles.categoryRow}>
            <View style={styles.category}>
              <Ionicons
                name="newspaper-outline"
                size={12}
                color={RED}
              />

              <Text style={styles.categoryText}>
                NOUTĂȚI
              </Text>
            </View>

            <View style={styles.dateRow}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color="#888888"
              />

              <Text style={styles.date}>
                {formatDate(newsItem.created_at)}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>
            {newsItem.title}
          </Text>

          {newsItem.description ? (
            <Text style={styles.description}>
              {newsItem.description}
            </Text>
          ) : null}

          <View style={styles.divider} />

          {newsItem.content ? (
            <Text style={styles.articleContent}>
              {newsItem.content}
            </Text>
          ) : (
            <Text style={styles.noContent}>
              Nu există conținut suplimentar pentru
              această noutate.
            </Text>
          )}

          <View style={styles.missionCard}>
            <View style={styles.missionIcon}>
              <Ionicons
                name="heart"
                size={20}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.missionContent}>
              <Text style={styles.missionSmall}>
                MISIUNEA BUCOVINA
              </Text>

              <Text style={styles.missionTitle}>
                Ajutând în Numele lui Hristos
              </Text>
            </View>
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

  center: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 10,
  },

  header: {
    minHeight: 68,
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

  headerTitle: {
    flex: 1,
    color: DARK,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },

  headerSpace: {
    width: 42,
  },

  content: {
    paddingBottom: 40,
  },

  heroImage: {
    width: '100%',
    height: 245,
    backgroundColor: '#EEEEEE',
  },

  noImage: {
    width: '100%',
    height: 190,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  article: {
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  categoryText: {
    color: RED,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
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

  title: {
    color: DARK,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 16,
  },

  description: {
    color: '#666666',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 11,
  },

  divider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginVertical: 20,
  },

  articleContent: {
    color: '#3F3F3F',
    fontSize: 13,
    lineHeight: 23,
  },

  noContent: {
    color: '#888888',
    fontSize: 12,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  missionCard: {
    backgroundColor: RED,
    borderRadius: 19,
    padding: 16,
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },

  missionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  missionContent: {
    flex: 1,
    marginLeft: 12,
  },

  missionSmall: {
    color: '#FFFFFF',
    opacity: 0.7,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  missionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
  },

  notFoundIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  notFoundTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 15,
  },

  notFoundText: {
    color: '#888888',
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 7,
  },

  backToNewsButton: {
    backgroundColor: RED,
    minHeight: 48,
    borderRadius: 15,
    paddingHorizontal: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },

  backToNewsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});