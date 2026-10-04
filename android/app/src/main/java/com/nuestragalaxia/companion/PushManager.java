package com.nuestragalaxia.companion;

import android.content.Context;
import androidx.work.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.json.JSONObject;

public final class PushManager {
    private static final String SYNC="galaxy-push-token-sync";
    private static final String PREFS="galaxy-push-config";
    private PushManager(){}

    private static String value(Context context,String key,String fallback){
        String stored=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getString(key,"");
        return stored==null||stored.trim().isEmpty()?fallback:stored;
    }

    public static boolean configured(Context context){
        return !value(context,"projectId",BuildConfig.FIREBASE_PROJECT_ID).trim().isEmpty()
            && !value(context,"applicationId",BuildConfig.FIREBASE_APPLICATION_ID).trim().isEmpty()
            && !value(context,"apiKey",BuildConfig.FIREBASE_API_KEY).trim().isEmpty()
            && !value(context,"senderId",BuildConfig.FIREBASE_SENDER_ID).trim().isEmpty();
    }

    public static boolean configured(){
        return !BuildConfig.FIREBASE_PROJECT_ID.trim().isEmpty()
            && !BuildConfig.FIREBASE_APPLICATION_ID.trim().isEmpty()
            && !BuildConfig.FIREBASE_API_KEY.trim().isEmpty()
            && !BuildConfig.FIREBASE_SENDER_ID.trim().isEmpty();
    }

    public static void configure(Context context,JSONObject config){
        if(config==null)return;
        String projectId=config.optString("projectId",""),applicationId=config.optString("applicationId",""),apiKey=config.optString("apiKey",""),senderId=config.optString("senderId","");
        if(projectId.isBlank()||applicationId.isBlank()||apiKey.isBlank()||senderId.isBlank())return;
        context.getSharedPreferences(PREFS,Context.MODE_PRIVATE).edit()
            .putString("projectId",projectId).putString("applicationId",applicationId).putString("apiKey",apiKey).putString("senderId",senderId).apply();
        ensureFirebase(context);
        schedule(context);
    }

    public static boolean ensureFirebase(Context context){
        if(!configured(context))return false;
        try{
            if(FirebaseApp.getApps(context).isEmpty()){
                FirebaseOptions options=new FirebaseOptions.Builder()
                    .setProjectId(value(context,"projectId",BuildConfig.FIREBASE_PROJECT_ID))
                    .setApplicationId(value(context,"applicationId",BuildConfig.FIREBASE_APPLICATION_ID))
                    .setApiKey(value(context,"apiKey",BuildConfig.FIREBASE_API_KEY))
                    .setGcmSenderId(value(context,"senderId",BuildConfig.FIREBASE_SENDER_ID))
                    .build();
                FirebaseApp.initializeApp(context.getApplicationContext(),options);
            }
            return true;
        }catch(Exception ignored){return false;}
    }

    public static void initialize(Context context){
        GalaxyNotifications.prepare(context);
        if(ensureFirebase(context)&&new DeviceStore(context).pairedFast())schedule(context);
    }

    public static void schedule(Context context){
        if(!configured(context)||!new DeviceStore(context).pairedFast())return;
        WorkManager.getInstance(context).enqueueUniqueWork(
            SYNC,ExistingWorkPolicy.REPLACE,
            new OneTimeWorkRequest.Builder(PushSyncWorker.class)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
        );
    }

    public static void onNewToken(Context context,String token){
        if(token==null||token.trim().isEmpty())return;
        schedule(context);
    }

    public static void cancel(Context context){
        WorkManager.getInstance(context).cancelUniqueWork(SYNC);
    }

    public static JSONObject events(Context context){
        BondStore bond=new BondStore(context);
        ContextStore contextPrefs=new ContextStore(context);
        JSONObject value=new JSONObject();
        try{
            value.put("gesture",bond.enabled()||bond.hapticEnabled());
            value.put("arrived_safe",contextPrefs.arrivedSafeEnabled());
            value.put("nearby",contextPrefs.nearbyEnabled());
            value.put("capsule",true);
            value.put("note",true);
            value.put("reminder",true);
            value.put("chat_message",true);
            value.put("status_changed",true);
            value.put("mood_changed",true);
            value.put("daily_answer",true);
            value.put("goal_update",true);
            value.put("memory_shared",true);
            value.put("plan_update",true);
        }catch(Exception ignored){}
        return value;
    }
}
