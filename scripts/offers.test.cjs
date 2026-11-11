const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const config=JSON.parse(fs.readFileSync('public/config/ofertas.json','utf8'));
const source=fs.readFileSync('public/js/offers.js','utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,'');
function harness(){
  const callbacks={},storage=new Map(),navigation=[];
  const button={addEventListener:(name,fn)=>callbacks.check=fn},feedback={textContent:''};
  const link={dataset:{productId:'P3QfUF',offerCheckout:'monthly'},addEventListener:(name,fn)=>callbacks.checkout=fn};
  const root={querySelector:selector=>selector==='[data-offer-check]'?button:feedback,querySelectorAll:()=>[link]};
  let active=false;
  const context={URL,URLSearchParams,Date,fetch:async()=>({ok:true,json:async()=>config}),esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:new Proxy({},{get:()=>''}),api:async url=>{assert.equal(url,'/api/me?atualizar=1');return {user:{id:'account'},access:{active}};},document:{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}},setInterval:()=>1,clearInterval:()=>{},sessionStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)}};
  vm.runInNewContext(source,context);
  const ctx={query:new URLSearchParams('titulo=drama-a&episodio=3'),state:{me:{user:{id:'account',email:'cliente@example.invalid'},access:{active:false}}},navigate:url=>navigation.push(url)};
  return {context,ctx,root,callbacks,feedback,navigation,setActive:value=>active=value};
}
test('cards use current products, durations and total checkout prices',async()=>{
  const {context,ctx}=harness();const html=await context.offers(ctx);
  for(const id of ['P3QfUF','ZPO7Gw','LD4imo'])assert.ok(html.includes(`https://pay.lowify.com.br/checkout?product_id=${id}`));
  assert.ok(!html.includes('https://pay.lowify.com.br/checkout?product_id=g18z8v'));
  for(const price of ['24,90','79,90','129,90'])assert.ok(html.includes(price));
  assert.deepEqual(config.plans.map(p=>[p.productId,p.period]),[['g18z8v',{days:7}],['P3QfUF',{months:1}],['ZPO7Gw',{months:3}],['LD4imo',{months:6}]]);
  assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'));
  assert.ok(!html.includes('Plano Anual'));
});
test('checkout clicks do not activate accounts; only a fresh server result resumes playback',async()=>{
  const h=harness();const cleanup=h.context.offers.mount(h.root,h.ctx);
  h.callbacks.checkout();assert.equal(h.ctx.state.me.access.active,false);assert.equal(h.navigation.length,0);
  await h.callbacks.check();assert.equal(h.navigation.length,0);assert.ok(h.feedback.textContent.includes('ainda não foi confirmada'));
  h.setActive(true);await h.callbacks.check();assert.deepEqual(h.navigation,['/assistir/drama-a/3']);cleanup();
});
test('return destination rejects external paths and account text is escaped',async()=>{
  const h=harness();h.ctx.query=new URLSearchParams('titulo=https://evil.invalid&episodio=3');h.ctx.state.me.user.email='<img src=x>';
  const html=await h.context.offers(h.ctx);assert.ok(!html.includes('<img src=x>'));assert.ok(html.includes('&lt;img src=x>'));
  h.context.offers.mount(h.root,h.ctx);h.setActive(true);await h.callbacks.check();assert.deepEqual(h.navigation,['/inicio']);
});
