import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

export type SchoolPermission = 'can_view' | 'can_create' | 'can_edit' | 'can_delete';
type Rights = Record<SchoolPermission, boolean>;
const EMPTY: Rights = { can_view: false, can_create: false, can_edit: false, can_delete: false };

/** UI permissions only. RPCs/RLS must independently authorize every mutation. */
export function useSchoolAdminPermissions() {
  const [rights, setRights] = useState<Rights>(EMPTY);
  const [loadingRights, setLoadingRights] = useState(true);
  const refreshRights = useCallback(async () => {
    setLoadingRights(true);
    setRights(EMPTY);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;
      const { data: superAdmin, error: superError } = await supabase.rpc('misibi_is_super_admin');
      if (superError) throw superError;
      if (superAdmin === true) {
        setRights({ can_view: true, can_create: true, can_edit: true, can_delete: true });
        return;
      }
      const { data, error } = await supabase.rpc('misibi_my_admin_permissions');
      if (error) throw error;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const row = rows.find((item: any) => item.department_slug === 'scoala-crestina');
      setRights({
        can_view: row?.can_view === true,
        can_create: row?.can_create === true,
        can_edit: row?.can_edit === true,
        can_delete: row?.can_delete === true,
      });
    } catch { setRights(EMPTY); }
    finally { setLoadingRights(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refreshRights(); }, [refreshRights]));
  return { rights, loadingRights, refreshRights };
}
