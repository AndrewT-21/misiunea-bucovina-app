import { router } from 'expo-router';
import { Alert } from 'react-native';
import { supabase } from './supabase';

export async function requireVolunteer() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    Alert.alert('Autentificare necesară', 'Conectează-te în contul de voluntar pentru a folosi această funcție.', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Conectează-te', onPress: () => router.push('/voluntar/login') },
    ]);
    return null;
  }
  const { data: profile, error: profileError } = await supabase.from('volunteer_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  if (profileError || !profile) {
    Alert.alert('Cont de voluntar necesar', 'Această funcție este disponibilă numai voluntarilor autentificați.');
    return null;
  }
  return user;
}
export async function currentVolunteerId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('volunteer_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  return data ? user.id : null;
}
export type FavoriteKind = 'case' | 'project';
export async function getFavoriteIds(kind: FavoriteKind, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('volunteer_favorites').select('item_id').eq('user_id', userId).eq('item_type', kind).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => row.item_id);
}
export async function setFavorite(kind: FavoriteKind, id: string, userId: string, selected: boolean) {
  const query = supabase.from('volunteer_favorites');
  const { error } = selected
    ? await query.insert({ user_id: userId, item_type: kind, item_id: id })
    : await query.delete().eq('user_id', userId).eq('item_type', kind).eq('item_id', id);
  if (error) throw error;
}
