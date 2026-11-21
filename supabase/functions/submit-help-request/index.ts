// Deploy with: supabase functions deploy submit-help-request --no-verify-jwt
// Secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const maxFile = 12 * 1024 * 1024;
const maxRequest = 15 * 1024 * 1024;
const fields = ['name','birthDate','country','county','locality','village','street','apartment','email','phone','whatsappSame','whatsapp','needs','familyMembers','minorChildren','childrenAges','monthlyIncome','illness','workplace','previouslyHelped','previousAssociation','videoConsent','visitConsent','discovery'];
const mandatory = ['name','birthDate','country','county','locality','street','phone','whatsappSame','needs','familyMembers','minorChildren','monthlyIncome','previouslyHelped','videoConsent','visitConsent','discovery'];
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply = (status:number, payload:unknown) => new Response(JSON.stringify(payload),{status,headers:{...cors,'Content-Type':'application/json'}});
const clean = (v:unknown) => typeof v === 'string' ? v.trim() : '';
Deno.serve(async req => {
 if (req.method === 'OPTIONS') return new Response(null,{headers:cors});
 if (req.method !== 'POST') return reply(405,{error:'Metodă nepermisă'});
 const length = Number(req.headers.get('content-length')||0);
 if (length > maxRequest) return reply(413,{error:'Documentele depășesc 15 MB în total.'});
 try {
  const body = await req.formData();
  const raw = body.get('form');
  if (typeof raw !== 'string' || raw.length > 16000) return reply(400,{error:'Formular invalid'});
  const source = JSON.parse(raw);
  if (!source || typeof source !== 'object' || Array.isArray(source)) return reply(400,{error:'Formular invalid'});
  const form: Record<string,string> = {};
  for (const key of fields) {
    form[key] = clean(source[key]);
    if (form[key].length > (key === 'needs' ? 3000 : 250)) return reply(400,{error:`Câmp prea lung: ${key}`});
  }
  if (mandatory.some(k=>!form[k]) || form.name.length<2 || form.name.length>120 || form.phone.length<6 || form.phone.length>30 || form.locality.length<2 || form.locality.length>120 || form.needs.length<20 || form.email.length>200 || (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) || !/^\d{2}\/\d{2}\/\d{4}$/.test(form.birthDate) || (form.whatsappSame==='Nu' && !form.whatsapp) || (form.previouslyHelped==='Da' && !form.previousAssociation) || source.consent !== true) return reply(400,{error:'Verifică datele obligatorii și acordul.'});
  if (!['Da','Nu'].includes(form.whatsappSame) || !['Da','Nu'].includes(form.previouslyHelped) || !['Da','Nu'].includes(form.videoConsent) || !['Da','Nu'].includes(form.visitConsent)) return reply(400,{error:'Opțiune invalidă'});
  const identity = body.getAll('identity').filter((f):f is File => f instanceof File);
  const evidence = body.getAll('evidence').filter((f):f is File => f instanceof File);
  const files = [...identity,...evidence];
  if (identity.length !== 1 || evidence.length < 1 || evidence.length > 8 || files.some(f=>!allowed.has(f.type)||f.size<1||f.size>maxFile) || files.reduce((n,f)=>n+f.size,0)>maxRequest-100000) return reply(400,{error:'Documente invalide sau prea mari. Maximum 15 MB în total.'});
  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) return reply(503,{error:'Server neconfigurat'});
  const db = createClient(url,secret,{auth:{persistSession:false}});
  const {data:recent,error:recentError} = await db.from('help_requests').select('id').eq('phone',form.phone).gte('created_at',new Date(Date.now()-3600000).toISOString()).limit(1);
  if (recentError) return reply(503,{error:'Nu s-a putut verifica solicitarea.'});
  if (recent?.length) return reply(429,{error:'Există deja o solicitare recentă pentru acest număr.'});
  // Triggers assign request_number and create super-admin alerts.
  const {data:created,error:insertError} = await db.from('help_requests').insert({name:form.name,phone:form.phone,email:form.email||null,locality:form.locality,county:form.county,category:'Altele',description:form.needs,consent_at:new Date().toISOString(),form_data:form}).select('id,request_number').single();
  if (insertError || !created) return reply(503,{error:'Nu s-a putut salva solicitarea.'});
  const uploaded:string[]=[];
  try {
    const manifest: {kind:string;path:string;name:string;type:string}[]=[];
    for (const [i,file] of files.entries()) {
      const kind = i === 0 ? 'identity' : 'evidence';
      const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'} as Record<string,string>)[file.type];
      const path = `${created.id}/${kind}-${crypto.randomUUID()}.${ext}`;
      const {error} = await db.storage.from('help-request-documents').upload(path,file,{contentType:file.type,upsert:false});
      if (error) throw error;
      uploaded.push(path);
      manifest.push({kind,path,name:file.name.slice(0,160),type:file.type});
    }
    const {error} = await db.from('help_requests').update({form_data:{...form,documents:manifest}}).eq('id',created.id);
    if (error) throw error;
    return reply(200,{id:created.id,request_number:created.request_number});
  } catch (e) {
    if (uploaded.length) await db.storage.from('help-request-documents').remove(uploaded);
    await db.from('help_requests').delete().eq('id',created.id);
    console.error('help request upload failed',e);
    return reply(503,{error:'Documentele nu au putut fi salvate. Încearcă din nou.'});
  }
 } catch (e) {console.error('help request invalid payload',e);return reply(400,{error:'Datele trimise nu au putut fi procesate.'});}
});
