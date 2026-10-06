import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const bridge=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java');
const camera=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyCameraActivity.java');
const review=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyMediaReviewActivity.java');
const inspector=read('android/app/src/main/java/com/nuestragalaxia/companion/MediaInspector.java');
const mobile=read('android/app/src/main/java/com/nuestragalaxia/companion/MobileApiClient.java');
const manifest=read('android/app/src/main/AndroidManifest.xml');
const gradle=read('android/app/build.gradle.kts');
const paths=read('android/app/src/main/res/xml/file_paths.xml');
const app=read('android/app/src/main/assets/mobile/app.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const edge=read('supabase/functions/android-companion/index.ts');
const validation=read('supabase/functions/android-companion/media-validation.ts');

test('CameraX integrated capture is private and replaces external chat video capture',()=>{
 for(const dep of ['camera-core:1.5.3','camera-camera2:1.5.3','camera-lifecycle:1.5.3','camera-view:1.5.3','camera-video:1.5.3'])assert.ok(gradle.includes(dep),dep);
 assert.ok(manifest.includes('.GalaxyCameraActivity')&&manifest.includes('android:exported="false"'));
 assert.ok(main.includes('captureIntegratedChatCamera(requestId,"photo"'));
 assert.ok(main.includes('captureIntegratedChatCamera(requestId,"video"'));
 assert.equal(main.includes('MediaStore.ACTION_VIDEO_CAPTURE'),false);
 assert.ok(main.includes('MediaStore.ACTION_IMAGE_CAPTURE'),'Date Mode legacy camera remains isolated from Galaxy Chat');
});

test('photo capture has rear/front camera, flash, autofocus, review, retake and explicit confirmation',()=>{
 for(const marker of [
  'CameraSelector.LENS_FACING_BACK','CameraSelector.LENS_FACING_FRONT','switchCamera()',
  'enableTorch(torch)','FocusMeteringAction.Builder','takePicture(','showReview()',
  'Repetir captura','Confirmar captura','cancelAndFinish()','setReversedHorizontal'
 ])assert.ok(camera.includes(marker),marker);
 assert.ok(camera.includes('ImageDecoder.decodeBitmap'),'photo review must honor orientation metadata on modern Android');
 assert.equal(camera.includes('MediaStore.ACTION_IMAGE_CAPTURE'),false);
});

test('video capture is integrated, bounded, reviewable and never auto-sent',()=>{
 for(const marker of [
  'VideoCapture<Recorder>','prepareRecording','VideoRecordEvent.Status','maxDurationSeconds*1000L',
  'Detener grabación','VideoView','MediaController','showReview()','Repetir captura'
 ])assert.ok(camera.includes(marker),marker);
 assert.ok(camera.includes('EXTRA_MAX_DURATION'));
 assert.ok(camera.includes('capturedDurationMs'));
 assert.equal(camera.includes('MobileApiClient.upload'),false,'camera UI must not upload before user confirms');
});

test('cancel and lifecycle cleanup use app-private cache without gallery persistence',()=>{
 assert.ok(camera.includes('getCacheDir(),"camera-media"'));
 assert.ok(camera.includes('deleteCaptured()'));
 assert.ok(camera.includes('if(!confirmed&&!isChangingConfigurations())deleteCaptured()'));
 assert.ok(main.includes('deleteOwnedCameraUri'));
 assert.ok(paths.includes('<cache-path name="camera-media" path="camera-media/"'));
 assert.equal(camera.includes('MediaStore.Images.Media.EXTERNAL_CONTENT_URI'),false);
});

test('Photo Picker supports ordered image/video multiselect with native review and removal',()=>{
 assert.ok(main.includes('PickMultipleVisualMedia(30)'));
 assert.ok(main.includes('PickVisualMedia.ImageAndVideo.INSTANCE'));
 assert.ok(main.includes('uris.subList(0,Math.min(12,uris.size()))'));
 assert.ok(manifest.includes('.GalaxyMediaReviewActivity')&&manifest.includes('android:exported="false"'));
 for(const marker of ['Vista previa del video seleccionado','Vista previa de la imagen seleccionada','Quitar elemento','Anterior','Siguiente','Confirmar selección'])
  assert.ok(review.includes(marker),marker);
 assert.ok(review.includes('new ArrayList<>(items)'),'selection order must be preserved');
});

test('picker and camera both preview before upload',()=>{
 const pickerIndex=main.indexOf('handlePhotoPickerResult');
 const reviewIndex=main.indexOf('launchChatMediaReview',pickerIndex);
 const uploadIndex=main.indexOf('uploadReviewedChatMedia',reviewIndex);
 assert.ok(pickerIndex>=0&&reviewIndex>pickerIndex&&uploadIndex>reviewIndex);
 assert.ok(camera.indexOf('showReview()')<camera.indexOf('confirmCapture'));
});

test('real MIME and metadata are inspected instead of trusting extensions',()=>{
 for(const mime of ['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm'])assert.ok(inspector.includes(mime),mime);
 assert.ok(inspector.includes('MediaSniffer.sniff'));
 assert.ok(inspector.includes('MediaMetadataRetriever'));
 for(const marker of ['durationMs','width','height','rotation'])assert.ok(inspector.includes(marker),marker);
 assert.ok(mobile.includes('actualKnown?actual'));
 assert.ok(mobile.includes('El contenido no corresponde a una imagen permitida.'));
 assert.ok(mobile.includes('El contenido no corresponde a un video permitido.'));
 assert.ok(validation.includes('validateUploadMedia'));
});

test('HEIC/HEIF remain supported through pipeline-required safe normalization',()=>{
 for(const marker of ['image/heic','image/heif']){assert.ok(inspector.includes(marker));assert.ok(validation.includes(marker));}
 assert.ok(review.includes('ImageDecoder.decodeBitmap'));
 assert.ok(mobile.includes('transcodeHeifToJpeg'));
 assert.ok(mobile.includes('Bitmap.CompressFormat.JPEG'));
 assert.ok(mobile.includes('normalized-media'));
});

test('streaming upload reports only measured progress and is cancellable',()=>{
 assert.ok(mobile.includes('interface UploadObserver'));
 assert.ok(mobile.includes('observer.onProgress(sent,source.length)'));
 assert.ok(mobile.includes('observer.isCancelled()'));
 assert.ok(mobile.includes('UploadCancelledException'));
 assert.ok(bridge.includes('cancelChatMediaUpload'));
 assert.ok(main.includes('chatMediaUploadCancelled'));
 assert.ok(app.includes('cancelChatMediaUpload'));
 assert.ok(app.includes('<progress max="100" value="'));
 assert.ok(app.includes('s.total>0'),'unknown totals must not produce a fake percentage');
});

test('cancelled or removed draft uploads are cleaned only when unreferenced',()=>{
 assert.ok(edge.includes('async function chatMediaDiscard'));
 assert.ok(edge.includes('galaxy_chat_attachments'));
 assert.ok(edge.includes('Number(primary.count||0)>0||Number(thumb.count||0)>0'));
 assert.ok(edge.includes('db.storage.from("galaxy-chat-media").remove([path])'));
 assert.ok(main.includes('discardUnreferencedChatMedia(uploadedPaths)'));
 assert.ok(app.includes('chat-media-discard'));
});

test('Composer retains caption contract and Delivery Engine remains the only message sender',()=>{
 assert.ok(app.includes("const caption=String(result?.caption||'').trim()"));
 assert.ok(app.includes("composer.setText(existing&&existing!==caption?existing+'\\n'+caption:caption)"));
 assert.ok(app.includes('queueCurrentChat'));
 assert.ok(app.includes('chatDeliveryEngine.queue(row)'));
 assert.ok(app.includes('chatAttachmentsDraft=[]'));
 assert.equal(camera.includes('chat-send'),false);
 assert.equal(review.includes('chat-send'),false);
});

test('media attachment metadata reserves dimensions and remains virtualized',()=>{
 assert.ok(app.includes('width:Number(upload.width||0)||null'));
 assert.ok(app.includes('height:Number(upload.height||0)||null'));
 assert.ok(app.includes('durationMs:durationMs||upload.durationMs||null'));
 assert.ok(app.includes('chatMessageEngine.range(rows)'));
 assert.ok(app.includes('chatScrollEngine'));
 assert.ok(css.includes('.chat-photo-card img'));
 assert.ok(css.includes('.chat-video-card video'));
});

test('permissions stay contextual and storage/file exposure remains restricted',()=>{
 assert.ok(main.includes('requestPermissions(new String[]{Manifest.permission.CAMERA}'));
 assert.ok(main.includes('Manifest.permission.RECORD_AUDIO'));
 assert.ok(main.includes('PERMISSION_CAMERA'));
 assert.ok(main.includes('PERMISSION_MICROPHONE'));
 assert.ok(main.includes('FileProvider.getUriForFile'));
 assert.ok(manifest.includes('androidx.core.content.FileProvider'));
 assert.equal(main.includes('file://'),false);
 assert.equal(manifest.includes('MANAGE_EXTERNAL_STORAGE'),false);
});

test('openChatFile allowlist and secure WebView posture are untouched',()=>{
 assert.ok(main.includes('/storage/v1/object/sign/galaxy-chat-media/'));
 assert.ok(main.includes('setAllowFileAccess(false)'));
 assert.ok(main.includes('setAllowContentAccess(false)'));
 assert.ok(main.includes('appassets.androidplatform.net'));
});

test('upload state integrates preparing/uploading/ready/failed/cancelled without blocking composer',()=>{
 for(const state of ['preparing','uploading','ready','failed','cancelled'])assert.ok(main.includes('"'+state+'"')||app.includes("'"+state+"'"),state);
 assert.ok(app.includes('chatMediaUploadMarkup()'));
 assert.ok(css.includes('.chat-media-upload'));
 assert.ok(app.includes("setChatPresence('UPLOADING_MEDIA')"));
 assert.ok(app.includes("setChatPresence('ONLINE')"));
});

test('Phase 5 does not alter stable promotion mechanics',()=>{
 const stable=read('.github/workflows/android-release-stable.yml');
 assert.ok(stable.includes('workflow_dispatch:'));
 assert.ok(stable.includes('PROMOTE_ANDROID_STABLE'));
 assert.equal(stable.includes('feat/chat-4-phase-5-media-camera'),false);
});
