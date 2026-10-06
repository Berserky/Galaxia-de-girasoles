package com.nuestragalaxia.companion;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ImageDecoder;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.TextView;
import android.widget.VideoView;
import androidx.activity.OnBackPressedCallback;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.MeteringPoint;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.video.FileOutputOptions;
import androidx.camera.video.PendingRecording;
import androidx.camera.video.Recorder;
import androidx.camera.video.Recording;
import androidx.camera.video.VideoCapture;
import androidx.camera.video.VideoRecordEvent;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.fragment.app.FragmentActivity;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONObject;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

public final class GalaxyCameraActivity extends FragmentActivity {
    public static final String EXTRA_MODE="mode";
    public static final String EXTRA_MAX_DURATION="maxDurationSeconds";
    public static final String EXTRA_VIDEO_MESSAGE="videoMessage";
    public static final String EXTRA_FILE_PATH="filePath";
    public static final String EXTRA_CAPTION="caption";
    public static final String EXTRA_DURATION_MS="durationMs";
    public static final String EXTRA_WIDTH="width";
    public static final String EXTRA_HEIGHT="height";
    public static final String EXTRA_MIME="mime";

    private FrameLayout root;
    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private Camera camera;
    private ImageCapture imageCapture;
    private VideoCapture<Recorder> videoCapture;
    private Recording activeRecording;
    private File capturedFile;
    private boolean confirmed=false;
    private boolean reviewing=false;
    private boolean recording=false;
    private boolean torch=false;
    private int lensFacing=CameraSelector.LENS_FACING_BACK;
    private String mode="photo";
    private int maxDurationSeconds=120;
    private boolean videoMessage=false;
    private long capturedDurationMs=0L;
    private long recordingStartedAt=0L;
    private TextView timer;
    private TextView flashButton;
    private TextView switchButton;
    private TextView shutterButton;
    private TextView modeLabel;
    private TextView statusLabel;
    private EditText reviewCaptionInput;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        mode="video".equals(getIntent().getStringExtra(EXTRA_MODE))?"video":"photo";
        maxDurationSeconds=Math.max(1,Math.min(120,getIntent().getIntExtra(EXTRA_MAX_DURATION,120)));
        videoMessage=getIntent().getBooleanExtra(EXTRA_VIDEO_MESSAGE,false);
        if(savedInstanceState!=null){
            lensFacing=savedInstanceState.getInt("camera.lens",CameraSelector.LENS_FACING_BACK);
            capturedDurationMs=savedInstanceState.getLong("camera.durationMs",0L);
            String path=savedInstanceState.getString("camera.capturePath","");
            if(!path.isBlank()){
                File restored=new File(path);
                if(restored.exists()&&restored.getParentFile()!=null&&"camera-media".equals(restored.getParentFile().getName()))capturedFile=restored;
            }
            reviewing=savedInstanceState.getBoolean("camera.reviewing",false)&&capturedFile!=null;
        }
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        buildCameraUi();
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
            @Override public void handleOnBackPressed(){
                if(reviewing){retake();return;}
                cancelAndFinish();
            }
        });
        if(reviewing)showReview(savedInstanceState==null?"":savedInstanceState.getString("camera.caption",""));
        else startCamera();
    }

    private void buildCameraUi(){
        root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);
        previewView=new PreviewView(this);
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        root.addView(previewView,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.HORIZONTAL);top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(12),dp(12),dp(12),dp(8));
        TextView close=control("✕","Cerrar cámara");close.setOnClickListener(v->cancelAndFinish());
        top.addView(close,new LinearLayout.LayoutParams(dp(52),dp(52)));
        statusLabel=new TextView(this);statusLabel.setTextColor(Color.WHITE);statusLabel.setTextSize(13);statusLabel.setGravity(Gravity.CENTER);statusLabel.setText(mode.equals("video")?"VIDEO":"FOTO");
        LinearLayout.LayoutParams statusParams=new LinearLayout.LayoutParams(0,dp(52),1);top.addView(statusLabel,statusParams);
        flashButton=control("⚡","Activar flash");flashButton.setOnClickListener(v->toggleTorch());
        top.addView(flashButton,new LinearLayout.LayoutParams(dp(52),dp(52)));
        FrameLayout.LayoutParams topParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(76),Gravity.TOP);
        root.addView(top,topParams);

        timer=new TextView(this);timer.setTextColor(Color.WHITE);timer.setTextSize(14);timer.setGravity(Gravity.CENTER);timer.setText("00:00");timer.setVisibility(View.GONE);
        FrameLayout.LayoutParams timerParams=new FrameLayout.LayoutParams(dp(92),dp(40),Gravity.TOP|Gravity.CENTER_HORIZONTAL);timerParams.topMargin=dp(76);root.addView(timer,timerParams);

        LinearLayout bottom=new LinearLayout(this);bottom.setOrientation(LinearLayout.HORIZONTAL);bottom.setGravity(Gravity.CENTER);bottom.setPadding(dp(18),dp(10),dp(18),dp(18));
        switchButton=control("↺","Cambiar cámara");switchButton.setOnClickListener(v->switchCamera());
        bottom.addView(switchButton,new LinearLayout.LayoutParams(dp(64),dp(64)));
        shutterButton=control(mode.equals("video")?"●":"◉",mode.equals("video")?"Iniciar grabación":"Tomar foto");
        shutterButton.setTextSize(mode.equals("video")?29:34);shutterButton.setOnClickListener(v->onShutter());
        LinearLayout.LayoutParams shutterParams=new LinearLayout.LayoutParams(dp(88),dp(88));shutterParams.setMargins(dp(34),0,dp(34),0);bottom.addView(shutterButton,shutterParams);
        modeLabel=control(mode.equals("video")?"2 min":"Foto","Modo actual");modeLabel.setTextSize(12);modeLabel.setClickable(false);
        bottom.addView(modeLabel,new LinearLayout.LayoutParams(dp(64),dp(64)));
        FrameLayout.LayoutParams bottomParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(122),Gravity.BOTTOM);root.addView(bottom,bottomParams);

        previewView.setOnTouchListener((v,event)->{
            if(event.getAction()==MotionEvent.ACTION_UP&&camera!=null&&!reviewing){
                MeteringPoint point=previewView.getMeteringPointFactory().createPoint(event.getX(),event.getY());
                FocusMeteringAction action=new FocusMeteringAction.Builder(point).setAutoCancelDuration(3,TimeUnit.SECONDS).build();
                camera.getCameraControl().startFocusAndMetering(action);
                return true;
            }
            return true;
        });
        setContentView(root);
    }

    private TextView control(String text,String description){
        TextView view=new TextView(this);view.setText(text);view.setTextColor(Color.WHITE);view.setTextSize(20);view.setGravity(Gravity.CENTER);
        view.setContentDescription(description);view.setBackgroundColor(0x55000000);view.setPadding(dp(4),dp(4),dp(4),dp(4));view.setClickable(true);view.setFocusable(true);
        return view;
    }

    private void startCamera(){
        if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){
            setResult(Activity.RESULT_CANCELED,new Intent().putExtra("error","PERMISSION_CAMERA"));finish();return;
        }
        ListenableFuture<ProcessCameraProvider> future=ProcessCameraProvider.getInstance(this);
        future.addListener(()->{
            try{cameraProvider=future.get();bindCamera();}
            catch(Exception e){finishWithError("No pudimos iniciar la cámara.");}
        },ContextCompat.getMainExecutor(this));
    }

    private void bindCamera(){
        if(cameraProvider==null||reviewing)return;
        cameraProvider.unbindAll();
        CameraSelector selector=new CameraSelector.Builder().requireLensFacing(lensFacing).build();
        Preview preview=new Preview.Builder().build();
        imageCapture=new ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build();
        Recorder recorder=new Recorder.Builder().build();
        videoCapture=VideoCapture.withOutput(recorder);
        preview.setSurfaceProvider(previewView.getSurfaceProvider());
        try{
            if(mode.equals("video"))camera=cameraProvider.bindToLifecycle(this,selector,preview,videoCapture);
            else camera=cameraProvider.bindToLifecycle(this,selector,preview,imageCapture);
            updateFlashAvailability();
        }catch(Exception e){finishWithError("Esta cámara no está disponible.");}
    }

    private void onShutter(){
        if(reviewing)return;
        if(mode.equals("video")){
            if(recording)stopVideo();else startVideo();
        }else capturePhoto();
    }

    private File newCaptureFile(String suffix) throws IOException {
        File dir=new File(getCacheDir(),"camera-media");
        if(!dir.exists()&&!dir.mkdirs())throw new IOException("No se pudo preparar la captura.");
        return File.createTempFile(mode.equals("video")?"galaxy-camerax-video-":"galaxy-camerax-photo-",suffix,dir);
    }

    private void capturePhoto(){
        if(imageCapture==null)return;
        shutterButton.setEnabled(false);statusLabel.setText("CAPTURANDO…");
        try{
            capturedFile=newCaptureFile(".jpg");
            ImageCapture.Metadata metadata=new ImageCapture.Metadata();
            metadata.setReversedHorizontal(lensFacing==CameraSelector.LENS_FACING_FRONT);
            ImageCapture.OutputFileOptions options=new ImageCapture.OutputFileOptions.Builder(capturedFile).setMetadata(metadata).build();
            imageCapture.takePicture(options,ContextCompat.getMainExecutor(this),new ImageCapture.OnImageSavedCallback(){
                @Override public void onImageSaved(ImageCapture.OutputFileResults output){
                    shutterButton.setEnabled(true);showReview("");
                }
                @Override public void onError(ImageCaptureException error){
                    shutterButton.setEnabled(true);deleteCaptured();statusLabel.setText("FOTO");toastStatus("No pudimos tomar la foto.");
                }
            });
        }catch(Exception e){shutterButton.setEnabled(true);deleteCaptured();toastStatus("No pudimos preparar la foto.");}
    }

    private void startVideo(){
        if(videoCapture==null)return;
        try{
            capturedFile=newCaptureFile(".mp4");
            FileOutputOptions options=new FileOutputOptions.Builder(capturedFile).build();
            PendingRecording pending=videoCapture.getOutput().prepareRecording(this,options);
            if(ContextCompat.checkSelfPermission(this,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)pending=pending.withAudioEnabled();
            recording=true;recordingStartedAt=SystemClock.elapsedRealtime();timer.setVisibility(View.VISIBLE);statusLabel.setText("GRABANDO");shutterButton.setText("■");shutterButton.setContentDescription("Detener grabación");
            activeRecording=pending.start(ContextCompat.getMainExecutor(this),event->{
                if(event instanceof VideoRecordEvent.Status status){
                    long elapsed=status.getRecordingStats().getRecordedDurationNanos()/1_000_000L;
                    capturedDurationMs=elapsed;timer.setText(formatDuration(elapsed));
                    if(elapsed>=maxDurationSeconds*1000L&&activeRecording!=null)activeRecording.stop();
                }else if(event instanceof VideoRecordEvent.Finalize done){
                    recording=false;activeRecording=null;capturedDurationMs=Math.max(capturedDurationMs,done.getRecordingStats().getRecordedDurationNanos()/1_000_000L);
                    timer.setVisibility(View.GONE);shutterButton.setText("●");shutterButton.setContentDescription("Iniciar grabación");
                    if(done.hasError()||capturedFile==null||capturedFile.length()<1){deleteCaptured();statusLabel.setText("VIDEO");toastStatus("No pudimos guardar el video.");}
                    else showReview("");
                }
            });
        }catch(Exception e){recording=false;deleteCaptured();toastStatus("No pudimos iniciar la grabación.");}
    }

    private void stopVideo(){
        if(activeRecording!=null)activeRecording.stop();
    }

    private void showReview(String restoredCaption){
        if(capturedFile==null||!capturedFile.exists())return;
        reviewing=true;recording=false;if(cameraProvider!=null)cameraProvider.unbindAll();
        root.removeAllViews();
        root.setBackgroundColor(Color.BLACK);
        Uri uri=FileProvider.getUriForFile(this,getPackageName()+".files",capturedFile);
        if(mode.equals("video")){
            VideoView video=new VideoView(this);video.setVideoURI(uri);video.setMediaController(new MediaController(this));video.setContentDescription("Vista previa del video");
            video.setOnPreparedListener(mp->{mp.setLooping(true);video.start();});
            root.addView(video,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        }else{
            ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription("Vista previa de la foto");
            Bitmap bitmap=decodeScaled(uri,capturedFile,2048);if(bitmap!=null)image.setImageBitmap(bitmap);else image.setImageURI(uri);
            root.addView(image,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        }

        LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.HORIZONTAL);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(12),dp(12),dp(12),dp(8));
        TextView close=control("✕","Cancelar captura");close.setOnClickListener(v->cancelAndFinish());top.addView(close,new LinearLayout.LayoutParams(dp(52),dp(52)));
        TextView title=new TextView(this);title.setTextColor(Color.WHITE);title.setTextSize(14);title.setGravity(Gravity.CENTER);title.setText(mode.equals("video")?"REVISAR VIDEO":"REVISAR FOTO");top.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));
        TextView retake=control("↺","Repetir captura");retake.setOnClickListener(v->retake());top.addView(retake,new LinearLayout.LayoutParams(dp(52),dp(52)));
        root.addView(top,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(76),Gravity.TOP));

        LinearLayout bottom=new LinearLayout(this);bottom.setOrientation(LinearLayout.VERTICAL);bottom.setPadding(dp(16),dp(10),dp(16),dp(18));bottom.setBackgroundColor(0xAA000000);
        EditText caption=new EditText(this);reviewCaptionInput=caption;caption.setHint("Añadir comentario…");caption.setHintTextColor(0xFFB8B5C6);caption.setTextColor(Color.WHITE);caption.setTextSize(16);caption.setMaxLines(3);caption.setSingleLine(false);caption.setContentDescription("Comentario opcional");caption.setText(restoredCaption==null?"":restoredCaption);
        bottom.addView(caption,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));
        LinearLayout actions=new LinearLayout(this);actions.setGravity(Gravity.CENTER_VERTICAL);
        TextView repeat=control("Repetir","Repetir captura");repeat.setTextSize(14);repeat.setOnClickListener(v->retake());actions.addView(repeat,new LinearLayout.LayoutParams(0,dp(54),1));
        TextView send=control("Usar","Confirmar captura");send.setTextSize(14);send.setOnClickListener(v->confirmCapture(caption.getText().toString()));LinearLayout.LayoutParams sendParams=new LinearLayout.LayoutParams(0,dp(54),1);sendParams.setMargins(dp(10),0,0,0);actions.addView(send,sendParams);
        bottom.addView(actions,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));
        FrameLayout.LayoutParams bottomParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(150),Gravity.BOTTOM);root.addView(bottom,bottomParams);
    }

    private void confirmCapture(String caption){
        if(capturedFile==null||!capturedFile.exists())return;
        try{
            Uri uri=FileProvider.getUriForFile(this,getPackageName()+".files",capturedFile);
            JSONObject meta=MediaInspector.inspect(this,uri);
            Intent result=new Intent()
                .putExtra(EXTRA_FILE_PATH,capturedFile.getAbsolutePath())
                .putExtra(EXTRA_CAPTION,caption==null?"":caption.trim())
                .putExtra(EXTRA_DURATION_MS,Math.max(capturedDurationMs,meta.optLong("durationMs",0L)))
                .putExtra(EXTRA_WIDTH,meta.optLong("width",0L))
                .putExtra(EXTRA_HEIGHT,meta.optLong("height",0L))
                .putExtra(EXTRA_MIME,meta.optString("mime",mode.equals("video")?"video/mp4":"image/jpeg"))
                .putExtra(EXTRA_VIDEO_MESSAGE,videoMessage);
            confirmed=true;setResult(Activity.RESULT_OK,result);finish();
        }catch(Exception e){toastStatus("No pudimos validar la captura.");}
    }

    private void retake(){
        reviewing=false;reviewCaptionInput=null;capturedDurationMs=0L;deleteCaptured();buildCameraUi();bindCamera();
    }

    private void toggleTorch(){
        if(camera==null||!camera.getCameraInfo().hasFlashUnit())return;
        torch=!torch;camera.getCameraControl().enableTorch(torch);flashButton.setText(torch?"⚡✓":"⚡");flashButton.setContentDescription(torch?"Desactivar flash":"Activar flash");
    }

    private void updateFlashAvailability(){
        boolean available=camera!=null&&camera.getCameraInfo().hasFlashUnit();
        flashButton.setEnabled(available);flashButton.setAlpha(available?1f:.4f);
        if(!available)torch=false;
    }

    private void switchCamera(){
        if(cameraProvider==null||recording||reviewing)return;
        int target=lensFacing==CameraSelector.LENS_FACING_BACK?CameraSelector.LENS_FACING_FRONT:CameraSelector.LENS_FACING_BACK;
        try{
            CameraSelector selector=new CameraSelector.Builder().requireLensFacing(target).build();
            if(!cameraProvider.hasCamera(selector)){toastStatus("Esta cámara no está disponible.");return;}
            if(torch&&camera!=null)camera.getCameraControl().enableTorch(false);
            torch=false;lensFacing=target;bindCamera();
        }catch(Exception e){toastStatus("No pudimos cambiar de cámara.");}
    }

    private void cancelAndFinish(){
        if(activeRecording!=null){activeRecording.stop();activeRecording=null;}
        deleteCaptured();setResult(Activity.RESULT_CANCELED);finish();
    }

    private void finishWithError(String message){
        deleteCaptured();setResult(Activity.RESULT_CANCELED,new Intent().putExtra("error",message));finish();
    }

    private void deleteCaptured(){if(capturedFile!=null)try{capturedFile.delete();}catch(Exception ignored){}capturedFile=null;}

    private void toastStatus(String text){statusLabel.setText(text);statusLabel.postDelayed(()->{if(!isFinishing()&&!reviewing)statusLabel.setText(mode.equals("video")?"VIDEO":"FOTO");},1800);}

    private static String formatDuration(long ms){long total=Math.max(0,ms/1000),m=total/60,s=total%60;return String.format(java.util.Locale.ROOT,"%02d:%02d",m,s);}

    private Bitmap decodeScaled(Uri uri,File file,int max){
        try{
            if(android.os.Build.VERSION.SDK_INT>=28){
                ImageDecoder.Source source=ImageDecoder.createSource(getContentResolver(),uri);
                return ImageDecoder.decodeBitmap(source,(decoder,info,src)->{
                    int w=info.getSize().getWidth(),h=info.getSize().getHeight();
                    if(w>max||h>max){
                        double scale=Math.min((double)max/Math.max(1,w),(double)max/Math.max(1,h));
                        decoder.setTargetSize(Math.max(1,(int)Math.round(w*scale)),Math.max(1,(int)Math.round(h*scale)));
                    }
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                });
            }
            BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getAbsolutePath(),bounds);
            int sample=1;while(bounds.outWidth/sample>max||bounds.outHeight/sample>max)sample*=2;
            BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=Math.max(1,sample);return BitmapFactory.decodeFile(file.getAbsolutePath(),options);
        }catch(Exception e){return null;}
    }

    @Override protected void onStop(){
        super.onStop();
        if(recording&&!isChangingConfigurations()&&activeRecording!=null)activeRecording.stop();
    }

    @Override protected void onSaveInstanceState(Bundle outState){
        super.onSaveInstanceState(outState);
        outState.putInt("camera.lens",lensFacing);
        outState.putLong("camera.durationMs",capturedDurationMs);
        outState.putBoolean("camera.reviewing",reviewing&&capturedFile!=null);
        if(capturedFile!=null)outState.putString("camera.capturePath",capturedFile.getAbsolutePath());
        if(reviewCaptionInput!=null)outState.putString("camera.caption",reviewCaptionInput.getText().toString());
    }

    @Override protected void onDestroy(){
        if(cameraProvider!=null)cameraProvider.unbindAll();
        if(!confirmed&&!isChangingConfigurations())deleteCaptured();
        super.onDestroy();
    }

    @Override public void onConfigurationChanged(Configuration newConfig){
        super.onConfigurationChanged(newConfig);
        if(!reviewing&&previewView!=null&&previewView.getDisplay()!=null){
            int rotation=previewView.getDisplay().getRotation();
            if(imageCapture!=null)imageCapture.setTargetRotation(rotation);
            if(videoCapture!=null)videoCapture.setTargetRotation(rotation);
        }
    }

    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
