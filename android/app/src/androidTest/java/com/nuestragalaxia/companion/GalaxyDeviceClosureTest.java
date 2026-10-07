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
        UiDevice.getInstance(instrumentation).wakeUp();
        shell("wm dismiss-keyguard");
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
        runJs("document.querySelector('[data-action=\"chat-more-open\"]')?.click()");
        awaitJs("document.querySelector('#modal')?.open===true");
        assertTrue(js("document.querySelector('#modal')?.innerText||''").contains("Contenido compartido"));
        assertTrue(js("document.querySelector('#modal')?.innerText||''").contains("Guardados"));
        assertTrue(js("document.querySelector('#modal')?.innerText||''").contains("Ajustes del chat"));
        runJs("document.querySelector('[data-action=\"chat-settings-open\"]')?.click()");
        awaitJs("document.querySelector('#modal')?.open===true");
        assertTrue(js("document.querySelector('#modal')?.innerText||''").contains("Ajustes del chat"));
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

    @Test public void galaxyChat_phase1MessageEngine_windowingAndLifecycleAreMeasured() throws Exception {
        launch();
        runJs("window.GalaxyChatPerf?.enable(true);window.GalaxyChatPerf?.reset();");
        long pssBefore = android.os.Debug.getPss();
        long cpuBefore = android.os.Process.getElapsedCpuTime();
        long openStarted = SystemClock.elapsedRealtime();
        runJs("document.querySelector('#chatFab')?.click()");
        awaitJs("!!document.querySelector('.chat-shell') && document.querySelectorAll('.chat-message').length>0");
        long openMs = SystemClock.elapsedRealtime() - openStarted;

        String windowJson = js("JSON.stringify((()=>{const out={};for(const n of [100,500,5000,20000]){const engine=GalaxyMessageEngine.create({pageSize:60,maxCache:420,windowSize:84,windowStep:28,estimatedHeight:92});const rows=Array.from({length:n},(_,i)=>({id:'phase1-'+n+'-'+i,client_id:'phase1c-'+n+'-'+i,sender_person:String(i%2),body:'QA '+i,message_type:i%10===3?'photo':i%10===4?'video':i%10===5?'audio':'text',attachments:[],server_seq:i+1,created_at:'2026-10-05T12:00:00Z',reactions:[]}));engine.resetWindow(rows.length,{align:'end'});const t=performance.now();const range=engine.range(rows);out[n]={rangeMs:performance.now()-t,rendered:range.messages.length,logical:n};}return out;})())");
        JSONObject windows = new JSONObject(windowJson);
        assertTrue(windows.getJSONObject("100").getInt("rendered") <= 84);
        assertTrue(windows.getJSONObject("500").getInt("rendered") <= 84);
        assertTrue(windows.getJSONObject("5000").getInt("rendered") <= 84);
        assertTrue(windows.getJSONObject("20000").getInt("rendered") <= 84);

        runJs("chatState={messages:Array.from({length:420},(_,i)=>({id:'scroll-'+i,client_id:'scrollc-'+i,sender_person:String(i%2),body:'Scroll QA '+i,message_type:'text',attachments:[],server_seq:i+1,created_at:'2026-10-05T12:00:00Z',reactions:[]})),nextBeforeSeq:1,nextAfterSeq:null,pinnedIds:[]};chatStateSignature=chatSignature(chatState);chatMessageEngine.resetWindow(chatRows().length,{align:'end'});render();");
        awaitJs("document.querySelectorAll('.chat-message').length>0 && document.querySelectorAll('.chat-message').length<=84");
        runJs("const e=document.querySelector('#chatMessages'),r=chatMessageEngine.range(chatRows());e.scrollTop=Math.max(0,r.topPx+Math.min(900,Math.max(220,e.clientHeight*.75)));chatHandleScroll(e);");
        SystemClock.sleep(450);
        runJs("const e=document.querySelector('#chatMessages');window.__phase1Anchor=chatCaptureAnchor(e);window.__phase1Top=e.scrollTop;window.__phase1Offset=window.__phase1Anchor?.offset||0;");
        String anchorId = js("window.__phase1Anchor?.id||''");
        double beforeTop = Double.parseDouble(js("window.__phase1Top||0"));
        double beforeOffset = Double.parseDouble(js("window.__phase1Offset||0"));
        runJs("chatRenderMessages({anchor:window.__phase1Anchor,scroll:'preserve'})");
        SystemClock.sleep(450);
        double afterTop = Double.parseDouble(js("document.querySelector('#chatMessages')?.scrollTop||0"));
        double afterOffset = Double.parseDouble(js("chatViewportOffsetFor(window.__phase1Anchor?.id)||0"));
        assertTrue("Window refresh lost the anchored message", Math.abs(afterOffset) > 0d || Math.abs(beforeOffset) < 1d);
        assertTrue("Window refresh must preserve the visual anchor offset", Math.abs(afterOffset-beforeOffset) < 4d);
        assertTrue(Integer.parseInt(js("document.querySelectorAll('.chat-message').length")) <= 84);

        runJs("chatState=null;chatStateSignature='';chatMessageEngine.resetWindow(0,{align:'end'});loadChat({quiet:true,force:true,present:true});");
        awaitJs("document.querySelectorAll('.chat-galaxy-card').length===13 && document.querySelectorAll('.chat-message').length<=84");

        sendChat("Phase1 visual send");
        awaitCondition(() -> backend.sentCount() == 1, UI_TIMEOUT_MS);
        awaitJs("document.querySelector('#chatMessages')?.innerText.includes('Phase1 visual send')");
        assertTrue(Integer.parseInt(js("document.querySelectorAll('.chat-message').length")) <= 86);

        scenario.moveToState(Lifecycle.State.CREATED);
        scenario.moveToState(Lifecycle.State.RESUMED);
        awaitJs("!!document.querySelector('.chat-shell')");
        assertTrue(Integer.parseInt(js("document.querySelectorAll('.chat-message').length")) <= 86);

        runJs("document.querySelector('[data-action=\"chat-close\"]')?.click()");
        awaitJs("!document.querySelector('.chat-shell')");
        runJs("document.querySelector('#chatFab')?.click()");
        awaitJs("!!document.querySelector('.chat-shell') && document.querySelectorAll('.chat-message').length>0");

        long pssAfter = android.os.Debug.getPss();
        long cpuAfter = android.os.Process.getElapsedCpuTime();
        JSONObject perf = new JSONObject(js("JSON.stringify(window.GalaxyChatPerf?.report?.()||{})"));
        JSONObject result = new JSONObject()
            .put("openMsLocalQa", openMs)
            .put("pssBeforeKb", pssBefore)
            .put("pssAfterKb", pssAfter)
            .put("cpuMs", Math.max(0, cpuAfter-cpuBefore))
            .put("anchorBefore", beforeTop)
            .put("anchorAfter", afterTop)
            .put("windowing", windows)
            .put("perf", perf);
        System.out.println("GALAXY_CHAT_PHASE1_ANDROID=" + result);
    }

    @Test public void galaxyChat_phase2ScrollEngine_anchorRealtimeResizeAndNavigationAreStable() throws Exception {
        launchChat();
        runJs("window.GalaxyChatPerf?.enable(true);window.GalaxyChatPerf?.reset();");
        long pssBefore = android.os.Debug.getPss();
        long cpuBefore = android.os.Process.getElapsedCpuTime();

        runJs("chatState={messages:Array.from({length:220},(_,i)=>({id:'p2-'+(i+100),client_id:'p2c-'+(i+100),sender_person:String(i%2),body:'Phase2 '+i,message_type:'text',attachments:[],server_seq:i+100,created_at:'2026-10-05T12:00:00Z',reactions:[]})),nextBeforeSeq:100,nextAfterSeq:null,pinnedIds:[]};chatStateSignature=chatSignature(chatState);chatMessageEngine.resetWindow(chatRows().length,{align:'end'});render();");
        awaitJs("document.querySelectorAll('.chat-message').length>0 && document.querySelectorAll('.chat-message').length<=84");

        runJs("window.__p2settled=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__p2settled=true));");
        awaitJs("window.__p2settled && !chatScrollEngine.isProgrammatic() && !chatMeasureRaf");
        runJs("const e=document.querySelector('#chatMessages'),r=chatMessageEngine.range(chatRows());window.__p2VirtualStart=r.start;e.scrollTop=Math.max(0,r.topPx+20);chatScrollEngine.onScroll(e);window.__p2VirtualAnchor=chatCaptureAnchor(e);window.__p2VirtualOffset=window.__p2VirtualAnchor?.offset||0;chatHandleScroll(e);");
        SystemClock.sleep(550);
        assertTrue("Virtual window did not rotate before entering the top spacer", Integer.parseInt(js("chatMessageEngine.range(chatRows()).start")) < Integer.parseInt(js("window.__p2VirtualStart||0")));
        double virtualAfterOffset = Double.parseDouble(js("chatViewportOffsetFor(window.__p2VirtualAnchor?.id)||0"));
        assertTrue("Virtual rotation drifted the anchored message", Math.abs(virtualAfterOffset-Double.parseDouble(js("window.__p2VirtualOffset||0"))) < 4d);

        runJs("const e=document.querySelector('#chatMessages'),r=chatMessageEngine.range(chatRows());e.scrollTop=Math.max(0,r.topPx+Math.round(e.clientHeight*.30));chatScrollEngine.onScroll(e);window.__p2Anchor=chatCaptureAnchor(e);window.__p2Offset=window.__p2Anchor?.offset||0;");
        SystemClock.sleep(250);
        String anchorId = js("window.__p2Anchor?.id||''");
        double anchorOffset = Double.parseDouble(js("window.__p2Offset||0"));
        assertFalse("Phase 2 needs a stable visible anchor", anchorId.isBlank());

        long prependStarted = SystemClock.elapsedRealtime();
        runJs("const anchor=window.__p2Anchor;const older=Array.from({length:50},(_,i)=>({id:'p2-old-'+i,client_id:'p2-oldc-'+i,sender_person:String(i%2),body:'Older '+i,message_type:'text',attachments:[],server_seq:50+i,created_at:'2026-10-05T11:00:00Z',reactions:[]}));chatState={...chatState,messages:chatMessageEngine.mergeMessages(older,chatState.messages)};const idx=chatRows().findIndex(m=>String(m.id)===String(anchor.id));chatMessageEngine.focus(chatRows().length,idx);chatRenderMessages({anchor,scroll:'preserve'});");
        SystemClock.sleep(500);
        long prependMs = SystemClock.elapsedRealtime() - prependStarted;
        double prependOffset = Double.parseDouble(js("chatViewportOffsetFor(window.__p2Anchor?.id)||0"));
        assertTrue("Prepend drifted the anchored message: " + prependOffset, Math.abs(prependOffset-anchorOffset) < 4d);

        runJs("const e=document.querySelector('#chatMessages'),anchor=chatCaptureAnchor(e);window.__p2RealtimeAnchor=anchor;const incoming={id:'p2-live',client_id:'p2-livec',sender_person:'1',body:'Realtime while reading',message_type:'text',attachments:[],server_seq:9999,created_at:'2026-10-05T12:01:00Z',reactions:[]};chatState=chatMessageEngine.applySingle(chatState,incoming);chatStateSignature=chatSignature(chatState);chatNewCount=1;chatRenderMessages({anchor,scroll:'preserve'});");
        SystemClock.sleep(450);
        double realtimeBeforeOffset = Double.parseDouble(js("window.__p2RealtimeAnchor?.offset||0"));
        double realtimeAfterOffset = Double.parseDouble(js("chatViewportOffsetFor(window.__p2RealtimeAnchor?.id)||0"));
        assertTrue("Realtime drifted the visual anchor", Math.abs(realtimeAfterOffset-realtimeBeforeOffset) < 4d);
        assertEquals("1", js("chatNewCount"));
        assertEquals("true", js("!!document.querySelector('.chat-new-button')"));
        assertEquals("false", js("chatNearBottom(document.querySelector('#chatMessages'))"));

        runJs("const e=document.querySelector('#chatMessages');chatScrollEngine.toBottom(e,{reason:'qa-bottom'});");
        SystemClock.sleep(250);
        assertEquals("true", js("chatNearBottom(document.querySelector('#chatMessages'))"));

        runJs("const e=document.querySelector('#chatMessages'),r=chatMessageEngine.range(chatRows());e.scrollTop=Math.max(0,r.topPx+Math.min(900,Math.max(220,e.clientHeight*.75)));chatHandleScroll(e);");
        SystemClock.sleep(450);
        runJs("const e=document.querySelector('#chatMessages');window.__p2ResizeAnchor=chatCaptureAnchor(e);window.__p2ResizeOffset=window.__p2ResizeAnchor?.offset||0;const t=document.querySelector('#chatForm textarea');t.style.height='110px';t.value='linea 1\\nlinea 2\\nlinea 3';t.dispatchEvent(new Event('input',{bubbles:true}));");
        SystemClock.sleep(550);
        double resizeAfterOffset = Double.parseDouble(js("chatViewportOffsetFor(window.__p2ResizeAnchor?.id)||0"));
        assertTrue("Composer resize drifted the anchored message", Math.abs(Double.parseDouble(js("window.__p2ResizeOffset||0"))-resizeAfterOffset) < 4d);

        runJs("chatScrollEngine.remember(document.querySelector('#chatMessages'),'chat');window.__p2NavAnchor=chatCaptureAnchor(document.querySelector('#chatMessages'));go('home');");
        awaitJs("!document.querySelector('.chat-shell')");
        runJs("go('chat')");
        awaitJs("!!document.querySelector('.chat-shell')");
        SystemClock.sleep(500);
        double navBeforeOffset = Double.parseDouble(js("window.__p2NavAnchor?.offset||0"));
        double navAfterOffset = Double.parseDouble(js("chatViewportOffsetFor(window.__p2NavAnchor?.id)||0"));
        assertTrue("Navigation return drifted the anchored message", Math.abs(navAfterOffset-navBeforeOffset) < 4d);
        assertTrue(Integer.parseInt(js("document.querySelectorAll('.chat-message').length")) <= 84);

        long pssAfter = android.os.Debug.getPss();
        long cpuAfter = android.os.Process.getElapsedCpuTime();
        JSONObject perf = new JSONObject(js("JSON.stringify(window.GalaxyChatPerf?.report?.()||{})"));
        JSONObject result = new JSONObject()
            .put("prepend50MsLocalQa", prependMs)
            .put("anchorBeforeOffset", anchorOffset)
            .put("anchorAfterOffset", prependOffset)
            .put("realtimeAnchorBeforeOffset", realtimeBeforeOffset)
            .put("realtimeAnchorAfterOffset", realtimeAfterOffset)
            .put("pssBeforeKb", pssBefore)
            .put("pssAfterKb", pssAfter)
            .put("cpuMs", Math.max(0, cpuAfter-cpuBefore))
            .put("renderedMessages", Integer.parseInt(js("document.querySelectorAll('.chat-message').length")))
            .put("perf", perf);
        System.out.println("GALAXY_CHAT_PHASE2_ANDROID=" + result);
    }

    @Test public void chatPhase4Composer2_realWebViewInputReplyDraftSheetAnd20k_areStable() throws Exception {
        launchChat();
        runJs("ensureChatComposer().accepted();chatAttachmentsDraft=[];chatRenderComposer();");
        awaitJs("!!window.GalaxyChatComposer&&!!document.querySelector('.chat-composer-v2')");
        assertEquals("button", js("document.querySelector('.chat-send')?.type||''"));
        assertEquals("chat-hold-record", js("document.querySelector('.chat-send')?.dataset.action||''"));

        runJs("const t=document.querySelector('#chatForm textarea');t.value='Hola 🌻';t.dispatchEvent(new Event('input',{bubbles:true}));t.setSelectionRange(0,4);");
        awaitJs("document.querySelector('.chat-send')?.type==='submit'");
        assertEquals("Hola 🌻", js("ensureChatComposer().snapshot().text"));
        assertEquals("4", js("document.querySelector('#chatForm textarea')?.selectionEnd||0"));

        runJs("const t=document.querySelector('#chatForm textarea');t.value='uno\\ndos\\ntres\\ncuatro\\ncinco\\nseis\\nsiete\\nocho\\nnueve\\ndiez';t.dispatchEvent(new Event('input',{bubbles:true}));");
        awaitJs("ensureChatComposer().snapshot().multiline===true");
        assertTrue(Double.parseDouble(js("parseFloat(document.querySelector('#chatForm textarea').style.height)||0")) <= 120d);
        assertEquals("auto", js("document.querySelector('#chatForm textarea').style.overflowY"));

        runJs("const m=(chatState?.messages||[])[0];if(m){ensureChatComposer().setReply(m);chatRenderComposer({focus:true});}");
        awaitJs("!!document.querySelector('.chat-compose-reply-v2')");
        String replyDraft = js("document.querySelector('#chatForm textarea')?.value||''");
        runJs("document.querySelector('[data-action=\"chat-reply-cancel\"]')?.click()");
        awaitJs("!document.querySelector('.chat-compose-reply-v2')");
        assertEquals(replyDraft, js("document.querySelector('#chatForm textarea')?.value||''"));

        runJs("const t=document.querySelector('#chatForm textarea');t.value='draft navegación';t.dispatchEvent(new Event('input',{bubbles:true}));go('home');go('chat');");
        awaitJs("(document.querySelector('#chatForm textarea')?.value||'')==='draft navegación'");

        runJs("document.querySelector('[data-action=\"chat-attach-open\"]')?.click()");
        awaitJs("document.querySelector('#modal')?.open===true&&document.querySelector('#modal')?.classList.contains('chat-bottom-sheet')");
        assertTrue(js("document.querySelector('#modal')?.innerText||''").contains("Cámara"));
        assertTrue(js("document.querySelector('#modal')?.innerText||''").contains("Fotos"));
        runJs("document.querySelector('[data-action=\"modal-close\"]')?.click()");
        awaitJs("document.querySelector('#modal')?.open===false");

        tapWebElement("#chatForm textarea");
        awaitJs("document.activeElement===document.querySelector('#chatForm textarea')");
        shell("input text _IME");
        awaitJs("(document.querySelector('#chatForm textarea')?.value||'').includes('_IME')");
        assertEquals("true", js("ensureChatComposer().snapshot().keyboard.open"));

        long sentBefore = backend.sentCount();
        runJs("const t=document.querySelector('#chatForm textarea');t.value='Phase4 once';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#chatForm').requestSubmit();document.querySelector('#chatForm')?.requestSubmit();");
        awaitCondition(() -> backend.sentCount() == sentBefore + 1, UI_TIMEOUT_MS);
        awaitJs("(document.querySelector('#chatForm textarea')?.value||'')===''");
        assertEquals("false", js("!!ensureChatComposer().snapshot().replyTarget"));

        runJs("const t=document.querySelector('#chatForm textarea');t.value='Realtime no borra esto';t.dispatchEvent(new Event('input',{bubbles:true}));const incoming={id:'p4-live',client_id:'p4-livec',sender_person:'1',body:'Mientras escribes',message_type:'text',attachments:[],server_seq:999999,created_at:'2026-10-05T22:00:00Z',reactions:[]};chatState=chatMessageEngine.applySingle(chatState||{messages:[]},incoming);chatStateSignature=chatSignature(chatState);chatRenderMessages({scroll:'preserve'});");
        assertEquals("Realtime no borra esto", js("document.querySelector('#chatForm textarea')?.value||''"));

        // Changing font_scale may itself destroy/recreate the Activity. Close the
        // current scenario first so ActivityScenario never races a system-driven
        // DESTROYED transition, then relaunch under the new scaled configuration.
        scenario.close();
        scenario = null;
        shell("settings put system font_scale 1.30");
        awaitCondition(() -> context.getResources().getConfiguration().fontScale >= 1.25f, UI_TIMEOUT_MS);
        launchChat();
        awaitJs("!!document.querySelector('#app')");
        awaitJs("!!document.querySelector('.chat-composer-v2')");
        double minTarget = Double.parseDouble(js("Math.min(document.querySelector('.chat-plus').getBoundingClientRect().width,document.querySelector('.chat-plus').getBoundingClientRect().height,document.querySelector('.chat-send').getBoundingClientRect().width,document.querySelector('.chat-send').getBoundingClientRect().height)"));
        assertTrue("Composer touch target below 44 CSS px: " + minTarget, minTarget >= 44d);

        runJs("chatState={...(chatState||{}),messages:Array.from({length:20000},(_,i)=>({id:'p4-'+i,client_id:'p4c-'+i,sender_person:String(i%2),body:'Mensaje '+i,message_type:'text',attachments:[],server_seq:i+1,created_at:'2026-10-05T20:00:00Z',reactions:[]})),nextBeforeSeq:null,nextAfterSeq:null};chatMessageEngine.resetWindow(20000,{align:'end'});chatRenderMessages({scroll:'bottom'});");
        awaitJs("document.querySelectorAll('.chat-message').length<=84");
        runJs("const t=document.querySelector('#chatForm textarea');t.value='20k fluido';t.dispatchEvent(new Event('input',{bubbles:true}));");
        assertEquals("20k fluido", js("ensureChatComposer().snapshot().text"));
        assertTrue(Integer.parseInt(js("document.querySelectorAll('.chat-message').length")) <= 84);

        JSONObject result = new JSONObject()
            .put("composer", "ChatComposer")
            .put("sentDelta", backend.sentCount() - sentBefore)
            .put("touchTargetPx", minTarget)
            .put("renderedMessagesWith20k", Integer.parseInt(js("document.querySelectorAll('.chat-message').length")))
            .put("draft", js("ensureChatComposer().snapshot().text"));
        System.out.println("GALAXY_CHAT_PHASE4_ANDROID=" + result);
    }

    @Test public void chatPhase8Motion_realWebViewEventsReducedMotionAnd20k() throws Exception {
        launchChat();
        awaitJs("!!window.GalaxyChatMotion");
        runJs("GalaxyChatPerf.enable(true);GalaxyChatPerf.reset();GalaxyChatMotion.suspend();");
        backend.setNetworkMode(QaHttpServer.NetworkMode.SLOW);
        JSONObject send = new JSONObject(js("JSON.stringify((()=>{const t=performance.now();const row=queueChatMessage({body:'Phase8 immediate'});return {visible:!!document.querySelector('[data-client-id=\"'+row.client_id+'\"]'),ms:performance.now()-t};})())"));
        assertTrue("optimistic send waits for server",send.getBoolean("visible"));
        if(isPhysicalDevice())assertTrue("optimistic send is not immediate",send.getDouble("ms")<100);
        SystemClock.sleep(600);
        assertEquals("motion diagnostics "+js("JSON.stringify({perf:GalaxyChatPerf.report(),memory:navigator.deviceMemory,visible:document.visibilityState,constrained:GalaxyChatMotion.constrained(),box:document.querySelector('#chatMessages').getBoundingClientRect(),last:document.querySelector('.chat-message.local')?.getBoundingClientRect()})"),"true",js("GalaxyChatPerf.report().events.some(e=>e.type==='motion-entry')||GalaxyChatMotion.constrained()"));
        awaitCondition(() -> backend.sentCount()>=1,UI_TIMEOUT_MS);
        backend.setNetworkMode(QaHttpServer.NetworkMode.NORMAL);
        SystemClock.sleep(600);

        boolean memoryLimited=Boolean.parseBoolean(js("navigator.deviceMemory>0&&navigator.deviceMemory<=2"));
        for(int count:new int[]{1,3,20}){
            runJs("GalaxyChatPerf.reset();GalaxyChatMotion.suspend();chatScrollEngine.toBottom(document.querySelector('#chatMessages'));");
            SystemClock.sleep(220);
            backend.receivePartner(count);
            runJs("loadChat({quiet:true,force:true});");
            awaitJs("chatState.messages.length>="+(count+1));
            SystemClock.sleep(450);
            int entries=Integer.parseInt(js("GalaxyChatPerf.report().events.filter(e=>e.type==='motion-entry').reduce((s,e)=>s+e.count,0)"));
            if(memoryLimited)assertEquals("low-memory device keeps fresh updates direct",0,entries);
            if(count==20)assertEquals("burst animates individual rows",0,entries);
            else assertTrue("visible incoming message should animate or degrade on slow devices",(entries>0&&entries<=count)||Boolean.parseBoolean(js("GalaxyChatMotion.constrained()")));
            assertEquals("incoming "+count+" changes bottom continuity: "+js("JSON.stringify((()=>{const p=GalaxyChatPerf.report();return {...p,events:p.events.slice(-8)};})())"),"true",js("chatNearBottom()"));
        }
        runJs("GalaxyChatPerf.reset();chatRenderMessages({scroll:'bottom'});");
        SystemClock.sleep(300);
        assertEquals("recycled mount replays entry","0",js("GalaxyChatPerf.report().events.filter(e=>e.type==='motion-entry').length"));

        runJs("window.__p8timings=[];(async()=>{for(const kind of ['feedback','enter','sheet']){const configured=GalaxyChatMotion.duration(kind==='feedback'?'fast':kind==='sheet'?'slow':'normal'),started=performance.now(),a=GalaxyChatMotion.animate(document.querySelector('.chat-plus'),kind);if(a)await a.finished.catch(()=>{});window.__p8timings.push({kind,configured,actualMs:performance.now()-started,suppressed:!a});}})();");
        awaitJs("window.__p8timings.length===3");
        assertEquals("motion token exceeds budget","false",js("window.__p8timings.some(t=>t.configured>300)"));
        if(isPhysicalDevice())assertEquals("motion actual duration exceeds budget","false",js("window.__p8timings.some(t=>!t.suppressed&&t.actualMs>300)"));
        runJs("document.querySelector('[data-action=\"chat-attach-open\"]').click();window.__p8sheet=modal.querySelector('.modal-inner').getAnimations().map(a=>a.effect.getTiming().duration);closeModal();");
        assertEquals("sheet close waits for exit","false",js("modal.open"));
        assertEquals("sheet token or low-device suppression","true",js("window.__p8sheet[0]===220||(!window.__p8sheet.length&&GalaxyChatMotion.constrained())"));
        awaitJs("!document.querySelector('.chat-motion-ghost')");
        runJs("openChatMessageMenu(chatState.messages[0].id);window.__p8menu=modal.querySelector('.modal-inner').getAnimations().map(a=>a.effect.getTiming().duration);closeModal();");
        assertEquals("menu token or low-device suppression","true",js("window.__p8menu[0]===160||(!window.__p8menu.length&&GalaxyChatMotion.constrained())"));

        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),Manifest.permission.RECORD_AUDIO);
        runJs("ensureChatComposer().accepted();chatRenderComposer();beginChatHoldRecording({pointerId:123,clientX:100,clientY:100},document.querySelector('.chat-send'));");
        awaitJs("chatVoiceEngine.snapshot().state==='recording_hold'");
        SystemClock.sleep(800);
        runJs("window.__p8wave=document.querySelector('.chat-voice-waveform i');chatVoiceEngine.lock();chatVoiceRefreshInline();");
        assertEquals("recording_locked",js("chatVoiceEngine.snapshot().state"));
        runJs("window.__p8wave=document.querySelector('.chat-voice-waveform i');chatVoiceRefreshInline();");
        assertEquals("waveform recreates DOM on each sample","true",js("window.__p8wave===document.querySelector('.chat-voice-waveform i')"));
        runJs("finishChatHoldRecording();");
        awaitJs("chatVoiceEngine.snapshot().state==='preview'");
        runJs("document.querySelector('[data-action=\"chat-voice-preview\"]').click();");
        SystemClock.sleep(300);
        runJs("document.querySelector('[data-action=\"chat-voice-discard\"]').click();");
        awaitJs("chatVoiceEngine.snapshot().state==='idle'");
        runJs("beginChatHoldRecording({pointerId:124,clientX:100,clientY:100},document.querySelector('.chat-send'));");
        awaitJs("chatVoiceEngine.snapshot().state==='recording_hold'");
        runJs("finishChatHoldRecording({cancel:true});");
        awaitJs("!document.querySelector('.chat-voice-inline')");

        String animatorScale=shell("settings get global animator_duration_scale").trim();
        boolean initialReduced=Boolean.parseBoolean(js("nativeState().reducedMotion===true"));
        try{
            shell("settings put global animator_duration_scale 0");
            scenario.moveToState(Lifecycle.State.CREATED);scenario.moveToState(Lifecycle.State.RESUMED);
            awaitJs("nativeState().reducedMotion===true");
            assertEquals("native reduced motion not applied","true",js("GalaxyChatMotion.reduced()"));
            runJs("window.__p8reduced=GalaxyChatMotion.animate(document.querySelector('.chat-send'),'feedback')?.effect.getKeyframes()||[];");
            assertEquals("reduced motion retains translation","false",js("window.__p8reduced.some(f=>f.transform&&f.transform!=='none')"));
        }finally{shell("null".equals(animatorScale)?"settings delete global animator_duration_scale":"settings put global animator_duration_scale "+animatorScale);}
        scenario.moveToState(Lifecycle.State.CREATED);scenario.moveToState(Lifecycle.State.RESUMED);
        awaitJs("nativeState().reducedMotion==="+initialReduced);
        awaitJs("!chatResumeRefreshPromise&&!chatLoading&&!chatVirtualRaf&&!chatMeasureRaf&&!chatScrollEngine.isProgrammatic()");
        runJs("window.__p8resumeSettled=false;function settle(){if(chatResumeRefreshPromise||chatLoading||chatVirtualRaf||chatMeasureRaf||chatScrollEngine.isProgrammatic()){requestAnimationFrame(settle);return;}requestAnimationFrame(()=>requestAnimationFrame(()=>{if(chatResumeRefreshPromise||chatLoading||chatVirtualRaf||chatMeasureRaf||chatScrollEngine.isProgrammatic())settle();else window.__p8resumeSettled=true;}));}settle();");
        awaitJs("window.__p8resumeSettled");
        runJs("chatState={...(chatState||{}),messages:Array.from({length:20000},(_,i)=>({id:'p8-'+i,client_id:'p8c-'+i,sender_person:String(i%2),body:'Motion '+i,message_type:'text',attachments:[],server_seq:i+1,created_at:'2026-10-06T12:00:00Z',reactions:[]})),nextBeforeSeq:null,nextAfterSeq:null};chatMessageEngine.resetWindow(20000,{align:'end'});chatRenderMessages({scroll:'bottom'});");
        awaitJs("document.querySelectorAll('.chat-message').length===84");
        runJs("chatRenderMessages({scroll:'bottom'});render();window.__p8pendingReset=chatBottomRenderPending===null;");
        assertEquals("full render leaked bottom intent","true",js("window.__p8pendingReset"));
        runJs("window.__p8settled=false;requestAnimationFrame(()=>requestAnimationFrame(()=>window.__p8settled=true));");
        awaitJs("window.__p8settled");
        SystemClock.sleep(500);
        runJs("GalaxyChatPerf.reset();const e=document.querySelector('#chatMessages');window.__p8before={children:[...e.children].slice(0,5).map(x=>({tag:x.tagName,id:x.dataset.chatId,spacer:x.dataset.chatSpacer,style:x.style.height,box:x.getBoundingClientRect().top})),range:chatMessageEngine.range(chatRows()).start,top:e.scrollTop,height:e.scrollHeight,box:e.getBoundingClientRect().toJSON(),first:e.querySelector('.chat-message').getBoundingClientRect().toJSON(),last:e.querySelector('.chat-message:last-child')?.getBoundingClientRect().toJSON()};window.__p8start=e.scrollTop;e.scrollTop-=200;chatScrollEngine.onScroll(e);window.__p8anchor=chatCaptureAnchor(e);chatRenderMessages({anchor:window.__p8anchor});");
        SystemClock.sleep(350);
        assertTrue("motion drifts anchor: "+js("JSON.stringify({before:window.__p8before,anchor:window.__p8anchor,offset:chatViewportOffsetFor(window.__p8anchor.id),range:chatMessageEngine.range(chatRows()).start,perf:GalaxyChatPerf.report()})"),Math.abs(Double.parseDouble(js("chatViewportOffsetFor(window.__p8anchor.id)"))-Double.parseDouble(js("window.__p8anchor.offset")))<4);
        assertEquals("virtualization replays entries","0",js("GalaxyChatPerf.report().events.filter(e=>e.type==='motion-entry').length"));
        long cpuBefore=android.os.Process.getElapsedCpuTime(),pssBefore=android.os.Debug.getPss();
        runJs("window.__p8frames=[];window.__p8finished=false;const e=document.querySelector('#chatMessages'),base=e.scrollTop;let last=0,start=0;function sample(t){if(!start)start=t;if(last)window.__p8frames.push(t-last);last=t;const load=performance.now();while(performance.now()-load<4){}e.scrollTop=base+Math.sin((t-start)/90)*100;GalaxyChatMotion.animate(document.querySelector('.chat-send'),'feedback');if(t-start<1200)requestAnimationFrame(sample);else window.__p8finished=true;}requestAnimationFrame(sample);");
        awaitJs("window.__p8finished");
        JSONObject frames=new JSONObject(js("JSON.stringify((()=>{const a=window.__p8frames,total=a.reduce((s,v)=>s+v,0);return {fps:a.length*1000/total,frameMs:total/a.length,dropped:a.filter(v=>v>34).length,worst:Math.max(...a)};})())"));
        if(isPhysicalDevice())assertTrue("motion repeatedly drops frames: "+frames,frames.getInt("dropped")<=3);
        if(isPhysicalDevice())assertTrue("motion below 50 FPS: "+frames,frames.getDouble("fps")>=50);
        JSONObject metrics=new JSONObject().put("frames",frames).put("cpuMs",android.os.Process.getElapsedCpuTime()-cpuBefore)
            .put("pssBeforeKb",pssBefore).put("pssAfterKb",android.os.Debug.getPss()).put("sendVisualMs",send.getDouble("ms"))
            .put("logicalMessages",20000).put("renderedMessages",Integer.parseInt(js("document.querySelectorAll('.chat-message').length")))
            .put("motionTimings",new JSONArray(js("JSON.stringify(window.__p8timings||[])")))
            .put("perf",new JSONObject(js("JSON.stringify((()=>{const p=GalaxyChatPerf.report();return {...p,events:p.events.slice(-8)};})())")));
        System.out.println("GALAXY_CHAT_PHASE8_ANDROID="+metrics);
    }

    @Test public void chatMotionBenchmark20k_device() throws Exception {
        String minimum=shell("settings get system min_refresh_rate").trim(),peak=shell("settings get system peak_refresh_rate").trim();
        try {
        shell("settings put system min_refresh_rate 60");shell("settings put system peak_refresh_rate 60");
        launchChat();
        runJs("chatState={...(chatState||{}),messages:Array.from({length:20000},(_,i)=>({id:'bench-'+i,client_id:'benchc-'+i,sender_person:String(i%2),body:'Benchmark '+i,message_type:'text',attachments:[],server_seq:i+1,created_at:'2026-10-06T12:00:00Z',reactions:[]})),nextBeforeSeq:null,nextAfterSeq:null};chatMessageEngine.resetWindow(20000,{align:'end'});chatRenderMessages({scroll:'bottom'});");
        awaitJs("document.querySelectorAll('.chat-message').length===84");
        SystemClock.sleep(1500);
        for(int trial=1;trial<=3;trial++){
        runJs("GalaxyChatPerf.enable(true);GalaxyChatPerf.reset();");
        long cpu=android.os.Process.getElapsedCpuTime(),pss=android.os.Debug.getPss();
        runJs("window.__benchResult=null;const frames=[],e=document.querySelector('#chatMessages'),input=document.querySelector('#chatForm textarea'),base=e.scrollTop;let start=0,last=0,count=0;function tick(t){if(!start)start=t;if(last)frames.push(t-last);last=t;const busy=performance.now();while(performance.now()-busy<4){}e.scrollTop=base+Math.sin((t-start)/90)*100;if(count++%6===0){input.value=input.value?'':'QA';input.dispatchEvent(new Event('input',{bubbles:true}));}if(t-start<1200)requestAnimationFrame(tick);else {const total=frames.reduce((s,v)=>s+v,0);window.__benchResult={fps:frames.length*1000/total,frameMs:total/frames.length,dropped:frames.filter(v=>v>34).length,worst:Math.max(...frames),motion:!!window.GalaxyChatMotion};}}requestAnimationFrame(tick);");
        awaitJs("!!window.__benchResult");
        JSONObject metrics=new JSONObject(js("JSON.stringify(window.__benchResult)"));
        metrics.put("trial",trial).put("cpuMs",android.os.Process.getElapsedCpuTime()-cpu).put("pssBeforeKb",pss).put("pssAfterKb",android.os.Debug.getPss())
            .put("logicalMessages",20000).put("renderedMessages",Integer.parseInt(js("document.querySelectorAll('.chat-message').length")))
            .put("perf",new JSONObject(js("JSON.stringify((()=>{const p=GalaxyChatPerf.report();return {...p,events:p.events.slice(-8)};})())")));
        System.out.println("GALAXY_CHAT_MOTION_BENCHMARK="+metrics);
        if(isPhysicalDevice())assertTrue("scroll and Composer below 50 FPS: "+metrics,metrics.getDouble("fps")>=50);
        if(isPhysicalDevice())assertTrue("recurrent dropped frames: "+metrics,metrics.getInt("dropped")<=3);
        }
        } finally {
            shell("null".equals(minimum)?"settings delete system min_refresh_rate":"settings put system min_refresh_rate "+minimum);
            shell("null".equals(peak)?"settings delete system peak_refresh_rate":"settings put system peak_refresh_rate "+peak);
        }
    }

    @Test public void chatPhase9MediaPerformance_realWebView20kLazyCacheAndMemoryPressure() throws Exception {
        String minimum=shell("settings get system min_refresh_rate").trim(),peak=shell("settings get system peak_refresh_rate").trim();
        try {
        shell("settings put system min_refresh_rate 60");shell("settings put system peak_refresh_rate 60");
        launchChat();
        awaitJs("!!window.GalaxyChatMedia&&!!document.querySelector('#chatMessages')");
        runJs("GalaxyChatPerf.enable(true);GalaxyChatPerf.reset();");
        long pssBefore=android.os.Debug.getPss(),cpuBefore=android.os.Process.getElapsedCpuTime();
        String thumb="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
        runJs("const __p9thumb="+JSONObject.quote(thumb)+";chatState={...(chatState||{}),messages:Array.from({length:20000},(_,i)=>{const media=i%40===0,video=media&&i%120===0;return {id:'p9-'+i,client_id:'p9c-'+i,sender_person:String(i%2),body:media?'':'Media benchmark '+i,message_type:media?(video?'video':'photo'):'text',attachments:media?[{id:'p9asset-'+i,cacheKey:'p9asset-'+i,kind:video?'video':'photo',mime:video?'video/mp4':'image/jpeg',name:'Media '+i,width:1600,height:900,durationMs:video?8000:null,url:'https://zqiknzivfahvvadmxrvt.supabase.co/storage/v1/object/sign/galaxy-chat-media/original-'+i+(video?'.mp4':'.jpg')+'?token=phase9',thumbnailUrl:__p9thumb}]:[],server_seq:i+1,created_at:'2026-10-06T12:00:00Z',reactions:[]};}),nextBeforeSeq:null,nextAfterSeq:null};chatMessageEngine.resetWindow(20000,{align:'end'});chatRenderMessages({scroll:'bottom'});");
        awaitJs("document.querySelectorAll('.chat-message').length===84");
        runJs("document.querySelector('[data-chat-media]')?.scrollIntoView({block:'center'});");
        awaitJs("chatMediaEngine.stats().cacheEntries>0");
        assertEquals("bubble loaded an original before explicit open","0",js("document.querySelectorAll('[data-chat-media][src^=\"https://\"]').length"));
        assertEquals("video/audio initialized a source off intent","0",js("document.querySelectorAll('video[src],audio[src]').length"));
        assertEquals("original opened without user intent","0",js("chatMediaEngine.stats().originalOpens"));
        assertTrue("media cache exceeded bound",Integer.parseInt(js("chatMediaEngine.stats().cacheEntries"))<=96);

        runJs("GalaxyChatPerf.reset();const m=document.querySelector('[data-media-kind=\"photo\"]');if(m){m.removeAttribute('src');m.dataset.mediaLoaded='false';m.dataset.mediaWanted='true';chatMediaEngine.retry(m);}");
        awaitJs("document.querySelector('[data-media-kind=\"photo\"]')?.dataset.mediaLoaded==='true'");
        SystemClock.sleep(250);
        assertEquals("thumbnail decode changed reserved bubble geometry","0",js("GalaxyChatPerf.report().layoutShifts.count"));

        runJs("GalaxyChatPerf.reset();window.__p9frames=[];window.__p9done=false;const e=document.querySelector('#chatMessages'),base=e.scrollTop;let start=0,last=0;function tick(t){if(!start)start=t;if(last)__p9frames.push(t-last);last=t;e.scrollTop=base+Math.sin((t-start)/80)*900;if(t-start<1200)requestAnimationFrame(tick);else window.__p9done=true;}requestAnimationFrame(tick);");
        awaitJs("window.__p9done");
        JSONObject frames=new JSONObject(js("JSON.stringify((()=>{const a=window.__p9frames,total=a.reduce((s,v)=>s+v,0);return {fps:a.length*1000/total,frameMs:total/a.length,dropped:a.filter(v=>v>34).length,worstMs:Math.max(...a)};})())"));
        if(isPhysicalDevice())assertTrue("media scroll below 50 FPS: "+frames,frames.getDouble("fps")>=50);
        if(isPhysicalDevice())assertTrue("media scroll repeatedly drops frames: "+frames,frames.getInt("dropped")<=3);

        scenario.onActivity(activity->activity.onTrimMemory(android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW));
        awaitJs("chatMediaEngine.stats().cacheEntries===0");
        scenario.moveToState(Lifecycle.State.CREATED);scenario.moveToState(Lifecycle.State.RESUMED);
        awaitJs("document.visibilityState==='visible'");
        awaitJs("!!document.querySelector('#chatMessages')");

        long pssAfter=android.os.Debug.getPss();
        if(isPhysicalDevice())assertTrue("media benchmark retained excessive PSS: "+(pssAfter-pssBefore)+" KB",pssAfter-pssBefore<96*1024);
        JSONObject metrics=new JSONObject()
            .put("device",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL)
            .put("logicalMessages",20000).put("distributedVisualMedia",500)
            .put("renderedMessages",Integer.parseInt(js("document.querySelectorAll('.chat-message').length")))
            .put("media",new JSONObject(js("JSON.stringify(chatMediaEngine.stats())")))
            .put("frames",frames)
            .put("cpuMs",android.os.Process.getElapsedCpuTime()-cpuBefore)
            .put("pssBeforeKb",pssBefore).put("pssAfterKb",pssAfter)
            .put("perf",new JSONObject(js("JSON.stringify(GalaxyChatPerf.report())")));
        System.out.println("GALAXY_CHAT_PHASE9_ANDROID="+metrics);
        } finally {
            shell("null".equals(minimum)?"settings delete system min_refresh_rate":"settings put system min_refresh_rate "+minimum);
            shell("null".equals(peak)?"settings delete system peak_refresh_rate":"settings put system peak_refresh_rate "+peak);
        }
    }

    @Test public void chatPhase10ProcessRecreation_restoresDraftOutboxAndAttachments() throws Exception {
        launchChat();
        runJs("const t=document.querySelector('#chatForm textarea');t.value='phase10 process draft';t.dispatchEvent(new Event('input',{bubbles:true}));chatAttachmentsDraft=[{path:'content://phase10/pending-photo',kind:'photo',mime:'image/jpeg',name:'pending.jpg',url:'https://signed.invalid/original.jpg?token=secret',thumbnailUrl:'https://signed.invalid/thumb.jpg?token=secret'}];writeChatAttachmentsDraft();writeChatOutbox([{client_id:'phase10-pending',sender_person:String(cloud?.person||0),body:'pending restore',message_type:'text',attachments:[],_localState:'PENDING',created_at:new Date().toISOString()}]);");
        awaitJs("ensureChatComposer().snapshot().text==='phase10 process draft'");
        assertEquals("1",js("chatAttachmentsDraft.length"));
        assertEquals("1",js("readChatOutbox().filter(x=>x.client_id==='phase10-pending').length"));
        assertEquals("false",js("localStorage.getItem(CHAT_ATTACHMENTS_DRAFT_KEY).includes('token=secret')"));

        scenario.close();scenario=null;
        launch();
        assertEquals("1",js("readChatOutbox().filter(x=>x.client_id==='phase10-pending').length"));
        assertEquals("false",js("(localStorage.getItem(CHAT_ATTACHMENTS_DRAFT_KEY)||'').includes('token=secret')"));
        launchChat();
        awaitJs("ensureChatComposer().snapshot().text==='phase10 process draft'");
        assertEquals("1",js("chatAttachmentsDraft.filter(x=>x.path==='content://phase10/pending-photo').length"));

        runJs("ensureChatComposer().accepted();chatAttachmentsDraft=[];writeChatAttachmentsDraft();writeChatOutbox(readChatOutbox().filter(x=>x.client_id!=='phase10-pending'));chatRenderComposer();");
        System.out.println("GALAXY_CHAT_PHASE10_RESTORE={\"draft\":true,\"outbox\":true,\"attachments\":true,\"signedUrlsPersisted\":false}");
    }

    @Test public void chatPhase10AndroidPerformance_longSessionLifecycleAndMemoryStayBounded() throws Exception {
        launchChat();
        awaitJs("!!window.GalaxyChatMedia&&!!document.querySelector('#chatMessages')");
        long requested=Long.parseLong(InstrumentationRegistry.getArguments().getString("phase10SoakMs","60000"));
        long soakMs=Math.max(30_000L,Math.min(1_800_000L,requested));
        runJs("GalaxyChatPerf.enable(true);GalaxyChatPerf.reset();chatState={...(chatState||{}),messages:Array.from({length:20000},(_,i)=>({id:'p10-'+i,client_id:'p10c-'+i,sender_person:String(i%2),body:'Android soak '+i,message_type:'text',attachments:[],server_seq:i+1,created_at:'2026-10-06T12:00:00Z',reactions:[]})),nextBeforeSeq:null,nextAfterSeq:null};chatMessageEngine.resetWindow(20000,{align:'end'});chatRenderMessages({scroll:'bottom'});");
        awaitJs("document.querySelectorAll('.chat-message').length===84");
        long pssBefore=android.os.Debug.getPss(),cpuBefore=android.os.Process.getElapsedCpuTime();
        long end=SystemClock.elapsedRealtime()+soakMs;
        int iterations=0,lifecycleCycles=0,memoryPressures=0;
        while(SystemClock.elapsedRealtime()<end){
            int direction=(iterations%2==0)?-1:1;
            runJs("(()=>{const e=document.querySelector('#chatMessages');if(e)e.scrollTop=Math.max(0,Math.min(e.scrollHeight-e.clientHeight,e.scrollTop+"+(direction*720)+"));})()");
            if(iterations%15==0){
                scenario.moveToState(Lifecycle.State.CREATED);
                SystemClock.sleep(120);
                UiDevice.getInstance(instrumentation).wakeUp();
                shell("wm dismiss-keyguard");
                scenario.moveToState(Lifecycle.State.RESUMED);
                awaitJs("document.visibilityState==='visible'&&!!document.querySelector('#chatMessages')");
                lifecycleCycles++;
            }
            if(iterations%30==0){
                scenario.onActivity(activity->activity.onTrimMemory(android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW));
                memoryPressures++;
            }
            assertTrue("virtualized window grew during soak",Integer.parseInt(js("document.querySelectorAll('.chat-message').length"))<=84);
            SystemClock.sleep(850);
            iterations++;
        }
        long pssAfter=android.os.Debug.getPss(),cpuAfter=android.os.Process.getElapsedCpuTime();
        if(isPhysicalDevice())assertTrue("phase10 soak retained excessive PSS: "+(pssAfter-pssBefore)+" KB",pssAfter-pssBefore<128*1024);
        JSONObject metrics=new JSONObject()
            .put("device",android.os.Build.MANUFACTURER+" "+android.os.Build.MODEL)
            .put("soakMs",soakMs).put("iterations",iterations)
            .put("lifecycleCycles",lifecycleCycles).put("memoryPressures",memoryPressures)
            .put("renderedMessages",Integer.parseInt(js("document.querySelectorAll('.chat-message').length")))
            .put("pssBeforeKb",pssBefore).put("pssAfterKb",pssAfter)
            .put("cpuMs",cpuAfter-cpuBefore)
            .put("perf",new JSONObject(js("JSON.stringify(GalaxyChatPerf.report())")));
        System.out.println("GALAXY_CHAT_PHASE10_ANDROID="+metrics);
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
        runJs("document.activeElement?.blur();");
        scenario.onActivity(activity -> ((android.view.inputmethod.InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(activity.getWindow().getDecorView().getWindowToken(),0));
        SystemClock.sleep(300);
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

        scenario.onActivity(a -> a.captureChatPhoto("qa-camera"));
        SystemClock.sleep(900);
        assertEquals("Integrated chat camera must remain inside Nuestra Galaxia.", pkg, device.getCurrentPackageName());
        String top = shell("dumpsys activity activities | grep -m1 -E 'mResumedActivity|topResumedActivity'");
        if (top.contains("GalaxyCameraActivity")) device.pressBack();

        // Microphone path is executed only when the emulator exposes an input source.
        scenario.onActivity(a -> a.startVoiceRecording("qa-mic"));
        SystemClock.sleep(700);
        scenario.onActivity(a -> a.stopVoiceRecording("qa-mic-stop"));
        awaitJs("!!document.querySelector('#app')");
    }

    private boolean isPhysicalDevice() {
        return !android.os.Build.HARDWARE.equals("ranchu") && !android.os.Build.HARDWARE.equals("goldfish")
            && !android.os.Build.MODEL.contains("sdk_gphone") && !android.os.Build.MODEL.contains("Emulator");
    }

    private void launch() {
        scenario = ActivityScenario.launch(MainActivity.class);
        scenario.onActivity(activity -> activity.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
        awaitJs("!!document.querySelector('#app')");
        awaitJs("document.body.innerText.includes('Nuestra Galaxia')");
        awaitJs("document.visibilityState==='visible'");
    }

    private void launchChat() {
        if (scenario == null) launch();
        runJs("document.querySelector('#chatFab')?.click()");
        awaitJs("!!document.querySelector('.chat-shell')");
        awaitCondition(() -> backend.actions().contains("chat-state"), UI_TIMEOUT_MS);
        runJs("document.activeElement?.blur();");
        scenario.onActivity(activity -> ((android.view.inputmethod.InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(activity.getWindow().getDecorView().getWindowToken(),0));
        SystemClock.sleep(300);
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
        // CSS pixels use one scale on both axes, including while IME insets settle.
        int y = v[1] + (int)Math.round(g.getDouble("y") * v[2] / Math.max(1d, g.getDouble("vw")));
        assertTrue("Unable to tap WebView element: " + selector, UiDevice.getInstance(instrumentation).click(x, y));
        SystemClock.sleep(250);
        if (!"true".equals(js("document.activeElement===document.querySelector(" + quoted + ")"))) {
            // Headless emulator screen coordinates can lag the WebView's resized surface.
            // Deliver an actual Android touch to the current view, never DOM focus().
            JSONObject current = new JSONObject(js("JSON.stringify((()=>{const r=document.querySelector(" + quoted + ").getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2,vw:innerWidth};})())"));
            scenario.onActivity(activity -> {
                WebView web = activity.findViewById(R.id.webView);
                float scale = (float)(web.getWidth()/Math.max(1d,current.optDouble("vw")));
                float localX = (float)current.optDouble("x")*scale, localY = (float)current.optDouble("y")*scale;
                long time = SystemClock.uptimeMillis();
                android.view.MotionEvent down = android.view.MotionEvent.obtain(time,time,android.view.MotionEvent.ACTION_DOWN,localX,localY,0);
                android.view.MotionEvent up = android.view.MotionEvent.obtain(time,time+80,android.view.MotionEvent.ACTION_UP,localX,localY,0);
                try { web.dispatchTouchEvent(down);web.dispatchTouchEvent(up); }
                finally { down.recycle();up.recycle(); }
            });
            SystemClock.sleep(250);
            System.out.println("GALAXY_WEBVIEW_TAP="+js("JSON.stringify({selector:"+quoted+",focused:document.activeElement===document.querySelector("+quoted+"),active:document.activeElement?.tagName,visible:document.visibilityState,viewport:{w:innerWidth,h:innerHeight},rect:document.querySelector("+quoted+").getBoundingClientRect().toJSON()})"));
        }
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
