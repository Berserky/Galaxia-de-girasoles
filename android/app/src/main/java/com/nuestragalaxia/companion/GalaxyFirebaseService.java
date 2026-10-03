package com.nuestragalaxia.companion;

import android.content.Context;
import android.os.*;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import java.util.Set;

public final class GalaxyFirebaseService extends FirebaseMessagingService {
    private static final Set<String> EVENTS=Set.of("gesture","arrived_safe","nearby","capsule","note","reminder");

    @Override public void onNewToken(String token){
        super.onNewToken(token);
        PushManager.onNewToken(getApplicationContext(),token);
    }

    @Override public void onMessageReceived(RemoteMessage message){
        Map<String,String> data=message.getData();
        String eventType=data.getOrDefault("eventType","");
        if(!EVENTS.contains(eventType))return;

        BondStore bond=new BondStore(this);
        String behavior=data.getOrDefault("behavior","message");
        String gestureHistoryId=data.getOrDefault("gestureId","");
        if("gesture".equals(eventType)&&!gestureHistoryId.isEmpty())bond.markSeen(gestureHistoryId);

        if(("haptic".equals(behavior)||"message_haptic".equals(behavior))&&bond.hapticEnabled())vibrate(this);

        boolean messageAllowed=!"haptic".equals(behavior);
        if(messageAllowed&&bond.enabled()&&BondWorker.notificationsAllowed(this)){
            String title=data.getOrDefault("title","Nuestra Galaxia");
            String body=data.getOrDefault("body","Hay algo nuevo para ti.");
            String id=data.getOrDefault("eventId",String.valueOf(System.currentTimeMillis()));
            BondWorker.showPushNotification(this,id,title,body);
        }
        BondWidget.updateAll(this);
    }

    private static void vibrate(Context context){
        try{
            VibrationEffect effect=VibrationEffect.createOneShot(90,VibrationEffect.DEFAULT_AMPLITUDE);
            if(Build.VERSION.SDK_INT>=31){
                VibratorManager manager=context.getSystemService(VibratorManager.class);
                if(manager!=null)manager.getDefaultVibrator().vibrate(effect);
            }else{
                Vibrator vibrator=context.getSystemService(Vibrator.class);
                if(vibrator!=null&&vibrator.hasVibrator())vibrator.vibrate(effect);
            }
        }catch(Exception ignored){}
    }
}
