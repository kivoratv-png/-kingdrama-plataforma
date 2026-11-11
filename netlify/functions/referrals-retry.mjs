// Retry only jobs created by trusted database subscription activations.
// No request body, user ID, payment status or reward amount is accepted here.
export default async function retryReferrals() {
  const base=globalThis.Netlify?.env?.get('SUPABASE_URL') || process.env.SUPABASE_URL;
  const key=globalThis.Netlify?.env?.get('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
  if(!base || !key)return response(503,{error:'Rotina temporariamente indisponível.'});
  try {
    const result=await fetch(`${base}/rest/v1/rpc/retry_referral_activations`,{
      method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({p_limit:20}),redirect:'error',signal:AbortSignal.timeout(20000),
    });
    if(!result.ok)return response(503,{error:'Não foi possível processar as indicações pendentes.'});
    return response(200,await result.json());
  }catch{return response(503,{error:'Não foi possível processar as indicações pendentes.'});}
}
export const config={schedule:'*/5 * * * *'};
