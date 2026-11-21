import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Date locale izolate per utilizator pe acest dispozitiv. Pentru sincronizare
// între dispozitive va fi nevoie ulterior de tabele Supabase și politici RLS.
export async function accountStorageKey(baseKey: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  return userId ? `${baseKey}:user:${userId}` : `${baseKey}:guest`;
}

export async function getAccountItem(baseKey: string): Promise<string | null> {
  const key = await accountStorageKey(baseKey);
  const value = await AsyncStorage.getItem(key);
  if (value !== null) return value;
  // Migrare o singură dată a datelor vechi, exclusiv pentru vizitator.
  if (key.endsWith(':guest')) {
    const legacy = await AsyncStorage.getItem(baseKey);
    if (legacy !== null) {
      await AsyncStorage.setItem(key, legacy);
      await AsyncStorage.removeItem(baseKey);
    }
    return legacy;
  }
  return null;
}

export async function setAccountItem(baseKey: string, value: string): Promise<void> {
  const key = await accountStorageKey(baseKey);
  await AsyncStorage.setItem(key, value);
}
