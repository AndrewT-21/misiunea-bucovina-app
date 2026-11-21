import { supabase } from './supabase';

export async function checkNicknameAvailability(nickname: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('misibi_nickname_available', { p_nickname: nickname });
  if (error) throw error;
  return data === true;
}
