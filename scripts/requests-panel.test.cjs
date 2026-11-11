const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const handlers={},events={},calls=[],navigation=[];
 const button={},message={};
 const form={elements:{drama:{value:'Meu dorama'},notes:{value:'2026'}},querySelector:s=>s==='button'?button:message,addEventListener:(event,fn)=>events[event]=fn};
 const content={innerHTML:'',querySelector:s=>s==='[data-request-form]'?(content.innerHTML.includes('data-request-form')?form:null):null};
 const dialog={open:false,innerHTML:'',setAttribute:()=>{},querySelector:()=>content,addEventListener:(e,f)=>handlers[e]=f,showModal(){this.open=true;},close(){if(this.open){this.open=false;handlers.close();}},remove(){this.removed=true;}};
 const root={append:()=>{},addEventListener:(e,f)=>handlers.root=f,removeEventListener:()=>{delete handlers.root;}};
 let used=0,focused=0;
 const data=()=>({limit:2,used,unlimited:false,requests:used?[{name:'Meu dorama',created_at:'2026-11-11',status:'received'}]:[]});
 const context={Date,encodeURIComponent,esc:String,icon:{},document:{createElement:()=>dialog,activeElement:{focus:()=>focused++},body:{classList:{add:()=>{},remove:()=>{}}}},api:async(path,options)=>{calls.push({path,options});if(options?.method==='POST')used++;return data();}};
 vm.runInNewContext(fs.readFileSync('public/js/requests.js','utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,''),context);
 const panel=context.mountRequestsPanel(root,{state:{me:{user:{}}},navigate:p=>navigation.push(p)});
 return {panel,dialog,content,events,handlers,calls,navigation,context,setUsed:n=>used=n,getFocused:()=>focused};
}
const settle=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
test('requests open over the current page and submit/track without navigation',async()=>{
 const h=harness();h.panel.open();await settle();assert.equal(h.dialog.open,true);assert.match(h.content.innerHTML,/Não encontrou o dorama ou minissérie/);
 assert.match(h.content.innerHTML,/até 2 doramas/);
 const form={elements:{drama:{value:'Meu dorama'},notes:{value:''}},querySelector:()=>({})};
 await h.events.submit({preventDefault(){},currentTarget:form});
 assert.equal(h.calls.filter(c=>c.options?.method==='POST').length,1);assert.match(h.content.innerHTML,/1 de 2 pedidos/);assert.match(h.content.innerHTML,/Pedido recebido/);assert.deepEqual(h.navigation,[]);
 h.dialog.close();assert.equal(h.getFocused(),1);h.panel.dispose();assert.equal(h.dialog.removed,true);
});
test('quota reached retains tracking and shows the unlimited addon',async()=>{
 const h=harness();h.setUsed(2);h.panel.open();await settle();assert.match(h.content.innerHTML,/Receba doramas ilimitados/);assert.match(h.content.innerHTML,/Meus pedidos/);assert.ok(!h.content.innerHTML.includes('data-request-form'));h.panel.dispose();
});
test('navigation cleanup ignores an outstanding request',async()=>{
 const h=harness();let resolve;h.context.api=()=>new Promise(r=>resolve=r);h.panel.open();const before=h.content.innerHTML;h.panel.dispose();resolve({used:0,limit:2,requests:[]});await settle();assert.equal(h.content.innerHTML,before);
});
