import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { registerPushTokenForUser } from '../lib/push-register';
import { supabase } from '../lib/supabase';
import { View } from 'react-native';
import ConfirmDialog from '../components/ConfirmDialog';
import SaveFeedback from '../components/SaveFeedback';

export default function RootLayout() {
  useEffect(() => {
    let mounted = true;
    // Verifică și sesiunile persistate după repornirea aplicației.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user) void registerPushTokenForUser(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Permite finalizarea verificărilor de rol din ecranele de login.
        setTimeout(() => {
          if (mounted) void registerPushTokenForUser(session.user.id);
        }, 1500);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin/activity-new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/prayer-new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/cases/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/projects/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/news/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/notifications/new" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/bank-accounts/create" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin/reports/create" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <ConfirmDialog />
      <SaveFeedback />
    </>
  );
}