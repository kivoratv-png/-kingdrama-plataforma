import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLowifyPayment} from '../netlify/lib/lowify-payment.mjs';
import handler from '../netlify/functions/lowify-webhook.mjs';
const example={event:'sale.paid',order_id:'ord_test',sale_amount:97,status:'paid',timestamp:'2026-01-31 20:35:13',product:{id:42,name:'Example',price:97,type:'principal'},customer:{email:' Person@Example.invalid ',name:'Private',phone:'11999999999'},tracking:{utm_source:'any'}};
test('Lowify structure normalizes numeric product ID, email and Brazilian local timestamp',()=>{
 const result=normalizeLowifyPayment(example);
 assert.equal(result.product_id,'42');assert.equal(result.email,'person@example.invalid');assert.equal(result.paid_at,'2026-01-31T23:35:13.000Z');assert.ok(!JSON.stringify(result).includes('Private'));assert.ok(!('tracking' in result));
});
test('pending, malformed and future sales do not produce a paid activation',()=>{
 assert.equal(normalizeLowifyPayment({...example,event:'sale.pending'}),null);
 for(const change of [{sale_amount:0},{sale_amount:'97'},{timestamp:'invalid'},{timestamp:'2999-01-01 12:00:00'},{customer:{email:'bad'}},{product:{id:0}},{order_id:''}])assert.throws(()=>normalizeLowifyPayment({...example,...change}));
});
test('authenticated request hashes its secret and calls only the trusted payment RPC',async()=>{
 const oldFetch=globalThis.fetch,oldNetlify=globalThis.Netlify;const calls=[];
 globalThis.Netlify={env:{get:n=>({SUPABASE_URL:'https://db.invalid',SUPABASE_SERVICE_ROLE_KEY:'key'})[n]}};
 globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json({state:'pending_product'});};
 try {
  const r=await handler(new Request('https://site.invalid/lowify?token='+'a'.repeat(43),{method:'POST',body:JSON.stringify(example)}));
  assert.equal(r.status,200);assert.equal((await r.json()).state,'pending_product');assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/rpc/receive_lowify_paid_order'));assert.match(calls[0].body.p_token_hash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(calls).includes('a'.repeat(43)));
  globalThis.fetch=async()=>Response.json({state:'unauthorized'});
  const rejected=await handler(new Request('https://site.invalid/lowify?token='+'b'.repeat(43),{method:'POST',body:JSON.stringify(example)}));assert.equal(rejected.status,401);
 }finally{globalThis.fetch=oldFetch;globalThis.Netlify=oldNetlify;}
});
