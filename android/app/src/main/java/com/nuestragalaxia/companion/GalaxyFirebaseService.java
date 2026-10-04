package com.nuestragalaxia.companion;

import android.content.Context;
import android.content.Intent;
import android.os.*;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import java.util.Set;

public final class GalaxyFirebaseService extends FirebaseMessagingService {
    private static final Set<String> EVENTS=Set.of("gesture","arrived_safe","nearby","capsule","note","reminder","chat_message","chat_sync","status_changed","mood_changed","daily_answer","goal_update","memory_shared","plan_update");

    @Override public void onNewToken(String token){
        super.onNewToken(token);
        PushManager.onNewToken(getApplicationContext(),token);
    }

    @Override public void onMessageReceived(RemoteMessage message){
        Map<String,String> data=message.getData();
        String eventType=data.getOrDefault("eventType","");
        if(!EVENTS.contains(eventType))return;
        if("chat_message".equals(eventType)||"chat_sync".equals(eventType)){
            Intent sync=new Intent("com.nuestragalaxia.CHAT_SYNC").setPackage(getPackageName());
            sync.putExtra("entityId",data.getOrDefault("entityId",""));
            sendBroadcast(sync);
            if("chat_sync".equals(eventType)){BondWidget.updateAll(this);return;}
        }

        BondStore bond=new BondStore(this);
        String behavior=data.getOrDefault("behavior","message");
        String gestureHistoryId=data.getOrDefault("gestureId","");
        boolean duplicate="gesture".equals(eventType)&&!gestureHistoryId.isEmpty()&&bond.hasSeen(gestureHistoryId);
        if("gesture".equals(eventType)&&!gestureHistoryId.isEmpty())bond.markSeen(gestureHistoryId);
        if(duplicate){BondWidget.updateAll(this);return;}

        if(("haptic".equals(behavior)||"message_haptic".equals(behavior))&&bond.hapticEnabled())performHaptic(this);

        boolean messageAllowed=!"haptic".equals(behavior);
        String title=data.getOrDefault("title","Nuestra Galaxia");
        String body=data.getOrDefault("body","Hay algo nuevo para ti.");
        String id=data.getOrDefault("eventId",String.valueOf(System.currentTimeMillis()));
        if(messageAllowed){
            if("gesture".equals(eventType)){
                if(bond.enabled()&&GalaxyNotifications.allowed(this)){
                    GalaxyNotifications.show(this,eventType,id,title,body,data.getOrDefault("action","moments"),data.getOrDefault("entityId",""),data.getOrDefault("senderName",title));
                }
            }else if(GalaxyNotifications.allowed(this)){
                GalaxyNotifications.show(this,eventType,id,title,body,data.getOrDefault("action","home"),data.getOrDefault("entityId",""),data.getOrDefault("senderName",title));
            }
        }
        BondWidget.updateAll(this);
    }

    public static void performHaptic(Context context){
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
