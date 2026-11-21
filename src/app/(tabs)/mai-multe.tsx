import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image,
  Linking,
  Platform,
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F7F6F3';
const WHITE = '#FFFFFF';
type IconName = keyof typeof Ionicons.glyphMap;
type SocialLinks = {
  facebook: string;
  instagram: string;
  youtube: string;
};
export default function MoreScreen() {
  const [hasSchoolAccess, setHasSchoolAccess] = useState(false);
  const [hasAssignedSchedule, setHasAssignedSchedule] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    async function checkSchoolAccess() {
      setHasSchoolAccess(false);
      setHasAssignedSchedule(false);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || !active) return;

      const { data: assigned, error: assignedError } = await supabase.from('weekly_schedule_assignments').select('activity_id').eq('user_id', user.id).limit(1);
      if (active && !assignedError) setHasAssignedSchedule((assigned?.length ?? 0) > 0);

      // RPC-ul trebuie să întoarcă doar localitățile permise utilizatorului curent.
      const { data, error } = await supabase.rpc('school_list_accessible_localities');
      if (error) {
        console.log('Verificare acces Școala Creștină:', error.message);
        return;
      }
console.log('USER ID:', user.id);
console.log('LOCALITĂȚI ACCESIBILE:', data);
console.log('EROARE ACCES:', error);

if (active) setHasSchoolAccess(Array.isArray(data) && data.length > 0);    }
    void checkSchoolAccess();
    return () => { active = false; };
  }, []));

  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    facebook: '',
    instagram: '',
    youtube: '',
  });
  useEffect(() => {
    let active = true;
    async function loadSocialLinks() {
      const { data, error } = await supabase
        .from('app_settings')
        .select('facebook_url, instagram_url, youtube_url')
        .limit(1)
        .maybeSingle();
      if (error) {
        console.log('Eroare încărcare linkuri sociale:', error);
        return;
      }
      if (active && data) {
        setSocialLinks({
          facebook: data.facebook_url ?? '',
          instagram: data.instagram_url ?? '',
          youtube: data.youtube_url ?? '',
        });
      }
    }
    loadSocialLinks();
    return () => { active = false; };
  }, []);
  async function openSocial(url: string) {
    try {
      const allowed = url.startsWith("https://") || url.startsWith("http://");
      if (!allowed || !(await Linking.canOpenURL(url))) {
        Alert.alert('Link indisponibil', 'Nu am putut deschide această adresă.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Eroare', 'Linkul nu a putut fi deschis.');
    }
  }
  function comingSoon(title: string) {
    Alert.alert(title, 'Această pagină va fi disponibilă în curând.');
  }
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const isCompact = width < 600;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, isDesktop && styles.webDesktopContent]}>
        {/* 1. HEADER + MISIUNE */}
        <View style={styles.header}>
          <Image source={require('../../../assets/more/header-mountains.jpg')} style={[styles.headerPhoto, isDesktop && styles.webHeaderPhoto]} resizeMode="cover" />

          <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
          <Text style={styles.title}>Mai multe</Text>
          <Text style={styles.subtitle}>
            Află mai multe despre misiune, activitatea noastră și modalitățile prin care poți rămâne conectat.
          </Text>
        </View>
        <TouchableOpacity style={[styles.missionCard, isDesktop && styles.webMissionCard]} activeOpacity={0.88} onPress={() => router.push('/despre-noi')}>
          <Image source={require('../../../assets/more/mission-hands.jpg')} style={[styles.missionPhoto, isDesktop && styles.webMissionPhoto]} resizeMode="cover" />

          <View style={styles.missionIcon}><Ionicons name="add-outline" size={29} color={WHITE} /></View>
          <Text style={styles.missionOverline}>AJUTÂND ÎN NUMELE LUI HRISTOS</Text>
          <Text style={[styles.missionTitle, isDesktop && styles.webMissionTitle]}>Misiunea Bucovina</Text>
          <Text style={[styles.missionDescription, isDesktop && styles.webMissionDescription]}>
            Credem că fiecare gest de bunătate poate aduce speranță și poate schimba o viață.
          </Text>
          <View style={styles.missionArrow}><Ionicons name="arrow-forward" size={19} color={RED} /></View>
        </TouchableOpacity>
        {/* 2. EXPLOREAZĂ */}
        <SectionTitle title="EXPLOREAZĂ" />
        <View style={[styles.exploreRow, isDesktop && styles.webExploreRow]}>
          <ExploreCard compact={isCompact} icon="people-outline" title={"Despre\nmisiune"} tone="rose" photo={require('../../../assets/more/explore-mission.jpg')} onPress={() => router.push('/despre-noi')} />
          <ExploreCard compact={isCompact} icon="document-text-outline" title="Rapoarte" tone="sand" photo={require('../../../assets/more/explore-reports.jpg')} onPress={() => router.push('/rapoarte')} />
          <ExploreCard compact={isCompact} icon="newspaper-outline" title="Noutăți" tone="peach" photo={require('../../../assets/more/explore-news.jpg')} onPress={() => router.push('/noutati')} />
        </View>
        {/* ȘCOALA CREȘTINĂ */}
        <SectionTitle title="ȘCOALA CREȘTINĂ" />
        <TouchableOpacity
          style={[styles.schoolCard, isDesktop && styles.webSchoolCard]}
          activeOpacity={0.85}
          onPress={() => router.push('/scoala-crestina')}
          accessibilityRole="button"
          accessibilityLabel="Deschide pagina Școala Creștină"
        >
          <Image source={require('../../../assets/more/school-placeholder.jpg')} style={[styles.schoolPhoto, isDesktop && styles.webSchoolPhoto]} resizeMode="cover" />
          <View style={styles.schoolIcon}>
            <Ionicons name="school-outline" size={29} color={RED} />
          </View>
          <View style={styles.schoolContent}>
            <Text style={styles.schoolTitle}>Școala Creștină</Text>
            <Text style={styles.schoolSubtitle}>Un loc unde educația, credința și viitorul copiilor cresc împreună.</Text>
          </View>
          <View style={[styles.schoolArrow, isCompact && styles.compactSchoolArrow]}>
            <Ionicons name="arrow-forward" size={19} color={RED} />
          </View>
        </TouchableOpacity>
        <SectionTitle title="COMUNITATEA VOLUNTARILOR" />
        <View style={styles.menu}>
          <MenuItem icon="heart-circle-outline" title="Ziua Voluntarului" subtitle="Evenimentul anual și galeriile edițiilor anterioare" onPress={() => router.push('/ziua-voluntarului' as any)} last />
        </View>
        <SectionTitle title="AI NEVOIE DE AJUTOR?" />
        <View style={styles.menu}>
          <MenuItem icon="hand-left-outline" title="Solicitare de ajutor" subtitle="Trimite o solicitare fără să creezi un cont" onPress={() => router.push('/solicitare-ajutor' as any)} last />
        </View>
        {/* 3. SPAȚIUL MEU */}
        <SectionTitle title="SPAȚIUL MEU" />
        <View style={styles.menu}>
          <MenuItem icon="calendar-clear-outline" title="Activitățile mele" subtitle="Înscrieri, confirmări și istoricul activităților" onPress={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            router.push(session?.user ? '/voluntar/activitatile-mele' as any : '/voluntar/login' as any);
          }} />
          {hasAssignedSchedule && <MenuItem icon="calendar-outline" title="Programul meu" subtitle="Activitățile săptămânale care mi-au fost atribuite" onPress={() => router.push('/programul-meu' as any)} />}
          <MenuItem icon="heart-outline" title="Implicarea mea" subtitle="Contribuțiile, activitățile și istoricul meu" onPress={() => router.push('/implicarea-mea')} />
          {hasSchoolAccess && (
            <MenuItem
              icon="briefcase-outline"
              title="Departamentele mele"
              subtitle="Departamentele și localitățile în care activezi"
              onPress={() => router.push('/voluntar/departamente')}
              last
            />
          )}
        </View>
        {/* 4. RĂMÂI CONECTAT */}
        <SectionTitle title="RĂMÂI CONECTAT" />
        <View style={styles.menu}>
          {socialLinks.facebook ? (
            <MenuItem icon="logo-facebook" iconColor="#1877F2" iconBackground="#EAF2FF" title="Facebook" subtitle="Urmărește-ne pe Facebook" onPress={() => openSocial(socialLinks.facebook)} />
          ) : null}
          {socialLinks.instagram ? (
            <MenuItem icon="logo-instagram" iconColor="#D62976" iconBackground="#FFF0F6" title="Instagram" subtitle="Urmărește-ne pe Instagram" onPress={() => openSocial(socialLinks.instagram)} />
          ) : null}
          {socialLinks.youtube ? (
            <MenuItem icon="logo-youtube" iconColor="#FF0033" iconBackground="#FFF0F0" title="YouTube" subtitle="Urmărește-ne pe YouTube" onPress={() => openSocial(socialLinks.youtube)} />
          ) : null}
          <MenuItem icon="mail-outline" title="Contact" subtitle="Ia legătura cu echipa noastră" onPress={() => router.push('/contact')} last />
        </View>
        {/* 5. IMPLICĂ-TE */}
        <SectionTitle title="IMPLICĂ-TE" />
        <View style={[styles.involveRow, isDesktop && styles.webInvolveRow]}>
          <InvolveCard compact={isCompact} icon="heart-outline" title="Donează" subtitle="Susține lucrarea Misiunii Bucovina" variant="donate" photo={require('../../../assets/more/donate-hands.jpg')} onPress={() => router.push('/doneaza')} />
          <InvolveCard compact={isCompact} icon="people-outline" title="Voluntariat" subtitle="Devino parte din echipa de voluntari" variant="volunteer" photo={require('../../../assets/more/volunteer-people.jpg')} onPress={() => router.push('/voluntariat')} />
          <InvolveCard compact={isCompact} icon="people-circle-outline" title="Voluntarii noștri" subtitle="Descoperă echipa Misiunea Bucovina" variant="volunteer" photo={require('../../../assets/more/volunteer-people.jpg')} onPress={() => router.push('/voluntarii-nostri')} />
        </View>
        {/* 6. INFORMAȚII UTILE + FOOTER */}
        <SectionTitle title="INFORMAȚII UTILE" />
        <View style={styles.menu}>
          <MenuItem icon="help-circle-outline" title="Întrebări frecvente" subtitle="Răspunsuri la cele mai comune întrebări" onPress={() => comingSoon('Întrebări frecvente')} />
          <MenuItem icon="shield-checkmark-outline" title="Politica de confidențialitate și Termeni și condiții" subtitle="Consultă documentul integral" onPress={() => router.push('/politica-de-confidentialitate' as any)} last />
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerName}>MISIUNEA BUCOVINA</Text>
          <Text style={styles.footerMessage}>Ajutând în Numele lui Hristos</Text>
          <Text style={styles.footerVersion}>Versiunea 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}
function ExploreCard({ icon, title, tone, photo, onPress, compact }: {
  compact: boolean;
  icon: IconName;
  title: string;
  tone: 'rose' | 'sand' | 'peach';
  photo: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.exploreCard, compact && styles.compactExploreCard, tone === 'rose' ? styles.exploreRose : tone === 'sand' ? styles.exploreSand : styles.explorePeach]} onPress={onPress} activeOpacity={0.85}>
      <Image source={photo} style={[styles.explorePhoto, Platform.OS === 'web' && styles.webExplorePhoto]} resizeMode="cover" />

      <View style={[styles.exploreHeading, compact && styles.compactExploreHeading]}><Ionicons name={icon} size={compact ? 17 : 23} color={DARK} /><Text style={[styles.exploreTitle, compact && styles.compactExploreTitle, Platform.OS === 'web' && !compact && styles.webExploreTitle]}>{title.replace("\n", " ")}</Text></View>
      <View style={[styles.exploreArrow, compact && styles.compactCardArrow]}><Ionicons name="arrow-forward" size={compact ? 17 : 18} color={RED} /></View>
    </TouchableOpacity>
  );
}
function MenuItem({ icon, title, subtitle, onPress, iconColor = RED, iconBackground = '#FFF0ED', last = false }: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  iconColor?: string;
  iconBackground?: string;
  last?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.menuItem, last && styles.menuItemLast]} activeOpacity={0.75} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: iconBackground }]}><Ionicons name={icon} size={23} color={iconColor} /></View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color="#92979B" />
    </TouchableOpacity>
  );
}
function InvolveCard({ icon, title, subtitle, variant, photo, onPress, compact }: {
  compact: boolean;
  icon: IconName;
  title: string;
  subtitle: string;
  variant: 'donate' | 'volunteer';
  photo: number;
  onPress: () => void;
}) {
  const donate = variant === 'donate';
  return (
    <TouchableOpacity style={[styles.involveCard, compact && styles.compactInvolveCard, donate ? styles.donateCard : styles.volunteerCard]} onPress={onPress} activeOpacity={0.85}>
      <Image source={photo} style={[styles.involvePhoto, Platform.OS === 'web' && styles.webInvolvePhoto]} resizeMode="cover" />
      <View style={[styles.involveHeading, compact && styles.compactInvolveHeading]}><Ionicons name={icon} size={compact ? 17 : 25} color={RED} /><Text style={[styles.involveTitle, compact && styles.compactInvolveTitle, Platform.OS === 'web' && !compact && styles.webInvolveTitle]}>{title}</Text></View>
      <Text style={[styles.involveSubtitle, compact && styles.compactInvolveSubtitle, Platform.OS === 'web' && !compact && styles.webInvolveSubtitle]}>{subtitle}</Text>
      <View style={[styles.involveArrow, compact && styles.compactCardArrow]}><Ionicons name="arrow-forward" size={compact ? 17 : 18} color={RED} /></View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACKGROUND },
  content: { paddingHorizontal: 17, paddingBottom: 32, width: '100%', maxWidth: 1160, alignSelf: 'center' },
  header: { paddingTop: 17, paddingBottom: 22, overflow: 'hidden', minHeight: 145 },
  headerPhoto: { position: 'absolute', left: '-12%', top: '-12%', width: '125%', height: '125%' },
  eyebrow: { color: RED, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: DARK, fontSize: 36, lineHeight: 42, fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#72767A', fontSize: 13, lineHeight: 20, marginTop: 6, maxWidth: 345 },
  missionCard: { backgroundColor: '#96161A', borderRadius: 21, height: 210, padding: 19, overflow: 'hidden', justifyContent: 'flex-end' },
  missionPhoto: { position: 'absolute', left: '-13%', top: '-12%', width: '130%', height: '125%' },
  missionDecoration: { position: 'absolute', right: -45, top: -80, width: 160, height: 160, borderRadius: 80, backgroundColor: '#FFFFFF', opacity: 0.04 },
  missionIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  missionOverline: { color: WHITE, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  missionTitle: { color: WHITE, fontSize: 24, fontWeight: '900', marginTop: 5 },
  missionDescription: { color: WHITE, fontSize: 12, lineHeight: 18, marginTop: 8, maxWidth: '79%', textShadowColor: 'rgba(60,0,0,0.15)', textShadowRadius: 2 },
  missionArrow: { position: 'absolute', right: 17, bottom: 17, width: 38, height: 38, borderRadius: 19, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { color: '#82878C', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, marginTop: 27, marginBottom: 12, marginLeft: 2 },
  exploreRow: { flexDirection: 'row', gap: 9 },
  exploreCard: { flex: 1, minWidth: 0, height: 170, borderRadius: 17, padding: 10, overflow: 'hidden', justifyContent: 'flex-start' },
  explorePhoto: { position: 'absolute', left: '-17%', top: '-8%', width: '140%', height: '120%' },
  exploreRose: { backgroundColor: '#F0E5E2' },
  exploreSand: { backgroundColor: '#F1EAE0' },
  explorePeach: { backgroundColor: '#F5E8E2' },
  exploreHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 10, padding: 7, alignSelf: 'flex-start', maxWidth: '100%' },
  exploreTitle: { color: DARK, fontSize: 12, lineHeight: 16, fontWeight: '900', flexShrink: 1 },
  exploreArrow: { position: 'absolute', bottom: 12, right: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  compactExploreCard: { padding: 5 },
  compactExploreHeading: { gap: 4, paddingHorizontal: 5, paddingVertical: 6, width: '100%', alignSelf: 'stretch', borderRadius: 8 },
  compactExploreTitle: { fontSize: 10, lineHeight: 12, flexShrink: 1 },
  compactCardArrow: { width: 34, height: 34, borderRadius: 17, right: 8, bottom: 8, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  exploreCircle: { position: 'absolute', right: -35, bottom: -54, width: 126, height: 126, borderRadius: 63, backgroundColor: '#FFFFFF', opacity: 0.04 },
  menu: { backgroundColor: WHITE, borderRadius: 18, overflow: 'hidden' },
  menuItem: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menuContent: { flex: 1, marginLeft: 12, paddingVertical: 10 },
  menuTitle: { color: DARK, fontSize: 14, fontWeight: '800' },
  menuSubtitle: { color: '#80868B', fontSize: 11, lineHeight: 16, marginTop: 3 },
  involveRow: { flexDirection: 'row', gap: 9 },
  involveCard: { flex: 1, minWidth: 0, height: 160, borderRadius: 18, padding: 12, paddingBottom: 25, overflow: 'hidden', justifyContent: 'flex-end' },
  donateCard: { backgroundColor: '#F6D8D4' },
  volunteerCard: { backgroundColor: '#F7E1C9' },
  involvePhoto: { position: 'absolute', left: '-13%', top: '-25%', width: '130%', height: '150%' },
  compactInvolveCard: { paddingHorizontal: 7, paddingBottom: 45 },
  compactInvolveHeading: { top: 12, left: 6, right: 6, gap: 4, alignItems: 'center' },
  compactInvolveTitle: { fontSize: 11, lineHeight: 13, paddingHorizontal: 4, paddingVertical: 5, flexShrink: 1 },
  compactInvolveSubtitle: { fontSize: 9, lineHeight: 12, paddingRight: 0, marginBottom: 0 },
  involveDecoration: { position: 'absolute', width: 145, height: 145, borderRadius: 73, right: -70, top: -50, backgroundColor: '#FFFFFF', opacity: 0.07 },
  involveTextShade: { position: 'absolute', left: 0, bottom: 0, width: '100%', height: 66, backgroundColor: 'rgba(255,246,239,0.78)' },
  involveHeading: { position: 'absolute', top: 15, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  involveIcon: { position: 'absolute', top: 16, left: 15 },
  involveTitle: { color: DARK, fontSize: 17, fontWeight: '900', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  involveSubtitle: { color: '#3D3D3D', fontSize: 10, lineHeight: 14, marginTop: 5, paddingRight: 14, maxWidth: '100%' },
  involveArrow: { position: 'absolute', right: 12, bottom: 12, width: 30, height: 30, borderRadius: 15, backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  schoolCard: { backgroundColor: '#FFFFFF', borderRadius: 19, minHeight: 126, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: '#F0E4DF', overflow: 'hidden' },
  schoolPhoto: { position: 'absolute', right: 0, top: 0, width: '100%', height: 190 },
  schoolIcon: { width: 56, height: 56, borderRadius: 17, backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center' },
  schoolContent: { flex: 1, backgroundColor: 'rgba(255,255,255,0.46)', borderRadius: 8, paddingVertical: 4 },
  schoolTitle: { color: DARK, fontSize: 18, fontWeight: '900' },
  schoolSubtitle: { color: '#777777', fontSize: 11, lineHeight: 16, marginTop: 5 },
  schoolArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF0ED', alignItems: 'center', justifyContent: 'center' },
  compactSchoolArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: WHITE },
  footer: { alignItems: 'center', paddingTop: 37, paddingBottom: 12 },
  footerName: { color: RED, fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  footerMessage: { color: '#777777', fontSize: 11, marginTop: 6 },
  footerVersion: { color: '#A6A6A6', fontSize: 10, marginTop: 7 },
  webDesktopContent: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 56 },
  // Doar desktop: imagini fara supradimensionarea de 125-150% din layoutul mobil.
  webHeaderPhoto: { left: 0, top: 0, width: '100%', height: '100%', opacity: 0.55 },
  webMissionCard: { height: 230, padding: 24, backgroundColor: '#8D181E' },
  webMissionPhoto: { left: 0, top: 0, width: '100%', height: '100%', opacity: 0.36 },
  webMissionTitle: { fontSize: 28, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 4 },
  webMissionDescription: { fontSize: 14, lineHeight: 21, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4 },
  webExploreRow: { gap: 16 },
  webExplorePhoto: { left: 0, top: 0, width: '100%', height: '100%', opacity: 0.35 },
  webExploreTitle: { fontSize: 17, lineHeight: 22 },
  webSchoolCard: { minHeight: 138 },
  webSchoolPhoto: { height: '100%', opacity: 0.22 },
  webInvolveRow: { gap: 16 },
  webInvolvePhoto: { left: 0, top: 0, width: '100%', height: '100%', opacity: 0.32 },
  webInvolveTitle: { fontSize: 20 },
  webInvolveSubtitle: { fontSize: 13, lineHeight: 18, backgroundColor: 'rgba(255,255,255,0.78)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

});
