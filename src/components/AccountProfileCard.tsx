import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const RED = '#A61E22';
type Props = { name: string; nickname?: string | null; role: string; email: string; phone?: string | null; avatar?: string | null; onEdit: () => void; stats?: { label: string; value: number }[] };
export default function AccountProfileCard({ name, nickname, role, email, phone, avatar, onEdit, stats }: Props) {
  return <View style={s.card}>
    <View style={s.topLine}><View style={s.topLineDot}/><Text style={s.topLineText}>PROFIL PERSONAL</Text><View style={{flex:1}}/><Ionicons name="shield-checkmark-outline" size={18} color={RED}/></View>
    <View style={s.identity}>
      <View style={s.avatarWrap}>{avatar ? <Image source={{uri:avatar}} style={s.avatar}/> : <Ionicons name="person-outline" size={38} color={RED}/>}</View>
      <View style={{flex:1,minWidth:0}}><Text style={s.name} numberOfLines={2}>{name}</Text><Text style={s.nickname}>{nickname ? `@${nickname}` : 'Adaugă un nickname'}</Text><View style={s.roleBadge}><Ionicons name="checkmark-circle" size={13} color={RED}/><Text style={s.roleText}>{role}</Text></View></View>
    </View>
    <TouchableOpacity accessibilityRole="button" onPress={onEdit} style={s.edit}><Ionicons name="create-outline" size={19} color="#FFF"/><Text style={s.editText}>Editează profilul</Text><Ionicons name="arrow-forward" size={18} color="#FFF"/></TouchableOpacity>
    <View style={s.divider}/>
    <View style={s.info}><View style={s.infoIcon}><Ionicons name="mail-outline" size={18} color={RED}/></View><View style={{flex:1}}><Text style={s.infoLabel}>ADRESĂ DE E-MAIL</Text><Text style={s.infoValue} selectable>{email || 'Nespecificată'}</Text></View></View>
    <View style={[s.info,{marginTop:15}]}><View style={s.infoIcon}><Ionicons name="call-outline" size={18} color={RED}/></View><View style={{flex:1}}><Text style={s.infoLabel}>TELEFON</Text><Text style={s.infoValue}>{phone || 'Nu a fost adăugat'}</Text></View></View>
    {!!stats?.length && <View style={s.stats}>{stats.map(item=><View key={item.label} style={s.stat}><Text style={s.statNumber}>{item.value}</Text><Text style={s.statLabel}>{item.label}</Text></View>)}</View>}
  </View>;
}
export function AccountShortcuts() { const {router} = require('expo-router'); return <View style={s.shortcuts}>
  <TouchableOpacity style={s.shortcut} onPress={()=>router.push('/favorite')}><View style={s.shortcutIcon}><Ionicons name="heart-outline" size={23} color={RED}/></View><Text style={s.shortcutText}>Favoritele mele</Text><Ionicons name="chevron-forward" size={16} color="#A4A4A4"/></TouchableOpacity>
  <TouchableOpacity style={s.shortcut} onPress={()=>router.push('/notificari')}><View style={s.shortcutIcon}><Ionicons name="notifications-outline" size={23} color={RED}/></View><Text style={s.shortcutText}>Notificări</Text><Ionicons name="chevron-forward" size={16} color="#A4A4A4"/></TouchableOpacity>
</View>; }
const s=StyleSheet.create({
 card:{backgroundColor:'#FFF',borderRadius:23,borderWidth:1,borderColor:'#EEE4E1',padding:19,marginBottom:14},
 topLine:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:20},topLineDot:{height:7,width:7,borderRadius:4,backgroundColor:RED},topLineText:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:'#8B6765'},
 identity:{flexDirection:'row',alignItems:'center',gap:15},avatarWrap:{height:86,width:86,borderRadius:43,backgroundColor:'#FCEFEF',justifyContent:'center',alignItems:'center',overflow:'hidden',borderWidth:3,borderColor:'#FFF',elevation:2},avatar:{width:'100%',height:'100%'},name:{fontSize:23,fontWeight:'900',color:'#1B1B1B'},nickname:{fontSize:13,color:RED,fontWeight:'700',marginTop:3},roleBadge:{alignSelf:'flex-start',marginTop:9,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'#FFF0F0',paddingHorizontal:10,paddingVertical:6,borderRadius:30},roleText:{color:RED,fontSize:11,fontWeight:'800'},
 edit:{backgroundColor:RED,borderRadius:14,minHeight:49,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,marginTop:23,paddingHorizontal:16},editText:{color:'#FFF',fontWeight:'800',fontSize:14,flex:1,textAlign:'center'},divider:{height:1,backgroundColor:'#F0E9E7',marginVertical:20},
 info:{flexDirection:'row',alignItems:'center',gap:12},infoIcon:{height:39,width:39,borderRadius:12,backgroundColor:'#FFF3F2',alignItems:'center',justifyContent:'center'},infoLabel:{fontSize:9,fontWeight:'900',color:'#999',letterSpacing:1},infoValue:{fontSize:13,fontWeight:'600',color:'#343434',marginTop:4},
 stats:{flexDirection:'row',gap:10,marginTop:20},stat:{flex:1,backgroundColor:'#FAF4F2',borderRadius:13,padding:13,alignItems:'center'},statNumber:{fontSize:21,fontWeight:'900',color:RED},statLabel:{fontSize:11,color:'#7E7775',marginTop:3},
 shortcuts:{flexDirection:'row',gap:11,marginBottom:14},shortcut:{flex:1,backgroundColor:'#FFF',borderWidth:1,borderColor:'#EEE4E1',borderRadius:17,padding:13,gap:9,minHeight:110},shortcutIcon:{height:36,width:36,backgroundColor:'#FFF2F1',borderRadius:11,alignItems:'center',justifyContent:'center'},shortcutText:{fontSize:12,fontWeight:'800',color:'#282828',flex:1}
});
