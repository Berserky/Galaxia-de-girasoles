package com.nuestragalaxia.companion;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.withContentDescription;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.SystemClock;
import androidx.camera.core.CameraSelector;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import com.google.common.util.concurrent.ListenableFuture;
import org.junit.After;
import org.junit.Assume;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.concurrent.TimeUnit;

@RunWith(AndroidJUnit4.class)
public class GalaxyMediaExperienceTest {
    private final Context context=ApplicationProvider.getApplicationContext();
    private final UiDevice device=UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());

    @Before public void permissions(){
        String pkg=context.getPackageName();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(pkg,Manifest.permission.CAMERA);
    }

    @After public void cleanup(){
        deleteTree(new File(context.getCacheDir(),"camera-media"));
        deleteTree(new File(context.getCacheDir(),"chat-files/qa-media"));
    }

    @Test public void nativeGalleryReview_previewsRemovesAndCancelsWithoutUpload() throws Exception {
        Uri image=createJpeg();
        ArrayList<Uri> uris=new ArrayList<>();uris.add(image);
        Intent intent=new Intent(context,GalaxyMediaReviewActivity.class)
            .putParcelableArrayListExtra(GalaxyMediaReviewActivity.EXTRA_URIS,uris)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK);
        try(ActivityScenario<GalaxyMediaReviewActivity> scenario=ActivityScenario.launch(intent)){
            onView(withContentDescription("Vista previa de la imagen seleccionada")).check(matches(isDisplayed()));
            onView(withContentDescription("Comentario opcional")).check(matches(isDisplayed()));
            onView(withContentDescription("Confirmar selección")).check(matches(isDisplayed()));
            onView(withContentDescription("Quitar elemento")).check(matches(isDisplayed()));
        }
        assertTrue("Review must not delete picker-owned content.",new File(context.getCacheDir(),"chat-files/qa-media/qa.jpg").exists());
    }

    @Test public void cameraX_photoRearFrontReviewRetakeAndCancel_whenVirtualCameraExists() throws Exception {
        ProcessCameraProvider provider=provider();
        Assume.assumeTrue("No back CameraX camera in this environment.",provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA));
        Intent intent=new Intent(context,GalaxyCameraActivity.class)
            .putExtra(GalaxyCameraActivity.EXTRA_MODE,"photo")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try(ActivityScenario<GalaxyCameraActivity> scenario=ActivityScenario.launch(intent)){
            assertTrue(device.wait(Until.hasObject(By.desc("Tomar foto")),8_000));
            assertTrue(device.hasObject(By.desc("Activar flash")));
            if(provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)){
                UiObject2 switcher=device.findObject(By.desc("Cambiar cámara"));
                assertTrue(switcher!=null&&switcher.isEnabled());switcher.click();SystemClock.sleep(600);switcher.click();SystemClock.sleep(600);
            }
            device.findObject(By.desc("Tomar foto")).click();
            assertTrue("Photo capture did not reach review.",device.wait(Until.hasObject(By.desc("Confirmar captura")),10_000));
            onView(withContentDescription("Vista previa de la foto")).check(matches(isDisplayed()));
            device.findObject(By.desc("Repetir captura")).click();
            assertTrue(device.wait(Until.hasObject(By.desc("Tomar foto")),6_000));
            device.findObject(By.desc("Cerrar cámara")).click();
        }
        assertFalse("Cancelled camera capture left a temp file.",hasFiles(new File(context.getCacheDir(),"camera-media")));
    }

    @Test public void cameraX_videoHasBoundedRecordingPreviewPlaybackRetakeAndCleanup_whenVirtualCameraExists() throws Exception {
        ProcessCameraProvider provider=provider();
        Assume.assumeTrue("No back CameraX camera in this environment.",provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA));
        Intent intent=new Intent(context,GalaxyCameraActivity.class)
            .putExtra(GalaxyCameraActivity.EXTRA_MODE,"video")
            .putExtra(GalaxyCameraActivity.EXTRA_MAX_DURATION,3)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try(ActivityScenario<GalaxyCameraActivity> scenario=ActivityScenario.launch(intent)){
            assertTrue(device.wait(Until.hasObject(By.desc("Iniciar grabación")),8_000));
            device.findObject(By.desc("Iniciar grabación")).click();
            assertTrue(device.wait(Until.hasObject(By.desc("Detener grabación")),4_000));
            SystemClock.sleep(1_200);
            device.findObject(By.desc("Detener grabación")).click();
            assertTrue("Video capture did not reach review.",device.wait(Until.hasObject(By.desc("Confirmar captura")),12_000));
            onView(withContentDescription("Vista previa del video")).check(matches(isDisplayed()));
            device.findObject(By.desc("Repetir captura")).click();
            assertTrue(device.wait(Until.hasObject(By.desc("Iniciar grabación")),6_000));
            device.findObject(By.desc("Cerrar cámara")).click();
        }
        assertFalse("Cancelled video capture left a temp file.",hasFiles(new File(context.getCacheDir(),"camera-media")));
    }

    private ProcessCameraProvider provider() throws Exception {
        ListenableFuture<ProcessCameraProvider> future=ProcessCameraProvider.getInstance(context);
        return future.get(10,TimeUnit.SECONDS);
    }

    private Uri createJpeg() throws Exception {
        File dir=new File(context.getCacheDir(),"chat-files/qa-media");assertTrue(dir.exists()||dir.mkdirs());
        File file=new File(dir,"qa.jpg");
        Bitmap bitmap=Bitmap.createBitmap(64,48,Bitmap.Config.ARGB_8888);
        try(FileOutputStream out=new FileOutputStream(file)){assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG,90,out));}
        bitmap.recycle();
        return FileProvider.getUriForFile(context,context.getPackageName()+".files",file);
    }

    private static boolean hasFiles(File dir){
        File[] files=dir.listFiles();return files!=null&&files.length>0;
    }

    private static void deleteTree(File file){
        if(file==null||!file.exists())return;
        File[] children=file.listFiles();if(children!=null)for(File child:children)deleteTree(child);
        try{file.delete();}catch(Exception ignored){}
    }
}
