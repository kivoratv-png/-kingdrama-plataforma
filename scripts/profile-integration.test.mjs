// Live integration against a disposable account; never uses a customer's account.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import env from './env.js';
import account from '../netlify/functions/account.mjs';
const base=env.exige('SUPABASE_URL','testar perfil');
const key=env.exige('SUPABASE_SERVICE_ROLE_KEY','testar perfil');
process.env.SUPABASE_URL=base;process.env.SUPABASE_SERVICE_ROLE_KEY=key;
const email=`profile-test-${randomUUID()}@example.invalid`;
const oldPassword=`A!${randomUUID()}`,newPassword=`B!${randomUUID()}`;
const call=async(path,method,body,token=key)=>{
  const response=await fetch(base+path,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(`Supabase ${method} ${path.split('?')[0]}: HTTP ${response.status}`);
  return data;
};
const mutate=(token,body)=>account(new Request('https://kingdrama.test/.netlify/functions/account',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)}));
let id;
try {
  const user=await call('/auth/v1/admin/users','POST',{email,password:oldPassword,email_confirm:true});id=user.id;
  const first=await call('/auth/v1/token?grant_type=password','POST',{email,password:oldPassword});
  const second=await call('/auth/v1/token?grant_type=password','POST',{email,password:oldPassword});
  assert.equal(await call('/rest/v1/rpc/account_session_allowed','POST',{},first.access_token),true);
  assert.equal(await call('/rest/v1/rpc/account_session_allowed','POST',{},second.access_token),false);
  const devices=await call('/rest/v1/rpc/account_devices','POST',{},second.access_token);
  assert.equal(devices.devices.length,2);
  await call('/rest/v1/rpc/account_revoke_device','POST',{p_session:devices.devices.find(d=>!d.current).id},second.access_token);
  assert.equal(await call('/rest/v1/rpc/account_session_allowed','POST',{},first.access_token),false);
  assert.equal(await call('/rest/v1/rpc/account_session_allowed','POST',{},second.access_token),true);
  assert.equal((await mutate(second.access_token,{action:'password',currentPassword:'incorrect',password:newPassword,confirmPassword:newPassword})).status,400);
  const changed=await mutate(second.access_token,{action:'password',currentPassword:oldPassword,password:newPassword,confirmPassword:newPassword});
  assert.equal(changed.status,200,await changed.text());
  const fresh=await call('/auth/v1/token?grant_type=password','POST',{email,password:newPassword});
  const deleted=await mutate(fresh.access_token,{action:'delete',currentPassword:newPassword,confirmDelete:true});
  assert.equal(deleted.status,200,await deleted.text());
  id=null;
  console.log('Integração aprovada: senha incorreta rejeitada, senha alterada, sessões limitadas/revogadas e conta temporária excluída.');
} finally { if(id)await call(`/auth/v1/admin/users/${id}`,'DELETE',{should_soft_delete:false}); }
