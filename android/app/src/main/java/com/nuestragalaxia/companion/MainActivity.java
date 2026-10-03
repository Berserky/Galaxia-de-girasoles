package com.nuestragalaxia.companion;

import android.Manifest;
import android.app.*;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.os.*;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.View;
import android.webkit.*;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.webkit.WebViewAssetLoader;
import androidx.core.content.FileProvider;
import com.google.android.gms.location.CurrentLocationRequest;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import org.json.JSONObject;
import java.time.Instant;
import java.util.*;
import java.io.*;
import java.util.concurrent.*;

public final class MainActivity extends ComponentActivity {
    private static final int REQ_LOCATION=100;
    private static final int REQ_TRACKING_NOTIFICATIONS=101;
    private static final int REQ_BOND_NOTIFICATIONS=102;
    private static final int REQ_MEDIA=200;
    private static final int REQ_MICROPHONE=201;
    private static final int REQ_BACKUP_EXPORT=202;
    private static final int REQ_BACKUP_IMPORT=203;
    private static final int REQ_DRIVE_FOLDER=204;
    private static final int REQ_CAMERA=205;
    private static final Set<String> MOBILE_ACTIONS=Set.of(
        "mobile-state","item-save","item-delete","settings-save","daily-save",
        "bond-save","bond-update","bond-guess","bond-delete","bond-widget","bond-send-gesture","bond-gesture-list","bond-gesture-save","bond-gesture-delete",
        "map-state","place-save","place-delete","status-set","transport-set","destination-save","trip","context-state","context-settings","context-session","context-events","context-suggestion","context-recap",
        "intelligence-search","intelligence-ask","intelligence-connections","intelligence-narrate","intelligence-book","intelligence-transcribe","intelligence-transcript-delete","intelligence-index",
        "media-list","media-delete","presence-set","backup-export","backup-import",
        "pair-code-create","profile-repair","device-revoke","push-token-register","push-token-unregister","push-preferences","goals-engine","date-engine","insights-summary","monthly-summary","today-history","encounter-stats","frequent-places","gps-history-export","gps-history-delete"
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
    private String pendingBackupExportRequest;
    private String pendingBackupJson;
    private String pendingBackupImportRequest;
    private String pendingDriveFolderRequest;
    private String pendingPhotoPickerRequest;
    private String pendingCameraRequest;
    private File pendingCameraFile;
    private Uri pendingCameraUri;
    private ActivityResultLauncher<PickVisualMediaRequest> photoPickerLauncher;
    private CloudMediaStore cloudMedia;
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
        photoPickerLauncher=registerForActivityResult(new ActivityResultContracts.PickMultipleVisualMedia(30),this::handlePhotoPickerResult);
        setContentView(R.layout.activity_main);
        store=new DeviceStore(this);
        cloudMedia=new CloudMediaStore(this);
        PushManager.initialize(this);
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
            state.put("bondHaptics",new BondStore(this).hapticEnabled());
            state.put("pushConfigured",PushManager.configured());
            ContextStore contextPrefs=new ContextStore(this);
            state.put("contextNearbyPush",contextPrefs.nearbyEnabled());
            state.put("contextArrivedSafePush",contextPrefs.arrivedSafeEnabled());
            state.put("notificationsGranted",Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);
            state.put("notificationsEnabled",BondWorker.notificationsAllowed(this));
            state.put("locationGranted",checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED);
            state.put("backgroundLocationGranted",Build.VERSION.SDK_INT<29||checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)==PackageManager.PERMISSION_GRANTED);
            state.put("canPinWidget",Build.VERSION.SDK_INT>=26&&getSystemService(AppWidgetManager.class).isRequestPinAppWidgetSupported());
            state.put("driveFolderConnected",cloudMedia!=null&&cloudMedia.connected());
            state.put("driveFolderName",cloudMedia==null?"":cloudMedia.driveName());
            BatteryManager battery=getSystemService(BatteryManager.class);
            int batteryPct=battery==null?-1:battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            state.put("battery",batteryPct>=0&&batteryPct<=100?batteryPct:JSONObject.NULL);
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
                if("profile-repair".equals(action)){
                    String repaired=result.optString("person","");
                    if(!"0".equals(repaired)&&!"1".equals(repaired))throw new IllegalStateException("El servidor devolvió un perfil no válido.");
                    store.setPerson(repaired);
                    refreshMomentsInternal();
                    nativeChanged();
                }
                resolve(requestId,result);
            }catch(ApiClient.ApiException e){
                if(e.status==401){PushManager.cancel(this);store.clear();new BondStore(this).clear();new ContextStore(this).clear();nativeChanged();}
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
                PushManager.initialize(this);
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
                if(previous!=null)try{ApiClient.pushUnregister(previous);}catch(Exception ignored){}
                if(previous!=null)try{ApiClient.stop(previous);}catch(Exception ignored){}
                PushManager.cancel(this);
                store.clear();
                new BondStore(this).clear();
                new ContextStore(this).clear();
                resolve(requestId,nativeState());
                nativeChanged();
            }catch(Exception e){reject(requestId,"No pudimos desvincular este teléfono.");}
        });
    }

    void copyText(String requestId,String label,String value){
        runOnUiThread(()->{
            try{
                ClipboardManager manager=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                manager.setPrimaryClip(ClipData.newPlainText(label==null?"Nuestra Galaxia":label,value==null?"":value));
                resolve(requestId,new JSONObject().put("ok",true));
            }catch(Exception e){
                reject(requestId,"No pudimos copiar el código.");
            }
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

    void capturePhoto(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        runOnUiThread(()->{
            if(pendingCameraRequest!=null){reject(requestId,"Ya hay una cámara abierta.");return;}
            try{
                File dir=new File(getCacheDir(),"date-photos");
                if(!dir.exists()&&!dir.mkdirs())throw new IOException("No se pudo preparar la cámara.");
                File file=File.createTempFile("date-", ".jpg", dir);
                Uri uri=FileProvider.getUriForFile(this,getPackageName()+".files",file);
                Intent intent=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                intent.putExtra(MediaStore.EXTRA_OUTPUT,uri);
                intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if(intent.resolveActivity(getPackageManager())==null){file.delete();throw new IOException("No hay una cámara compatible en este teléfono.");}
                pendingCameraRequest=requestId;pendingCameraFile=file;pendingCameraUri=uri;
                startActivityForResult(intent,REQ_CAMERA);
            }catch(Exception e){
                pendingCameraRequest=null;pendingCameraFile=null;pendingCameraUri=null;
                reject(requestId,e.getMessage()==null?"No pudimos abrir la cámara.":e.getMessage());
            }
        });
    }

    void pickPhotos(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        runOnUiThread(()->{
            if(pendingPhotoPickerRequest!=null){reject(requestId,"Ya hay un selector de fotos abierto.");return;}
            pendingPhotoPickerRequest=requestId;
            try{
                photoPickerLauncher.launch(new PickVisualMediaRequest.Builder().setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE).build());
            }catch(Exception e){
                pendingPhotoPickerRequest=null;
                reject(requestId,"Android no pudo abrir el selector de fotos.");
            }
        });
    }

    private void handlePhotoPickerResult(java.util.List<Uri> uris){
        String request=pendingPhotoPickerRequest;pendingPhotoPickerRequest=null;
        if(request==null)return;
        if(uris==null||uris.isEmpty()){reject(request,"Selección cancelada.");return;}
        io.execute(()->{
            int imported=0,skipped=0;String lastError="";
            try{
                String token=store.token();
                if(token==null)throw new ApiClient.ApiException(401,"El vínculo del dispositivo ya no es válido.");
                for(Uri uri:uris.subList(0,Math.min(30,uris.size()))){
                    try{MobileApiClient.upload(this,token,uri,"photo");imported++;}
                    catch(Exception e){skipped++;lastError=e.getMessage()==null?"Formato no compatible.":e.getMessage();}
                }
                JSONObject out=new JSONObject().put("imported",imported).put("skipped",skipped);
                if(!lastError.isBlank())out.put("lastError",lastError);
                resolve(request,out);
            }catch(Exception e){reject(request,e.getMessage()==null?"No pudimos importar las fotos seleccionadas.":e.getMessage());}
        });
    }

    void pickDriveFolder(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        runOnUiThread(()->{
            if(pendingDriveFolderRequest!=null){reject(requestId,"Ya hay un selector de carpeta abierto.");return;}
            pendingDriveFolderRequest=requestId;
            Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION|Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
            try{startActivityForResult(intent,REQ_DRIVE_FOLDER);}
            catch(Exception e){pendingDriveFolderRequest=null;reject(requestId,"Android no pudo abrir el selector de carpetas.");}
        });
    }

    void disconnectDriveFolder(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        runOnUiThread(()->{
            try{
                Uri tree=cloudMedia.driveTree();
                if(tree!=null)try{getContentResolver().releasePersistableUriPermission(tree,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}
                cloudMedia.clearDrive();nativeChanged();
                resolve(requestId,new JSONObject().put("connected",false));
            }catch(Exception e){reject(requestId,"No pudimos desconectar la carpeta.");}
        });
    }

    private String documentName(Uri uri){
        try(Cursor cursor=getContentResolver().query(uri,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){
            if(cursor!=null&&cursor.moveToFirst()){
                int i=cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
                if(i>=0&&!cursor.isNull(i))return cursor.getString(i);
            }
        }catch(Exception ignored){}
        return "Carpeta de Google Drive";
    }

    private static final class DriveImage{
        final Uri uri; final String key;
        DriveImage(Uri uri,String key){this.uri=uri;this.key=key;}
    }

    private void collectDriveImages(Uri tree,String parentId,java.util.List<DriveImage> out,int depth) throws Exception{
        if(depth>5||out.size()>=250)return;
        Uri children=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parentId);
        String[] projection={
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED
        };
        try(Cursor cursor=getContentResolver().query(children,projection,null,null,null)){
            if(cursor==null)return;
            int idIx=cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int mimeIx=cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE);
            int sizeIx=cursor.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE);
            int modifiedIx=cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
            while(cursor.moveToNext()&&out.size()<250){
                String id=idIx>=0?cursor.getString(idIx):null,mime=mimeIx>=0?cursor.getString(mimeIx):null;
                if(id==null)continue;
                if(DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)){collectDriveImages(tree,id,out,depth+1);continue;}
                if(!Set.of("image/jpeg","image/png","image/webp").contains(mime))continue;
                long size=sizeIx>=0&&!cursor.isNull(sizeIx)?cursor.getLong(sizeIx):-1;
                if(size>12L*1024L*1024L)continue;
                long modified=modifiedIx>=0&&!cursor.isNull(modifiedIx)?cursor.getLong(modifiedIx):0;
                Uri doc=DocumentsContract.buildDocumentUriUsingTree(tree,id);
                out.add(new DriveImage(doc,id+"|"+modified+"|"+size));
            }
        }
    }

    void syncDriveFolder(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        Uri tree=cloudMedia.driveTree();
        if(tree==null){reject(requestId,"Primero elige una carpeta de Google Drive.");return;}
        io.execute(()->{
            try{
                String token=store.token();if(token==null)throw new ApiClient.ApiException(401,"El vínculo del dispositivo ya no es válido.");
                String rootId=DocumentsContract.getTreeDocumentId(tree);
                java.util.List<DriveImage> images=new ArrayList<>();
                collectDriveImages(tree,rootId,images,0);
                Set<String> importedKeys=cloudMedia.imported();
                int imported=0,skipped=0,failed=0;
                for(DriveImage image:images){
                    if(importedKeys.contains(image.key)){skipped++;continue;}
                    try{
                        MobileApiClient.upload(this,token,image.uri,"photo");
                        importedKeys.add(image.key);imported++;
                    }catch(Exception e){failed++;}
                }
                cloudMedia.markImported(importedKeys);
                resolve(requestId,new JSONObject().put("imported",imported).put("skipped",skipped).put("failed",failed).put("found",images.size()).put("limited",images.size()>=250));
            }catch(SecurityException e){
                cloudMedia.clearDrive();nativeChanged();reject(requestId,"Android perdió el permiso de esa carpeta. Vuelve a conectarla.");
            }catch(Exception e){reject(requestId,e.getMessage()==null?"No pudimos sincronizar la carpeta de Drive.":e.getMessage());}
        });
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==REQ_CAMERA){
            String request=pendingCameraRequest;File file=pendingCameraFile;Uri uri=pendingCameraUri;
            pendingCameraRequest=null;pendingCameraFile=null;pendingCameraUri=null;
            if(request==null)return;
            if(resultCode!=RESULT_OK||file==null||uri==null){if(file!=null)file.delete();reject(request,"Foto cancelada.");return;}
            io.execute(()->{
                try{
                    String token=store.token();
                    if(token==null)throw new ApiClient.ApiException(401,"El vínculo del dispositivo ya no es válido.");
                    JSONObject uploaded=MobileApiClient.upload(this,token,uri,"photo");
                    resolve(request,uploaded);
                }catch(Exception e){reject(request,e.getMessage()==null?"No pudimos guardar la foto.":e.getMessage());}
                finally{file.delete();}
            });
            return;
        }
        if(requestCode==REQ_DRIVE_FOLDER){
            String request=pendingDriveFolderRequest;pendingDriveFolderRequest=null;
            if(request==null)return;
            if(resultCode!=RESULT_OK||data==null||data.getData()==null){reject(request,"Selección cancelada.");return;}
            Uri uri=data.getData();
            try{
                getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);
                String name=documentName(uri);cloudMedia.saveDrive(uri,name);nativeChanged();
                resolve(request,new JSONObject().put("connected",true).put("name",name));
            }catch(Exception e){reject(request,"La carpeta seleccionada no permite acceso persistente. Elige la carpeta desde Google Drive o Archivos.");}
            return;
        }
        if(requestCode==REQ_MEDIA){
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
            return;
        }
        if(requestCode==REQ_BACKUP_EXPORT){
            String request=pendingBackupExportRequest,json=pendingBackupJson;
            pendingBackupExportRequest=null;pendingBackupJson=null;
            if(request==null)return;
            if(resultCode!=RESULT_OK||data==null||data.getData()==null){reject(request,"Exportación cancelada.");return;}
            Uri uri=data.getData();
            io.execute(()->{
                try(OutputStream out=getContentResolver().openOutputStream(uri,"w")){
                    if(out==null)throw new IOException("No se pudo abrir el archivo.");
                    byte[] bytes=(json==null?"{}":json).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    if(bytes.length>2*1024*1024)throw new IOException("La copia supera el tamaño permitido.");
                    out.write(bytes);
                    resolve(request,new JSONObject().put("saved",true));
                }catch(Exception e){reject(request,e.getMessage()==null?"No pudimos guardar la copia.":e.getMessage());}
            });
            return;
        }
        if(requestCode==REQ_BACKUP_IMPORT){
            String request=pendingBackupImportRequest;pendingBackupImportRequest=null;
            if(request==null)return;
            if(resultCode!=RESULT_OK||data==null||data.getData()==null){reject(request,"Importación cancelada.");return;}
            Uri uri=data.getData();
            io.execute(()->{
                try(InputStream in=getContentResolver().openInputStream(uri);ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    if(in==null)throw new IOException("No se pudo abrir el archivo.");
                    byte[] buffer=new byte[8192];int read,total=0;
                    while((read=in.read(buffer))!=-1){
                        total+=read;if(total>2*1024*1024)throw new IOException("La copia supera el tamaño permitido.");
                        out.write(buffer,0,read);
                    }
                    String json=out.toString(java.nio.charset.StandardCharsets.UTF_8.name());
                    new JSONObject(json);
                    resolve(request,new JSONObject().put("json",json));
                }catch(Exception e){reject(request,"El archivo no es una copia válida de Nuestra Galaxia.");}
            });
        }
    }

    void exportJson(String requestId,String fileName,String json){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        runOnUiThread(()->{
            if(pendingBackupExportRequest!=null){reject(requestId,"Ya hay una exportación abierta.");return;}
            pendingBackupExportRequest=requestId;pendingBackupJson=json==null?"{}":json;
            Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE,(fileName==null||fileName.trim().isEmpty())?"nuestra-galaxia-backup.json":fileName);
            try{startActivityForResult(intent,REQ_BACKUP_EXPORT);}
            catch(Exception e){pendingBackupExportRequest=null;pendingBackupJson=null;reject(requestId,"Android no pudo abrir el selector para guardar la copia.");}
        });
    }

    void clearPendingGps(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        io.execute(()->{
            try{
                PendingPointStore pending=new PendingPointStore(getApplicationContext());
                int cleared=pending.clear();pending.close();
                resolve(requestId,new JSONObject().put("cleared",cleared));
            }catch(Exception e){reject(requestId,"No pudimos limpiar la cola GPS pendiente del teléfono.");}
        });
    }

    void importJson(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        runOnUiThread(()->{
            if(pendingBackupImportRequest!=null){reject(requestId,"Ya hay una importación abierta.");return;}
            pendingBackupImportRequest=requestId;
            Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            try{startActivityForResult(intent,REQ_BACKUP_IMPORT);}
            catch(Exception e){pendingBackupImportRequest=null;reject(requestId,"Android no pudo abrir el selector de copias.");}
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
        cleanupVoice(true);
        try{
            voiceFile=new File(getCacheDir(),"voice-"+System.currentTimeMillis()+".m4a");
            voiceRecorder=android.os.Build.VERSION.SDK_INT>=31?new MediaRecorder(this):new MediaRecorder();
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
                voicePlayer=new MediaPlayer();voicePlayer.setDataSource(voiceFile.getAbsolutePath());voicePlayer.prepare();
                voicePlayer.setOnCompletionListener(player->{try{player.release();}catch(Exception ignored){}voicePlayer=null;event("voice-preview-ended",new JSONObject());});
                voicePlayer.start();
                resolve(requestId,new JSONObject().put("playing",true));
            }catch(Exception e){reject(requestId,"No pudimos reproducir la grabación.");}
        });
    }

    void discardVoiceRecording(String requestId){
        runOnUiThread(()->{cleanupVoice(true);try{resolve(requestId,new JSONObject().put("ready",false));}catch(Exception e){reject(requestId,"No pudimos descartar la grabación.");}});
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

    void refreshLocation(String requestId){
        if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
        if(!store.tracking()){reject(requestId,"Activa Compartir ubicación antes de actualizar el GPS.");return;}
        runOnUiThread(()->{
            boolean granted=checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
                ||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
            if(!granted){reject(requestId,"Activa el permiso de ubicación para obtener una posición reciente.");return;}
            try{
                FusedLocationProviderClient fused=LocationServices.getFusedLocationProviderClient(this);
                CurrentLocationRequest current=new CurrentLocationRequest.Builder()
                    .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                    .setMaxUpdateAgeMillis(0)
                    .setDurationMillis(12000)
                    .build();
                com.google.android.gms.tasks.CancellationToken tokenSource=new com.google.android.gms.tasks.CancellationTokenSource().getToken();
                fused.getCurrentLocation(current,tokenSource)
                    .addOnSuccessListener(this,loc->{
                        if(loc==null){reject(requestId,"Android no obtuvo una ubicación reciente. Revisa GPS y permisos.");return;}
                        MotionClassifier.Result motion=new MotionClassifier().classify(loc);
                        double accuracy=loc.hasAccuracy()?loc.getAccuracy():-1,heading=loc.hasBearing()?loc.getBearing():-1;
                        long when=loc.getTime()>0?loc.getTime():System.currentTimeMillis();
                        String captured=Instant.ofEpochMilli(when).toString(),sampleId=UUID.randomUUID().toString();
                        io.execute(()->{
                            try{
                                String deviceToken=store.token();
                                if(deviceToken==null)throw new ApiClient.ApiException(401,"El vínculo del dispositivo ya no es válido.");
                                ApiClient.location(deviceToken,loc.getLatitude(),loc.getLongitude(),accuracy,motion.speedMs,heading,motion.motion,false,false,captured,sampleId);
                                resolve(requestId,new JSONObject().put("updated",true).put("capturedAt",captured));
                            }catch(Exception e){reject(requestId,e.getMessage()==null?"No pudimos actualizar tu ubicación.":e.getMessage());}
                        });
                    })
                    .addOnFailureListener(this,e->reject(requestId,"Android no pudo solicitar una ubicación reciente."));
            }catch(Exception e){reject(requestId,"Android no pudo solicitar una ubicación reciente.");}
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
        if(enabled)BondWorker.prepareNotifications(this);
        PushManager.schedule(this);
        io.execute(()->{
            try{BondWorker.schedule(getApplicationContext());if(enabled)BondWorker.refresh(getApplicationContext());}catch(Exception ignored){}
        });
        resolve(requestId,nativeState());
        nativeChanged();
    }

    void setBondHaptics(String requestId,boolean enabled){
        runOnUiThread(()->{
            if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
            new BondStore(this).hapticEnabled(enabled);
            PushManager.schedule(this);
            resolve(requestId,nativeState());
            nativeChanged();
        });
    }

    void setContextPushPrefs(String requestId,boolean nearby,boolean arrivedSafe){
        runOnUiThread(()->{
            if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
            new ContextStore(this).pushPrefs(nearby,arrivedSafe);
            PushManager.schedule(this);
            resolve(requestId,nativeState());
            nativeChanged();
        });
    }

    void testMomentNotification(String requestId){
        runOnUiThread(()->{
            if(!store.pairedFast()){reject(requestId,"Vincula este teléfono primero.");return;}
            if(!new BondStore(this).enabled()){reject(requestId,"Activa primero las notificaciones de momentos.");return;}
            if(!BondWorker.notificationsAllowed(this)){reject(requestId,"Android está bloqueando las notificaciones. Ábrelas desde Ajustes del sistema.");return;}
            try{BondWorker.testNotification(this);resolve(requestId,new JSONObject().put("sent",true));}
            catch(Exception e){reject(requestId,"Android no pudo mostrar la notificación de prueba.");}
        });
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

    void setSystemTheme(String requestId,String theme){
        runOnUiThread(()->{
            try{
                String key=theme==null?"daylight":theme;
                String hex=switch(key){
                    case "cosmic" -> "#10101D";
                    case "halloween" -> "#100913";
                    case "christmas" -> "#071510";
                    case "valentine" -> "#180810";
                    case "friendship" -> "#120B22";
                    case "easter" -> "#11162C";
                    default -> "#F7F6FA";
                };
                boolean light="daylight".equals(key);
                getWindow().setStatusBarColor(Color.parseColor(hex));
                getWindow().setNavigationBarColor(Color.parseColor(hex));
                int flags=getWindow().getDecorView().getSystemUiVisibility();
                if(light)flags|=View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                else flags&=~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                getWindow().getDecorView().setSystemUiVisibility(flags);
                resolve(requestId,new JSONObject().put("theme",key));
            }catch(Exception e){reject(requestId,"No pudimos sincronizar el tema con Android.");}
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

    private void ensureTrackingService(){
        if(store==null||!store.pairedFast()||!store.tracking())return;
        boolean locationGranted=checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
            ||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
        boolean notificationsGranted=Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
        if(!locationGranted||!notificationsGranted)return;
        try{startForegroundService(new Intent(this,TrackingService.class).setAction(TrackingService.ACTION_START));}
        catch(Exception ignored){}
    }

    @Override protected void onResume(){
        super.onResume();
        ensureTrackingService();
        if(updater!=null)updater.resumePendingInstall();
        if(pageReady){nativeChanged();refreshMomentsInternal();}
    }

    @Override protected void onPause(){
        super.onPause();
        if(voiceRecorder!=null)stopVoiceRecording(null);
    }

    @Override protected void onDestroy(){
        cleanupVoice(true);
        if(updater!=null)updater.close();
        io.shutdownNow();
        if(web!=null){web.removeJavascriptInterface("GalaxyAndroid");web.destroy();}
        super.onDestroy();
    }
}
