const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public/js/category-menu.js','utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,'');
function setup({desktop=false,api}={}){
 const events={},windowEvents={};
 const node=()=>({handlers:{},attrs:{},style:{},hidden:true,innerHTML:'',addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(key,value){this.attrs[key]=value;},contains(target){return target===this;},focus(){this.focused=true;},getBoundingClientRect:()=>({left:210,bottom:60})});
 const triggers=[node(),node()],panel=node();panel.querySelector=()=>null;
 const context={api:api||(async()=>({categories:[{id:'romance',name:'Romance',cover:'ignored.webp'}]})),esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:new Proxy({},{get:()=>''}),encodeURIComponent,location:{pathname:'/categoria/romance'},matchMedia:()=>({matches:desktop}),window:{innerWidth:1024,addEventListener:(key,fn)=>windowEvents[key]=fn,removeEventListener:key=>delete windowEvents[key]},document:{addEventListener:(key,fn)=>events[key]=fn,removeEventListener:key=>delete events[key]}};
 vm.runInNewContext(source,context);
 return {context,triggers,panel,events,windowEvents,root:{querySelector:()=>panel,querySelectorAll:()=>triggers}};
}
test('category list links directly to the selected category without cover images',()=>{
 const {context}=setup();const html=context.categoryLinks([{id:'romance',name:'Romance',cover:'ignored.webp'},{id:'x/y',name:'<Teste>'}],'/categoria/romance');
 assert.ok(html.includes('href="/categoria/romance" aria-current="page"'));assert.ok(html.includes('/categoria/x%2Fy'));
 assert.ok(html.includes('&lt;Teste>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('ignored.webp'));
});
test('mobile category button opens in place, closes on Escape/outside click and cleans up',async()=>{
 const h=setup(),cleanup=h.context.mountCategoryMenu(h.root);
 await h.triggers[1].handlers.click();assert.equal(h.panel.hidden,false);assert.equal(h.triggers[1].attrs['aria-expanded'],'true');assert.equal(h.context.location.pathname,'/categoria/romance');
 assert.equal(h.panel.style.left,'16px');assert.ok(h.panel.innerHTML.includes('/categoria/romance'));
 h.events.keydown({key:'Escape',preventDefault:()=>{}});assert.equal(h.panel.hidden,true);assert.equal(h.triggers[1].focused,true);
 await h.triggers[1].handlers.click();h.events.click({target:{}});assert.equal(h.panel.hidden,true);
 cleanup();assert.equal(Object.keys(h.events).length,0);assert.equal(Object.keys(h.windowEvents).length,0);
});
test('desktop dropdown anchors below the trigger and ignores a response after navigation cleanup',async()=>{
 let resolve;const h=setup({desktop:true,api:()=>new Promise(done=>resolve=done)}),cleanup=h.context.mountCategoryMenu(h.root);
 const opening=h.triggers[0].handlers.click();assert.equal(h.panel.style.top,'70px');assert.equal(h.panel.style.left,'210px');
 cleanup();resolve({categories:[{id:'romance',name:'Romance'}]});await opening;
 assert.equal(h.panel.hidden,true);assert.ok(!h.panel.innerHTML.includes('href="/categoria/romance"'));
});
