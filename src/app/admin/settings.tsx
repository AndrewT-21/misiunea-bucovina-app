import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { ActivityIndicator,
  
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { defaultAbout, mergeAbout, type AboutContent } from '../../lib/about-content';

const RED = '#A61E22';
const DARK = '#171717';
const BACKGROUND = '#F6F6F6';

type Settings = {
  id: string;
  organization_name: string;
  email: string | null;
  contact_notification_email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  about_text: string | null;
  about_content: AboutContent | null;
};

export default function AdminSettingsScreen() {
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [aboutContent, setAboutContent] = useState<AboutContent>(defaultAbout);
  const setAboutField = (key: keyof Omit<AboutContent,'timeline'>, value: string) => setAboutContent(prev => ({ ...prev, [key]: value }));
  const [timelineOpen,setTimelineOpen]=useState(false);
  const [openSections,setOpenSections]=useState<Record<string,boolean>>({});
  const toggleSection=(key:string)=>setOpenSections(prev=>({...prev,[key]:!prev[key]}));
  const [uploadingAboutImage, setUploadingAboutImage] = useState<string | null>(null);
  async function uploadAboutImage(key: 'heroImage' | 'missionImage' | 'danielImage' | 'emanuelImage') {
    if (uploadingAboutImage) return;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Autentifică-te înainte de încărcare.');
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, quality: 0.9, base64: true,
      });
      if (selection.canceled || !selection.assets?.[0]) return;
      const asset = selection.assets[0];
      if (!asset.base64) throw new Error('Nu s-au putut citi datele imaginii.');
      setUploadingAboutImage(key);
      const mime = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const extension = mime === 'image/png' ? 'png' : 'jpg';
      const objectPath = `despre-noi/${key}-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('site-images').upload(
        objectPath, decode(asset.base64), { contentType: mime, upsert: false, cacheControl: '3600' }
      );
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('site-images').getPublicUrl(objectPath);
      setAboutField(key, publicData.publicUrl);
      Alert.alert('Fotografie încărcată', 'Apasă „Salvează” pentru a publica noua fotografie pe pagina Despre noi.');
    } catch (e: any) {
      Alert.alert('Încărcare nereușită', e?.message || 'Verifică bucket-ul și permisiunile Storage.');
    } finally { setUploadingAboutImage(null); }
  }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from('app_settings')
      .select(`
        id,
        organization_name,
        email,
        contact_notification_email,
        phone,
        address,
        website,
        facebook_url,
        instagram_url,
        youtube_url,
        about_text,
        about_content
      `)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('Eroare încărcare setări:', error);

      Alert.alert(
        'Eroare',
        'Setările nu au putut fi încărcate.'
      );

      setLoading(false);
      return;
    }

    if (data) {
      const settings = data as Settings;

      setSettingsId(settings.id);
      setOrganizationName(settings.organization_name ?? '');
      setEmail(settings.email ?? '');
      setNotificationEmail(settings.contact_notification_email ?? 'media@misiuneabucovina.org');
      setPhone(settings.phone ?? '');
      setAddress(settings.address ?? '');
      setWebsite(settings.website ?? '');
      setFacebookUrl(settings.facebook_url ?? '');
      setInstagramUrl(settings.instagram_url ?? '');
      setYoutubeUrl(settings.youtube_url ?? '');
      setAboutText(settings.about_text ?? '');
      setAboutContent(mergeAbout(settings.about_content));
    }

    setLoading(false);
  }

  async function saveSettings() {
    if (!settingsId) {
      Alert.alert(
        'Eroare',
        'Nu am găsit înregistrarea pentru setările aplicației.'
      );
      return;
    }

    if (!organizationName.trim()) {
      Alert.alert(
        'Câmp obligatoriu',
        'Completează numele organizației.'
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail.trim())) {
      Alert.alert('Email invalid', 'Introdu o adresă validă pentru notificările Contact.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('app_settings')
        .update({
          organization_name: organizationName.trim(),
          email: email.trim() || null,
          contact_notification_email: notificationEmail.trim().toLowerCase(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          website: website.trim() || null,
          facebook_url: facebookUrl.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          updated_at: new Date().toISOString(),
          about_text: aboutText.trim() || null,
          about_content: aboutContent,
        })
        .eq('id', settingsId);

      if (error) {
        console.log('Eroare salvare setări:', error);

        Alert.alert(
          'Eroare',
          'Setările nu au putut fi salvate.'
        );

        return;
      }

      Alert.alert(
        'Setări salvate',
        'Informațiile au fost actualizate cu succes.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={RED} />

        <Text style={styles.loadingText}>
          Se încarcă setările...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={DARK}
            />
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.eyebrow}>
              ADMINISTRARE
            </Text>

            <Text style={styles.title}>
              Setări
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >

          <View style={styles.infoCard}>
            <Ionicons
              name="settings-outline"
              size={23}
              color={RED}
            />

            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                Informații generale
              </Text>

              <Text style={styles.infoText}>
                Modificările salvate aici pot fi folosite în
                aplicație fără publicarea unei versiuni noi.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>PAGINA PUBLICĂ · DESPRE NOI</Text>
          <Text style={styles.notificationHint}>Secțiunile sunt în aceeași ordine ca pe pagina publică. Deschide secțiunea dorită, modifică și salvează la final.</Text>
          {([
            ['hero','01 · Coperta paginii'],
            ['intro','02 · Prezentarea asociației și principii'],
            ['mission','03 · Motto-ul nostru și fotografia cu copiii'],
            ['origin','04 · Originea numelui'],
            ['story','05 · Povestea noastră și citatul fondatorului'],
            ['timeline','06 · Drumul viziunii noastre'],
            ['areas','07 · Unde ne implicăm'],
            ['leaders','08 · Echipa de conducere'],
            ['trademark','09 · Protecția mărcii'],
            ['creed','10 · Declarația noastră de credință'],
          ] as const).map(([id,title])=><View key={id} style={styles.accordionCard}>
            <TouchableOpacity style={styles.accordionHeader} onPress={()=>toggleSection(id)} accessibilityRole="button" accessibilityLabel={title}>
              <Text style={styles.accordionTitle}>{title}</Text>
              <Ionicons name={openSections[id]?'chevron-up':'chevron-down'} size={20} color={RED}/>
            </TouchableOpacity>
            {!!openSections[id] && <View style={styles.accordionBody}>
              {id==='hero' && <>
                <PhotoEditor label="Fotografia principală" imageUrl={aboutContent.heroImage} loading={uploadingAboutImage==='heroImage'} disabled={!!uploadingAboutImage} onUpload={()=>uploadAboutImage('heroImage')}/>
                <Field label="Titlul de pe fotografie" value={aboutContent.heroTitle} onChangeText={v=>setAboutField('heroTitle',v)} placeholder="Titlul fotografiei"/>
              </>}
              {id==='intro' && <>
                <Field label="Prezentarea asociației" value={aboutContent.intro} onChangeText={v=>setAboutField('intro',v)} placeholder="Prezentarea asociației" multiline/>
                <Field label="Principiul 1" value={aboutContent.principleOne} onChangeText={v=>setAboutField('principleOne',v)} placeholder="Principiul 1" multiline/>
                <Field label="Principiul 2" value={aboutContent.principleTwo} onChangeText={v=>setAboutField('principleTwo',v)} placeholder="Principiul 2" multiline/>
              </>}
              {id==='mission' && <>
                <PhotoEditor label="Fotografia cu copiii" imageUrl={aboutContent.missionImage} loading={uploadingAboutImage==='missionImage'} disabled={!!uploadingAboutImage} onUpload={()=>uploadAboutImage('missionImage')}/>
                <Text style={styles.notificationHint}>Textul „Oameni pentru oameni, mâini pentru mâini și inimi pentru inimi.” este fix în pagina publică.</Text>
                <Field label="Motto" value={aboutContent.motto} onChangeText={v=>setAboutField('motto',v)} placeholder="Motto" multiline/>
              </>}
              {id==='origin' && <Field label="Originea numelui" value={aboutContent.origin} onChangeText={v=>setAboutField('origin',v)} placeholder="Originea numelui" multiline/>}
              {id==='story' && <>
                <Field label="Povestea noastră" value={aboutContent.story} onChangeText={v=>setAboutField('story',v)} placeholder="Povestea noastră" multiline/>
                <Field label="Citatul fondatorului" value={aboutContent.storyQuote} onChangeText={v=>setAboutField('storyQuote',v)} placeholder="Citatul fondatorului" multiline/>
                <Field label="Autorul citatului" value={aboutContent.storyQuoteAuthor} onChangeText={v=>setAboutField('storyQuoteAuthor',v)} placeholder="Autorul citatului"/>
              </>}
              {id==='timeline' && <>
                <Text style={styles.notificationHint}>{aboutContent.timeline.length} evenimente. Ordinea de mai jos este ordinea afișată pe pagina publică.</Text>
                {aboutContent.timeline.map((event,index)=><View key={index} style={styles.timelineEvent}>
                  <Text style={styles.accordionTitle}>Eveniment {index+1}</Text>
                  {(['year','month','title','detail'] as const).map(key=><Field key={key} label={{year:'An',month:'Lună / dată',title:'Titlu',detail:'Detalii'}[key]} value={event[key]||''} onChangeText={value=>setAboutContent(prev=>({...prev,timeline:prev.timeline.map((e,i)=>i===index?{...e,[key]:value}:e)}))} placeholder={key} multiline={key==='detail'}/>) }
                  <TouchableOpacity onPress={()=>setAboutContent(prev=>({...prev,timeline:prev.timeline.filter((_,i)=>i!==index)}))}><Text style={{color:RED,fontWeight:'800'}}>Șterge evenimentul</Text></TouchableOpacity>
                </View>)}
                <TouchableOpacity style={styles.uploadButton} onPress={()=>setAboutContent(prev=>({...prev,timeline:[...prev.timeline,{year:'',month:'',title:'',detail:''}]}))}><Text style={styles.uploadButtonText}>+ Adaugă eveniment</Text></TouchableOpacity>
              </>}
              {id==='areas' && <Field label="Unde ne implicăm" value={aboutContent.missionAreas} onChangeText={v=>setAboutField('missionAreas',v)} placeholder="Unde ne implicăm" multiline/>}
              {id==='leaders' && <>
                <Text style={styles.notificationHint}>Numele și funcțiile sunt definite în pagina publică. Aici poți modifica fotografiile.</Text>
                <PhotoEditor label="Daniel Ursachi · Fondator și Președinte" imageUrl={aboutContent.danielImage} loading={uploadingAboutImage==='danielImage'} disabled={!!uploadingAboutImage} onUpload={()=>uploadAboutImage('danielImage')}/>
                <PhotoEditor label="Emanuel Ursachi · Vicepreședinte" imageUrl={aboutContent.emanuelImage} loading={uploadingAboutImage==='emanuelImage'} disabled={!!uploadingAboutImage} onUpload={()=>uploadAboutImage('emanuelImage')}/>
              </>}
              {id==='trademark' && <>
                <Field label="Protecția mărcii" value={aboutContent.trademark} onChangeText={v=>setAboutField('trademark',v)} placeholder="Protecția mărcii" multiline/>
                <Field label="Link registru OSIM" value={aboutContent.trademarkLink} onChangeText={v=>setAboutField('trademarkLink',v)} placeholder="https://..." autoCapitalize="none"/>
              </>}
              {id==='creed' && <>
                <Field label="Introducere declarația de credință" value={aboutContent.creedIntro} onChangeText={v=>setAboutField('creedIntro',v)} placeholder="Introducere" multiline/>
                <Field label="Declarația completă de credință" value={aboutContent.creed} onChangeText={v=>setAboutField('creed',v)} placeholder="Declarația de credință" multiline/>
              </>}
            </View>}
          </View>)}
          <Text style={styles.sectionLabel}>
            ORGANIZAȚIE
          </Text>

          <View style={styles.formCard}>
            <Field
              label="Numele organizației"
              value={organizationName}
              onChangeText={setOrganizationName}
              placeholder="Misiunea Bucovina"
            />

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Field
              label="Telefon"
              value={phone}
              onChangeText={setPhone}
              placeholder="Telefon"
              keyboardType="phone-pad"
            />

            <Field
              label="Adresă"
              value={address}
              onChangeText={setAddress}
              placeholder="Adresa organizației"
              multiline
            />

            <Field
              label="Website"
              value={website}
              onChangeText={setWebsite}
              placeholder="https://..."
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.sectionLabel}>
            NOTIFICĂRI CONTACT
          </Text>

          <View style={styles.formCard}>
            <Field
              label="Email pentru notificările din Contact"
              value={notificationEmail}
              onChangeText={setNotificationEmail}
              placeholder="media@misiuneabucovina.org"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.notificationHint}>
              Aici vor fi trimise notificările despre mesajele noi din formularul Contact. Această adresă poate fi schimbată oricând.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>
            SOCIAL MEDIA
          </Text>

          <View style={styles.formCard}>
            <Field
              label="Facebook"
              value={facebookUrl}
              onChangeText={setFacebookUrl}
              placeholder="https://facebook.com/..."
              autoCapitalize="none"
            />

            <Field
              label="Instagram"
              value={instagramUrl}
              onChangeText={setInstagramUrl}
              placeholder="https://instagram.com/..."
              autoCapitalize="none"
            />

            <Field
              label="YouTube"
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
              placeholder="https://youtube.com/..."
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.saveButtonDisabled,
            ]}
            onPress={saveSettings}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={19}
                  color="#FFFFFF"
                />

                <Text style={styles.saveButtonText}>
                  Salvează modificările
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PhotoEditor({label,imageUrl,loading,disabled,onUpload}:{label:string;imageUrl:string;loading:boolean;disabled:boolean;onUpload:()=>void}) {
  return <View style={{gap:10}}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {!!imageUrl ? <Image source={{uri:imageUrl}} style={{width:'100%',height:170,borderRadius:14,backgroundColor:'#F2F2F2'}} resizeMode="cover"/> : <Text style={styles.notificationHint}>Nu este încărcată nicio fotografie.</Text>}
    <TouchableOpacity style={styles.uploadButton} onPress={onUpload} disabled={disabled}>
      <Ionicons name="cloud-upload-outline" size={18} color="#FFF"/>
      <Text style={styles.uploadButtonText}>{loading?'Se încarcă...':imageUrl?'Schimbă fotografia':'Alege și încarcă fotografia'}</Text>
    </TouchableOpacity>
  </View>;
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline = false,
}: FieldProps) {
  return (
    <View>
      <Text style={styles.fieldLabel}>
        {label}
      </Text>

      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#AAAAAA"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  accordionCard:{backgroundColor:'#FFFFFF',borderRadius:17,marginTop:10,overflow:'hidden',borderWidth:1,borderColor:'#EAE4E2'},
  accordionHeader:{paddingHorizontal:16,paddingVertical:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  accordionTitle:{fontSize:14,fontWeight:'800',color:DARK,flexShrink:1},
  accordionBody:{paddingHorizontal:16,paddingBottom:20,paddingTop:5,gap:17,borderTopWidth:1,borderTopColor:'#F0ECEA'},
  timelineEvent:{padding:13,borderWidth:1,borderColor:'#EEE',borderRadius:12,gap:10},
  uploadButton:{backgroundColor:RED,borderRadius:12,paddingHorizontal:15,paddingVertical:12,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',alignSelf:'flex-start'},
  uploadButtonText:{color:'#FFF',fontWeight:'800',fontSize:13},
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
   ...(Platform.OS === "web" ? { backgroundColor: "#F7F7F8" } : {})},

  center: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    color: '#777777',
    fontSize: 11,
    marginTop: 10,
  },

  header: {
    ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
   ...(Platform.OS === "web" ? { paddingHorizontal: 32, paddingTop: 26, paddingBottom: 22 } : {})},

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerContent: {
    flex: 1,
    marginLeft: 13,
  },

  eyebrow: {
    color: RED,
    fontSize:10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  title: {
    color: DARK,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
   ...(Platform.OS === "web" ? { fontSize: 28 } : {})},

  content: { ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 1040, alignSelf: 'center' as const } : {}),
    padding: 15,
    paddingBottom: 45,
   ...(Platform.OS === "web" ? { width: "100%", maxWidth: 1000, alignSelf: "center", paddingHorizontal: 28, paddingTop: 22, paddingBottom: 65 } : {})},

  infoCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 18,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  infoContent: {
    flex: 1,
    marginLeft: 11,
  },

  infoTitle: {
    color: DARK,
    fontSize: 12,
    fontWeight: '900',
  },

  infoText: {
    color: '#777777',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  sectionLabel: {
    color: '#999999',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 24,
    marginBottom: 9,
    marginLeft: 5,
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 15,
    gap: 16,
   ...(Platform.OS === "web" ? { borderRadius: 18, padding: 28 } : {})},

  fieldLabel: {
    color: DARK,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 7,
  },

  input: {
    minHeight: 48,
    backgroundColor: '#F7F7F7',
    borderRadius: 13,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 11,
  },

  notificationHint: {
    color: '#777777',
    fontSize: 10,
    lineHeight: 16,
  },

  multilineInput: {
    minHeight: 85,
    paddingTop: 13,
    paddingBottom: 13,
  },

  saveButton: {
    minHeight: 55,
    backgroundColor: RED,
    borderRadius: 16,
    marginTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});