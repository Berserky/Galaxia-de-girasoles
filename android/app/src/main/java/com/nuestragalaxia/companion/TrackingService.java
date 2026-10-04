package com.nuestragalaxia.companion;

import android.*;
import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.location.Location;
import android.os.*;
import com.google.android.gms.location.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

public final class TrackingService extends Service {
    public static final String ACTION_START="com.nuestragalaxia.companion.START",ACTION_STOP="com.nuestragalaxia.companion.STOP";
    private static final int NOTIFICATION_ID=42;
    private FusedLocationProviderClient fused;
    private LocationCallback callback;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private MotionClassifier classifier;
    private PendingPointStore pending;
    private DeviceStore store;
    private long lastHistory=0,lastTrip=0,lastMoments=0,lastUpload=0;

    @Override public void onCreate(){
        super.onCreate(); fused=LocationServices.getFusedLocationProviderClient(this); classifier=new MotionClassifier(); pending=new PendingPointStore(this); store=new DeviceStore(this); createChannel();
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null&&ACTION_STOP.equals(intent.getAction())){stopTracking();return START_NOT_STICKY;}
        startVisible("Preparando GPS…");
        if(!hasLocationPermission()){
            updateNotification("Falta permiso de ubicación"); store.setTracking(false); stopSelf(); return START_NOT_STICKY;
        }
        if(!store.paired()){updateNotification("Vincula este teléfono primero");stopSelf();return START_NOT_STICKY;}
        store.setTracking(true); requestLocations(); return START_STICKY;
    }
    private boolean hasLocationPermission(){
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
            ||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
    }
    private void requestLocations(){
        if(callback!=null)return;
        if(!hasLocationPermission()){
            store.setTracking(false);
            updateNotification("Falta permiso de ubicación");
            stopSelf();
            return;
        }
        LocationRequest request=new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY,5000)
            .setMinUpdateIntervalMillis(3000).setMaxUpdateDelayMillis(10000).setMinUpdateDistanceMeters(2).build();
        callback=new LocationCallback(){@Override public void onLocationResult(LocationResult result){Location loc=result.getLastLocation();if(loc!=null)handle(loc);}};
        try{
            fused.requestLocationUpdates(request,callback,getMainLooper());
        }catch(SecurityException e){
            callback=null;
            store.setTracking(false);
            updateNotification("Android retiró el permiso de ubicación");
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }
    private void handle(Location loc){
        MotionClassifier.Result m=classifier.classify(loc);
        long now=System.currentTimeMillis();
        boolean still="still".equals(m.motion);
        long historyEvery=still?60000:15000,contextEvery=still?30000:15000,uploadEvery=still?30000:10000;
        boolean history=now-lastHistory>=historyEvery,tripPoint=now-lastTrip>=contextEvery;
        if(now-lastMoments>=120000&&new BondStore(this).enabled()){lastMoments=now;BondWorker.refresh(getApplicationContext());}
        updateNotification(label(m.motion,m.speedMs,pending.count()));
        boolean shouldUpload=history||tripPoint||now-lastUpload>=uploadEvery;
        if(!shouldUpload)return;
        lastUpload=now;if(history)lastHistory=now;if(tripPoint)lastTrip=now;
        double heading=loc.hasBearing()?loc.getBearing():-1,accuracy=loc.hasAccuracy()?loc.getAccuracy():-1;
        String captured=Instant.ofEpochMilli(loc.getTime()>0?loc.getTime():now).toString(),sampleId=UUID.randomUUID().toString();
        io.execute(()->{
            String token=store.token(); if(token==null)return;
            try{
                ApiClient.location(token,loc.getLatitude(),loc.getLongitude(),accuracy,m.speedMs,heading,m.motion,history,tripPoint,captured,sampleId);
                flush(token);
            }catch(Exception e){
                if(e instanceof ApiClient.ApiException && ((ApiClient.ApiException)e).status==401){
                    store.clear();
                    if(callback!=null){fused.removeLocationUpdates(callback);callback=null;}
                    stopForeground(STOP_FOREGROUND_REMOVE);
                    stopSelf();
                    return;
                }
                if(history)pending.add(sampleId,captured,loc.getLatitude(),loc.getLongitude(),accuracy,m.speedMs,heading,m.motion);
                updateNotification("Sin conexión · "+pending.count()+" puntos pendientes");
            }
        });
    }
    private void flush(String token){
        for(PendingPointStore.Point p:pending.batch(50)){
            try{ApiClient.history(token,p);pending.remove(p.id);}catch(Exception e){break;}
        }
    }
    private String label(String motion,double speed,int queued){
        String name="still".equals(motion)?"Quieto":"walking".equals(motion)?"Caminando":"En movimiento";
        return name+" · "+Math.round(speed*3.6)+" km/h"+(queued>0?" · "+queued+" pendientes":"");
    }
    private void stopTracking(){
        store.setTracking(false);
        if(callback!=null){fused.removeLocationUpdates(callback);callback=null;}
        String token=store.token();if(token!=null)io.execute(()->{try{ApiClient.stop(token);}catch(Exception ignored){}});
        stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();
    }
    private void createChannel(){
        NotificationChannel ch=new NotificationChannel("galaxy_location","Ubicación compartida",NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Visible mientras Nuestra Galaxia comparte tu ubicación.");
        getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
    private Notification notification(String text){
        Intent open=new Intent(this,MainActivity.class);
        PendingIntent openPi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stop=new Intent(this,TrackingService.class).setAction(ACTION_STOP);
        PendingIntent stopPi=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this,"galaxy_location").setSmallIcon(com.nuestragalaxia.companion.R.drawable.ic_location)
            .setContentTitle("Nuestra Galaxia · ubicación activa").setContentText(text).setContentIntent(openPi)
            .setOngoing(true).setCategory(Notification.CATEGORY_SERVICE).addAction(0,"Detener",stopPi).build();
    }
    private void startVisible(String text){
        Notification n=notification(text);
        if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION_ID,n,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);else startForeground(NOTIFICATION_ID,n);
    }
    private void updateNotification(String text){getSystemService(NotificationManager.class).notify(NOTIFICATION_ID,notification(text));}
    @Override public void onDestroy(){if(callback!=null)fused.removeLocationUpdates(callback);io.shutdown();pending.close();super.onDestroy();}
    @Override public android.os.IBinder onBind(Intent intent){return null;}
}
