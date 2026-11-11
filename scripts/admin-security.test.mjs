import test from 'node:test';
import assert from 'node:assert/strict';
import admin from '../netlify/functions/admin.mjs';
import { totp,verifyTotp,passwordHash,passwordMatches,encryptSecret,decryptSecret,digest } from '../netlify/lib/admin-crypto.mjs';
const endpoint='https://appkingdrama.netlify.app/.netlify/functions/admin';
test('TOTP matches RFC 6238 SHA1 vectors and validates the six-digit time window',()=>{
 const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
 assert.equal(totp(secret,1,8),'94287082');assert.equal(totp(secret,Math.floor(1111111109/30),8),'07081804');
 assert.equal(verifyTotp(secret,'287082',59000),1);assert.equal(verifyTotp(secret,'287082',180000),null);
});
test('password hashes are salted and the encrypted authenticator detects tampering',async()=>{
 const hash=await passwordHash('Independent-Secret-123');assert.ok(await passwordMatches('Independent-Secret-123',hash));assert.equal(await passwordMatches('wrong',hash),false);
 assert.notEqual(hash,await passwordHash('Independent-Secret-123'));const key=Buffer.alloc(32,9).toString('base64url'),packed=encryptSecret('ABCDEF',key);assert.equal(decryptSecret(packed,key),'ABCDEF');assert.throws(()=>decryptSecret(packed.slice(0,-2)+'AA',key));
});
test('independent console authentication and data boundary',async suite=>{
 const oldFetch=global.fetch,previous={...process.env};process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='server-only-key';process.env.ADMIN_CONSOLE_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64url');
 const bootstrap='a'.repeat(43),password='Independent-Secret-123';let record={id:1,active:false,bootstrap_hash:digest(bootstrap),bootstrap_expires:new Date(Date.now()+86400000).toISOString(),last_counter:-1},session=null,locked=false,calls=[];
 global.fetch=async(input,options)=>{
  const url=new URL(input),body=options.body?JSON.parse(options.body):{};calls.push(url.pathname);
  assert.equal(options.headers.Authorization,'Bearer server-only-key');assert.ok(!url.pathname.startsWith('/auth/'));
  if(url.pathname==='/rest/v1/admin_console_credentials'){
   if(options.method==='PATCH'){record={...record,...body};return Response.json([record]);}return Response.json([record]);
  }
  const name=url.pathname.split('/').at(-1);
  if(name==='admin_console_attempt')return Response.json(!locked);
  if(name==='admin_console_commit_login'){
   if(body.p_counter<=record.last_counter||body.p_secret!==record.totp_secret)return Response.json(false);
   record={...record,active:true,bootstrap_hash:null,last_counter:body.p_counter};session={cookie:body.p_cookie,page:body.p_page};return Response.json(true);
  }
  if(name==='admin_console_validate')return Response.json(!!session&&body.p_cookie===session.cookie&&body.p_page===session.page);
  if(name==='admin_console_revoke'){session=null;return Response.json(null);}
  if(name==='admin_console_dashboard')return Response.json({counts:{users:2}});
  if(name==='admin_console_drama_requests')return Response.json({requests:[],titles:[]});
  if(name==='admin_console_update_drama_request')return Response.json(true);
  throw Error('Unexpected endpoint '+name);
 };
 const post=(body,extra={})=>admin(new Request(endpoint,{method:'POST',headers:{origin:new URL(endpoint).origin,'content-type':'application/json',...extra},body:JSON.stringify(body)}));
 let secret,pageToken,cookie;
 try{
  await suite.test('platform JWTs cannot open the console',async()=>{
   const r=await admin(new Request(endpoint,{headers:{authorization:'Bearer e30.e30.signature'}}));assert.equal(r.status,401);assert.equal(calls.length,0);
  });
  await suite.test('setup requires the one-time owner link and confirmed password',async()=>{
   assert.equal((await post({action:'setup-begin',token:'wrong'})).status,403);
   assert.equal((await post({action:'setup-begin',token:bootstrap,username:'console',password,confirmPassword:'different'})).status,400);
   const r=await post({action:'setup-begin',token:bootstrap,username:'console',password,confirmPassword:password});assert.equal(r.status,200);secret=(await r.json()).secret;assert.ok(secret);assert.notEqual(record.totp_secret,secret);assert.ok(!record.password_hash.includes(password));
  });
  await suite.test('setup becomes active only after the new authenticator is verified',async()=>{
   assert.equal((await post({action:'setup-finish',token:bootstrap,code:'bad'})).status,401);
   const r=await post({action:'setup-finish',token:bootstrap,code:totp(secret,Math.floor(Date.now()/30000))});assert.equal(r.status,200);pageToken=(await r.json()).pageToken;cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);assert.equal(record.active,true);
   assert.equal((await post({action:'setup-begin',token:bootstrap})).status,403);
  });
  await suite.test('a new page cannot authenticate with the cookie alone',async()=>{
   assert.equal((await admin(new Request(endpoint,{headers:{cookie}}))).status,401);
   assert.equal((await admin(new Request(endpoint,{headers:{'x-admin-session':pageToken}}))).status,401);
   const r=await admin(new Request(endpoint,{headers:{cookie,'x-admin-session':pageToken}}));assert.equal(r.status,200);assert.deepEqual((await r.json()).counts,{users:2});
   assert.equal((await admin(new Request(endpoint+'?view=requests',{headers:{cookie,'x-admin-session':pageToken}}))).status,200);
  });
  await suite.test('password alone, bad OTP and repeated OTP never create a session',async()=>{
   assert.equal((await post({action:'login',username:'console',password,code:''})).status,401);
   assert.equal((await post({action:'login',username:'console',password:'wrong',code:totp(secret,Math.floor(Date.now()/30000))})).status,401);
   assert.equal((await post({action:'login',username:'console',password,code:totp(secret,Math.floor(Date.now()/30000))})).status,401);
  });
  await suite.test('cross-origin actions are rejected and attempts can be locked',async()=>{
   assert.equal((await post({action:'logout'},{origin:'https://other.invalid'})).status,403);
   assert.equal((await admin(new Request(endpoint,{method:'POST',body:'{}'}))).status,403);
   locked=true;assert.equal((await post({action:'login',username:'console',password,code:'123456'})).status,429);locked=false;
  });
  await suite.test('logout revokes server access and errors do not expose secrets',async()=>{
   assert.equal((await post({action:'logout'},{cookie})).status,200);
   assert.equal((await admin(new Request(endpoint,{headers:{cookie,'x-admin-session':pageToken}}))).status,401);
   global.fetch=async()=>{throw Error('server-only-key')};const r=await admin(new Request(endpoint+'?view=status'));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('server-only-key'));
  });
 }finally{global.fetch=oldFetch;for(const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_CONSOLE_ENCRYPTION_KEY']){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
