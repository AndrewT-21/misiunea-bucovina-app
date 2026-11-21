import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RED = '#A61E22';
export default function CalendarProposals() {
  return <SafeAreaView style={s.screen} edges={['top']}>
    <View style={s.header}>
      <TouchableOpacity style={s.back} onPress={() => router.back()} accessibilityLabel="Înapoi"><Ionicons name="chevron-back" size={24} color="#171717" /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={s.eyebrow}>ADMINISTRARE</Text><Text style={s.title}>Calendar și propuneri</Text></View>
    </View>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.intro}>Gestionează evenimentele și propunerile primite de la voluntari.</Text>
      <TouchableOpacity style={s.card} onPress={() => router.push('/admin/activities' as any)}>
        <View style={s.icon}><Ionicons name="calendar-outline" size={25} color={RED}/></View>
        <View style={{ flex: 1 }}><Text style={s.name}>Activități propuse</Text><Text style={s.description}>Verifică propunerile, aprobă sau respinge și gestionează activitățile publicate.</Text></View>
        <Ionicons name="chevron-forward" size={21} color={RED}/>
      </TouchableOpacity>
      <TouchableOpacity style={s.card} onPress={() => router.push('/admin/prayer' as any)}>
        <View style={s.icon}><Ionicons name="heart-outline" size={25} color={RED}/></View>
        <View style={{ flex: 1 }}><Text style={s.name}>Post și rugăciune</Text><Text style={s.description}>Aprobă propunerile și administrează zilele de post și rugăciune.</Text></View>
        <Ionicons name="chevron-forward" size={21} color={RED}/>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#F6F6F6'},header:{flexDirection:'row',alignItems:'center',gap:12,padding:16,maxWidth:1040,width:'100%',alignSelf:'center'},back:{width:44,height:44,borderRadius:12,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:10,fontWeight:'900',color:RED,letterSpacing:1},title:{fontSize:25,fontWeight:'900',color:'#171717'},content:{padding:16,paddingBottom:40,maxWidth:1040,width:'100%',alignSelf:'center'},intro:{fontSize:14,color:'#666',lineHeight:21,marginBottom:20},card:{flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'#fff',borderRadius:16,padding:17,marginBottom:13,borderWidth:1,borderColor:'#EEEEEE'},icon:{width:49,height:49,borderRadius:13,backgroundColor:'#FFF1F1',alignItems:'center',justifyContent:'center'},name:{fontSize:17,fontWeight:'800',color:'#171717'},description:{fontSize:13,color:'#777',lineHeight:19,marginTop:5}});
