import {test} from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/lowify-webhook.mjs';
import {payloadShape} from '../netlify/lib/lowify-capture.mjs';
test('capture removes customer data and secrets while preserving structure',()=>{
 const shape=payloadShape({buyer:{email:'person@example.invalid',phone:'11999999999'},token:'secret',product_id:'P3QfUF',status:'paid',amount:2490});
 assert.deepEqual(shape,{buyer:{email:'<string>',phone:'<string>'},token:'<string>',product_id:'P3QfUF',status:'paid',amount:'<number>'});
});
test('receiver persists redacted samples only, never subscription writes',async()=>{
 const fetchBefore=globalThis.fetch,netlifyBefore=globalThis.Netlify;
 const calls=[];
 globalThis.Netlify={env:{get:name=>({SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-secret'})[name]}};
 globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json(true);};
 try {
  let r=await handler(new Request('https://site.invalid/.netlify/functions/lowify-webhook'));assert.equal(r.status,200);assert.equal((await r.json()).automaticActivation,false);
  r=await handler(new Request('https://site.invalid/lowify',{method:'POST',headers:{'Content-Type':'application/json','X-Signature':'private-signature'},body:JSON.stringify({email:'person@example.invalid',status:'paid'})}));
  assert.equal(r.status,200);assert.equal((await r.json()).automaticActivation,false);assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/rpc/capture_lowify_schema'));assert.equal(calls[0].body.p_shape.email,'<string>');assert.deepEqual(calls[0].body.p_header_names,['x-signature']);assert.ok(!JSON.stringify(calls[0]).includes('private-signature'));
  r=await handler(new Request('https://site.invalid/lowify',{method:'POST',body:'bad json'}));assert.equal(r.status,400);
  r=await handler(new Request('https://site.invalid/lowify',{method:'POST',body:'x'.repeat(32769)}));assert.equal(r.status,413);assert.equal(calls.length,1);
  globalThis.fetch=async()=>Response.json(false);
  r=await handler(new Request('https://site.invalid/lowify',{method:'POST',body:'{}'}));assert.equal(r.status,429);
  globalThis.fetch=async()=>new Response('',{status:500});
  r=await handler(new Request('https://site.invalid/lowify',{method:'POST',body:'{}'}));assert.equal(r.status,503);
 }finally{globalThis.fetch=fetchBefore;globalThis.Netlify=netlifyBefore;}
});
