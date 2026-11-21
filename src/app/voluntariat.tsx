import MisiBiPageHeader from '../components/MisiBiPageHeader';
import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { defaultVolunteerPage, loadVolunteerPage, volunteerImageUrl } from '../lib/volunteer-page';
import { KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ImageBackground,
  Image,
  Linking,
  Modal,
  useWindowDimensions,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const COUNTRIES: string[] = ["Afghanistan", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgia", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia, Plurinational State of", "Bonaire, Sint Eustatius and Saba", "Bosnia and Herzegovina", "Botswana", "Bouvet Island", "Brazil", "British Indian Ocean Territory", "Brunei Darussalam", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo", "Congo, The Democratic Republic of the", "Cook Islands", "Costa Rica", "Croatia", "Cuba", "Curaçao", "Cyprus", "Czechia", "Côte d'Ivoire", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Elveția", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Falkland Islands (Malvinas)", "Faroe Islands", "Fiji", "Finland", "Franța", "French Guiana", "French Polynesia", "French Southern Territories", "Gabon", "Gambia", "Georgia", "Germania", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guernsey", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Heard Island and McDonald Islands", "Holy See (Vatican City State)", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran, Islamic Republic of", "Iraq", "Irlanda", "Isle of Man", "Israel", "Italia", "Jamaica", "Japan", "Jersey", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, Democratic People's Republic of", "Korea, Republic of", "Kuwait", "Kyrgyzstan", "Lao People's Democratic Republic", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico", "Micronesia, Federated States of", "Monaco", "Mongolia", "Montenegro", "Montserrat", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue", "Norfolk Island", "North Macedonia", "Northern Mariana Islands", "Norway", "Oman", "Pakistan", "Palau", "Palestine, State of", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Pitcairn", "Polonia", "Portugal", "Puerto Rico", "Qatar", "Regatul Unit", "Republica Moldova", "România", "Russian Federation", "Rwanda", "Réunion", "Saint Barthélemy", "Saint Helena, Ascension and Tristan da Cunha", "Saint Kitts and Nevis", "Saint Lucia", "Saint Martin (French part)", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Sint Maarten (Dutch part)", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Georgia and the South Sandwich Islands", "South Sudan", "Spania", "Sri Lanka", "Statele Unite ale Americii", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Sweden", "Syrian Arab Republic", "Taiwan, Province of China", "Tajikistan", "Tanzania, United Republic of", "Thailand", "Timor-Leste", "Togo", "Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkmenistan", "Turks and Caicos Islands", "Tuvalu", "Türkiye", "Ucraina", "Uganda", "United Arab Emirates", "United States Minor Outlying Islands", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela, Bolivarian Republic of", "Viet Nam", "Virgin Islands, British", "Virgin Islands, U.S.", "Wallis and Futuna", "Western Sahara", "Yemen", "Zambia", "Zimbabwe", "Åland Islands", "Țările de Jos"];
// CountriesNow furnizează subdiviziunile și orașele în funcție de selecția anterioară.
// Dacă serviciul nu răspunde, câmpurile rămân completabile manual.
const GEO_COUNTRY_NAMES: Record<string, string> = {
  'România': 'Romania', 'Republica Moldova': 'Moldova',
  'Statele Unite ale Americii': 'United States', 'Regatul Unit': 'United Kingdom',
  'Germania': 'Germany', 'Franța': 'France', 'Italia': 'Italy',
  'Spania': 'Spain', 'Elveția': 'Switzerland', 'Belgia': 'Belgium',
  'Țările de Jos': 'Netherlands', 'Irlanda': 'Ireland', 'Polonia': 'Poland',
  'Ucraina': 'Ukraine',
};
const geoCountry = (name: string) => GEO_COUNTRY_NAMES[name] || name;
const GEO_API = 'https://countriesnow.space/api/v0.1/countries';

const PHOTO_BUCKET = 'volunteer-profile-photos';
const PHOTO_MAX_BYTES = 12 * 1024 * 1024;
// Conversie base64 -> Uint8Array, compatibilă cu React Native și web.
function decodeBase64(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  let buffer = 0, bits = 0;
  for (const char of clean) {
    buffer = (buffer << 6) | alphabet.indexOf(char);
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); }
  }
  return new Uint8Array(bytes);
}

const MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];


export default function VoluntariatScreen() {
  const { width: viewportWidth } = useWindowDimensions();
  const compact = viewportWidth < 740;
  const [page, setPage] = useState(defaultVolunteerPage);
  useEffect(() => { let active = true; loadVolunteerPage().then(v => { if(active) setPage(v); }).catch(e => console.warn('Voluntariat: configurarea nu a fost încărcată', e)); return () => {active = false}; }, []);
  const [name, setName] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [picker, setPicker] = useState<'country' | 'region' | 'city' | 'day' | 'month' | 'year' | 'involvement' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const birthDate = birthYear && birthMonth && birthDay ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}` : '';
  const birthDays = birthYear && birthMonth ? new Date(Number(birthYear), Number(birthMonth), 0).getDate() : 31;
  const pickerOptions = picker === 'country' ? COUNTRIES : picker === 'region' ? regions : picker === 'city' ? cities : picker === 'day' ? Array.from({length: birthDays}, (_, i) => String(i + 1)) : picker === 'month' ? MONTHS : picker === 'year' ? Array.from({length: 110}, (_, i) => String(new Date().getFullYear() - i)) : picker === 'involvement' ? page.involvement_options : [];
  const filteredPickerOptions = pickerOptions.filter(v => v.toLocaleLowerCase().includes(pickerSearch.toLocaleLowerCase()));
  function openPicker(which: 'country' | 'region' | 'city' | 'day' | 'month' | 'year' | 'involvement') { setPickerSearch(''); setPicker(which); }
  function selectPicker(value: string) {
    if (picker === 'involvement') { toggleOption(value); return; }
    if (picker === 'country') { setCountry(value); setRegion(''); setCity(''); setRegions([]); setCities([]); }
    if (picker === 'region') { setRegion(value); setCity(''); setCities([]); }
    if (picker === 'city') setCity(value);
    if (picker === 'day') setBirthDay(value);
    if (picker === 'month') { const next = String(MONTHS.indexOf(value) + 1); setBirthMonth(next); if (birthDay && Number(birthDay) > new Date(Number(birthYear || 2024), Number(next), 0).getDate()) setBirthDay(''); }
    if (picker === 'year') { setBirthYear(value); if (birthDay && birthMonth && Number(birthDay) > new Date(Number(value), Number(birthMonth), 0).getDate()) setBirthDay(''); }
    setPicker(null);
  }
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [regionFetchFailed, setRegionFetchFailed] = useState(false);
  const [cityFetchFailed, setCityFetchFailed] = useState(false);
  useEffect(() => {
    if (!country) return;
    let cancelled = false;
    setLoadingRegions(true); setRegionFetchFailed(false);
    void fetch(`${GEO_API}/states`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({country: geoCountry(country)}),
    }).then(r => {if (!r.ok) throw new Error('regions'); return r.json();})
      .then(result => {
        if (cancelled) return;
        const values: string[] = (result?.data?.states || []).map((item: {name: string}) => item.name).filter(Boolean);
        setRegions([...new Set(values)].sort((a,b) => a.localeCompare(b, 'ro')));
        setRegionFetchFailed(!values.length);
      }).catch(() => {if (!cancelled) {setRegions([]); setRegionFetchFailed(true);}})
      .finally(() => {if (!cancelled) setLoadingRegions(false);});
    return () => {cancelled = true;};
  }, [country]);
  useEffect(() => {
    if (!country || !region) return;
    let cancelled = false;
    setLoadingCities(true); setCityFetchFailed(false);
    void fetch(`${GEO_API}/state/cities`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({country: geoCountry(country), state: region}),
    }).then(r => {if (!r.ok) throw new Error('cities'); return r.json();})
      .then(result => {
        if (cancelled) return;
        const values: string[] = Array.isArray(result?.data) ? result.data.filter((v: unknown): v is string => typeof v === 'string') : [];
        setCities([...new Set(values)].sort((a,b) => a.localeCompare(b, 'ro')));
        setCityFetchFailed(!values.length);
      }).catch(() => {if (!cancelled) {setCities([]); setCityFetchFailed(true);}})
      .finally(() => {if (!cancelled) setLoadingCities(false);});
    return () => {cancelled = true;};
  }, [country, region]);

  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [confirmedCorrect, setConfirmedCorrect] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [otherInvolvement, setOtherInvolvement] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<{uri: string; base64: string; mimeType: string; bytes: number} | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  async function chooseProfilePhoto() {
    try {
      setPhotoLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, base64: true, quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        Alert.alert('Format neacceptat', 'Alege o fotografie JPG, PNG sau WEBP.'); return;
      }
      if (asset.fileSize && asset.fileSize > PHOTO_MAX_BYTES) {
        Alert.alert('Fotografie prea mare', 'Dimensiunea maximă este 12 MB.'); return;
      }
      if (asset.width * asset.height > 24_000_000) {
        Alert.alert('Fotografie prea mare', 'Fotografia poate avea maximum 24 megapixeli.'); return;
      }
      // Optimizăm la maximum 1600 px pentru profil, înainte de upload.
      const width = Math.min(1600, asset.width || 1600);
      const optimized = await ImageManipulator.manipulateAsync(asset.uri,
        asset.width > 1600 ? [{resize: {width}}] : [],
        {compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true});
      if (!optimized.base64) throw new Error('Nu s-a putut prelucra fotografia.');
      const bytes = decodeBase64(optimized.base64).length;
      if (bytes > PHOTO_MAX_BYTES) throw new Error('Fotografia optimizată depășește 12 MB.');
      setProfilePhoto({uri: optimized.uri, base64: optimized.base64, mimeType: 'image/jpeg', bytes});
    } catch (error) {
      Alert.alert('Fotografie', error instanceof Error ? error.message : 'Nu am putut selecta fotografia.');
    } finally { setPhotoLoading(false); }
  }
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function toggleOption(option: string) {
    setSelectedOptions((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  }

  async function submitForm() {
  if (!name.trim()) {
    Alert.alert(
      'Câmp obligatoriu',
      'Te rugăm să introduci numele și prenumele.'
    );
    return;
  }

  if (!country.trim() || !birthDate.trim() || !region.trim() || !city.trim() || !street.trim()) {
    Alert.alert('Câmpuri obligatorii', 'Completează data nașterii, țara, județul/regiunea, localitatea și strada.');
    return;
  }

  if (!phone.trim()) {
    Alert.alert(
      'Câmp obligatoriu',
      'Te rugăm să introduci numărul de WhatsApp.'
    );
    return;
  }

  if (!email.trim()) {
    Alert.alert(
      'Câmp obligatoriu',
      'Te rugăm să introduci adresa de email.'
    );
    return;
  }

  if (selectedOptions.length === 0) {
    Alert.alert(
      'Alege o opțiune',
      'Selectează cel puțin un domeniu în care dorești să te implici.'
    );
    return;
  }

  if (selectedOptions.includes('Altele') && !otherInvolvement.trim()) {
    Alert.alert('Câmp obligatoriu', 'Te rugăm să precizezi cum dorești să te implici.');
    return;
  }

  if (!confirmedCorrect) {
    Alert.alert('Confirmare necesară', 'Confirmă că informațiile introduse sunt corecte.');
    return;
  }

  if (!accepted) {
    Alert.alert(
      'Acord necesar',
      'Trebuie să accepți acordul înainte de a trimite formularul.'
    );
    return;
  }

  if (submitting) {
    return;
  }

  setSubmitting(true);

  let photoPath: string | null = null;
  if (profilePhoto) {
    photoPath = `${Date.now()}-${Math.random().toString(36).slice(2, 14)}.jpg`;
    const {error: uploadError} = await supabase.storage.from(PHOTO_BUCKET)
      .upload(photoPath, decodeBase64(profilePhoto.base64), {contentType: profilePhoto.mimeType, upsert: false});
    if (uploadError) {
      setSubmitting(false);
      Alert.alert('Eroare fotografie', 'Fotografia nu a putut fi încărcată. Încearcă din nou.');
      console.warn('Încărcare fotografie voluntar:', uploadError);
      return;
    }
  }
  const { error } = await supabase
    .from('volunteer_applications')
    .insert({
      name: name.trim(),
      profile_photo_path: photoPath,
      birth_date: birthDate.trim() || null,
      country: country.trim() || null,
      city: city.trim() || null,
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      message: [
        `Adresă: ${street.trim()}${building.trim() ? ', ' + building.trim() : ''}, ${city.trim()}, ${region.trim()}, ${country.trim()}${postalCode.trim() ? ', cod poștal ' + postalCode.trim() : ''}`,
        message.trim(),
        selectedOptions.includes('Altele') ? `Altele – cum dorește să se implice: ${otherInvolvement.trim()}` : '',
      ].filter(Boolean).join('\n\n'),
      involvement_options: selectedOptions,
      status: 'new',
    });

  setSubmitting(false);

  if (error) {
    if (photoPath) void supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    console.log(
      'Eroare trimitere voluntariat:',
      error
    );

    Alert.alert(
      'Eroare',
      'Înscrierea nu a putut fi trimisă. Te rugăm să încerci din nou.'
    );

    return;
  }

  setSubmitted(true);
  Alert.alert(
    'Înscriere trimisă!',
    'Mulțumim pentru dorința de a te implica. Echipa Misiunii Bucovina te va putea contacta folosind informațiile trimise.'
  );

  setName('');
  setBirthDay('');
  setBirthMonth('');
  setBirthYear('');
  setCountry('');
  setCity('');
  setRegion('');
  setStreet('');
  setBuilding('');
  setPostalCode('');
  setConfirmedCorrect(false);
  setPhone('');
  setEmail('');
  setMessage('');
  setSelectedOptions([]);
  setOtherInvolvement('');
  setProfilePhoto(null);
  setAccepted(false);
}

  return (
    <SafeAreaView style={styles.screen}>
      {/* HEADER */}
      <MisiBiPageHeader title={page.hero_title} eyebrow="MISIUNEA BUCOVINA" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
        >
          {/* Prezentare inspirată de pagina oficială; formularul și salvarea rămân neschimbate. */}
          <View style={styles.siteHero}>
            {!!page.hero_image?.trim() && (
              <Image
                source={{ uri: volunteerImageUrl(page.hero_image) }}
                resizeMode="cover"
                style={[styles.siteHeroImage, compact && styles.siteHeroImageMobile]}
                accessibilityLabel="Echipa de voluntari Misiunea Bucovina"
              />
            )}
            <Text style={styles.siteHeroCaption}>{page.hero_subtitle}</Text>
          </View>

          <View style={styles.introSection}>
            <Text style={styles.kicker}>{page.intro_eyebrow}</Text>
            <Text style={styles.introTitle}>{page.intro_title}</Text>
            <Text style={styles.introBody}>{page.intro_body}</Text>
            <View style={styles.benefitGrid}>
              {page.benefits.map(item => (
                <View key={item.title} style={[styles.benefitCard, compact && (viewportWidth < 340 ? styles.benefitCardNarrow : styles.benefitCardMobile)]}>
                  <View style={[styles.benefitIcon, compact && styles.benefitIconMobile]}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={compact ? 21 : 23} color={RED}/></View>
                  <Text style={[styles.benefitTitle, compact && styles.benefitTitleMobile]}>{item.title}</Text>
                  <Text style={[styles.benefitDescription, compact && styles.benefitDescriptionMobile]}>{item.description}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.unifiedForm, compact && styles.unifiedFormMobile]}>
            <View style={styles.formIntroUnified}>
              <Text style={[styles.formBannerTitle, compact && styles.formBannerTitleMobile]}>{page.form_banner_title}</Text>
              <Text style={[styles.formBannerSubtitle, compact && styles.formBannerSubtitleMobile]}>{page.form_banner_subtitle}</Text>
              <Ionicons name="people" size={30} color={RED} style={styles.formBannerIcon} />
              <Text style={[styles.formHeading, compact && styles.formHeadingMobile]}>{page.form_title}</Text>
              <Text style={styles.formHeadingDescription}>{page.form_description}</Text>
            </View>
            {submitted && <View style={styles.successBox}><Ionicons name="checkmark-circle" size={22} color="#147D50"/><Text style={styles.successText}>Înscrierea ta a fost trimisă cu succes. Îți mulțumim!</Text></View>}

            <View style={styles.formStep}>
              <StepTitle number={1} title="DESPRE TINE" />
              <FormInput label="Nume și prenume" placeholder="Ex: Popescu Ion" icon="person-outline" value={name} onChangeText={setName} required />
              <View style={[styles.formRow, compact && styles.formRowMobile]}>
                <View style={styles.formCol}><Text style={styles.label}>Țara <Text style={styles.required}>*</Text></Text><PickerField label={country || "Alege țara"} placeholder={!country} onPress={() => openPicker("country")} /></View>
                <View style={styles.formCol}><FormInput label="Număr WhatsApp" placeholder="+40..." icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" required /></View>
              </View>
              <FormInput label="Email" placeholder="nume@email.com" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" required />
              <Text style={styles.label}>Data nașterii <Text style={styles.required}>*</Text></Text>
              <View style={styles.dobRow}>
                <View style={styles.dobCol}><PickerField label={birthDay || "Ziua"} placeholder={!birthDay} onPress={() => openPicker("day")} /></View>
                <View style={styles.dobCol}><PickerField label={birthMonth ? MONTHS[Number(birthMonth)-1] : "Luna"} placeholder={!birthMonth} onPress={() => openPicker("month")} /></View>
                <View style={styles.dobCol}><PickerField label={birthYear || "Anul"} placeholder={!birthYear} onPress={() => openPicker("year")} /></View>
              </View>
              <Text style={styles.formHint}>Ca să îți putem ura „La mulți ani” de ziua ta 🎂</Text>
            </View>

            <View style={styles.formStep}>
              <StepTitle number={2} title="UNDE LOCUIEȘTI" />
              <View style={[styles.formRow, compact && styles.formRowMobile]}>
                <View style={styles.formCol}>
                  <Text style={styles.label}>Județ / Regiune <Text style={styles.required}>*</Text></Text>
                  {country && !regionFetchFailed ? <PickerField label={region || (loadingRegions ? 'Se încarcă județele...' : 'Alege județul / regiunea')} placeholder={!region} onPress={() => {if (!loadingRegions) openPicker('region');}} /> : <FormInput label="" placeholder={country ? 'Scrie județul / regiunea' : 'Selectează întâi țara'} icon="location-outline" value={region} onChangeText={v => {setRegion(v); setCity('');}} required />}
                </View>
                <View style={styles.formCol}>
                  <Text style={styles.label}>Localitate / Oraș <Text style={styles.required}>*</Text></Text>
                  {region && !cityFetchFailed ? <PickerField label={city || (loadingCities ? 'Se încarcă localitățile...' : 'Alege localitatea / orașul')} placeholder={!city} onPress={() => {if (!loadingCities) openPicker('city');}} /> : <FormInput label="" placeholder={region ? 'Scrie localitatea / orașul' : 'Selectează întâi județul'} icon="business-outline" value={city} onChangeText={setCity} required />}
                </View>
              </View>
              <FormInput label="Stradă, Nr." placeholder="Strada și numărul" icon="navigate-outline" value={street} onChangeText={setStreet} required />
              <View style={[styles.formRow, compact && styles.formRowMobile]}>
                <View style={styles.formCol}><FormInput label="Bloc / Scară / Etaj / Ap." placeholder="Opțional" icon="home-outline" value={building} onChangeText={setBuilding} /></View>
                <View style={styles.formCol}><FormInput label="Cod poștal (opțional)" placeholder="Cod poștal" icon="mail-outline" value={postalCode} onChangeText={setPostalCode} /></View>
              </View>
            </View>

            <View style={styles.formStep}>
              <StepTitle number={3} title="CUM VREI SĂ AJUȚI" />
              <Text style={styles.label}>Cu ce ai vrea să te implici? <Text style={styles.required}>*</Text></Text>
              <PickerField
                label={selectedOptions.length ? selectedOptions.join(', ') : 'Alege una sau mai multe variante'}
                placeholder={selectedOptions.length === 0}
                onPress={() => openPicker('involvement')}
              />
              {selectedOptions.length > 0 && <Text style={styles.formHint}>{selectedOptions.length} {selectedOptions.length === 1 ? 'opțiune selectată' : 'opțiuni selectate'}. Apasă pe bară pentru modificare.</Text>}
              {selectedOptions.includes('Altele') && <View style={{marginTop: 16}}>
                <Text style={styles.label}>Cum ai dori să te implici? <Text style={styles.required}>*</Text></Text>
                <TextInput style={[styles.messageInput, styles.otherInput]} placeholder="Descrie cum ai dori să ajuți..." placeholderTextColor="#999999" value={otherInvolvement} onChangeText={setOtherInvolvement} multiline textAlignVertical="top" />
              </View>}
              <View style={styles.profilePhotoBox}>
                <Text style={styles.label}>Fotografie de profil <Text style={{color:'#64748B'}}>(opțional)</Text></Text>
                <Text style={styles.photoHelp}>Poți încărca o fotografie clară, tip portret. Formate acceptate: JPG, PNG sau WEBP, maximum 12 MB și 24 megapixeli. Fotografiile mari sunt micșorate și optimizate automat înainte de trimitere.</Text>
                <TouchableOpacity style={styles.photoChoose} onPress={chooseProfilePhoto} disabled={photoLoading} accessibilityRole="button">
                  <View style={styles.photoChooseButton}><Text style={styles.photoChooseButtonText}>{photoLoading ? 'Se pregătește...' : 'Choose file'}</Text></View>
                  <Text style={styles.photoFileName} numberOfLines={1}>{profilePhoto ? 'Fotografie selectată' : 'No file chosen'}</Text>
                </TouchableOpacity>
                {profilePhoto && <View style={styles.photoPreviewRow}>
                  <Image source={{uri: profilePhoto.uri}} style={styles.photoPreview} />
                  <TouchableOpacity onPress={() => setProfilePhoto(null)} style={styles.photoRemove}>
                    <Ionicons name="trash-outline" size={17} color={RED}/><Text style={{color:RED,fontWeight:'700'}}>Elimină fotografia</Text>
                  </TouchableOpacity>
                </View>}
              </View>
              <View style={styles.optionalMessage}>
                <Text style={styles.label}>Mesaj suplimentar (opțional)</Text>
                <TextInput style={[styles.messageInput, styles.otherInput]} placeholder="Spune-ne mai multe despre tine..." placeholderTextColor="#999999" value={message} onChangeText={setMessage} multiline textAlignVertical="top" />
              </View>
            </View>

            <View style={styles.formStep}>
              <StepTitle number={4} title="CONFIRMARE" />
              <TouchableOpacity style={styles.agreement} accessibilityRole="checkbox" accessibilityState={{checked: confirmedCorrect}} onPress={() => setConfirmedCorrect(!confirmedCorrect)}>
                <View style={[styles.agreementCheckbox, confirmedCorrect && styles.agreementCheckboxSelected]}>{confirmedCorrect && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}</View>
                <Text style={styles.agreementText}>Da, am verificat că informațiile introduse sunt corecte.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.agreement} accessibilityRole="checkbox" accessibilityState={{checked: accepted}} onPress={() => setAccepted(!accepted)}>
                <View style={[styles.agreementCheckbox, accepted && styles.agreementCheckboxSelected]}>{accepted && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}</View>
                <Text style={styles.agreementText}>{page.consent_text}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} activeOpacity={0.85} onPress={submitForm} disabled={submitting}>
                <Text style={styles.submitText}>{submitting ? 'Se trimite...' : page.submit_label}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.storySections}>
            {page.story_sections.map((section, index) => (
              <View key={index} style={[styles.storyRow, compact && styles.storyRowMobile]}>
                <View style={styles.storyCopy}>
                  <Text style={styles.storyEyebrow}>{section.eyebrow}</Text>
                  <Text style={styles.storyHeading}>{section.title}</Text>
                  {!!section.description && <Text style={styles.storyParagraph}>{section.description}</Text>}
                  {section.bullets.map((item, i) => <View key={i} style={styles.storyBulletRow}>
                    <Ionicons name="checkmark-circle" size={19} color={RED} style={{ marginTop: 2 }} />
                    <Text style={styles.storyBulletText}>{item}</Text>
                  </View>)}
                  {!!section.button_text && !!section.button_link && <TouchableOpacity accessibilityRole="link" style={styles.storyButton} onPress={() => {
                    // Rutele publice sunt fixe, indiferent de linkurile salvate anterior în Supabase.
                     const target = section.title.toLocaleLowerCase('ro');
                     if (target.includes('voluntarii noștri') || target.includes('voluntarii nostri')) {
                       router.push('/voluntarii-nostri');
                     } else if (section.button_text.toLocaleLowerCase('ro').includes('ziua anuală a voluntarului')) {
                       router.push('/ziua-voluntarului');
                     } else if (/^https?:\/\//i.test(section.button_link)) {
                       Linking.openURL(section.button_link);
                     } else if (section.button_link.startsWith('/') && !section.button_link.startsWith('/admin/')) {
                       router.push(section.button_link as any);
                     }
                  }}>
                    <Text style={styles.storyButtonText}>{section.button_text}</Text>
                    <Ionicons name="arrow-forward" color="#FFFFFF" size={17} />
                  </TouchableOpacity>}
                </View>
                {!!section.image?.trim() && (
                  <Image source={{ uri: volunteerImageUrl(section.image) }}
                    resizeMode="cover" style={[styles.storyPhoto, compact && styles.storyPhotoMobile]} />
                )}
              </View>
            ))}
          </View>

          <View style={styles.security}>
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color="#888888"
            />

            <Text style={styles.securityText}>
              {page.privacy_text}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerDialog}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerHeading}>{picker === 'country' ? 'Alege țara' : picker === 'region' ? 'Alege județul / regiunea' : picker === 'city' ? 'Alege localitatea / orașul' : picker === 'day' ? 'Alege ziua' : picker === 'month' ? 'Alege luna' : picker === 'involvement' ? 'Alege una sau mai multe variante' : 'Alege anul'}</Text>
              <TouchableOpacity onPress={() => setPicker(null)} accessibilityLabel="Închide"><Ionicons name="close" size={25} color="#FFFFFF" /></TouchableOpacity>
            </View>
            {(picker === 'country' || picker === 'region' || picker === 'city' || picker === 'involvement') && <TextInput style={styles.pickerSearch} placeholder={picker === 'country' ? 'Caută țara...' : picker === 'region' ? 'Caută județul...' : picker === 'involvement' ? 'Caută o activitate...' : 'Caută localitatea...'} placeholderTextColor="#777" value={pickerSearch} onChangeText={setPickerSearch} autoCapitalize="none" />}
            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="always">
              {(picker === 'region' || picker === 'city') && filteredPickerOptions.length === 0 && <Text style={{color:'#FFFFFF', padding: 20}}>Nu există rezultate. Închide lista și completează manual dacă serviciul nu oferă această localitate.</Text>}
              {filteredPickerOptions.map(v => <TouchableOpacity key={v} accessibilityRole={picker === 'involvement' ? 'checkbox' : 'button'} accessibilityState={picker === 'involvement' ? {checked: selectedOptions.includes(v)} : undefined} style={[styles.pickerOption, picker === 'involvement' && selectedOptions.includes(v) && styles.pickerOptionActive]} onPress={() => selectPicker(v)}><Text style={styles.pickerOptionText}>{v}</Text>{picker === 'involvement' ? <View style={[styles.pickerCheckbox, selectedOptions.includes(v) && styles.pickerCheckboxActive]}>{selectedOptions.includes(v) && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}</View> : <Ionicons name="chevron-forward" size={17} color="#CCCCCC" />}</TouchableOpacity>)}
            </ScrollView>
            <TouchableOpacity style={styles.pickerDone} onPress={() => setPicker(null)}><Text style={styles.pickerDoneText}>Gata</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PickerField({label, placeholder, onPress}: {label: string; placeholder: boolean; onPress: () => void}) {
  return <TouchableOpacity accessibilityRole="button" style={styles.pickerField} onPress={onPress}>
    <Text numberOfLines={1} style={[styles.pickerFieldText, placeholder && {color: '#777777'}]}>{label}</Text>
    <Ionicons name="chevron-down" size={18} color="#555555" />
  </TouchableOpacity>;
}

function StepTitle({number, title}: {number: number; title: string}) {
  return <View style={styles.stepHeading}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View><Text style={styles.stepTitle}>{title}</Text></View>;
}

type FormInputProps = {
  label: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (text: string) => void;
  required?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

function FormInput({
  label,
  placeholder,
  icon,
  value,
  onChangeText,
  required = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: FormInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>
        {label}
        {required && (
          <Text style={styles.required}> *</Text>
        )}
      </Text>

      <View style={styles.inputContainer}>
        <Ionicons
          name={icon}
          size={20}
          color="#888888"
        />

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#AAAAAA"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dobRow: {flexDirection: 'row', gap: 8, marginBottom: 8},
  dobCol: {flex: 1, minWidth: 0},
  pickerField: {minHeight: 49, borderWidth: 1, borderColor: '#DDD6D2', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 14},
  pickerFieldText: {flex: 1, fontSize: 14, color: '#171717'},
  pickerOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 16},
  pickerDialog: {width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: '#29292D', borderRadius: 22, overflow: 'hidden', paddingBottom: 12},
  pickerHeader: {padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#48484B'},
  pickerHeading: {color: '#FFFFFF', fontWeight: '800', fontSize: 21},
  pickerSearch: {margin: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFF', color: '#171717'},
  pickerScroll: {flexGrow: 0},
  pickerOption: {paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#46464A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  pickerOptionActive: {backgroundColor: '#39393F'},
  pickerCheckbox: {width: 23, height: 23, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginLeft: 12},
  pickerCheckboxActive: {backgroundColor: RED, borderColor: RED},
  pickerOptionText: {color: '#FFFFFF', fontSize: 16, fontWeight: '700', flex: 1},
  pickerDone: {backgroundColor: '#A61E22', padding: 14, marginHorizontal: 12, marginTop: 12, borderRadius: 12, alignItems: 'center'},
  pickerDoneText: {color: '#FFFFFF', fontWeight: '800'},
  unifiedForm: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#EAE5E2', padding: 28, marginTop: 20, marginBottom: 28 },
  unifiedFormMobile: { padding: 16, borderRadius: 18 },
  formIntroUnified: { alignItems: 'center', paddingTop: 12, paddingBottom: 28 },
  formStep: { borderTopWidth: 1, borderTopColor: '#EEE6E2', paddingTop: 20, paddingBottom: 12 },
  stepHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  stepNumber: { width: 27, height: 27, borderRadius: 14, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  stepTitle: { color: RED, fontSize: 13, fontWeight: '900', letterSpacing: 0.7 },
  formRow: { flexDirection: 'row', gap: 14 },
  formRowMobile: { flexDirection: 'column', gap: 0 },
  formCol: { flex: 1, minWidth: 0 },
  formHint: { fontSize: 12, color: '#777777', marginBottom: 14 },
  otherInput: { borderWidth: 1, borderColor: '#DDD6D2', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 14, minHeight: 92 },
  optionalMessage: { marginTop: 20 },
  screen: {
    flex: 1,
    backgroundColor: '#F6F6F6',
  },

  keyboard: {
    flex: 1,
  },

  header: {
    height: 58,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '800',
  },

  headerSpace: {
    width: 42,
  },

  content: { maxWidth: 1120, width: '100%', alignSelf: 'center',
    padding: 15,
    paddingBottom: 40,
  },


  heroImage: { opacity: 0.55 },
  heroOverlay: { backgroundColor: 'rgba(40,16,17,0.58)', paddingVertical: 44, paddingHorizontal: 30, borderRadius: 23, minHeight: 330, justifyContent: 'center' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 },
  heroBadgeText: { color: '#FFFFFF', fontSize: 10, letterSpacing: 1.7, fontWeight: '900' },
  heroAction: { marginTop: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 12 },
  heroActionText: { color: RED, fontWeight: '800', fontSize: 13 },
  introSection: { paddingTop: 34, paddingBottom: 18 },
  kicker: { color: RED, fontWeight: '900', fontSize: 10, letterSpacing: 1.4, marginBottom: 9 },
  introTitle: { fontSize: 25, fontWeight: '900', color: DARK, marginBottom: 10 },
  introBody: { fontSize: 14, lineHeight: 23, color: '#606060', marginBottom: 20 },
  benefitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  benefitCard: { flexGrow: 1, flexBasis: 220, backgroundColor: '#FFFFFF', padding: 20, borderRadius: 18, minWidth: 200 },
  benefitCardMobile: { flexGrow: 0, flexBasis: '47%', minWidth: 0, padding: 14, borderRadius: 16 },
  benefitCardNarrow: { flexGrow: 1, flexBasis: '100%', minWidth: 0, padding: 16 },
  benefitIconMobile: { width: 40, height: 40, borderRadius: 12, marginBottom: 12 },
  benefitTitleMobile: { fontSize: 14, lineHeight: 19 },
  benefitDescriptionMobile: { fontSize: 11, lineHeight: 16 },
  benefitIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  benefitTitle: { fontSize: 16, fontWeight: '900', color: DARK, marginBottom: 6 },
  benefitDescription: { fontSize: 12, color: '#666666', lineHeight: 19 },
  formIntro: { marginTop: 20, paddingHorizontal: 4 },
  formIntroCard: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#ECECEC', paddingVertical: 36, paddingHorizontal: 22, alignItems: 'center', marginBottom: 14 },
  formIntroCardMobile: { paddingVertical: 27, paddingHorizontal: 16, borderRadius: 17 },
  formBannerTitle: { fontSize: 30, lineHeight: 39, fontWeight: '800', color: '#343434', textAlign: 'center', maxWidth: 530 },
  formBannerTitleMobile: { fontSize: 24, lineHeight: 32 },
  formBannerSubtitle: { fontSize: 18, lineHeight: 27, color: '#454545', textAlign: 'center', marginTop: 16, maxWidth: 720 },
  formBannerSubtitleMobile: { fontSize: 15, lineHeight: 23, marginTop: 12 },
  formBannerIcon: { marginTop: 30, marginBottom: 16 },
  formHeading: { fontSize: 27, fontWeight: '800', color: DARK, textAlign: 'center' },
  formHeadingMobile: { fontSize: 23 },
  formHeadingDescription: { fontSize: 14, lineHeight: 22, color: '#606060', textAlign: 'center', marginTop: 9, maxWidth: 720 },
  successBox: { flexDirection: 'row', gap: 10, backgroundColor: '#EAF8F0', borderRadius: 14, padding: 16, alignItems: 'center' },
  successText: { color: '#147D50', fontWeight: '700', flex: 1 },
  hero: {
    backgroundColor: '#4B2628',
    borderRadius: 23,
    overflow: 'hidden',
  },

  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  heroSmall: {
    color: '#FFFFFF',
    opacity: 0.75,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 35,
    fontWeight: '900',
    lineHeight: 42,
    maxWidth: 650,
    marginTop: 5,
  },

  heroText: {
    color: '#FFFFFF',
    opacity: 0.9,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 620,
    marginTop: 8,
  },

  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 13,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 19,
  },

  headingContent: {
    flex: 1,
  },

  number: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  numberText: {
    color: RED,
    fontSize: 14,
    fontWeight: '900',
  },

  sectionTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '900',
  },

  sectionSubtitle: {
    color: '#888888',
    fontSize: 10,
    marginTop: 2,
  },

  inputGroup: {
    marginBottom: 15,
  },

  label: {
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 7,
  },

  required: {
    color: RED,
  },

  inputContainer: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },

  input: {
    flex: 1,
    color: DARK,
    fontSize: 13,
    marginLeft: 10,
  },

  options: {
    gap: 8,
  },

  option: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 13,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },

  optionSelected: {
    borderColor: RED,
    backgroundColor: '#FFF5F5',
  },

  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkboxSelected: {
    borderColor: RED,
    backgroundColor: RED,
  },

  optionText: {
    color: '#555555',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
  },

  optionTextSelected: {
    color: RED,
  },

  messageInputContainer: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 13,
    backgroundColor: '#FAFAFA',
    padding: 13,
  },

  messageInput: {
    minHeight: 100,
    color: DARK,
    fontSize: 13,
    lineHeight: 19,
  },

  agreement: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 16,
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  agreementCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  agreementCheckboxSelected: {
    backgroundColor: RED,
    borderColor: RED,
  },

  agreementText: {
    flex: 1,
    color: '#666666',
    fontSize: 10,
    lineHeight: 16,
  },

  profilePhotoBox: {backgroundColor:'#F7F9FC',borderWidth:1,borderColor:'#D5DEE9',borderRadius:16,padding:18,marginTop:18,marginBottom:10},
  photoHelp: {fontSize:12,color:'#40526A',lineHeight:19,marginBottom:12},
  photoChoose: {borderWidth:1,borderColor:'#CBD5E1',borderRadius:11,backgroundColor:'#FFFFFF',padding:9,flexDirection:'row',alignItems:'center',gap:10},
  photoChooseButton: {backgroundColor:'#A10E12',borderRadius:9,paddingHorizontal:15,paddingVertical:11},
  photoChooseButtonText: {color:'#FFFFFF',fontWeight:'800',fontSize:13},
  photoFileName: {fontSize:12,color:'#1F2937',flexShrink:1},
  photoPreviewRow: {flexDirection:'row',alignItems:'center',gap:16,marginTop:14},
  photoPreview: {width:90,height:90,borderRadius:10,backgroundColor:'#E2E8F0'},
  photoRemove: {flexDirection:'row',alignItems:'center',gap:6},
  submitButton: {
    backgroundColor: RED,
    minHeight: 56,
    borderRadius: 15,
    paddingHorizontal: 18,
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  security: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 13,
    paddingHorizontal: 20,
  },

  securityText: {
    flex: 1,
    color: '#888888',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
  },
  heroTextStrong: { color: '#FFFFFF', fontSize: 19, lineHeight: 27, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  storySections: { marginTop: 36, gap: 26, marginBottom: 20 },
  storyRow: { flexDirection: 'row', alignItems: 'center', gap: 24, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, overflow: 'hidden' },
  storyRowMobile: { flexDirection: 'column', alignItems: 'stretch', padding: 16, gap: 18 },
  storyCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  storyEyebrow: { color: RED, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  storyHeading: { fontSize: 26, lineHeight: 33, fontWeight: '900', color: DARK, marginBottom: 12 },
  storyParagraph: { color: '#505050', fontSize: 15, lineHeight: 24, marginBottom: 20 },
  storyButton: { backgroundColor: RED, borderRadius: 25, paddingVertical: 13, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, maxWidth: '100%' },
  storyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  storyPhoto: { width: '47%', height: 310, borderRadius: 18, backgroundColor: '#F5EEEE' },
  storyPhotoMobile: { width: '100%', height: 245 },
  storyBulletRow: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 12 },
  storyBulletText: { flex: 1, fontSize: 13, lineHeight: 21, color: '#444444' },
  siteHero: { backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden', marginBottom: 16 },
  siteHeroImage: { width: '100%', height: 380 },
  siteHeroImageMobile: { height: 210 },
  siteHeroCaption: { color: '#444444', fontSize: 15, lineHeight: 23, textAlign: 'center', paddingVertical: 18, paddingHorizontal: 18 },
});