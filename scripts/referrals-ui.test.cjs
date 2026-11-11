const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/js/referrals.js'),'utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,'');
async function render(data){
 const context={api:async()=>data,esc:value=>String(value || ''),icon:new Proxy({},{get:()=>''}),URL,location:{origin:'https://kingdrama.test'}};
 vm.runInNewContext(source,context);return context.referrals();
}
test('non-subscriber sees referral benefit and counters but no copy or generation controls',async()=>{
 const html=await render({eligible:false,code:'must-not-be-exposed',validReferrals:0,daysEarned:0});
 assert.ok(html.includes('Indique e ganhe dias grátis'));assert.ok(html.includes('Indicações válidas'));assert.ok(html.includes('Dias ganhos'));
 assert.ok(html.includes('Ver ofertas para assinar'));assert.equal(html.includes('data-copy-referral'),false);assert.equal(html.includes('data-generate-referral'),false);assert.equal(html.includes('must-not-be-exposed'),false);
});
test('subscriber gets generation control and a reusable account-creation link',async()=>{
 const newSubscriber=await render({eligible:true,code:null,validReferrals:0,daysEarned:0});assert.ok(newSubscriber.includes('Gerar meu link de indicação'));
 const existing=await render({eligible:true,code:'a'.repeat(32),validReferrals:1,daysEarned:10});
 assert.ok(existing.includes('https://kingdrama.test/cadastro?ref='+'a'.repeat(32)));assert.ok(existing.includes('data-copy-referral'));
});
