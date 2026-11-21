import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/** Dezleagă tokenul acestui dispozitiv înainte de ieșirea din cont. */
export async function signOutWithPushCleanup() {
  try {
    if (Constants.isDevice && Platform.OS !== 'web') {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (projectId) {
        const permissions = await Notifications.getPermissionsAsync();
        if (permissions.status === 'granted') {
          const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
          const { error } = await supabase.rpc('push_unregister_token', { p_token: token });
          if (error) throw error;
        }
      }
    }
  } catch (error) {
    // Nu blocăm deconectarea dacă telefonul este offline.
    // La următoarea autentificare tokenul este reasociat.
    console.log('Nu s-a putut dezlega tokenul push:', error);
  }
  return supabase.auth.signOut();
}
