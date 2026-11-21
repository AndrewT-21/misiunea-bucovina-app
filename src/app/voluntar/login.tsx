import { Alert } from '../../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator,  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const RED = '#A61E22';
const DARK = '#171717';
const MUTED = '#777777';

export default function LoginVoluntar() {
  const { from, returnType, returnId } = useLocalSearchParams<{
    from?: string;
    returnType?: string;
    returnId?: string;
  }>();

  function goBack() {
    if (from === 'notificari') router.dismissTo('/(tabs)');
    else if (returnType === 'case' && returnId)
      router.replace({ pathname: '/caz/[id]', params: { id: returnId } });
    else if (returnType === 'project' && returnId)
      router.replace({ pathname: '/proiect/[id]', params: { id: returnId } });
    else (router.canGoBack() ? router.back() : router.replace('/(tabs)/mai-multe'));
  }

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function login() {
    if (!identifier.trim() || !password) {
      Alert.alert('Completează datele', 'Introdu e-mailul sau nickname-ul și parola.');
      return;
    }
    setBusy(true);
    try {
      const loginValue = identifier.trim().toLowerCase().replace(/^@/, '');
      if (loginValue.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({
          email: loginValue,
          password,
        });
        if (error) throw error;
      } else {
        if (!/^[a-z0-9_]{3,20}$/.test(loginValue)) throw new Error('Nickname invalid.');
        const { data, error } = await supabase.functions.invoke('volunteer-nickname-login', {
          body: { nickname: loginValue, password },
        });
        if (error || !data?.access_token || !data?.refresh_token) {
          throw new Error('Nickname sau parolă incorectă.');
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) throw sessionError;
      }

      // Verifică sesiunea reală înainte de a deschide o pagină protejată.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) {
        throw new Error('Sesiunea nu a fost creată. Verifică setările Supabase Auth și încearcă din nou.');
      }

      const { getAccountKind } = await import('../../lib/accountAccess');
      const kind = await getAccountKind(session.user.id);
      if (kind === 'super_admin') {
        await supabase.auth.signOut();
        Alert.alert('Acces interzis', 'Super Admin trebuie să se autentifice prin Administrator.');
        return;
      }

      // Loginul nu decide rolurile. Paginile protejate le verifică separat.
      // Nu deconectăm un utilizator doar pentru că nu are profil de voluntar.
      router.dismissTo('/(tabs)');
    } catch (err: any) {
      Alert.alert('Autentificare nereușită', err?.message ?? 'Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!identifier.trim() || !identifier.includes('@')) {
      Alert.alert('Introdu e-mailul', 'Pentru resetarea parolei, introdu adresa de e-mail în primul câmp.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim().toLowerCase());
      if (error) throw error;
      Alert.alert('Verifică e-mailul', 'Dacă adresa există, vei primi instrucțiuni pentru resetarea parolei.');
    } catch (err: any) {
      Alert.alert('Eroare', err?.message ?? 'Încearcă din nou.');
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
        <TouchableOpacity style={styles.back} onPress={goBack} accessibilityLabel="Înapoi">
          <Ionicons name="chevron-back" size={24} color={DARK} />
          <Text style={styles.backText}>Înapoi</Text>
        </TouchableOpacity>
        <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { maxWidth: 1120, width: '100%', alignSelf: 'center' as const }]}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Ionicons name="heart-outline" size={37} color={RED} />
            </View>
            <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
            <Text style={styles.title}>Autentificare în cont</Text>
            <Text style={styles.subtitle}>Conectează-te pentru a vedea înscrierile și răspunsurile primite.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>E-mail sau nickname</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#858585" />
              <TextInput style={styles.input} value={identifier} onChangeText={setIdentifier}
                autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
                autoComplete="email" placeholder="exemplu@email.com" placeholderTextColor="#A4A4A4" />
            </View>
            <Text style={styles.label}>Parolă</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#858585" />
              <TextInput style={styles.input} value={password} onChangeText={setPassword}
                secureTextEntry={!showPassword} autoComplete="current-password"
                placeholder="Parola ta" placeholderTextColor="#A4A4A4"
                onSubmitEditing={login} />
              <TouchableOpacity style={styles.eye} onPress={() => setShowPassword(v => !v)}
                accessibilityRole="button" accessibilityLabel={showPassword ? 'Ascunde parola' : 'Arată parola'}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#777" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.button, busy && styles.disabled]}
              onPress={login} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <>
                <Text style={styles.buttonText}>Conectează-te</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.forgot} onPress={() => router.push('/reactivare-cont')} disabled={busy}>
              <Text style={styles.forgotText}>Ai dezactivat contul? Reactivează-l</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.forgot} onPress={resetPassword} disabled={busy}>
              <Text style={styles.forgotText}>Ai uitat parola?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="people-outline" size={24} color={RED} />
            <Text style={styles.infoText}>Fă parte din comunitatea Misiunea Bucovina și implică-te în proiectele noastre.</Text>
          </View>
          <TouchableOpacity style={styles.signup} onPress={() => router.push('/voluntar/inregistrare')}>
            <Text style={styles.signupText}>Nu ai cont? <Text style={styles.signupStrong}>Creează unul</Text></Text>
          </TouchableOpacity>
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
  backText: { color: DARK, fontSize: 15, fontWeight: '700' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30 , ...(Platform.OS === "web" ? { width: "100%", maxWidth: 570, alignSelf: "center", paddingHorizontal: 24, paddingTop: 48, paddingBottom: 64 } : {})},
  hero: { alignItems: 'center', marginBottom: 23 , ...(Platform.OS === "web" ? { marginBottom: 30 } : {})},
  logo: { width: 76, height: 76, borderRadius: 25, backgroundColor: '#FBE7E4', borderWidth: 1, borderColor: '#F4D6D1', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  eyebrow: { color: RED, fontSize: 11, fontWeight: '900', letterSpacing: 1.8, textAlign: 'center' },
  title: { color: DARK, fontSize: 27, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center', marginTop: 10 , ...(Platform.OS === "web" ? { fontSize: 32 } : {})},
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, maxWidth: 300 , ...(Platform.OS === "web" ? { fontSize: 15, lineHeight: 24, maxWidth: 440 } : {})},
  formCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#EEE4DF', shadowColor: '#593B34', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 , ...(Platform.OS === "web" ? { borderRadius: 24, padding: 32 } : {})},
  label: { color: DARK, fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 10 },
  inputContainer: { height: 52, borderWidth: 1, borderColor: '#E3DFDC', borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingLeft: 13, paddingRight: 8 , ...(Platform.OS === "web" ? { minHeight: 56 } : {})},
  input: { flex: 1, minWidth: 0, color: DARK, fontSize: 14, paddingHorizontal: 10, height: 50 },
  eye: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  button: { backgroundColor: RED, borderRadius: 15, minHeight: 54, marginTop: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  forgot: { alignSelf: 'center', paddingVertical: 10, marginTop: 6 },
  forgotText: { color: RED, fontSize: 13, fontWeight: '800' },
  infoCard: { backgroundColor: '#F8EDE8', borderRadius: 18, marginTop: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  infoText: { color: '#655E5B', fontSize: 12, lineHeight: 18, flex: 1 },
  signup: { alignItems: 'center', paddingVertical: 14, marginTop: 5 },
  signupText: { color: DARK, fontSize: 13 },
  signupStrong: { color: RED, fontWeight: '900' },
});
