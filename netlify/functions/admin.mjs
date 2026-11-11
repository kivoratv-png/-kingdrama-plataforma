import { digest, randomToken, equal, passwordHash, passwordMatches, newSecret, encryptSecret, decryptSecret, verifyTotp, consoleEncryptionKey } from '../lib/admin-crypto.mjs';
const COOKIE='__Host-kd_admin';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer',Vary:'Cookie, X-Admin-Session'};
const reply=(status,body,cookie)=>new Response(JSON.stringify(body),{status,headers:{...headers,...(cookie?{'Set-Cookie':cookie}:{})}});
const cookieValue=request=>(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
const cookie=(value,remove=false)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict${remove?'; Max-Age=0':''}`;
const env=name=>globalThis.Netlify?.env?.get(name)||process.env[name];
export default async function admin(request){
 const url=new URL(request.url),origin=request.headers.get('origin');
 if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return reply(403,{error:'Origem não permitida.'});
 if(!['GET','POST'].includes(request.method))return reply(405,{error:'Método não permitido.'});
 if(request.method==='POST'&&origin!==url.origin)return reply(403,{error:'Origem não permitida.'});
 const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
 if(!base||!key)return reply(503,{error:'Painel temporariamente indisponível.'});
 const encryption=consoleEncryptionKey(key);
 const call=async(path,method='POST',body)=>{
  const response=await fetch(base+path,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Database unavailable');return response.status===204?null:response.json();
 };
 const rpc=(name,body={})=>call('/rest/v1/rpc/'+name,'POST',body);
 try{
  let body={};if(request.method==='POST'){const raw=await request.text();if(raw.length>8192)return reply(400,{error:'Pedido inválido.'});try{body=JSON.parse(raw);}catch{return reply(400,{error:'Pedido inválido.'});}}
  const action=body.action;
  if(request.method==='GET'&&url.searchParams.get('view')==='status'){
   const rows=await call('/rest/v1/admin_console_credentials?select=active&id=eq.1','GET');return reply(200,{configured:rows[0]?.active===true});
  }
  if(action==='logout'){
   const value=cookieValue(request);if(/^[\w-]{43}$/.test(value))await rpc('admin_console_revoke',{p_cookie:digest(value)});
   return reply(200,{ok:true},cookie('',true));
  }
  if(['login','setup-begin','setup-finish'].includes(action)){
   const rows=await call('/rest/v1/admin_console_credentials?select=*&id=eq.1','GET');const record=rows[0];
   if(!record)return reply(503,{error:'Configuração inicial indisponível.'});
   const setup=action!=='login';
   if(setup&&(record.active||typeof body.token!=='string'||!equal(digest(body.token),record.bootstrap_hash||'')||Date.parse(record.bootstrap_expires)<=Date.now()))return reply(403,{error:'Link de configuração inválido, expirado ou já utilizado.'});
   if(!await rpc('admin_console_attempt'))return reply(429,{error:'Muitas tentativas. Aguarde cinco minutos.'});
   if(action==='setup-begin'){
    if(typeof body.username!=='string'||!/^[a-zA-Z0-9_.-]{3,40}$/.test(body.username)||typeof body.password!=='string'||body.password.length<12||body.password.length>128||body.password!==body.confirmPassword)return reply(400,{error:'Use um usuário de 3 a 40 caracteres e repita uma senha de 12 a 128 caracteres.'});
    const secret=newSecret(),hash=await passwordHash(body.password);
    const updated=await call('/rest/v1/admin_console_credentials?id=eq.1&active=eq.false&bootstrap_hash=eq.'+digest(body.token),'PATCH',{username:body.username.toLowerCase(),password_hash:hash,totp_secret:encryptSecret(secret,encryption),pending_expires:new Date(Date.now()+20*60000).toISOString()});
    if(!updated.length)return reply(403,{error:'Link de configuração já utilizado.'});
    return reply(200,{secret,issuer:'KINGDRAMA Painel',username:body.username.toLowerCase()});
   }
   if(action==='login'){
    if(typeof body.username!=='string'||body.username.length>40||typeof body.password!=='string'||body.password.length>128||!record.active||!equal(body.username.toLowerCase(),record.username||'')||!await passwordMatches(body.password,record.password_hash))return reply(401,{error:'Usuário, senha ou código inválido.'});
   }else if(!record.pending_expires||Date.parse(record.pending_expires)<=Date.now()||!record.password_hash||!record.totp_secret)return reply(400,{error:'Recomece a configuração do autenticador.'});
   const counter=verifyTotp(decryptSecret(record.totp_secret,encryption),String(body.code||''));
   if(counter===null)return reply(401,{error:setup?'Código inválido. Confira o aplicativo autenticador.':'Usuário, senha ou código inválido.'});
   const browser=randomToken(),pageToken=randomToken();
   const committed=await rpc('admin_console_commit_login',{p_counter:counter,p_cookie:digest(browser),p_page:digest(pageToken),p_setup:setup?digest(body.token):null,p_secret:record.totp_secret});
   if(!committed)return reply(401,{error:'Código já usado ou expirado. Aguarde o próximo código do autenticador.'});
   return reply(200,{pageToken},cookie(browser));
  }
  // App JWTs and account cookies never authenticate this boundary.
  const browser=cookieValue(request),pageToken=request.headers.get('x-admin-session')||'';
  if(!/^[\w-]{43}$/.test(browser)||!/^[\w-]{43}$/.test(pageToken)||!await rpc('admin_console_validate',{p_cookie:digest(browser),p_page:digest(pageToken)}))return reply(401,{error:'Entre no painel com usuário, senha e autenticador.'},cookie('',true));
  if(request.method==='GET'){
   if(url.searchParams.get('view')==='requests')return reply(200,await rpc('admin_console_drama_requests'));
   const search=(url.searchParams.get('search')||'').trim(),page=url.searchParams.get('page')||'0';
   if(search.length>100||!/^\d{1,6}$/.test(page)||Number(page)>100000)return reply(400,{error:'Filtro inválido.'});
   return reply(200,await rpc('admin_console_dashboard',{p_search:search,p_page:Number(page)}));
  }
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if(action==='request-update'){
   if(!uuid.test(body.id||'')||!['received','reviewing','adding','available','unavailable'].includes(body.status)||typeof body.note!=='string'||body.note.length>1000||(body.title!==null&&(typeof body.title!=='string'||body.title.length>120)))return reply(400,{error:'Dados do pedido inválidos.'});
   return reply(200,{ok:await rpc('admin_console_update_drama_request',{p_id:body.id,p_status:body.status,p_title:body.title,p_note:body.note})});
  }
  if(action==='request-addon'){
   if(!uuid.test(body.user||'')||(body.until!==null&&(!Number.isFinite(Date.parse(body.until))||Date.parse(body.until)<=Date.now())))return reply(400,{error:'Usuário ou validade inválidos.'});
   await rpc('admin_console_set_request_addon',{p_user:body.user,p_until:body.until});return reply(200,{ok:true});
  }
  return reply(400,{error:'Ação inválida.'});
 }catch{return reply(503,{error:'Painel temporariamente indisponível. Tente novamente.'});}
}
export const config={rateLimit:{windowLimit:90,windowSize:60,aggregateBy:'ip',action:'rate_limit'}};
