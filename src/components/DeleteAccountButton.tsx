import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function DeleteAccountButton() {
  const [busy, setBusy] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  async function execute() {
    if (busy || confirmation !== 'DELETE') return;
    setConfirmVisible(false);
    setBusy(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('Sesiunea a expirat. Autentifică-te din nou.');

      const { data, error } = await supabase.functions.invoke('superadmin-delete-user', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { mode: 'self', confirm: 'DELETE_ACCOUNT' },
      });
      if (error || data?.error || data?.deleted !== true) {
        throw new Error(data?.error || error?.message || 'Serverul nu a confirmat ștergerea contului.');
      }

      // Auth user is already deleted server-side; clear the local session and return to sign-in.
      await supabase.auth.signOut();
      router.replace('/alege-cont');
    } catch (error: any) {
      const message = error?.message || 'Încearcă din nou.';
      if (Platform.OS === 'web') window.alert(`Contul nu a fost șters\n${message}`);
      else Alert.alert('Contul nu a fost șters', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Șterge definitiv contul"
        disabled={busy}
        onPress={() => { setConfirmation(''); setConfirmVisible(true); }}
        style={[styles.deleteButton, busy && styles.disabled]}
      >
        {busy
          ? <ActivityIndicator color="#A61E22" />
          : <><Ionicons name="trash-outline" size={18} color="#A61E22" /><Text style={styles.deleteButtonText}>Șterge definitiv</Text></>}
      </Pressable>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!busy) { setConfirmVisible(false); setConfirmation(''); } }}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <View style={styles.warningIcon}><Text style={styles.warningMark}>!</Text></View>
            <Text style={styles.title}>Ștergi definitiv contul?</Text>
            <Text style={styles.description}>
              Toate datele asociate contului vor fi șterse definitiv. Nu vei mai putea să te autentifici. Această acțiune este ireversibilă.
            </Text>
            <Text style={styles.inputLabel}>Pentru confirmare, introdu <Text style={styles.deleteWord}>DELETE</Text>:</Text>
            <TextInput value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="Scrie DELETE" accessibilityLabel="Introdu DELETE pentru confirmare" style={styles.confirmInput} editable={!busy} />
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => { setConfirmVisible(false); setConfirmation(''); }}
                disabled={busy}
                style={[styles.actionButton, styles.cancelButton]}
              >
                <Text style={styles.cancelText}>Păstrează contul</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void execute()}
                disabled={busy || confirmation !== 'DELETE'}
                style={[styles.actionButton, styles.confirmButton, confirmation !== 'DELETE' && styles.disabled]}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>Șterge definitiv</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  deleteButton: { flex: 1, minHeight: 54, borderWidth: 1.5, borderColor: '#E7B8B8', backgroundColor: '#FFF1F1', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  deleteButtonText: { color: '#A61E22', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  disabled: { opacity: 0.55 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10, 18, 30, 0.62)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 430, borderRadius: 20, padding: 24, backgroundColor: '#FFFFFF', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, elevation: 10 },
  warningIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FCE8E8', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  warningMark: { color: '#A61E22', fontSize: 28, fontWeight: '800' },
  title: { fontSize: 19, fontWeight: '800', color: '#202936', textAlign: 'center', marginBottom: 12 },
  description: { fontSize: 14, lineHeight: 21, color: '#566171', textAlign: 'center', marginBottom: 24 },
  inputLabel: { fontSize: 14, color: '#273142', marginBottom: 9, alignSelf: 'flex-start' },
  deleteWord: { fontWeight: '900', color: '#A61E22' },
  confirmInput: { width: '100%', borderWidth: 1.5, borderColor: '#D7DCE3', borderRadius: 11, paddingHorizontal: 14, minHeight: 48, fontSize: 16, color: '#202936', marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  actionButton: { flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { backgroundColor: '#F1F3F6' },
  confirmButton: { backgroundColor: '#A61E22' },
  cancelText: { color: '#273142', fontWeight: '700' },
  confirmText: { color: '#FFFFFF', fontWeight: '800' },
});
