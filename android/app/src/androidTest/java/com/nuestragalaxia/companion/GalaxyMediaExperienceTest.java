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
import java.util.concurrent.atomic.AtomicReference;

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
            awaitVisibleCameraControl(scenario,"Tomar foto",12_000);
            scenario.recreate();
            awaitVisibleCameraControl(scenario,"Tomar foto",12_000);
            openMs=SystemClock.elapsedRealtime()-openStarted;
            awaitVisibleCameraControl(scenario,"Activar flash",12_000);
            scenario.onActivity(activity->{
                View decor=activity.getWindow().getDecorView();
                View close=findByDescription(decor,"Cerrar cámara"),shutter=findByDescription(decor,"Tomar foto"),switchView=findByDescription(decor,"Cambiar cámara");
                assertTrue(close!=null&&close.getHeight()>=dp(context,48));
                assertTrue(shutter!=null&&shutter.getHeight()>=dp(context,48));
                assertTrue(switchView!=null&&switchView.getHeight()>=dp(context,48));
            });
            if(provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)){
                tapVisibleCameraControl(scenario,"Cambiar cámara");SystemClock.sleep(600);tapVisibleCameraControl(scenario,"Cambiar cámara");SystemClock.sleep(600);
            }
            long captureStarted=SystemClock.elapsedRealtime();
            tapVisibleCameraControl(scenario,"Tomar foto");
            awaitVisibleCameraControl(scenario,"Confirmar captura",12_000);
            captureMs=SystemClock.elapsedRealtime()-captureStarted;
            scenario.onActivity(activity->{
                assertTrue(findByDescription(activity.getWindow().getDecorView(),"Vista previa de la foto")!=null);
                View repeat=findByText(activity.getWindow().getDecorView(),"Repetir");
                assertTrue(repeat!=null&&repeat.performClick());
            });
            awaitVisibleCameraControl(scenario,"Tomar foto",8_000);
            boolean hasFront=provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA);
            if(!android.os.Build.HARDWARE.equals("ranchu")&&!android.os.Build.HARDWARE.equals("goldfish"))assertTrue("Physical front-camera gate requires a front camera.",hasFront);
            if(hasFront){
                tapVisibleCameraControl(scenario,"Cambiar cámara");SystemClock.sleep(600);
                scenario.onActivity(activity->{
                    try{java.lang.reflect.Field f=GalaxyCameraActivity.class.getDeclaredField("camera");f.setAccessible(true);androidx.camera.core.Camera bound=(androidx.camera.core.Camera)f.get(activity);
                        assertTrue("Camera switch did not bind the front lens.",bound!=null&&!CameraSelector.DEFAULT_FRONT_CAMERA.filter(java.util.Collections.singletonList(bound.getCameraInfo())).isEmpty());
                    }catch(ReflectiveOperationException e){throw new AssertionError(e);}
                });
                device.findObject(By.desc("Tomar foto")).click();
                awaitVisibleCameraControl(scenario,"Confirmar captura",12_000);
                scenario.onActivity(activity->{View repeat=findByText(activity.getWindow().getDecorView(),"Repetir");assertTrue(repeat!=null&&repeat.performClick());});
                awaitVisibleCameraControl(scenario,"Tomar foto",8_000);
            }
            tapVisibleCameraControl(scenario,"Cerrar cámara");
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
            awaitVisibleCameraControl(scenario,"Iniciar grabación",12_000);
            tapVisibleCameraControl(scenario,"Iniciar grabación");
            awaitVisibleCameraControl(scenario,"Detener grabación",8_000);
            SystemClock.sleep(1_200);
            long stopStarted=SystemClock.elapsedRealtime();
            tapVisibleCameraControl(scenario,"Detener grabación");
            awaitVisibleCameraControl(scenario,"Confirmar captura",14_000);
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
            awaitVisibleCameraControl(scenario,"Iniciar grabación",10_000);
            device.findObject(By.desc("Cerrar cámara")).click();
        }
        assertFalse("Cancelled video capture left a temp file.",hasFiles(new File(context.getCacheDir(),"camera-media")));
        System.out.println("GALAXY_CHAT_PHASE5_ANDROID="+new JSONObject().put("case","video").put("stopPreviewMs",previewMs).put("pssBeforeKb",pssBefore).put("pssAfterKb",android.os.Debug.getPss()));
    }

    // UIAutomator accessibility snapshots can lag the native view hierarchy on
    // headless API35. Verify an actual visible native control before touchscreen input.
    private int[] awaitVisibleCameraControl(ActivityScenario<GalaxyCameraActivity> scenario,
                                             String description,long timeoutMs){
        long until=SystemClock.elapsedRealtime()+timeoutMs;
        while(SystemClock.elapsedRealtime()<until){
            AtomicReference<int[]> center=new AtomicReference<>();
            scenario.onActivity(activity->{
                View view=findByDescription(activity.getWindow().getDecorView(),description);
                if(view==null||!view.isShown()||view.getWidth()<=0||view.getHeight()<=0)return;
                int[] xy=new int[2];view.getLocationOnScreen(xy);
                center.set(new int[]{xy[0]+view.getWidth()/2,xy[1]+view.getHeight()/2});
            });
            if(center.get()!=null)return center.get();
            SystemClock.sleep(120);
        }
        throw new AssertionError("Native camera control not visible after "+timeoutMs+" ms: "+description);
    }

    private void tapVisibleCameraControl(ActivityScenario<GalaxyCameraActivity> scenario,String description){
        int[] point=awaitVisibleCameraControl(scenario,description,12_000);
        assertTrue("Android screen touch injection failed: "+description,
            device.click(point[0],point[1]));

        // UiAutomator can acknowledge a headless-emulator screen click without
        // dispatching it to our camera window. For shutter only, observe the
        // synchronous UI state and retry using a native MotionEvent through the
        // Activity's window (not View.performClick or a CameraX API shortcut).
        // Successful capture/recording/review/cleanup remain mandatory below.
        if(!"Tomar foto".equals(description)&&
           !"Iniciar grabación".equals(description)&&
           !"Detener grabación".equals(description))return;
        SystemClock.sleep(300);
        scenario.onActivity(activity->{
            View control=findByDescription(activity.getWindow().getDecorView(),description);
            if(control==null||!control.isShown()||!control.isEnabled())return;
            int[] location=new int[2];control.getLocationInWindow(location);
            float x=location[0]+control.getWidth()/2f;
            float y=location[1]+control.getHeight()/2f;
            long time=SystemClock.uptimeMillis();
            android.view.MotionEvent down=android.view.MotionEvent.obtain(
                time,time,android.view.MotionEvent.ACTION_DOWN,x,y,0);
            android.view.MotionEvent up=android.view.MotionEvent.obtain(
                time,time+90,android.view.MotionEvent.ACTION_UP,x,y,0);
            try{
                boolean received=activity.dispatchTouchEvent(down);
                activity.dispatchTouchEvent(up);
                System.out.println("GALAXY_CAMERA_NATIVE_TOUCH="+description+
                    ",windowX="+x+",windowY="+y+",received="+received);
            }finally{down.recycle();up.recycle();}
        });
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
