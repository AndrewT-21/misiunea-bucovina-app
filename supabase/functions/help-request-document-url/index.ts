import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return respond(405, { error: 'Metodă nepermisă.' });
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) return respond(401, { error: 'Autentificare necesară.' });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return respond(503, { error: 'Server neconfigurat.' });
  const adminDb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userResult, error: authError } = await adminDb.auth.getUser(token);
  const user = userResult.user;
  if (authError || !user) return respond(401, { error: 'Sesiune invalidă.' });
  const { data: role, error: roleError } = await adminDb.from('admins').select('role').eq('user_id', user.id).maybeSingle();
  if (roleError || !role) return respond(403, { error: 'Acces interzis.' });
  if (role.role !== 'super_admin') {
    if (role.role !== 'admin') return respond(403, { error: 'Acces interzis.' });
    const { data: grant, error: grantError } = await adminDb.from('admin_departments')
      .select('can_view,departments!inner(slug,is_active,admin_enabled)')
      .eq('admin_user_id', user.id)
      .eq('departments.slug','solicitari-ajutor')
      .eq('departments.is_active',true).eq('departments.admin_enabled',true)
      .eq('can_view',true).maybeSingle();
    if (grantError || !grant) return respond(403, { error: 'Permisiune insuficientă.' });
  }
  let input: { request_id?: unknown; path?: unknown };
  try { input = await req.json(); } catch { return respond(400, { error: 'Date invalide.' }); }
  const requestId = input.request_id;
  const path = input.path;
  if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId) ||
      typeof path !== 'string' || !path.startsWith(`${requestId}/`) || path.includes('..') || path.length > 250) {
    return respond(400, { error: 'Document invalid.' });
  }
  const { data: request, error: requestError } = await adminDb.from('help_requests')
    .select('form_data').eq('id', requestId).maybeSingle();
  if (requestError || !request) return respond(404, { error: 'Solicitarea nu există.' });
  const manifest = request.form_data?.documents;
  if (!Array.isArray(manifest) || !manifest.some((doc: unknown) =>
    !!doc && typeof doc === 'object' && (doc as {path?: unknown}).path === path)) {
    return respond(404, { error: 'Documentul nu aparține acestei solicitări.' });
  }
  const { data, error } = await adminDb.storage.from('help-request-documents').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return respond(503, { error: 'Nu s-a putut deschide documentul.' });
  return respond(200, { url: data.signedUrl });
});
