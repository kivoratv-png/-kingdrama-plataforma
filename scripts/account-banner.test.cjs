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
 const context={esc:value=>String(value),icon:new Proxy({},{get:()=>''}),encodeURIComponent,document,matchMedia:()=>motion,setInterval:(fn,delay)=>{assert.equal(delay,7000);timers.set(++id,fn);return id;},clearInterval:key=>timers.delete(key)};
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
test('automatic rotation and direct controls keep one visible message and stop on route cleanup',()=>{
 const h=setup();const cleanup=h.context.mountAccountBanner(h.root);
 assert.equal(h.timers.size,1);[...h.timers.values()][0]();assert.deepEqual(h.slides.map(s=>s.hidden),[true,false,true]);
 h.controls['[data-promo-next]'].handlers.click();assert.deepEqual(h.slides.map(s=>s.hidden),[true,true,false]);
 h.dots[0].handlers.click();assert.deepEqual(h.slides.map(s=>s.hidden),[false,true,true]);
 h.controls['[data-promo-pause]'].handlers.click();assert.equal(h.timers.size,0);
 h.controls['[data-promo-pause]'].handlers.click();assert.equal(h.timers.size,1);
 h.document.hidden=true;h.events.visibilitychange();assert.equal(h.timers.size,0);
 cleanup();assert.equal(h.timers.size,0);assert.equal(h.events.visibilitychange,undefined);assert.equal(h.motionEvents.change,undefined);
});
test('reduced motion pauses autoplay and a touch swipe changes messages without following the link',()=>{
 const h=setup(true);h.context.mountAccountBanner(h.root);assert.equal(h.timers.size,0);
 const surface=h.controls['.promo-slides'];surface.handlers.pointerdown({pointerType:'touch',clientX:200});surface.handlers.pointerup({clientX:100});
 assert.deepEqual(h.slides.map(s=>s.hidden),[true,false,true]);
 let prevented=false;surface.handlers.click({preventDefault:()=>prevented=true,stopPropagation:()=>{}});assert.equal(prevented,true);
});
