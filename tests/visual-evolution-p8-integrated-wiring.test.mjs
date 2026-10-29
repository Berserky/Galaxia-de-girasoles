import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const root=resolve(import.meta.dirname,'..');
const read=name=>readFileSync(resolve(dir,name),'utf8');
const index=read('index.html'),app=read('app.js');
const qa=readFileSync(resolve(root,'scripts/qa-android-mobile.mjs'),'utf8');
const css=[...index.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(x=>x[1]);
const scripts=[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x=>x[1]);

test('P8 integrated: moments, memories and settings presenters load before app exactly once',()=>{
 for(const name of ['galaxy-voice-v5.js','galaxy-garden-world-v3.js','p5-garden-bond-bridge.js',
  'p5-moments-garden-lifecycle.js','galaxy-memories-v5.js','galaxy-more-v5.js']){
  const path='./'+name;
  assert.equal(scripts.filter(x=>x===path).length,1,'Missing or duplicated script: '+path);
  assert.ok(scripts.indexOf(path)<scripts.indexOf('./app.js'),'Presenters must load before app.js');
  assert.ok(existsSync(resolve(dir,name)),'Missing bundled asset: '+name);
 }
 assert.equal(scripts.at(-1),'./app.js');
 for(const name of ['galaxy-moments-v5.css','galaxy-garden-world-v3.css',
  'galaxy-memories-v5.css','galaxy-more-v5.css']){
  assert.equal(css.filter(x=>x==='./'+name).length,1,'Missing or duplicated CSS: '+name);
  assert.ok(existsSync(resolve(dir,name)));
 }
 assert.equal(new Set(scripts).size,scripts.length,'No script may load twice');
});

test('P8 integrated: P5 uses authenticated Bond and drops garden lifecycle on exit/unpair',()=>{
 assert.match(app,/let gardenLifecycle=null/);
 assert.match(app,/gardenLifecycle\.update\(\{host,cloud\}\)/);
 assert.match(app,/\[data-p5-garden-host\]/);
 assert.match(app,/if\(!native\.paired\)gardenLifecycle\?\.reset\(\)/);
 assert.match(app,/view!=='moments'\|\|!cloud/);
 assert.match(app,/if\(a==='unpair'\).*gardenLifecycle\?\.reset\(\)/);
 assert.match(app,/function bondGardenStage\(garden\)/);
 assert.match(read('p5-garden-bond-bridge.js'),/GalaxyGardenBondBridge/);
 assert.match(read('p5-moments-garden-lifecycle.js'),/GalaxyMomentsGardenLifecycle/);
});

test('P8 integrated: P6 navigation and P7 form focus protections survive P5 wiring',()=>{
 assert.match(app,/if\(view==='memories'\).*memorySection==='collections'/);
 assert.match(app,/GalaxyMemoriesV5/);
 assert.match(app,/GalaxyMoreV5/);
 assert.match(app,/const settingsFocus=window\.GalaxyMoreV5\?\.captureSettingsFocus\(app\)/);
 assert.match(app,/restoreSettingsForm\(\);\s*if\(focusOwner===settingsDraftOwner/);
 assert.match(read('galaxy-more-v5.js'),/restoreSettingsFocus/);
});

test('P8 integrated: Android QA script manifest matches packaged scripts after the merge',()=>{
 const m=qa.match(/assert\.deepEqual\(scriptSources,\[([^\]]+)\]/);
 assert.ok(m,'Source-order assertion must remain present');
 const expected=[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
 assert.deepEqual(scripts,expected);
 assert.match(qa,/GalaxyGardenBondBridge/);
 assert.match(qa,/GalaxyMomentsGardenLifecycle/);
 assert.match(qa,/P5 presentation must never fetch or access private storage/);
 assert.match(index,/connect-src 'none'/);
});

test('P8 integrated: shared app source parses as a classic WebView script',()=>{
 assert.doesNotThrow(()=>new Function(app));
 assert.doesNotMatch(app,/^(?:<<<<<<<|=======|>>>>>>>)/m);
});

test('P8 security: unpair clears P5 garden and transient P7 settings/navigation',()=>{
 assert.match(app,/if\(a==='unpair'\)[\s\S]*?gardenLifecycle\?\.reset\(\)/);
 assert.match(app,/if\(!native\.paired\)\{settingsDraftCache=null;settingsDraftOwner='';window\.GalaxyMoreV5\?\.resetNavigation\(\)/);
 assert.match(app,/if\(!native\.paired\)gardenLifecycle\?\.reset\(\)/);
});

test('P8 security: backup and device revocation remain fail-closed and server-verified',()=>{
 assert.match(app,/const preview=window\.GalaxyMoreV5\?\.backupManifestPreview\?\.\(backup\)/);
 assert.match(app,/if\(!preview\?\.ok\)\{toast\(/);
 assert.match(app,/if\(!confirm\(preview\.message\)\)return;/);
 assert.match(app,/if\(result\?\.verified!==true\)/);
 assert.match(app,/const context=window\.GalaxyMoreV5\?\.deviceRevokePreview\?\.\(cloud\?\.devices,cloud\?\.device\?\.id,id,names\(\)\)/);
 assert.match(app,/if\(!context\?\.ok\)\{toast\(/);
 assert.match(app,/if\(!confirm\(context\.message\)\)return;/);
});

test('P8 Android instrumentation retains the authentic Chat affordance and real framebuffer gate',()=>{
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 const chat=java.slice(java.indexOf('private void launchChat()'),java.indexOf('private void sendChat('));
 assert.ok(chat.includes("document.querySelector('#chatFab')?.click()"));
 assert.ok(chat.includes("view==='chat'"));
 assert.doesNotMatch(chat,/\bgo\('chat'\);/,'never bypass broken Chat UI through a direct route');
 assert.ok(java.includes('fabHidden:'),'capture privacy-safe route diagnostics');
 const capture=java.slice(java.indexOf('private void awaitV5QaPainted('),java.indexOf('private static double v5ColorContrast(',java.indexOf('private void awaitV5QaPainted(')));
 for(const required of ['15_000','matched>=20','consecutive>=2','SystemClock.sleep(500)','throw new AssertionError("V5 P1 screenshot rejected:'])
  assert.ok(capture.includes(required),'do not weaken the native painted-frame gate: '+required);
});

test('P8 emulator CI captures device health without hiding failed instrumented jobs',()=>{
 for(const name of ['qa-phase5-real-integration.yml','chat-4-phase11-torture.yml','visual-evolution-p0.yml']){
  const ci=readFileSync(resolve(root,'.github/workflows',name),'utf8');
  assert.ok(ci.includes('-memory 1536 -no-snapshot'),name+' lacks bounded emulator RAM');
  assert.ok(ci.includes('if: failure()')&&ci.includes('bash scripts/p8-emulator-diagnostics.sh'),name+' lacks failed-run diagnosis');
  assert.ok(ci.includes('actions/upload-artifact@v7'),name+' lacks evidence');
  assert.ok(!ci.includes('continue-on-error: true'),name+' must retain a hard failure');
 }
 const diagnostic=readFileSync(resolve(root,'scripts/p8-emulator-diagnostics.sh'),'utf8');
 assert.ok(diagnostic.includes('qa-artifacts/p8-emulator-health.txt'));
 assert.doesNotMatch(diagnostic,/secrets\.|token|credential|authorization/i);
});

test('P8 failed-download recovery retries SDK without bypassing Android instrumented checks',()=>{
 for(const name of ['qa-phase5-real-integration.yml','chat-4-phase11-torture.yml','chat-4-phase9-media-performance.yml']){
  const ci=readFileSync(resolve(root,'.github/workflows',name),'utf8');
  assert.ok(ci.includes('sdk_ok=0')&&ci.includes('for attempt in 1 2 3')&&ci.includes('test "$sdk_ok" -eq 1'),name+' must fail closed after bounded SDK retries');
  assert.ok(ci.includes('connectedDebugAndroidTest')||ci.includes('scripts/qa-phase5-emulator.sh'),name+' must execute native instrumentation');
 }
 for(const name of ['qa-phase5-real-integration.yml','chat-4-phase11-torture.yml','visual-evolution-p0.yml']){
  const ci=readFileSync(resolve(root,'.github/workflows',name),'utf8');
  assert.ok(ci.includes('-gpu software -memory 1536 -no-snapshot'),name+' must use the bounded AVD software graphics profile');
 }
});

test('P8 Android device QA verifies P7 grouped backups and updates by opening real details',()=>{
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 const start=java.indexOf('void dailyGoalsPlansEventsCapsulesMapContextBackupAndUpdate_areReachable()');
 const end=java.indexOf('@Test public void networkOfflineSlowTimeoutAndChatRetry_',start);
 assert.ok(start>0&&end>start);
 const flow=java.slice(start,end);
 assert.ok(flow.includes("GalaxyMoreV5.revealGroup(app,'backups')"));
 assert.ok(flow.includes("GalaxyMoreV5.revealGroup(app,'system')"));
 assert.ok(flow.includes("document.querySelector('.v5-more-group[data-group="));
 assert.ok(flow.includes("document.body.innerText.includes('Copia de nuestra galaxia')"));
 assert.ok(flow.includes("document.body.innerText.includes('Actualizaciones')"));
 assert.ok(flow.includes('backup-export')&&flow.includes('update-check'));
 const more=read('galaxy-more-v5.js');
 assert.match(more,/\['backups','Datos y copias'\]/);
 assert.match(more,/\['system','Sistema y actualizaciones'\]/);
 assert.match(more,/function revealGroup\(container,id,focus=false\)/);
});
test('P8 forensic visual milestones are real Android events and cannot replace PNG',()=>{
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 assert.ok(java.includes('android.util.Log.i("NG_P8_VISUAL","P5_VIEWPORT_START_"+css)'));
 assert.ok(java.includes('awaitV5QaPainted("p5-moments-"+css)'));
 assert.ok(java.includes('android.util.Log.i("NG_P8_VISUAL","P5_VIEWPORT_PAINTED_"+css)'));
 const sh=readFileSync(resolve(root,'scripts/visual-evolution-p1-avd.sh'),'utf8');
 assert.ok(sh.includes('p5-device-milestones.txt'));
 assert.ok(sh.includes('pull_theme_evidence'));
 assert.ok(sh.includes('Android JUnit XML missing'));
 assert.ok(sh.includes('p5_android_verified_by_real_instrumentation'));
});

test('P8 real Moments viewports resize display outside live garden without weakening gates',()=>{
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 const start=java.indexOf('void visualEvolutionP5_realMomentsAndroidScreens_andPrivacy()');
 const end=java.indexOf('@Test public void galaxyChat_renders13Cards_',start);
 assert.ok(start>0&&end>start);
 const p5=java.slice(start,end);
 assert.ok(p5.indexOf('runV5Js("go(\'home\')")')<p5.indexOf('shell("wm size "+w+"x"+realHeight)'));
 assert.ok(p5.indexOf('runV5Js("go(\'moments\');window.scrollTo(0,0)")')>p5.indexOf('shell("wm size "+w+"x"+realHeight)'));
 for(const css of ['320','360','393','412'])assert.ok(p5.includes('new int[]{320,360,393,412}'));
 assert.ok(p5.includes('awaitV5QaPainted("p5-moments-"+css)'));
 assert.ok(p5.includes('awaitV5QaPainted("p5-text-zoom-"+css)'));
 assert.ok(p5.includes('awaitV5QaPainted("p5-theme-"+theme)'));
 assert.ok(p5.includes('shell("screencap -p /sdcard/Download/V5-P5-moments-"+css+".png")'));
 assert.ok(p5.includes('shell("wm size reset")'));
});

test('P8 Android CI pins proven stable-era emulator rather than blindly installing 37.2.12',()=>{
 for(const [name,instances] of [['qa-phase5-real-integration.yml',1],['visual-evolution-p0.yml',1],['chat-4-phase11-torture.yml',2]]){
  const ci=readFileSync(resolve(root,'.github/workflows',name),'utf8');
  const pin=(ci.match(/emulator-build: 15261927/g)||[]).length;
  assert.equal(pin,instances,name+' must pin every isolated AVD to Emulator 36.5.11');
  assert.equal((ci.match(/-gpu software -memory 1536 -no-snapshot/g)||[]).length,instances);
  assert.ok(!ci.includes('"platform-tools" "emulator"'),name+' must not waste SDK bandwidth installing the newest crashing QEMU before the pin');
  assert.ok(ci.includes('connectedDebugAndroidTest')||ci.includes('scripts/qa-phase5-emulator.sh')||ci.includes('scripts/visual-evolution-p1-avd.sh'),name+' must retain physical instrumentation');
 }
});

test('P8 Motion CI retries incomplete SDK downloads without skipping instrumented Motion tests',()=>{
 const ci=readFileSync(resolve(root,'.github/workflows/chat-4-phase8-motion.yml'),'utf8');
 assert.ok(ci.includes('for attempt in 1 2 3'));
 assert.ok(ci.includes('test "$sdk_ok" -eq 1'));
 assert.ok(ci.includes('chatPhase8Motion_realWebViewEventsReducedMotionAnd20k'));
 assert.ok(ci.includes('chatMotionBenchmark20k_device'));
 assert.ok(!ci.includes('continue-on-error: true'));
});

test('P8 Android P6/P7 capture gate requires six real painted, targeted screens and unchanged sharing',()=>{
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 const start=java.indexOf('@Test public void visualEvolutionP8_realMemoriesMoreScreens_andPrivateControls()');
 const end=java.indexOf('@Test public void galaxyChat_renders13Cards_',start);
 assert.ok(start>=0&&end>start,'New Android instrumentation must be in the suite');
 const m=java.slice(start,end);
 for(const label of ['memories-discover','memories-collections','memories-history','more-privacy','more-backups','more-system']){
  assert.ok(m.includes('awaitV5QaPainted("p8-'+label+'")'),'Native paint gate required: '+label);
  assert.ok(m.includes('shell("screencap -p /sdcard/Download/V5-P8-'+label+'.png")'),'Real device PNG required: '+label);
 }
 assert.equal((m.match(/awaitV5QaPainted\("p8-/g)||[]).length,6,'Exactly six native framebuffer checks');
 assert.match(m,/go\('memories'\)/);
 assert.match(m,/go\('more'\)/);
 assert.match(m,/memories-v5-category/);
 for(const group of ['privacy','backups','system']){
  assert.ok(m.includes("GalaxyMoreV5.revealGroup(app,'"+group+"')"));
  assert.ok(m.includes("v5-more-group") && m.includes("data-group"),"Visible details must be asserted");
  assert.ok(m.includes("getBoundingClientRect()"),'Require on-screen target visibility');
 }
 assert.match(m,/Opening privacy controls must not change sharing/);
 assert.ok(!m.includes('backup-import({'),'UI proof must never restore data');
 assert.ok(m.includes("v5-qa-paint-marker"),'Native framebuffer marker mandatory');
});

test('P8 native floating controls reposition without a transient bottom animation collision',()=>{
 const css=readFileSync(resolve(root,'android/app/src/main/assets/mobile/celestial-shell.css'),'utf8');
 assert.match(css,/body:not\(\.chat-mode\) #app:has\(\.floating-add:not\(\.hidden\)\) ~ #chatFab:not\(\.hidden\)/);
 assert.match(css,/transition:transform var\(--v5-motion-fast\),box-shadow var\(--v5-motion-standard\)/);
 assert.ok(!css.includes('transition:bottom var(--v5-motion-standard)'),
  'The FAB/add must not overlap while CSS transitions its vertical position');
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 assert.match(java,/FAB\/add collide with Android nav/);
 assert.match(java,/nav:coords\(nav\),fab:coords\(fab\),add:coords\(add\)/);
});

test('P8 notification filters stay touch-safe while pressed on narrow screens',()=>{
 const css=readFileSync(resolve(root,'android/app/src/main/assets/mobile/galaxy-discovery-v5.css'),'utf8');
 assert.match(css,/\.v5-notification-filter\s*\{[^}]*min-height:48px/s);
 const generic=read('app.css');
 assert.match(generic,/button:active:not\(:disabled\)[^{]*\{transform:scale\(\.985\)/);
 assert.ok(48*.985 >= 44,'Pressed 48px CTA must retain 44px physical hit size');
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 assert.match(java,/P3 filter touch target below 44px/);
});

test('P8 physical Android covers real authenticated garden zero and eight without demo or losing PNG gate',()=>{
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 const start=java.indexOf('void visualEvolutionP8_realBondGardenZeroAndEightStages()');
 const end=java.indexOf('@Test public void visualEvolutionP5_realMomentsAndroidScreens_andPrivacy()',start);
 assert.ok(start>0 && end>start,'Android test must verify both authenticated garden boundaries');
 const segment=java.slice(start,end);
 assert.ok(segment.includes('new int[]{0,8}'));
 assert.ok(segment.includes("dataset.officialStage"));
 assert.ok(segment.includes("dataset.demo==='false'"));
 assert.ok(segment.includes("document.querySelectorAll('.ng-garden .ng-plant').length"));
 assert.ok(segment.includes('awaitV5QaPainted("p8-garden-stage-"+stage)'));
 assert.ok(segment.includes('screencap -p /sdcard/Download/V5-P8-garden-stage-'));
 assert.ok(!segment.includes('previewBloomTotal'),'Official Bond test must never use demo growth');
});

test('P8 Bond garden 0/8 has stage-accurate public labels without fabricated server labels',()=>{
 const app=read('app.js');
 assert.ok(app.includes("garden.label||(stage===0?'El comienzo':stage===8?'Ocho girasoles':'Nuestros girasoles')"));
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 assert.ok(java.includes('P8 stage "+stage+" must have accurate public title'));
 assert.ok(java.includes('stage==0?"El comienzo":"Ocho girasoles"'));
});

test('P8 database CI avoids host-port collisions while retaining every SQL gate',()=>{
 const ci=readFileSync(resolve(root,'.github/workflows/chat-correctness-db.yml'),'utf8');
 assert.ok(ci.includes('QA_DB_PORT="$(python3 -c'), 'CI must allocate a free port on the isolated runner');
 assert.ok(ci.includes('sed -i "s/^port = 54322$/port = ${QA_DB_PORT}/" supabase/config.toml'));
 assert.ok(ci.includes('grep -q "^port = ${QA_DB_PORT}$" supabase/config.toml'));
 assert.ok(ci.includes('QA_DB_URL=postgresql://postgres:postgres@127.0.0.1:${QA_DB_PORT}/postgres'));
 assert.ok(ci.includes('run: psql "$QA_DB_URL" -v ON_ERROR_STOP=1 -f tests/chat-correctness-db.sql'));
 assert.ok(ci.includes('run: DB_URL="$QA_DB_URL" bash tests/chat-correctness-concurrency.sh'));
 assert.ok(ci.includes('DB="$QA_DB_URL"'));
 assert.ok(ci.includes('deno check --node-modules-dir=auto supabase/functions/android-companion/index.ts'));
 assert.ok(ci.includes('supabase/rollbacks/20261005023031_qa_phase2_chat_correctness_rollback.sql'));
 assert.ok(ci.includes('supabase stop --no-backup'));
 assert.ok(!ci.includes('continue-on-error: true'),'dynamic port may not bypass any real database failures');
});

test('P8 P0 transient Maven 429 does not bypass the debug APK build or device screenshot gates',()=>{
 const ci=readFileSync(resolve(root,'.github/workflows/visual-evolution-p0.yml'),'utf8');
 assert.match(ci,/for attempt in 1 2 3; do\s+if gradle -p android --no-daemon --max-workers=2 assembleDebug 2>&1 \| tee/);
 assert.match(ci,/test "\$built" -eq 1/);
 assert.ok(ci.includes("Received status code (429|502|503)"),'Only transient repository HTTP failures may retry');
 assert.ok(ci.includes('non-transient reason; refusing blind retries'),'Java or build errors fail without repeated expensive work');
 assert.match(ci,/script: bash scripts\/visual-evolution-p1-avd.sh/);
 assert.match(ci,/if: failure\(\)/);
 assert.doesNotMatch(ci,/continue-on-error: true/);
});
