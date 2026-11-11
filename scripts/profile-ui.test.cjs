const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/js/profile.js','utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,'');
function setup(access){
 const me={user:{id:'account',name:'Cliente',email:'client@example.invalid',createdAt:'2026-01-01T12:00:00Z'},access};
 const context={api:async route=>{assert.equal(route,'/api/me?atualizar=1');return me;},esc:value=>String(value??''),icon:new Proxy({},{get:()=>''}),initials:()=> 'C'};
 vm.runInNewContext(source,context);return {context,me};
}
test('profile refreshes the subscription from the server and displays plan and expiry',async()=>{
 const {context,me}=setup({active:true,status:'active',planCode:'monthly',periodEnd:'2030-07-15T12:00:00Z'});
 const ctx={state:{me:{access:{periodEnd:'2026-01-01'}}}};const html=await context.profile(ctx);
 assert.equal(ctx.state.me,me);assert.ok(html.includes('Expira em'));assert.ok(html.includes('Mensal'));assert.ok(html.includes('2030'));assert.ok(!html.includes('Vencimento</dt>'));
});
test('expired access and courtesy access display their actual validity without invented dates',async()=>{
 const expired=setup({active:false,status:'active',planCode:'weekly',periodEnd:'2020-01-01T12:00:00Z'});
 const html=await expired.context.profile({state:{}});assert.ok(html.includes('Expirou em'));assert.ok(html.includes('Semanal'));
 const courtesy=setup({active:true,status:'active',planCode:'cortesia',periodEnd:null});
 assert.ok((await courtesy.context.profile({state:{}})).includes('Sem data de expiração'));
});
