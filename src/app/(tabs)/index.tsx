import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAccountItem } from '../../lib/account-storage';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const BG = '#FFFFFF';
const WEB_BG = '#F3F4F6';
const WEB_RED = '#B91C2B';

type HomeCase = { id: string; title: string; story: string | null; location: string | null; image_url: string | null; display_order: number };
type HomeProject = { id: string; title: string; description: string | null; image_url: string | null; status: 'active' | 'seasonal' | 'permanent' | 'planned' };
type HomeVolunteer = { id: string; display_name: string; role: string; photo_url: string | null; featured: boolean; sort_order: number };
type ImpactStats = { children_helped: string; families_supported: string; wood_tons: string; food_tons: string };

export default function HomeScreen() {
  const [cases, setCases] = useState<HomeCase[]>([]);
  const [projects, setProjects] = useState<HomeProject[]>([]);
  const [impact, setImpact] = useState<ImpactStats | null>(null);
  const [unread, setUnread] = useState(0);
  const [volunteers, setVolunteers] = useState<HomeVolunteer[]>([]);
  const slideMotion = useRef(new Animated.Value(0)).current;
  const carouselAnimating = useRef(false);
  const carouselIndex = useRef(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [accountRole, setAccountRole] = useState<'super_admin' | 'admin' | 'voluntar' | null>(null);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;
  const cardWidth = isDesktop ? Math.min(355, (Math.min(width, 1180) - 80) / 3) : Math.min(265, width * 0.68);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      const [caseResult, projectResult, impactResult, volunteerResult] = await Promise.all([
        supabase.from('cases').select('id,title,story,location,image_url,display_order').eq('status', 'active').order('display_order', { ascending: true }).order('created_at', { ascending: false }).limit(3),
        supabase.from('projects').select('id,title,description,image_url,status,display_order').in('status', ['active','seasonal','permanent','planned']).order('display_order', { ascending: true }).order('created_at', { ascending: false }).limit(3),
        supabase.from('impact_stats').select('children_helped,families_supported,wood_tons,food_tons').limit(1).maybeSingle(),
        supabase.from('volunteer_public_profiles').select('id,display_name,role,photo_url,featured,sort_order').eq('is_published', true).order('sort_order', { ascending: true }).limit(150),
      ]);
      if (!active) return;
      if (caseResult.error) console.log('Home cases:', caseResult.error);
      if (projectResult.error) console.log('Home projects:', projectResult.error);
      if (impactResult.error) console.log('Home impact:', impactResult.error);
      if (volunteerResult.error) console.log('Home volunteers:', volunteerResult.error);
      setCases((caseResult.data ?? []) as HomeCase[]);
      setProjects((projectResult.data ?? []) as HomeProject[]);
      setImpact((impactResult.data ?? null) as ImpactStats | null);
      setVolunteers((volunteerResult.data ?? []) as HomeVolunteer[]);
    };
    const loadUnread = async () => {
      // Notificarile generale se incarca independent de autentificare.
      let generalCount = 0;
      try {
        let lastRead: string | null = null;
        try { lastRead = await getAccountItem('notifications_last_read'); }
        catch (error) { console.log('Home notification read marker:', error); }

        let query = supabase.from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published');
        if (lastRead) query = query.gt('created_at', lastRead);
        const { count, error } = await query;
        if (error) console.log('Home general notifications:', error);
        else generalCount = count ?? 0;
      } catch (error) {
        console.log('Home general notifications:', error);
      }
      if (active) setUnread(generalCount);

      // O sesiune lipsa este normala pentru vizitatori.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { count, error } = await supabase
          .from('user_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .is('read_at', null);
        if (error) console.log('Home private notifications:', error);
        if (active && !error) setUnread(generalCount + (count ?? 0));
      } catch (error) {
        console.log('Home private notifications:', error);
      }
    };
    const checkAccount = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) { setAccountRole(null); return; }
        const { data: admin, error } = await supabase.from('admins').select('user_id, role').eq('user_id', user.id).maybeSingle();
        if (!active) return;
        if (error) { console.log('Account role:', error); setAccountRole(null); return; }
        setAccountRole(admin?.role === 'super_admin' ? 'super_admin' : admin ? 'admin' : 'voluntar');
      } catch (error) { if (active) setAccountRole(null); console.log('Account role:', error); }
    };
    load(); loadUnread(); checkAccount();
    return () => { active = false; };
  }, []));

  const leaders = [
    { name: 'Daniel Ursachi', role: 'Președinte' },
    { name: 'Emanuel Ursachi', role: 'Vicepreședinte' },
  ].map(person => ({ ...person, profile: volunteers.find(v => v.display_name.toLocaleLowerCase('ro-RO').includes(person.name.toLocaleLowerCase('ro-RO'))) }));
  const carouselVolunteers = volunteers.filter(v => !leaders.some(l => l.profile?.id === v.id));
  const visibleCount = isDesktop ? 4 : 2;
  // Pe mobil folosim latimea reala disponibila in sectiune, nu o latime
  // calculata din banda animata (care este mult mai lata decat ecranul).
  const mobileCarouselWidth = Math.max(0, width - 78);
  const effectiveCarouselWidth = isDesktop ? carouselWidth : mobileCarouselWidth;
  // Randam o banda stabila de carduri, fara inlocuirea imaginilor dupa fiecare pas.
  // Asa eliminam flash-ul alb produs de schimbarea continutului in timpul resetarii.
  const carouselGap = 10;
  const volunteerCardWidth = effectiveCarouselWidth > 0 ? (effectiveCarouselWidth - carouselGap * (visibleCount - 1)) / visibleCount : 0;
  const carouselStep = volunteerCardWidth + carouselGap;
  const canSlide = carouselVolunteers.length > visibleCount && carouselStep > 0;
  const carouselPadding = visibleCount + 4;
  const carouselLength = carouselVolunteers.length;
  const carouselItems = carouselLength
    ? Array.from({ length: carouselLength + 2 * carouselPadding + visibleCount }, (_, offset) =>
        carouselVolunteers[((offset - carouselPadding) % carouselLength + carouselLength) % carouselLength])
    : [];

  // Pozitionam fereastra in zona centrala a benzii. Resetam numai cand
  // atingem marginea unei copii, pe exact aceleasi fotografii (fara remount).
  useEffect(() => {
    carouselAnimating.current = false;
    carouselIndex.current = carouselPadding;
    slideMotion.stopAnimation();
    slideMotion.setValue(-carouselPadding * carouselStep);
  }, [carouselStep, carouselPadding, carouselLength, slideMotion]);

  const moveVolunteers = (direction: 1 | -1) => {
    if (!canSlide || carouselAnimating.current) return;
    carouselAnimating.current = true;
    const target = carouselIndex.current + direction * 2;
    Animated.timing(slideMotion, {
      toValue: -target * carouselStep,
      duration: 650,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        let normalized = target;
        if (normalized >= carouselPadding + carouselLength) normalized -= carouselLength;
        if (normalized < carouselPadding) normalized += carouselLength;
        carouselIndex.current = normalized;
        if (normalized !== target) slideMotion.setValue(-normalized * carouselStep);
      } else {
        slideMotion.setValue(-carouselIndex.current * carouselStep);
      }
      carouselAnimating.current = false;
    });
  };
  const nextVolunteer = () => moveVolunteers(1);
  const previousVolunteer = () => moveVolunteers(-1);

  // Avans automat cu doua carduri la fiecare 3 secunde.
  useEffect(() => {
    if (!canSlide) return;
    const timer = setInterval(() => moveVolunteers(1), 3000);
    return () => clearInterval(timer);
  }, [canSlide, carouselStep, carouselLength]);

  const stats: { icon: keyof typeof Ionicons.glyphMap; number: string; label: string }[] = [
    { icon: 'people-outline', number: impact?.children_helped ?? '—', label: 'Copii ajutați' },
    { icon: 'heart-outline', number: impact?.families_supported ?? '—', label: 'Familii sprijinite' },
    { icon: 'bonfire-outline', number: impact?.wood_tons ?? '—', label: 'Tone de lemne' },
    { icon: 'medkit-outline', number: impact?.food_tons ?? '—', label: 'Tone de alimente' },
  ];

  return (
    <SafeAreaView style={[styles.screen, isDesktop ? styles.desktopScreen : styles.mobileScreen]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} style={isDesktop && styles.desktopScroll} contentContainerStyle={styles.content}>
        <View style={[styles.pageInner, isDesktop && styles.desktopContent]}>
        <View style={[styles.header, isDesktop && styles.desktopHeader]}>
          {!isDesktop && <View style={styles.brand}>
            <Image source={require('../../../assets/app-icon.png')} style={styles.logo} resizeMode="contain" />
            <View><Text style={styles.brandTop}>MISIUNEA</Text><Text style={styles.brandBottom}>BUCOVINA</Text></View>
          </View>}
          <View style={styles.actions}>
            {accountRole === 'super_admin' && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Admin Dashboard"
                style={styles.headerButton}
                onPress={() => router.push('/admin')}
              >
                <Ionicons name={'shield-checkmark-outline'} size={24} color={RED} />
              </TouchableOpacity>
            )}
            <Link href="/favorite" asChild><Pressable accessibilityRole="link" accessibilityLabel="Favorite" style={StyleSheet.flatten([styles.headerButton, isDesktop && styles.desktopHeaderButton])}><Ionicons name="heart-outline" size={26} color={DARK} /></Pressable></Link>
            <Link href="/notificari" asChild>
              <TouchableOpacity accessibilityRole="link" accessibilityLabel="Notificări" style={StyleSheet.flatten([styles.headerButton, isDesktop && styles.desktopHeaderButton])}>
                <Ionicons name={'notifications-outline'} size={23} color={DARK} />
                {unread > 0 && <View pointerEvents="none" style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>}
              </TouchableOpacity>
            </Link>
            <Link
              href={accountRole === 'admin' || accountRole === 'super_admin'
                ? '/admin/contul-meu'
                : accountRole === 'voluntar'
                  ? '/voluntar/contul-meu'
                  : '/alege-cont'}
              asChild
            >
              <TouchableOpacity
                accessibilityRole="link"
                accessibilityLabel={accountRole === 'admin' || accountRole === 'super_admin' ? 'Profil administrator' : 'Contul meu'}
                style={StyleSheet.flatten([styles.headerButton, isDesktop && styles.desktopHeaderButton])}
              >
                <Ionicons name={'person-circle-outline'} size={24} color={DARK} />
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        <View style={[styles.hero, isDesktop ? styles.desktopHero : styles.mobileHero]}>
          {Platform.OS === 'web' ? (
            <img
              src="/home-hero.jpg"
              alt="Misiunea Bucovina"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '72%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
          ) : (
            <Image
  source={require('../../../assets/home-hero-mobile.png')}
  resizeMode="cover"
  style={[styles.heroPhoto, styles.mobileHeroPhoto]}
/>
          )}
          {!isDesktop && (
            <View pointerEvents="none" style={styles.mobileHeroOverlay} />
          )}
          {isDesktop && (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={styles.desktopHeroGradientBase} />
    {Platform.OS === 'web' && (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(23,18,20,0.98) 0%, rgba(23,18,20,0.90) 29%, rgba(23,18,20,0.48) 52%, rgba(23,18,20,0.04) 82%)'
        }}
      />
    )}
  </View>
)}

          <View style={[styles.heroTextArea, isDesktop ? styles.desktopHeroTextArea : styles.mobileHeroTextArea]}>
            <Text style={[styles.heroTitle, isDesktop ? styles.desktopHeroTitle : styles.mobileHeroTitle]}>Ajutând în</Text>
            <Text style={[styles.heroTitle, isDesktop ? styles.desktopHeroTitle : styles.mobileHeroTitle]}>Numele lui Hristos</Text>
            <Text style={[styles.heroDescription, isDesktop ? styles.desktopHeroDescription : styles.mobileHeroDescription]}>Sprijin, speranță și ajutor concret acolo unde este cea mai mare nevoie.</Text>

          </View>
        </View>

        <View style={[styles.statsPanel, isDesktop ? styles.desktopStatsPanel : styles.mobileStatsPanel]}>
          {stats.map((stat, i) => <View key={i} style={[styles.statItem, isDesktop && styles.desktopStatItem]}>
            <View style={styles.statIcon}><Ionicons name={stat.icon} size={23} color={RED}/></View>
            <Text style={[styles.statValue, isDesktop && styles.desktopStatValue]} numberOfLines={1} adjustsFontSizeToFit>{stat.number}</Text>
            <Text style={[styles.statCaption, isDesktop && styles.desktopStatCaption]}>{stat.label}</Text>
          </View>)}
        </View>

        <View style={[styles.sectionHeader, isDesktop && styles.desktopSectionHeader]}>
          <Text style={[styles.sectionTitle, isDesktop ? styles.desktopSectionTitle : styles.mobileSectionTitle]}>Cazuri care au nevoie de ajutor</Text>

        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.horizontal, isDesktop && styles.desktopHorizontal]}>
          {cases.length ? cases.map(item => <TouchableOpacity key={item.id} style={[styles.caseCard, isDesktop && styles.desktopCard, { width: cardWidth }]} onPress={() => router.push(`/caz/${item.id}`)} activeOpacity={0.85}>
            <View style={[styles.caseImageBox, isDesktop ? styles.desktopCardImage : styles.mobileCardImage]}>{item.image_url ? <Image source={{ uri: item.image_url }} style={styles.cover} resizeMode="cover"/> : <Ionicons name="people-outline" size={38} color={RED}/>}</View>
            <View style={[styles.caseBody, isDesktop ? styles.desktopCaseBody : styles.mobileCaseBody]}>
              <Text style={[styles.caseTitle, isDesktop ? styles.desktopCardTitle : styles.mobileCardTitle]} numberOfLines={2}>{item.title}</Text>
              {!!item.location && <Text style={styles.location} numberOfLines={1}><Ionicons name="location" size={12} color={RED}/> {item.location}</Text>}
              <View style={styles.caseButton}><Text style={styles.caseButtonText}>Vezi cazul</Text><Ionicons name="arrow-forward" size={14} color="#FFF"/></View>
            </View>
          </TouchableOpacity>) : <View style={styles.empty}><Text style={styles.emptyText}>Momentan nu există cazuri active.</Text></View>}
          <TouchableOpacity accessibilityRole="button" style={[styles.allCard, { width: cardWidth }]} onPress={() => router.push('/cazuri')}>
            <Ionicons name="heart-outline" size={36} color={RED}/>
            <Text style={styles.allCardTitle}>Descoperă toate cazurile</Text>
            <View style={styles.caseButton}><Text style={styles.caseButtonText}>Vezi toate cazurile</Text><Ionicons name="arrow-forward" size={14} color="#FFF"/></View>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.sectionHeader, isDesktop && styles.desktopSectionHeader]}>
          <Text style={[styles.sectionTitle, isDesktop ? styles.desktopSectionTitle : styles.mobileSectionTitle]}>Proiectele noastre</Text>

        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.horizontal, isDesktop && styles.desktopHorizontal]}>
          {projects.length ? projects.map(project => <TouchableOpacity key={project.id} style={[styles.projectCard, isDesktop && styles.desktopCard, { width: cardWidth }]} onPress={() => router.push(`/proiect/${project.id}`)} activeOpacity={0.85}>
            <View style={[styles.projectImageBox, isDesktop ? styles.desktopCardImage : styles.mobileCardImage]}>{project.image_url ? <Image source={{ uri: project.image_url }} style={styles.cover} resizeMode="cover"/> : <Ionicons name="heart-outline" size={34} color={RED}/>}</View>
            <View style={[styles.projectBody, isDesktop ? styles.desktopProjectBody : styles.mobileProjectBody]}><Text style={[styles.projectTitle, isDesktop ? styles.desktopCardTitle : styles.mobileCardTitle]} numberOfLines={2}>{project.title}</Text><View style={[styles.status, project.status === 'permanent' ? styles.statusBlue : project.status === 'seasonal' ? styles.statusAmber : project.status === 'planned' ? styles.statusPlanned : null]}><Text style={[styles.statusText, project.status === 'permanent' && styles.statusBlueText, project.status === 'seasonal' && styles.statusAmberText, project.status === 'planned' && styles.statusPlannedText]}>{project.status === 'seasonal' ? 'Sezonier' : project.status === 'permanent' ? 'Permanent' : project.status === 'planned' ? 'În perspectivă' : 'Activ'}</Text></View>
            <View style={[styles.caseButton, { marginTop: 12 }]}><Text style={styles.caseButtonText}>Vezi proiectul</Text><Ionicons name="arrow-forward" size={14} color="#FFF"/></View></View>
          </TouchableOpacity>) : <View style={styles.empty}><Text style={styles.emptyText}>Momentan nu există proiecte publicate.</Text></View>}
          <TouchableOpacity accessibilityRole="button" style={[styles.allCard, { width: cardWidth }]} onPress={() => router.push('/proiecte')}>
            <Ionicons name="albums-outline" size={36} color={RED}/>
            <Text style={styles.allCardTitle}>Descoperă toate proiectele</Text>
            <View style={styles.caseButton}><Text style={styles.caseButtonText}>Vezi toate proiectele</Text><Ionicons name="arrow-forward" size={14} color="#FFF"/></View>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity accessibilityRole="button" style={styles.helpCTA} onPress={() => router.push('/solicitare-ajutor' as any)}>
          <Ionicons name="hand-left-outline" size={20} color="#FFF"/>
          <Text style={styles.helpCTAText}>Solicitare de ajutor</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFF"/>
        </TouchableOpacity>

        <View style={styles.teamSection}>
          <View style={styles.teamHeading}>
            <View style={{flex:1}}>
              <Text style={styles.teamEyebrow}>OAMENII DIN SPATELE MISIUNII</Text>
              <Text style={[styles.sectionTitle, isDesktop && styles.desktopSectionTitle]}>Împreună facem binele posibil</Text>
              <Text style={styles.teamSubtitle}>Descoperă oamenii care își dedică timpul și energia pentru a-i ajuta pe ceilalți.</Text>
            </View>
          </View>
          <View style={[styles.leadersRow, !isDesktop && styles.leadersRowMobile]}>
            {leaders.map(person => <View key={person.name} style={[styles.leaderCard, isDesktop ? styles.leaderCardDesktop : styles.leaderCardMobile]}>
              {person.profile?.photo_url ? <View style={[styles.leaderPhotoFrame, !isDesktop && {height:200}]}><Image source={{uri:person.profile.photo_url}} style={styles.leaderPhoto} resizeMode="cover"/></View> : <View style={[styles.leaderPhotoFrame, styles.leaderPlaceholder]}><Ionicons name="person-outline" size={48} color="#B76B70" /></View>}
              <View style={styles.leaderDetails}><Text style={styles.leaderName}>{person.name}</Text><Text style={styles.leaderRole}>{person.role}</Text></View>
            </View>)}
          </View>
          <View style={styles.teamCarouselHeading}>
            <Text style={styles.teamCarouselTitle}>Voluntarii noștri</Text>
          </View>
          {carouselVolunteers.length > 0 ? (
            <View style={[styles.carouselOuter, !isDesktop && styles.carouselOuterMobile]}>
              <View
                style={[styles.carouselViewport, !isDesktop && styles.carouselViewportMobile]}
                onLayout={event => setCarouselWidth(event.nativeEvent.layout.width)}
              >
                {effectiveCarouselWidth > 0 && (
                  <Animated.View style={[styles.volunteerRow, {transform:[{translateX:slideMotion}]}]}>
                    {carouselItems.map((person, offset) => (
                      <View key={`${person.id}-${offset}`} style={[styles.volunteerCard, {width:volunteerCardWidth}]}>
                        {person.photo_url ? <Image source={{uri:person.photo_url}} style={styles.volunteerPhoto} resizeMode="cover"/> : <View style={[styles.volunteerPhoto, styles.leaderPlaceholder]}><Ionicons name="person-outline" size={35} color="#B76B70"/></View>}
                        <Text style={styles.volunteerName} numberOfLines={2}>{person.display_name}</Text>
                        <Text style={styles.volunteerRole} numberOfLines={2}>{person.role}</Text>
                      </View>
                    ))}
                  </Animated.View>
                )}
              </View>
              <TouchableOpacity accessibilityLabel="Voluntarii anteriori" disabled={!canSlide} onPress={previousVolunteer} style={[styles.carouselSideArrow, isDesktop ? styles.carouselArrowLeft : styles.carouselArrowLeftMobile, !canSlide && styles.teamArrowDisabled]}>
                <Ionicons name="chevron-back" size={23} color={RED}/>
              </TouchableOpacity>
              <TouchableOpacity accessibilityLabel="Voluntarii următori" disabled={!canSlide} onPress={nextVolunteer} style={[styles.carouselSideArrow, isDesktop ? styles.carouselArrowRight : styles.carouselArrowRightMobile, !canSlide && styles.teamArrowDisabled]}>
                <Ionicons name="chevron-forward" size={23} color={RED}/>
              </TouchableOpacity>
            </View>
          ) : <Text style={styles.teamSubtitle}>Profilurile voluntarilor vor apărea aici după publicare.</Text>}
          <View style={[styles.teamActions, !isDesktop && styles.teamActionsMobile]}>
            <TouchableOpacity style={[styles.teamPrimary, !isDesktop && styles.teamButtonMobile]} onPress={() => router.push('/voluntariat')}><Text style={[styles.teamPrimaryText, !isDesktop && styles.teamButtonTextMobile]} numberOfLines={1} adjustsFontSizeToFit>Descoperă voluntarii</Text>{isDesktop && <Ionicons name="arrow-forward" size={17} color="#FFF"/>}</TouchableOpacity>
            <TouchableOpacity style={[styles.teamSecondary, !isDesktop && styles.teamButtonMobile]} onPress={() => router.push('/implica-te')}><Text style={[styles.teamSecondaryText, !isDesktop && styles.teamButtonTextMobile]} numberOfLines={1} adjustsFontSizeToFit>Devino voluntar</Text></TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.involve, isDesktop ? styles.desktopInvolve : styles.mobileInvolve]} onPress={() => router.push('/implica-te')} activeOpacity={0.85}>
          <View style={styles.involveIcon}><Ionicons name="heart-half-outline" size={31} color={RED}/></View>
          <View style={styles.involveCopy}><Text style={styles.involveTitle}>Implică-te și tu</Text><Text style={styles.involveDescription}>Donează, devino voluntar sau susține proiectele noastre.</Text></View>
          <View style={styles.involveArrow}><Ionicons name="arrow-forward" size={23} color="#FFF"/></View>
        </TouchableOpacity>
        <View style={styles.footer}><Text style={styles.footerText}>Oameni. Locuri. Vieți. <Text style={{ color: RED, fontWeight: '800' }}>Pentru Hristos.</Text></Text></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  teamSection:{marginHorizontal:16,marginTop:48,backgroundColor:'#FFF',borderRadius:24,padding:22,borderWidth:1,borderColor:'#E6E8EC'},teamHeading:{flexDirection:'row',marginBottom:20},teamEyebrow:{color:RED,fontWeight:'900',fontSize:11,letterSpacing:1.5,marginBottom:8},teamSubtitle:{fontSize:14,color:'#68717F',lineHeight:21,marginTop:9},leadersRow:{flexDirection:'row',gap:16,marginBottom:30},leadersRowMobile:{flexDirection:'column'},leaderCard:{flex:1,backgroundColor:'#F8F8F9',borderRadius:16,overflow:'hidden',flexDirection:'row',borderWidth:1,borderColor:'#ECECEF',minHeight:290},leaderCardDesktop:{height:390,minHeight:390},leaderCardMobile:{minHeight:200},leaderPhotoFrame:{width:'47%',height:'100%',backgroundColor:'#FFFFFF',justifyContent:'center',alignItems:'center'},leaderPhoto:{width:'100%',height:'100%'},leaderPlaceholder:{backgroundColor:'#F9E8E9',justifyContent:'center',alignItems:'center'},leaderDetails:{flex:1,justifyContent:'center',padding:20},leaderName:{fontSize:24,fontWeight:'900',color:DARK},leaderRole:{fontSize:15,color:RED,fontWeight:'800',marginTop:7},teamCarouselHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16},teamCarouselTitle:{fontSize:22,fontWeight:'900',color:DARK},teamArrows:{flexDirection:'row',gap:8},teamArrow:{width:38,height:38,borderRadius:12,borderWidth:1,borderColor:'#E8D3D5',justifyContent:'center',alignItems:'center'},teamArrowDisabled:{opacity:0.3},carouselOuter:{position:'relative'},carouselViewport:{overflow:'hidden',width:'100%'},carouselSideArrow:{position:'absolute',top:'42%',width:42,height:48,borderRadius:14,borderWidth:1,borderColor:'#E8D3D5',backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',zIndex:3,elevation:4},carouselArrowLeft:{left:-17},carouselArrowRight:{right:-17},volunteerRow:{flexDirection:'row',gap:10},volunteerCard:{borderWidth:1,borderColor:'#EBEBEF',borderRadius:14,padding:9,backgroundColor:'#FFF',alignItems:'center'},volunteerPhoto:{width:'100%',aspectRatio:4/5,borderRadius:10,marginBottom:10},volunteerName:{fontSize:14,fontWeight:'900',textAlign:'center',color:DARK},volunteerRole:{fontSize:12,color:'#737373',textAlign:'center',marginTop:5},teamActions:{flexDirection:'row',gap:12,flexWrap:'wrap',marginTop:24},teamPrimary:{backgroundColor:RED,borderRadius:11,paddingHorizontal:17,paddingVertical:13,flexDirection:'row',alignItems:'center',gap:8},teamPrimaryText:{color:'#FFF',fontWeight:'800'},teamSecondary:{borderColor:'#E6C6C8',borderWidth:1,borderRadius:11,paddingHorizontal:17,paddingVertical:13},teamSecondaryText:{color:RED,fontWeight:'800'},
  teamActionsMobile:{flexWrap:'nowrap',gap:8,width:'100%',alignSelf:'stretch'},
  teamButtonMobile:{flexGrow:1,flexShrink:1,flexBasis:0,minWidth:0,maxWidth:'50%',paddingHorizontal:4,paddingVertical:12,justifyContent:'center',alignItems:'center'},
  teamButtonTextMobile:{fontSize:11,textAlign:'center',flexShrink:1},
  carouselOuterMobile:{width:'100%',minWidth:0,alignSelf:'stretch'},
  carouselViewportMobile:{width:'100%',minWidth:0,alignSelf:'stretch'},
  carouselArrowLeftMobile:{left:0,width:30,height:42,top:'43%',borderTopLeftRadius:0,borderBottomLeftRadius:0},
  carouselArrowRightMobile:{right:0,width:30,height:42,top:'43%',borderTopRightRadius:0,borderBottomRightRadius:0},
  screen: { flex: 1, backgroundColor: BG }, content: { paddingBottom: 28 }, pageInner: { width: '100%' },
  // Desktop-only overrides; the mobile layout remains unchanged.
  mobileScreen: { backgroundColor: '#F5F6F8' },
  mobileHero: { height: 340 },
  mobileHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13, 10, 13, 0.32)' },
  mobileHeroPhoto: { width: '100%' },
  mobileImageGradient: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  mobileHeroTextArea: {
  width: '88%',
  paddingHorizontal: 20,
  paddingTop: 92,
  paddingBottom: 0,
  justifyContent: 'center',
},

mobileHeroTitle: {
  fontSize: 27,
  lineHeight: 33,
  letterSpacing: 0,
},

mobileHeroDescription: {
  fontSize: 14,
  lineHeight: 21,
  maxWidth: 300,
  marginTop: 18,
},mobileStatsPanel: { backgroundColor: '#FFFFFF', paddingTop: 24, paddingBottom: 23, borderBottomWidth: 1, borderBottomColor: '#E4E7EC' },
  mobileSectionTitle: { fontSize: 22, lineHeight: 28, color: '#1F2937' },
  mobileCardImage: { height: 180, backgroundColor: '#FFF1F2' },
  mobileCardTitle: { fontSize: 16, lineHeight: 22, color: '#1F2937' },
  mobileCaseBody: { padding: 12 },
  mobileProjectBody: { paddingHorizontal: 12, paddingVertical: 12 },
  mobileInvolve: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#F1D3D7', padding: 16 },
  desktopScreen: { backgroundColor: WEB_BG },
  desktopScroll: { backgroundColor: WEB_BG },
  desktopContent: { width: '100%', maxWidth: 1400, alignSelf: 'center', paddingBottom: 60 },
  desktopHeader: { paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'flex-end', backgroundColor: WEB_BG, minHeight: 68 },
  desktopHeaderButton: { width: 46, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E5E9', marginLeft: 6 },
  desktopHero: { height: 470, borderRadius: 24, marginHorizontal: 16, marginTop: 16, backgroundColor: '#171214' },
  desktopHeroGradientBase: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(23,18,20,0.12)' },
  desktopHeroPhoto: { width: '100%' },
  desktopHeroTextArea: { width: '67%', paddingHorizontal: 58, paddingTop: 38 },
  desktopHeroEyebrow: { fontSize: 12, letterSpacing: 2.5 },
  desktopSectionTitle: { fontSize: 29, lineHeight: 37, letterSpacing: -0.6, color: '#1F2937' },
  desktopHeroTitle: { fontSize: 70, lineHeight: 76, letterSpacing: -1.5 },
  desktopHeroDescription: { fontSize: 16, lineHeight: 25, maxWidth: 390 },
  desktopHeroCTA: { paddingHorizontal: 21, paddingVertical: 15, borderRadius: 12, marginTop: 22 },
  desktopStatsPanel: { marginHorizontal: 16, marginTop: -14, paddingTop: 32, paddingBottom: 34, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E7EC' },
  desktopStatItem: { paddingVertical: 4 },
  desktopStatValue: { fontSize: 23, color: '#1F2937' },
  desktopStatCaption: { fontSize: 12, lineHeight: 17, color: '#566172' },
  desktopSeeAllText: { color: WEB_RED, fontSize: 14, fontWeight: '800' },
  desktopSectionHeader: { marginTop: 48, marginBottom: 20, marginHorizontal: 16 },
  desktopHorizontal: { paddingHorizontal: 16, paddingBottom: 16, gap: 18 },
  desktopCard: { borderColor: '#DDE2E8', borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1 },
  desktopCardImage: { height: 185, backgroundColor: '#FFF1F2' },
  desktopCardTitle: { fontSize: 17, lineHeight: 23, color: '#1F2937' },
  desktopCaseBody: { padding: 15 },
  desktopProjectBody: { paddingHorizontal: 15, paddingVertical: 15 },
  desktopInvolve: { marginHorizontal: 16, marginTop: 48, padding: 24, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#F1C9CE' },
  header: { paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 }, logo: { width: 43, height: 48, marginRight: 7 },
  brandTop: { fontSize: 12, fontWeight: '900', color: DARK, lineHeight: 14 }, brandBottom: { fontSize: 15, fontWeight: '900', color: RED, lineHeight: 17 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 3 }, headerButton: { width: 39, height: 40, justifyContent: 'center', alignItems: 'center' },
  adminShortcut: { marginRight: 2 },
  badge: { position: 'absolute', right: 1, top: 0, backgroundColor: RED, minWidth: 17, height: 17, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }, badgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  hero: { height: 310, backgroundColor: '#241C1B', overflow: 'hidden', position: 'relative' },
  heroPhoto: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '66%', height: '100%' },
  heroTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,12,12,0.40)' },
  heroTextArea: { flex: 1, paddingHorizontal: 20, paddingTop: 34, paddingBottom: 22, justifyContent: 'center', width: '76%' },
  heroEyebrow: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  heroTitle: { color: '#FFF', fontSize: 38, lineHeight: 42, fontWeight: '900', marginTop: 5 }, heroHeart: { color: '#E32B34' },
  heroDescription: { color: '#FFF', fontSize: 12, lineHeight: 18, marginTop: 10, maxWidth: 240 },
  heroCTA: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#B91C2B', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginTop: 15 },
  heroCTAText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  statsPanel: { backgroundColor: '#FFF', flexDirection: 'row', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -18, paddingTop: 18, paddingBottom: 16, paddingHorizontal: 7 },
  statItem: { flex: 1, alignItems: 'center', paddingHorizontal: 2 }, statIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  statValue: { color: DARK, fontSize: 17, fontWeight: '900', textAlign: 'center' }, statCaption: { color: '#4D5560', fontSize: 9, lineHeight: 12, textAlign: 'center', marginTop: 2 },
  sectionHeader: { marginTop: 34, marginBottom: 14, marginHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  sectionTitle: { color: DARK, fontSize: 19, fontWeight: '900', flexShrink: 1, flex: 1 }, seeAll: { flexDirection: 'row', alignItems: 'center', gap: 1 }, seeAllText: { color: RED, fontSize: 12, fontWeight: '700' },
  horizontal: { paddingHorizontal: 15, paddingBottom: 10, gap: 16 },
  helpCTA: { backgroundColor: RED, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignSelf: 'center', marginHorizontal: 16, marginTop: 28, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  helpCTAText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  allCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0E4EA', padding: 18, minHeight: 285, justifyContent: 'center', alignItems: 'center', gap: 14 },
  allCardTitle: { color: DARK, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  caseCard: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderColor: '#E0E4EA', borderWidth: 1, elevation: 2 },
  caseImageBox: { height: 115, backgroundColor: '#FFF1F2', justifyContent: 'center', alignItems: 'center' }, cover: { width: '100%', height: '100%' },
  caseBody: { padding: 11 }, caseTitle: { fontSize: 14, lineHeight: 18, color: DARK, fontWeight: '800' },
  location: { fontSize: 11, color: '#444', marginTop: 6 }, caseButton: { marginTop: 10, backgroundColor: '#B91C2B', borderRadius: 9, paddingVertical: 9, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 }, caseButtonText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  projectCard: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E4EA', elevation: 2 }, projectImageBox: { height: 115, backgroundColor: '#FFF1F2', alignItems: 'center', justifyContent: 'center' },
  projectBody: { paddingHorizontal: 11, paddingVertical: 10 }, projectTitle: { color: DARK, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  status: { alignSelf: 'flex-start', backgroundColor: '#D4F0E1', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4, marginTop: 7 }, statusBlue: { backgroundColor: '#DDEAFD' }, statusAmber: { backgroundColor: '#FFE7B6' }, statusPlanned: { backgroundColor: '#EAECEF' }, statusText: { color: '#166534', fontSize: 10, fontWeight: '800' }, statusBlueText: { color: '#1D4ED8' }, statusAmberText: { color: '#92400E' }, statusPlannedText: { color: '#475569' },
  empty: { width: 250, minHeight: 100, backgroundColor: '#FFF6F6', borderRadius: 16, justifyContent: 'center', padding: 18 }, emptyText: { color: '#666', fontSize: 13 },
  involve: { marginHorizontal: 15, marginTop: 32, padding: 13, borderRadius: 16, backgroundColor: '#FFF1F2', flexDirection: 'row', alignItems: 'center', gap: 11 },
  involveIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' }, involveCopy: { flex: 1 }, involveTitle: { color: RED, fontSize: 18, fontWeight: '900' }, involveDescription: { fontSize: 11, color: DARK, lineHeight: 16, marginTop: 3 }, involveArrow: { backgroundColor: '#CF2027', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  footer: { paddingTop: 23, paddingHorizontal: 18, alignItems: 'center' }, footerText: { color: '#777', fontSize: 11, textAlign: 'center' },
});
