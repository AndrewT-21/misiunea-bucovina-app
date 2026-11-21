import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function DeactivateAccountButton() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  async function execute() {
    if (busy) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sesiunea a expirat.');
      const { data, error } = await supabase.functions.invoke('deactivate-my-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { confirm: 'DEACTIVATE_MY_ACCOUNT' },
      });
      if (error || data?.error || data?.success !== true) throw new Error(data?.error || error?.message || 'Dezactivarea nu a fost confirmată de server.');
      setVisible(false);
      await supabase.auth.signOut();
      router.replace('/alege-cont');
    } catch (e: any) {
      const message = e?.message || 'Încearcă din nou.';
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Contul nu a fost dezactivat', message);
    } finally { setBusy(false); }
  }
  return <>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => setVisible(true)} style={s.button}>
      <Ionicons name="pause-circle-outline" size={18} color="#A61E22"/><Text style={s.buttonText}>Dezactivează</Text>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && setVisible(false)}>
      <View style={s.backdrop}><View style={s.dialog}>
        <Text style={s.title}>Dezactivează contul?</Text>
        <Text style={s.description}>Toate datele, nickname-ul și istoricul activităților vor fi păstrate. Accesul va fi blocat până când îți reactivezi contul prin verificarea identității.</Text>
        <View style={s.actions}>
          <Pressable disabled={busy} onPress={() => setVisible(false)} style={[s.action,s.cancel]}><Text style={s.cancelText}>Anulează</Text></Pressable>
          <Pressable disabled={busy} onPress={() => void execute()} style={[s.action,s.confirm]}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={s.confirmText}>Dezactivează</Text>}</Pressable>
        </View>
      </View></View>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  button:{flex:1,minHeight:54,borderWidth:1.5,borderColor:'#E7B8B8',backgroundColor:'#FFF1F1',borderRadius:12,paddingHorizontal:8,paddingVertical:10,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7},
  buttonText:{color:'#A61E22',fontWeight:'800',fontSize:12,textAlign:'center'},
  backdrop:{flex:1,backgroundColor:'rgba(10,18,30,0.62)',justifyContent:'center',alignItems:'center',padding:20},
  dialog:{width:'100%',maxWidth:430,borderRadius:20,padding:24,backgroundColor:'#fff'},
  title:{fontSize:19,fontWeight:'800',color:'#202936',textAlign:'center',marginBottom:12},
  description:{fontSize:14,lineHeight:21,color:'#566171',textAlign:'center',marginBottom:24},
  actions:{flexDirection:'row',gap:10},action:{flex:1,paddingVertical:13,borderRadius:11,alignItems:'center'},
  cancel:{backgroundColor:'#F1F3F6'},confirm:{backgroundColor:'#A61E22'},
  cancelText:{color:'#273142',fontWeight:'700'},confirmText:{color:'#fff',fontWeight:'800'}
});
