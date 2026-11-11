const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=file=>fs.readFileSync(file,'utf8').replace(/^import .+;\r?\n/gm,'').replace(/export /g,'');
test('complete film has no episode count, and playback controls and channel follow the player',async()=>{
 const title={id:'film',name:'Filme',cover:'cover.webp',episodes:[{number:1}],categories:[],synopsis:'Sinopse'};
 const context={URL,api:async path=>path.startsWith('/api/play')?{episode:{titleName:'Filme',number:1},embedUrl:'https://player.mediadelivery.net/embed/1/id?token=signed&autoplay=true',sources:[]}:{title,related:[]},esc:String,icon:new Proxy({},{get:()=>''}),row:()=>'',smallCover:x=>x,loadPlayerControl:async()=>{}};
 vm.runInNewContext(source('public/js/pages.js'),context);
 const details=await context.title({params:['film']});assert.ok(!details.includes('1 episódio'));assert.ok(!details.includes('id="eps"'));
 const html=await context.player({params:['film','1']});assert.ok(!html.includes('Episódio 1'));assert.ok(html.includes('autoplay=false'));assert.ok(html.includes('token=signed'));
 assert.ok(html.indexOf('data-player-watch')>html.indexOf('</iframe>'));assert.ok(html.includes('https://whatsapp.com/channel/0029Vb9NN6o8fewpZKqFQ80u'));
});
test('button below the embedded player uses playback API and follows play/pause events',()=>{
 const events={},button={innerHTML:'',attrs:{},addEventListener:(key,fn)=>events[key]=fn,setAttribute(key,value){this.attrs[key]=value;}},playerEvents={};let plays=0,pauses=0;
 class Player{on(key,fn){playerEvents[key]=fn;}off(key){delete playerEvents[key];}play(){plays++;playerEvents.play();}pause(){pauses++;playerEvents.pause();}}
 const frame={},context={window:{playerjs:{Player}},icon:{play:'',pause:''}};
 vm.runInNewContext(source('public/js/player-button.js'),context);
 const cleanup=context.mountPlayerButton({querySelector:selector=>selector==='[data-player-watch]'?button:selector==='iframe'?frame:null});
 playerEvents.ready();events.click();assert.equal(plays,1);assert.ok(button.innerHTML.includes('Pausar'));events.click();assert.equal(pauses,1);assert.ok(button.innerHTML.includes('Assistir'));cleanup();assert.equal(Object.keys(playerEvents).length,0);
});
