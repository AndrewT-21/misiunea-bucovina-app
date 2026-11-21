import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const RED = '#A61E22';
const BG = '#F6F6F6';
type Message = { id: string; name: string; email: string; phone: string | null; subject: string; message: string; status: 'new' | 'read' | 'replied' | 'closed'; created_at: string };
type Filter = 'all' | 'new' | 'read';
const dateLabel = (value: string) => { try { return new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); } catch { return ''; } };
export default function AdminMessagesScreen() {
  const { width } = useWindowDimensions();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setErrorText('');
    const { data, error } = await supabase.from('messages').select('id,name,email,phone,subject,message,status,created_at').order('created_at', { ascending: false });
    if (error) setErrorText('Nu am putut încărca mesajele. Verifică conexiunea și încearcă din nou.');
    else setMessages((data ?? []) as Message[]);
    setLoading(false); setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { void load(true); }, [load]));
  const unread = messages.filter(m => m.status === 'new').length;
  const read = messages.length - unread;
  const filtered = useMemo(() => messages.filter(m => {
    if (filter === 'new' && m.status !== 'new') return false;
    if (filter === 'read' && m.status === 'new') return false;
    const q = search.trim().toLocaleLowerCase();
    return !q || [m.name, m.email, m.phone ?? '', m.subject, m.message].some(v => v.toLocaleLowerCase().includes(q));
  }), [messages, filter, search]);
  const wide = width >= 850;
  const Stat = ({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) => (
    <View style={styles.stat}><Ionicons name={icon} size={22} color={RED}/><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>
  );
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.top}><View style={[styles.maxWidth, styles.topInner]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityLabel="Înapoi"><Ionicons name="chevron-back" size={25} color="#191919"/></TouchableOpacity>
      <View style={{flex:1}}><Text style={styles.eyebrow}>ADMINISTRARE</Text><Text style={styles.title}>Mesaje</Text><Text style={styles.subtitle}>Mesajele primite prin formularul de contact</Text></View>
    </View></View>
    <View style={[styles.maxWidth, styles.fixed]}>
      <View style={styles.stats}><Stat label="Total" value={messages.length} icon="mail-outline"/><Stat label="Necitite" value={unread} icon="mail-unread-outline"/><Stat label="Citite" value={read} icon="mail-open-outline"/></View>
      <View style={styles.search}><Ionicons name="search-outline" size={21} color="#999"/><TextInput value={search} onChangeText={setSearch} placeholder="Caută după nume, e-mail sau mesaj..." placeholderTextColor="#999" style={styles.input} returnKeyType="search"/>{search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={20} color="#999"/></TouchableOpacity>}</View>
      <View style={styles.filters}>{([{key:'all',label:'Toate'},{key:'new',label:'Necitite'},{key:'read',label:'Citite'}] as const).map(f => <TouchableOpacity key={f.key} style={[styles.filter, filter === f.key && styles.filterActive]} onPress={() => { Keyboard.dismiss(); setFilter(f.key); }}><Text style={[styles.filterText,filter === f.key && styles.filterTextActive]}>{f.label}</Text></TouchableOpacity>)}</View>
    </View>
    {loading ? <View style={styles.center}><ActivityIndicator color={RED}/><Text style={styles.muted}>Se încarcă mesajele...</Text></View> :
    <FlatList style={[styles.maxWidth, styles.list]} data={filtered} keyExtractor={m => m.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.listContent, filtered.length === 0 && {flexGrow:1}]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); void load();}} tintColor={RED}/>}
      ListHeaderComponent={errorText ? <Text style={styles.error}>{errorText}</Text> : null}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name={errorText ? 'alert-circle-outline' : 'mail-open-outline'} size={38} color={RED}/><Text style={styles.emptyTitle}>{errorText ? 'Eroare la încărcare' : messages.length === 0 ? 'Niciun mesaj primit' : 'Niciun rezultat'}</Text><Text style={styles.muted}>{messages.length === 0 ? 'Mesajele trimise din formularul de contact vor apărea aici.' : 'Schimbă filtrul sau termenul de căutare.'}</Text>{(filter !== 'all' || search) && <TouchableOpacity onPress={() => {setFilter('all');setSearch('');}}><Text style={styles.reset}>Resetează filtrele</Text></TouchableOpacity>}{errorText ? <TouchableOpacity onPress={() => void load(true)}><Text style={styles.reset}>Reîncearcă</Text></TouchableOpacity> : null}</View>}
      renderItem={({item}) => <TouchableOpacity activeOpacity={0.8} style={[styles.card, item.status === 'new' && styles.newCard]} onPress={() => router.push({pathname:'/admin/messages/[id]',params:{id:item.id}})}><View style={styles.cardTop}><View style={styles.avatar}><Ionicons name="person-outline" size={21} color={RED}/></View><View style={{flex:1,minWidth:0}}><Text style={styles.name} numberOfLines={1}>{item.name}</Text><Text style={styles.meta}>{dateLabel(item.created_at)}</Text></View><View style={[styles.pill,item.status === 'new' && styles.pillNew]}><Text style={[styles.pillText,item.status === 'new' && styles.pillTextNew]}>{item.status === 'new' ? 'NOU' : item.status === 'read' ? 'CITIT' : item.status === 'replied' ? 'RĂSPUNS' : 'ÎNCHIS'}</Text></View></View><Text style={styles.subject} numberOfLines={1}>{item.subject}</Text><Text style={styles.preview} numberOfLines={2}>{item.message}</Text><View style={styles.footer}><Text style={styles.meta} numberOfLines={1}>{item.email}</Text><Ionicons name="chevron-forward" size={18} color="#aaa"/></View></TouchableOpacity>}
      numColumns={1}/>} 
  </SafeAreaView>;
}
const styles = StyleSheet.create({
 screen:{flex:1,backgroundColor:BG},maxWidth:{width:'100%',maxWidth:1100,alignSelf:'center'},top:{backgroundColor:BG},topInner:{paddingHorizontal:Platform.OS==='web'?28:16,paddingTop:18,paddingBottom:12,flexDirection:'row',alignItems:'center',gap:13},back:{width:46,height:46,borderRadius:15,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.4,color:RED},title:{fontSize:29,fontWeight:'900',color:'#171717'},subtitle:{fontSize:12,color:'#777',marginTop:3},fixed:{paddingHorizontal:Platform.OS==='web'?28:16,paddingBottom:10},stats:{flexDirection:'row',gap:10,marginTop:12},stat:{flex:1,backgroundColor:'#fff',borderRadius:18,padding:14,minWidth:0,borderWidth:1,borderColor:'#eee'},statValue:{fontSize:26,fontWeight:'900',color:'#171717',marginTop:8},statLabel:{fontSize:11,color:'#777',marginTop:2},search:{height:49,marginTop:16,backgroundColor:'#fff',borderRadius:15,flexDirection:'row',alignItems:'center',paddingHorizontal:13,gap:9},input:{flex:1,minWidth:0,fontSize:13,color:'#171717'},filters:{flexDirection:'row',gap:9,marginTop:12},filter:{flex:1,alignItems:'center',paddingVertical:11,borderRadius:13,backgroundColor:'#fff',borderWidth:1,borderColor:'#eaeaea'},filterActive:{backgroundColor:RED,borderColor:RED},filterText:{fontWeight:'800',fontSize:12,color:'#666'},filterTextActive:{color:'#fff'},list:{flex:1},listContent:{paddingHorizontal:Platform.OS==='web'?28:16,paddingTop:12,paddingBottom:40,gap:10},card:{backgroundColor:'#fff',borderRadius:18,padding:16,borderWidth:1,borderColor:'#eee'},newCard:{borderColor:'#e7b7b9',borderLeftWidth:4,borderLeftColor:RED},cardTop:{flexDirection:'row',alignItems:'center',gap:11},avatar:{width:43,height:43,borderRadius:14,backgroundColor:'#fff0f0',alignItems:'center',justifyContent:'center'},name:{fontWeight:'900',fontSize:15,color:'#171717'},meta:{fontSize:11,color:'#888',marginTop:3,flexShrink:1},pill:{borderRadius:30,paddingVertical:6,paddingHorizontal:9,backgroundColor:'#f3f3f3'},pillNew:{backgroundColor:'#fff0f0'},pillText:{fontSize:9,fontWeight:'900',color:'#777'},pillTextNew:{color:RED},subject:{fontWeight:'900',fontSize:15,color:'#171717',marginTop:13},preview:{fontSize:12,lineHeight:18,color:'#777',marginTop:6},footer:{borderTopWidth:1,borderTopColor:'#f1f1f1',marginTop:13,paddingTop:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},empty:{flex:1,backgroundColor:'#fff',borderRadius:20,alignItems:'center',justifyContent:'center',padding:30,minHeight:230},emptyTitle:{fontSize:18,fontWeight:'900',color:'#171717',marginTop:13,marginBottom:7},muted:{fontSize:12,color:'#888',textAlign:'center'},reset:{color:RED,fontWeight:'800',marginTop:14},error:{color:RED,fontSize:12,marginBottom:10},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12}
});
