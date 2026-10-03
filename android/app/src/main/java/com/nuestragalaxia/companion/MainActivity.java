package com.nuestragalaxia.companion;

import android.Manifest;
import android.app.*;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;
import java.util.Set;
import java.io.File;
import java.util.concurrent.*;

public final class MainActivity extends ComponentActivity {
    private static final int REQ_LOCATION=100;
    private static final int REQ_TRACKING_NOTIFICATIONS=101;
    private static final int REQ_BOND_NOTIFICATIONS=102;
    private static final int REQ_MEDIA=200;
    private static final int REQ_MICROPHONE=201;
    private static final Set<String> MOBILE_ACTIONS=Set.of(
        "mobile-state","item-save","item-delete","settings-save","daily-save",
        "bond-save","bond-update","bond-guess","bond-delete","bond-widget",
        "map-state","place-save","place-delete","status-set","transport-set","destination-save","trip",
        "media-list","media-delete"
    );

    private DeviceStore store;
    private WebView web;
    private UpdateManager updater;
    private final ExecutorService io=Executors.newFixedThreadPool(3);
    private boolean pageReady=false;
    private WebViewAssetLoader assetLoader;
    private String pendingLocationRequest;
    private String pendingBondRequest;
    private String pendingMediaRequest;
    private String pendingMediaKind;
    private String pendingVoiceStartRequest;
    private MediaRecorder voiceRecorder;
    private MediaPlayer voicePlayer;
    private File voiceFile;
    private long voiceStartedAt;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
            @Override public void handleOnBackPressed(){
                if(pageReady)evaluate("window.GalaxyNative&&window.GalaxyNative.back&&window.GalaxyNative.back();");
                else{
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
        setContentView(R.layout.activity_main);
        store=new DeviceStore(this);
        web=findViewById(R.id.webView);
        setupWeb();

        updater=new UpdateManager(this,(text,progress,busy)->{
            JSONObject payload=new JSONObject();
            try{
                payload.put("text",text);
                payload.put("progress",progress);
                payload.put("busy",busy);
            }catch(Exception ignored){}
            event("update",payload);
        });

        web.loadUrl("https://appassets.androidplatform.net/assets/mobile/index.html");
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private void setupWeb(){
        assetLoader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        if(Build.VERSION.SDK_INT>=26)settings.setSafeBrowsingEnabled(true);

        web.addJavascriptInterface(new GalaxyBridge(this),"GalaxyAndroid");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){ return assetLoader.shouldInterceptRequest(request.getUrl()); }
            @Override public void onPageFinished(WebView view,String url){
                if(url.startsWith("https://appassets.androidplatform.net/assets/mobile/")){
                    pageReady=true;
                    nativeChanged();
                    refreshMomentsInternal();
                    updater.check(false);
                }
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                if(!request.isForMainFrame())return false;
                Uri uri=request.getUrl();
                String value=uri.toString();
                if(value.startsWith("https://appassets.androidplatform.net/assets/mobile/")||"about:blank".equals(value))return false;
                return true;
            }

            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){
                if(request.isForMainFrame())toast("No pudimos cargar la interfaz móvil.");
            }
        });
    }

    JSONObject nativeState(){
        JSONObject state=new JSONObject();
        try{
            boolean paired=store.pairedFast();
            state.put("version",BuildConfig.VERSION_NAME);
            state.put("versionCode",BuildConfig.VERSION_CODE);
            state.put("paired",paired);
            state.put("person",paired?store.person():"");
            state.put("name",paired?store.name():"");
            state.put("tracking",paired&&store.tracking());
            state.put("momentNotifications",new BondStore(this).enabled());
            state.put("notificationsGranted",Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);
            state.put("locationGranted",checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED);
            state.put("backgroundLocationGranted",Build.VERSION.SDK_INT<29||checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)==PackageManager.PERMISSION_GRANTED);
            state.put("canPinWidget",Build.VERSION.SDK_INT>=26&&getSystemService(AppWidgetManager.class).isRequestPinAppWidgetSupported());
        }catch(Exception ignored){}
        return state;
    }

    void api(String requestId,String payload){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        io.execute(()->{
            try{
                JSONObject body=new JSONObject(payload);
                String action=body.optString("action","");
                if(!MOBILE_ACTIONS.contains(action))throw new IllegalArgumentException("Acción móvil no permitida.");
                String token=store.token();
                if(token==null){store.clear();throw new ApiClient.ApiException(401,"El vínculo del dispositivo ya no es válido.");}
                JSONObject result=MobileApiClient.post(token,body);
                resolve(requestId,result);
            }catch(ApiClient.ApiException e){
                if(e.status==401){store.clear();nativeChanged();}
                reject(requestId,e.getMessage());
            }catch(Exception e){
                reject(requestId,e.getMessage()==null?"No pudimos completar la acción.":e.getMessage());
            }
        });
    }

    void pair(String requestId,String code){
        String clean=code==null?"":code.trim();
        if(clean.isEmpty()){reject(requestId,"Pega el código generado en Nuestra Galaxia.");return;}
        io.execute(()->{
            try{
                ApiClient.PairResult result=ApiClient.pair(clean,Build.MANUFACTURER+" "+Build.MODEL);
                store.save(result.token,result.person,result.name);
                refreshMomentsInternal();
                resolve(requestId,nativeState());
                nativeChanged();
            }catch(Exception e){reject(requestId,e.getMessage()==null?"No se pudo vincular el teléfono.":e.getMessage());}
        });
    }

    void unpair(String requestId){
        io.execute(()->{
            try{
                String previous=store.token();
                stopService(new Intent(this,TrackingService.class));
                store.clear();
                if(previous!=null)try{ApiClient.stop(previous);}catch(Exception ignored){}
                resolve(requestId,nativeState());
                nativeChanged();
            }catch(Exception e){reject(requestId,"No pudimos desvincular este teléfono.");}
        });
    }

    void pickMedia(String requestId,String kind){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        if(!Set.of("photo","music","voice").contains(kind)){reject(requestId,"Tipo de archivo no válido.");return;}
        runOnUiThread(()->{
            if(pendingMediaRequest!=null){reject(requestId,"Ya hay un selector de archivo abierto.");return;}
            pendingMediaRequest=requestId;pendingMediaKind=kind;
            Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("photo".equals(kind)?"image/*":"music".equals(kind)?"audio/mpeg":"audio/*");
            try{startActivityForResult(intent,REQ_MEDIA);}
            catch(Exception e){pendingMediaRequest=null;pendingMediaKind=null;reject(requestId,"No hay un selector compatible en este teléfono.");}
        });
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=REQ_MEDIA)return;
        String request=pendingMediaRequest,kind=pendingMediaKind;
        pendingMediaRequest=null;pendingMediaKind=null;
        if(request==null)return;
        if(resultCode!=RESULT_OK||data==null||data.getData()==null){reject(request,"Selección cancelada.");return;}
        Uri uri=data.getData();
        try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}
        io.execute(()->{
            try{
                String token=store.token();
                if(token==null)throw new ApiClient.ApiException(401,"El vínculo del dispositivo ya no es válido.");
                resolve(request,MobileApiClient.upload(this,token,uri,kind));
            }catch(Exception e){reject(request,e.getMessage()==null?"No pudimos subir el archivo.":e.getMessage());}
        });
    }

    void startVoiceRecording(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        runOnUiThread(()->{
            if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
                pendingVoiceStartRequest=requestId;requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQ_MICROPHONE);return;
            }
            beginVoiceRecording(requestId);
        });
    }

    private void beginVoiceRecording(String requestId){
        cleanupVoice(false);
        try{
            voiceFile=new File(getCacheDir(),"voice-"+System.currentTimeMillis()+".m4a");
            voiceRecorder=new MediaRecorder(this);
            voiceRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            voiceRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            voiceRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            voiceRecorder.setAudioEncodingBitRate(96000);voiceRecorder.setAudioSamplingRate(44100);
            voiceRecorder.setMaxDuration(60000);voiceRecorder.setMaxFileSize(5L*1024L*1024L);
            voiceRecorder.setOutputFile(voiceFile.getAbsolutePath());
            voiceRecorder.setOnInfoListener((r,what,extra)->{if(what==MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED||what==MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED)stopVoiceRecording(null);});
            voiceRecorder.prepare();voiceRecorder.start();voiceStartedAt=System.currentTimeMillis();
            resolve(requestId,new JSONObject().put("recording",true));
        }catch(Exception e){cleanupVoice(true);reject(requestId,"No pudimos iniciar el micrófono.");}
    }

    void stopVoiceRecording(String requestId){
        runOnUiThread(()->{
            if(voiceRecorder==null){if(requestId!=null)reject(requestId,"No hay una grabación activa.");return;}
            try{voiceRecorder.stop();}catch(Exception e){cleanupVoice(true);if(requestId!=null)reject(requestId,"La grabación fue demasiado corta.");return;}
            try{voiceRecorder.release();}catch(Exception ignored){} voiceRecorder=null;
            long duration=Math.max(0,System.currentTimeMillis()-voiceStartedAt);
            if(voiceFile==null||!voiceFile.exists()||voiceFile.length()<512){cleanupVoice(true);if(requestId!=null)reject(requestId,"No se recibió audio. Inténtalo otra vez.");return;}
            try{JSONObject out=new JSONObject().put("ready",true).put("durationMs",duration).put("size",voiceFile.length());if(requestId!=null)resolve(requestId,out);else event("voice",out);}catch(Exception ignored){}
        });
    }

    void playVoiceRecording(String requestId){
        runOnUiThread(()->{
            if(voiceFile==null||!voiceFile.exists()){reject(requestId,"Primero graba un audio.");return;}
            try{
                if(voicePlayer!=null){voicePlayer.release();voicePlayer=null;}
                voicePlayer=new MediaPlayer();voicePlayer.setDataSource(voiceFile.getAbsolutePath());voicePlayer.prepare();voicePlayer.start();
                resolve(requestId,new JSONObject().put("playing",true));
            }catch(Exception e){reject(requestId,"No pudimos reproducir la grabación.");}
        });
    }

    void discardVoiceRecording(String requestId){
        runOnUiThread(()->{cleanupVoice(true);resolve(requestId,new JSONObject().put("ready",false));});
    }

    void saveVoiceRecording(String requestId){
        if(voiceRecorder!=null){reject(requestId,"Detén la grabación antes de guardarla.");return;}
        File file=voiceFile;
        if(file==null||!file.exists()){reject(requestId,"Primero graba un audio.");return;}
        io.execute(()->{
            try{
                String token=store.token();if(token==null)throw new ApiClient.ApiException(401,"El vínculo del dispositivo ya no es válido.");
                JSONObject uploaded=MobileApiClient.uploadVoiceFile(this,token,file);
                if(file.delete())voiceFile=null;resolve(requestId,uploaded);
            }catch(Exception e){reject(requestId,e.getMessage()==null?"No pudimos subir la grabación.":e.getMessage());}
        });
    }

    private void cleanupVoice(boolean delete){
        if(voicePlayer!=null){try{voicePlayer.stop();}catch(Exception ignored){}try{voicePlayer.release();}catch(Exception ignored){}voicePlayer=null;}
        if(voiceRecorder!=null){try{voiceRecorder.stop();}catch(Exception ignored){}try{voiceRecorder.release();}catch(Exception ignored){}voiceRecorder=null;}
        if(delete&&voiceFile!=null){try{voiceFile.delete();}catch(Exception ignored){}voiceFile=null;}
    }

    void startLocation(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        runOnUiThread(()->{
            pendingLocationRequest=requestId;
            if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},REQ_LOCATION);
                return;
            }
            continueStartLocation();
        });
    }

    private void continueStartLocation(){
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQ_TRACKING_NOTIFICATIONS);
            return;
        }
        doStartLocation();
    }

    private void doStartLocation(){
        String request=pendingLocationRequest;pendingLocationRequest=null;
        try{
            startForegroundService(new Intent(this,TrackingService.class).setAction(TrackingService.ACTION_START));
            store.setTracking(true);
            if(request!=null)resolve(request,nativeState());
            nativeChanged();
        }catch(Exception e){if(request!=null)reject(request,"Android no permitió iniciar la ubicación.");}
    }

    void stopLocation(String requestId){
        runOnUiThread(()->{
            try{
                startService(new Intent(this,TrackingService.class).setAction(TrackingService.ACTION_STOP));
                store.setTracking(false);
                resolve(requestId,nativeState());
                nativeChanged();
            }catch(Exception e){reject(requestId,"No pudimos detener la ubicación.");}
        });
    }

    void setMomentNotifications(String requestId,boolean enabled){
        runOnUiThread(()->{
            if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
            if(enabled&&Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
                pendingBondRequest=requestId;
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQ_BOND_NOTIFICATIONS);
                return;
            }
            applyMomentNotifications(requestId,enabled);
        });
    }

    private void applyMomentNotifications(String requestId,boolean enabled){
        new BondStore(this).enabled(enabled);
        io.execute(()->{
            try{BondWorker.schedule(getApplicationContext());if(enabled)BondWorker.refresh(getApplicationContext());}catch(Exception ignored){}
        });
        resolve(requestId,nativeState());
        nativeChanged();
    }

    void addWidget(String requestId){
        runOnUiThread(()->{
            if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
            AppWidgetManager manager=getSystemService(AppWidgetManager.class);
            if(Build.VERSION.SDK_INT>=26&&manager.isRequestPinAppWidgetSupported()){
                boolean requested=manager.requestPinAppWidget(new ComponentName(this,BondWidget.class),null,null);
                if(requested)resolve(requestId,new JSONObject());
                else reject(requestId,"El launcher no aceptó la solicitud del widget.");
            }else{
                reject(requestId,"Mantén pulsado el escritorio y elige Widgets → Nuestra Galaxia.");
            }
        });
    }

    void openAppSettings(String requestId){
        runOnUiThread(()->{
            try{
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName())));
                resolve(requestId,new JSONObject());
            }catch(Exception e){reject(requestId,"No pudimos abrir los ajustes de Android.");}
        });
    }

    void checkUpdate(String requestId){
        runOnUiThread(()->{
            updater.check(true);
            try{resolve(requestId,new JSONObject().put("started",true));}catch(Exception ignored){}
        });
    }

    void refreshMoments(String requestId){
        refreshMomentsInternal();
        resolve(requestId,new JSONObject());
    }

    private void refreshMomentsInternal(){
        Context app=getApplicationContext();
        io.execute(()->{
            try{BondWorker.schedule(app);BondWorker.refresh(app);}catch(Exception ignored){}
        });
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
        super.onRequestPermissionsResult(requestCode,permissions,results);
        if(requestCode==REQ_MICROPHONE){
            String request=pendingVoiceStartRequest;pendingVoiceStartRequest=null;
            boolean granted=results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED;
            if(request!=null){if(granted)beginVoiceRecording(request);else reject(request,"Activa el permiso de micrófono para grabar desde la aplicación.");}
        }else if(requestCode==REQ_LOCATION){
            boolean granted=results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED;
            if(granted)continueStartLocation();
            else{
                String request=pendingLocationRequest;pendingLocationRequest=null;
                if(request!=null)reject(request,"La ubicación precisa es necesaria para compartir tu recorrido.");
            }
        }else if(requestCode==REQ_TRACKING_NOTIFICATIONS){
            boolean granted=results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED;
            if(granted)doStartLocation();
            else{
                String request=pendingLocationRequest;pendingLocationRequest=null;
                if(request!=null)reject(request,"Activa las notificaciones para que Android muestre claramente cuándo compartes tu ubicación.");
            }
        }else if(requestCode==REQ_BOND_NOTIFICATIONS){
            String request=pendingBondRequest;pendingBondRequest=null;
            boolean granted=results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED;
            if(request!=null)applyMomentNotifications(request,granted);
        }
        nativeChanged();
    }

    void resolve(String requestId,JSONObject value){
        if(requestId==null)return;
        String script="window.GalaxyNative&&window.GalaxyNative.receive("+JSONObject.quote(requestId)+","+JSONObject.quote(value==null?"{}":value.toString())+",null);";
        evaluate(script);
    }

    void reject(String requestId,String error){
        if(requestId==null)return;
        String script="window.GalaxyNative&&window.GalaxyNative.receive("+JSONObject.quote(requestId)+",null,"+JSONObject.quote(error==null?"No pudimos completar la acción.":error)+");";
        evaluate(script);
    }

    private void event(String name,JSONObject payload){
        if(!pageReady)return;
        String script="window.GalaxyNative&&window.GalaxyNative.event("+JSONObject.quote(name)+","+JSONObject.quote(payload==null?"{}":payload.toString())+");";
        evaluate(script);
    }

    private void nativeChanged(){event("native",nativeState());}

    private void evaluate(String script){
        web.post(()->{
            if(!isFinishing()&&!isDestroyed())web.evaluateJavascript(script,null);
        });
    }

    private void toast(String text){runOnUiThread(()->Toast.makeText(this,text,Toast.LENGTH_LONG).show());}

    void closeApp(){runOnUiThread(this::finish);}

    @Override protected void onResume(){
        super.onResume();
        if(updater!=null)updater.resumePendingInstall();
        if(pageReady){nativeChanged();refreshMomentsInternal();}
    }

    @Override protected void onDestroy(){
        cleanupVoice(true);
        if(updater!=null)updater.close();
        io.shutdownNow();
        if(web!=null){web.removeJavascriptInterface("GalaxyAndroid");web.destroy();}
        super.onDestroy();
    }
}
