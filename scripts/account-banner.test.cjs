const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public/js/account-banner.js','utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,'');
function setup(reduced=false){
 const timers=new Map(),events={},motionEvents={};let id=0;
 const node=()=>({handlers:{},attrs:{},addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(name,value){this.attrs[name]=value;}});
 const slides=[node(),node(),node()];slides.forEach((s,i)=>s.hidden=i!==0);
 const dots=[node(),node(),node()];dots.forEach((d,i)=>d.dataset={promoDot:String(i)});
 const controls={'[data-promo-prev]':node(),'[data-promo-next]':node(),'[data-promo-pause]':node(),'.promo-slides':node()};
 const banner=node();banner.querySelector=selector=>controls[selector];banner.querySelectorAll=selector=>selector==='[data-promo-slide]'?slides:dots;banner.contains=()=>false;
 const document={hidden:false,addEventListener:(key,fn)=>events[key]=fn,removeEventListener:key=>delete events[key]};
 const motion={matches:reduced,addEventListener:(key,fn)=>motionEvents[key]=fn,removeEventListener:key=>delete motionEvents[key]};
 const context={esc:value=>String(value),icon:new Proxy({},{get:()=>''}),encodeURIComponent,document,matchMedia:()=>motion,setInterval:(fn,delay)=>{assert.equal(delay,5000);timers.set(++id,fn);return id;},clearInterval:key=>timers.delete(key)};
 vm.runInNewContext(source,context);
 return {context,slides,dots,controls,banner,timers,events,motionEvents,document,root:{querySelector:()=>banner}};
}
test('messages link to requests, the supplied WhatsApp and referrals with exactly ten days',()=>{
 const {context}=setup();const html=context.accountBanner(false);
 assert.ok(html.includes('href="/pedidos"'));assert.ok(html.includes('href="/indicacoes"'));assert.ok(html.includes('https://wa.me/5551920048910?'));
 assert.ok(html.includes('você ganha 10 dias'));assert.ok(!html.includes('15 dias'));
 assert.ok(html.includes('promo-request-shortcut'));assert.ok(!context.accountBanner(true).includes('promo-request-shortcut'));
 assert.ok(!html.includes('href="/admin"'));
});
test('automatic rotation cycles every five seconds with no manual navigation controls',()=>{
 const h=setup();const html=h.context.accountBanner(false);
 assert.ok(!html.includes('data-promo-prev'));assert.ok(!html.includes('data-promo-next'));assert.ok(!html.includes('data-promo-pause'));assert.ok(!html.includes('data-promo-dot'));
 const cleanup=h.context.mountAccountBanner(h.root);
 assert.equal(h.timers.size,1);
 const tick=[...h.timers.values()][0];
 tick();assert.deepEqual(h.slides.map(s=>s.hidden),[true,false,true]);
 tick();assert.deepEqual(h.slides.map(s=>s.hidden),[true,true,false]);
 tick();assert.deepEqual(h.slides.map(s=>s.hidden),[false,true,true]);
 h.document.hidden=true;h.events.visibilitychange();assert.equal(h.timers.size,0);
 h.document.hidden=false;h.events.visibilitychange();assert.equal(h.timers.size,1);
 cleanup();assert.equal(h.timers.size,0);assert.equal(h.events.visibilitychange,undefined);
});
test('keyboard focus keeps the selected link stable until focus leaves',()=>{
 const h=setup();h.context.mountAccountBanner(h.root);
 h.banner.handlers.focusin();assert.equal(h.timers.size,0);
 h.banner.handlers.focusout({relatedTarget:null});assert.equal(h.timers.size,1);
});
