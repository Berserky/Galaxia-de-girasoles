import {readFileSync,writeFileSync} from 'node:fs';

const [baselinePath,afterPath,markdownPath='/tmp/phase4-benchmark.md']=process.argv.slice(2);
if(!baselinePath||!afterPath)throw new Error('usage: compare-phase4-benchmark.mjs baseline.json after.json [summary.md]');
const baseline=JSON.parse(readFileSync(baselinePath,'utf8'));
const after=JSON.parse(readFileSync(afterPath,'utf8'));

function pct(before,value){
 if(!Number.isFinite(before)||before===0)return 'n/a';
 return (((value-before)/before)*100).toFixed(1)+'%';
}
function row(name,b,a,unit='ms'){
 return '| '+name+' | '+b+' '+unit+' | '+a+' '+unit+' | '+pct(Number(b),Number(a))+' |';
}

const failures=[];
if(!(after.cards?.['100']?.dbRoundTrips < baseline.cards?.['100']?.dbRoundTrips))
 failures.push('100 cards must reduce DB round trips ('+baseline.cards?.['100']?.dbRoundTrips+' -> '+after.cards?.['100']?.dbRoundTrips+')');
if(!(after.cards?.['100']?.dbRoundTrips <= 10))
 failures.push('100 cards must hydrate in constant DB round trips (got '+after.cards?.['100']?.dbRoundTrips+')');
if(!(after.images?.['50']?.storageBatch <= 1 && after.images?.['50']?.storageSingle===0))
 failures.push('50 images must use one batched Storage signing request (single='+after.images?.['50']?.storageSingle+', batch='+after.images?.['50']?.storageBatch+')');
for(const section of ['search','intelligence']){
 if(Number(after?.[section]?.status)>=500)failures.push(section+' benchmark returned '+after?.[section]?.status);
}
for(const detail of ['light','detail']){
 if(Number(after?.map?.[detail]?.status)>=500)failures.push('map.'+detail+' benchmark returned '+after?.map?.[detail]?.status);
}

const lines=[
 '# Phase 4 performance benchmark',
 '',
 'Baseline: `'+baseline.source+'`',
 'After: `'+after.source+'`',
 '',
 '## Synthetic CPU wall time (median)',
 '',
 '| Scenario | Baseline | After | Delta |',
 '| --- | ---: | ---: | ---: |',
 ...[100,500,5000].map(n=>row('Chat '+n,baseline.chat[n].ms,after.chat[n].ms)),
 row('100 cards',baseline.cards['100'].ms,after.cards['100'].ms),
 row('50 images',baseline.images['50'].ms,after.images['50'].ms),
 '',
 'Wall time is diagnostic only; CI gates use deterministic request counts rather than noisy runner timing.',
 '',
 '## Round trips',
 '',
 '| Scenario | Baseline | After |',
 '| --- | ---: | ---: |',
 '| 100 cards · DB | '+baseline.cards['100'].dbRoundTrips+' | '+after.cards['100'].dbRoundTrips+' |',
 '| 50 images · Storage single | '+baseline.images['50'].storageSingle+' | '+after.images['50'].storageSingle+' |',
 '| 50 images · Storage batch | '+baseline.images['50'].storageBatch+' | '+after.images['50'].storageBatch+' |',
 '| Chat search · DB+RPC | '+(baseline.search.dbRoundTrips+baseline.search.rpcRoundTrips)+' | '+(after.search.dbRoundTrips+after.search.rpcRoundTrips)+' |',
 '| Map light · DB+RPC | '+(baseline.map.light.dbRoundTrips+baseline.map.light.rpcRoundTrips)+' | '+(after.map.light.dbRoundTrips+after.map.light.rpcRoundTrips)+' |',
 '| Map detail · DB+RPC | '+(baseline.map.detail.dbRoundTrips+baseline.map.detail.rpcRoundTrips)+' | '+(after.map.detail.dbRoundTrips+after.map.detail.rpcRoundTrips)+' |',
 '| Intelligence search · DB+RPC | '+(baseline.intelligence.dbRoundTrips+baseline.intelligence.rpcRoundTrips)+' | '+(after.intelligence.dbRoundTrips+after.intelligence.rpcRoundTrips)+' |',
 '',
 failures.length?'## Gate: FAILED':'## Gate: PASS',
 ...(failures.length?failures.map(x=>'- '+x):['- Card hydration is batched.','- Media signing is batched.','- Search/map/Intelligence benchmark actions remain healthy.'])
];
writeFileSync(markdownPath,lines.join('\n')+'\n');
process.stdout.write(lines.join('\n')+'\n');
if(failures.length)process.exitCode=1;
