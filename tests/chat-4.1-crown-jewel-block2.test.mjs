import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('android/app/src/main/assets/mobile/app.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const edge=read('supabase/functions/android-companion/index.ts');
const camera=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyCameraActivity.java');
const review=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyMediaReviewActivity.java');
const sniffer=read('android/app/src/main/java/com/nuestragalaxia/companion/MediaSniffer.java');
const inspector=read('android/app/src/main/java/com/nuestragalaxia/companion/MediaInspector.java');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const mediaEngine=read('android/app/src/main/assets/mobile/chat-media-engine.js');

test('VIS-064/065/066 camera and review use safe premium chrome',()=>{
 for(const source of [camera,review]){
  assert.ok(source.includes('WindowInsetsCompat.Type.statusBars()'));
  assert.ok(source.includes('WindowInsetsCompat.Type.navigationBars()'));
  assert.ok(source.includes('GradientDrawable'));
  assert.equal(source.includes('setBackgroundColor(0x55000000)'),false);
 }
 for(const marker of ['● REC','00:00','Detener grabación','maxDurationSeconds*1000L','Repetir','Usar'])assert.ok(camera.includes(marker),marker);
});

test('VIS-015 CameraX videos are content-sniffed through a structured ISO-BMFF parser',()=>{
 assert.ok(sniffer.includes('containerBrand(byte[] bytes)'));
 assert.ok(inspector.includes('MediaSniffer.containerBrand(prefix)'));
 assert.ok(main.includes('logChatMediaInspection'));
 assert.ok(main.includes('MobileApiClient.upload'));
 assert.ok(edge.includes('chat-video'));
});

test('VIS-014 broken photos never render an internal filename fallback',()=>{
 assert.ok(app.includes('chat-media-placeholder-error'));
 assert.ok(app.includes('alt="" aria-hidden="true"'));
 assert.ok(mediaEngine.includes("data-media-state','error'"));
 assert.ok(css.includes('.chat-photo-card[data-media-state="error"]'));
});

test('Location Hub and Acompáñame are guided Surface System flows',()=>{
 assert.ok(app.includes("showBottomSheet('Compartir ubicación'"));
 assert.ok(app.includes("showBottomSheet('Acompáñame'"));
 assert.ok(app.includes('¿A dónde vas?'));
 assert.ok(app.includes('window.GalaxyEta.eta'));
 assert.ok(app.includes('Iniciar Acompáñame no enciende el GPS automáticamente.'));
 for(const state of ['SALIÓ','EN CAMINO','CERCA','LLEGÓ','DETENIDO'])assert.ok(edge.includes(state));
});
