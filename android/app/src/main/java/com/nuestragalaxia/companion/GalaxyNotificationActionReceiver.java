package com.nuestragalaxia.companion;

import android.content.*;
import androidx.core.app.RemoteInput;
import org.json.JSONObject;
import java.util.UUID;

public final class GalaxyNotificationActionReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        if(intent==null)return;
        String action=intent.getAction(),messageId=intent.getStringExtra("galaxy_entity_id");
        if(!GalaxyNotifications.ACTION_MARK_READ.equals(action)&&!GalaxyNotifications.ACTION_REPLY.equals(action))return;
        PendingResult pending=goAsync();
        Context app=context.getApplicationContext();
        new Thread(()->{
            try{
                BondStore store=new BondStore(app);
                String token=store.token();
                if(token==null||token.isBlank())return;
                if(GalaxyNotifications.ACTION_REPLY.equals(action)){
                    android.os.Bundle input=RemoteInput.getResultsFromIntent(intent);
                    CharSequence raw=input==null?null:input.getCharSequence(GalaxyNotifications.REMOTE_REPLY);
                    String reply=raw==null?"":raw.toString().trim();
                    if(!reply.isEmpty()){
                        MobileApiClient.post(token,new JSONObject()
                            .put("action","chat-send")
                            .put("clientId",UUID.randomUUID().toString())
                            .put("clientCreatedAt",new java.util.Date().toInstant().toString())
                            .put("body",reply)
                            .put("messageType","text"));
                    }
                }
                if(messageId!=null&&!messageId.isBlank()){
                    MobileApiClient.post(token,new JSONObject().put("action","chat-read").put("messageId",messageId));
                }
                GalaxyNotifications.resetChat(app);
                app.sendBroadcast(new Intent("com.nuestragalaxia.CHAT_SYNC").setPackage(app.getPackageName()).putExtra("entityId",messageId==null?"":messageId));
                BondWidget.updateAll(app);
            }catch(Exception ignored){}finally{pending.finish();}
        },"galaxy-notification-action").start();
    }
}
