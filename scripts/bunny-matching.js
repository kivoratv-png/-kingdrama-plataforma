'use strict';
const {idDoTitulo}=require('./id-do-titulo');
const normalize=s=>String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const slug=s=>normalize(s).replace(/\.(mp4|mkv|avi|mov|m4v|ts|webm)$/i,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const name=s=>slug(s).replaceAll('-',' ');
const base=s=>slug(s).replace(/-?\d{6,}$/,'').replace(/-+$/,'');
const verifiedOverrides={
  // Truncated Bunny filename verified against the unique original catalog record.
  [slug('apaixonando-se-pelo-principe-na-academia-de-artes-das-trevas---falling-for-the-prince-at-dark-arts-academy-179.ts')]:
    'apaixonando-se-pelo-principe-na-academia-de-artes-das-trevas-falling-1793010476',
};
function buildMatcher(titles){
  const exact=new Map(titles.map(t=>[t.id,t]));
  const indexes={slug:new Map(),number:new Map(),name:new Map(),base:new Map()};
  const add=(map,key,title)=>{if(key)map.set(key,[...(map.get(key) || []),title]);};
  for(const title of titles){add(indexes.slug,slug(title.id),title);add(indexes.number,title.id.match(/\d{6,}$/)?.[0],title);add(indexes.name,name(title.name),title);add(indexes.base,base(title.id),title);}
  return video=>{
    const key=slug(video.title);
    const override=verifiedOverrides[key];if(override && exact.has(override))return {title:exact.get(override),method:'verified-truncated-name'};
    if(exact.has(key))return {title:exact.get(key),method:'exact-id'};
    const generated=idDoTitulo(key,video.title);if(exact.has(generated))return {title:exact.get(generated),method:'canonical-id'};
    for(const [method,value] of [['slug',key],['number',key.match(/\d{6,}$/)?.[0]],['name',name(video.title)],['base',base(key)]]){
      const candidates=value && indexes[method].get(value);
      if(candidates?.length===1)return {title:candidates[0],method};
    }
    return null;
  };
}
function betterVideo(candidate,current){return !current || Number(candidate.length)>Number(current.length) ||
  (Number(candidate.length)===Number(current.length) && new Date(candidate.dateUploaded || 0)>new Date(current.dateUploaded || 0));}
module.exports={buildMatcher,betterVideo};
