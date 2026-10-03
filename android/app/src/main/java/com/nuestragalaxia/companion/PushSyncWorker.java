package com.nuestragalaxia.companion;

import android.content.Context;
import androidx.work.*;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.concurrent.TimeUnit;

public final class PushSyncWorker extends Worker {
    public PushSyncWorker(Context context,WorkerParameters params){super(context,params);}

    @Override public Result doWork(){
        Context context=getApplicationContext();
        DeviceStore device=new DeviceStore(context);
        if(!device.pairedFast()||!PushManager.ensureFirebase(context))return Result.success();
        String pairingToken=device.token();
        if(pairingToken==null){device.clear();return Result.success();}
        try{
            String fcmToken=Tasks.await(FirebaseMessaging.getInstance().getToken(),20,TimeUnit.SECONDS);
            if(fcmToken==null||fcmToken.trim().isEmpty())return Result.retry();
            ApiClient.pushRegister(pairingToken,fcmToken,PushManager.events(context));
            return Result.success();
        }catch(ApiClient.ApiException e){
            if(e.status==401||e.status==403){device.clear();BondWorker.cancel(context);return Result.success();}
            return Result.retry();
        }catch(Exception e){
            return Result.retry();
        }
    }
}
