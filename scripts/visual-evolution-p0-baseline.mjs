#!/usr/bin/env node
// V5-P0: baseline reproducible de estructura. NO mide FPS ni tiempos Android.
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=[
 'android/app/src/main/assets/mobile/app.js',
 'android/app/src/main/assets/mobile/app.css',
 'android/app/src/main/assets/mobile/index.html',
 'android/app/src/main/assets/mobile/theme.js',
 'android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java',
 'android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java',
 'supabase/functions/android-companion/index.ts'
];
const fileStats=Object.fromEntries(files.map(p=>{
 const b=readFileSync(resolve(root,p));
 const text=b.toString('utf8');
 return[p,{bytes:b.byteLength,lines:text.split(/\r?\n/).length}];
}));
const css=readFileSync(resolve(root,files[1]),'utf8');
const app=readFileSync(resolve(root,files[0]),'utf8');
const html=readFileSync(resolve(root,files[2]),'utf8');
const themes=readFileSync(resolve(root,files[3]),'utf8');
const source=readFileSync(resolve(root,'android/app/build.gradle.kts'),'utf8');
const data={
 phase:'V5-P0',kind:'static_source_metrics_not_runtime_benchmark',
 generatedAtUtc:new Date().toISOString(),
 gitSha:process.env.GITHUB_SHA||'local-unspecified',
 node:process.version,
 gradleVersionCode:Number(source.match(/versionCode = (\d+)/)?.[1]||0),
 gradleVersionName:source.match(/versionName = "([^"]+)"/)?.[1]||'unknown',
 files:fileStats,
 routeChecks:Object.fromEntries(['home','map','moments','memories','goals','ai','chat','more'].map(x=>[x,app.includes("view==='"+x+"'")])),
 surfaceChecks:{bottomNav:html.includes('id="bottomNav"'),chatFab:html.includes('id="chatFab"'),modal:html.includes('id="modal"'),reducedMotionCss:css.includes('prefers-reduced-motion:reduce'),safeAreaCss:css.includes('safe-area-inset-bottom'),themeEngine:themes.includes('function applyTheme(')},
 testFiles:readdirSync(resolve(root,'tests')).filter(x=>x.endsWith('.test.mjs')).length,
 runtimePerformance:{coldStartMs:null,scrollFps:null,p95FrameMs:null,memoryMb:null,batteryDelta:null,status:'NOT_MEASURED_requires_AVD_or_real_device'},
 visualRuntimeCaptures:{status:'NOT_CAPTURED_requires_isolated_AVD',privacy:'never capture real private data'}
};
const json=JSON.stringify(data,null,2)+'\n';
const i=process.argv.indexOf('--out');
if(i!==-1){
 const path=resolve(root,process.argv[i+1]||'');
 if(!process.argv[i+1]||!path.startsWith(root))throw Error('Output path must be inside repository');
 mkdirSync(dirname(path),{recursive:true});writeFileSync(path,json);
}
process.stdout.write(json);
