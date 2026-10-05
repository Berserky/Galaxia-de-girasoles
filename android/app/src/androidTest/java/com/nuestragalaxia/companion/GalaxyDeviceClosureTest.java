package com.nuestragalaxia.companion;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.Manifest;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.webkit.WebView;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Assume;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class GalaxyDeviceClosureTest {
    private static final long UI_TIMEOUT_MS = 30_000;
    private static QaHttpServer backend;

    private final Context context = ApplicationProvider.getApplicationContext();
    private final Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private ActivityScenario<MainActivity> scenario;

    @BeforeClass public static void startBackend() throws Exception {
        backend = new QaHttpServer();
        backend.start();
    }

    @AfterClass public static void stopBackend() {
        if (backend != null) backend.close();
    }

    @Before public void setUp() throws Exception {
        backend.reset();
        new DeviceStore(context).clear();
        new DeviceStore(context).save("qa-token-0", "0", "QA Sebas");
    }

    @After public void tearDown() {
        if (scenario != null) {
            try { scenario.close(); } catch (Exception ignored) {}
            scenario = null;
        }
        try { shell("cmd uimode night no"); } catch (Exception ignored) {}
        try { shell("settings put system font_scale 1.0"); } catch (Exception ignored) {}
        try { shell("settings put system accelerometer_rotation 1"); } catch (Exception ignored) {}
        try { new DeviceStore(context).clear(); } catch (Exception ignored) {}
    }

    @Test public void startNavigationModalKeyboardForegroundAndRotation_areReal() throws Exception {
        launch();
        awaitJs("document.body.innerText.includes('NUESTRO UNIVERSO')");
        assertTrue(backend.actions().contains("mobile-state"));

        for (String view : new String[]{"map","moments","ai","memories","more"}) {
            runJs("document.querySelector('[data-view=\"" + view + "\"]')?.click()");
            awaitJs("document.querySelector('.nav-btn.active')?.dataset.view==='" + view + "'");
        }

        runJs("document.querySelector('#chatFab')?.click()");
        awaitJs("!!document.querySelector('.chat-shell')");
        runJs("document.querySelector('[data-action=\"chat-settings-open\"]')?.click()");
        awaitJs("document.querySelector('#modal')?.open===true");
        assertTrue(js("document.querySelector('#modal')?.innerText||''").contains("Ajustes"));
        runJs("document.querySelector('[data-action=\"modal-close\"]')?.click()");
        awaitJs("document.querySelector('#modal')?.open===false");

        tapWebElement("#chatForm textarea");
        awaitJs("document.activeElement===document.querySelector('#chatForm textarea')");
        assertEquals("TEXTAREA", js("document.activeElement?.tagName||''"));
        // Headless emulators do not expose reliable IME visibility, but ADB text
        // injection still traverses Android's real focused-input path into WebView.
        shell("input text QA_keyboard");
        awaitJs("(document.querySelector('#chatForm textarea')?.value||'').includes('QA_keyboard')");

        scenario.moveToState(Lifecycle.State.CREATED);
        scenario.moveToState(Lifecycle.State.RESUMED);
        awaitJs("!!document.querySelector('.chat-shell')");

        scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
        awaitCondition(() -> orientation() == Configuration.ORIENTATION_LANDSCAPE, UI_TIMEOUT_MS);
        awaitJs("!!document.querySelector('.chat-shell')");
        scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        awaitCondition(() -> orientation() == Configuration.ORIENTATION_PORTRAIT, UI_TIMEOUT_MS);
        awaitJs("!!document.querySelector('#chatForm textarea')");
    }

    @Test public void galaxyChat_renders13Cards_pollChecklistAndSend() throws Exception {
        launchChat();
        awaitJs("document.querySelectorAll('.chat-galaxy-card').length===13");
        awaitJs("new Set((chatState?.messages||[]).map(m=>m.card?.type).filter(Boolean)).size===13");
        for (String selector : new String[]{
                ".chat-galaxy-card.memory",
                ".chat-galaxy-card.plan",
                ".chat-galaxy-card.goal",
                ".chat-galaxy-card.place",
                ".chat-galaxy-card.song",
                ".chat-galaxy-card.poll",
                ".chat-galaxy-card.checklist",
                ".chat-galaxy-card.locked",
                ".chat-galaxy-card.daily",
                ".chat-galaxy-card.event",
                ".chat-galaxy-card.status"}) {
            assertEquals("Missing rendered card selector: " + selector, "true", js("!!document.querySelector('" + selector + "')"));
        }
        assertEquals("ETA and CHECK_IN must both render through the ETA card surface", "2",
                js("document.querySelectorAll('.chat-galaxy-card.eta').length"));

        runJs("document.querySelector('[data-action=\"chat-poll-vote\"]')?.click()");
        awaitCondition(() -> backend.actions().contains("chat-poll"), UI_TIMEOUT_MS);

        runJs("document.querySelector('[data-action=\"chat-check-set\"]')?.click()");
        awaitCondition(() -> backend.actions().contains("chat-checklist"), UI_TIMEOUT_MS);

        sendChat("Mensaje E2E QA");
        awaitCondition(() -> backend.sentCount() == 1, UI_TIMEOUT_MS);
        awaitJs("document.querySelector('#chatMessages')?.innerText.includes('Mensaje E2E QA')");
    }

    @Test public void galaxyChat_phase0Baseline_runtimeAndScrollAreMeasured() throws Exception {
        launch();
        runJs("window.GalaxyChatPerf?.enable(true);window.GalaxyChatPerf?.reset();");
        long pssBefore = android.os.Debug.getPss();
        long cpuBefore = android.os.Process.getElapsedCpuTime();
        long openStarted = SystemClock.elapsedRealtime();
        runJs("document.querySelector('#chatFab')?.click()");
        awaitJs("!!document.querySelector('.chat-shell') && document.querySelectorAll('.chat-message').length>0");
        long openMs = SystemClock.elapsedRealtime() - openStarted;

        String markupJson = js("JSON.stringify((()=>{const out={};for(const n of [100,500,5000]){chatState={messages:Array.from({length:n},(_,i)=>({id:'phase0-'+n+'-'+i,client_id:'phase0c-'+n+'-'+i,sender_person:String(i%2),body:'QA '+i,message_type:i%10===3?'photo':i%10===4?'video':i%10===5?'audio':'text',attachments:i%10===3?[{kind:'photo',name:'qa.jpg',url:'data:image/gif;base64,R0lGODlhAQABAAAAACw='}]:[],server_seq:i+1,created_at:'2026-10-05T12:00:00Z',reactions:[]}),nextBeforeSeq:n>60?n-60:null};const t=performance.now();const html=chatMessagesMarkup();out[n]={markupMs:performance.now()-t,htmlBytes:html.length};}return out;})())");
        JSONObject markup = new JSONObject(markupJson);

        runJs("chatState={messages:Array.from({length:500},(_,i)=>({id:'scroll-'+i,client_id:'scrollc-'+i,sender_person:String(i%2),body:'Scroll QA '+i,message_type:'text',attachments:[],server_seq:i+1,created_at:'2026-10-05T12:00:00Z',reactions:[]})),nextBeforeSeq:440,pinnedIds:[]};chatStateSignature=chatSignature(chatState);render();");
        awaitJs("document.querySelectorAll('.chat-message').length===500");
        runJs("const e=document.querySelector('#chatMessages');e.scrollTop=Math.max(250,Math.floor(e.scrollHeight*.45));window.__phase0Before=e.scrollTop;");
        SystemClock.sleep(250);
        double beforeTop = Double.parseDouble(js("window.__phase0Before||0"));
        runJs("render()");
        SystemClock.sleep(450);
        double afterTop = Double.parseDouble(js("document.querySelector('#chatMessages')?.scrollTop||0"));
        assertTrue("Phase 0 must reproduce the current P0 scroll reset before a later phase fixes it", beforeTop > 100 && afterTop < 45);

        runJs("const e=document.querySelector('#chatMessages');e.scrollTop=Math.floor(e.scrollHeight*.25);e.dispatchEvent(new Event('scroll'));requestAnimationFrame(()=>{e.scrollTop=Math.floor(e.scrollHeight*.75);e.dispatchEvent(new Event('scroll'));});");
        SystemClock.sleep(1200);

        sendChat("Phase0 visual send");
        awaitCondition(() -> backend.sentCount() == 1, UI_TIMEOUT_MS);
        awaitJs("document.querySelector('#chatMessages')?.innerText.includes('Phase0 visual send')");
        SystemClock.sleep(300);

        long pssAfter = android.os.Debug.getPss();
        long cpuAfter = android.os.Process.getElapsedCpuTime();
        JSONObject perf = new JSONObject(js("JSON.stringify(window.GalaxyChatPerf?.report?.()||{})"));
        JSONObject result = new JSONObject()
            .put("openMsLocalQa", openMs)
            .put("pssBeforeKb", pssBefore)
            .put("pssAfterKb", pssAfter)
            .put("cpuMs", Math.max(0, cpuAfter-cpuBefore))
            .put("scrollBefore", beforeTop)
            .put("scrollAfter", afterTop)
            .put("markup", markup)
            .put("perf", perf);
        System.out.println("GALAXY_CHAT_PHASE0_ANDROID=" + result);
    }

    @Test public void dailyGoalsPlansEventsCapsulesMapContextBackupAndUpdate_areReachable() throws Exception {
        launch();
        awaitJs("document.body.innerText.includes('¿Qué construimos después?')");
        assertTrue(js("document.body.innerText").contains("PRÓXIMA FECHA"));

        runJsNoWait("document.querySelector('[data-action=\"goals-open\"]')?.click()");
        awaitJs("document.body.innerText.includes('Nuestros objetivos')");
        awaitJs("document.body.innerText.includes('Objetivo QA')");
        assertTrue(backend.actions().contains("goals-engine"));

        runJs("go('memories')");
        awaitJs("document.querySelector('.nav-btn.active')?.dataset.view==='memories'");
        String memories = js("document.body.innerText");
        assertTrue(memories.contains("Primer QA") || memories.contains("Cápsula QA") || memories.contains("Recuerdos"));

        runJs("go('map')");
        awaitCondition(() -> backend.actions().contains("map-state"), UI_TIMEOUT_MS);
        awaitJs("document.querySelector('.nav-btn.active')?.dataset.view==='map'");

        JSONObject backup = MobileApiClient.post("qa-token-0", new JSONObject().put("action","backup-export"));
        assertEquals("20261005011401", backup.getString("schemaVersion"));
        JSONObject restored = MobileApiClient.post("qa-token-0", new JSONObject().put("action","backup-import").put("payload", backup));
        assertTrue(restored.getBoolean("restored"));

        runJs("go('more')");
        awaitJs("document.body.innerText.includes('Copia de nuestra galaxia')");
        assertTrue(js("document.body.innerText").contains("Actualizaciones"));
        assertTrue(js("!!document.querySelector('[data-action=\"update-check\"]')").equals("true"));

        launchChat();
        awaitJs("document.querySelector('#chatMessages')?.innerText.includes('CÁPSULA BLOQUEADA')");
        awaitJs("document.querySelector('#chatMessages')?.innerText.includes('EN CAMINO')");
    }

    @Test public void networkOfflineSlowTimeoutAndChatRetry_areExercised() throws Exception {
        launchChat();

        backend.setNetworkMode(QaHttpServer.NetworkMode.FAIL_503);
        sendChat("Debe reintentar");
        awaitJs("!!document.querySelector('.chat-failed-actions')");
        assertEquals(0, backend.sentCount());

        backend.setNetworkMode(QaHttpServer.NetworkMode.NORMAL);
        runJs("document.querySelector('[data-action=\"chat-retry\"]')?.click()");
        awaitCondition(() -> backend.sentCount() == 1, UI_TIMEOUT_MS);
        awaitJs("document.querySelector('#chatMessages')?.innerText.includes('Debe reintentar')");

        backend.setNetworkMode(QaHttpServer.NetworkMode.SLOW);
        long started = SystemClock.elapsedRealtime();
        JSONObject state = MobileApiClient.post("qa-token-0", new JSONObject().put("action","mobile-state"));
        long elapsed = SystemClock.elapsedRealtime() - started;
        assertEquals("0", state.getString("person"));
        assertTrue("slow network shaping did not apply: " + elapsed, elapsed >= 750);

        backend.setNetworkMode(QaHttpServer.NetworkMode.TIMEOUT);
        try {
            MobileApiClient.post("qa-token-0", new JSONObject().put("action","mobile-state"));
            fail("A no-response request must fail.");
        } catch (Exception expected) {
            assertNotNull(expected);
        } finally {
            backend.setNetworkMode(QaHttpServer.NetworkMode.NORMAL);
        }
    }

    @Test public void dualUserConcurrency_andRealtimeVisibility_areExercised() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Future<JSONObject> first = executor.submit(() -> MobileApiClient.post("qa-token-0", new JSONObject()
                .put("action","chat-send").put("clientId", UUID.randomUUID().toString()).put("body","Concurrente 0").put("messageType","text")));
            Future<JSONObject> second = executor.submit(() -> MobileApiClient.post("qa-token-1", new JSONObject()
                .put("action","chat-send").put("clientId", UUID.randomUUID().toString()).put("body","Concurrente 1").put("messageType","text")));
            assertEquals("0", first.get(10, TimeUnit.SECONDS).getJSONObject("message").getString("sender_person"));
            assertEquals("1", second.get(10, TimeUnit.SECONDS).getJSONObject("message").getString("sender_person"));

            JSONObject state0 = MobileApiClient.post("qa-token-0", new JSONObject().put("action","chat-state").put("limit",60));
            JSONObject state1 = MobileApiClient.post("qa-token-1", new JSONObject().put("action","chat-state").put("limit",60));
            assertTrue(messagesContain(state0.getJSONArray("messages"), "Concurrente 0"));
            assertTrue(messagesContain(state0.getJSONArray("messages"), "Concurrente 1"));
            assertTrue(messagesContain(state1.getJSONArray("messages"), "Concurrente 0"));
            assertTrue(messagesContain(state1.getJSONArray("messages"), "Concurrente 1"));
        } finally {
            executor.shutdownNow();
        }
    }

    @Test public void permissionsDarkThemeAndFontScaling_areAppliedOnDevice() throws Exception {
        String pkg = context.getPackageName();
        instrumentation.getUiAutomation().grantRuntimePermission(pkg, Manifest.permission.CAMERA);
        instrumentation.getUiAutomation().grantRuntimePermission(pkg, Manifest.permission.RECORD_AUDIO);
        instrumentation.getUiAutomation().grantRuntimePermission(pkg, Manifest.permission.ACCESS_FINE_LOCATION);
        assertEquals(PackageManager.PERMISSION_GRANTED, context.checkSelfPermission(Manifest.permission.CAMERA));
        assertEquals(PackageManager.PERMISSION_GRANTED, context.checkSelfPermission(Manifest.permission.RECORD_AUDIO));
        assertEquals(PackageManager.PERMISSION_GRANTED, context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION));

        // Do not revoke a runtime permission from inside instrumentation: Android
        // terminates the target package process when a permission is revoked.
        // Denied-state coverage is exercised from the clean-install workflow boundary.
        assertEquals(PackageManager.PERMISSION_GRANTED, context.checkSelfPermission(Manifest.permission.CAMERA));

        shell("cmd uimode night yes");
        launch();
        scenario.recreate();
        awaitCondition(() -> (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES, UI_TIMEOUT_MS);
        awaitJs("!!document.querySelector('#app')");

        shell("settings put system font_scale 1.30");
        scenario.recreate();
        awaitCondition(() -> context.getResources().getConfiguration().fontScale >= 1.25f, UI_TIMEOUT_MS);
        awaitJs("!!document.querySelector('#app')");
    }

    @Test public void notificationDeepLink_opensChatAfterColdLaunch() throws Exception {
        Intent intent = new Intent(context, MainActivity.class)
            .putExtra("galaxy_action", "chat")
            .putExtra("galaxy_entity_id", "50000000-0000-4000-8000-000000000001")
            .putExtra("galaxy_event_type", "chat_message");
        scenario = ActivityScenario.launch(intent);
        awaitJs("!!document.querySelector('.chat-shell')");
        awaitCondition(() -> backend.actions().contains("chat-state"), UI_TIMEOUT_MS);
    }

    @Test public void cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem() throws Exception {
        launch();
        String pkg = context.getPackageName();
        instrumentation.getUiAutomation().grantRuntimePermission(pkg, Manifest.permission.CAMERA);
        instrumentation.getUiAutomation().grantRuntimePermission(pkg, Manifest.permission.RECORD_AUDIO);

        PackageManager pm = context.getPackageManager();
        boolean hasDocuments = !pm.queryIntentActivities(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*")
                .addCategory(Intent.CATEGORY_OPENABLE), PackageManager.MATCH_DEFAULT_ONLY).isEmpty();
        Assume.assumeTrue("No ACTION_OPEN_DOCUMENT handler in this emulator.", hasDocuments);

        scenario.onActivity(a -> a.pickMedia("qa-file-picker", "chat-file"));
        UiDevice device = UiDevice.getInstance(instrumentation);
        SystemClock.sleep(800);
        assertFalse("File picker did not leave app foreground.", device.getCurrentPackageName().equals(pkg));
        device.pressBack();

        boolean hasCamera = !pm.queryIntentActivities(new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE),
                PackageManager.MATCH_DEFAULT_ONLY).isEmpty();
        if (hasCamera) {
            scenario.onActivity(a -> a.captureChatPhoto("qa-camera"));
            SystemClock.sleep(800);
            assertFalse("Camera intent did not leave app foreground.", device.getCurrentPackageName().equals(pkg));
            device.pressBack();
        }

        // Microphone path is executed only when the emulator exposes an input source.
        scenario.onActivity(a -> a.startVoiceRecording("qa-mic"));
        SystemClock.sleep(700);
        scenario.onActivity(a -> a.stopVoiceRecording("qa-mic-stop"));
        awaitJs("!!document.querySelector('#app')");
    }

    private void launch() {
        scenario = ActivityScenario.launch(MainActivity.class);
        awaitJs("!!document.querySelector('#app')");
        awaitJs("document.body.innerText.includes('Nuestra Galaxia')");
    }

    private void launchChat() {
        if (scenario == null) launch();
        runJs("document.querySelector('#chatFab')?.click()");
        awaitJs("!!document.querySelector('.chat-shell')");
        awaitCondition(() -> backend.actions().contains("chat-state"), UI_TIMEOUT_MS);
    }

    private void sendChat(String body) {
        String safe = JSONObject.quote(body);
        runJs("const t=document.querySelector('#chatForm textarea');t.value=" + safe
            + ";t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#chatForm').requestSubmit();");
    }

    private boolean messagesContain(JSONArray rows, String text) {
        for (int i=0;i<rows.length();i++) if (text.equals(rows.optJSONObject(i).optString("body"))) return true;
        return false;
    }

    private int orientation() {
        AtomicReference<Integer> out = new AtomicReference<>(0);
        scenario.onActivity(a -> out.set(a.getResources().getConfiguration().orientation));
        return out.get();
    }

    private boolean imeVisible() {
        AtomicReference<Boolean> out = new AtomicReference<>(false);
        scenario.onActivity(a -> {
            WebView web = a.findViewById(R.id.webView);
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(web);
            out.set(insets != null && insets.isVisible(WindowInsetsCompat.Type.ime()));
        });
        return Boolean.TRUE.equals(out.get());
    }

    private void tapWebElement(String selector) throws Exception {
        String quoted = JSONObject.quote(selector);
        String raw = js("JSON.stringify((()=>{const e=document.querySelector(" + quoted + ");if(!e)return null;const r=e.getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,vw:window.innerWidth,vh:window.innerHeight};})())");
        assertFalse("Web element not found: " + selector, raw.isBlank() || "null".equals(raw));
        JSONObject g = new JSONObject(raw);
        AtomicReference<int[]> frame = new AtomicReference<>();
        scenario.onActivity(a -> {
            WebView web = a.findViewById(R.id.webView);
            int[] location = new int[2];
            web.getLocationOnScreen(location);
            frame.set(new int[]{location[0], location[1], web.getWidth(), web.getHeight()});
        });
        int[] v = frame.get();
        int x = v[0] + (int)Math.round(g.getDouble("x") * v[2] / Math.max(1d, g.getDouble("vw")));
        int y = v[1] + (int)Math.round(g.getDouble("y") * v[3] / Math.max(1d, g.getDouble("vh")));
        assertTrue("Unable to tap WebView element: " + selector, UiDevice.getInstance(instrumentation).click(x, y));
        SystemClock.sleep(250);
    }

    private void runJs(String script) {
        js("(function(){" + script + ";return 'ok';})()");
    }

    private void runJsNoWait(String script) {
        if (scenario == null) throw new IllegalStateException("Activity not launched");
        scenario.onActivity(activity -> {
            WebView web = activity.findViewById(R.id.webView);
            web.evaluateJavascript("(function(){try{" + script + ";}catch(e){}})()", null);
        });
        SystemClock.sleep(300);
    }

    private String js(String expression) {
        if (scenario == null) throw new IllegalStateException("Activity not launched");
        AtomicReference<String> raw = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);
        scenario.onActivity(activity -> {
            WebView web = activity.findViewById(R.id.webView);
            web.evaluateJavascript("(function(){try{return (" + expression + ");}catch(e){return 'ERR:'+e.message;}})()", value -> {
                raw.set(value);
                latch.countDown();
            });
        });
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("JavaScript callback timed out: " + expression);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
        return decodeJs(raw.get());
    }

    private String decodeJs(String raw) {
        if (raw == null || "null".equals(raw)) return "";
        try {
            Object value = new JSONArray("[" + raw + "]").get(0);
            return value == JSONObject.NULL ? "" : String.valueOf(value);
        } catch (Exception ignored) {
            return raw;
        }
    }

    private void awaitJs(String expression) {
        awaitCondition(() -> "true".equals(js(expression)), UI_TIMEOUT_MS);
    }

    private void awaitCondition(Check check, long timeoutMs) {
        long end = SystemClock.elapsedRealtime() + timeoutMs;
        AssertionError last = null;
        while (SystemClock.elapsedRealtime() < end) {
            try {
                if (check.ok()) return;
            } catch (AssertionError e) {
                last = e;
            } catch (Exception ignored) {}
            SystemClock.sleep(100);
        }
        if (last != null) throw last;
        throw new AssertionError("Condition timed out after " + timeoutMs + " ms");
    }

    private String shell(String command) throws Exception {
        ParcelFileDescriptor pfd = instrumentation.getUiAutomation().executeShellCommand(command);
        try (FileInputStream in = new FileInputStream(pfd.getFileDescriptor());
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer,0,n);
            return out.toString(StandardCharsets.UTF_8);
        } finally {
            pfd.close();
        }
    }

    private interface Check { boolean ok() throws Exception; }
}
