const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('each panel entry starts at username, password and authenticator without using an app account',async()=>{
 const source=fs.readFileSync('public/js/admin.js','utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,'');
 const form={addEventListener:()=>{}},content={innerHTML:'',querySelector:()=>form,replaceChildren:()=>{}},logout={addEventListener:()=>{}},root={querySelector:selector=>selector==='[data-admin-content]'?content:logout};
 const context={URLSearchParams,location:{hash:'',pathname:'/admin'},history:{replaceState:()=>{}},esc:String,icon:new Proxy({},{get:()=>''}),clearInterval:()=>{},document:{addEventListener:()=>{},removeEventListener:()=>{}},window:{addEventListener:()=>{},removeEventListener:()=>{},get __KD_SB__(){throw Error('App session must never be read');}}};
 vm.runInNewContext(source,context);
 await context.dashboard();context.dashboard.mount(root);
 for(const name of ['username','password','code'])assert.ok(content.innerHTML.includes(`name="${name}"`));
 assert.ok(content.innerHTML.includes('Entrar no painel'));assert.equal(logout.hidden,true);
 context.dashboard.mount(root);assert.ok(content.innerHTML.includes('data-console-login'));
 const html=fs.readFileSync('public/admin/index.html','utf8');assert.ok(!html.includes('supabase.js'));assert.ok(!html.includes('data-supabase.js'));assert.ok(html.includes('admin-entry.js'));
});
