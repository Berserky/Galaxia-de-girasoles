import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=readFileSync(new URL('../android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyMediaExperienceTest.java',import.meta.url),'utf8');
test('native camera controls must be visible and receive actual Android touch',()=>{
 assert.match(file,/findByDescription\(activity\.getWindow\(\)\.getDecorView\(\),description\)/);
 assert.match(file,/view\.isShown\(\)/);
 assert.match(file,/device\.click\(point\[0\],point\[1\]\)/);
 assert.match(file,/Native camera control not visible after/);
 assert.doesNotMatch(file,/device\.wait\(Until\.hasObject\(By\.desc\(/);
 assert.match(file,/cameraX_photoRearFrontReviewRetakeAndCancel_whenCameraExists/);
 assert.match(file,/cameraX_videoHasBoundedRecordingPreviewPlaybackRetakeAndCleanup_whenCameraExists/);
 assert.match(file,/new File\(context\.getCacheDir\(\),"camera-media"\)/);
});
