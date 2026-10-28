import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const base=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile'),read=name=>readFileSync(resolve(base,name),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:1500});
const music=sandbox.window.GalaxyMemoriesV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,attr:esc,ico:n=>'<i>'+esc(n)+'</i>'};
const tracks=[
 {id:'s1',type:'url',title:'Lover',artist:'Taylor Swift',platform:'spotify'},
 {id:'s2',type:'url',title:'Lover',artist:'Taylor Swift',platform:'youtube'},
 {id:'s3',type:'url',title:'Lover',artist:'',platform:'youtube'},
 {id:'s4',type:'mp3',title:'Lover',artist:'Taylor Swift',platform:'mp3',path:'private/a.mp3'}
];
test('P6C: same title and artist across providers groups two without deleting any record',()=>{
 const groups=music.musicGrouping(tracks);
 assert.equal(groups.length,3);
 assert.equal(groups[0].entries.length,2);
 assert.deepEqual(Array.from(groups[0].entries.map(e=>e.index)),[0,1]);
 assert.equal(groups.reduce((n,g)=>n+g.entries.length,0),tracks.length);
});
test('P6C: unknown artist and local files do not merge on title alone',()=>{
 const groups=music.musicGrouping([{title:'Lover',platform:'spotify'},{title:'Lover',platform:'youtube'},{title:'Lover',platform:'mp3',artist:'Taylor Swift'}]);
 assert.equal(groups.length,3);
});
test('P6C: duplicate provider recordings remain independent',()=>{
 const groups=music.musicGrouping([{title:'Song',artist:'A',platform:'spotify'},{title:'Song',artist:'A',platform:'spotify'}]);
 assert.equal(groups.length,2);
});
test('P6C: playback uses source indexes and provider-specific labels',()=>{
 const html=music.musicLibrary(tracks,1,true,ui);
 for(let index=0;index<tracks.length;index++)assert.match(html,new RegExp('data-index="'+index+'"'));
 assert.match(html,/Reproducir con YouTube \/ YouTube Music/);
 assert.match(html,/data-action="item-delete"/);
 assert.match(html,/data-action="media-delete" data-kind="music"/);
 assert.match(html,/Opciones/);
});
test('P6C: HTML entities and destructive identifiers cannot inject elements',()=>{
 const html=music.musicLibrary([{title:'<img src=x>',artist:'<script>x</script>',type:'mp3',platform:'mp3',path:'x" onclick="evil'}],-1,false,ui);
 assert.match(html,/&lt;img src=x&gt;/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>|<img src=x>|onclick="evil"/);
});
test('P6C: real app composer retains its original media and provider playback APIs',()=>{
 const app=read('app.js');
 assert.match(app,/GalaxyMemoriesV5\.musicLibrary\(musicQueue,musicIndex,musicPlaying/);
 assert.match(app,/function playMusicAt\(index\)/);
 assert.match(app,/if\(a==='music-play'\)/);
 assert.match(app,/if\(a==='music-upload'\)/);
 assert.match(app,/if\(a==='media-delete'\)\{if\(confirm\(/);
});
