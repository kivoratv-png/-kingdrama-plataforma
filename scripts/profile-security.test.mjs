import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/account.mjs';
const original=global.fetch;
after(()=>{global.fetch=original;});
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-only';
const request=(body,headers={})=>new Request('https://kingdrama.test/.netlify/functions/account',{
  method:'POST',headers:{authorization:'Bearer a.b.c','Content-Type':'application/json',...headers},body:JSON.stringify(body),
});
const valid={action:'password',currentPassword:'old-password',password:'new-password',confirmPassword:'new-password'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('rejects unauthenticated and cross-origin mutations',async()=>{
  global.fetch=()=>{throw Error('Upstream must not be called');};
  assert.equal((await handler(request(valid,{authorization:''}))).status,401);
  assert.equal((await handler(request(valid,{origin:'https://attacker.test'}))).status,403);
});
test('validates both new passwords and explicit deletion confirmation',async()=>{
  global.fetch=()=>{throw Error('Upstream must not be called');};
  assert.equal((await handler(request({...valid,confirmPassword:'different'}))).status,400);
  assert.equal((await handler(request({action:'delete',currentPassword:'old-password'}))).status,400);
});
test('incorrect current password never reaches mutation',async()=>{
  const calls=[];
  global.fetch=async(url)=>{calls.push(url);if(url.endsWith('/user'))return json({id:'own',email:'own@example.invalid'});if(url.includes('account_devices'))return json({devices:[{current:true}]});return json({},400);};
  assert.equal((await handler(request(valid))).status,400);
  assert.equal(calls.some(url=>url.includes('/admin/users/')),false);
});
test('revoked sessions cannot change password or delete account',async()=>{
  global.fetch=async(url)=>url.endsWith('/user')?json({id:'own',email:'own@example.invalid'}):json({devices:[]});
  assert.equal((await handler(request(valid))).status,401);
});
test('password confirmation cleans temporary session before updating verified user',async()=>{
  const calls=[];
  global.fetch=async(url,options)=>{
    calls.push({url,...options});
    if(url.endsWith('/user'))return json({id:'own',email:'own@example.invalid'});
    if(url.includes('account_devices'))return json({devices:[{current:true}]});
    if(url.includes('/token?'))return json({user:{id:'own'},access_token:'verification-token'});
    if(url.includes('/logout?'))return new Response(null,{status:204});
    return json({id:'own'});
  };
  assert.equal((await handler(request({...valid,userId:'someone-else'}))).status,200);
  assert.ok(calls.at(-2).url.endsWith('/logout?scope=local'));
  assert.ok(calls.at(-1).url.endsWith('/admin/users/own'));
  assert.deepEqual(JSON.parse(calls.at(-1).body),{password:'new-password'});
});
test('deletes only verified account after explicit confirmation',async()=>{
  let deletion;
  global.fetch=async(url,options)=>{
    if(url.endsWith('/user'))return json({id:'own',email:'own@example.invalid'});
    if(url.includes('account_devices'))return json({devices:[{current:true}]});
    if(url.includes('/token?'))return json({user:{id:'own'},access_token:'verification-token'});
    if(url.includes('/logout?'))return new Response(null,{status:204});
    deletion={url,...options}; return json({});
  };
  assert.equal((await handler(request({action:'delete',currentPassword:'old-password',confirmDelete:true,userId:'someone-else'}))).status,200);
  assert.equal(deletion.method,'DELETE');assert.ok(deletion.url.endsWith('/admin/users/own'));
});
