import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminSectionHeader from '../../../components/AdminSectionHeader';
import { supabase } from '../../../lib/supabase';
import { getHelpRequestPermissions } from '../../../lib/help-request-permissions';

type Request = { id: string; name: string; locality: string; county: string | null; category: string; status: string; created_at: string; phone: string };
const RED = '#A61E22';
const PAGE_SIZE = 50;
const FILTERS = [{key:'all',label:'Toate'},{key:'new',label:'Noi'},{key:'reviewing',label:'În analiză'},{key:'approved',label:'Aprobate'},{key:'rejected',label:'Respinse'}];
const LABELS: Record<string,string> = {new:'Nouă',reviewing:'În analiză',approved:'Aprobată',rejected:'Respinsă'};
const STATUS_COLORS: Record<string,string> = {new:'#A61E22',reviewing:'#9B6A1A',approved:'#26764B',rejected:'#777777'};

export default function HelpRequestsList() {
  const {width} = useWindowDimensions();
  const wide = width >= 760;
  const [items,setItems] = useState<Request[]>([]);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState('');
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState('all');
  const [page,setPage] = useState(0);
  const [total,setTotal] = useState(0);

  const load = useCallback(async () => {
    setError('');
    let allowed = false;
    try { allowed = (await getHelpRequestPermissions()).view; } catch { /* deny access on failure */ }
    if (!allowed) {setError('Nu ai acces la departamentul Solicitări de ajutor.');setItems([]);setTotal(0);setLoading(false);setRefreshing(false);return;}
    let query = supabase.from('help_requests').select('id,name,locality,county,category,status,created_at,phone',{count:'exact'});
    if(filter!=='all') query=query.eq('status',filter);
    const term=search.trim().replace(/[%*,()]/g,' ');
    if(term) query=query.or(`name.ilike.%${term}%,locality.ilike.%${term}%,county.ilike.%${term}%,category.ilike.%${term}%`);
    const {data,error:queryError,count}=await query.order('created_at',{ascending:false}).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
    if(queryError){setError('Nu am putut încărca solicitările: '+queryError.message);setItems([]);setTotal(0);}
    else{setItems((data||[]) as Request[]);setTotal(count??0);}
    setLoading(false);setRefreshing(false);
  },[filter,search,page]);
  useFocusEffect(useCallback(()=>{setLoading(true);void load();},[load]));
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  return (
    <SafeAreaView style={{flex:1,backgroundColor:'#F6F6F6'}} edges={['top']}>
      <AdminSectionHeader title="Solicitări de ajutor" backTo="/admin" />
      <ScrollView style={{flex:1}} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator contentContainerStyle={{paddingHorizontal:wide?28:16,paddingTop:12,paddingBottom:110,width:'100%',maxWidth:1100,alignSelf:'center',flexGrow:1}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <View><Text style={{fontSize:12,color:RED,fontWeight:'800',letterSpacing:1.4}}>ADMINISTRARE</Text><Text style={{fontSize:23,fontWeight:'900',color:'#191919',marginTop:3}}>Solicitări primite</Text></View>
          <View style={{backgroundColor:'#FBEDED',borderRadius:20,minWidth:42,paddingHorizontal:12,paddingVertical:8,alignItems:'center'}}><Text style={{fontWeight:'900',color:RED}}>{total}</Text></View>
        </View>
        <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:16,borderWidth:1,borderColor:'#EAE5E5',paddingHorizontal:14,minHeight:54,marginBottom:16}}>
          <Ionicons name="search-outline" size={21} color="#999"/>
          <TextInput placeholder="Caută nume, localitate sau tip de ajutor" placeholderTextColor="#999" value={search} onChangeText={v=>{setPage(0);setSearch(v);}} style={{flex:1,paddingHorizontal:12,paddingVertical:12,color:'#191919',fontSize:15}} />
          {search.length>0?<TouchableOpacity accessibilityLabel="Șterge căutarea" onPress={()=>{setSearch('');setPage(0);}}><Ionicons name="close-circle" size={20} color="#999"/></TouchableOpacity>:null}
        </View>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{flexGrow:0,marginBottom:20}} contentContainerStyle={{alignItems:'center',paddingRight:18,gap:8}}>
          {FILTERS.map(f=><TouchableOpacity key={f.key} onPress={()=>{setFilter(f.key);setPage(0);}} style={{backgroundColor:filter===f.key?RED:'#FFF',borderColor:filter===f.key?RED:'#E9E5E5',borderWidth:1,borderRadius:24,paddingVertical:11,paddingHorizontal:17,minHeight:44,justifyContent:'center'}}><Text style={{color:filter===f.key?'#FFF':'#292929',fontWeight:'800',fontSize:14}}>{f.label}</Text></TouchableOpacity>)}
        </ScrollView>
        {loading?<View style={{paddingVertical:70}}><ActivityIndicator color={RED} size="large"/></View>:error?<View style={{padding:22,backgroundColor:'#FFF',borderRadius:18}}><Text style={{color:RED}}>{error}</Text></View>:items.length===0?<View style={{backgroundColor:'#FFF',borderRadius:22,borderWidth:1,borderColor:'#EEE',paddingHorizontal:22,paddingVertical:48,alignItems:'center'}}><View style={{backgroundColor:'#F9EEEE',padding:18,borderRadius:20}}><Ionicons name="file-tray-outline" size={34} color={RED}/></View><Text style={{fontSize:19,fontWeight:'900',color:'#202020',marginTop:18}}>Nicio solicitare găsită</Text><Text style={{fontSize:14,color:'#777',textAlign:'center',marginTop:7,lineHeight:21}}>{filter==='all'&&!search?'Solicitările noi vor apărea aici.':'Încearcă alt filtru sau o altă căutare.'}</Text></View>:
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>{items.map(item=>{
            const color=STATUS_COLORS[item.status]||RED;
            return <TouchableOpacity key={item.id} activeOpacity={0.78} onPress={()=>router.push({pathname:'/admin/help-requests/[id]' as any,params:{id:item.id}})} style={{width:wide?'48.9%':'100%',backgroundColor:'#FFF',borderWidth:1,borderColor:'#ECE8E8',borderRadius:19,padding:18,minHeight:155}}>
              <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:8}}><Text numberOfLines={2} style={{fontSize:17,fontWeight:'900',color:'#1B1B1B',flex:1}}>{item.name}</Text><View style={{borderRadius:14,paddingHorizontal:9,paddingVertical:5,backgroundColor:color+'15'}}><Text style={{fontSize:11,fontWeight:'800',color}}>{LABELS[item.status]||item.status}</Text></View></View>
              <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:12}}><Ionicons name="location-outline" size={16} color="#888"/><Text numberOfLines={1} style={{color:'#666',flex:1,fontSize:13}}>{[item.locality,item.county].filter(Boolean).join(', ')||'Fără localitate'}</Text></View>
              <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:7}}><Ionicons name="heart-outline" size={16} color="#888"/><Text numberOfLines={1} style={{color:'#666',flex:1,fontSize:13}}>{item.category||'Ajutor'}</Text></View>
              <View style={{height:1,backgroundColor:'#F0EEEE',marginVertical:13}}/>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:'#999',fontSize:12}}>{new Date(item.created_at).toLocaleDateString('ro-RO')}</Text><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Text style={{color:RED,fontWeight:'800',fontSize:12}}>Detalii</Text><Ionicons name="chevron-forward" size={15} color={RED}/></View></View>
            </TouchableOpacity>;
          })}</View>}
        {!loading&&!error&&total>PAGE_SIZE?<View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:22,backgroundColor:'#FFF',padding:10,borderRadius:16}}><TouchableOpacity disabled={page===0} onPress={()=>setPage(v=>Math.max(0,v-1))} style={{padding:10,opacity:page===0?.35:1}}><Text style={{color:RED,fontWeight:'800'}}>‹ Înapoi</Text></TouchableOpacity><Text style={{fontWeight:'700',color:'#666'}}>{page+1} / {pages}</Text><TouchableOpacity disabled={page+1>=pages} onPress={()=>setPage(v=>v+1)} style={{padding:10,opacity:page+1>=pages?.35:1}}><Text style={{color:RED,fontWeight:'800'}}>Înainte ›</Text></TouchableOpacity></View>:null}
      </ScrollView>
    </SafeAreaView>
  );
}
