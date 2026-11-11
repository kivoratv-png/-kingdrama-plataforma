const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

async function startup({loaded,published,url='https://kingdrama.test/'}) {
  const redirects=[],requests=[],cleaned=[];
  const handlers={};
  const source=fs.readFileSync(path.join(__dirname,'../public/js/app.js'),'utf8')
    .replace(/^import .+;\r?\n/gm,'').replace(/export /g,'')
    .replace(/import\.meta\.url/g,JSON.stringify(`https://kingdrama.test/js/app.js?v=${loaded}`))
    .replace('(async function boot()','globalThis.boot=(async function boot()');
  const app={innerHTML:''};
  const context={URL,URLSearchParams,Date,console,
    document:{hidden:false,getElementById:()=>app,querySelector:()=>({content:loaded}),addEventListener:(name,fn)=>{handlers[name]=fn;}},
    window:{addEventListener:(name,fn)=>{handlers[name]=fn;},scrollTo:()=>{}},
    location:{href:url,pathname:new URL(url).pathname,search:new URL(url).search,hash:'',replace:to=>redirects.push(to)},
    history:{state:null,replaceState:(_,unused,to)=>cleaned.push(to)},
    pages:{landing:async()=>'<p>Home</p>'},authPages:{},profile:()=>'',privacy:()=>'',requests:()=>'',dashboard:()=>'',
    enhance:()=>{},sendActivity:()=>{},clearActivity:()=>{},
    fetch:async(path,options)=>{requests.push({path,options});return {ok:true,json:async()=>({versao:published})};},
    api:async path=>path==='/api/me'?{user:null}:{},
  };
  vm.runInNewContext(source,context);await context.boot;
  return {redirects,requests,cleaned,handlers,app};
}
test('cached document compares its actual loaded version to the latest release before boot',async()=>{
  const result=await startup({loaded:'111111111111',published:'222222222222'});
  assert.equal(result.redirects.length,1);assert.equal(new URL(result.redirects[0]).searchParams.get('_kdv'),'222222222222');
  assert.ok(result.requests.every(r=>r.options.cache==='no-store'));
  assert.equal(result.app.innerHTML,'');
});
test('current release starts normally and removes the temporary update marker',async()=>{
  const result=await startup({loaded:'222222222222',published:'222222222222',url:'https://kingdrama.test/?_kdv=222222222222'});
  assert.equal(result.redirects.length,0);assert.deepEqual(result.cleaned,['/']);
  assert.ok(result.app.innerHTML.includes('Home'));
  const before=result.requests.length;await result.handlers.visibilitychange();
  // The event starts the check synchronously and bypasses the normal throttle.
  assert.ok(result.requests.length>before);
});
