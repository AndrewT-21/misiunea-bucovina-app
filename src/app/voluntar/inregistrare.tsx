import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator,  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const INK = '#171717';
const MUTED = '#777777';

export default function InregistrareVoluntar() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  function goHome() {
    router.dismissTo('/(tabs)');
  }

  function showSuccess(title: string, message: string) {
    if (Platform.OS === 'web') {
      // React Native Alert nu este implementat în toate mediile web.
      if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
      goHome();
      return;
    }
    Alert.alert(title, message, [{ text: 'OK', onPress: goHome }]);
  }

  async function register() {
    if (busy) return;
    setEmailError('');
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !cleanPhone) {
      Alert.alert('Câmpuri obligatorii', 'Completează numele, telefonul, e-mailul și parola.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Introdu o adresă de e-mail validă.');
      return;
    }
    const phoneDigits = cleanPhone.replace(/\D/g, '');
    if (!/^\+?[\d\s().-]+$/.test(cleanPhone) || phoneDigits.length < 9 || phoneDigits.length > 15) {
      Alert.alert('Telefon invalid', 'Introdu un număr de telefon valid, cu 9–15 cifre (poți include prefixul internațional).');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Parolă prea scurtă', 'Parola trebuie să aibă cel puțin 6 caractere.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Parole diferite', 'Parolele introduse nu coincid.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { full_name: cleanName, phone: cleanPhone, account_type: 'volunteer' } },
      });
      if (error) {
        const code = String(error.code ?? '').toLowerCase();
        const message = String(error.message ?? '').toLowerCase();
        if (code === 'user_already_exists' || code === 'email_exists' ||
          /already registered|already exists|already been registered|email.*in use|user already registered/.test(message)) {
          setEmailError('Această adresă de e-mail este deja folosită pentru un cont. Autentifică-te sau recuperează parola.');
          return;
        }
        throw error;
      }
      if (!data.user) throw new Error('Cererea de înregistrare nu a putut fi procesată.');

      if (!data.session) {
        // Confirmarea e-mailului este activă; Supabase poate masca duplicatele.
        showSuccess(
          'Verifică e-mailul',
          'Dacă adresa poate fi înregistrată, vei primi un mesaj de confirmare. După confirmare, autentifică-te ca voluntar. Dacă ai deja cont, folosește autentificarea sau resetarea parolei.'
        );
        return;
      }

      // Caz de rezervă dacă confirmarea e-mailului este dezactivată.
      const { data: admin, error: adminError } = await supabase
        .from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
      if (adminError) throw adminError;
      if (admin) {
        await supabase.auth.signOut();
        Alert.alert('Cont de administrator', 'Acest cont nu poate fi înregistrat ca voluntar.');
        return;
      }
      const { error: profileError } = await supabase
        .from('volunteer_profiles')
        .insert({ user_id: data.user.id, full_name: cleanName, phone: cleanPhone });
      if (profileError) throw profileError;
      await supabase.auth.signOut();
      showSuccess('Cont creat', 'Contul a fost creat. Te poți autentifica din pagina pentru voluntari.');
    } catch (err: any) {
      Alert.alert('Eroare la înregistrare', err?.message ?? 'Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <View style={[styles.circle, styles.circleTop]} />
        <View style={[styles.circle, styles.circleLeft]} />
        <View style={[styles.circle, styles.circleBottom]} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.back} onPress={() => router.dismissTo('/voluntar/login')} accessibilityLabel="Înapoi">
            <Ionicons name="chevron-back" size={24} color={INK} />
            <Text style={styles.backText}>Înapoi</Text>
          </TouchableOpacity>
        <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.brandMark}>
              <Ionicons name="people-outline" size={37} color={RED} />
            </View>
            <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
            <Text style={styles.title}>Creează cont de{'\n'}voluntar</Text>
            <Text style={styles.subtitle}>Înscrie-te la activități și urmărește răspunsurile administratorului.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Nume complet</Text>
            <View style={styles.field}>
              <Ionicons name="person-outline" size={20} color="#777" />
              <TextInput style={styles.fieldInput} value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" placeholder="Nume și prenume" placeholderTextColor="#A6A3A1" />
            </View>

            <Text style={styles.label}>Telefon</Text>
            <View style={styles.field}>
              <Ionicons name="call-outline" size={20} color="#777" />
              <TextInput style={styles.fieldInput} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="Ex.: +40 712 345 678" placeholderTextColor="#A6A3A1" />
            </View>

            <Text style={styles.label}>E-mail</Text>
            <View style={[styles.field, emailError ? styles.fieldError : null]}>
              <Ionicons name="mail-outline" size={20} color={emailError ? RED : '#777'} />
              <TextInput style={styles.fieldInput} value={email} onChangeText={(value) => { setEmail(value); if (emailError) setEmailError(''); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="exemplu@email.com" placeholderTextColor="#A6A3A1" />
            </View>
            {!!emailError && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={16} color={RED} />
                <Text style={styles.errorText}>{emailError}</Text>
              </View>
            )}

            <Text style={styles.label}>Parolă</Text>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={20} color="#777" />
              <TextInput style={styles.fieldInput} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" placeholder="Minimum 6 caractere" placeholderTextColor="#A6A3A1" />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Ascunde parola' : 'Arată parola'}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#777" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirmă parola</Text>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={20} color="#777" />
              <TextInput style={styles.fieldInput} value={confirm} onChangeText={setConfirm} secureTextEntry={!showConfirm} autoCapitalize="none" placeholder="Reintrodu parola" placeholderTextColor="#A6A3A1" />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm((v) => !v)} accessibilityRole="button" accessibilityLabel={showConfirm ? 'Ascunde confirmarea parolei' : 'Arată confirmarea parolei'}>
                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={22} color="#777" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.button, busy && styles.buttonDisabled]} disabled={busy} activeOpacity={0.85} onPress={register}>
              {busy ? <ActivityIndicator color="#fff" /> : <>
                <Text style={styles.buttonText}>Creează cont</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.loginLink} onPress={() => router.dismissTo('/voluntar/login')}>
              <Text style={styles.loginLinkText}>Ai deja cont? <Text style={styles.loginLinkAccent}>Autentifică-te</Text></Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="people-outline" size={24} color={RED} />
            <Text style={styles.infoText}>Fă parte din comunitatea Misiunea Bucovina și implică-te în proiectele noastre.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF6F2' , ...(Platform.OS === "web" ? { backgroundColor: "#F8F6F5" } : {})},
  flex: { flex: 1 },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: '#F4DAD5', opacity: 0.7 },
  circleTop: { width: 280, height: 280, top: -165, right: -115 },
  circleLeft: { width: 160, height: 160, top: '46%', left: -125, opacity: 0.55 },
  circleBottom: { width: 250, height: 250, bottom: -175, right: -130, opacity: 0.5 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8, alignSelf: 'flex-start' },
  backText: { color: INK, fontSize: 15, fontWeight: '700' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 , ...(Platform.OS === "web" ? { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 24, paddingTop: 40, paddingBottom: 65 } : {})},
  hero: { alignItems: 'center', marginBottom: 23 },
  brandMark: { width: 76, height: 76, borderRadius: 25, backgroundColor: '#FBE7E4', borderWidth: 1, borderColor: '#F4D6D1', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  eyebrow: { color: RED, fontSize: 11, fontWeight: '900', letterSpacing: 1.8, textAlign: 'center' },
  title: { color: INK, fontSize: 27, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', marginTop: 10 , ...(Platform.OS === "web" ? { fontSize: 32 } : {})},
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, maxWidth: 300 , ...(Platform.OS === "web" ? { fontSize: 15, lineHeight: 24 } : {})},
  formCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#EEE4DF', shadowColor: '#593B34', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 , ...(Platform.OS === "web" ? { borderRadius: 24, padding: 32 } : {})},
  label: { color: INK, fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 10 },
  field: { height: 52, borderWidth: 1, borderColor: '#E3DFDC', borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingLeft: 13, paddingRight: 8 },
  fieldInput: { flex: 1, minWidth: 0, color: INK, fontSize: 14, paddingHorizontal: 10, height: 50 },
  eyeButton: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  fieldError: { borderColor: RED, borderWidth: 2, backgroundColor: '#FFF6F6' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 8 },
  errorText: { flex: 1, color: RED, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  button: { backgroundColor: RED, borderRadius: 15, minHeight: 54, marginTop: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  loginLink: { alignItems: 'center', paddingVertical: 12, marginTop: 5 },
  loginLinkText: { color: INK, fontSize: 13 },
  loginLinkAccent: { color: RED, fontWeight: '900' },
  infoCard: { backgroundColor: '#F8EDE8', borderRadius: 18, marginTop: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  infoText: { color: '#655E5B', fontSize: 12, lineHeight: 18, flex: 1 },
});
