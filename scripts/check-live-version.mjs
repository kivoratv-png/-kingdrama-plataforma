import fs from 'node:fs';
const expected=JSON.parse(fs.readFileSync(new URL('../public/config/versao.json',import.meta.url),'utf8')).versao;
// kingdrama.site currently hosts the separate sales page, not this application.
const hosts=['https://appkingdrama.netlify.app'];
if(process.argv.includes('--include-main-domain'))hosts.push('https://kingdrama.site');
let failures=0;
for(const host of hosts) {
  try {
    const results=await Promise.all(['/','/perfil','/config/versao.json',`/js/app.js?v=${expected}`,`/css/app.css?v=${expected}`].map(async path=>{
      const response=await fetch(host+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});
      const text=await response.text();
      if(response.status!==200)throw Error(`HTTP ${response.status} ${path}`);
      if(!response.headers.get('cache-control')?.includes('no-store'))throw Error(`Cache habilitado: ${path}`);
      if(path==='/config/versao.json' && JSON.parse(text).versao!==expected)throw Error('Versão antiga publicada');
      if(path==='/' && !text.includes(`name="kingdrama-version" content="${expected}"`))throw Error('HTML antigo publicado');
      if(path.startsWith('/js/') && !text.includes(`./lib.js?v=${expected}`))throw Error('Importação sem versão atual');
      return {path,status:response.status,cache:response.headers.get('cache-control')};
    }));
    console.log(JSON.stringify({host,version:expected,results}));
  }catch(error){console.error(JSON.stringify({host,error:error.cause?.code || error.message}));failures++;}
}
if(failures)process.exitCode=1;
