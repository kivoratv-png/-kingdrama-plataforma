import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import retry from '../netlify/functions/referrals-retry.mjs';
const original=global.fetch;after(()=>{global.fetch=original;});
process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='server-only';
test('retry accepts no customer payment claims and processes only server-created queue',async()=>{
 let call;
 global.fetch=async(url,options)=>{call={url,...options};return new Response(JSON.stringify({attempted:0,completed:0,failed:0}),{status:200});};
 const response=await retry(new Request('https://kingdrama.test/.netlify/functions/referrals-retry',{method:'POST',body:JSON.stringify({user_id:'attacker',days:999,payment_status:'paid'})}));
 assert.equal(response.status,200);assert.equal(call.url,'https://test.supabase.co/rest/v1/rpc/retry_referral_activations');assert.deepEqual(JSON.parse(call.body),{p_limit:20});
 assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('retry upstream failures do not expose server credentials or response details',async()=>{
 global.fetch=async()=>new Response('private-upstream-error',{status:500});
 const response=await retry();assert.equal(response.status,503);const body=await response.text();assert.equal(body.includes('server-only'),false);assert.equal(body.includes('private-upstream'),false);
});
