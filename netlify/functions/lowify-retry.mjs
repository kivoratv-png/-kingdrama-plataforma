// Reconcile previously authenticated payments after product mapping or account signup.
export default async function retryLowify() {
 const env=name=>globalThis.Netlify?.env?.get(name)||process.env[name];
 const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
 const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(!base||!key)return reply(503,{error:'Retry unavailable'});
 try {
  const r=await fetch(`${base}/rest/v1/rpc/retry_lowify_paid_orders`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!r.ok)return reply(503,{error:'Retry failed'});
  return reply(200,await r.json());
 }catch{return reply(503,{error:'Retry failed'});}
}
export const config={schedule:'*/5 * * * *'};
