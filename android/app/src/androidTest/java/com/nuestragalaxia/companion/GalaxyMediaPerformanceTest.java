package com.nuestragalaxia.companion;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Debug;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.File;
import java.io.FileOutputStream;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class GalaxyMediaPerformanceTest {
    private final Context context=ApplicationProvider.getApplicationContext();

    @After public void cleanup(){
        deleteTree(new File(context.getCacheDir(),"chat-files/phase9-large-media"));
        deleteTree(new File(context.getCacheDir(),"chat-thumbnails"));
    }

    @Test public void large12MpAnd24Mp_thumbnailsStayBoundedAndRepeatedDecodeRecoversMemory() throws Exception {
        long pssBefore=Debug.getPss();
        Uri twelve=createJpeg("12mp.jpg",4000,3000);
        Uri twentyFour=createJpeg("24mp.jpg",6000,4000);
        verifyThumbnail(twelve,"image/jpeg");
        verifyThumbnail(twentyFour,"image/jpeg");
        for(int i=0;i<8;i++){
            File thumb=MediaThumbnailer.create(context,i%2==0?twelve:twentyFour,"image/jpeg");
            assertTrue(thumb.length()>0&&thumb.length()<=MediaThumbnailer.MAX_BYTES);
            assertTrue(thumb.delete()||!thumb.exists());
        }
        Runtime.getRuntime().gc();Thread.sleep(250);
        long pssAfter=Debug.getPss();
        assertTrue("Repeated thumbnail work retained too much memory: "+(pssAfter-pssBefore)+" KB",pssAfter-pssBefore<96*1024);
        System.out.println("GALAXY_CHAT_PHASE9_ANDROID="+new JSONObject()
            .put("case","large-images")
            .put("pssBeforeKb",pssBefore)
            .put("pssAfterKb",pssAfter)
            .put("maxThumbnailBytes",MediaThumbnailer.MAX_BYTES)
            .put("maxEdge",MediaThumbnailer.MAX_EDGE));
    }

    @Test public void thumbnailTempFiles_areDeletedByCallerContract() throws Exception {
        Uri image=createJpeg("cleanup.jpg",1600,1200);
        File thumb=MediaThumbnailer.create(context,image,"image/jpeg");
        assertTrue(thumb.exists());assertTrue(thumb.length()>0);
        assertTrue(thumb.delete()||!thumb.exists());
    }

    private void verifyThumbnail(Uri source,String mime) throws Exception {
        File thumb=MediaThumbnailer.create(context,source,mime);
        assertNotNull(thumb);assertTrue(thumb.exists());assertTrue(thumb.length()>0&&thumb.length()<=MediaThumbnailer.MAX_BYTES);
        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeFile(thumb.getAbsolutePath(),bounds);
        assertTrue(bounds.outWidth>0&&bounds.outHeight>0);
        assertTrue(Math.max(bounds.outWidth,bounds.outHeight)<=MediaThumbnailer.MAX_EDGE);
        assertTrue(thumb.delete()||!thumb.exists());
    }

    private Uri createJpeg(String name,int width,int height) throws Exception {
        File dir=new File(context.getCacheDir(),"chat-files/phase9-large-media");assertTrue(dir.exists()||dir.mkdirs());
        File file=new File(dir,name);
        Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.RGB_565);
        try(FileOutputStream out=new FileOutputStream(file)){assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG,88,out));}
        bitmap.recycle();
        return FileProvider.getUriForFile(context,context.getPackageName()+".files",file);
    }

    private static void deleteTree(File file){
        if(file==null||!file.exists())return;
        File[] children=file.listFiles();if(children!=null)for(File child:children)deleteTree(child);
        try{file.delete();}catch(Exception ignored){}
    }
}
