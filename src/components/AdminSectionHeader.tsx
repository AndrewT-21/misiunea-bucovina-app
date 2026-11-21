import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/** Same header geometry and typography as Admin → Program săptămânal. */
export default function AdminSectionHeader({title,backTo='/admin'}:{title:string;backTo?:string}) {
  return <View style={s.outer}><View style={s.headingRow}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Înapoi" style={s.headerBack} onPress={()=>router.canGoBack()?router.back():router.replace(backTo as any)}>
      <Ionicons name="chevron-back" size={26} color="#22252B" />
    </TouchableOpacity>
    <View style={s.headingTitle}><Text style={s.eyebrow}>ADMINISTRARE</Text><Text style={s.title}>{title}</Text></View>
  </View></View>;
}
const s=StyleSheet.create({
  outer:{width:'100%',maxWidth:1040,alignSelf:'center',paddingHorizontal:16,paddingTop:12,paddingBottom:12},
  headingRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:3,marginBottom:2},
  headerBack:{width:44,height:44,borderRadius:14,backgroundColor:'white',alignItems:'center',justifyContent:'center'},
  headingTitle:{flex:1,minWidth:0},
  eyebrow:{fontSize:10,fontWeight:'900',color:'#A61E22',letterSpacing:1.1,marginBottom:5},
  title:{fontSize:27,fontWeight:'900',color:'#22252B',lineHeight:32},
});
