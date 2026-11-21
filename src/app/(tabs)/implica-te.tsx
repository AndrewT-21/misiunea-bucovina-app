import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RED = '#A61E22';
const DARK = '#171717';
const MUTED = '#666B73';
const BACKGROUND = '#F7F7F8';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Action = { title: string; description: string; label: string; icon: IconName; href: '/voluntariat' | '/doneaza' };
const actions: Action[] = [
  { title: 'Devino voluntar', description: 'Dăruiește din timpul și abilitățile tale pentru a ajuta acolo unde este nevoie.', label: 'Înscrie-te ca voluntar', icon: 'people-outline', href: '/voluntariat' },
  { title: 'Susține lucrarea', description: 'Contribuie la proiectele și cazurile prin care Misiunea Bucovina oferă sprijin.', label: 'Vezi cum poți dona', icon: 'heart-outline', href: '/doneaza' },
];

export default function ImplicaTeScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, wide && styles.wideContent]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
          <Text style={styles.title}>Implică-te</Text>
          <Text style={styles.subtitle}>Descoperă cum poți fi parte din lucrarea Misiunii Bucovina.</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><Ionicons name="heart" size={23} color="#FFFFFF" /></View>
            <Text style={styles.heroSmall}>FII PARTE DIN MISIUNE</Text>
          </View>
          <Text style={styles.heroTitle}>Împreună putem face mai mult</Text>
          <Text style={styles.heroText}>Timpul, experiența și generozitatea ta pot aduce speranță celor care au nevoie.</Text>
        </View>

        <Text style={styles.sectionTitle}>Cum vrei să te implici?</Text>
        <View style={[styles.actions, wide && styles.actionsWide]}>
          {actions.map((action) => (
            <TouchableOpacity key={action.href} style={[styles.card, wide && styles.cardWide]} activeOpacity={0.85} onPress={() => router.push(action.href)} accessibilityRole="button" accessibilityLabel={action.label}>
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}><Ionicons name={action.icon} size={23} color={RED} /></View>
                <View style={styles.arrowCircle}><Ionicons name="arrow-forward" size={18} color={RED} /></View>
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardDescription}>{action.description}</Text>
              <Text style={styles.cardLink}>{action.label}  <Ionicons name="arrow-forward" size={14} color={RED} /></Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Descoperă unde poți ajuta</Text>
        <View style={[styles.explore, wide && styles.actionsWide]}>
          <TouchableOpacity style={[styles.exploreItem, wide && styles.cardWide]} activeOpacity={0.85} onPress={() => router.push('/cazuri')} accessibilityRole="button">
            <View style={styles.exploreIcon}><Ionicons name="hand-left-outline" size={21} color={RED} /></View>
            <View style={styles.exploreText}><Text style={styles.exploreTitle}>Cazuri</Text><Text style={styles.exploreSubtitle}>Cunoaște poveștile celor care au nevoie de sprijin.</Text></View>
            <Ionicons name="chevron-forward" size={19} color={RED} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exploreItem, wide && styles.cardWide]} activeOpacity={0.85} onPress={() => router.push('/proiecte')} accessibilityRole="button">
            <View style={styles.exploreIcon}><Ionicons name="people-outline" size={21} color={RED} /></View>
            <View style={styles.exploreText}><Text style={styles.exploreTitle}>Proiecte</Text><Text style={styles.exploreSubtitle}>Vezi inițiativele și activitățile misiunii.</Text></View>
            <Ionicons name="chevron-forward" size={19} color={RED} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.help} activeOpacity={0.85} onPress={() => router.push('/contact')} accessibilityRole="button">
          <View style={styles.helpIcon}><Ionicons name="chatbubble-ellipses-outline" size={22} color={RED} /></View>
          <View style={styles.helpText}><Text style={styles.helpTitle}>Nu știi cum să ajuți?</Text><Text style={styles.helpDescription}>Scrie-ne și află cum te poți implica.</Text></View>
          <Ionicons name="arrow-forward" size={20} color={RED} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACKGROUND },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 48 },
  wideContent: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 28, paddingBottom: 64 },
  header: { marginBottom: 18 },
  eyebrow: { color: RED, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: DARK, fontSize: 34, lineHeight: 42, fontWeight: '900', marginTop: 5 },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 21, marginTop: 7 },
  hero: { backgroundColor: RED, borderRadius: 22, padding: 21 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  heroIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroSmall: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  heroText: { color: '#FFFFFF', opacity: 0.93, fontSize: 13, lineHeight: 20, marginTop: 8 },
  sectionTitle: { color: DARK, fontSize: 20, fontWeight: '900', marginTop: 25, marginBottom: 12 },
  actions: { gap: 11 }, actionsWide: { flexDirection: 'row' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEF0', borderRadius: 19, padding: 18 },
  cardWide: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: DARK, fontSize: 19, fontWeight: '900', marginTop: 13 },
  cardDescription: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 6 },
  cardLink: { color: RED, fontSize: 13, fontWeight: '800', marginTop: 15 },
  explore: { gap: 10 },
  exploreItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEEEF0', borderRadius: 17, padding: 13, gap: 11 },
  exploreIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  exploreText: { flex: 1 }, exploreTitle: { color: DARK, fontSize: 15, fontWeight: '800' },
  exploreSubtitle: { color: MUTED, fontSize: 12, lineHeight: 17, marginTop: 3 },
  help: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F0', borderRadius: 17, padding: 15, marginTop: 22, gap: 11 },
  helpIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  helpText: { flex: 1 }, helpTitle: { color: DARK, fontSize: 15, fontWeight: '800' },
  helpDescription: { color: MUTED, fontSize: 12, lineHeight: 18, marginTop: 3 },
});
