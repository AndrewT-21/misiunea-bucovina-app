import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: {...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store'},
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, {headers:cors});
  if (req.method !== 'POST') return respond(405,{error:'Metodă nepermisă.'});
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization')??'')?.[1];
  if (!token) return respond(401,{error:'Autentificare necesară.'});
  const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return respond(503,{error:'Server neconfigurat.'});
  const db=createClient(url,key,{auth:{persistSession:false}});
  const {data:auth,error:authError}=await db.auth.getUser(token);
  if (authError || !auth.user) return respond(401,{error:'Sesiune invalidă.'});
  const { data: role, error: roleError } = await db.from('admins').select('role').eq('user_id', auth.user.id).maybeSingle();
  if (roleError || !role) return respond(403, { error: 'Acces interzis.' });
  if (role.role !== 'super_admin') {
    if (role.role !== 'admin') return respond(403, { error: 'Acces interzis.' });
    const { data: grant, error: grantError } = await db.from('admin_departments')
      .select('can_view,can_delete,departments!inner(slug,is_active,admin_enabled)')
      .eq('admin_user_id', auth.user.id)
      .eq('departments.slug','solicitari-ajutor')
      .eq('departments.is_active',true).eq('departments.admin_enabled',true)
      .eq('can_view',true).eq('can_delete',true).maybeSingle();
    if (grantError || !grant) return respond(403, { error: 'Permisiune insuficientă.' });
  }
  let input:unknown;
  try {input=await req.json();} catch {return respond(400,{error:'Date invalide.'});}
  const id=(input && typeof input==='object' && 'request_id' in input) ? (input as {request_id:unknown}).request_id:null;
  if(typeof id!=='string'||!uuid.test(id))return respond(400,{error:'ID invalid.'});
  const {data:request,error:fetchError}=await db.from('help_requests').select('id,form_data').eq('id',id).maybeSingle();
  if(fetchError)return respond(500,{error:'Nu s-a putut verifica solicitarea.'});
  if(!request)return respond(404,{error:'Solicitarea nu există.'});
  const docs=Array.isArray(request.form_data?.documents)?request.form_data.documents:[];
  const paths=[...new Set(docs.flatMap((doc:unknown)=>{
    if(!doc||typeof doc!=='object'||!('path' in doc))return [];
    const path=(doc as {path:unknown}).path;
    return typeof path==='string' && path.startsWith(`${id}/`) && !path.includes('..') ? [path] : [];
  }))];
  // Remove the database row first: failed FK constraints must not delete documents.
  // The admin alerts table may reference the request; it is cleaned up explicitly.
  const {error:alertError}=await db.from('help_request_admin_alerts').delete().eq('request_id',id);
  if(alertError)return respond(500,{error:'Nu s-au putut elimina alertele asociate. Solicitarea nu a fost ștearsă.'});
  const {error:deleteError}=await db.from('help_requests').delete().eq('id',id);
  if(deleteError)return respond(500,{error:`Solicitarea nu a putut fi ștearsă: ${deleteError.message}`});
  const storage_errors:string[]=[];
  for(let i=0;i<paths.length;i+=100){
    const {error}=await db.storage.from('help-request-documents').remove(paths.slice(i,i+100));
    if(error)storage_errors.push(error.message);
  }
  if(storage_errors.length)console.error('Orphan document cleanup failed for request',id,storage_errors);
  return respond(200,{deleted:true,storage_errors});
});
