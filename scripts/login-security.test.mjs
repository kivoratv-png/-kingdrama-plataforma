import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import login from '../netlify/functions/login.mjs';
const original=global.fetch;after(()=>{global.fetch=original;});
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='server-only';
const request=(body,origin)=>new Request('https://kingdrama.test/.netlify/functions/login',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
const valid={whatsapp:'11999999999',password:'example-password'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
test('phone login rejects malformed numbers and cross-origin attempts before lookup',async()=>{
  global.fetch=()=>{throw Error('Unexpected upstream request');};
  assert.equal((await login(request({...valid,whatsapp:'abc'}))).status,400);
  assert.equal((await login(request(valid,'https://attacker.test'))).status,403);
});
test('unknown number and wrong password return same public error without account email',async()=>{
  global.fetch=async url=>url.includes('account_contacts')?json([]):json({},400);
  const unknown=await login(request(valid));assert.equal(unknown.status,401);const message=await unknown.json();
  global.fetch=async url=>url.includes('account_contacts')?json([{user_id:'own'}]):url.includes('/admin/users/')?json({email:'private@example.invalid'}):json({},400);
  const wrong=await login(request(valid));assert.equal(wrong.status,401);assert.deepEqual(await wrong.json(),message);
  assert.equal(JSON.stringify(message).includes('private@'),false);
});
test('successful login returns session tokens without private user lookup data',async()=>{
  global.fetch=async url=>url.includes('account_contacts')?json([{user_id:'own'}]):url.includes('/admin/users/')?json({email:'private@example.invalid'}):json({access_token:'access',refresh_token:'refresh',user:{email:'private@example.invalid'}});
  const response=await login(request(valid));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(await response.json(),{access_token:'access',refresh_token:'refresh'});
});
