import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Permission = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';
type Row = { department_slug?: string; [key: string]: unknown };

/** UI route gate only. Supabase RPCs and tables MUST enforce these rules server-side. */
export default function SchoolAdminGate({ children, permission = 'can_view' }: { children: ReactNode; permission?: Permission }) {
  const [status, setStatus] = useState<'loading' | 'allowed' | 'denied'>('loading');
  const [message, setMessage] = useState('');
  const check = useCallback(async () => {
    setStatus('loading'); setMessage('');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.replace('/admin-login'); setStatus('denied'); return; }
      const { data: isSuper, error: superError } = await supabase.rpc('misibi_is_super_admin');
      if (superError) throw superError;
      if (isSuper === true) { setStatus('allowed'); return; }
      const { data, error } = await supabase.rpc('misibi_my_admin_permissions');
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as Row[];
      const permitted = rows.some(row => row.department_slug === 'scoala-crestina' && row[permission] === true);
      setStatus(permitted ? 'allowed' : 'denied');
      if (!permitted) setMessage('Nu ai permisiunea necesară pentru această secțiune din Școala Creștină.');
    } catch (e) {
      setStatus('denied'); setMessage(e instanceof Error ? e.message : 'Nu s-au putut verifica permisiunile.');
    }
  }, [permission]);
  useFocusEffect(useCallback(() => { void check(); }, [check]));
  if (status === 'allowed') return <>{children}</>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#F6F6F6' }} edges={['top']}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
      <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/alege-cont')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, alignSelf: 'flex-start' }} accessibilityLabel="Înapoi">
        <Ionicons name="chevron-back" size={23} color="#A61E22" />
        <Text style={{ color: '#A61E22', fontWeight: '800', fontSize: 16 }}>Înapoi</Text>
      </TouchableOpacity>
      <Text style={{ fontSize: 24, fontWeight: '900', color: '#171717' }}>{status === 'loading' ? 'Verificare acces' : 'Acces restricționat'}</Text>
      {status === 'loading' ? <ActivityIndicator color="#A61E22" /> : <>
        <Text style={{ color: '#666', lineHeight: 21 }}>{message}</Text>
        <TouchableOpacity onPress={() => void check()}><Text style={{ color: '#A61E22', fontWeight: '800' }}>Verifică din nou</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/admin')}><Text style={{ color: '#171717' }}>Înapoi la dashboard</Text></TouchableOpacity>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
