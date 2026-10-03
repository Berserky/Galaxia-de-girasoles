package com.nuestragalaxia.companion;

import android.Manifest;
import android.app.*;
import android.appwidget.AppWidgetManager;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.os.Build;
import androidx.work.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

public final class BondWorker extends Worker {
    private static final String PERIODIC="galaxy-moments-periodic",ONCE="galaxy-moments-refresh",CHANNEL="galaxy-moments-v2";

    public BondWorker(Context c,WorkerParameters p){super(c,p);}

    private static Constraints constraints(){
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    public static void schedule(Context c){
        DeviceStore device=new DeviceStore(c);
        boolean widgets=AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c,BondWidget.class)).length>0;
        WorkManager wm=WorkManager.getInstance(c);
        if(device.pairedFast()&&(widgets||new BondStore(c).enabled())){
            wm.enqueueUniquePeriodicWork(
                PERIODIC,
                ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(BondWorker.class,15,TimeUnit.MINUTES)
                    .setConstraints(constraints())
                    .build()
            );
        }else{
            wm.cancelUniqueWork(PERIODIC);
        }
    }

    public static void refresh(Context c){
        if(new DeviceStore(c).pairedFast()){
            WorkManager.getInstance(c).enqueueUniqueWork(
                ONCE,
                ExistingWorkPolicy.KEEP,
                new OneTimeWorkRequest.Builder(BondWorker.class)
                    .setConstraints(constraints())
                    .build()
            );
        }
    }

    public static void sendHug(Context c){
        if(new DeviceStore(c).pairedFast()){
            WorkManager.getInstance(c).enqueueUniqueWork(
                "galaxy-moments-hug",
                ExistingWorkPolicy.KEEP,
                new OneTimeWorkRequest.Builder(BondWorker.class)
                    .setConstraints(constraints())
                    .setInputData(new Data.Builder().putBoolean("hug",true).build())
                    .build()
            );
        }
    }

    public static void cancel(Context c){
        WorkManager wm=WorkManager.getInstance(c);
        wm.cancelUniqueWork(PERIODIC);
        wm.cancelUniqueWork(ONCE);
        wm.cancelUniqueWork("galaxy-moments-hug");
    }

    @Override public Result doWork(){
        synchronized(BondWorker.class){
            Context c=getApplicationContext();
            DeviceStore device=new DeviceStore(c);
            String token=device.token();
            BondStore bond=new BondStore(c);

            if(token==null){
                // pairedFast() may still see stored bytes when AndroidKeyStore can no longer decrypt them.
                // Clear the stale pairing here, safely off the UI thread.
                device.clear();
                return Result.success();
            }

            try{
                if(getInputData().getBoolean("hug",false)){
                    ApiClient.gesture(token,"hug");
                    bond.feedback("Abrazo enviado ♡");
                    BondWidget.updateAll(c);
                }

                JSONObject data=ApiClient.moments(token);
                if(isStopped()||!token.equals(new DeviceStore(c).token()))return Result.success();

                bond.snapshot(data);
                try{
                    downloadPhoto(c,bond,data.optString("photoUrl",""));
                }catch(Exception imageFailure){
                    // Keep the last private image until the next connected refresh.
                }

                if(isStopped()||!token.equals(new DeviceStore(c).token())){
                    bond.clear();
                    return Result.success();
                }

                JSONArray gestures=data.optJSONArray("gestures");
                if(gestures==null)gestures=new JSONArray();
                List<String> fresh=bond.consume(gestures);

                if(token.equals(new DeviceStore(c).token())){
                    for(int i=0;i<gestures.length();i++){
                        JSONObject g=gestures.optJSONObject(i);
                        if(g==null||!fresh.contains(g.optString("id")))continue;
                        String behavior=g.optString("behavior","message");
                        if(("haptic".equals(behavior)||"message_haptic".equals(behavior))&&bond.hapticEnabled())GalaxyFirebaseService.performHaptic(c);
                        if(!"haptic".equals(behavior)&&bond.enabled()&&notificationsAllowed(c))notify(c,g.optString("id"),"Un gesto para ti",gestureText(g));
                    }
                    JSONObject next=data.optJSONObject("nextEvent");
                    if(bond.enabled()&&notificationsAllowed(c)&&next!=null){
                        String today=LocalDate.now(ZoneId.of("America/Bogota")).toString();
                        if(today.equals(next.optString("date"))&&bond.consumeDate(today+":"+next.optString("title"))){
                            notify(c,"date-"+today,"Hoy es un día especial",next.optString("title","Nuestra fecha"));
                        }
                    }
                }

                /*
                 * Date notifications are handled above after gesture/haptic delivery so
                 * haptic-only users do not need to grant notification permission.
                 */
                /* legacy-date-anchor
                    JSONObject next=data.optJSONObject("nextEvent");
                 */
                BondWidget.updateAll(c);
                return Result.success();
            }catch(ApiClient.ApiException e){
                if(e.status==401||e.status==403){
                    device.clear();
                    cancel(c);
                    BondWidget.updateAll(c);
                    return Result.success();
                }
                if(getInputData().getBoolean("hug",false)){
                    bond.feedback(e.status==429?"Espera un momento y vuelve a tocar":"No se confirmó el abrazo. Revisa tu conexión.");
                    BondWidget.updateAll(c);
                    return Result.failure();
                }
                return Result.retry();
            }catch(Exception e){
                if(getInputData().getBoolean("hug",false)){
                    bond.feedback("No se confirmó el abrazo. Revisa tu conexión.");
                    BondWidget.updateAll(c);
                    return Result.failure();
                }
                return Result.retry();
            }
        }
    }

    public static boolean notificationsAllowed(Context c){
        NotificationManager nm=c.getSystemService(NotificationManager.class);
        boolean permission=Build.VERSION.SDK_INT<33||c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
        NotificationChannel channel=nm.getNotificationChannel(CHANNEL);
        return permission&&nm.areNotificationsEnabled()&&(channel==null||channel.getImportance()!=NotificationManager.IMPORTANCE_NONE);
    }

    public static void prepareNotifications(Context c){
        NotificationManager nm=c.getSystemService(NotificationManager.class);
        if(nm.getNotificationChannel("galaxy-moments")!=null)nm.deleteNotificationChannel("galaxy-moments");
        NotificationChannel ch=new NotificationChannel(CHANNEL,"Momentos para dos",NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Gestos y fechas especiales de tu persona en Nuestra Galaxia.");
        ch.enableVibration(true);
        ch.setShowBadge(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        nm.createNotificationChannel(ch);
    }

    public static void testNotification(Context c){
        prepareNotifications(c);
        notify(c,"test-"+System.currentTimeMillis(),"Nuestra Galaxia está lista","Las notificaciones de momentos ya pueden aparecer en este teléfono.");
    }

    private static String gestureText(JSONObject gesture){
        String custom=gesture.optString("text","").trim();
        if(!custom.isEmpty())return custom;
        String id=gesture.optString("gesture","");
        return "kiss".equals(id)?"Tu pareja te envió un beso.":
            "miss".equals(id)?"Tu pareja te extraña.":
            "tap".equals(id)?"Un toque de tu persona.":
            "Tu pareja te envió un abrazo.";
    }

    public static void showPushNotification(Context c,String id,String title,String body){
        if(!notificationsAllowed(c))return;
        notify(c,id,title,body);
    }

    private static void notify(Context c,String id,String title,String body){
        NotificationManager nm=c.getSystemService(NotificationManager.class);
        prepareNotifications(c);
        Intent open=new Intent(c,MainActivity.class);
        PendingIntent pending=PendingIntent.getActivity(c,41,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(c,CHANNEL)
            .setSmallIcon(R.drawable.ic_galaxy)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .build();
        nm.notify(id,410,n);
    }

    private static void downloadPhoto(Context c,BondStore bond,String signedUrl)throws Exception{
        if(signedUrl.trim().isEmpty()||"null".equals(signedUrl)){
            bond.photo().delete();
            return;
        }

        URL remote=new URL(signedUrl),origin=new URL(BuildConfig.SUPABASE_URL);
        if(!"https".equals(remote.getProtocol())||!origin.getHost().equals(remote.getHost())||!remote.getPath().startsWith("/storage/v1/object/sign/galaxy-photos/")){
            bond.photo().delete();
            return;
        }

        File tmp=new File(c.getFilesDir(),"widget-photo.tmp");
        HttpURLConnection connection=(HttpURLConnection)remote.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);

        try{
            int status=connection.getResponseCode();
            if(status>=500)throw new IOException("Foto no disponible temporalmente");
            if(status!=200||connection.getContentLengthLong()>5*1024*1024){
                bond.photo().delete();
                return;
            }

            try(InputStream in=connection.getInputStream();FileOutputStream out=new FileOutputStream(tmp)){
                byte[] buffer=new byte[8192];
                int read,total=0;
                while((read=in.read(buffer))!=-1){
                    total+=read;
                    if(total>5*1024*1024)throw new IOException("Imagen demasiado grande");
                    out.write(buffer,0,read);
                }
            }

            BitmapFactory.Options options=new BitmapFactory.Options();
            options.inJustDecodeBounds=true;
            BitmapFactory.decodeFile(tmp.getAbsolutePath(),options);
            if(options.outWidth<=0||options.outHeight<=0||options.outWidth>30000||options.outHeight>30000){
                bond.photo().delete();
                return;
            }

            options.inJustDecodeBounds=false;
            options.inSampleSize=1;
            while(options.outWidth/options.inSampleSize>512||options.outHeight/options.inSampleSize>512){
                options.inSampleSize*=2;
            }

            Bitmap bitmap=BitmapFactory.decodeFile(tmp.getAbsolutePath(),options);
            if(bitmap==null){
                bond.photo().delete();
                return;
            }

            try(FileOutputStream out=new FileOutputStream(bond.photo())){
                bitmap.compress(Bitmap.CompressFormat.JPEG,85,out);
            }finally{
                bitmap.recycle();
            }
        }finally{
            connection.disconnect();
            tmp.delete();
        }
    }
}
