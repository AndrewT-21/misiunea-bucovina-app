import { supabase } from './supabase';
export type HelpRequestPermissions = { view: boolean; edit: boolean; delete: boolean };
export async function getHelpRequestPermissions(): Promise<HelpRequestPermissions> {
  const { data: superAdmin, error: superError } = await supabase.rpc('misibi_is_super_admin');
  if (superError) throw superError;
  if (superAdmin === true) return { view: true, edit: true, delete: true };
  const { data, error } = await supabase.rpc('misibi_my_admin_permissions');
  if (error) throw error;
  const row = ((data ?? []) as { department_slug: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[])
    .find(p => p.department_slug === 'solicitari-ajutor' && p.can_view);
  return { view: !!row, edit: !!row?.can_edit, delete: !!row?.can_delete };
}
