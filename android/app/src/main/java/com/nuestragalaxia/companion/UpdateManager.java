package com.nuestragalaxia.companion;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class UpdateManager {
    public interface Listener { void onState(String text,int progress,boolean busy); }

    private static final String MANIFEST_URL="https://github.com/Berserky/Galaxia-de-girasoles/releases/download/android-stable/update.json";
    private static final String PREFS="galaxy_updater";
    private static final String KEY_PENDING_INSTALL="pending_install";
    private static final long MAX_APK_BYTES=100L*1024L*1024L;
    private static final int MAX_MANIFEST_BYTES=64*1024;

    private final Activity activity;
    private final Listener listener;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final SharedPreferences prefs;

    public UpdateManager(Activity activity,Listener listener){
        this.activity=activity;
        this.listener=listener;
        this.prefs=activity.getSharedPreferences(PREFS,Activity.MODE_PRIVATE);
    }

    public void check(boolean manual){
        emit("Buscando actualización…",0,true);
        io.execute(()->{
            try{
                JSONObject manifest=new JSONObject(readText(MANIFEST_URL));
                int versionCode=manifest.getInt("versionCode");
                if(versionCode<=BuildConfig.VERSION_CODE){
                    emit(manual?"Ya tienes la versión más reciente.":"",100,false);
                    return;
                }
                String versionName=manifest.getString("versionName");
                String apkUrl=manifest.getString("apkUrl");
                String sha=manifest.getString("sha256");
                activity.runOnUiThread(()->new AlertDialog.Builder(activity)
                    .setTitle("Actualización "+versionName)
                    .setMessage(manifest.optString("notes","Hay una nueva versión disponible."))
                    .setNegativeButton("Más tarde",(d,w)->emit("Actualización pendiente.",0,false))
                    .setPositiveButton("Actualizar",(d,w)->download(apkUrl,sha))
                    .show());
            }catch(Exception e){
                emit("No se pudo comprobar la actualización: "+safe(e),0,false);
            }
        });
    }

    private File updateFile(){
        return new File(activity.getCacheDir(),"updates/NuestraGalaxia-update.apk");
    }

    private void download(String url,String sha){
        io.execute(()->{
            File out=updateFile();
            try{
                File dir=out.getParentFile();
                if(dir!=null&&!dir.exists()&&!dir.mkdirs()&&!dir.exists())throw new IOException("No se pudo preparar la descarga");
                HttpURLConnection connection=open(url);
                long total=connection.getContentLengthLong();
                if(total>MAX_APK_BYTES)throw new IOException("El paquete supera el tamaño permitido");
                long done=0;
                byte[] buffer=new byte[65536];
                try(InputStream in=connection.getInputStream();OutputStream os=new FileOutputStream(out)){
                    int read;
                    while((read=in.read(buffer))>0){
                        os.write(buffer,0,read);
                        done+=read;
                        if(done>MAX_APK_BYTES)throw new IOException("El paquete supera el tamaño permitido");
                        if(total>0)emit("Descargando actualización…",(int)Math.min(99,done*100/total),true);
                    }
                }finally{
                    connection.disconnect();
                }
                emit("Verificando paquete…",99,true);
                if(!sha256(out).equalsIgnoreCase(sha))throw new SecurityException("La verificación SHA-256 no coincide");
                validatePackage(out);
                emit("Preparando instalación…",100,true);
                activity.runOnUiThread(()->install(out));
            }catch(Exception e){
                prefs.edit().remove(KEY_PENDING_INSTALL).apply();
                if(out.exists())out.delete();
                emit("Error de actualización: "+safe(e),0,false);
            }
        });
    }

    private void validatePackage(File apk)throws Exception{
        PackageInfo info=activity.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(),0);
        if(info==null)throw new SecurityException("El archivo descargado no es un APK válido");
        if(!BuildConfig.APPLICATION_ID.equals(info.packageName))throw new SecurityException("El paquete no pertenece a Nuestra Galaxia");
        long version=Build.VERSION.SDK_INT>=28?info.getLongVersionCode():info.versionCode;
        if(version<=BuildConfig.VERSION_CODE)throw new SecurityException("La actualización no contiene una versión superior");
    }

    private void install(File apk){
        if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls()){
            prefs.edit().putBoolean(KEY_PENDING_INSTALL,true).apply();
            emit("Autoriza a Nuestra Galaxia para instalar su actualización.",100,false);
            activity.startActivity(new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:"+activity.getPackageName())
            ));
            return;
        }
        try{
            validatePackage(apk);
            prefs.edit().remove(KEY_PENDING_INSTALL).apply();
            Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".files",apk);
            activity.startActivity(new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri,"application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_ACTIVITY_NEW_TASK));
            emit("Android está listo para instalar la actualización.",100,false);
        }catch(Exception e){
            prefs.edit().remove(KEY_PENDING_INSTALL).apply();
            if(apk.exists())apk.delete();
            emit("No se pudo preparar la instalación: "+safe(e),0,false);
        }
    }

    public void resumePendingInstall(){
        if(!prefs.getBoolean(KEY_PENDING_INSTALL,false))return;
        if(Build.VERSION.SDK_INT>=26&&!activity.getPackageManager().canRequestPackageInstalls())return;
        File apk=updateFile();
        if(!apk.isFile()){
            prefs.edit().remove(KEY_PENDING_INSTALL).apply();
            return;
        }
        activity.runOnUiThread(()->install(apk));
    }

    private static HttpURLConnection open(String raw)throws Exception{
        URL url=new URL(raw);
        for(int redirects=0;redirects<6;redirects++){
            if(!"https".equalsIgnoreCase(url.getProtocol()))throw new SecurityException("Solo se permiten descargas HTTPS");
            HttpURLConnection connection=(HttpURLConnection)url.openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent","NuestraGalaxia-Android/"+BuildConfig.VERSION_NAME);
            int code=connection.getResponseCode();
            if(code>=300&&code<400){
                String location=connection.getHeaderField("Location");
                connection.disconnect();
                if(location==null)throw new IOException("Redirección inválida");
                url=new URL(url,location);
                continue;
            }
            if(code<200||code>=300){
                connection.disconnect();
                throw new IOException("HTTP "+code);
            }
            return connection;
        }
        throw new IOException("Demasiadas redirecciones");
    }

    private static String readText(String url)throws Exception{
        HttpURLConnection connection=open(url);
        try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[8192];
            int read,total=0;
            while((read=in.read(buffer))>0){
                total+=read;
                if(total>MAX_MANIFEST_BYTES)throw new IOException("Manifiesto demasiado grande");
                out.write(buffer,0,read);
            }
            return out.toString("UTF-8");
        }finally{
            connection.disconnect();
        }
    }

    private static String sha256(File file)throws Exception{
        MessageDigest md=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new FileInputStream(file)){
            byte[] buffer=new byte[65536];
            int read;
            while((read=in.read(buffer))>0)md.update(buffer,0,read);
        }
        StringBuilder result=new StringBuilder();
        for(byte value:md.digest())result.append(String.format(Locale.US,"%02x",value));
        return result.toString();
    }

    private void emit(String text,int progress,boolean busy){
        activity.runOnUiThread(()->listener.onState(text,progress,busy));
    }

    private static String safe(Exception e){
        return e.getMessage()==null?e.getClass().getSimpleName():e.getMessage();
    }

    public void close(){io.shutdownNow();}
}
