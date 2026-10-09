package com.nuestragalaxia.companion;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class GalaxyNotifications {
    public static final String CHANNEL_MESSAGES="galaxy-chat-v1";
    public static final String CHANNEL_ACTIVITY="galaxy-activity-v1";
    public static final String CHAT_GROUP="galaxy-chat";
    public static final String ACTION_MARK_READ="com.nuestragalaxia.NOTIFICATION_MARK_READ";
    public static final String ACTION_REPLY="com.nuestragalaxia.NOTIFICATION_REPLY";
    public static final String REMOTE_REPLY="galaxy_reply_text";
    private static final String PREFS="galaxy-chat-notification-state";
    private static final String LEGACY_HISTORY="history";
    private static final String HISTORY_CIPHER="history_cipher";
    private static final String HISTORY_IV="history_iv";
    private static final String HISTORY_KEY_ALIAS="galaxy_chat_notification_history";
    private static final String COUNT="count";
    private static final String SEEN_CHAT_EVENT_KEYS="seen_chat_event_keys";
    private static final int CHAT_NOTIFICATION_ID=320;

    private GalaxyNotifications(){}

    public static boolean allowed(Context context){
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        boolean permission=Build.VERSION.SDK_INT<33||context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
        return permission&&manager!=null&&manager.areNotificationsEnabled();
    }

    public static void prepare(Context context){
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        if(manager==null)return;
        // Remove the legacy plaintext history key from versions prior to 3.3.0.
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().remove(LEGACY_HISTORY).apply();

        NotificationChannel messages=new NotificationChannel(
            CHANNEL_MESSAGES,"Mensajes",NotificationManager.IMPORTANCE_HIGH
        );
        messages.setDescription("Mensajes privados de Galaxy Chat.");
        messages.enableVibration(true);
        messages.setShowBadge(true);
        messages.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(messages);

        NotificationChannel activity=new NotificationChannel(
            CHANNEL_ACTIVITY,"Actividad de Nuestra Galaxia",NotificationManager.IMPORTANCE_DEFAULT
        );
        activity.setDescription("Estados, momentos, mapa, objetivos, recuerdos y actividad compartida.");
        activity.enableVibration(true);
        activity.setShowBadge(true);
        activity.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        manager.createNotificationChannel(activity);
    }

    private static String channel(String eventType){
        return "chat_message".equals(eventType)?CHANNEL_MESSAGES:CHANNEL_ACTIVITY;
    }

    private static PendingIntent openIntent(Context context,String eventType,String id,String action,String entityId){
        String recipient=new DeviceStore(context).person();
        Intent open=new Intent(context,MainActivity.class)
            .setAction("com.nuestragalaxia.OPEN_"+eventType+"_"+id)
            .putExtra("galaxy_recipient_person",recipient)
            .putExtra("galaxy_action",action==null?"":action)
            .putExtra("galaxy_entity_id",entityId==null?"":entityId)
            .putExtra("galaxy_event_type",eventType==null?"":eventType)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int requestCode=(recipient+"|"+eventType+"|"+id).hashCode() & 0x7fffffff;
        return PendingIntent.getActivity(context,requestCode,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent actionIntent(Context context,String action,String entityId,boolean mutable){
        Intent intent=new Intent(context,GalaxyNotificationActionReceiver.class)
            .setAction(action)
            .putExtra("galaxy_entity_id",entityId==null?"":entityId);
        int flags=PendingIntent.FLAG_UPDATE_CURRENT|(mutable?PendingIntent.FLAG_MUTABLE:PendingIntent.FLAG_IMMUTABLE);
        return PendingIntent.getBroadcast(context,Math.abs((action+"|"+entityId).hashCode()),intent,flags);
    }

    private static SecretKey historyKey() throws Exception {
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
        if(!ks.containsAlias(HISTORY_KEY_ALIAS)){
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(
                HISTORY_KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return ((KeyStore.SecretKeyEntry)ks.getEntry(HISTORY_KEY_ALIAS,null)).getSecretKey();
    }

    private static JSONArray readHistory(Context context){
        android.content.SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        try{
            String encrypted=prefs.getString(HISTORY_CIPHER,null),iv=prefs.getString(HISTORY_IV,null);
            if(encrypted==null||iv==null)return new JSONArray();
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,historyKey(),new GCMParameterSpec(128,Base64.decode(iv,Base64.NO_WRAP)));
            byte[] plain=cipher.doFinal(Base64.decode(encrypted,Base64.NO_WRAP));
            return new JSONArray(new String(plain,StandardCharsets.UTF_8));
        }catch(Exception e){
            prefs.edit().remove(HISTORY_CIPHER).remove(HISTORY_IV).apply();
            return new JSONArray();
        }
    }

    private static void writeHistory(Context context,JSONArray history){
        android.content.SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        try{
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,historyKey());
            byte[] encrypted=cipher.doFinal(history.toString().getBytes(StandardCharsets.UTF_8));
            prefs.edit()
                .remove(LEGACY_HISTORY)
                .putString(HISTORY_CIPHER,Base64.encodeToString(encrypted,Base64.NO_WRAP))
                .putString(HISTORY_IV,Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP))
                .apply();
        }catch(Exception e){
            prefs.edit().remove(LEGACY_HISTORY).remove(HISTORY_CIPHER).remove(HISTORY_IV).apply();
        }
    }

    private static JSONArray appendHistory(Context context,String sender,String body){
        android.content.SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        JSONArray old=readHistory(context),next=new JSONArray();
        int start=Math.max(0,old.length()-4);
        for(int i=start;i<old.length();i++)try{next.put(old.getJSONObject(i));}catch(Exception ignored){}
        try{next.put(new JSONObject().put("sender",sender).put("body",body).put("time",System.currentTimeMillis()));}catch(Exception ignored){}
        writeHistory(context,next);
        prefs.edit().putInt(COUNT,Math.min(99,prefs.getInt(COUNT,0)+1)).apply();
        return next;
    }

    public static void resetChat(Context context){
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit().remove(LEGACY_HISTORY).remove(HISTORY_CIPHER).remove(HISTORY_IV).remove(SEEN_CHAT_EVENT_KEYS).putInt(COUNT,0).apply();
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        if(manager!=null)manager.cancel("galaxy-chat",CHAT_NOTIFICATION_ID);
    }

    // One backend event may be retried by FCM. Keep only opaque recipient/event keys,
    // bounded to the most recent 128, and never persist notification text here.
    private static synchronized boolean rememberChatEvent(Context context,String eventId){
        if(eventId==null||eventId.isBlank())return true;
        String person=new DeviceStore(context).person();
        if(!"0".equals(person)&&!"1".equals(person))return false;
        android.content.SharedPreferences prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        JSONArray previous;
        try{previous=new JSONArray(prefs.getString(SEEN_CHAT_EVENT_KEYS,"[]"));}
        catch(Exception ignored){previous=new JSONArray();}
        String key=person+"|"+eventId;
        for(int i=0;i<previous.length();i++)if(key.equals(previous.optString(i)))return false;
        JSONArray recent=new JSONArray();
        for(int i=Math.max(0,previous.length()-127);i<previous.length();i++)
            recent.put(previous.optString(i));
        recent.put(key);
        prefs.edit().putString(SEEN_CHAT_EVENT_KEYS,recent.toString()).apply();
        return true;
    }

    public static void show(
        Context context,String eventType,String id,String title,String body,
        String action,String entityId,String senderName,boolean silent
    ){
        if(!allowed(context))return;
        prepare(context);
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        if(manager==null)return;
        if("chat_message".equals(eventType)&&!rememberChatEvent(context,id))return;

        NotificationCompat.Builder builder=new NotificationCompat.Builder(context,channel(eventType))
            .setSmallIcon(R.drawable.ic_galaxy)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(openIntent(context,eventType,id,action,entityId))
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPriority("chat_message".equals(eventType)?NotificationCompat.PRIORITY_HIGH:NotificationCompat.PRIORITY_DEFAULT)
            .setCategory("chat_message".equals(eventType)?NotificationCompat.CATEGORY_MESSAGE:NotificationCompat.CATEGORY_SOCIAL);
        if(silent)builder.setSilent(true).setOnlyAlertOnce(true);

        if("chat_message".equals(eventType)){
            String sender=senderName==null||senderName.isEmpty()?title:senderName;
            JSONArray history=appendHistory(context,sender,body);
            int count=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getInt(COUNT,1);
            NotificationCompat.MessagingStyle style=new NotificationCompat.MessagingStyle("Tú");
            style.setConversationTitle("Nuestra Galaxia");
            for(int i=0;i<history.length();i++){
                try{
                    JSONObject row=history.getJSONObject(i);
                    style.addMessage(row.optString("body",""),row.optLong("time",System.currentTimeMillis()),row.optString("sender",sender));
                }catch(Exception ignored){}
            }
            RemoteInput replyInput=new RemoteInput.Builder(REMOTE_REPLY).setLabel("Responder").build();
            NotificationCompat.Action replyAction=new NotificationCompat.Action.Builder(
                R.drawable.ic_galaxy,"Responder",actionIntent(context,ACTION_REPLY,entityId,true)
            ).addRemoteInput(replyInput).setAllowGeneratedReplies(true).build();
            NotificationCompat.Action readAction=new NotificationCompat.Action.Builder(
                R.drawable.ic_galaxy,"Marcar leído",actionIntent(context,ACTION_MARK_READ,entityId,false)
            ).build();
            builder.setStyle(style)
                .setGroup(CHAT_GROUP)
                .setNumber(count)
                .setShortcutId("galaxy-chat")
                .addAction(replyAction)
                .addAction(readAction);
            manager.notify("galaxy-chat",CHAT_NOTIFICATION_ID,builder.build());
        }else{
            builder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
            manager.notify("galaxy-"+eventType,id.hashCode(),builder.build());
        }
    }
}
