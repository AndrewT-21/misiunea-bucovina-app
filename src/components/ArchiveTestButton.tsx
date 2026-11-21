import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

const TEST_USER_ID = '44ac882b-f32b-402c-91bd-fcf8c367b078';

export default function ArchiveTestButton() {
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (mounted) setAllowed(!error && data.user?.id === TEST_USER_ID);
    }).catch(() => {
      if (mounted) setAllowed(false);
    });
    return () => { mounted = false; };
  }, []);

  async function runTest() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || userData.user?.id !== TEST_USER_ID) {
        throw new Error('Testul este permis doar contului de test.');
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error('Sesiune indisponibilă.');

      const { data, error } = await supabase.functions.invoke('delete-my-account', {
        headers: { Authorization: 'Bearer ' + token },
        body: { confirm: 'DELETE_MY_ACCOUNT' },
      });
      if (error) throw new Error(error.message);
      if (data?.preparation_completed !== true || data?.deletion_completed !== false) {
        throw new Error('Răspuns neașteptat; verifică starea contului înainte de a repeta testul.');
      }
      setMessage('Pregătire: OK. Fotografie arhivată: ' +
        (data.historical_avatar_saved === true ? 'DA' : 'NU') + '. Cont șters: NU.');
    } catch (error) {
      setMessage('Eroare: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) return null;

  return React.createElement(View, { style: styles.section },
    React.createElement(Pressable, {
      accessibilityRole: 'button',
      disabled: busy,
      onPress: () => { void runTest(); },
      style: styles.button,
    }, busy
      ? React.createElement(ActivityIndicator, { color: '#2563EB' })
      : React.createElement(Text, { style: styles.buttonText }, 'Testează arhivarea (fără ștergere)')),
    message ? React.createElement(Text, { style: styles.result }, message) : null,
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 12 },
  button: { borderWidth: 1, borderColor: '#2563EB', borderRadius: 12, padding: 15, alignItems: 'center' },
  buttonText: { color: '#2563EB', fontWeight: '700' },
  result: { color: '#273142', marginTop: 8 },
});
