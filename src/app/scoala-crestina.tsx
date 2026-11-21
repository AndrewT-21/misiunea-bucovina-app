import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BG = '#F7F6F3';

type SchoolContent = {
  title: string;
  subtitle: string;
  description: string;
  mission: string;
  development_text: string;
  hero_image_url: string | null;
};

type GalleryPhoto = { id: string; image_url: string; sort_order: number };

const INITIAL_CONTENT: SchoolContent = {
  title: 'Școala Creștină',
  subtitle: 'Un loc unde educația, credința și viitorul copiilor cresc împreună.',
  description: 'Școala Creștină este un proiect educațional existent, aflat în continuă dezvoltare.',
  mission: '',
  hero_image_url: null,
  development_text: 'Pe măsură ce proiectul crește, vom prezenta aici realizările, nevoile actuale și pașii următori.',
};

export default function ScoalaCrestinaScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [school, setSchool] = useState<SchoolContent>(INITIAL_CONTENT);
  const [loadError, setLoadError] = useState(false);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);

  // Reîncarcă informațiile când utilizatorul revine la această pagină.
  useFocusEffect(useCallback(() => {
    let active = true;
    async function loadSchool() {
      const [contentResult, galleryResult] = await Promise.all([
        supabase.from('school_content')
          .select('title, subtitle, description, mission, development_text, hero_image_url')
          .eq('id', 1).maybeSingle(),
        supabase.from('school_gallery')
          .select('id, image_url, sort_order')
          .order('sort_order', { ascending: true }),
      ]);
      const { data, error } = contentResult;
      if (!active) return;
      if (error) {
        console.log('Eroare încărcare Școala Creștină:', error);
        setLoadError(true);
      } else {
        setLoadError(false);
        if (data) {
          setSchool({
            title: data.title ?? INITIAL_CONTENT.title,
            subtitle: data.subtitle ?? INITIAL_CONTENT.subtitle,
            description: data.description ?? '',
            mission: data.mission ?? '',
            hero_image_url: data.hero_image_url ?? null,
            development_text: data.development_text ?? '',
          });
        }
      }
      if (galleryResult.error) {
        console.log('Eroare încărcare galerie școală:', galleryResult.error);
      } else {
        setGallery(galleryResult.data ?? []);
      }
    }
    loadSchool();
    return () => { active = false; };
  }, []));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <MisiBiPageHeader title="Școala Creștină" eyebrow="MISIUNEA BUCOVINA" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}>
        <View style={[styles.hero, wide && styles.heroWide]}>
          <Image source={school.hero_image_url ? { uri: school.hero_image_url } : require('../../assets/more/school-placeholder.jpg')} style={styles.heroPhoto} resizeMode="cover" />
          <View style={styles.heroBottom}>
            <View style={styles.heroPill}><Ionicons name="school-outline" size={15} color={RED} /><Text style={styles.heroPillText}>EDUCAȚIE • CREDINȚĂ • COMUNITATE</Text></View>
            <Text style={styles.heroTitle}>{school.title}</Text>
            <Text style={styles.heroDescription}>{school.subtitle}</Text>
          </View>
        </View>

        <View style={[styles.infoGrid, wide && styles.infoGridWide]}>
        <View style={[styles.intro, wide && styles.infoWide]}>
          <View style={styles.sectionHeadingRow}><View style={styles.accent} /><Text style={styles.sectionHeading}>Despre școală</Text></View>
          <Text style={styles.body}>{school.description || 'Prezentarea școlii va fi disponibilă în curând.'}</Text>
          {loadError ? <Text style={styles.note}>Informațiile nu au putut fi actualizate. Sunt afișate datele disponibile.</Text> : null}
        </View>

        {school.mission.trim() ? (
          <View style={[styles.missionInfo, wide && styles.infoWide]}>
            <View style={styles.sectionHeadingRow}><View style={styles.accent} /><Text style={styles.sectionHeading}>Misiunea noastră</Text></View>
            <Text style={styles.body}>{school.mission}</Text>
          </View>
        ) : null}

        </View>
        <View style={styles.sectionTop}><Text style={styles.blockHeading}>Viața la școală</Text><View style={styles.sectionLine}/></View>
        <Text style={styles.blockSubtitle}>Activități, învățare și momente petrecute împreună.</Text>
        <View style={styles.activitiesRow}>
          <View style={[styles.activityCard, { backgroundColor: '#FCECE8' }]}>
            <Ionicons name="book-outline" size={30} color={RED} />
            <Text style={styles.activityTitle}>Învățare</Text>
            <Text style={styles.activityDesc}>Descoperim și creștem</Text>
          </View>
          <View style={[styles.activityCard, { backgroundColor: '#F5EBDD' }]}>
            <Ionicons name="color-palette-outline" size={30} color={RED} />
            <Text style={styles.activityTitle}>Creativitate</Text>
            <Text style={styles.activityDesc}>Explorăm talente</Text>
          </View>
        </View>
        <View style={styles.meetingCard}>
          <View style={styles.meetingIcon}><Ionicons name="sparkles-outline" size={22} color={RED}/></View>
          <View style={{flex:1}}><Text style={styles.meetingTitle}>Cum se desfășoară o întâlnire?</Text><Text style={styles.meetingText}>Lecții biblice, cântece, jocuri și activități creative — momente în care copiii învață și cresc împreună.</Text></View>
        </View>
        <View style={styles.galleryNotice}>
          <Ionicons name="images-outline" size={23} color={RED} />
          <View style={{ flex: 1 }}>
            <Text style={styles.galleryTitle}>Galerie foto</Text>
            <Text style={styles.galleryText}>{gallery.length ? 'Momente din activitatea școlii.' : 'Aici vom adăuga fotografii reale din activitatea școlii.'}</Text>
          </View>
        </View>
        {gallery.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll} contentContainerStyle={styles.galleryRow}>
            {gallery.map(photo => (
              <Image key={photo.id} source={{ uri: photo.image_url }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.growthCard}>
          <View style={styles.growthIcon}><Ionicons name="trending-up-outline" size={25} color={RED} /></View>
          <Text style={styles.growthEyebrow}>CREȘTEM ÎMPREUNĂ</Text>
          <Text style={styles.growthTitle}>O școală în continuă dezvoltare</Text>
          <Text style={styles.growthText}>{school.development_text || INITIAL_CONTENT.development_text}</Text>
        </View>

        <View style={[styles.supportRow, wide && styles.supportRowWide]}>
        <View style={[styles.supportCard, wide && styles.supportCardWide]}>
          <Ionicons name="heart-outline" size={30} color={RED} />
          <Text style={styles.supportTitle}>Fii parte din povestea lor</Text>
          <Text style={styles.supportText}>Fiecare gest de sprijin poate contribui la dezvoltarea acestui proiect educațional.</Text>
          <TouchableOpacity style={styles.supportButton} onPress={() => router.push('/doneaza')} activeOpacity={0.85} accessibilityRole="button">
            <Text style={styles.supportButtonText}>Susține proiectul</Text>
            <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={[styles.supportCard, wide && styles.supportCardWide]}>
          <Ionicons name="people-outline" size={30} color={RED} />
          <Text style={styles.supportTitle}>Devino instructor la Școala Creștină</Text>
          <Text style={styles.supportText}>Implică-te în educația copiilor și contribuie la formarea lor prin valori creștine.</Text>
         <TouchableOpacity
  style={styles.supportButton}
  onPress={() => router.push('/scoala-crestina-inscriere')}
  activeOpacity={0.85}
  accessibilityRole="button"
>
  <Text style={styles.supportButtonText}>
    Înscrie-te ca instructor
  </Text>
  <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
</TouchableOpacity>
        </View>
        </View>
        <Text style={styles.footer}>MISIUNEA BUCOVINA  •  AJUTÂND ÎN NUMELE LUI HRISTOS</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: { height: 58, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: DARK, fontSize: 17, fontWeight: '800' },
  content: { maxWidth: 1120, width: '100%', alignSelf: 'center', paddingHorizontal: 17, paddingTop: 17, paddingBottom: 40 },
  heroWide:{height:380},infoGrid:{gap:0},infoGridWide:{flexDirection:'row',gap:14},infoWide:{flex:1},sectionTop:{flexDirection:'row',alignItems:'center',gap:12,marginTop:22},sectionLine:{height:1,backgroundColor:'#E8DFDA',flex:1,marginTop:25},meetingCard:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EEE5E0',borderRadius:17,padding:16,flexDirection:'row',gap:13,marginTop:16,alignItems:'flex-start'},meetingIcon:{width:42,height:42,borderRadius:13,backgroundColor:'#FCECEA',alignItems:'center',justifyContent:'center'},meetingTitle:{fontSize:15,fontWeight:'800',color:DARK},meetingText:{fontSize:12,lineHeight:19,color:'#666',marginTop:5},supportRow:{marginTop:8,gap:12},supportRowWide:{flexDirection:'row'},supportCardWide:{flex:1},
  hero: { height: 300, borderRadius: 23, overflow: 'hidden', backgroundColor: '#F7E8DC', justifyContent: 'flex-end' },
  heroPhoto: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  heroBottom: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 18, backgroundColor: 'rgba(255,249,244,0.94)' },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  heroPillText: { fontSize: 9, color: RED, letterSpacing: 0.8, fontWeight: '900' },
  heroTitle: { fontSize: 26, fontWeight: '900', color: DARK },
  heroDescription: { fontSize: 13, lineHeight: 19, color: '#5F6265', marginTop: 6, maxWidth: 310 },
  intro: { marginTop: 20, padding: 17, backgroundColor:'#FFFFFF', borderRadius:18, borderWidth:1,borderColor:'#EEEAE7' },
  missionInfo: { marginTop: 20, padding: 17, backgroundColor:'#FFFFFF', borderRadius:18, borderWidth:1,borderColor:'#EEEAE7' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  accent: { width: 4, height: 23, borderRadius: 2, backgroundColor: RED },
  sectionHeading: { color: DARK, fontSize: 20, fontWeight: '900' },
  body: { marginTop: 12, fontSize: 14, lineHeight: 23, color: '#555A5D' },
  note: { fontSize: 11, color: '#97918D', fontStyle: 'italic', marginTop: 8 },
  blockHeading: { color: DARK, fontSize: 20, fontWeight: '900', marginTop: 22 },
  blockSubtitle: { color: '#7B7E81', fontSize: 12, marginTop: 5, marginBottom: 13 },
  activitiesRow: { flexDirection: 'row', gap: 10 },
  activityCard: { flex: 1, minWidth: 0, borderRadius: 17, padding: 17, minHeight: 125, justifyContent: 'space-between' },
  activityTitle: { color: DARK, fontSize: 15, fontWeight: '900', marginTop: 12 },
  activityDesc: { color: '#777777', fontSize: 11, marginTop: 4 },
  galleryNotice: { marginTop: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 13, alignItems: 'center' },
  galleryScroll: { marginTop: 11 },
  galleryRow: { gap: 10, paddingRight: 4 },
  galleryImage: { width: 230, height: 160, borderRadius: 15, backgroundColor: '#EDE8E3' },
  galleryTitle: { color: DARK, fontSize: 14, fontWeight: '800' },
  galleryText: { color: '#7A7A7A', fontSize: 11, lineHeight: 16, marginTop: 3 },
  growthCard: { backgroundColor: '#F4E9E4', borderRadius: 20, padding: 21, marginTop: 26 },
  growthIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  growthEyebrow: { color: RED, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  growthTitle: { color: DARK, fontSize: 21, fontWeight: '900', lineHeight: 26, marginTop: 7 },
  growthText: { color: '#626064', fontSize: 13, lineHeight: 20, marginTop: 9 },
  supportCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 19, marginTop: 0, alignItems: 'flex-start' },
  supportTitle: { color: DARK, fontSize: 20, fontWeight: '900', marginTop: 12 },
  supportText: { color: '#6E7073', fontSize: 13, lineHeight: 20, marginTop: 8 },
  supportButton: { marginTop: 17, backgroundColor: RED, borderRadius: 13, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  inactiveButton: { opacity: 0.65 },
  supportButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  footer: { color: '#9B9B9B', fontSize: 9, fontWeight: '800', letterSpacing: 0.7, textAlign: 'center', marginTop: 28 },
});
