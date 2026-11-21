import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Phase = 'email' | 'code' | 'done';
const RED = '#A61E22';

export default function ReactivareCont() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof initialEmail === 'string' ? initialEmail : '');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('email');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function sendCode() {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setErrorMessage('Introdu o adresă de e-mail validă.');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    try {
      // shouldCreateUser:false împiedică înregistrarea accidentală a unui cont nou.
      const { error } = await supabase.auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: false } });
      if (error) throw error;
      setEmail(normalized);
      setPhase('code');
      setMessage('Dacă adresa este asociată unui cont, vei primi un cod prin e-mail.');
    } catch {
      // Nu dezvăluim dacă un e-mail este înregistrat sau nu.
      setEmail(normalized);
      setPhase('code');
      setMessage('Dacă adresa este asociată unui cont, vei primi un cod prin e-mail.');
    } finally {
      setBusy(false);
    }
  }

  async function reactivate() {
    if (!/^\d{6,8}$/.test(code.trim())) {
      setErrorMessage('Introdu codul numeric primit prin e-mail.');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('reactivate-my-account', {
        body: { email: email.trim().toLowerCase(), token: code.trim() },
      });
      if (error || data?.success !== true) {
        let reason = data?.error;
        if (!reason && error && 'context' in error) {
          try { reason = (await (error as any).context?.json())?.error; } catch { /* răspuns ne-JSON */ }
        }
        throw new Error(typeof reason === 'string' ? reason : 'Cod invalid, expirat sau reactivarea nu este disponibilă.');
      }
      setCode('');
      setMessage('Contul a fost reactivat. Te poți autentifica folosind datele existente.');
      setPhase('done');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Nu am putut reactiva contul.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={styles.back} onPress={() => router.replace('/voluntar/login')} accessibilityRole="button">
          <Ionicons name="chevron-back" size={22} color="#171717" /><Text style={styles.backText}>Autentificare</Text>
        </TouchableOpacity>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroIcon}><Ionicons name={phase === 'done' ? 'checkmark-circle-outline' : 'mail-outline'} size={38} color={RED} /></View>
          <Text style={styles.eyebrow}>MISIUNEA BUCOVINA</Text>
          <Text style={styles.title}>Reactivează contul</Text>
          <Text style={styles.subtitle}>Recuperează accesul la contul dezactivat, fără să pierzi profilul sau istoricul.</Text>
          <View style={styles.card}>
            {phase === 'done' ? (
              <>
                <Text style={styles.success}>{message}</Text>
                <TouchableOpacity style={styles.button} onPress={() => router.replace('/voluntar/login')}>
                  <Text style={styles.buttonText}>Mergi la autentificare</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Adresa de e-mail</Text>
                <TextInput style={styles.input} placeholder="exemplu@email.com" placeholderTextColor="#999" autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!busy && phase === 'email'} />
                {phase === 'code' && (
                  <>
                    <Text style={styles.label}>Codul primit prin e-mail</Text>
                    <TextInput style={styles.input} placeholder="Cod OTP" placeholderTextColor="#999" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={8} value={code} onChangeText={setCode} editable={!busy} />
                  </>
                )}
                {!!message && <Text style={styles.hint}>{message}</Text>}
                {!!errorMessage && <Text style={styles.error} accessibilityRole="alert">{errorMessage}</Text>}
                <TouchableOpacity style={[styles.button, busy && styles.disabled]} onPress={phase === 'email' ? sendCode : reactivate} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{phase === 'email' ? 'Trimite codul' : 'Verifică și reactivează'}</Text>}
                </TouchableOpacity>
                {phase === 'code' && (
                  <View style={styles.actions}>
                    <TouchableOpacity onPress={sendCode} disabled={busy}><Text style={styles.action}>Retrimite codul</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { setPhase('email'); setCode(''); setMessage(''); setErrorMessage(''); }} disabled={busy}><Text style={styles.action}>Schimbă e-mailul</Text></TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF6F2' }, flex: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 18, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '700', color: '#171717' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 48, width: '100%', maxWidth: 600, alignSelf: 'center' },
  heroIcon: { width: 76, height: 76, borderRadius: 24, backgroundColor: '#FBE7E4', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  eyebrow: { color: RED, fontSize: 11, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#171717', fontSize: 28, fontWeight: '900', marginTop: 10, textAlign: 'center' },
  subtitle: { color: '#777', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, marginBottom: 24 },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#EEE4DF' },
  label: { fontSize: 13, fontWeight: '800', color: '#171717', marginBottom: 9, marginTop: 8 },
  input: { minHeight: 54, borderWidth: 1, borderColor: '#E3DFDC', borderRadius: 14, paddingHorizontal: 14, fontSize: 15, color: '#171717', marginBottom: 12 },
  button: { backgroundColor: RED, borderRadius: 15, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 12 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.6 }, hint: { color: '#686868', fontSize: 13, lineHeight: 19, marginVertical: 8 },
  error: { color: '#B42318', fontSize: 13, lineHeight: 19, marginVertical: 8 },
  success: { color: '#236342', fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginTop: 18 },
  action: { color: RED, fontSize: 13, fontWeight: '800' },
});
