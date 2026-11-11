const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export default async function login(request) {
  if(request.method!=='POST')return reply(405,{error:'Método não permitido.'});
  const origin=request.headers.get('origin');
  if((origin && origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return reply(403,{error:'Origem não permitida.'});
  const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key)return reply(503,{error:'Login temporariamente indisponível.'});
  const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  try {
    const raw=await request.text();if(raw.length>4096)return reply(400,{error:'Dados inválidos.'});
    let body;try{body=JSON.parse(raw);}catch{return reply(400,{error:'Dados inválidos.'});}
    if(!/^[1-9][0-9]{9,10}$/.test(body?.whatsapp || '') || typeof body.password!=='string'||!body.password||body.password.length>1024)return reply(400,{error:'Informe o WhatsApp com DDD e sua senha.'});
    const call=(path,method='GET',data)=>fetch(base+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(12000)});
    const contactResponse=await call(`/rest/v1/account_contacts?select=user_id&whatsapp=eq.${encodeURIComponent(body.whatsapp)}&limit=1`);
    if(!contactResponse.ok)return reply(503,{error:'Login temporariamente indisponível.'});
    const contact=(await contactResponse.json())[0];
    let email=`unknown-${crypto.randomUUID()}@example.invalid`;
    if(contact){const user=await call(`/auth/v1/admin/users/${encodeURIComponent(contact.user_id)}`);if(!user.ok)return reply(503,{error:'Login temporariamente indisponível.'});email=(await user.json()).email;}
    const result=await call('/auth/v1/token?grant_type=password','POST',{email,password:body.password});
    if(!result.ok)return reply(result.status===429?429:401,{error:result.status===429?'Muitas tentativas. Aguarde antes de tentar novamente.':'WhatsApp ou senha incorretos.'});
    const data=await result.json();
    return reply(200,{access_token:data.access_token,refresh_token:data.refresh_token});
  }catch{return reply(503,{error:'Não foi possível entrar. Tente novamente.'});}
}
export const config={rateLimit:{windowLimit:10,windowSize:60,aggregateBy:'ip',action:'rate_limit'}};
