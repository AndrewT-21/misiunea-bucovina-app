import { Alert } from '../lib/platform-alert';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator,
  
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const RED = '#A61E22';
const INK = '#1D1D1F';
const MUTED = '#74706F';

export default function AdminLoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      Alert.alert('Câmpuri incomplete', 'Introdu e-mailul sau nickname-ul și parola.');
      return;
    }
    try {
      setLoading(true);
      const loginValue = identifier.trim().toLowerCase().replace(/^@/, '');
      if (loginValue.includes('@')) {
        const { error } = await supabase.auth.signInWithPassword({
          email: loginValue,
          password,
        });
        if (error) throw error;
      } else {
        if (!/^[a-z0-9_]{3,20}$/.test(loginValue)) {
          throw new Error('Nickname invalid.');
        }
        // Folosește aceeași funcție securizată de nickname ca loginul voluntarilor.
        // Funcția Edge trebuie să accepte și profilurile super_admin din admin_profiles.
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) throw new Error('Nu am putut verifica utilizatorul.');
      const { getAccountKind } = await import('../lib/accountAccess');
      const kind = await getAccountKind(session.user.id);
      if (kind !== 'super_admin') {
        await supabase.auth.signOut();
        Alert.alert('Acces interzis', 'Autentificarea Administrator este rezervată Super Adminului. Folosește Voluntar.');
        return;
      }
      router.replace('/admin');
    } catch (err: any) {
      Alert.alert('Autentificare eșuată', err?.message ?? 'A apărut o problemă. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.circleTop} />
        <View style={styles.circleLeft} />
        <View style={styles.circleBottom} />
      </View>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Înapoi">
          <Ionicons name="chevron-back" size={24} color={INK} />
          <Text style={styles.backText}>Înapoi</Text>
        </TouchableOpacity>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Ionicons name="shield-checkmark-outline" size={38} color={RED} />
            </View>
            <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
            <Text style={styles.title}>Autentificare administrator</Text>
            <Text style={styles.subtitle}>Conectează-te pentru a gestiona conținutul și înscrierile.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>E-mail sau nickname</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#77706F" />
              <TextInput
                style={styles.input}
                placeholder="exemplu@email.com"
                placeholderTextColor="#A5A09D"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                value={identifier}
                onChangeText={setIdentifier}
                editable={!loading}
              />
            </View>

            <Text style={[styles.label, styles.passwordLabel]}>Parolă</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#77706F" />
              <TextInput
                style={styles.input}
                placeholder="Parola ta"
                placeholderTextColor="#A5A09D"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                editable={!loading}
                returnKeyType="go"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(value => !value)}
                accessibilityLabel={showPassword ? 'Ascunde parola' : 'Arată parola'}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#666666" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Text style={styles.loginText}>Conectează-te</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.security}>
            <Ionicons name="lock-closed-outline" size={23} color="#706C6A" />
            <Text style={styles.securityText}>Acces rezervat administratorilor Misiunea Bucovina.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF6F2', overflow: 'hidden' , ...(Platform.OS === "web" ? { backgroundColor: "#F8F6F5" } : {})},
  container: { flex: 1 },
  circleTop: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#F4DAD6', top: -178, right: -125, opacity: 0.8 },
  circleLeft: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#F9E9E4', top: '42%', left: -175 },
  circleBottom: { position: 'absolute', width: 290, height: 290, borderRadius: 145, backgroundColor: '#F7E4DE', bottom: -215, right: -125, opacity: 0.85 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 22, paddingTop: 14, paddingBottom: 10, alignSelf: 'flex-start', zIndex: 2 },
  backText: { fontSize: 14, fontWeight: '700', color: INK },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 35 , ...(Platform.OS === "web" ? { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 24, paddingTop: 55, paddingBottom: 65 } : {})},
  hero: { alignItems: 'center', marginBottom: 24 , ...(Platform.OS === "web" ? { marginBottom: 32 } : {})},
  logo: { width: 76, height: 76, borderRadius: 24, backgroundColor: '#FBE7E4', borderWidth: 1, borderColor: '#F4D6D0', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  eyebrow: { color: RED, fontSize: 11, fontWeight: '900', letterSpacing: 1.8, textAlign: 'center' },
  title: { color: INK, fontSize: 27, fontWeight: '900', textAlign: 'center', letterSpacing: -0.7, marginTop: 9 , ...(Platform.OS === "web" ? { fontSize: 34 } : {})},
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, maxWidth: 310 , ...(Platform.OS === "web" ? { fontSize: 15, lineHeight: 24, maxWidth: 430 } : {})},
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 20, paddingTop: 23, paddingBottom: 23, borderWidth: 1, borderColor: '#F0E7E3', shadowColor: '#593B34', shadowOpacity: 0.08, shadowRadius: 17, shadowOffset: { width: 0, height: 7 }, elevation: 3 , ...(Platform.OS === "web" ? { paddingHorizontal: 35, paddingTop: 35, paddingBottom: 35, borderRadius: 24 } : {})},
  label: { fontSize: 13, fontWeight: '800', color: INK, marginBottom: 9 },
  passwordLabel: { marginTop: 20 },
  inputContainer: { minHeight: 52, borderWidth: 1, borderColor: '#E3DDDA', borderRadius: 14, backgroundColor: '#FFFEFD', paddingLeft: 14, paddingRight: 9, flexDirection: 'row', alignItems: 'center' , ...(Platform.OS === "web" ? { minHeight: 56 } : {})},
  input: { flex: 1, color: INK, fontSize: 14, marginLeft: 11, paddingVertical: 12, minWidth: 0 },
  eyeButton: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  loginButton: { minHeight: 54, backgroundColor: RED, borderRadius: 15, marginTop: 26, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 , ...(Platform.OS === "web" ? { minHeight: 58 } : {})},
  loginButtonDisabled: { opacity: 0.65 },
  loginText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  security: { marginTop: 19, backgroundColor: '#F7EDE8', borderRadius: 19, minHeight: 75, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 15 },
  securityText: { flex: 1, color: '#676260', fontSize: 12, lineHeight: 18 },
});
