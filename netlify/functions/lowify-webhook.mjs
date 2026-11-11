import {createHash} from 'node:crypto';
import {payloadShape,readLimited} from '../lib/lowify-capture.mjs';
import {normalizeLowifyPayment} from '../lib/lowify-payment.mjs';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const env=name=>globalThis.Netlify?.env?.get(name)||process.env[name];
// Unauthenticated requests capture redacted structure only. Paid processing requires
// an owner-configured shared secret AND an explicit server-side product mapping.
export default async function lowifyWebhook(request) {
  if(request.method==='GET')return reply(200,{endpoint:'lowify',mode:'validation_pending',automaticActivation:false});
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!key)return reply(503,{error:'Receiver unavailable'});
  try {
    const raw=await readLimited(request);
    if(!raw.trim())return reply(400,{error:'Empty payload'});
    const type=(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    let payload;
    if(type==='application/x-www-form-urlencoded')payload=Object.fromEntries(new URLSearchParams(raw));
    else {try{payload=JSON.parse(raw);}catch{return reply(400,{error:'Invalid JSON'});}}
    if(!payload||typeof payload!=='object')return reply(400,{error:'Invalid payload'});
    const url=new URL(request.url);
    const token=url.searchParams.get('token')||request.headers.get('authorization')?.replace(/^Bearer /i,'');
    if(token) {
      if(!/^[A-Za-z0-9_-]{43}$/.test(token))return reply(401,{error:'Unauthorized'});
      let order;
      try{order=normalizeLowifyPayment(payload);}catch{return reply(400,{error:'Invalid paid sale'});}
      // Authenticate ignored events too; a paid status alone never proves origin.
      const received=await fetch(`${base}/rest/v1/rpc/receive_lowify_paid_order`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_token_hash:createHash('sha256').update(token).digest('hex'),p_order:order||{event:payload.event,status:payload.status}}),signal:AbortSignal.timeout(20000),redirect:'error'});
      if(!received.ok)return reply(503,{error:'Payment could not be processed'});
      const result=await received.json();
      if(result.state==='unauthorized')return reply(401,{error:'Unauthorized'});
      if(result.state==='invalid')return reply(400,{error:'Invalid paid sale'});
      if(result.state==='conflict')return reply(409,{error:'Order data conflict'});
      return reply(200,{received:true,state:result.state});
    }
    const shape=payloadShape(payload);
    const headerNames=[...request.headers.keys()].filter(h=>/signature|token|authorization|lowify|webhook/i.test(h)).slice(0,30);
    const digest=createHash('sha256').update(JSON.stringify({shape,headerNames})).digest('hex');
    const result=await fetch(`${base}/rest/v1/rpc/capture_lowify_schema`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_digest:digest,p_shape:shape,p_header_names:headerNames,p_content_type:type.slice(0,100)}),signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!result.ok)return reply(503,{error:'Receipt could not be stored'});
    if(await result.json()!==true)return reply(429,{error:'Discovery capture limit reached'});
    return reply(200,{received:true,mode:'validation_pending',automaticActivation:false});
  } catch(error){return reply(error.status===413?413:503,{error:error.status===413?'Payload too large':'Receiver unavailable'});}
}
