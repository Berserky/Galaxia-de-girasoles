import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const mobile=read('android/app/src/main/java/com/nuestragalaxia/companion/MobileApiClient.java');
const sniffer=read('android/app/src/main/java/com/nuestragalaxia/companion/MediaSniffer.java');
const app=read('android/app/src/main/assets/mobile/app.js');
const edge=read('supabase/functions/android-companion/index.ts');
const media=read('supabase/functions/android-companion/media-validation.ts');
const gradle=read('android/app/build.gradle.kts');
const workflow=read('.github/workflows/android-companion.yml');

test('NG-QA-005 keeps GIPHY credentials server-side and degrades explicitly',()=>{
  assert.equal(gradle.includes('GIPHY_API_KEY'),false);
  assert.equal(workflow.includes('GIPHY_API_KEY:'),false);
  assert.equal(main.includes('BuildConfig.GIPHY_API_KEY'),false);
  assert.equal(mobile.includes('BuildConfig.GIPHY_API_KEY'),false);
  assert.ok(edge.includes('Deno.env.get("GIPHY_API_KEY")'));
  assert.ok(edge.includes('configured:false'));
  assert.ok(edge.includes('action==="giphy-search"'));
  assert.ok(app.includes('GIFs online no configurados'));
  assert.ok(app.includes('GIPHY no respondió'));
  assert.ok(app.includes('finally{'));
});

test('NG-QA-015 normalizes HEIC and HEIF selected by Android to JPEG',()=>{
  for(const marker of ['image/heic','image/heif'])assert.ok(sniffer.includes(marker),marker);
  assert.ok(mobile.includes('transcodeHeifToJpeg'));
  assert.ok(mobile.includes('Bitmap.CompressFormat.JPEG'));
  assert.ok(mobile.includes('replaceExtension(name,"jpg")'));
  assert.ok(app.includes("!['image/heic','image/heif'].includes(mime)"));
  assert.ok(media.includes('debe convertirse a JPEG'));
});

test('NG-QA-016 compares declared MIME against real content',()=>{
  for(const marker of ['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm','audio/mpeg','application/pdf','application/zip','DOCX_MIME','XLSX_MIME','text/plain'])assert.ok(media.includes(marker),marker);
  assert.ok(edge.includes('validateUploadMedia(kind,declaredMime,originalName,bytes)'));
  assert.ok(media.includes('El MIME declarado no coincide con el contenido real del archivo.'));
  assert.ok(media.includes('El contenido real del archivo no es compatible'));
  assert.ok(edge.includes('El archivo está vacío.'));
});

test('upload size boundary is exact and retry is idempotent',()=>{
  assert.ok(edge.includes('if(total>limit)'));
  assert.ok(edge.includes('if(Number.isFinite(declared)&&declared>rules.limit)'));
  assert.ok(mobile.includes('if(sent>limit)'));
  assert.ok(mobile.includes('x-upload-id'));
  assert.ok(edge.includes('x-upload-id'));
  assert.ok(edge.includes('upsert:false'));
  assert.ok(edge.includes('reused:!!error'));
  assert.ok(mobile.includes('for(int attempt=0;attempt<2;attempt++)'));
});

test('picker cancellation and revoked permissions terminate cleanly',()=>{
  assert.ok(main.includes('Selección cancelada.'));
  assert.ok(app.includes('/cancelad[ao]/i.test(message)'));
  assert.ok(mobile.includes('Android perdió el permiso para leer este archivo. Selecciónalo de nuevo.'));
  assert.ok(main.includes('PERMISSION_CAMERA'));
  assert.ok(main.includes('PERMISSION_MICROPHONE'));
  assert.ok(app.includes('openChatPermissionHelp'));
});

test('no false empty chat message is queued',()=>{
  assert.ok(app.includes("if(!text&&messageType==='text'&&!attachments.length)return;"));
  assert.ok(app.includes("for(const item of uploads)if(item?.path)chatAttachmentsDraft.push"));
});

test('openChatFile privacy boundary and WebView file isolation remain intact',()=>{
  assert.ok(main.includes('!"https".equalsIgnoreCase(source.getScheme())'));
  assert.ok(main.includes('source.getHost().equalsIgnoreCase(backend.getHost())'));
  assert.ok(main.includes('/storage/v1/object/sign/galaxy-chat-media/'));
  assert.ok(main.includes('settings.setAllowFileAccess(false)'));
  assert.ok(main.includes('settings.setAllowContentAccess(false)'));
  assert.ok(main.includes('settings.setAllowFileAccessFromFileURLs(false)'));
  assert.ok(main.includes('settings.setAllowUniversalAccessFromFileURLs(false)'));
  assert.ok(main.includes('FileProvider.getUriForFile'));
  assert.equal(main.includes('file://'),false);
});

test('staging compiles a real release artifact without publishing android-stable',()=>{
  assert.ok(workflow.includes('assembleDebug assembleRelease'));
  assert.ok(workflow.includes('NuestraGalaxia-release-staging'));
  assert.ok(workflow.includes('CURRENT_VERSION')&&workflow.includes('BEFORE_VERSION')&&workflow.includes('$CURRENT_VERSION" != "$BEFORE_VERSION'));
  const buildBlock=workflow.slice(workflow.indexOf('  build:'),workflow.indexOf('  release_scope:'));
  assert.equal(buildBlock.includes('android-stable'),false);
});
