import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (status: number, value: unknown) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type':'application/json','Cache-Control':'no-store'},
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isExpoToken = (s: unknown): s is string => typeof s === 'string' && /^(Expo(nent)?PushToken)\[[^\]]+\]$/.test(s);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405,{error:'Method not allowed'});
  const secret = Deno.env.get('HELP_REQUEST_PUSH_SECRET');
  if (!secret || req.headers.get('x-dispatch-secret') !== secret) return json(401,{error:'Unauthorized'});
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(503,{error:'Server not configured'});
  const db = createClient(url,key,{auth:{persistSession:false}});
  const {data:jobs,error:claimError} = await db.rpc('help_push_claim_batch',{p_limit:30});
  if (claimError) return json(500,{error:'Claim failed'});
  let sent=0, failed=0, skipped=0;
  for (const job of jobs ?? []) {
    if (!uuid.test(job.request_id) || !uuid.test(job.admin_user_id)) {failed++;continue;}
    try {
      // Permission revocation is enforced again immediately before sending.
      const {data:allowed,error:accessError} = await db.rpc('help_push_recipient_allowed', {p_user_id:job.admin_user_id});
      if (accessError || allowed !== true) {await db.rpc('help_push_finish',{p_alert_id:job.id,p_success:true});skipped++;continue;}
      const {data:tokens,error:tokenError} = await db.from('push_tokens').select('token').eq('user_id',job.admin_user_id);
      if (tokenError) throw tokenError;
      const valid=[...new Set((tokens??[]).map(t=>t.token).filter(isExpoToken))];
      if (!valid.length) {await db.rpc('help_push_finish',{p_alert_id:job.id,p_success:true});skipped++;continue;}
      let allOk=true;
      for (let i=0;i<valid.length;i+=100) {
        const messages=valid.slice(i,i+100).map(to=>({
          to, sound:'default',title:'Solicitare nouă de ajutor',
          body:'A fost înregistrată o solicitare nouă.',
          data:{type:'help_request',request_id:job.request_id},
        }));
        const response=await fetch('https://exp.host/--/api/v2/push/send',{
          method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
          body:JSON.stringify(messages),
        });
        if (!response.ok) {allOk=false;continue;}
        const result=await response.json();
        const receipts=Array.isArray(result.data)?result.data:[result.data];
        if (receipts.length!==messages.length || receipts.some((r:unknown)=>!r || typeof r!=='object' || (r as {status?:string}).status!=='ok')) allOk=false;
      }
      const {error:finishError}=await db.rpc('help_push_finish',{p_alert_id:job.id,p_success:allOk});
      if (finishError) throw finishError;
      if(allOk)sent++;else failed++;
    } catch(e) {
      console.error('Help push delivery failed',job.id,String(e));
      await db.rpc('help_push_finish',{p_alert_id:job.id,p_success:false});
      failed++;
    }
  }
  return json(200,{claimed:(jobs??[]).length,sent,failed,skipped});
});
