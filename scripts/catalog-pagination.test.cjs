const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/js/data-supabase.js'),'utf8');
const fn=source.slice(source.indexOf('  async function consultaTitulos('),source.indexOf('  const listaCategorias ='));
function fixture(){
 const rows=Array.from({length:1195},(_,i)=>({id:`title-${i}`,name:`Dorama ${i}`,cover:`${i}.webp`,title_categories:[{category_id:'romance'}]}));const calls=[];
 const sb={from:()=>{const query={select(columns){assert.equal(columns.includes('synopsis'),false);return query;},eq(){return query;},order(){return query;},ilike(){return query;},async range(start,end){calls.push([start,end]);return {data:rows.slice(start,end+1),error:null};}};return query;}};
 const context={sb};vm.runInNewContext(fn,context);return {run:context.consultaTitulos,calls};
}
test('browse reads beyond both the old 500 limit and the 1000-row API page',async()=>{
 const {run,calls}=fixture();const titles=await run();assert.equal(titles.length,1195);assert.deepEqual(calls,[[0,999],[1000,1999]]);assert.equal(titles[1194].categories[0],'romance');
});
test('search keeps its bounded result limit without loading the full catalog',async()=>{
 const {run,calls}=fixture();assert.equal((await run({busca:'Dorama',limite:120})).length,120);assert.deepEqual(calls,[[0,119]]);
});
