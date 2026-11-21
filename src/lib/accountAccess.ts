import { supabase } from './supabase';

export type AccountKind = 'super_admin' | 'admin' | 'voluntar';

/** The admins table is the source of truth. Ordinary admins use the volunteer entry. */
export async function getAccountKind(userId: string): Promise<AccountKind> {
  const { data, error } = await supabase.from('admins').select('role').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data?.role === 'super_admin') return 'super_admin';
  if (data) return 'admin';
  return 'voluntar';
}
