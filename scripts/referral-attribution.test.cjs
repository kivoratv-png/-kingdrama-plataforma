const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/js/data-supabase.js'),'utf8');
function capture(url){
 const storage=new Map();const context={window:{},URL,Date,location:{href:url},localStorage:{getItem:key=>storage.get(key) || null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},console:{error:()=>{}}};
 vm.runInNewContext(source,context);return JSON.parse(storage.get('kd_referral') || 'null');
}
test('captures both original referral links and UTM-only invitation links',()=>{
 const code='a'.repeat(32);
 assert.equal(capture('https://kingdrama.test/cadastro?ref='+code).code,code);
 assert.equal(capture('https://kingdrama.test/cadastro?utm_source=indicacao&utm_content='+code).code,code);
 assert.equal(capture('https://kingdrama.test/cadastro?ref=invalid&utm_source=indicacao&utm_content='+code).code,code);
 assert.equal(capture('https://kingdrama.test/cadastro?utm_source=ads&utm_content='+code),null);
 assert.equal(capture('https://kingdrama.test/cadastro?ref=invalid'),null);
});
