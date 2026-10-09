package com.nuestragalaxia.companion;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Hermetic GPS consent/revocation checks. Never enables location or writes a real fix. */
@RunWith(AndroidJUnit4.class)
public class GalaxyGpsConsentDeviceTest {
    private final Context context=ApplicationProvider.getApplicationContext();
    private final DeviceStore device=new DeviceStore(context);

    @Before public void prepare() { device.clear(); }
    @After public void cleanup() { device.clear(); }

    @Test public void gpsStartsDisabled_andUnpairedRequestCannotTurnSharingOn() {
        assertFalse("Fresh install must never share location",device.tracking());
        assertFalse(device.pairedFast());
        try(ActivityScenario<MainActivity> activity=ActivityScenario.launch(MainActivity.class)){
            activity.onActivity(a->a.startLocation(null));
            assertFalse("Unpaired profile enabled GPS sharing",device.tracking());
        }
        assertFalse(device.tracking());
    }

    @Test public void unpairErasesOfflineGpsHistoryBeforeAnotherIdentityPairs() throws Exception {
        try(PendingPointStore queued=new PendingPointStore(context)){
            queued.clear();
            device.save("qa-only-token-0","0","Synthetic profile A");
            queued.add(java.util.UUID.randomUUID().toString(),"2026-10-09T00:00:00Z",
                4.6000,-74.1000,5.0,0.0,0.0,"still");
            assertTrue("Synthetic offline location was not queued",queued.count()>0);
            device.clear();
            assertEquals("Unpair left previous account coordinates in the offline queue",0,queued.count());
            device.save("qa-only-token-1","1","Synthetic profile B");
            assertEquals("New pairing inherited another user's GPS backlog",0,queued.count());
        }
    }

    @Test public void unpairRevokesStoredGpsConsent() throws Exception {
        device.save("qa-token-only", "0", "QA device");
        assertTrue(device.pairedFast());
        assertFalse("Pairing must never imply GPS consent",device.tracking());
        device.setTracking(true); // simulate persisted user opt-in without starting GPS
        assertTrue(device.tracking());
        device.clear();
        assertFalse("Unpair retained GPS consent",device.tracking());
        assertFalse(device.pairedFast());
    }
}
