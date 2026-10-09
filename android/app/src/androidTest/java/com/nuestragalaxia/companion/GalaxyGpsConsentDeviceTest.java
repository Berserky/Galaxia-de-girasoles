package com.nuestragalaxia.companion;

import static org.junit.Assert.assertFalse;
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
