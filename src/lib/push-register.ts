import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

let inFlightUserId: string | null = null;

/** Înregistrează tokenul Expo pentru utilizatorul autentificat, fără a bloca loginul. */
export async function registerPushTokenForUser(userId: string): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice || inFlightUserId === userId) return;
  inFlightUserId = userId;
  try {
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('Push: lipsește EAS projectId.');
      return;
    }

    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') {
      permission = await Notifications.requestPermissionsAsync();
    }
    if (permission.status !== 'granted') return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { data: { session } } = await supabase.auth.getSession();
    // Nu asociem tokenul dacă utilizatorul s-a deconectat între timp.
    if (session?.user.id !== userId) return;

    const { error } = await supabase.rpc('push_register_token', {
      p_token: token,
      p_platform: Platform.OS,
    });
    if (error) throw error;
    console.log('Push: tokenul dispozitivului a fost înregistrat.');
  } catch (error) {
    console.warn('Push: înregistrarea tokenului a eșuat:', error);
  } finally {
    inFlightUserId = null;
  }
}
