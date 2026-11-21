import DateField, { dateToDisplay, displayToDate } from '../../components/DateField';
import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator,  Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const BG = '#F6F6F6';
const MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
type Activity = { id: string; title: string; description: string | null; location: string | null; starts_at: string; ends_at: string | null; max_volunteers: number | null; is_published: boolean };
type Proposal = { id:string; title:string; description:string; location:string; starts_at:string; status:string; created_at:string };
type Registration = { id: string; activity_id: string; volunteer_id: string; status: string; admin_message: string | null; created_at: string };
const empty = { title: '', description: '', location: '', date: '', start: '', end: '', max: '', published: false };
const show = (title: string, message: string) => Platform.OS === 'web' ? window.alert(`${title}\n${message}`) : Alert.alert(title, message);
function localDate(iso: string) { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function localTime(iso: string) { const d = new Date(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function parseLocal(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y,m,d] = date.split('-').map(Number); const [h,min] = time.split(':').map(Number);
  const value = new Date(y,m-1,d,h,min);
  return value.getFullYear()===y && value.getMonth()===m-1 && value.getDate()===d && value.getHours()===h && value.getMinutes()===min ? value : null;
}
export default function AdminActivities({ createOnly = false }: { createOnly?: boolean }) {
  const { registrationId } = useLocalSearchParams<{ registrationId?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const cardPositions = useRef<Record<string, number>>({});
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [items,setItems] = useState<Activity[]>([]);
  const [listSearch,setListSearch] = useState('');
  const [activityFilter,setActivityFilter] = useState<'published'|'draft'>('published');
  const [searchFocused, setSearchFocused] = useState(false);
  const [proposals,setProposals] = useState<Proposal[]>([]);
  const [reviewing,setReviewing] = useState<string|null>(null);
  const [registrations,setRegistrations] = useState<Registration[]>([]);
  const [editing,setEditing] = useState<string | null>(null);
  const [form,setForm] = useState({...empty});
  const [openForm,setOpenForm] = useState(createOnly);
  const [expanded,setExpanded] = useState<string | null>(null);
  const [picker,setPicker] = useState<'date'|'start'|'end'|null>(null);
  const [pickerMonth,setPickerMonth] = useState(new Date().getMonth());
  const [pickerYear,setPickerYear] = useState(new Date().getFullYear());
  const [messages,setMessages] = useState<Record<string,string>>({});
  const [volunteerNames,setVolunteerNames] = useState<Record<string,string>>({});
  const [registrationBusy,setRegistrationBusy] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) { router.replace('/admin-login'); return; }
      const {data:admin,error:adminError} = await supabase.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
      if (adminError || !admin) { show('Acces interzis','Doar administratorii pot gestiona activități.'); router.replace('/admin'); return; }
      const [a,r] = await Promise.all([
        supabase.from('activities').select('id,title,description,location,starts_at,ends_at,max_volunteers,is_published').order('starts_at',{ascending:true}),
        supabase.from('activity_registrations').select('id,activity_id,volunteer_id,status,admin_message,created_at').order('created_at',{ascending:false}),
      ]);
      if(a.error) throw a.error;
      if(r.error) throw r.error;
      setItems((a.data??[]) as Activity[]);
      const proposalResult=await supabase.rpc('activity_list_proposals');
      if(proposalResult.error) console.log('Propuneri activități:',proposalResult.error.message);
      else setProposals((proposalResult.data??[]) as Proposal[]);
      setRegistrations((r.data??[]) as Registration[]);
      // Profilurile sunt asociate prin user_id, nu prin id-ul înscrierii.
      const volunteerIds = [...new Set((r.data ?? []).map((row: Registration) => row.volunteer_id).filter(Boolean))];
      if (volunteerIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from('volunteer_profiles')
          .select('user_id,full_name')
          .in('user_id', volunteerIds);
        if (profilesError) {
          setVolunteerNames({});
          show('Numele voluntarilor nu pot fi încărcate',
            `${profilesError.message}\nVerifică politica SELECT pentru administrator în volunteer_profiles.`);
        } else {
          const names: Record<string, string> = {};
          for (const profile of profiles ?? []) {
            if (profile.user_id && profile.full_name?.trim()) {
              names[profile.user_id] = profile.full_name.trim();
            }
          }
          setVolunteerNames(names);
        }
      } else {
        setVolunteerNames({});
      }
    } catch(e:any) { show('Eroare',e?.message??'Nu am putut încărca activitățile.'); }
    finally {setLoading(false);}
  },[]);
  useFocusEffect(useCallback(()=>{refresh();},[refresh]));
  useEffect(() => {
    if (loading || !registrationId) return;
    const match = registrations.find(r => r.id === registrationId);
    if (!match) return;
    setExpanded(match.activity_id);
    const y = cardPositions.current[match.activity_id];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  }, [loading, registrationId, registrations]);

  async function reviewProposal(id:string,approve:boolean){
    if(reviewing)return;setReviewing(id);
    try{const {error}=await supabase.rpc('activity_review_proposal',{p_id:id,p_approve:approve});if(error)throw error;await refresh();}
    catch(e:any){show('Eroare',e?.message??'Nu s-a putut procesa propunerea.');}
    finally{setReviewing(null);}
  }
  function edit(a: Activity) {
    setEditing(a.id);
    setForm({title:a.title,description:a.description??'',location:a.location??'',date:localDate(a.starts_at),start:localTime(a.starts_at),end:a.ends_at?localTime(a.ends_at):'',max:a.max_volunteers?.toString()??'',published:a.is_published});
    setOpenForm(true);
    setActivityFilter(a.is_published?'published':'draft');
  }
  function reset() {setEditing(null);setForm({...empty});setOpenForm(false);setPicker(null);}
  function openPicker(which:'date'|'start'|'end') {
    if(which==='date') {
      const d = form.date ? new Date(`${form.date}T12:00:00`) : new Date();
      const valid = !Number.isNaN(d.getTime()) ? d : new Date();
      setPickerMonth(valid.getMonth());setPickerYear(valid.getFullYear());
    }
    setPicker(p=>p===which?null:which);
  }
  function moveMonth(delta:number) {
    const d=new Date(pickerYear,pickerMonth+delta,1);
    setPickerMonth(d.getMonth());setPickerYear(d.getFullYear());
  }
  function chooseDay(day:number) {
    setForm(f=>({...f,date:`${pickerYear}-${String(pickerMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}));
    setPicker(null);
  }
  function chooseTime(which:'start'|'end',hour:number,minute:number) {
    setForm(f=>({...f,[which]:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`}));
    setPicker(null);
  }
  async function save() {
    if(busy)return;
    const start = parseLocal(form.date.trim(),form.start.trim());
    const end = form.end.trim()?parseLocal(form.date.trim(),form.end.trim()):null;
    const max = form.max.trim()?Number(form.max):null;
    if(form.title.trim().length<3 || !form.location.trim() || !start || (form.end.trim()&&!end) || (end&&end<=start) || (max!==null&&(!Number.isInteger(max)||max<=0))) {
      show('Verifică datele','Completează titlul (minim 3 caractere), locația, data și ora de început. Ora finală trebuie să fie mai târziu în aceeași zi, iar numărul de locuri pozitiv.'); return;
    }
    setBusy(true);
    try {
      const {data:{user}}=await supabase.auth.getUser(); if(!user)throw new Error('Sesiunea a expirat.');
      const payload = {title:form.title.trim(),description:form.description.trim()||null,location:form.location.trim(),starts_at:start.toISOString(),ends_at:end?.toISOString()??null,max_volunteers:max,is_published:form.published};
      const result = editing ? await supabase.from('activities').update(payload).eq('id',editing) : await supabase.from('activities').insert({...payload,created_by:user.id});
      if(result.error)throw result.error;
      reset(); if (createOnly) { router.back(); } else { await refresh(); }
    } catch(e:any){show('Eroare la salvare',e?.message??'Încearcă din nou.');} finally {setBusy(false);}
  }
  function remove(a:Activity) {
    const execute=async()=>{setBusy(true);try{const {error}=await supabase.from('activities').delete().eq('id',a.id);if(error)throw error;await refresh();}catch(e:any){show('Eroare',e?.message??'Ștergerea nu a reușit.');}finally{setBusy(false);}};
    Alert.alert('Ștergere activitate',`Ștergi „${a.title}” și toate înscrierile asociate?`,[{text:'Anulează',style:'cancel'},{text:'Șterge',style:'destructive',onPress:()=>{void execute();}}]);
  }
  async function updateRegistration(r:Registration,status: 'confirmed' | 'rejected') {
    if (busy || registrationBusy) return;
    setRegistrationBusy(r.id);
    setBusy(true);
    try {const {error}=await supabase.from('activity_registrations').update({status,admin_message:(messages[r.id]??r.admin_message)?.trim()||null}).eq('id',r.id);if(error)throw error;await refresh();}
    catch(e:any){show('Eroare',e?.message??'Nu am putut actualiza înscrierea.');}finally{setBusy(false);setRegistrationBusy(null);}
  }
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={[styles.header,{paddingHorizontal:20,marginBottom:10,...(Platform.OS==='web'?{width:'100%' as const,maxWidth:1040,alignSelf:'center' as const}:{})}]}>
        <TouchableOpacity onPress={()=>router.back()} style={styles.back} accessibilityLabel="Înapoi"><Ionicons name="chevron-back" size={31} color="#171717"/></TouchableOpacity>
        <View style={{flex:1}}><Text style={styles.eyebrow}>ADMINISTRARE</Text><Text style={styles.title}>{createOnly ? 'Activitate nouă' : 'Activități'}</Text></View>
        
      </View>
    {!createOnly && <View style={{paddingHorizontal:16,marginBottom:12,gap:10,...(Platform.OS === "web" ? {width:"100%" as const,maxWidth:1040,alignSelf:"center" as const,paddingHorizontal:32} : {})}}>
        <TouchableOpacity style={{backgroundColor:RED,borderRadius:14,paddingHorizontal:18,minHeight:46,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9,alignSelf:"flex-start"}} onPress={()=>router.push('/admin/activity-new' as any)} accessibilityLabel="Adaugă activitate"><Ionicons name="add" color="white" size={32}/><Text style={{fontSize:14,fontWeight:"800",color:"#FFF"}}>Adaugă activitate</Text></TouchableOpacity>
        <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderRadius:14,paddingHorizontal:13,minHeight:46,gap:9,...(Platform.OS==='web'?{width:searchFocused? '100%' as const:230,maxWidth:'100%' as const}: {})}}>
          <Ionicons name="search-outline" size={19} color="#888" />
          <TextInput style={{flex:1,fontSize:14,color:'#171717'}} placeholder="Caută după nume..." placeholderTextColor="#999" value={listSearch} onChangeText={setListSearch} autoCorrect={false} onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)} />
        </View>
      </View>}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!createOnly && <View style={{flexDirection:'row',gap:9,marginBottom:16}}>{([{key:'published',label:'Publicate',count:items.filter(a=>a.is_published).length},{key:'draft',label:'Ciorne',count:items.filter(a=>!a.is_published).length}] as const).map(stat=><TouchableOpacity accessibilityRole="tab" accessibilityState={{selected:activityFilter===stat.key}} onPress={()=>setActivityFilter(stat.key)} key={stat.key} style={{flex:1,backgroundColor:'#FFF',borderRadius:16,borderWidth:1,borderColor:activityFilter===stat.key?RED:'#ECECEC',padding:13}}><Text style={{fontSize:24,fontWeight:'900',color:'#171717'}}>{stat.count}</Text><Text style={{fontSize:12,color:activityFilter===stat.key?RED:'#777',fontWeight:'800'}}>{stat.label}</Text></TouchableOpacity>)}</View>}
      {openForm&&<View style={styles.card}>
        <View style={styles.formHeading}><View style={styles.formHeadingIcon}><Ionicons name="create-outline" size={20} color={RED}/></View><Text style={styles.formHeadingHint}>DETALII ACTIVITATE</Text></View>
        <Text style={styles.cardTitle}>{editing?'Modifică activitatea':'Activitate nouă'}</Text>
        <Field label="Titlu *" value={form.title} change={v=>setForm(f=>({...f,title:v}))} placeholder="Ex. Pregătirea pachetelor"/>
        <Field label="Descriere" value={form.description} change={v=>setForm(f=>({...f,description:v}))} placeholder="Detalii despre activitate" multiline/>
        <Field label="Locație *" value={form.location} change={v=>setForm(f=>({...f,location:v}))} placeholder="Locul desfășurării"/>
        <View style={styles.formDivider}/><Text style={styles.formSectionLabel}>PROGRAMARE</Text><Text style={styles.fieldLabel}>Data activității *</Text>
        <DateField value={dateToDisplay(form.date)} onChange={value=>setForm(f=>({...f,date:displayToDate(value)??value}))}/>
        <Text style={[styles.fieldLabel,{marginTop:15}]}>Ora de început *</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={()=>openPicker('start')}><Ionicons name="time-outline" size={21} color={RED}/><Text style={styles.pickerValue}>{form.start||'Alege ora de început'}</Text><Ionicons name="chevron-down" size={19} color="#999"/></TouchableOpacity>
        {picker==='start'&&<TimeSelector value={form.start} onChoose={(h,m)=>chooseTime('start',h,m)}/>}
        <Text style={[styles.fieldLabel,{marginTop:15}]}>Ora de sfârșit (opțional)</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={()=>openPicker('end')}><Ionicons name="time-outline" size={21} color={RED}/><Text style={styles.pickerValue}>{form.end||'Alege ora de sfârșit'}</Text><Ionicons name="chevron-down" size={19} color="#999"/></TouchableOpacity>
        {picker==='end'&&<View><TimeSelector value={form.end} onChoose={(h,m)=>chooseTime('end',h,m)}/><TouchableOpacity onPress={()=>{setForm(f=>({...f,end:''}));setPicker(null);}} style={styles.clearTime}><Text style={styles.actionText}>Elimină ora de sfârșit</Text></TouchableOpacity></View>}
        <Field label="Număr maxim voluntari (opțional)" value={form.max} change={v=>setForm(f=>({...f,max:v}))} placeholder="Ex. 20" keyboardType="number-pad"/>
        <View style={styles.formDivider}/><View style={styles.switchRow}><View style={{flex:1,paddingRight:12}}><Text style={styles.fieldLabel}>Publică în calendar</Text><Text style={styles.publishHint}>Activitatea va fi vizibilă tuturor utilizatorilor.</Text></View><Switch value={form.published} onValueChange={v=>setForm(f=>({...f,published:v}))} trackColor={{true:'#DDA6A7'}} thumbColor={form.published?RED:'#EEEEEE'}/></View>
        <TouchableOpacity style={styles.primary} disabled={busy} onPress={save}>{busy?<ActivityIndicator color="white"/>:<Text style={styles.primaryText}>{editing ? "Salvează modificările" : form.published ? "Salvează și publică" : "Salvează ca ciornă"}</Text>}</TouchableOpacity>
      </View>}
      {!createOnly && <><View style={styles.sectionHeader}><Text style={styles.section}>PROPUNERI DE ACTIVITĂȚI ({proposals.filter(p=>p.status==='pending').length})</Text></View>
      {proposals.filter(p=>p.status==='pending').length===0?<Text style={[styles.muted,{marginBottom:14}]}>Nu există propuneri în așteptare.</Text>:proposals.filter(p=>p.status==='pending').map(p=><View key={p.id} style={styles.card}>
        <Text style={styles.cardTitle}>{p.title}</Text>
        <Text style={styles.muted}>{new Date(p.starts_at).toLocaleString('ro-RO',{dateStyle:'medium',timeStyle:'short'})} · {p.location}</Text>
        <Text style={styles.description}>{p.description}</Text>
        <View style={styles.actions}>
          <TouchableOpacity disabled={!!reviewing} style={styles.secondary} onPress={()=>void reviewProposal(p.id,true)}><Ionicons name="checkmark-circle-outline" size={18} color="#25734D"/><Text style={styles.actionText}>Aprobă și publică</Text></TouchableOpacity>
          <TouchableOpacity disabled={!!reviewing} style={styles.secondary} onPress={()=>void reviewProposal(p.id,false)}><Ionicons name="close-circle-outline" size={18} color={RED}/><Text style={styles.actionText}>Respinge</Text></TouchableOpacity>
        </View>
      </View>)}
      <View style={styles.sectionHeader}><Text style={styles.section}>{activityFilter==='published'?'ACTIVITĂȚI PUBLICATE':'CIORNE'} ({items.filter(a=>a.is_published===(activityFilter==='published')).length})</Text>{registrations.filter(r=>r.status==='pending').length>0&&<View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{registrations.filter(r=>r.status==='pending').length} în așteptare</Text></View>}</View>
      {loading?<ActivityIndicator color={RED} style={{marginTop:28}}/>:items.filter(a=>a.is_published===(activityFilter==='published') && a.title.toLocaleLowerCase('ro').includes(listSearch.trim().toLocaleLowerCase('ro'))).length===0?<View style={styles.card}><Text style={styles.muted}>{activityFilter==='published'?'Nu există activități publicate care să corespundă căutării.':'Nu există ciorne care să corespundă căutării.'}</Text></View>:items.filter(a=>a.is_published===(activityFilter==='published') && a.title.toLocaleLowerCase('ro').includes(listSearch.trim().toLocaleLowerCase('ro'))).map(a=>{
        const regs=registrations.filter(r=>r.activity_id===a.id);
        const pending=regs.filter(r=>r.status==='pending').length;
        return <View key={a.id} style={styles.card} onLayout={event => { cardPositions.current[a.id] = event.nativeEvent.layout.y; if (registrationId && registrations.some(r => r.id === registrationId && r.activity_id === a.id)) { scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true }); } }}>
          <View style={styles.row}><View style={{flex:1}}><Text style={styles.cardTitle}>{a.title}</Text><Text style={styles.muted}>{new Date(a.starts_at).toLocaleString('ro-RO',{dateStyle:'medium',timeStyle:'short'})}</Text></View><Text style={[styles.status,a.is_published?styles.published:styles.draft]}>{a.is_published?'Publicată':'Ciornă'}</Text></View>
          {!!a.location&&<Text style={styles.muted}>📍 {a.location}</Text>}
          {!!a.description&&<Text style={styles.description}>{a.description}</Text>}
          <Text style={styles.muted}>Înscrieri: {regs.length}{a.max_volunteers?` / ${a.max_volunteers}`:''} · În așteptare: {pending}</Text>
          <View style={styles.actions}><TouchableOpacity style={styles.secondary} onPress={()=>edit(a)}><Ionicons name="create-outline" color={RED} size={17}/><Text style={styles.actionText}>Editează</Text></TouchableOpacity><TouchableOpacity style={styles.secondary} onPress={()=>setExpanded(expanded===a.id?null:a.id)}><Ionicons name="people-outline" color={RED} size={17}/><Text style={styles.actionText}>Înscrieri</Text>{pending>0&&<View style={styles.countBadge}><Text style={styles.countBadgeText}>{pending}</Text></View>}</TouchableOpacity><TouchableOpacity style={styles.secondary} disabled={busy} onPress={()=>remove(a)}><Ionicons name="trash-outline" color={RED} size={17}/></TouchableOpacity></View>
          {expanded===a.id&&<View style={styles.registrationArea}>{regs.length===0?<Text style={styles.muted}>Nicio înscriere momentan.</Text>:regs.map(r=><View key={r.id} style={[styles.registration, registrationId === r.id && styles.highlightedRegistration]}>
            <View style={styles.volunteerRow}>
              <View style={styles.volunteerAvatar}><Ionicons name="person-outline" size={19} color={RED}/></View>
              <View style={{flex:1}}>
                <Text style={styles.regTitle}>{volunteerNames[r.volunteer_id] || `Voluntar ${r.volunteer_id.slice(0,8)}…`}</Text>
                <Text style={styles.muted}>Solicitare: {new Date(r.created_at).toLocaleDateString('ro-RO')}</Text>
              </View>
              <View style={[styles.registrationBadge,r.status==='confirmed'?styles.regApproved:r.status==='rejected'?styles.regRejected:styles.regPending]}>
                <Text style={[styles.registrationBadgeText,r.status==='confirmed'?styles.regApprovedText:r.status==='rejected'?styles.regRejectedText:styles.regPendingText]}>{r.status==='pending'?'În așteptare':r.status==='confirmed'?'Confirmată':r.status==='rejected'?'Respinsă':r.status}</Text>
              </View>
            </View>
            {!!r.admin_message&&<View style={styles.previousMessage}><Ionicons name="chatbubble-ellipses-outline" size={16} color={RED}/><Text style={styles.previousMessageText}>{r.admin_message}</Text></View>}
            <Field label="Mesaj către voluntar (opțional)" value={messages[r.id]??r.admin_message??''} change={v=>setMessages(m=>({...m,[r.id]:v}))} placeholder="Scrie un mesaj pentru voluntar" multiline/>
            <View style={styles.actions}>
              <TouchableOpacity disabled={busy} style={[styles.registrationAction,styles.acceptAction]} onPress={()=>updateRegistration(r,'confirmed')}>
                {registrationBusy===r.id?<ActivityIndicator color="#25734D" size="small"/>:<Ionicons name="checkmark-circle-outline" color="#25734D" size={18}/>}
                <Text style={styles.acceptText}>Confirmă</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} style={[styles.registrationAction,styles.rejectAction]} onPress={()=>updateRegistration(r,'rejected')}>
                <Ionicons name="close-circle-outline" color={RED} size={18}/><Text style={styles.actionText}>Respinge</Text>
              </TouchableOpacity>
            </View>
          </View>)}</View>}
        </View>;
      })}
          </>}
      </ScrollView>
  </SafeAreaView>;
}
function TimeSelector({value,onChoose}:{value:string;onChoose:(h:number,m:number)=>void}) {
  const [hours,setHours]=useState(value?Number(value.split(':')[0]):10);
  const [minutes,setMinutes]=useState(value?Number(value.split(':')[1]):0);
  return <View style={styles.timeBox}>
    <Text style={styles.timeHint}>Alege ora</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChoices}>{Array.from({length:24},(_,i)=>i).map(h=><TouchableOpacity key={h} style={[styles.timeChoice,h===hours&&styles.timeSelected]} onPress={()=>setHours(h)}><Text style={[styles.timeChoiceText,h===hours&&styles.timeSelectedText]}>{String(h).padStart(2,'0')}</Text></TouchableOpacity>)}</ScrollView>
    <Text style={styles.timeHint}>Alege minutele</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChoices}>{Array.from({length:12},(_,i)=>i*5).map(m=><TouchableOpacity key={m} style={[styles.timeChoice,m===minutes&&styles.timeSelected]} onPress={()=>setMinutes(m)}><Text style={[styles.timeChoiceText,m===minutes&&styles.timeSelectedText]}>{String(m).padStart(2,'0')}</Text></TouchableOpacity>)}</ScrollView>
    <TouchableOpacity style={styles.confirmTime} onPress={()=>onChoose(hours,minutes)}><Ionicons name="checkmark" size={19} color="white"/><Text style={styles.primaryText}>Confirmă {String(hours).padStart(2,'0')}:{String(minutes).padStart(2,'0')}</Text></TouchableOpacity>
  </View>;
}
function Field({label,value,change,placeholder,multiline,keyboardType}:{label:string;value:string;change:(v:string)=>void;placeholder:string;multiline?:boolean;keyboardType?:'number-pad'}){return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={[styles.input,multiline&&{minHeight:95,textAlignVertical:'top'}]} value={value} onChangeText={change} placeholder={placeholder} placeholderTextColor="#AAA" multiline={multiline} keyboardType={keyboardType}/></View>}
const styles=StyleSheet.create({
 sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 pendingBadge:{backgroundColor:'#FDE9E9',borderRadius:12,paddingHorizontal:10,paddingVertical:5},
 pendingBadgeText:{color:RED,fontWeight:'900',fontSize:11},
 countBadge:{backgroundColor:RED,minWidth:21,height:21,borderRadius:11,alignItems:'center',justifyContent:'center',paddingHorizontal:5,marginLeft:3},
 countBadgeText:{color:'#FFF',fontSize:11,fontWeight:'900'},
formHeading:{flexDirection:'row',alignItems:'center',gap:9,marginBottom:12},formHeadingIcon:{width:35,height:35,borderRadius:11,backgroundColor:'#FFF0F0',alignItems:'center',justifyContent:'center'},formHeadingHint:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:RED},formDivider:{height:1,backgroundColor:'#F0E7E3',marginTop:22,marginBottom:17},formSectionLabel:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:'#999',marginBottom:12},publishHint:{fontSize:11,color:'#888',lineHeight:16,marginTop:2},todayDot:{position:'absolute',bottom:1,width:5,height:5,borderRadius:3,backgroundColor:RED},todayDotSelected:{backgroundColor:'#FFF'},
header:{
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),flexDirection:'row',alignItems:'center',gap:14,marginTop:16,marginBottom:29},
addButton:{width:57,height:57,borderRadius:19,backgroundColor:RED,alignItems:'center',justifyContent:'center'},
infoBanner:{backgroundColor:'#FFF0F0',borderRadius:22,padding:16,flexDirection:'row',alignItems:'center',gap:13,marginBottom:19},
bannerIcon:{width:53,height:53,borderRadius:17,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},
bannerTitle:{fontSize:15,fontWeight:'900',color:'#171717'},bannerText:{fontSize:12,color:'#777',lineHeight:19,marginTop:4},
pickerButton:{backgroundColor:'#F7F7F7',borderRadius:14,paddingHorizontal:15,minHeight:55,flexDirection:'row',alignItems:'center',gap:12,marginTop:7},
pickerValue:{flex:1,color:'#242424',fontSize:14,fontWeight:'600'},
calendarBox:{backgroundColor:'#FFF',borderRadius:16,borderWidth:1,borderColor:'#EEE',padding:10,marginTop:8},
monthHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},monthArrow:{padding:8},monthTitle:{fontWeight:'900',fontSize:15,color:'#171717'},
daysGrid:{flexDirection:'row',flexWrap:'wrap'},dayCell:{width:'14.2857%',height:43,alignItems:'center',justifyContent:'center'},weekday:{color:'#999',fontSize:11,fontWeight:'800'},dayCircle:{height:35,width:35,borderRadius:18,alignItems:'center',justifyContent:'center'},daySelected:{backgroundColor:RED},dayText:{color:'#171717',fontSize:13,fontWeight:'700'},
timeBox:{marginTop:8,borderWidth:1,borderColor:'#EEE',borderRadius:16,padding:12,backgroundColor:'#FFF'},timeHint:{fontSize:12,color:'#777',fontWeight:'800',marginBottom:8,marginTop:6},timeChoices:{gap:7,paddingBottom:9},timeChoice:{paddingHorizontal:12,height:38,minWidth:44,borderRadius:11,backgroundColor:'#F6F6F6',alignItems:'center',justifyContent:'center'},timeSelected:{backgroundColor:RED},timeChoiceText:{color:'#333',fontWeight:'800'},timeSelectedText:{color:'#FFF'},confirmTime:{backgroundColor:RED,borderRadius:12,minHeight:45,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:8},clearTime:{padding:12,alignItems:'center'},
screen:{flex:1,backgroundColor:BG},content:{ ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),padding:20,paddingBottom:55},back:{width:44,height:44,borderRadius:19,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},backText:{color:RED,fontWeight:'700',fontSize:13},eyebrow:{color:RED,fontSize:10,fontWeight:'900',letterSpacing:1.5},title:{fontSize: 27,fontWeight:'900',color:'#171717',marginTop:3},subtitle:{color:'#777',fontSize:13,lineHeight:20,marginTop:8,marginBottom:22},primary:{backgroundColor:RED,borderRadius:15,padding:15,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7,marginVertical:8},primaryText:{color:'white',fontSize:14,fontWeight:'800'},section:{fontSize:11,color:'#8B7B77',fontWeight:'900',letterSpacing:1,marginTop:25,marginBottom:12},card:{backgroundColor:'white',borderRadius:19,padding:17,marginBottom:13,borderWidth:1,borderColor:'#F0E7E3'},cardTitle:{fontSize:17,fontWeight:'900',color:'#171717',marginBottom:6},muted:{color:'#777',fontSize:12,lineHeight:19,marginTop:3},description:{color:'#444',fontSize:13,lineHeight:19,marginVertical:9},row:{flexDirection:'row',alignItems:'center',gap:10},status:{fontSize:10,fontWeight:'800',paddingHorizontal:10,paddingVertical:6,borderRadius:10,overflow:'hidden'},published:{color:'#25734D',backgroundColor:'#E6F5EB'},draft:{color:'#8A6B2E',backgroundColor:'#FFF2D6'},field:{marginTop:13},fieldLabel:{fontSize:12,fontWeight:'800',color:'#4B3B38',marginBottom:7},input:{borderWidth:1,borderColor:'#E7DDDA',borderRadius:12,backgroundColor:'#FFFCFA',paddingHorizontal:12,paddingVertical:11,fontSize:14,color:'#171717'},switchRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginVertical:16},actions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:13},secondary:{borderRadius:10,borderWidth:1,borderColor:'#F0D5D3',backgroundColor:'#FFF8F7',paddingHorizontal:11,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:5},actionText:{color:RED,fontSize:12,fontWeight:'800'},registrationArea:{marginTop:16,borderTopWidth:1,borderTopColor:'#EEE',paddingTop:12},registration:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#F3EDEB'},regTitle:{fontSize:13,fontWeight:'900',color:'#222'},
 volunteerRow:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:9},
 volunteerAvatar:{width:40,height:40,borderRadius:13,backgroundColor:'#FFF0F0',alignItems:'center',justifyContent:'center'},
 registrationBadge:{borderRadius:10,paddingHorizontal:9,paddingVertical:6,maxWidth:116},
 registrationBadgeText:{fontSize:10,fontWeight:'800',textAlign:'center'},
 regPending:{backgroundColor:'#FFF2D6'},regPendingText:{color:'#8A6B2E'},
 regApproved:{backgroundColor:'#E6F5EB'},regApprovedText:{color:'#25734D'},
 regRejected:{backgroundColor:'#FDE9E9'},regRejectedText:{color:RED},
 previousMessage:{flexDirection:'row',alignItems:'flex-start',gap:7,backgroundColor:'#FFF8F7',padding:11,borderRadius:12,marginTop:9},
 previousMessageText:{flex:1,color:'#625B58',fontSize:12,lineHeight:18},
 registrationAction:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:12,paddingHorizontal:16,paddingVertical:12,flexGrow:1},
 acceptAction:{backgroundColor:'#E6F5EB',borderWidth:1,borderColor:'#CBE9D5'},
 rejectAction:{backgroundColor:'#FFF8F7',borderWidth:1,borderColor:'#F0D5D3'},
 acceptText:{color:'#25734D',fontSize:12,fontWeight:'900'}
});
