package com.nuestragalaxia.companion;

import android.Manifest;
import android.app.*;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONObject;
import java.util.Set;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
    private static final int REQ_LOCATION=100;
    private static final int REQ_TRACKING_NOTIFICATIONS=101;
    private static final int REQ_BOND_NOTIFICATIONS=102;
    private static final int REQ_MEDIA=200;
    private static final Set<String> MOBILE_ACTIONS=Set.of(
        "mobile-state","item-save","item-delete","settings-save","daily-save",
        "bond-save","bond-update","bond-guess","bond-delete","bond-widget",
        "map-state","place-save","place-delete","status-set","destination-save","trip",
        "media-list","media-delete"
    );

    private DeviceStore store;
    private WebView web;
    private UpdateManager updater;
    private final ExecutorService io=Executors.newFixedThreadPool(3);
    private boolean pageReady=false;
    private String pendingLocationRequest;
    private String pendingBondRequest;
    private String pendingMediaRequest;
    private String pendingMediaKind;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
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

        web.loadUrl("file:///android_asset/mobile/index.html");
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private void setupWeb(){
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
        if(Build.VERSION.SDK_INT>=26)WebView.enableSlowWholeDocumentDraw();
        if(Build.VERSION.SDK_INT>=26)settings.setSafeBrowsingEnabled(true);

        web.addJavascriptInterface(new GalaxyBridge(this),"GalaxyAndroid");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageFinished(WebView view,String url){
                if(url.startsWith("file:///android_asset/mobile/")){
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
                if(value.startsWith("file:///android_asset/mobile/")||"about:blank".equals(value))return false;
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
        if(requestCode==REQ_LOCATION){
            boolean granted=results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED;
            if(granted)continueStartLocation();
            else{
                String request=pendingLocationRequest;pendingLocationRequest=null;
                if(request!=null)reject(request,"La ubicación precisa es necesaria para compartir tu recorrido.");
            }
        }else if(requestCode==REQ_TRACKING_NOTIFICATIONS){
            doStartLocation();
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

    @Override protected void onResume(){
        super.onResume();
        if(pageReady){nativeChanged();refreshMomentsInternal();}
    }

    @Override protected void onDestroy(){
        if(updater!=null)updater.close();
        io.shutdownNow();
        if(web!=null){web.removeJavascriptInterface("GalaxyAndroid");web.destroy();}
        super.onDestroy();
    }
}
