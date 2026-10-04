package com.nuestragalaxia.companion;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public final class GalaxyNotifications {
    public static final String CHANNEL_MESSAGES="galaxy-chat-v1";
    public static final String CHANNEL_ACTIVITY="galaxy-activity-v1";

    private GalaxyNotifications(){}

    public static boolean allowed(Context context){
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        boolean permission=Build.VERSION.SDK_INT<33||context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
        return permission&&manager!=null&&manager.areNotificationsEnabled();
    }

    public static void prepare(Context context){
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        if(manager==null)return;

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
        Intent open=new Intent(context,MainActivity.class)
            .setAction("com.nuestragalaxia.OPEN_"+eventType+"_"+id)
            .putExtra("galaxy_action",action==null?"":action)
            .putExtra("galaxy_entity_id",entityId==null?"":entityId)
            .putExtra("galaxy_event_type",eventType==null?"":eventType)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int requestCode=Math.abs((eventType+"|"+id).hashCode());
        return PendingIntent.getActivity(context,requestCode,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }

    public static void show(
        Context context,String eventType,String id,String title,String body,
        String action,String entityId,String senderName
    ){
        if(!allowed(context))return;
        prepare(context);
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        if(manager==null)return;

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

        if("chat_message".equals(eventType)){
            NotificationCompat.MessagingStyle style=new NotificationCompat.MessagingStyle("Tú");
            style.setConversationTitle("Nuestra Galaxia");
            style.addMessage(body,System.currentTimeMillis(),senderName==null||senderName.isEmpty()?title:senderName);
            builder.setStyle(style);
        }else{
            builder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
        }

        manager.notify("galaxy-"+eventType,id.hashCode(),builder.build());
    }
}
