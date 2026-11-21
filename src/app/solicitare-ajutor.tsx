import { Alert } from '../lib/platform-alert';
import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RED = '#A61E22';
const MAX_FILE = 12 * 1024 * 1024;
const COUNTRIES = ['România','Republica Moldova','Italia','Germania','Franța','Spania','Regatul Unit','Statele Unite','Austria','Belgia','Olanda','Irlanda','Ucraina','Altă țară'];
const COUNTIES = ['Alba','Arad','Argeș','Bacău','Bihor','Bistrița-Năsăud','Botoșani','Brașov','Brăila','București','Buzău','Caraș-Severin','Călărași','Cluj','Constanța','Covasna','Dâmbovița','Dolj','Galați','Giurgiu','Gorj','Harghita','Hunedoara','Ialomița','Iași','Ilfov','Maramureș','Mehedinți','Mureș','Neamț','Olt','Prahova','Satu Mare','Sălaj','Sibiu','Suceava','Teleorman','Timiș','Tulcea','Vaslui','Vâlcea','Vrancea'];
const PLACES: Record<string,string[]> = {
 'Suceava':['Suceava','Rădăuți','Fălticeni','Câmpulung Moldovenesc','Vatra Dornei','Gura Humorului','Siret','Vicovu de Sus','Dolhasca','Salcea','Liteni','Frasin','Broșteni','Cajvana','Milișăuți','Solca','Vicovu de Jos','Marginea','Dornești','Putna','Horodnic de Sus','Horodnic de Jos','Straja','Bilca','Voitinel','Arbore','Vama','Moldovița','Sadova','Sucevița'],
 'Iași':['Iași','Pașcani','Hârlău','Târgu Frumos','Podu Iloaiei','Miroslava','Ciurea'],
 'Botoșani':['Botoșani','Dorohoi','Darabani','Săveni','Flămânzi','Ștefănești'],
 'Neamț':['Piatra Neamț','Roman','Târgu Neamț','Bicaz','Roznov'],
 'Bacău':['Bacău','Onești','Moinești','Comănești','Buhuși','Dărmănești'],
 'Cluj':['Cluj-Napoca','Turda','Dej','Gherla','Câmpia Turzii'],
 'București':['București','Sector 1','Sector 2','Sector 3','Sector 4','Sector 5','Sector 6']
};
function dateError(value:string) {
 const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
 if(!m) return 'Selectează o dată validă (zz/ll/aaaa).';
 const d=Number(m[1]), mo=Number(m[2]), y=Number(m[3]);
 const date=new Date(y,mo-1,d); const now=new Date();
 if(y<1900||date.getFullYear()!==y||date.getMonth()!==mo-1||date.getDate()!==d||date>now) return 'Data nașterii nu este validă.';
 return '';
}
function fieldError(key:Key, form:typeof initial):string {
 const v=form[key].trim();
 if(mandatory.includes(key)&&!v) return 'Câmp obligatoriu.';
 if(key==='birthDate'&&v) return dateError(v);
 if(key==='name'&&v.length<2) return 'Introdu numele complet (minimum 2 caractere).';
 if(key==='locality'&&v&&v.length<2) return 'Localitatea trebuie să aibă minimum 2 caractere.';
 if((key==='phone'||key==='whatsapp')&&v&&v.replace(/\D/g,'').length<6) return 'Numărul de telefon este prea scurt.';
 if(key==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Adresa de e-mail nu este validă.';
 if(key==='needs'&&v.length<20) return 'Descrie nevoile în minimum 20 de caractere.';
 if(['familyMembers','minorChildren'].includes(key)&&v&&(!/^\d+$/.test(v)||Number(v)<0)) return 'Introdu un număr valid.';
 if(key==='familyMembers'&&v&&Number(v)<1) return 'Trebuie să existe cel puțin un membru.';
 if(key==='minorChildren'&&v&&Number(v)>Number(form.familyMembers)) return 'Numărul copiilor nu poate depăși membrii familiei.';
 return '';
}
type FileEntry = DocumentPicker.DocumentPickerAsset;
const initial = {
  name: '', birthDate: '', country: 'România', county: '', locality: '', village: '', street: '', apartment: '',
  email: '', phone: '', whatsappSame: '', whatsapp: '', needs: '', familyMembers: '', minorChildren: '', childrenAges: '',
  monthlyIncome: '', illness: '', workplace: '', previouslyHelped: '', previousAssociation: '', videoConsent: '',
  visitConsent: '', discovery: '',
};
type Key = keyof typeof initial;
const mandatory: Key[] = ['name','birthDate','country','county','locality','street','phone','whatsappSame','needs','familyMembers','minorChildren','monthlyIncome','previouslyHelped','videoConsent','visitConsent','discovery'];

export default function SolicitareAjutor() {
  const [form, setForm] = useState(initial);
  const [identity, setIdentity] = useState<FileEntry[]>([]);
  const [evidence, setEvidence] = useState<FileEntry[]>([]);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fieldPositions = useRef<Partial<Record<Key | 'identity' | 'evidence' | 'consent', number>>>({});
  const cardTop = useRef(0);
  const registerPosition = (key: Key | 'identity' | 'evidence' | 'consent') => (event: { nativeEvent: { layout: { y: number } } }) => { fieldPositions.current[key] = event.nativeEvent.layout.y; };
  const scrollToFirstError = () => {
    const ordered: (Key | 'identity' | 'evidence' | 'consent')[] = [
      'name','birthDate','country','county','locality','street','email','phone','whatsappSame',
      ...(form.whatsappSame === 'Nu' ? ['whatsapp' as Key] : []),
      'needs','familyMembers','minorChildren','monthlyIncome','previouslyHelped',
      ...(form.previouslyHelped === 'Da' ? ['previousAssociation' as Key] : []),
      'videoConsent','visitConsent','discovery','identity','evidence','consent',
    ];
    const first = ordered.find(key => {
      if (key === 'identity') return identity.length !== 1;
      if (key === 'evidence') return evidence.length === 0 || evidence.reduce((n,f)=>n+(f.size||0),identity[0]?.size||0)>15*1024*1024;
      if (key === 'consent') return !consent;
      return !!fieldError(key, form);
    });
    if (first) {
      const y = fieldPositions.current[first];
      if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, cardTop.current + y - 18), animated: true });
    }
  };
  const [picker, setPicker] = useState<Key | null>(null);
  const [search, setSearch] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear()-20, new Date().getMonth(), 1));
  const set = (key: Key, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const setPlace = (key: Key, value:string) => setForm(prev => ({...prev,[key]:value,...(key==='country'?{county:'',locality:'',village:''}:{}),...(key==='county'?{locality:'',village:''}:{})}));
  const options = picker==='country'?COUNTRIES:picker==='county'?COUNTIES:picker==='locality'||picker==='village'?(PLACES[form.county]||[]):[];
  const openPicker=(key:Key)=>{setSearch('');setPicker(key);};
  const chooseDate=(d:number)=>{const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth()+1;set('birthDate',`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`);setCalendarOpen(false);};
  const valid = mandatory.every(key => !fieldError(key,form)) && !fieldError('email',form) &&
    (form.whatsappSame !== 'Nu' || !!form.whatsapp.trim()) &&
    (form.previouslyHelped !== 'Da' || !!form.previousAssociation.trim()) &&
    identity.length === 1 && evidence.length > 0 && consent && evidence.reduce((n,f)=>n+(f.size||0),identity[0]?.size||0)<=15*1024*1024;

  async function pickFiles(kind: 'identity' | 'evidence') {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg','image/png','image/webp','application/pdf'], multiple: kind === 'evidence', copyToCacheDirectory: true });
      if (result.canceled) return;
      const picked = result.assets.filter(f => (f.size ?? 0) <= MAX_FILE);
      if (picked.length !== result.assets.length) Alert.alert('Fișier prea mare', 'Maximum 12 MB pentru fiecare fișier.');
      if (kind === 'identity') setIdentity(picked.slice(0, 1));
      else setEvidence(old => [...old, ...picked].slice(0, 8));
    } catch { Alert.alert('Eroare', 'Nu am putut selecta documentele.'); }
  }
  async function submit() {
    setErrors(true);
    if (sending) return;
    if (!valid) {
      scrollToFirstError();
      return;
    }
    setSending(true);
    try {
      const payload = new FormData();
      payload.append('form', JSON.stringify({ ...form, consent }));
      const appendFile = (key: string, file: FileEntry) => {
        if (Platform.OS === 'web' && file.file) {
          payload.append(key, file.file);
        } else {
          // React Native's global fetch/FormData rejects native file objects in some Expo versions.
          // expo/fetch supports expo-file-system File directly.
          payload.append(key, new ExpoFile(file.uri) as any);
        }
      };
      appendFile('identity', identity[0]);
      evidence.forEach(file => appendFile('evidence', file));
      const { data: sessionData } = await supabase.auth.getSession();
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!baseUrl || !publicKey) throw new Error('Configurarea Supabase lipsește.');
      const requestFetch = Platform.OS === 'web' ? fetch : expoFetch;
      const response = await requestFetch(`${baseUrl}/functions/v1/submit-help-request`, {
        method: 'POST',
        headers: { apikey: publicKey, authorization: `Bearer ${sessionData.session?.access_token || publicKey}` },
        body: payload,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Trimiterea a eșuat.');
      Alert.alert('Solicitare trimisă', 'Solicitarea dumneavoastră a fost trimisă cu succes.');
      setForm(initial); setIdentity([]); setEvidence([]); setConsent(false); setErrors(false);
    } catch (error) {
      Alert.alert('Nu s-a putut trimite', error instanceof Error ? error.message : 'Încearcă din nou.');
    } finally { setSending(false); }
  }
  const field = (key: Key, label: string, required = false, multiline = false, keyboardType: 'default'|'phone-pad'|'email-address'|'numeric' = 'default') => (
    <View style={styles.field} key={key} onLayout={registerPosition(key)}>
      <Text style={[styles.label,errors && fieldError(key,form) && styles.invalidLabel]}>{label}{required ? ' *' : ''}</Text>
      <TextInput value={form[key]} onChangeText={v => set(key,v)} placeholder={label} placeholderTextColor="#999" multiline={multiline} keyboardType={keyboardType} style={[styles.input,multiline && styles.multiline,errors && fieldError(key,form) && styles.invalidInput]} maxLength={multiline ? 5000 : 250}/>
      {errors && fieldError(key,form) ? <Text style={styles.error}>{fieldError(key,form)}</Text> : null}
    </View>
  );
  const choice = (key: Key, label: string, options: string[], required = true) => (
    <View style={styles.field} key={key} onLayout={registerPosition(key)}>
      <Text style={[styles.label,errors && required && !form[key] && styles.invalidLabel]}>{label}{required ? ' *' : ''}</Text>
      <View style={[styles.choices,errors && required && !form[key] && styles.invalidChoice]}>{options.map(option => <TouchableOpacity key={option} onPress={() => set(key,option)} style={[styles.chip,form[key] === option && styles.chipActive]}><Text style={[styles.chipText,form[key] === option && styles.chipTextActive]}>{option}</Text></TouchableOpacity>)}</View>
      {errors && required && !form[key] ? <Text style={styles.error}>Selectează o opțiune</Text> : null}
    </View>
  );
  const selection = (key:Key,label:string,required=true) => <View style={styles.field} key={key} onLayout={registerPosition(key)}>
    <Text style={[styles.label,errors && fieldError(key,form) && styles.invalidLabel]}>{label}{required?' *':''}</Text>
    <TouchableOpacity onPress={()=>openPicker(key)} style={[styles.input,styles.selection,errors&&fieldError(key,form)&&styles.invalidInput]}><Text style={{color:form[key]?'#171717':'#999',flex:1}}>{form[key]||`Selectează ${label.toLowerCase()}`}</Text><Ionicons name="chevron-down" size={21} color="#555"/></TouchableOpacity>
    {errors&&fieldError(key,form)?<Text style={styles.error}>{fieldError(key,form)}</Text>:null}
  </View>;
  const birthday = () => <View style={styles.field} onLayout={registerPosition('birthDate')}>
    <Text style={[styles.label,errors&&fieldError('birthDate',form)&&styles.invalidLabel]}>Data nașterii (zz/ll/aaaa) *</Text>
    <TouchableOpacity style={[styles.input,styles.selection,errors&&fieldError('birthDate',form)&&styles.invalidInput]} onPress={()=>setCalendarOpen(true)}><Text style={{flex:1,color:form.birthDate?'#171717':'#999'}}>{form.birthDate||'Selectează data nașterii'}</Text><Ionicons name="calendar-outline" size={22} color={RED}/></TouchableOpacity>
    {errors&&fieldError('birthDate',form)?<Text style={styles.error}>{fieldError('birthDate',form)}</Text>:null}
  </View>;
  const firstWeekday=(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1).getDay()+6)%7;
  const daysInMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,0).getDate();
  const calendarDays=Array.from({length:firstWeekday+daysInMonth},(_,i)=>i<firstWeekday?0:i-firstWeekday+1);
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <MisiBiPageHeader title="Solicitare de ajutor" eyebrow="MISIUNEA BUCOVINA" />
    <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.intro}>Completează cu atenție și corect. Câmpurile marcate cu * sunt obligatorii.</Text>
    <View style={styles.card} onLayout={event => { cardTop.current = event.nativeEvent.layout.y; }}>
      <Text style={styles.section}>Date personale și adresă</Text>
      {field('name','Nume și prenume',true)}
      {birthday()}
      {selection('country','Țara')}
      {form.country==='România'?selection('county','Județul'):field('county','Regiunea / Județul',true)}
      {selection('locality','Localitatea / Comuna')}
      {selection('village','Satul',false)}
      {field('street','Strada și numărul casei',true)}
      {field('apartment','Bloc - Scară - Etaj - Ap. (opțional)')}
      {field('email','Email (opțional)',false,false,'email-address')}
      {field('phone','Numărul de telefon (cu prefixul țării)',true,false,'phone-pad')}
      {choice('whatsappSame','Numărul de telefon este și WhatsApp?', ['Da','Nu'])}
      {form.whatsappSame === 'Nu' && field('whatsapp','Care este numărul dumneavoastră de WhatsApp?',true,false,'phone-pad')}
      <Text style={styles.section}>Situația familiei și nevoile</Text>
      {field('needs','Ce nevoi aveți? Explicați aici detaliat (minimum 20 de caractere)',true,true)}
      {field('familyMembers','Număr de membri în familie (părinți + copii)',true,false,'numeric')}
      {field('minorChildren','Număr copii minori',true,false,'numeric')}
      {field('childrenAges','Vârsta copiilor (dacă aveți copii)')}
      {field('monthlyIncome','Venit lunar aproximativ al familiei',true)}
      {field('illness','Suferiți de vreo boală? Dacă DA, cum se numește? (opțional)',false,true)}
      {field('workplace','Loc de muncă (opțional)')}
      {choice('previouslyHelped','Ați mai fost ajutați de către o altă Asociație?', ['Da','Nu'])}
      {form.previouslyHelped === 'Da' && field('previousAssociation','Cum se numește Asociația sau Fundația?',true)}
      <Text style={styles.section}>Alte informații</Text>
      {choice('videoConsent','Sunteți de acord să facem un scurt reportaj video? (pentru a vă putea ajuta)', ['Da','Nu'])}
      {choice('visitConsent','Aveți posibilitatea să primiți vizita unui reprezentant Misiunea Bucovina pentru verificarea situației?', ['Da','Nu'])}
      {choice('discovery','Cum ați aflat de Misiunea Bucovina?', ['Facebook','TikTok','YouTube','Recomandare','Biserică','Altă sursă'])}
      <Text style={styles.section}>Documente justificative</Text>
      <View onLayout={registerPosition('identity')}><Text style={styles.label}>Carte identitate *</Text></View>
      <TouchableOpacity style={[styles.upload,errors&&identity.length!==1&&styles.invalidInput]} onPress={() => pickFiles('identity')}><Ionicons name="document-attach-outline" color={RED} size={21}/><Text style={styles.uploadText}>{identity[0]?.name ?? 'Selectează cartea de identitate'}</Text></TouchableOpacity>
      <View onLayout={registerPosition('evidence')}><Text style={styles.label}>Dovezi situație * (maximum 8 fișiere)</Text></View>
      <TouchableOpacity style={[styles.upload,errors&&evidence.length===0&&styles.invalidInput]} onPress={() => pickFiles('evidence')}><Ionicons name="images-outline" color={RED} size={21}/><Text style={styles.uploadText}>Adaugă dovezi ({evidence.length}/8)</Text></TouchableOpacity>
      {evidence.map((file,i) => <TouchableOpacity key={file.uri + i} onPress={() => setEvidence(old => old.filter((_,j) => i !== j))}><Text style={styles.file}>{file.name}   ×</Text></TouchableOpacity>)}
      <Text style={styles.note}>Maximum 12 MB/fișier. Formate acceptate: JPEG, PNG, WebP, PDF. Documentele sunt sensibile și vor necesita stocare privată.</Text>
      <TouchableOpacity onLayout={registerPosition('consent')} style={[styles.consent,errors&&!consent&&styles.invalidChoice]} onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{checked:consent}}><Ionicons name={consent?'checkbox':'square-outline'} size={25} color={RED}/><Text style={styles.consentText}>Prin completarea acestui formular sunt de acord cu prelucrarea datelor personale în scopul soluționării solicitării și confirm că am citit Termenii și condițiile. *</Text></TouchableOpacity>
      {errors && !valid && <Text style={styles.error}>Corectează câmpurile marcate cu roșu și verifică documentele (maximum 15 MB în total).</Text>}
      <TouchableOpacity style={[styles.button, sending && {opacity:0.6}]} disabled={sending} onPress={submit}><Text style={styles.buttonText}>{sending ? 'Se trimite...' : 'Trimite solicitarea'}</Text></TouchableOpacity>
      <Text style={styles.warning}>Documentele sunt transmise către stocarea privată. Nu închide pagina până la confirmarea înregistrării.</Text>
    </View>
  </ScrollView>
  <Modal visible={!!picker} transparent animationType="slide" onRequestClose={()=>setPicker(null)}><View style={styles.modalShade}><View style={styles.modalPanel}>
    <View style={styles.modalHead}><Text style={styles.modalTitle}>{picker==='country'?'Selectează țara':picker==='county'?'Selectează județul':picker==='village'?'Selectează satul':'Selectează localitatea'}</Text><TouchableOpacity onPress={()=>setPicker(null)}><Ionicons name="close" size={26}/></TouchableOpacity></View>
    <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Caută sau introdu denumirea..." placeholderTextColor="#999" autoCorrect={false}/>
    <ScrollView keyboardShouldPersistTaps="always" style={{maxHeight:340}}>{options.filter(o=>o.toLocaleLowerCase('ro').includes(search.trim().toLocaleLowerCase('ro'))).map(o=><TouchableOpacity key={o} style={styles.option} onPress={()=>{if(picker)setPlace(picker,o);setPicker(null)}}><Text style={styles.optionText}>{o}</Text></TouchableOpacity>)}</ScrollView>
    {(picker==='locality'||picker==='village'||picker==='country'&&search.trim()&&search.trim()!=='Altă țară')&&search.trim().length>=2?<TouchableOpacity style={styles.customOption} onPress={()=>{if(picker)setPlace(picker,search.trim());setPicker(null)}}><Text style={{color:RED,fontWeight:'800'}}>Folosește „{search.trim()}”</Text></TouchableOpacity>:null}
    {picker==='locality'||picker==='village'?<Text style={styles.pickerNote}>Lista conține sugestii, nu toate localitățile din România. Poți scrie denumirea exactă și o poți selecta.</Text>:null}
  </View></View></Modal>
  <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={()=>setCalendarOpen(false)}><View style={styles.modalShade}><View style={styles.calendarPanel}>
    <View style={styles.modalHead}><Text style={styles.modalTitle}>Data nașterii</Text><TouchableOpacity onPress={()=>setCalendarOpen(false)}><Ionicons name="close" size={26}/></TouchableOpacity></View>
    <View style={styles.calendarNav}><TouchableOpacity onPress={()=>setCalendarMonth(new Date(calendarMonth.getFullYear()-1,calendarMonth.getMonth(),1))}><Text style={styles.navText}>« An</Text></TouchableOpacity><TouchableOpacity onPress={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1))}><Ionicons name="chevron-back" size={22}/></TouchableOpacity><Text style={styles.monthText}>{calendarMonth.toLocaleDateString('ro-RO',{month:'long',year:'numeric'})}</Text><TouchableOpacity onPress={()=>setCalendarMonth(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1))}><Ionicons name="chevron-forward" size={22}/></TouchableOpacity><TouchableOpacity onPress={()=>setCalendarMonth(new Date(calendarMonth.getFullYear()+1,calendarMonth.getMonth(),1))}><Text style={styles.navText}>An »</Text></TouchableOpacity></View>
    <View style={styles.days}>{['Lu','Ma','Mi','Jo','Vi','Sâ','Du'].map(d=><Text key={d} style={styles.weekday}>{d}</Text>)}{calendarDays.map((d,i)=><TouchableOpacity key={i} disabled={!d||new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),d)>new Date()} onPress={()=>chooseDate(d)} style={styles.day}><Text style={{color:!d?'transparent':new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),d)>new Date()?'#BBB':'#222'}}>{d||'·'}</Text></TouchableOpacity>)}</View>
  </View></View></Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
 invalidLabel:{color:'#B91C1C'},invalidInput:{borderColor:'#DC2626',borderWidth:2,backgroundColor:'#FFF7F7'},invalidChoice:{borderColor:'#DC2626',borderWidth:1,borderRadius:10,padding:5},selection:{flexDirection:'row',alignItems:'center',minHeight:49},modalShade:{flex:1,backgroundColor:'rgba(0,0,0,.45)',justifyContent:'center',padding:20},modalPanel:{backgroundColor:'white',borderRadius:18,padding:20,maxHeight:'80%'},calendarPanel:{backgroundColor:'white',borderRadius:18,padding:18},modalHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:14},modalTitle:{fontSize:20,fontWeight:'900',color:'#222'},option:{paddingVertical:13,borderBottomWidth:1,borderColor:'#EEE'},optionText:{fontSize:16,color:'#222'},customOption:{paddingVertical:15},pickerNote:{fontSize:12,color:'#777',lineHeight:17,marginTop:12},calendarNav:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:5,marginBottom:12},monthText:{fontWeight:'800',fontSize:14,flex:1,textAlign:'center'},navText:{color:RED,fontWeight:'800',fontSize:12},days:{flexDirection:'row',flexWrap:'wrap'},weekday:{width:'14.285%',textAlign:'center',fontWeight:'800',marginBottom:8},day:{width:'14.285%',height:42,alignItems:'center',justifyContent:'center'}, screen:{flex:1,backgroundColor:'#F6F6F6'},content:{width:'100%',maxWidth:820,alignSelf:'center',padding:18,paddingBottom:70},back:{flexDirection:'row',alignItems:'center',marginBottom:22},eyebrow:{color:RED,fontWeight:'900',fontSize:12,letterSpacing:1},title:{fontSize:29,fontWeight:'900',color:'#171717',marginTop:8},intro:{fontSize:14,color:'#666',lineHeight:21,marginTop:8,marginBottom:20},card:{backgroundColor:'#fff',borderRadius:22,padding:Platform.OS==='web'?28:18},section:{fontSize:19,fontWeight:'900',color:'#171717',marginTop:22,marginBottom:16},field:{marginBottom:15},label:{fontWeight:'700',color:'#333',fontSize:13,marginBottom:7},input:{borderWidth:1,borderColor:'#DADADA',borderRadius:12,padding:13,fontSize:15,color:'#171717',backgroundColor:'#fff'},multiline:{minHeight:120,textAlignVertical:'top'},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderWidth:1,borderColor:'#DDD',paddingHorizontal:13,paddingVertical:10,borderRadius:22},chipActive:{backgroundColor:RED,borderColor:RED},chipText:{color:'#333'},chipTextActive:{color:'#fff',fontWeight:'800'},error:{color:'#B91C1C',marginTop:5,fontSize:12},upload:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#DDD',borderStyle:'dashed',borderRadius:12,padding:15,marginBottom:14},uploadText:{color:'#333',flex:1},file:{color:RED,paddingVertical:7},note:{color:'#777',fontSize:12,lineHeight:18,marginBottom:10},consent:{flexDirection:'row',alignItems:'flex-start',gap:10,marginVertical:20},consentText:{flex:1,color:'#444',lineHeight:20},button:{backgroundColor:RED,borderRadius:12,padding:16,alignItems:'center'},buttonText:{color:'#fff',fontWeight:'800'},warning:{color:'#8A5600',fontSize:12,marginTop:14,lineHeight:18}
});
