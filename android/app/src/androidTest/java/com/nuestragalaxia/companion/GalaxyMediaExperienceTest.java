package com.nuestragalaxia.companion;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
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
import org.json.JSONObject;
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
        long inspectStarted=SystemClock.elapsedRealtime();
        JSONObject inspected=MediaInspector.inspect(context,image);
        long inspectMs=SystemClock.elapsedRealtime()-inspectStarted;
        assertTrue(inspected.optLong("width",0)>0&&inspected.optLong("height",0)>0);
        try(ActivityScenario<GalaxyMediaReviewActivity> scenario=ActivityScenario.launch(intent)){
            scenario.onActivity(activity->{
                View decor=activity.getWindow().getDecorView();
                assertTrue(findByDescription(decor,"Vista previa de la imagen seleccionada")!=null);
                assertTrue(findByDescription(decor,"Comentario opcional")!=null);
                assertTrue(findByDescription(decor,"Confirmar selección")!=null);
                assertTrue(findByDescription(decor,"Quitar elemento")!=null);
            });
        }
        assertTrue("Review must not delete picker-owned content.",new File(context.getCacheDir(),"chat-files/qa-media/qa.jpg").exists());
        System.out.println("GALAXY_CHAT_PHASE5_ANDROID="+new JSONObject().put("case","picker-review").put("inspectMs",inspectMs).put("mime",inspected.optString("mime")));
    }

    @Test public void cameraX_photoRearFrontReviewRetakeAndCancel_whenCameraExists() throws Exception {
        ProcessCameraProvider provider=provider();
        Assume.assumeTrue("No back CameraX camera in this environment.",provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA));
        Intent intent=new Intent(context,GalaxyCameraActivity.class)
            .putExtra(GalaxyCameraActivity.EXTRA_MODE,"photo")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        long pssBefore=android.os.Debug.getPss(),openStarted=SystemClock.elapsedRealtime(),openMs,captureMs;
        try(ActivityScenario<GalaxyCameraActivity> scenario=ActivityScenario.launch(intent)){
            assertTrue(device.wait(Until.hasObject(By.desc("Tomar foto")),8_000));
            scenario.recreate();
            assertTrue("Camera did not survive lifecycle recreation.",device.wait(Until.hasObject(By.desc("Tomar foto")),8_000));
            openMs=SystemClock.elapsedRealtime()-openStarted;
            assertTrue(device.hasObject(By.desc("Activar flash")));
            scenario.onActivity(activity->{
                View decor=activity.getWindow().getDecorView();
                View close=findByDescription(decor,"Cerrar cámara"),shutter=findByDescription(decor,"Tomar foto"),switchView=findByDescription(decor,"Cambiar cámara");
                assertTrue(close!=null&&close.getHeight()>=dp(context,48));
                assertTrue(shutter!=null&&shutter.getHeight()>=dp(context,48));
                assertTrue(switchView!=null&&switchView.getHeight()>=dp(context,48));
            });
            if(provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)){
                UiObject2 switcher=device.findObject(By.desc("Cambiar cámara"));
                assertTrue(switcher!=null&&switcher.isEnabled());switcher.click();SystemClock.sleep(600);switcher.click();SystemClock.sleep(600);
            }
            long captureStarted=SystemClock.elapsedRealtime();
            device.findObject(By.desc("Tomar foto")).click();
            assertTrue("Photo capture did not reach review.",device.wait(Until.hasObject(By.desc("Confirmar captura")),10_000));
            captureMs=SystemClock.elapsedRealtime()-captureStarted;
            scenario.onActivity(activity->{
                assertTrue(findByDescription(activity.getWindow().getDecorView(),"Vista previa de la foto")!=null);
                View repeat=findByText(activity.getWindow().getDecorView(),"Repetir");
                assertTrue(repeat!=null&&repeat.performClick());
            });
            assertTrue(device.wait(Until.hasObject(By.desc("Tomar foto")),6_000));
            if(provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)){
                device.findObject(By.desc("Cambiar cámara")).click();SystemClock.sleep(600);
                device.findObject(By.desc("Tomar foto")).click();
                assertTrue("Front photo capture did not reach review.",device.wait(Until.hasObject(By.desc("Confirmar captura")),10_000));
                scenario.onActivity(activity->{View repeat=findByText(activity.getWindow().getDecorView(),"Repetir");assertTrue(repeat!=null&&repeat.performClick());});
                assertTrue(device.wait(Until.hasObject(By.desc("Tomar foto")),6_000));
            }
            device.findObject(By.desc("Cerrar cámara")).click();
        }
        assertFalse("Cancelled camera capture left a temp file.",hasFiles(new File(context.getCacheDir(),"camera-media")));
        System.out.println("GALAXY_CHAT_PHASE5_ANDROID="+new JSONObject().put("case","photo").put("openMs",openMs).put("capturePreviewMs",captureMs).put("pssBeforeKb",pssBefore).put("pssAfterKb",android.os.Debug.getPss()));
    }

    @Test public void cameraX_videoHasBoundedRecordingPreviewPlaybackRetakeAndCleanup_whenCameraExists() throws Exception {
        ProcessCameraProvider provider=provider();
        Assume.assumeTrue("No back CameraX camera in this environment.",provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA));
        Intent intent=new Intent(context,GalaxyCameraActivity.class)
            .putExtra(GalaxyCameraActivity.EXTRA_MODE,"video")
            .putExtra(GalaxyCameraActivity.EXTRA_MAX_DURATION,3)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        long pssBefore=android.os.Debug.getPss(),previewMs=0;
        try(ActivityScenario<GalaxyCameraActivity> scenario=ActivityScenario.launch(intent)){
            assertTrue(device.wait(Until.hasObject(By.desc("Iniciar grabación")),8_000));
            device.findObject(By.desc("Iniciar grabación")).click();
            assertTrue(device.wait(Until.hasObject(By.desc("Detener grabación")),4_000));
            SystemClock.sleep(1_200);
            long stopStarted=SystemClock.elapsedRealtime();
            device.findObject(By.desc("Detener grabación")).click();
            assertTrue("Video capture did not reach review.",device.wait(Until.hasObject(By.desc("Confirmar captura")),12_000));
            previewMs=SystemClock.elapsedRealtime()-stopStarted;
            scenario.onActivity(activity->{
                assertTrue(findByDescription(activity.getWindow().getDecorView(),"Vista previa del video")!=null);
                try{
                    File[] files=new File(context.getCacheDir(),"camera-media").listFiles((dir,name)->name.startsWith("galaxy-camerax-video-")&&name.endsWith(".mp4"));
                    assertTrue("CameraX review did not retain its private MP4.",files!=null&&files.length==1);
                    Uri captured=FileProvider.getUriForFile(context,context.getPackageName()+".files",files[0]);
                    JSONObject meta=MediaInspector.inspect(context,captured);
                    assertTrue("CameraX MIME was rejected: "+meta,"video/mp4".equals(meta.optString("mime")));
                    assertTrue("CameraX MP4 container brand missing: "+meta,!meta.optString("containerBrand","").isBlank());
                    assertTrue("CameraX duration metadata missing: "+meta,meta.optLong("durationMs",0)>0);
                }catch(Exception e){throw new AssertionError("CameraX MP4 inspection failed",e);}
                View repeat=findByText(activity.getWindow().getDecorView(),"Repetir");
                assertTrue(repeat!=null&&repeat.performClick());
            });
            assertTrue(device.wait(Until.hasObject(By.desc("Iniciar grabación")),6_000));
            device.findObject(By.desc("Cerrar cámara")).click();
        }
        assertFalse("Cancelled video capture left a temp file.",hasFiles(new File(context.getCacheDir(),"camera-media")));
        System.out.println("GALAXY_CHAT_PHASE5_ANDROID="+new JSONObject().put("case","video").put("stopPreviewMs",previewMs).put("pssBeforeKb",pssBefore).put("pssAfterKb",android.os.Debug.getPss()));
    }

    private ProcessCameraProvider provider() throws Exception {
        ListenableFuture<ProcessCameraProvider> future=ProcessCameraProvider.getInstance(context);
        try{
            return future.get(10,TimeUnit.SECONDS);
        }catch(Exception e){
            Assume.assumeNoException("CameraX no está disponible en este emulador; la cobertura con cámara se ejecuta en el gate dedicado.",e);
            return null;
        }
    }

    private Uri createJpeg() throws Exception {
        File dir=new File(context.getCacheDir(),"chat-files/qa-media");assertTrue(dir.exists()||dir.mkdirs());
        File file=new File(dir,"qa.jpg");
        Bitmap bitmap=Bitmap.createBitmap(64,48,Bitmap.Config.ARGB_8888);
        try(FileOutputStream out=new FileOutputStream(file)){assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG,90,out));}
        bitmap.recycle();
        return FileProvider.getUriForFile(context,context.getPackageName()+".files",file);
    }

    private static View findByDescription(View root,String description){
        if(root==null)return null;
        CharSequence value=root.getContentDescription();
        if(value!=null&&description.contentEquals(value))return root;
        if(root instanceof ViewGroup group)for(int i=0;i<group.getChildCount();i++){View found=findByDescription(group.getChildAt(i),description);if(found!=null)return found;}
        return null;
    }

    private static View findByText(View root,String text){
        if(root==null)return null;
        if(root instanceof TextView view&&text.contentEquals(view.getText()))return view;
        if(root instanceof ViewGroup group)for(int i=0;i<group.getChildCount();i++){View found=findByText(group.getChildAt(i),text);if(found!=null)return found;}
        return null;
    }

    private static int dp(Context context,int value){return Math.round(value*context.getResources().getDisplayMetrics().density);}

    private static boolean hasFiles(File dir){
        File[] files=dir.listFiles();return files!=null&&files.length>0;
    }

    private static void deleteTree(File file){
        if(file==null||!file.exists())return;
        File[] children=file.listFiles();if(children!=null)for(File child:children)deleteTree(child);
        try{file.delete();}catch(Exception ignored){}
    }
}
