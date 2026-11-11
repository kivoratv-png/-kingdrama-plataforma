'use strict';
const fs=require('node:fs');const path=require('node:path');
const {exige}=require('./env');const sb=require('./supabase');
const {buildMatcher,betterVideo}=require('./bunny-matching');const {idDoTitulo}=require('./id-do-titulo');
const apply=process.argv.includes('--apply');
const library=exige('BUNNY_LIBRARY_ID','conferir os vídeos');const key=exige(['BUNNY_STREAM_KEY','BUNNY_API_KEY'],'conferir a Bunny');
const auditDirectory=path.join(__dirname,'../.netlify/audits');fs.mkdirSync(auditDirectory,{recursive:true});
const cachePath=path.join(auditDirectory,'bunny-cover-cache.json');
let assetCache={};try{assetCache=JSON.parse(fs.readFileSync(cachePath,'utf8'));}catch{}
const nativeFetch=global.fetch;
global.fetch=async(input,options={})=>{
  const method=(options.method || 'GET').toUpperCase();const tries=['GET','HEAD'].includes(method)?3:1;
  for(let attempt=1;attempt<=tries;attempt++){
    try{return await nativeFetch(input,{...options,signal:options.signal || AbortSignal.timeout(25000)});}
    catch(error){if(attempt===tries)throw error;}
  }
};
const canonicalNameOverrides={
 'apaixonando-se-pelo-principe-na-academia-de-artes-das-trevas-falling-1793010476':'Apaixonando-se pelo Príncipe na Academia de Artes das Trevas',
};
async function mapPool(items,worker,concurrency=12){
  let cursor=0;const result=new Array(items.length);
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{for(;;){const i=cursor++;if(i>=items.length)return;result[i]=await worker(items[i],i);}}));return result;
}
async function bunnyVideos(){
  const all=[];let total;
  for(let page=1;;page++){
    const response=await fetch(`https://video.bunnycdn.com/library/${library}/videos?page=${page}&itemsPerPage=100&orderBy=date`,{headers:{AccessKey:key,Accept:'application/json'}});
    if(!response.ok)throw Error(`Bunny: HTTP ${response.status}`);
    const data=await response.json();if(!Array.isArray(data.items) || !Number.isInteger(data.totalItems))throw Error('Resposta incompleta da Bunny.');
    total=data.totalItems;all.push(...data.items);if(!data.items.length || all.length>=total)break;
  }
  const unique=[...new Map(all.map(v=>[v.guid,v])).values()];
  if(unique.length<total)throw Error('A biblioteca mudou durante a paginação. Repita a conferência.');
  return unique;
}
async function checkImage(url,force=false){
  if(!force && assetCache[url]?.ok && Date.now()-assetCache[url].checkedAt<10*60000)return {...assetCache[url],cached:true};
  try{
    const response=await fetch(url,{method:'HEAD',cache:'no-store'});
    const ok=response.ok && (response.headers.get('content-type') || '').startsWith('image/');
    const result={ok,status:response.status,checkedAt:Date.now()};if(ok)assetCache[url]=result;return result;
  }catch(error){return {ok:false,error:error.cause?.code || error.name,checkedAt:Date.now()};}
}
async function main(){
 console.log(`Conferência ${apply?'com publicação':'somente leitura'} da biblioteca ${library}.`);
 const [videos,titles,episodes,sources,relations]=await Promise.all([
   bunnyVideos(),sb.lerTudo('titles','select=id,name,synopsis,cover,year,published'),
   sb.lerTudo('episodes','select=id,title_id,number,duration_s,published'),
   sb.lerTudo('episode_sources','select=episode_id,bunny_video_id,bunny_library_id'),
   sb.lerTudo('title_categories','select=title_id,category_id'),
 ]);
 const metadataPath=path.join(process.env.USERPROFILE || process.env.HOME || '','Desktop/DORAMAS PLUS/catalogo_completo.json');
 const metadata=fs.existsSync(metadataPath)?JSON.parse(fs.readFileSync(metadataPath,'utf8')):[];
 const sourceMetadata=new Map(metadata.map(item=>[idDoTitulo(item.slug,item.title),item]));
 const matcher=buildMatcher(titles);const byGuid=new Map(videos.map(v=>[v.guid,v]));
 const episodeByTitle=new Map(episodes.filter(e=>e.number===1).map(e=>[e.title_id,e]));
 const sourceByEpisode=new Map(sources.map(s=>[s.episode_id,s]));const categorized=new Set(relations.map(r=>r.title_id));
 const ready=videos.filter(v=>v.status===4 && Number(v.length)>0);const waiting=videos.filter(v=>v.status!==4 || !(Number(v.length)>0));
 const selected=new Map(),unmatched=[],duplicates=[];
 for(const video of ready){
   const match=matcher(video);if(!match){unmatched.push(video);continue;}
   const previous=selected.get(match.title.id);
   if(betterVideo(video,previous?.video)){if(previous)duplicates.push(previous.video);selected.set(match.title.id,{...match,video});}
   else duplicates.push(video);
 }
 const rows=[...selected.values()].map(item=>{
   const old=item.title,original=sourceMetadata.get(old.id),patch={};
   if(canonicalNameOverrides[old.id] && old.name!==canonicalNameOverrides[old.id])patch.name=canonicalNameOverrides[old.id];
   if(!old.name?.trim() && original?.title?.trim())patch.name=original.title.trim();
   if(!old.synopsis?.trim() && original?.description?.trim())patch.synopsis=original.description.trim();
   if(!old.cover?.trim() && original)patch.cover=sb.urlPublica('capas',`${old.id}.webp`);
   const title={...old,...patch};const episode=episodeByTitle.get(old.id),source=episode && sourceByEpisode.get(episode.id);
   const existingVideo=source?.bunny_library_id===String(library) && byGuid.get(source.bunny_video_id);
   const existingMatch=existingVideo && matcher(existingVideo);
   const existingGood=episode?.published && existingVideo?.status===4 && Number(existingVideo.length)>0 && existingMatch?.title.id===old.id;
   const selectedVideo=existingGood?existingVideo:item.video;
   const problems=[];
   if(!title.name?.trim() || /\/\s*sinopse\s*\//i.test(title.name))problems.push('nome incompleto ou contaminado');
   if(!title.synopsis?.trim())problems.push('sem sinopse');
   if(!title.cover?.trim())problems.push('sem capa');
   if(!categorized.has(title.id))problems.push('sem categoria');
   return {title,originalPublished:old.published,patch,video:selectedVideo,method:item.method,sourceRepair:old.published && !existingGood,problems};
 });
 console.log(JSON.stringify({videos:videos.length,ready:ready.length,notReady:waiting.length,matchedTitles:rows.length,duplicateUploads:duplicates.length,unmatched:unmatched.length,publishedBefore:titles.filter(t=>t.published).length,newCandidates:rows.filter(r=>!r.originalPublished).length,existingSourceRepairs:rows.filter(r=>r.sourceRepair).length}));
 let checked=0,uploaded=0;
 await mapPool(rows,async row=>{
   if(!row.title.cover)return;
   row.images=[];
   const urls=[row.title.cover,row.title.cover.replace(/\.webp$/,'-sm.webp')];
   for(const url of [...new Set(urls)]){
     let result=await checkImage(url);
     if(!result.ok && [400,404].includes(result.status) && apply){
       const filename=url===row.title.cover?`${row.title.id}.webp`:`${row.title.id}-sm.webp`;
       const expected=sb.urlPublica('capas',filename);
       const local=path.join(__dirname,'../capas-para-subir',filename);
       if(url===expected && /^[a-z0-9][a-z0-9-]+$/.test(row.title.id) && fs.existsSync(local)){
         await sb.subirArquivo('capas',filename,fs.readFileSync(local),'image/webp');uploaded++;result=await checkImage(url,true);
       }
     }
     row.images.push({url,...result});if(!result.ok)row.problems.push(`capa indisponível: ${url.endsWith('-sm.webp')?'miniatura':'principal'} (${result.status || result.error})`);
   }
   checked++;if(checked%100===0 || checked===rows.length)console.log(`Capas conferidas: ${checked}/${rows.length}`);
 });
 fs.writeFileSync(cachePath,JSON.stringify(assetCache));
 const valid=rows.filter(r=>!r.problems.length),blocked=rows.filter(r=>r.problems.length);
 const work=valid.filter(r=>!r.originalPublished || r.sourceRepair);
 const unmatchedPublished=titles.filter(t=>t.published && !selected.has(t.id));
 const report={createdAt:new Date().toISOString(),library,mode:apply?'apply':'audit',summary:{videos:videos.length,ready:ready.length,notReady:waiting.length,publishedBefore:titles.filter(t=>t.published).length,matchedTitles:rows.length,duplicateUploads:duplicates.length,unmatched:unmatched.length,blocked:blocked.length,newReady:valid.filter(r=>!r.originalPublished).length,existingSourceRepairs:valid.filter(r=>r.sourceRepair).length,imagesUploaded:uploaded,publishedOutsideReadyMatches:unmatchedPublished.length},rows,unmatched,waiting:waiting.map(v=>({guid:v.guid,title:v.title,status:v.status,length:v.length})),duplicates:duplicates.map(v=>({guid:v.guid,title:v.title,length:v.length})),unmatchedPublished};
 const reportPath=path.join(auditDirectory,`bunny-${Date.now()}-${apply?'apply':'audit'}.json`);
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 console.log(`Relatório: ${reportPath}`);console.log(JSON.stringify(report.summary));
 for(const row of blocked)console.log(`${row.originalPublished?'PENDÊNCIA EM TÍTULO JÁ PUBLICADO':'NÃO PUBLICADO'}: ${row.title.id}: ${row.problems.join('; ')}`);
 for(const video of unmatched)console.log(`SEM CORRESPONDÊNCIA SEGURA: ${video.title}`);
 if(!apply)return;
 for(const row of valid.filter(r=>Object.keys(r.patch).length))await sb.atualizar('titles',`id=eq.${encodeURIComponent(row.title.id)}`,row.patch);
 for(let start=0;start<work.length;start+=100){
   const batch=work.slice(start,start+100);
   const created=await sb.gravar('episodes',batch.map(r=>({title_id:r.title.id,number:1,published:true,duration_s:Math.round(r.video.length)})),{conflito:'title_id,number',retorno:true});
   const ids=new Map(created.map(e=>[e.title_id,e.id]));
   if(ids.size!==batch.length)throw Error('O banco não confirmou todos os episódios; os títulos não foram publicados.');
   await sb.gravar('episode_sources',batch.map(r=>({episode_id:ids.get(r.title.id),bunny_library_id:String(library),bunny_video_id:r.video.guid,license_note:`Conferido com o catálogo e a Bunny em ${new Date().toISOString().slice(0,10)}`})),{conflito:'episode_id'});
   const filter=batch.filter(r=>!r.originalPublished).map(r=>`"${r.title.id}"`).join(',');
   if(filter)await sb.atualizar('titles',`id=in.(${encodeURIComponent(filter)})`,{published:true});
   console.log(`Vídeos vinculados e títulos publicados: ${Math.min(start+100,work.length)}/${work.length}`);
 }
 const published=await sb.lerTudo('titles','select=id,name,cover,synopsis&published=is.true');
 const finalEpisodes=await sb.lerTudo('episodes','select=id,title_id,number,published');
 const finalSources=await sb.lerTudo('episode_sources','select=episode_id,bunny_video_id,bunny_library_id');
 const epMap=new Map(finalEpisodes.filter(e=>e.number===1).map(e=>[e.title_id,e]));const srcMap=new Map(finalSources.map(s=>[s.episode_id,s]));
 const failures=[];
 for(const row of valid){
   const title=published.find(t=>t.id===row.title.id),ep=epMap.get(row.title.id),source=ep && srcMap.get(ep.id);
   if(!title || !ep?.published || source?.bunny_video_id!==row.video.guid || source.bunny_library_id!==String(library) || !title.name || !title.synopsis || !title.cover)failures.push(row.title.id);
 }
 report.finishedAt=new Date().toISOString();report.result={publishedTotal:published.length,newPublished:valid.filter(r=>!r.originalPublished).length,workItems:work.length,verificationFailures:failures};
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report.result));
 if(failures.length)throw Error(`Falha na verificação de ${failures.length} títulos; consulte o relatório privado.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
