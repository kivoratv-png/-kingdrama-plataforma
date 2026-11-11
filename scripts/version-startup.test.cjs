const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

async function startup({loaded,published,url='https://kingdrama.test/',me={user:null}}) {
  const redirects=[],requests=[],cleaned=[];
  const handlers={};
  const source=fs.readFileSync(path.join(__dirname,'../public/js/app.js'),'utf8')
    .replace(/^import .+;\r?\n/gm,'').replace(/export /g,'')
    .replace(/import\.meta\.url/g,JSON.stringify(`https://kingdrama.test/js/app.js?v=${loaded}`))
    .replace('(async function boot()','globalThis.boot=(async function boot()');
  const control={value:'',addEventListener:()=>{},querySelector:()=>control,classList:{toggle:()=>false},setAttribute:()=>{}};
  const app={innerHTML:'',querySelector:()=>control};
  const context={URL,URLSearchParams,Date,console,
    document:{hidden:false,getElementById:()=>app,querySelector:()=>({content:loaded}),addEventListener:(name,fn)=>{handlers[name]=fn;}},
    window:{addEventListener:(name,fn)=>{handlers[name]=fn;},scrollTo:()=>{}},
    location:{href:url,pathname:new URL(url).pathname,search:new URL(url).search,hash:'',replace:to=>redirects.push(to)},
    history:{state:null,replaceState:(_,unused,to)=>{cleaned.push(to);if(to){const target=new URL(to,context.location.href);Object.assign(context.location,{href:target.href,pathname:target.pathname,search:target.search});}}},
    pages:{landing:async()=>'<p>Home</p>',home:async()=>'<p>Catalog</p>',title:async()=>'<p>Title details</p>',player:async()=>'<p>Player</p>'},authPages:{},profile:()=>'',privacy:()=>'',requests:()=>'',referrals:()=>'',dashboard:()=>'',
    esc:value=>String(value || ''),icon:new Proxy({},{get:()=>''}),initials:()=> 'T',
    enhance:()=>{},sendActivity:()=>{},clearActivity:()=>{},mountCategoryMenu:()=>{},mountRequestsPanel:()=>({open:()=>{},dispose:()=>{}}),
    fetch:async(route,options)=>{requests.push({path:route,options});return {ok:true,json:async()=>route==='/config/ofertas.json'?JSON.parse(fs.readFileSync(path.join(__dirname,'../public/config/ofertas.json'),'utf8')):({versao:published})};},
    api:async path=>path==='/api/me'?me:{},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/js/offers.js'),'utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,''),context);
  // Router tests exercise rendering; offer interactions have their own DOM harness.
  context.offers.mount=undefined;
  vm.runInNewContext(source,context);await context.boot;
  for(let i=0;i<8;i++)await Promise.resolve();
  return {redirects,requests,cleaned,handlers,app,location:context.location};
}
test('cached document compares its actual loaded version to the latest release before boot',async()=>{
  const result=await startup({loaded:'111111111111',published:'222222222222'});
  assert.equal(result.redirects.length,1);assert.equal(new URL(result.redirects[0]).searchParams.get('_kdv'),'222222222222');
  assert.ok(result.requests.every(r=>r.options.cache==='no-store'));
  assert.equal(result.app.innerHTML,'');
});

const unpaid={user:{id:'test',email:'test@example.invalid',name:'Cliente'},access:{active:false,status:'pending'}};
test('unpaid account enters catalog and opens a title without visiting the offers page',async()=>{
  const home=await startup({loaded:'222222222222',published:'222222222222',me:unpaid});
  assert.equal(home.location.pathname,'/inicio');assert.ok(home.app.innerHTML.includes('Catalog'));
  const details=await startup({loaded:'222222222222',published:'222222222222',me:unpaid,url:'https://kingdrama.test/titulo/drama-a'});
  assert.equal(details.location.pathname,'/titulo/drama-a');assert.ok(details.app.innerHTML.includes('Title details'));
});
test('watch click routes an unpaid account to offers and preserves the selected episode',async()=>{
  const result=await startup({loaded:'222222222222',published:'222222222222',me:unpaid,url:'https://kingdrama.test/assistir/drama-a/3'});
  assert.equal(result.location.pathname,'/ofertas');
  assert.equal(new URL(result.location.href).searchParams.get('titulo'),'drama-a');
  assert.equal(new URL(result.location.href).searchParams.get('episodio'),'3');
  assert.ok(result.app.innerHTML.includes('Plano Mensal'));assert.equal(result.app.innerHTML.includes('<p>Player</p>'),false);
});
test('subscribed account still opens player directly',async()=>{
  const result=await startup({loaded:'222222222222',published:'222222222222',me:{...unpaid,access:{active:true}},url:'https://kingdrama.test/assistir/drama-a/3'});
  assert.equal(result.location.pathname,'/assistir/drama-a/3');assert.ok(result.app.innerHTML.includes('<p>Player</p>'));
});
test('current release starts normally and removes the temporary update marker',async()=>{
  const result=await startup({loaded:'222222222222',published:'222222222222',url:'https://kingdrama.test/?_kdv=222222222222'});
  assert.equal(result.redirects.length,0);assert.deepEqual(result.cleaned,['/']);
  assert.ok(result.app.innerHTML.includes('Home'));
  const before=result.requests.length;await result.handlers.visibilitychange();
  // The event starts the check synchronously and bypasses the normal throttle.
  assert.ok(result.requests.length>before);
});
