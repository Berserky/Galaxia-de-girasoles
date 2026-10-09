package com.nuestragalaxia.companion;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertFalse;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;

import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;

import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Assume;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Real FCM provider QA gate. It MUST run in the authorized qa-push RC workflow.
 * Local/PR emulator suites without ephemeral OIDC credentials skip this class;
 * the RC evidence script rejects a skipped or absent required test.
 */
@RunWith(AndroidJUnit4.class)
public class GalaxyFcmTransportQaTest {
    private final Context context=ApplicationProvider.getApplicationContext();
    private final DeviceStore device=new DeviceStore(context);
    private final NotificationManager notifications=context.getSystemService(NotificationManager.class);
    private final List<String> createdMessages=new ArrayList<>();
    private String token0="",token1="";

    @Before public void prepare(){
        var args=InstrumentationRegistry.getArguments();
        token0=args.getString("ngQaToken0","");
        token1=args.getString("ngQaToken1","");
        Assume.assumeTrue("Real FCM transport only runs with OIDC ephemeral QA identities",
            !token0.isBlank()&&!token1.isBlank()&&!token0.equals(token1));
        device.clear();
        notifications.cancelAll();
        if(Build.VERSION.SDK_INT>=33)
            InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                context.getPackageName(),Manifest.permission.POST_NOTIFICATIONS);
    }

    @After public void cleanup(){
        for(String id:createdMessages){
            try{MobileApiClient.post(token1,new JSONObject().put("action","chat-delete").put("id",id).put("scope","both"));}
            catch(Exception ignored){}
        }
        if(!token0.isBlank())try{ApiClient.pushUnregister(token0);}catch(Exception ignored){}
        notifications.cancelAll();
        device.clear();
    }

    private boolean hasChatNotification(){
        for(StatusBarNotification n:notifications.getActiveNotifications())
            if("galaxy-chat".equals(n.getTag())&&n.getNotification().contentIntent!=null)return true;
        return false;
    }
    private void awaitChatNotification(String stage,long timeoutMs){
        long limit=SystemClock.elapsedRealtime()+timeoutMs;
        while(SystemClock.elapsedRealtime()<limit){
            if(hasChatNotification())return;
            SystemClock.sleep(400);
        }
        throw new AssertionError("Real FCM delivery did not post Android chat notification: "+stage);
    }
    private void sendSyntheticChat(String stage) throws Exception {
        JSONObject result=MobileApiClient.post(token1,new JSONObject()
            .put("action","chat-send")
            .put("clientId",UUID.randomUUID().toString())
            .put("clientCreatedAt",java.time.Instant.now().toString())
            .put("body","[QA FCM] "+stage+" "+UUID.randomUUID())
            .put("messageType","text")
            .put("attachments",new org.json.JSONArray()));
        String id=result.getJSONObject("message").getString("id");
        createdMessages.add(id);
    }

    @Test public void realFirebasePush_foregroundBackgroundAndRevocation() throws Exception {
        JSONObject response=MobileApiClient.post(token0,new JSONObject().put("action","push-client-config"));
        assertTrue("QA Firebase server config missing",response.optBoolean("available",false));
        JSONObject config=response.getJSONObject("config");
        device.save(token0,"0","FCM ephemeral QA");
        PushManager.configure(context,config);
        assertTrue(PushManager.ensureFirebase(context));
        String actualFcmToken=Tasks.await(FirebaseMessaging.getInstance().getToken(),90,TimeUnit.SECONDS);
        assertNotNull(actualFcmToken);
        assertTrue("Firebase Installations returned no registration token",actualFcmToken.length()>=20);
        JSONObject registered=ApiClient.pushRegister(token0,actualFcmToken,PushManager.events(context));
        assertTrue("QA FCM registration failed",registered.optBoolean("ok",false));
        assertTrue("Android notification permission unavailable",GalaxyNotifications.allowed(context));

        try(ActivityScenario<MainActivity> activity=ActivityScenario.launch(MainActivity.class)){
            notifications.cancelAll();
            sendSyntheticChat("foreground");
            awaitChatNotification("foreground",90_000L);
            notifications.cancelAll();

            UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressHome();
            SystemClock.sleep(650);
            sendSyntheticChat("background");
            awaitChatNotification("background",90_000L);
            assertTrue("FCM notification must navigate to the chat",hasChatNotification());

            ApiClient.pushUnregister(token0);
            device.clear();
            notifications.cancelAll();
            assertFalse("Device still linked after revocation",device.pairedFast());
            sendSyntheticChat("after-revocation");
            SystemClock.sleep(8_000);
            assertFalse("Revoked phone displayed a late private push",hasChatNotification());
        }
        System.out.println("GALAXY_F4_FCM_TRANSPORT=VERIFIED;foreground=PASS;background=PASS;revocation=PASS");
    }
}
