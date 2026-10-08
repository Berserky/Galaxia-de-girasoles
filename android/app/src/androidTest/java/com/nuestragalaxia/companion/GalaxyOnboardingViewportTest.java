package com.nuestragalaxia.companion;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.app.Instrumentation;
import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.webkit.WebView;

import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/** NG-AUD-003: checks the real first viewport, rather than only parsing CSS/HTML. */
@RunWith(AndroidJUnit4.class)
public class GalaxyOnboardingViewportTest {
    private static final long WAIT_MS = 30_000;
    private final Context context = ApplicationProvider.getApplicationContext();
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private ActivityScenario<MainActivity> scenario;

    @After public void cleanUp() {
        if (scenario != null) {
            try { scenario.close(); } catch (Exception ignored) {}
            scenario = null;
        }
        new DeviceStore(context).clear();
        try { shell("settings put system accelerometer_rotation 1"); } catch (Exception ignored) {}
    }

    @Test public void unpairedPortraitLandscape_haveVisibleLabeledPairingControls() throws Exception {
        // The QA application ID suffix isolates this test from the installed stable app.
        new DeviceStore(context).clear();
        shell("settings put system accelerometer_rotation 0");
        scenario = ActivityScenario.launch(MainActivity.class);
        scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        awaitOrientation(Configuration.ORIENTATION_PORTRAIT);
        awaitOnboarding();

        JSONObject portrait = layout();
        assertEquals("portrait", portrait.getString("orientation"));
        assertTrue("Pairing form must be visible in portrait", portrait.getBoolean("formPresent"));
        assertTrue("Pairing input label is not associated", portrait.getBoolean("labelLinked"));
        assertTrue("Pairing code must be required", portrait.getBoolean("required"));
        assertFalse("Portrait viewport must not have horizontal overflow", portrait.getBoolean("horizontalOverflow"));
        screenshot("portrait");

        // Orientation change exercises the real WebView, not an artificial CSS viewport.
        scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
        awaitOrientation(Configuration.ORIENTATION_LANDSCAPE);
        awaitOnboarding();
        JSONObject landscape = layout();
        assertEquals("landscape", landscape.getString("orientation"));
        assertTrue("Landscape pairing form disappeared", landscape.getBoolean("formPresent"));
        assertTrue("Landscape input label disconnected", landscape.getBoolean("labelLinked"));
        assertTrue("Landscape code input must be required", landscape.getBoolean("required"));
        assertFalse("Landscape has horizontal overflow", landscape.getBoolean("horizontalOverflow"));
        assertTrue("Pairing code is not in the first landscape viewport: " + landscape,
            landscape.getBoolean("codeVisibleFirstViewport"));
        assertTrue("Pairing CTA is not in the first landscape viewport: " + landscape,
            landscape.getBoolean("ctaVisibleFirstViewport"));
        assertTrue("Pairing CTA target is too small: " + landscape,
            landscape.getDouble("ctaHeight") >= 40.0);
        screenshot("landscape");

        // Verify it is a usable real input after rotation. No token is entered/sent.
        assertTrue("Pairing code could not receive focus",
            "true".equals(js("(()=>{const i=document.querySelector('#pairCode');i.focus();return document.activeElement===i})()")));
        System.out.println("NG_AUD_003_ANDROID=" + new JSONObject()
            .put("result", "VERIFIED")
            .put("portrait", portrait)
            .put("landscape", landscape));
    }

    private void awaitOnboarding() throws Exception {
        long stop = SystemClock.elapsedRealtime() + WAIT_MS;
        while (SystemClock.elapsedRealtime() < stop) {
            if ("true".equals(js("!!document.querySelector('.onboarding #pairForm #pairCode')"))) return;
            SystemClock.sleep(200);
        }
        throw new AssertionError("Onboarding pairing form did not load");
    }

    private void awaitOrientation(int expected) {
        long stop = SystemClock.elapsedRealtime() + WAIT_MS;
        while (SystemClock.elapsedRealtime() < stop) {
            AtomicInteger actual = new AtomicInteger(-1);
            scenario.onActivity(a -> actual.set(a.getResources().getConfiguration().orientation));
            if (actual.get() == expected) return;
            SystemClock.sleep(150);
        }
        throw new AssertionError("Android orientation change timed out: " + expected);
    }

    private JSONObject layout() throws Exception {
        String expression = "JSON.stringify((()=>{"
            + "const form=document.querySelector('#pairForm'),code=document.querySelector('#pairCode'),"
            + "cta=form?.querySelector('button[type=submit]'),label=document.querySelector('label[for=pairCode]');"
            + "const inside=(el)=>{if(!el)return false;const r=el.getBoundingClientRect();"
            + "return r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1"
            + "&&r.top>=-1&&r.bottom<=innerHeight+1};"
            + "return {orientation:innerWidth>innerHeight?'landscape':'portrait',"
            + "width:innerWidth,height:innerHeight,formPresent:!!form,"
            + "labelLinked:!!label&&label.control===code,required:!!code?.required,"
            + "horizontalOverflow:document.documentElement.scrollWidth>innerWidth+3,"
            + "codeVisibleFirstViewport:inside(code),ctaVisibleFirstViewport:inside(cta),"
            + "ctaHeight:cta?.getBoundingClientRect().height||0};"
            + "})())";
        return new JSONObject(js(expression));
    }

    private String js(String expression) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<String> raw = new AtomicReference<>();
        scenario.onActivity(a -> {
            WebView web = a.findViewById(R.id.webView);
            web.evaluateJavascript("(function(){try{return (" + expression
                + ");}catch(e){return 'ERR:'+e.message;}})()", value -> {
                raw.set(value);
                latch.countDown();
            });
        });
        assertTrue("WebView JS timed out", latch.await(5, TimeUnit.SECONDS));
        String response = raw.get();
        if (response == null || "null".equals(response)) return "";
        Object decoded = new JSONArray("[" + response + "]").get(0);
        return decoded == JSONObject.NULL ? "" : String.valueOf(decoded);
    }

    private void screenshot(String orientation) throws Exception {
        // Only the blank, unpaired screen is captured; never a token or private chat.
        shell("screencap -p /sdcard/Download/NG-AUD-003-onboarding-" + orientation + ".png");
    }

    private String shell(String command) throws Exception {
        ParcelFileDescriptor fd = instrumentation.getUiAutomation().executeShellCommand(command);
        try (FileInputStream in = new FileInputStream(fd.getFileDescriptor());
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[4096];
            int n;
            while ((n = in.read(bytes)) != -1) out.write(bytes, 0, n);
            return out.toString(StandardCharsets.UTF_8);
        } finally {
            fd.close();
        }
    }
}
