package com.nuestragalaxia.companion;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.service.notification.StatusBarNotification;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Runs the actual Android notification handler, not an FCM transport mock.
 * Real upstream Firebase delivery (foreground/background) is a separate QA gate.
 */
@RunWith(AndroidJUnit4.class)
public class GalaxyFcmPrivacyDeviceTest {
    private final Context context=ApplicationProvider.getApplicationContext();
    private final DeviceStore device=new DeviceStore(context);
    private final NotificationManager notifications=context.getSystemService(NotificationManager.class);

    @Before public void prepare() throws Exception {
        device.clear();
        notifications.cancelAll();
        if(Build.VERSION.SDK_INT>=33)
            InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(
                context.getPackageName(),Manifest.permission.POST_NOTIFICATIONS);
        GalaxyNotifications.prepare(context);
    }

    @After public void clean() {
        notifications.cancelAll();
        device.clear();
    }

    private Map<String,String> payload(String id) {
        Map<String,String> result=new HashMap<>();
        result.put("eventType","chat_message");
        result.put("eventId",id);
        result.put("title","QA Galaxy");
        result.put("body","Synthetic private notification");
        result.put("action","chat");
        result.put("entityId","50000000-0000-4000-8000-000000000001");
        return result;
    }

    private boolean chatNotificationVisible() {
        for(StatusBarNotification n:notifications.getActiveNotifications())
            if("galaxy-chat".equals(n.getTag())&&n.getId()==320)return true;
        return false;
    }

    @Test public void retriedChatEventDoesNotDuplicateAndAccountSwitchClearsPreviews() throws Exception {
        device.save("qa-only-token-0","0","Synthetic QA Member A");
        android.content.SharedPreferences prefs=context.getSharedPreferences(
            "galaxy-chat-notification-state",Context.MODE_PRIVATE);
        String duplicateId="qa-duplicate-"+UUID.randomUUID();
        GalaxyFirebaseService.handleIncoming(context,payload(duplicateId));
        assertEquals("First delivery did not record exactly one chat message",1,prefs.getInt("count",-1));
        GalaxyFirebaseService.handleIncoming(context,payload(duplicateId));
        assertEquals("FCM retry appended a duplicate chat notification",1,prefs.getInt("count",-1));
        GalaxyFirebaseService.handleIncoming(context,payload("qa-next-"+UUID.randomUUID()));
        assertEquals("A different event was incorrectly suppressed",2,prefs.getInt("count",-1));

        device.setPerson("1");
        assertEquals("Profile switch retained previous chat preview count",0,prefs.getInt("count",-1));
        assertFalse("Profile switch retained encrypted history",prefs.contains("history_cipher"));
        GalaxyFirebaseService.handleIncoming(context,payload("qa-new-profile-"+UUID.randomUUID()));
        assertEquals("New profile inherited old notification history",1,prefs.getInt("count",-1));

        device.clear();
        assertEquals("Unpair retained message count",0,prefs.getInt("count",-1));
        assertFalse("Unpair retained encrypted message preview",prefs.contains("history_cipher"));
        assertFalse("Unpair retained event-id cache",prefs.contains("seen_chat_event_keys"));
    }

    @Test public void inFlightPushAfterUnpair_cannotRevealPrivateNotification() throws Exception {
        assertFalse(device.pairedFast());
        GalaxyFirebaseService.handleIncoming(context,payload("qa-unpaired"));
        assertFalse("Unpaired phone displayed private push",chatNotificationVisible());

        device.save("qa-token-0","0","QA Member");
        assertTrue(device.pairedFast());
        assertTrue("Notification permission unavailable for QA",GalaxyNotifications.allowed(context));
        GalaxyFirebaseService.handleIncoming(context,payload("qa-paired"));
        // NotificationManager.notify() is asynchronous. Observe the actual
        // notification rather than checking immediately after the binder call.
        long postedDeadline=android.os.SystemClock.elapsedRealtime()+5_000;
        while(!chatNotificationVisible()&&android.os.SystemClock.elapsedRealtime()<postedDeadline)
            android.os.SystemClock.sleep(100);
        assertTrue("Paired device did not create chat notification",chatNotificationVisible());

        StatusBarNotification[] active=notifications.getActiveNotifications();
        boolean hasOpenIntent=false;
        for(StatusBarNotification n:active)
            if("galaxy-chat".equals(n.getTag())&&n.getNotification().contentIntent!=null)
                hasOpenIntent=true;
        assertTrue("Chat notification has no Android deep link PendingIntent",hasOpenIntent);

        device.clear(); // requests async NotificationManager.cancelAll
        assertFalse(device.pairedFast());

        // Let Android finish removing the previous paired notification before
        // sending another FCM payload. Otherwise we cannot distinguish a late
        // notification from one that was already queued for cancellation.
        long deadline=android.os.SystemClock.elapsedRealtime()+5_000;
        while(chatNotificationVisible()&&android.os.SystemClock.elapsedRealtime()<deadline)
            android.os.SystemClock.sleep(100);
        assertFalse("Previous paired notification was not cancelled by unpair",
            chatNotificationVisible());

        GalaxyFirebaseService.handleIncoming(context,payload("qa-revoked"));
        android.os.SystemClock.sleep(300);
        assertFalse("Late push was shown after account unpair",chatNotificationVisible());
    }
}
