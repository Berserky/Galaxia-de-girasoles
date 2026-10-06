package com.nuestragalaxia.companion;

import static org.junit.Assert.*;
import android.Manifest;
import android.content.Context;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class GalaxyVoiceMessagesDeviceTest {
    @Test public void realMicrophoneRecordsAacM4aAndReportsAmplitude() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),Manifest.permission.RECORD_AUDIO);
        File file=new File(context.getCacheDir(),"phase6-real-mic-"+System.currentTimeMillis()+".m4a");
        MediaRecorder recorder=Build.VERSION.SDK_INT>=31?new MediaRecorder(context):new MediaRecorder();
        try{
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioChannels(1);
            recorder.setAudioEncodingBitRate(64000);
            recorder.setAudioSamplingRate(32000);
            recorder.setOutputFile(file.getAbsolutePath());
            recorder.prepare();
            long started=SystemClock.elapsedRealtime();
            recorder.start();
            SystemClock.sleep(900);
            int amplitude=recorder.getMaxAmplitude();
            recorder.stop();
            long elapsed=SystemClock.elapsedRealtime()-started;
            assertTrue("real microphone duration",elapsed>=700);
            assertTrue("real microphone produced audio",file.exists()&&file.length()>512);
            assertTrue("amplitude API is available",amplitude>=0);
        }finally{
            try{recorder.release();}catch(Exception ignored){}
            if(file.exists())assertTrue("temporary recording deleted",file.delete());
        }
    }
}
