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
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.FrameLayout;
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
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.FragmentActivity;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONObject;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.*;

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

    private static final int CHROME=0xA612121A;
    private static final int CONTROL=0x18FFFFFF;
    private static final int VIDEO_RED=0xFFE74755;

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
    private boolean cancelling=false;
    private int lensFacing=CameraSelector.LENS_FACING_BACK;
    private String mode="photo";
    private int maxDurationSeconds=120;
    private boolean videoMessage=false;
    private long capturedDurationMs=0L;
    private TextView timer;
    private TextView flashButton;
    private TextView switchButton;
    private TextView shutterButton;
    private TextView modeLabel;
    private TextView statusLabel;
    private EditText reviewCaptionInput;
    private final ExecutorService mediaIo=Executors.newSingleThreadExecutor();
    private VideoView reviewVideo;
    private Bitmap reviewBitmap;
    private int reviewGeneration=0;
    private boolean confirming=false;

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
        top.setPadding(dp(6),dp(4),dp(6),dp(4));top.setBackground(roundRect(CHROME,24,0,0));top.setElevation(dp(8));
        TextView close=iconControl("×","Cerrar cámara");close.setTextSize(30);close.setOnClickListener(v->cancelAndFinish());
        top.addView(close,new LinearLayout.LayoutParams(dp(56),dp(56)));
        LinearLayout center=new LinearLayout(this);center.setOrientation(LinearLayout.VERTICAL);center.setGravity(Gravity.CENTER);
        statusLabel=label(mode.equals("video")?"VIDEO":"FOTO",13,true);center.addView(statusLabel,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(26)));
        timer=label("00:00",13,false);timer.setVisibility(View.GONE);center.addView(timer,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(22)));
        top.addView(center,new LinearLayout.LayoutParams(0,dp(56),1));
        flashButton=iconControl("⚡","Activar flash");flashButton.setOnClickListener(v->toggleTorch());
        top.addView(flashButton,new LinearLayout.LayoutParams(dp(56),dp(56)));
        FrameLayout.LayoutParams topParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(64),Gravity.TOP);
        topParams.leftMargin=dp(14);topParams.rightMargin=dp(14);root.addView(top,topParams);

        LinearLayout bottom=new LinearLayout(this);bottom.setOrientation(LinearLayout.HORIZONTAL);bottom.setGravity(Gravity.CENTER_VERTICAL);
        bottom.setPadding(dp(10),dp(8),dp(10),dp(8));bottom.setBackground(roundRect(CHROME,30,0,0));bottom.setElevation(dp(8));
        switchButton=iconControl("↻","Cambiar cámara");switchButton.setTextSize(26);switchButton.setOnClickListener(v->switchCamera());
        bottom.addView(switchButton,new LinearLayout.LayoutParams(0,dp(72),1));
        shutterButton=new TextView(this);shutterButton.setGravity(Gravity.CENTER);shutterButton.setTextSize(mode.equals("video")?28:1);
        shutterButton.setTextColor(Color.WHITE);shutterButton.setClickable(true);shutterButton.setFocusable(true);
        shutterButton.setContentDescription(mode.equals("video")?"Iniciar grabación":"Tomar foto");shutterButton.setOnClickListener(v->onShutter());
        applyShutterStyle(false);
        LinearLayout.LayoutParams shutterParams=new LinearLayout.LayoutParams(dp(84),dp(84));shutterParams.setMargins(dp(12),0,dp(12),0);bottom.addView(shutterButton,shutterParams);
        modeLabel=label(mode.equals("video")?maxLabel():"Foto",12,false);modeLabel.setContentDescription("Modo actual");
        bottom.addView(modeLabel,new LinearLayout.LayoutParams(0,dp(72),1));
        FrameLayout.LayoutParams bottomParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(100),Gravity.BOTTOM);
        bottomParams.leftMargin=dp(14);bottomParams.rightMargin=dp(14);root.addView(bottom,bottomParams);
        applySafeInsets(top,topParams,bottom,bottomParams);

        previewView.setOnTouchListener((v,event)->{
            if(event.getAction()==MotionEvent.ACTION_UP&&camera!=null&&!reviewing&&!recording){
                MeteringPoint point=previewView.getMeteringPointFactory().createPoint(event.getX(),event.getY());
                FocusMeteringAction action=new FocusMeteringAction.Builder(point).setAutoCancelDuration(3,TimeUnit.SECONDS).build();
                camera.getCameraControl().startFocusAndMetering(action);return true;
            }
            return true;
        });
        setContentView(root);
    }

    private void applySafeInsets(View top,FrameLayout.LayoutParams topParams,View bottom,FrameLayout.LayoutParams bottomParams){
        ViewCompat.setOnApplyWindowInsetsListener(root,(view,insets)->{
            Insets status=insets.getInsets(WindowInsetsCompat.Type.statusBars());
            Insets navigation=insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            topParams.topMargin=status.top+dp(10);top.setLayoutParams(topParams);
            bottomParams.bottomMargin=Math.max(navigation.bottom,dp(4))+dp(8);bottom.setLayoutParams(bottomParams);
            return insets;
        });
        ViewCompat.requestApplyInsets(root);
    }

    private TextView iconControl(String text,String description){
        TextView view=label(text,22,false);view.setContentDescription(description);view.setClickable(true);view.setFocusable(true);
        view.setMinWidth(dp(48));view.setMinHeight(dp(48));return view;
    }

    private TextView label(String text,int size,boolean strong){
        TextView view=new TextView(this);view.setText(text);view.setTextColor(Color.WHITE);view.setTextSize(size);view.setGravity(Gravity.CENTER);
        if(strong)view.setTypeface(view.getTypeface(),android.graphics.Typeface.BOLD);return view;
    }

    private GradientDrawable roundRect(int color,int radiusDp,int strokeDp,int strokeColor){
        GradientDrawable shape=new GradientDrawable();shape.setShape(GradientDrawable.RECTANGLE);shape.setColor(color);shape.setCornerRadius(dp(radiusDp));
        if(strokeDp>0)shape.setStroke(dp(strokeDp),strokeColor);return shape;
    }
    private GradientDrawable circle(int color,int strokeDp,int strokeColor){
        GradientDrawable shape=new GradientDrawable();shape.setShape(GradientDrawable.OVAL);shape.setColor(color);
        if(strokeDp>0)shape.setStroke(dp(strokeDp),strokeColor);return shape;
    }

    private void applyShutterStyle(boolean active){
        if(shutterButton==null)return;
        if("video".equals(mode)){
            shutterButton.setText(active?"■":"●");shutterButton.setTextColor(active?Color.WHITE:VIDEO_RED);
            shutterButton.setBackground(circle(active?VIDEO_RED:CONTROL,active?4:3,active?Color.WHITE:VIDEO_RED));
        }else{
            shutterButton.setText("");shutterButton.setBackground(circle(Color.WHITE,4,0xAAFFFFFF));
        }
    }
    private String maxLabel(){return maxDurationSeconds>=60&&maxDurationSeconds%60==0?"máx. "+(maxDurationSeconds/60)+" min":"máx. "+maxDurationSeconds+" s";}

    private void setRecordingUi(boolean active){
        recording=active;if(shutterButton==null)return;
        shutterButton.setEnabled(true);applyShutterStyle(active);shutterButton.setContentDescription(active?"Detener grabación":"Iniciar grabación");
        if(statusLabel!=null)statusLabel.setText(active?"● REC":"VIDEO");
        if(timer!=null){timer.setVisibility(active?View.VISIBLE:View.GONE);if(!active)timer.setText("00:00");}
        if(switchButton!=null){switchButton.setEnabled(!active);switchButton.setAlpha(active?.35f:1f);}
        if(modeLabel!=null){modeLabel.setText(maxLabel());modeLabel.setAlpha(active?.72f:1f);}
        if(active&&flashButton!=null){flashButton.setEnabled(false);flashButton.setAlpha(.35f);}else updateFlashAvailability();
    }

    private void startCamera(){
        if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){
            setResult(Activity.RESULT_CANCELED,new Intent().putExtra("error","PERMISSION_CAMERA"));finish();return;
        }
        ListenableFuture<ProcessCameraProvider> future=ProcessCameraProvider.getInstance(this);
        future.addListener(()->{try{cameraProvider=future.get();bindCamera();}catch(Exception e){finishWithError("No pudimos iniciar la cámara.");}},ContextCompat.getMainExecutor(this));
    }

    private void bindCamera(){
        if(cameraProvider==null||reviewing)return;
        cameraProvider.unbindAll();CameraSelector selector=new CameraSelector.Builder().requireLensFacing(lensFacing).build();
        Preview preview=new Preview.Builder().build();imageCapture=new ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build();
        Recorder recorder=new Recorder.Builder().build();videoCapture=VideoCapture.withOutput(recorder);preview.setSurfaceProvider(previewView.getSurfaceProvider());
        if(previewView.getDisplay()!=null){int rotation=previewView.getDisplay().getRotation();imageCapture.setTargetRotation(rotation);videoCapture.setTargetRotation(rotation);}
        try{
            if(mode.equals("video"))camera=cameraProvider.bindToLifecycle(this,selector,preview,videoCapture);
            else camera=cameraProvider.bindToLifecycle(this,selector,preview,imageCapture);
            updateFlashAvailability();
        }catch(Exception e){finishWithError("Esta cámara no está disponible.");}
    }

    private void onShutter(){if(reviewing||cancelling)return;if(mode.equals("video")){if(recording)stopVideo();else startVideo();}else capturePhoto();}

    private File newCaptureFile(String suffix) throws IOException {
        File dir=new File(getCacheDir(),"camera-media");if(!dir.exists()&&!dir.mkdirs())throw new IOException("No se pudo preparar la captura.");
        return File.createTempFile(mode.equals("video")?"galaxy-camerax-video-":"galaxy-camerax-photo-",suffix,dir);
    }

    private void capturePhoto(){
        if(imageCapture==null)return;shutterButton.setEnabled(false);statusLabel.setText("CAPTURANDO…");
        try{
            capturedFile=newCaptureFile(".jpg");ImageCapture.Metadata metadata=new ImageCapture.Metadata();metadata.setReversedHorizontal(lensFacing==CameraSelector.LENS_FACING_FRONT);
            ImageCapture.OutputFileOptions options=new ImageCapture.OutputFileOptions.Builder(capturedFile).setMetadata(metadata).build();
            imageCapture.takePicture(options,ContextCompat.getMainExecutor(this),new ImageCapture.OnImageSavedCallback(){
                @Override public void onImageSaved(ImageCapture.OutputFileResults output){shutterButton.setEnabled(true);showReview("");}
                @Override public void onError(ImageCaptureException error){shutterButton.setEnabled(true);deleteCaptured();statusLabel.setText("FOTO");toastStatus("No pudimos tomar la foto.");}
            });
        }catch(Exception e){shutterButton.setEnabled(true);deleteCaptured();toastStatus("No pudimos preparar la foto.");}
    }

    private void startVideo(){
        if(videoCapture==null||recording)return;
        try{
            capturedFile=newCaptureFile(".mp4");FileOutputOptions options=new FileOutputOptions.Builder(capturedFile).build();
            PendingRecording pending=videoCapture.getOutput().prepareRecording(this,options);
            if(ContextCompat.checkSelfPermission(this,Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)pending=pending.withAudioEnabled();
            capturedDurationMs=0L;setRecordingUi(true);
            activeRecording=pending.start(ContextCompat.getMainExecutor(this),event->{
                if(event instanceof VideoRecordEvent.Status status){
                    long elapsed=status.getRecordingStats().getRecordedDurationNanos()/1_000_000L;capturedDurationMs=elapsed;if(timer!=null)timer.setText(formatDuration(elapsed));
                    if(elapsed>=maxDurationSeconds*1000L&&activeRecording!=null)stopVideo();
                }else if(event instanceof VideoRecordEvent.Finalize done){
                    activeRecording=null;capturedDurationMs=Math.max(capturedDurationMs,done.getRecordingStats().getRecordedDurationNanos()/1_000_000L);
                    if(cancelling){recording=false;deleteCaptured();return;}
                    setRecordingUi(false);
                    if(done.hasError()||capturedFile==null||capturedFile.length()<1){deleteCaptured();toastStatus("No pudimos guardar el video.");}
                    else showReview("");
                }
            });
        }catch(Exception e){activeRecording=null;setRecordingUi(false);deleteCaptured();toastStatus("No pudimos iniciar la grabación.");}
    }

    private void stopVideo(){if(activeRecording==null)return;shutterButton.setEnabled(false);statusLabel.setText("GUARDANDO…");activeRecording.stop();}

    private void showReview(String restoredCaption){
        if(capturedFile==null||!capturedFile.exists()||cancelling)return;
        reviewing=true;recording=false;if(cameraProvider!=null)cameraProvider.unbindAll();releaseReviewMedia();root.removeAllViews();root.setBackgroundColor(Color.BLACK);
        Uri uri=FileProvider.getUriForFile(this,getPackageName()+".files",capturedFile);
        if(mode.equals("video")){
            VideoView video=new VideoView(this);reviewVideo=video;video.setVideoURI(uri);video.setMediaController(new MediaController(this));video.setContentDescription("Vista previa del video");
            video.setOnPreparedListener(mp->{if(reviewVideo==video&&!isFinishing()){mp.setLooping(true);video.start();}});
            root.addView(video,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        }else{
            ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription("Vista previa de la foto");
            root.addView(image,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
            int generation=reviewGeneration;File expectedFile=capturedFile;
            mediaIo.execute(()->{Bitmap bitmap=decodeScaled(uri,expectedFile,2048);runOnUiThread(()->{
                if(bitmap==null){if(generation==reviewGeneration&&!isFinishing())toastStatus("No pudimos preparar la vista previa.");return;}
                if(isFinishing()||generation!=reviewGeneration||capturedFile!=expectedFile){bitmap.recycle();return;}reviewBitmap=bitmap;image.setImageBitmap(bitmap);
            });});
        }

        LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.HORIZONTAL);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(6),dp(4),dp(6),dp(4));
        top.setBackground(roundRect(CHROME,24,0,0));top.setElevation(dp(8));
        TextView close=iconControl("×","Cancelar captura");close.setTextSize(30);close.setOnClickListener(v->cancelAndFinish());top.addView(close,new LinearLayout.LayoutParams(dp(56),dp(56)));
        TextView title=label(mode.equals("video")?"REVISAR VIDEO":"REVISAR FOTO",13,true);top.addView(title,new LinearLayout.LayoutParams(0,dp(56),1));
        top.addView(label("",1,false),new LinearLayout.LayoutParams(dp(56),dp(56)));
        FrameLayout.LayoutParams topParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(64),Gravity.TOP);topParams.leftMargin=dp(14);topParams.rightMargin=dp(14);root.addView(top,topParams);

        LinearLayout bottom=new LinearLayout(this);bottom.setOrientation(LinearLayout.VERTICAL);bottom.setPadding(dp(12),dp(10),dp(12),dp(10));bottom.setBackground(roundRect(CHROME,26,0,0));bottom.setElevation(dp(8));
        EditText caption=new EditText(this);reviewCaptionInput=caption;caption.setHint("Añadir comentario…");caption.setHintTextColor(0xFFB8B5C6);caption.setTextColor(Color.WHITE);caption.setTextSize(15);
        caption.setMaxLines(3);caption.setSingleLine(false);caption.setContentDescription("Comentario opcional");caption.setText(restoredCaption==null?"":restoredCaption);caption.setPadding(dp(14),0,dp(14),0);
        caption.setBackground(roundRect(0x661F1F2A,18,1,0x22FFFFFF));bottom.addView(caption,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(52)));
        LinearLayout actions=new LinearLayout(this);actions.setGravity(Gravity.CENTER_VERTICAL);
        TextView repeat=actionButton("Repetir","Repetir captura",false);repeat.setOnClickListener(v->retake());actions.addView(repeat,new LinearLayout.LayoutParams(0,dp(52),1));
        TextView send=actionButton("Usar","Confirmar captura",true);send.setOnClickListener(v->confirmCapture(caption.getText().toString()));
        LinearLayout.LayoutParams sendParams=new LinearLayout.LayoutParams(0,dp(52),1);sendParams.setMargins(dp(10),0,0,0);actions.addView(send,sendParams);
        LinearLayout.LayoutParams actionParams=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60));actionParams.topMargin=dp(8);bottom.addView(actions,actionParams);
        FrameLayout.LayoutParams bottomParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(140),Gravity.BOTTOM);bottomParams.leftMargin=dp(14);bottomParams.rightMargin=dp(14);root.addView(bottom,bottomParams);
        applySafeInsets(top,topParams,bottom,bottomParams);
    }

    private TextView actionButton(String text,String description,boolean primary){
        TextView view=label(text,14,true);view.setContentDescription(description);view.setClickable(true);view.setFocusable(true);view.setMinHeight(dp(48));
        view.setBackground(roundRect(primary?0xFFF0ECFF:CONTROL,18,primary?0:1,0x30FFFFFF));if(primary)view.setTextColor(0xFF221742);return view;
    }

    private void confirmCapture(String caption){
        if(confirming||capturedFile==null||!capturedFile.exists())return;
        confirming=true;File expectedFile=capturedFile;long expectedDuration=capturedDurationMs;Uri uri=FileProvider.getUriForFile(this,getPackageName()+".files",expectedFile);
        mediaIo.execute(()->{try{
            JSONObject meta=MediaInspector.inspect(this,uri);
            Intent result=new Intent().putExtra(EXTRA_FILE_PATH,expectedFile.getAbsolutePath()).putExtra(EXTRA_CAPTION,caption==null?"":caption.trim())
                .putExtra(EXTRA_DURATION_MS,Math.max(expectedDuration,meta.optLong("durationMs",0L))).putExtra(EXTRA_WIDTH,meta.optLong("width",0L)).putExtra(EXTRA_HEIGHT,meta.optLong("height",0L))
                .putExtra(EXTRA_MIME,meta.optString("mime",mode.equals("video")?"video/mp4":"image/jpeg")).putExtra(EXTRA_VIDEO_MESSAGE,videoMessage);
            runOnUiThread(()->{if(isFinishing()||capturedFile!=expectedFile){confirming=false;return;}confirmed=true;setResult(Activity.RESULT_OK,result);finish();});
        }catch(Exception e){runOnUiThread(()->{confirming=false;if(!isFinishing()&&capturedFile==expectedFile)toastStatus("No pudimos validar la captura.");});}});
    }

    private void retake(){confirming=false;reviewing=false;reviewCaptionInput=null;capturedDurationMs=0L;releaseReviewMedia();deleteCaptured();buildCameraUi();bindCamera();}

    private void toggleTorch(){
        if(recording||camera==null||!camera.getCameraInfo().hasFlashUnit())return;
        torch=!torch;camera.getCameraControl().enableTorch(torch);flashButton.setText(torch?"⚡·":"⚡");flashButton.setContentDescription(torch?"Desactivar flash":"Activar flash");
    }
    private void updateFlashAvailability(){
        if(flashButton==null)return;boolean available=!recording&&camera!=null&&camera.getCameraInfo().hasFlashUnit();
        flashButton.setEnabled(available);flashButton.setAlpha(available?1f:.35f);if(!available&&!recording)torch=false;
    }
    private void switchCamera(){
        if(cameraProvider==null||recording||reviewing)return;
        int target=lensFacing==CameraSelector.LENS_FACING_BACK?CameraSelector.LENS_FACING_FRONT:CameraSelector.LENS_FACING_BACK;
        try{
            CameraSelector selector=new CameraSelector.Builder().requireLensFacing(target).build();if(!cameraProvider.hasCamera(selector)){toastStatus("Esta cámara no está disponible.");return;}
            if(torch&&camera!=null)camera.getCameraControl().enableTorch(false);torch=false;lensFacing=target;bindCamera();
        }catch(Exception e){toastStatus("No pudimos cambiar de cámara.");}
    }

    private void cancelAndFinish(){
        cancelling=true;if(activeRecording!=null){try{activeRecording.stop();}catch(Exception ignored){}activeRecording=null;}
        releaseReviewMedia();deleteCaptured();setResult(Activity.RESULT_CANCELED);finish();
    }
    private void finishWithError(String message){cancelling=true;releaseReviewMedia();deleteCaptured();setResult(Activity.RESULT_CANCELED,new Intent().putExtra("error",message));finish();}
    private void releaseReviewMedia(){
        reviewGeneration++;VideoView video=reviewVideo;reviewVideo=null;if(video!=null)try{video.stopPlayback();}catch(Exception ignored){}
        Bitmap bitmap=reviewBitmap;reviewBitmap=null;if(bitmap!=null&&!bitmap.isRecycled())bitmap.recycle();
    }
    private void deleteCaptured(){if(capturedFile!=null)try{capturedFile.delete();}catch(Exception ignored){}capturedFile=null;}
    private void toastStatus(String text){
        if(statusLabel==null)return;statusLabel.setText(text);statusLabel.postDelayed(()->{if(!isFinishing()&&!reviewing&&statusLabel!=null)statusLabel.setText(mode.equals("video")?(recording?"● REC":"VIDEO"):"FOTO");},1800);
    }
    private static String formatDuration(long ms){long total=Math.max(0,ms/1000),m=total/60,s=total%60;return String.format(java.util.Locale.ROOT,"%02d:%02d",m,s);}

    private Bitmap decodeScaled(Uri uri,File file,int max){
        try{
            if(android.os.Build.VERSION.SDK_INT>=28){
                ImageDecoder.Source source=ImageDecoder.createSource(getContentResolver(),uri);
                return ImageDecoder.decodeBitmap(source,(decoder,info,src)->{
                    int w=info.getSize().getWidth(),h=info.getSize().getHeight();
                    if(w>max||h>max){double scale=Math.min((double)max/Math.max(1,w),(double)max/Math.max(1,h));decoder.setTargetSize(Math.max(1,(int)Math.round(w*scale)),Math.max(1,(int)Math.round(h*scale)));}
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                });
            }
            BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getAbsolutePath(),bounds);
            int sample=1;while(bounds.outWidth/sample>max||bounds.outHeight/sample>max)sample*=2;BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=Math.max(1,sample);
            return BitmapFactory.decodeFile(file.getAbsolutePath(),options);
        }catch(Exception e){return null;}
    }

    @Override protected void onStop(){if(reviewVideo!=null)try{reviewVideo.pause();}catch(Exception ignored){}if(recording&&!isChangingConfigurations()&&activeRecording!=null)activeRecording.stop();super.onStop();}
    @Override protected void onSaveInstanceState(Bundle outState){
        super.onSaveInstanceState(outState);outState.putInt("camera.lens",lensFacing);outState.putLong("camera.durationMs",capturedDurationMs);outState.putBoolean("camera.reviewing",reviewing&&capturedFile!=null);
        if(capturedFile!=null)outState.putString("camera.capturePath",capturedFile.getAbsolutePath());if(reviewCaptionInput!=null)outState.putString("camera.caption",reviewCaptionInput.getText().toString());
    }
    @Override protected void onDestroy(){releaseReviewMedia();mediaIo.shutdownNow();if(cameraProvider!=null)cameraProvider.unbindAll();if(!confirmed&&!isChangingConfigurations())deleteCaptured();super.onDestroy();}
    @Override public void onConfigurationChanged(Configuration newConfig){
        super.onConfigurationChanged(newConfig);
        if(!reviewing&&previewView!=null&&previewView.getDisplay()!=null){int rotation=previewView.getDisplay().getRotation();if(imageCapture!=null)imageCapture.setTargetRotation(rotation);if(videoCapture!=null)videoCapture.setTargetRotation(rotation);}
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
