import { Platform } from 'react-native';
import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator,  ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const INK = '#171717';
const MUTED = '#777777';

type Entry = 'admin' | 'voluntar';
export default function AlegeContScreen() {
  const [loading, setLoading] = useState<Entry | null>(null);
  async function navigateAs(role: Entry) {
    if (loading) return;
    setLoading(role);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) {
        router.push(role === 'admin' ? '/admin-login' : '/voluntar/login');
        return;
      }
      const { getAccountKind } = await import('../lib/accountAccess');
      const kind = await getAccountKind(session.user.id);
      if (role === 'admin') {
        if (kind !== 'super_admin') {
          Alert.alert('Acces restricționat', 'Doar Super Admin se conectează prin Administrator. Folosește opțiunea Voluntar.');
          return;
        }
        router.push('/admin');
      } else {
        if (kind === 'super_admin') {
          Alert.alert('Acces restricționat', 'Super Admin se conectează doar prin Administrator.');
          return;
        }
        router.push('/voluntar/contul-meu');
      }
    } catch (err: any) {
      Alert.alert('Eroare', err?.message ?? 'Nu am putut verifica rolul contului.');
    } finally {
      setLoading(null);
    }
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View pointerEvents="none" style={styles.decorLayer}>
        <View style={styles.circleTopRight} />
        <View style={styles.circleTopRightSoft} />
        <View style={styles.circleLeft} />
        <View style={styles.circleBottomRight} />
      </View>
      <TouchableOpacity style={styles.back} onPress={() => router.dismissTo('/(tabs)')} accessibilityLabel="Înapoi">
        <Ionicons name="chevron-back" size={24} color={INK}/><Text style={styles.backText}>Înapoi</Text>
      </TouchableOpacity>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.brandMark}><Ionicons name="heart-outline" size={36} color={RED}/></View>
          <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
          <Text style={styles.title}>Bine ai venit!</Text>
          <Text style={styles.subtitle}>Alege accesul potrivit contului tău. Super Admin folosește Administrator; celelalte conturi folosesc Voluntar.</Text>
        </View>
        <View style={styles.optionsCard}>
          <TouchableOpacity style={styles.option} onPress={() => void navigateAs('admin')} disabled={loading !== null} accessibilityRole="button" accessibilityLabel="Panou administrator">
            <View style={styles.optionIcon}><Ionicons name="shield-checkmark-outline" size={28} color={RED}/></View>
            <View style={styles.optionText}><Text style={styles.optionTitle}>Administrator</Text><Text style={styles.optionSubtitle}>Acces exclusiv pentru Super Admin.</Text></View>
            {loading === 'admin' ? <ActivityIndicator color={RED}/> : <Ionicons name="arrow-forward" size={23} color={RED}/>}
          </TouchableOpacity>
          <View style={styles.divider}/>
          <TouchableOpacity style={styles.option} onPress={() => void navigateAs('voluntar')} disabled={loading !== null} accessibilityRole="button" accessibilityLabel="Panou voluntar">
            <View style={styles.optionIcon}><Ionicons name="hand-left-outline" size={28} color={RED}/></View>
            <View style={styles.optionText}><Text style={styles.optionTitle}>Voluntar</Text><Text style={styles.optionSubtitle}>Profilul, localitățile și activitățile tale.</Text></View>
            {loading === 'voluntar' ? <ActivityIndicator color={RED}/> : <Ionicons name="arrow-forward" size={23} color={RED}/>}
          </TouchableOpacity>
        </View>
        <View style={styles.footerCard}><Ionicons name="heart-outline" size={22} color={RED}/><Text style={styles.footerText}>Împreună pentru oameni</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#FAF6F2', ...(Platform.OS === "web" ? { backgroundColor: "#F8F6F5" } : {})},decorLayer:{...StyleSheet.absoluteFill,overflow:'hidden'},
  circleTopRight:{position:'absolute',width:315,height:315,borderRadius:160,backgroundColor:'#F6DFDA',top:-132,right:-135},
  circleTopRightSoft:{position:'absolute',width:310,height:310,borderRadius:160,backgroundColor:'rgba(246,223,218,0.45)',top:-48,right:-215},
  circleLeft:{position:'absolute',width:205,height:265,borderRadius:140,backgroundColor:'#F8E8E3',top:145,left:-165},
  circleBottomRight:{position:'absolute',width:290,height:290,borderRadius:150,backgroundColor:'#F8E8E3',bottom:-192,right:-154},
  back:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:22,paddingTop:14,paddingBottom:10,alignSelf:'flex-start',zIndex:1},
  backText:{fontSize:14,fontWeight:'700',color:INK},scroll:{flex:1,zIndex:1},
  content:{flexGrow:1,justifyContent:'center',paddingHorizontal:22,paddingTop:18,paddingBottom:32, ...(Platform.OS === "web" ? { width: "100%", maxWidth: 650, alignSelf: "center", paddingHorizontal: 32, paddingTop: 45, paddingBottom: 65 } : {})},
  hero:{alignItems:'center',marginBottom:28, ...(Platform.OS === "web" ? { marginBottom: 30 } : {})},brandMark:{width:76,height:76,borderRadius:25,backgroundColor:'#FBE8E5',borderWidth:1,borderColor:'#F3D3CD',justifyContent:'center',alignItems:'center',marginBottom:19},
  eyebrow:{color:RED,fontSize:11,fontWeight:'900',letterSpacing:2,textAlign:'center'},title:{fontSize:32,fontWeight:'900',color:INK,textAlign:'center',marginTop:10},
  subtitle:{fontSize:14,color:MUTED,lineHeight:22,textAlign:'center',marginTop:9,maxWidth:310},
  optionsCard:{backgroundColor:'#FFF',borderRadius:24,borderWidth:1,borderColor:'#EDE4DF',paddingHorizontal:17,paddingVertical:12,shadowColor:'#654B42',shadowOpacity:0.055,shadowRadius:16,shadowOffset:{width:0,height:7},elevation:2, ...(Platform.OS === "web" ? { borderRadius: 24, padding: 26 } : {})},
  option:{minHeight:104,flexDirection:'row',alignItems:'center',paddingVertical:12, ...(Platform.OS === "web" ? { paddingVertical: 22 } : {})},optionIcon:{width:58,height:58,borderRadius:19,backgroundColor:'#FBE9E6',justifyContent:'center',alignItems:'center'},
  optionText:{flex:1,paddingHorizontal:13},optionTitle:{fontSize:17,fontWeight:'900',color:INK},optionSubtitle:{color:MUTED,fontSize:12,lineHeight:18,marginTop:5},
  divider:{height:1,backgroundColor:'#EFE7E3',marginLeft:72},footerCard:{marginTop:20,backgroundColor:'#F7EBE7',borderRadius:19,minHeight:64,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:11,paddingHorizontal:15},footerText:{color:'#766D69',fontSize:15,fontWeight:'700'},
});
