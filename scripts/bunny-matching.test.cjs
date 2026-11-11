const {test}=require('node:test');const assert=require('node:assert/strict');const {buildMatcher,betterVideo}=require('./bunny-matching');
test('matches canonical filenames and refuses ambiguous names instead of choosing the first title',()=>{
 const a={id:'amor-1793010001',name:'Amor'},b={id:'amor-1793010002',name:'Amor'};const match=buildMatcher([a,b]);
 assert.equal(match({title:'amor-1793010002.ts'}).title.id,b.id);assert.equal(match({title:'Amor.mp4'}),null);
});
test('resolves only the explicitly verified truncated catalog filename',()=>{
 const title={id:'apaixonando-se-pelo-principe-na-academia-de-artes-das-trevas-falling-1793010476',name:'Nome original'};
 assert.equal(buildMatcher([title])({title:'apaixonando-se-pelo-principe-na-academia-de-artes-das-trevas---falling-for-the-prince-at-dark-arts-academy-179.ts'}).title.id,title.id);
});
test('selects the longest ready re-upload, breaking ties by upload date',()=>{
 const old={length:100,dateUploaded:'2026-01-01'};assert.equal(betterVideo({length:101,dateUploaded:'2025-01-01'},old),true);assert.equal(betterVideo({length:100,dateUploaded:'2026-02-01'},old),true);assert.equal(betterVideo({length:99,dateUploaded:'2026-03-01'},old),false);
});
test('matches captured titles only when removing Assistindo yields a unique exact name',()=>{
 const title={id:'voce-foi-substituido-primeiro-amor-1788633165',name:'Você Foi Substituído, Primeiro Amor'};
 assert.equal(buildMatcher([title])({title:'Assistindo Você Foi Substituído, Primeiro Amor.ts'}).title.id,title.id);
 assert.equal(buildMatcher([title,{...title,id:'another'}])({title:'Assistindo Você Foi Substituído, Primeiro Amor.ts'}),null);
 assert.equal(buildMatcher([title])({title:'Assistindo Você Foi Substituído.ts'}),null);
});
