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
        typeAndroidWebInput("QA_keyboard");

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

    /**
     * Visual Evolution P1: instrument the actual Android WebView against the isolated
     * QaHttpServer account. No real couple account, GPS, media or backend is used.
     * These are interaction/layout assertions, not owner-approved screenshot QA.
     */
    @Test public void visualEvolutionP2_dailyQuestionStatus_isAccessibleAndPrivateOnRealAndroid() throws Exception {
        launch();
        awaitJs("!!document.querySelector('.galaxy-welcome .date-question-card')"
            + " && document.querySelectorAll('.date-question-person').length===2");
        JSONObject evidence=new JSONObject(js("JSON.stringify((()=>{"
            + "const card=document.querySelector('.date-question-card'),"
            + "chips=[...card.querySelectorAll('.date-question-person')],"
            + "favorite=card.querySelector('[data-action=date-question-favorite]'),"
            + "memory=card.querySelector('[data-action=date-question-memory]'),"
            + "own=ownDaily(),partner=partnerDaily(),"
            + "finished=!!own.answer&&!!partner.answer,"
            + "text=chips.map(c=>c.textContent).join(' '),"
            + "leaks=[own.answer,partner.answer].some(a=>typeof a==='string'&&a.length>6&&text.includes(a));"
            + "return {count:chips.length,"
            + "myLabel:chips[0].getAttribute('aria-label'),"
            + "partnerLabel:chips[1].getAttribute('aria-label'),"
            + "heights:chips.map(c=>c.getBoundingClientRect().height),"
            + "favoritePressed:favorite?.getAttribute('aria-pressed'),"
            + "favoriteExpected:dateContext?.question?.favorite?'true':'false',"
            + "memoryDisabled:!!memory?.disabled,finished,"
            + "group:card.querySelector('.date-question-person-status')?.getAttribute('role'),"
            + "leaksPrivateAnswer:leaks,"
            + "noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+3};})())"));
        assertEquals("Expected exactly two individual daily answer indicators",2,evidence.getInt("count"));
        assertTrue("Own answer status must be labeled",evidence.getString("myLabel").startsWith("Tu respuesta: "));
        assertTrue("Partner answer status must be labeled",evidence.getString("partnerLabel").startsWith("La otra respuesta: "));
        JSONArray heights=evidence.getJSONArray("heights");
        for(int i=0;i<heights.length();i++)
            assertTrue("Daily answer indicator is too small for touch accessibility",
                heights.getDouble(i)>=44d);
        assertEquals("group",evidence.getString("group"));
        assertEquals("Favorite state not exposed correctly",evidence.getString("favoriteExpected"),
            evidence.getString("favoritePressed"));
        assertEquals("Memory CTA must be gated until both respond",
            !evidence.getBoolean("finished"),evidence.getBoolean("memoryDisabled"));
        assertFalse("Individual status revealed a private answer",evidence.getBoolean("leaksPrivateAnswer"));
        assertTrue("Daily status introduced horizontal scroll",evidence.getBoolean("noHorizontalOverflow"));
        System.out.println("V5_P2_DAILY_QUESTION_STATUS=verified;badges:2;private:true");
    }

    @Test public void visualEvolutionP2_privacyShortcut_opensFocusedControlsWithoutChangingSharing() throws Exception {
        launch();
        awaitJs("!!document.querySelector('.galaxy-welcome .now-section [data-action=\\\"now-settings\\\"]')");
        String privacyBefore=js("JSON.stringify({battery:ownPresence().shareBattery===true,"
            + "listening:ownPresence().shareListening===true,tracking:!!native.tracking})");

        // Exercise the REAL Android WebView event delegation and full page
        // navigation, not a static source substring or hand-built HTML.
        runV5Js("document.querySelector('.now-section [data-action=\\\"now-settings\\\"]').click()");
        awaitJs("view==='more' && !!document.getElementById('presencePrivacySettings')"
            + " && document.activeElement?.id==='presencePrivacySettings'");
        JSONObject result=new JSONObject(js("JSON.stringify((()=>{"
            + "const panel=document.getElementById('presencePrivacySettings'),"
            + "r=panel.getBoundingClientRect(),"
            + "actions=Array.from(panel.querySelectorAll('.privacy-toggle')).map(x=>x.dataset.action);"
            + "return {visible:r.bottom>0&&r.top<innerHeight&&getComputedStyle(panel).display!=='none',"
            + "focused:document.activeElement===panel,"
            + "region:panel.getAttribute('role'),"
            + "label:panel.getAttribute('aria-labelledby'),actions};})())"));
        assertTrue("Privacy settings panel is not visibly reachable in More",result.getBoolean("visible"));
        assertTrue("Privacy deep link failed to focus the destination",result.getBoolean("focused"));
        assertEquals("region",result.getString("region"));
        assertEquals("presencePrivacyHeading",result.getString("label"));
        JSONArray actions=result.getJSONArray("actions");
        assertEquals("Privacy controls count must remain intact",3,actions.length());
        assertEquals("presence-battery",actions.getString(0));
        assertEquals("presence-listening",actions.getString(1));
        assertEquals("map",actions.getString(2));
        String privacyAfter=js("JSON.stringify({battery:ownPresence().shareBattery===true,"
            + "listening:ownPresence().shareListening===true,tracking:!!native.tracking})");
        assertEquals("Navigating to privacy must never modify sharing settings",
            privacyBefore,privacyAfter);
        System.out.println("V5_P2_PRIVACY_DEEP_LINK=verified;controls:3;sharingUnchanged:true");
    }

    @Test public void visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe() throws Exception {
        launch();
        awaitJs("!!document.querySelector('#bottomNav .nav-btn.active') && !!document.querySelector('#chatFab:not(.hidden)')");
        assertEquals("true", js("!!document.querySelector('link[href=\"./celestial-shell.css\"]')"
            + " && !!window.GalaxyCelestialShell && document.querySelectorAll('#bottomNav .nav-btn').length===6"));

        // P2 Welcome must be backed by REAL paired QA state and keep all entry points.
        assertEquals("P2 Welcome not loaded from Android APK", "true",
            jsWithDeadline("!!document.querySelector('link[href=\"./galaxy-welcome.css\"]')"
              + " && !!document.querySelector('.galaxy-welcome .welcome-hero')"
              + " && document.querySelectorAll('.welcome-bento .action-card').length===5"
              + " && !!document.querySelector('.welcome-rituals')"
              + " && !!document.querySelector('.welcome-connection')",20));

        // QA-only proof-of-paint marker, not a product UI element. A previous
        // Android run showed a stale pairing screen although the in-process
        // WebView navigation had finished loading. Verify actual display pixels
        // before accepting any of the seven theme screenshots.
        runV5Js("document.querySelector('[data-view=\\\"home\\\"]')?.click()");
        awaitJs("document.querySelector('#bottomNav .nav-btn.active')?.dataset.view==='home'"
            + " && getComputedStyle(document.getElementById('bottomNav')).display!=='none'");
        runV5Js("const marker=document.createElement('div');marker.id='v5-qa-paint-marker';"
            + "marker.setAttribute('aria-hidden','true');"
            + "marker.style.cssText='position:fixed;top:8px;left:8px;width:64px;height:8px;'+"
            + "'background:#07e1f7;z-index:2147483647;pointer-events:none';"
            + "document.body.appendChild(marker)");
        awaitJs("!!document.getElementById('v5-qa-paint-marker')");
        awaitV5QaPainted("before-first-theme");

        // Run one cheap WebView callback per theme. The old one-shot call
        // applied all seven themes and computed their luminance in one
        // evaluateJavascript invocation; the emulator's 5-second JS callback
        // deadline could expire without indicating a contrast problem.
        org.json.JSONArray samples = new org.json.JSONArray();
        for (String theme : new String[]{"daylight","cosmic","halloween","christmas",
                "valentine","friendship","easter"}) {
            runV5Js("GalaxyTheme.applyTheme('" + theme + "')");
            long themeStarted = SystemClock.elapsedRealtime();
            String raw = jsWithDeadline("JSON.stringify((()=>{const e=document.createElement('button');"
                + "e.className='btn';document.body.appendChild(e);"
                + "const s=getComputedStyle(e);const active=document.documentElement.dataset.theme;"
                + "const bg=s.backgroundColor,fg=s.color;e.remove();"
                + "return {active,bg,fg}})())", 20);
            long themeJsMs = SystemClock.elapsedRealtime()-themeStarted;
            System.out.println("V5_P1_THEME_WEBVIEW_LATENCY_MS=" + theme + ":" + themeJsMs);
            assertTrue("P1 Android WebView computed color failed in " + theme + ": " + raw,
                raw.startsWith("{"));
            JSONObject colors = new JSONObject(raw);
            assertEquals("Theme did not resolve in Android WebView", theme, colors.getString("active"));
            double contrast = v5ColorContrast(colors.getString("bg"), colors.getString("fg"));
            assertTrue("P1 action contrast below WCAG AA in " + theme + ": " + contrast,
                contrast >= 4.5d);
            samples.put(new JSONObject().put("id",theme)
                .put("active",colors.getString("active")).put("contrast",contrast));
            // Check the REAL display, not just JS state: no pairing overlay or
            // stale screen may pass as a themed home screenshot.
            awaitJs("document.documentElement.dataset.theme==='" + theme + "'"
                + " && document.querySelector('#bottomNav .nav-btn.active')?.dataset.view==='home'");
            awaitV5QaPainted(theme);
            shell("screencap -p /sdcard/Download/V5-P1-synthetic-" + theme + ".png");

            // P3 seven-theme evidence MUST render the actual Android modal
            // above the home surface; P1 theme screenshots alone do not prove
            // the search and notification color/viewport contracts.
            int themedCssWidth=Integer.parseInt(js("String(Math.round(innerWidth))"));
            android.graphics.Bitmap themedHome=instrumentation.getUiAutomation().takeScreenshot();
            assertNotNull("P3 themed home baseline framebuffer missing",themedHome);
            try {
                runV5Js("openUniversalSearch();"
                    + "document.getElementById('universalSearchResults').innerHTML="
                    + "GalaxyDiscoveryV5.renderClassic([{type:'item',kind:'memory',"
                    + "id:'p3-theme-memory',title:'Recuerdo de QA',"
                    + "subtitle:'Texto de verificacion del tema actual'}],"
                    + "{ico,esc,attr,kindMeta})");
                awaitJs("modal.open && modal.dataset.form==='v5-p3-search'"
                    + " && document.querySelectorAll('.v5-p3-search .universal-search-result').length===1");
                String searchColors=jsWithDeadline("JSON.stringify((()=>{"
                    + "const panel=modal.querySelector('.modal-inner'),title=panel.querySelector('h2');"
                    + "return {bg:getComputedStyle(modal).backgroundColor,"
                    + "fg:getComputedStyle(title).color,"
                    + "theme:document.documentElement.dataset.theme,"
                    + "inside:panel.getBoundingClientRect().left>=-2"
                    + "&&panel.getBoundingClientRect().right<=innerWidth+2};})())",20);
                JSONObject searchPalette=new JSONObject(searchColors);
                assertEquals("P3 search theme mismatch",theme,searchPalette.getString("theme"));
                assertTrue("P3 search modal width outside viewport in "+theme,
                    searchPalette.getBoolean("inside"));
                assertTrue("P3 search title contrast below WCAG AA in "+theme+": "+searchColors,
                    v5ColorContrast(searchPalette.getString("bg"),
                        searchPalette.getString("fg"))>=4.5d);
                runV5Js("const box=modal.querySelector('.modal-inner');"
                    + "box.style.position='relative';const marker=document.createElement('span');"
                    + "marker.id='v5-p3-qa-paint';"
                    + "marker.style.cssText='position:absolute;top:12px;left:14px;'+"
                    + "'width:72px;height:18px;background:#1bd7ab;z-index:2147483647;pointer-events:none';"
                    + "box.append(marker)");
                awaitV5P3ModalPainted(themedHome,themedCssWidth,"search-theme-"+theme,27,215,171);
                shell("screencap -p /sdcard/Download/V5-P3-theme-search-"+theme+".png");
                runV5Js("closeModal()");

                runV5Js("notificationState={unread:1,notifications:["
                    + "{id:'theme-qa',event_type:'chat_message',action:'chat',"
                    + "created_at:'2026-10-14T12:00:00Z',title:'Aviso QA',"
                    + "body:'Notificacion sintetica para revisar apariencia',read_at:null}"
                    + "]};v5NotificationFilter='all';"
                    + "showModal('Notificaciones',"
                    + "'<div class=\"v5-notification-mount\"></div>',"
                    + "'v5-p3-notifications');renderV5NotificationPanel()");
                awaitJs("modal.open && modal.dataset.form==='v5-p3-notifications'"
                    + " && document.querySelectorAll('.notification-row').length===1");
                String notificationsColors=jsWithDeadline("JSON.stringify((()=>{"
                    + "const panel=modal.querySelector('.modal-inner'),title=panel.querySelector('h2');"
                    + "return {bg:getComputedStyle(modal).backgroundColor,"
                    + "fg:getComputedStyle(title).color,"
                    + "theme:document.documentElement.dataset.theme,"
                    + "inside:panel.getBoundingClientRect().left>=-2"
                    + "&&panel.getBoundingClientRect().right<=innerWidth+2};})())",20);
                JSONObject notificationPalette=new JSONObject(notificationsColors);
                assertEquals("P3 notifications theme mismatch",theme,notificationPalette.getString("theme"));
                assertTrue("P3 notification modal width outside viewport in "+theme,
                    notificationPalette.getBoolean("inside"));
                assertTrue("P3 notification title contrast below WCAG AA in "+theme+": "+notificationsColors,
                    v5ColorContrast(notificationPalette.getString("bg"),
                        notificationPalette.getString("fg"))>=4.5d);
                runV5Js("const box=modal.querySelector('.modal-inner');"
                    + "box.style.position='relative';const marker=document.createElement('span');"
                    + "marker.id='v5-p3-qa-paint';"
                    + "marker.style.cssText='position:absolute;top:12px;left:14px;'+"
                    + "'width:72px;height:18px;background:#f39b42;z-index:2147483647;pointer-events:none';"
                    + "box.append(marker)");
                awaitV5P3ModalPainted(themedHome,themedCssWidth,
                    "notifications-theme-"+theme,243,155,66);
                shell("screencap -p /sdcard/Download/V5-P3-theme-notifications-"+theme+".png");
                runV5Js("closeModal()");

                // P4 themed Android MAP evidence. Themes must actually apply to
                // the map surface, not only P1 Home and P3 modals.
                runV5Js("go('map');mapData={...(mapData||{}),locations:["
                    + "{person:'0',sharing:true,latitude:4.711,longitude:-74.072,updated_at:new Date().toISOString()},"
                    + "{person:'1',sharing:false,latitude:null,longitude:null,updated_at:null}],"
                    + "places:[],trips:[],events:[],encounters:[],"
                    + "context:{settings:{near_enabled:false,arrived_safe_enabled:false},session:null}};"
                    + "render();GalaxyTheme.applyTheme('"+theme+"');");
                awaitJs("view==='map'&&document.documentElement.dataset.theme==='"+theme+"'"
                    + "&&!!document.querySelector('.journey-presence.paused')"
                    + "&&!!document.querySelector('.journey-alerts')"
                    + "&&!!document.querySelector('.journey-companion')");
                String mapColors=jsWithDeadline("JSON.stringify((()=>{"
                    + "const region=document.querySelector('#journeyMapWrap'),"
                    + "card=document.querySelector('.journey-presence'),"
                    + "copy=card.querySelector('b'),"
                    + "toggle=region.querySelector('.map-immersive-toggle'),"
                    + "r=region.getBoundingClientRect(),b=toggle.getBoundingClientRect();"
                    + "return {bg:getComputedStyle(card).backgroundColor,"
                    + "fg:getComputedStyle(copy).color,theme:document.documentElement.dataset.theme,"
                    + "inside:r.left>=-2&&r.right<=innerWidth+2,"
                    + "touch:b.width>=44&&b.height>=44,"
                    + "noOverflow:document.documentElement.scrollWidth<=innerWidth+3};})())",20);
                JSONObject p4Palette=new JSONObject(mapColors);
                assertEquals("P4 themed map did not retain theme",theme,p4Palette.getString("theme"));
                assertTrue("P4 map overflows Android screen in "+theme+": "+mapColors,
                    p4Palette.getBoolean("inside")&&p4Palette.getBoolean("noOverflow"));
                assertTrue("P4 map expand button not touchable in "+theme,p4Palette.getBoolean("touch"));
                assertTrue("P4 location text contrast below WCAG AA in "+theme+": "+mapColors,
                    v5ColorContrast(p4Palette.getString("bg"),p4Palette.getString("fg"))>=4.5d);
                // The map subtree can be replaced by asynchronous QA state
                // refresh while GalaxyMap is repainting. Put the QA-only
                // color marker on stable document.body, not on the map child,
                // but physically OVER the visible map bounds. It is removed
                // immediately after the real screenshot, never shipped in UI.
                runV5Js("document.getElementById('journeyMapWrap')"
                    + ".scrollIntoView({behavior:'auto',block:'center'})");
                awaitJs("(()=>{const r=document.getElementById('journeyMapWrap')"
                    + ".getBoundingClientRect();return view==='map' && "
                    + "r.top<innerHeight-48 && r.bottom>48 && r.width>200})()");
                runV5Js("document.getElementById('p4-theme-paint-marker')?.remove();"
                    + "const rect=document.getElementById('journeyMapWrap').getBoundingClientRect();"
                    + "const el=document.createElement('div');"
                    + "el.id='p4-theme-paint-marker';el.setAttribute('aria-hidden','true');"
                    + "const y=Math.min(innerHeight-56,Math.max(22,rect.top+16));"
                    + "const x=Math.max(16,Math.min(innerWidth-100,rect.left+18));"
                    + "el.style.cssText='position:fixed;top:'+y+'px;left:'+x+'px;'+"
                    + "'width:74px;height:22px;background:#5ce3aa;'+"
                    + "'z-index:2147483647;pointer-events:none';"
                    + "document.body.append(el)");
                awaitJs("!!document.getElementById('p4-theme-paint-marker')");
                awaitV5P3ModalPainted(themedHome,themedCssWidth,"p4-theme-"+theme,92,227,170);
                shell("screencap -p /sdcard/Download/V5-P4-theme-map-"+theme+".png");
                runV5Js("document.getElementById('p4-theme-paint-marker')?.remove();go('home')");
                awaitJs("view==='home' && document.querySelector('#bottomNav .nav-btn.active')"
                    + "?.dataset.view==='home'");
                awaitV5QaPainted("p4-theme-return-"+theme);
                System.out.println("V5_P4_THEME_MAP=theme:"+theme
                    +";paint:true;contrastAA:true;safeViewport:true");
                System.out.println("V5_P3_THEMED_SURFACES=theme:"+theme+";search:true;notifications:true");
            } finally {
                themedHome.recycle();
                runV5Js("document.getElementById('p4-theme-paint-marker')?.remove()");
                if("true".equals(js("!!document.querySelector('#modal')?.open")))
                    runV5Js("closeModal()");
            }
        }
        runV5Js("document.getElementById('v5-qa-paint-marker')?.remove();GalaxyTheme.applyTheme('auto')");
        assertEquals("true", js("document.documentElement.dataset.themeChoice==='auto'"));
        JSONObject themes = new JSONObject().put("palettes",samples).put("auto",true);

        // Measure real layout rectangles; the extra add FAB and player are synthetic
        // UI-only fixtures and are removed before leaving this test.
        String railJson = js("JSON.stringify((()=>{"
            + "const nav=document.getElementById('bottomNav'),fab=document.getElementById('chatFab'),"
            + "player=document.getElementById('globalPlayer'),oldClass=player.className;"
            + "const add=document.createElement('button');add.className='floating-add';"
            + "add.setAttribute('aria-label','Accion QA sintetica');document.getElementById('app').append(add);"
            + "function overlap(a,b){const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();"
            + "return x.left<y.right-1&&x.right>y.left+1&&x.top<y.bottom-1&&x.bottom>y.top+1}"
            + "const withoutPlayer=!overlap(nav,fab)&&!overlap(nav,add)&&!overlap(fab,add);"
            + "player.classList.add('visible');"
            + "const withPlayer=!overlap(nav,fab)&&!overlap(nav,add)&&!overlap(nav,player)"
            + "&&!overlap(fab,add)&&!overlap(fab,player)&&!overlap(add,player);"
            + "const dims={width:innerWidth,height:innerHeight,navCount:nav.children.length};"
            + "player.className=oldClass;add.remove();"
            + "return {...dims,withoutPlayer,withPlayer}})())");
        JSONObject rail = new JSONObject(railJson);
        assertEquals("The bottom rail must keep all six controls", 6, rail.getInt("navCount"));
        assertTrue("FAB/add collide with Android nav: " + rail, rail.getBoolean("withoutPlayer"));
        assertTrue("FAB/add/player collide on real WebView: " + rail, rail.getBoolean("withPlayer"));

        for (String id : new String[]{"map","moments","ai","memories","more","home"}) {
            runV5Js("document.querySelector('[data-view=\"" + id + "\"]').click()");
            awaitJs("document.querySelectorAll('#bottomNav [aria-current=\"page\"]').length===1");
            assertEquals("Active route was not announced to accessibility for " + id, id,
                js("document.querySelector('#bottomNav [aria-current=\"page\"]')?.dataset.view||''"));
        }

        // Real global dialog (not Galaxy Chat) must focus search, then restore its
        // launcher after Escape/cancel using the preexisting closeModal cleanup.
        runV5Js("document.querySelector('[data-action=\"universal-search-open\"]').click()");
        awaitJs("document.getElementById('modal').open");
        awaitJs("document.activeElement?.id==='universalSearchInput'");
        assertEquals("v5-modal-title", js("document.getElementById('modal').getAttribute('aria-labelledby')"));
        assertEquals("true", js("document.body.classList.contains('v5-input-focused')"));
        runV5Js("document.getElementById('modal').dispatchEvent(new Event('cancel',{cancelable:true}))");
        awaitJs("!document.getElementById('modal').open && document.activeElement?.dataset.action==='universal-search-open'");
        assertEquals("false", js("document.body.classList.contains('v5-input-focused')"));
        assertEquals("", js("document.getElementById('modal').getAttribute('aria-labelledby')||''"));
        // Real Android WebView responsive audit. wm size changes physical
        // display resolution, not a browser-mocked viewport. Keep density
        // unchanged so the CSS px targets correspond to the app's WebView.
        android.graphics.Bitmap initialFrame=instrumentation.getUiAutomation().takeScreenshot();
        assertNotNull("Cannot determine Android baseline display for responsive QA",initialFrame);
        final int displayWidthPx=initialFrame.getWidth();
        final int displayHeightPx=initialFrame.getHeight();
        initialFrame.recycle();
        final int baselineCssWidth=Integer.parseInt(js("String(Math.round(innerWidth))"));
        assertTrue("Bad CSS/native viewport scale",baselineCssWidth>200 && displayWidthPx>300);
        final double deviceScale=(double)displayWidthPx/baselineCssWidth;
        JSONArray responsive=new JSONArray();
        runV5Js("const m=document.createElement('div');m.id='v5-qa-paint-marker';"
            + "m.setAttribute('aria-hidden','true');"
            + "m.style.cssText='position:fixed;top:8px;left:8px;width:64px;height:8px;"
            + "background:#07e1f7;z-index:2147483647;pointer-events:none';"
            + "document.body.appendChild(m)");
        try {
            for (int targetCss : new int[]{320,360,393,412}) {
                int displayTargetPx=(int)Math.round(targetCss*deviceScale);
                String resizeResult=shell("wm size "+displayTargetPx+"x"+displayHeightPx);
                assertFalse("Android virtual screen resize was rejected: "+resizeResult,
                    resizeResult.toLowerCase(java.util.Locale.ROOT).contains("error"));
                awaitCondition(() -> {
                    String size=js("String(Math.round(innerWidth))");
                    return Math.abs(Integer.parseInt(size)-targetCss)<=5;
                },UI_TIMEOUT_MS);
                awaitJs("document.querySelector('#bottomNav .nav-btn.active')?.dataset.view==='home'");
                awaitV5QaPainted("viewport-"+targetCss);
                String measured=jsWithDeadline("JSON.stringify((()=>{"
                    + "const nav=document.getElementById('bottomNav'),fab=document.getElementById('chatFab'),"
                    + "player=document.getElementById('globalPlayer');"
                    + "const original=player.className;player.classList.add('visible');"
                    + "const add=document.createElement('button');add.className='floating-add';"
                    + "add.setAttribute('aria-label','Accion QA sintetica');"
                    + "document.getElementById('app').append(add);"
                    + "function intersects(a,b){const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();"
                    + "return x.left<y.right-1&&x.right>y.left+1&&x.top<y.bottom-1&&x.bottom>y.top+1}"
                    + "const n=nav.getBoundingClientRect(),f=fab.getBoundingClientRect(),"
                    + "a=add.getBoundingClientRect(),p=player.getBoundingClientRect();"
                    + "const noOverlap=![nav,fab,add,player].some((el,i,all)=>"
                    + "all.slice(i+1).some(other=>intersects(el,other)));"
                    + "const withinScreen=n.left>=-1&&n.right<=innerWidth+1&&f.right<=innerWidth+1"
                    + "&&a.right<=innerWidth+1&&p.right<=innerWidth+1;"
                    + "const heights=[...nav.querySelectorAll('.nav-btn')].map(el=>el.getBoundingClientRect().height);"
                    + "const header=document.querySelector('#app .header'),"
                    + "hButtons=[...header.querySelectorAll('.header-actions button')],"
                    + "avatar=header.querySelector('.avatar');"
                    + "const headerFits=hButtons.length===2&&[...hButtons,header.querySelector('.brand')]"
                    + ".every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1});"
                    + "const headerTouch=hButtons.every(el=>el.getBoundingClientRect().width>=44);"
                    + "const avatarHidden=getComputedStyle(avatar).display==='none';"
                    + "const welcome=document.querySelector('.galaxy-welcome'),"
                    + "hero=welcome?.querySelector('.welcome-hero'),"
                    + "cards=[...document.querySelectorAll('.welcome-bento .action-card')];"
                    + "const heroRect=hero?.getBoundingClientRect();"
                    + "const heroFits=!!heroRect&&heroRect.left>=-1&&heroRect.right<=innerWidth+1;"
                    + "const bentoFits=cards.length===5&&cards.every(el=>{"
                    + "const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1});"
                    + "const noHorizontalOverflow=document.documentElement.scrollWidth<=innerWidth+2;"
                    + "add.remove();player.className=original;"
                    + "return {cssWidth:innerWidth,navCount:heights.length,minTouch:Math.min(...heights),"
                    + "noOverlap,withinScreen,headerFits,headerTouch,avatarHidden,"
                    + "heroFits,bentoFits,noHorizontalOverflow}})())",20);
                assertTrue("Responsive metrics are not JSON at CSS "+targetCss+": "+measured,
                    measured.startsWith("{"));
                JSONObject row=new JSONObject(measured);
                assertEquals("Viewport has unexpected CSS width",targetCss,
                    row.getInt("cssWidth"),5);
                assertEquals("Lost navigation actions at narrow viewport",6,row.getInt("navCount"));
                assertTrue("Navigation touch target too small: "+row,row.getDouble("minTouch")>=44d);
                assertTrue("Navigation/player/FAB/add overlap at "+targetCss+": "+row,
                    row.getBoolean("noOverlap"));
                assertTrue("Control outside viewport at "+targetCss+": "+row,
                    row.getBoolean("withinScreen"));
                assertTrue("Notification/Search header clipped at "+targetCss+": "+row,
                    row.getBoolean("headerFits"));
                assertTrue("Header search actions narrower than 44px at "+targetCss+": "+row,
                    row.getBoolean("headerTouch"));
                assertTrue("Decorative avatar must not crowd narrow header at "+targetCss+": "+row,
                    row.getBoolean("avatarHidden"));
                assertTrue("P2 hero clipped horizontally at "+targetCss+": "+row,
                    row.getBoolean("heroFits"));
                assertTrue("P2 5-action bento clipped or missing at "+targetCss+": "+row,
                    row.getBoolean("bentoFits"));
                assertTrue("P2 page has horizontal overflow at "+targetCss+": "+row,
                    row.getBoolean("noHorizontalOverflow"));
                shell("screencap -p /sdcard/Download/V5-P1-viewport-"+targetCss+".png");
                // JS scrollY can update before the Android compositor paints the
                // frame. CI previously archived byte-identical TOP and BOTTOM
                // images for all four widths despite passing DOM geometry tests.
                // Require observable real display changes before saving evidence.
                android.graphics.Bitmap topFrame=instrumentation.getUiAutomation().takeScreenshot();
                assertTrue("V5 P2 top Android screenshot unavailable at "+targetCss,topFrame!=null);
                try {
                    // VE-022/024: capture the middle, not merely the header and
                    // bottom. Check real question status geometry and pixels on
                    // the Android display after the WebView compositor settles.
                    runV5Js("document.querySelector('.date-question-person-status')"
                        + ".scrollIntoView({behavior:'instant',block:'center'})");
                    String questionRect=jsWithDeadline("JSON.stringify((()=>{"
                        + "const badges=document.querySelector('.date-question-person-status'),"
                        + "fav=document.querySelector('.date-question-card [data-action=date-question-favorite]'),"
                        + "nav=document.getElementById('bottomNav'),r=badges?.getBoundingClientRect(),"
                        + "n=nav.getBoundingClientRect(),"
                        + "chips=badges?.querySelectorAll('.date-question-person'),"
                        + "fab=document.getElementById('chatFab'),"
                        + "actions=[...document.querySelectorAll('.date-question-actions > .btn')],"
                        + "f=fab.getBoundingClientRect(),"
                        + "touch=actions.map(b=>b.getBoundingClientRect()),"
                        + "fabClear=actions.length===3&&touch.every(b=>"
                        + "!(b.left<f.right-1&&b.right>f.left+1&&b.top<f.bottom-1&&b.bottom>f.top+1));"
                        + "return {scrollY:scrollY,visible:!!r&&r.top>=55&&r.bottom<n.top-8,"
                        + "badges:chips?.length||0,favorite:fav?.hasAttribute('aria-pressed'),"
                        + "fabClear,minActionTouch:Math.min(...touch.map(b=>b.width)),"
                        + "noOverflow:document.documentElement.scrollWidth<=innerWidth+3}})())",20);
                    JSONObject questionState=new JSONObject(questionRect);
                    assertTrue("P2 middle question not visible above fixed nav at "+targetCss+": "+questionRect,
                        questionState.getBoolean("visible"));
                    assertTrue("P2 question remained at page top at "+targetCss+": "+questionRect,
                        questionState.getDouble("scrollY")>100d);
                    assertEquals("P2 question must show two answer chips at "+targetCss,2,
                        questionState.getInt("badges"));
                    assertTrue("P2 favorite lost accessible toggle state at "+targetCss,
                        questionState.getBoolean("favorite"));
                    assertTrue("P2 question introduced horizontal overflow at "+targetCss,
                        questionState.getBoolean("noOverflow"));
                    assertTrue("Chat FAB obscures daily question actions at "+targetCss+": "+questionRect,
                        questionState.getBoolean("fabClear"));
                    assertTrue("Question action too narrow after FAB clearance at "+targetCss+": "+questionRect,
                        questionState.getDouble("minActionTouch")>=44d);
                    double middleDisplayChange=awaitV5QuestionFramePainted(topFrame,targetCss);
                    row.put("middleQuestionReached",true)
                        .put("middleRealDisplayChange",middleDisplayChange);
                    shell("screencap -p /sdcard/Download/V5-P2-question-"+targetCss+".png");
                    runV5Js("window.scrollTo(0,document.documentElement.scrollHeight)");
                    awaitJs("window.scrollY>100");
                    String bottom=jsWithDeadline("JSON.stringify((()=>{"
                        + "const last=document.querySelector('.welcome-memories .living-moment'),"
                        + "nav=document.getElementById('bottomNav'),r=last?.getBoundingClientRect(),"
                        + "n=nav.getBoundingClientRect();"
                        + "return {atEnd:window.scrollY>=document.documentElement.scrollHeight-innerHeight-3,"
                        + "lastVisible:!!r&&r.bottom<=n.top-4&&r.top>=-innerHeight,"
                        + "scrollY:window.scrollY}})())",20);
                    JSONObject bottomState=new JSONObject(bottom);
                    assertTrue("P2 did not scroll to document end at "+targetCss+": "+bottom,
                        bottomState.getBoolean("atEnd"));
                    assertTrue("P2 final card hidden by fixed navbar at "+targetCss+": "+bottom,
                        bottomState.getBoolean("lastVisible"));
                    double displayChange=awaitV5BottomFramePainted(topFrame,targetCss);
                    responsive.put(row.put("requestedCssWidth",targetCss)
                        .put("bottomReached",true)
                        .put("realDisplayChange",displayChange));
                    shell("screencap -p /sdcard/Download/V5-P2-bottom-"+targetCss+".png");

                    // V5-P3: real Android search + notification screenshots at
                    // each physical width. Fixtures are synthetic, UI-only;
                    // no live notifications, AI queries or private data.
                    assertEquals("P3 Android assets not loaded", "true",
                        js("!!window.GalaxyDiscoveryV5 && !!document.querySelector("
                          + "'link[href=\\\"./galaxy-discovery-v5.css\\\"]')"));
                    android.graphics.Bitmap beforeP3=instrumentation.getUiAutomation().takeScreenshot();
                    assertNotNull("P3 cannot capture Android baseline framebuffer",beforeP3);
                    runV5Js("openUniversalSearch();"
                        + "document.getElementById('universalSearchResults').innerHTML="
                        + "GalaxyDiscoveryV5.renderClassic(["
                        + "{type:'item',kind:'memory',id:'qa-memory',title:'Recuerdo QA',"
                        + "subtitle:'Ejemplo de texto largo para verificar legibilidad en pantalla pequeña'},"
                        + "{type:'place',id:'qa-place',title:'Lugar de ejemplo',subtitle:'Sin GPS'}],"
                        + "{ico,esc,attr,kindMeta})");
                    awaitJs("modal.open && modal.dataset.form==='v5-p3-search'"
                        + " && document.querySelectorAll('.v5-p3-search .universal-search-result').length===2");
                    String searchJson=jsWithDeadline("JSON.stringify((()=>{"
                        + "const m=modal.querySelector('.modal-inner'),"
                        + "r=document.getElementById('universalSearchResults'),"
                        + "items=[...r.querySelectorAll('.universal-search-result')],"
                        + "box=m.getBoundingClientRect();"
                        + "return {inside:box.left>=-2&&box.right<=innerWidth+2,"
                        + "scroll:getComputedStyle(r).overflowY,"
                        + "targets:items.map(x=>x.getBoundingClientRect().height),"
                        + "order:items.map(x=>x.dataset.id),"
                        + "noOverflow:document.documentElement.scrollWidth<=innerWidth+3};})())",20);
                    JSONObject searchEvidence=new JSONObject(searchJson);
                    assertTrue("P3 search exceeds Android viewport "+targetCss+": "+searchJson,
                        searchEvidence.getBoolean("inside"));
                    assertEquals("P3 search results must scroll independently","auto",
                        searchEvidence.getString("scroll"));
                    assertEquals("qa-memory",searchEvidence.getJSONArray("order").getString(0));
                    assertEquals("qa-place",searchEvidence.getJSONArray("order").getString(1));
                    assertTrue("P3 search scroll overflow "+targetCss,
                        searchEvidence.getBoolean("noOverflow"));
                    for (int i=0;i<searchEvidence.getJSONArray("targets").length();i++)
                        assertTrue("P3 search result too short for touch",
                            searchEvidence.getJSONArray("targets").getDouble(i)>=44d);
                    runV5Js("const marker=document.createElement('span');"
                        + "marker.id='v5-p3-qa-paint';"
                        + "marker.style.cssText='position:absolute;top:12px;left:14px;'+"
                        + "'width:72px;height:18px;background:#1bd7ab;z-index:2147483647;pointer-events:none';"
                        + "modal.querySelector('.modal-inner').style.position='relative';"
                        + "modal.querySelector('.modal-inner').append(marker)");
                    awaitV5P3ModalPainted(beforeP3,targetCss,"search",27,215,171);
                    shell("screencap -p /sdcard/Download/V5-P3-search-"+targetCss+".png");
                    // Native Android touch and IME input, not JS assignment or DOM-dispatched input.
                    tapWebElement("#universalSearchInput");
                    awaitJs("document.activeElement===document.querySelector('#universalSearchInput')");
                    typeAndroidWebInputFor("#universalSearchInput","P3Native");
                    assertEquals("P3 search did not receive native keyboard input at "+targetCss,
                        "true",js("document.querySelector('#universalSearchInput')?.value.includes('P3Native')"));
                    assertTrue("P3 search IME is not visible at "+targetCss,imeVisible());
                    String searchIme=jsWithDeadline("JSON.stringify((()=>{"
                        +"const i=document.querySelector('#universalSearchInput').getBoundingClientRect(),"
                        +"m=modal.querySelector('.modal-inner').getBoundingClientRect(),"
                        +"v=window.visualViewport;"
                        +"return {inputVisible:i.top>=0&&i.bottom<=v.height+v.offsetTop+2,"
                        +"modalInViewport:m.left>=-2&&m.right<=innerWidth+2,"
                        +"noOverflow:document.documentElement.scrollWidth<=innerWidth+3};})())",20);
                    JSONObject imeEvidence=new JSONObject(searchIme);
                    assertTrue("P3 search input hidden behind IME at "+targetCss+": "+searchIme,
                        imeEvidence.getBoolean("inputVisible"));
                    assertTrue("P3 search modal overflows with IME at "+targetCss+": "+searchIme,
                        imeEvidence.getBoolean("modalInViewport")&&imeEvidence.getBoolean("noOverflow"));
                    shell("input keyevent 4");
                    runV5Js("closeModal()");

                    runV5Js("notificationState={unread:2,notifications:["
                        + "{id:'qa1',event_type:'chat_message',action:'chat',"
                        + "created_at:'2026-10-14T12:00:00Z',title:'Mensaje de prueba',"
                        + "body:'Mensaje sintético de prueba del centro de avisos',read_at:null},"
                        + "{id:'qa2',event_type:'goal_update',action:'goals',"
                        + "created_at:'2026-10-14T11:00:00Z',title:'Objetivo de prueba',"
                        + "body:'Actividad sintética de QA sin datos de usuario',read_at:null}"
                        + "]};v5NotificationFilter='all';"
                        + "showModal('Notificaciones',"
                        + "'<div class=\\\"v5-notification-mount\\\"></div>',"
                        + "'v5-p3-notifications');renderV5NotificationPanel()");
                    awaitJs("modal.open && modal.dataset.form==='v5-p3-notifications'"
                        + " && document.querySelectorAll('.v5-notification-panel .notification-row').length===2");
                    String notificationsJson=jsWithDeadline("JSON.stringify((()=>{"
                        + "const m=modal.querySelector('.modal-inner'),"
                        + "filters=[...modal.querySelectorAll('.v5-notification-filter')],"
                        + "rows=[...modal.querySelectorAll('.notification-row')],"
                        + "list=modal.querySelector('.notification-center-list'),"
                        + "box=m.getBoundingClientRect();"
                        + "return {inside:box.left>=-2&&box.right<=innerWidth+2,"
                        + "filters:filters.length,rows:rows.length,"
                        + "scroll:getComputedStyle(list).overflowY,"
                        + "minTouch:Math.min(...filters.map(f=>f.getBoundingClientRect().height)),"
                        + "noOverflow:document.documentElement.scrollWidth<=innerWidth+3};})())",20);
                    JSONObject notificationEvidence=new JSONObject(notificationsJson);
                    assertTrue("P3 notifications modal exceeds width "+targetCss,
                        notificationEvidence.getBoolean("inside"));
                    assertEquals("P3 must retain four accessible filters",4,
                        notificationEvidence.getInt("filters"));
                    assertEquals("P3 should preserve both notification destinations",2,
                        notificationEvidence.getInt("rows"));
                    assertEquals("auto",notificationEvidence.getString("scroll"));
                    assertTrue("P3 notification filter too small",
                        notificationEvidence.getDouble("minTouch")>=44d);
                    assertTrue("P3 notifications horizontal overflow "+targetCss,
                        notificationEvidence.getBoolean("noOverflow"));
                    // V5-P3: exercise actual filter clicks and horizontal reachability
                    // on all four real Android viewports, including clipped tabs at 320px.
                    for (String filter : new String[]{"unread","chat","activity","all"}) {
                        int expectedRows=("all".equals(filter)||"unread".equals(filter))?2:1;
                        runV5Js("modal.querySelector('.v5-notification-filter[data-filter="
                            +filter+"]').click()");
                        awaitJs("modal.querySelector('.v5-notification-filter[aria-selected=true]')"
                            +"?.dataset.filter==='"+filter+"' && "
                            +"modal.querySelectorAll('.notification-row').length==="+expectedRows);
                        runV5Js("modal.querySelector('.v5-notification-filter[aria-selected=true]')"
                            +".scrollIntoView({block:'nearest',inline:'nearest'})");
                        String filterJson=jsWithDeadline("JSON.stringify((()=>{"
                            +"const strip=modal.querySelector('.v5-notification-filters').getBoundingClientRect(),"
                            +"active=modal.querySelector('.v5-notification-filter[aria-selected=true]').getBoundingClientRect();"
                            +"return {visible:active.left>=strip.left-2&&active.right<=strip.right+2,"
                            +"minTouch:active.height>=44};})())",20);
                        JSONObject filterEvidence=new JSONObject(filterJson);
                        assertTrue("P3 filter not horizontally reachable at "+targetCss+" "+filter,
                            filterEvidence.getBoolean("visible"));
                        assertTrue("P3 filter touch target below 44px at "+targetCss+" "+filter,
                            filterEvidence.getBoolean("minTouch"));
                    }
                    runV5Js("const marker=document.createElement('span');"
                        + "marker.id='v5-p3-qa-paint';"
                        + "marker.style.cssText='position:absolute;top:12px;left:14px;'+"
                        + "'width:72px;height:18px;background:#f39b42;z-index:2147483647;pointer-events:none';"
                        + "modal.querySelector('.modal-inner').style.position='relative';"
                        + "modal.querySelector('.modal-inner').append(marker)");
                    awaitV5P3ModalPainted(beforeP3,targetCss,"notifications",243,155,66);
                    shell("screencap -p /sdcard/Download/V5-P3-notifications-"+targetCss+".png");
                    beforeP3.recycle();
                    runV5Js("closeModal()");

                    // V5-P4: four physical Android screen widths, not viewport mocks.
                    // Map data are synthetic in this instrumented WebView memory only;
                    // the test does not start GPS or write a backend record.
                    assertEquals("P4 assets missing from APK","true",js(
                        "!!window.GalaxyJourneysV5 && !!document.querySelector("
                        + "'link[href=\\\"./galaxy-journeys-v5.css\\\"]')"));
                    android.graphics.Bitmap beforeP4=instrumentation.getUiAutomation().takeScreenshot();
                    assertNotNull("P4 cannot capture Android map baseline",beforeP4);
                    try {
                        runV5Js("go('map');(()=>{const time=new Date().toISOString();"
                            + "mapData={...(mapData||{}),locations:["
                            + "{person:'0',sharing:true,latitude:4.711,longitude:-74.0721,updated_at:time},"
                            + "{person:'1',sharing:false,latitude:null,longitude:null,updated_at:null}],"
                            + "places:[{id:601,kind:'home',name:'Lugar sintetico',"
                            + "latitude:4.712,longitude:-74.073}],"
                            + "destinations:[{person:'0',kind:'place',place_id:601,active:true}],"
                            + "trips:[],events:[],encounters:[],"
                            + "context:{settings:{near_enabled:false,arrived_safe_enabled:false},session:null}};"
                            + "render();})()");
                        awaitJs("view==='map' && !!document.querySelector('#journeyMapWrap')"
                            + " && !!document.querySelector('.journey-presence.paused')"
                            + " && !!document.querySelector('.journey-companion')"
                            + " && !!document.querySelector('.journey-alerts')");
                        String mapCompact=jsWithDeadline("JSON.stringify((()=>{"
                            + "const root=document.getElementById('journeyMapWrap'),"
                            + "toggle=root.querySelector('.map-immersive-toggle'),"
                            + "r=root.getBoundingClientRect(),b=toggle.getBoundingClientRect();"
                            + "return {inside:r.left>=-2&&r.right<=innerWidth+2,"
                            + "touch:b.width>=44&&b.height>=44,"
                            + "expanded:toggle.getAttribute('aria-pressed'),"
                            + "presence:document.querySelectorAll('.journey-presence').length,"
                            + "privacy:!!document.querySelector('.journey-presence.paused'),"
                            + "overflow:document.documentElement.scrollWidth<=innerWidth+3};})())",20);
                        JSONObject compactEvidence=new JSONObject(mapCompact);
                        assertTrue("P4 compact map outside viewport: "+mapCompact,
                            compactEvidence.getBoolean("inside"));
                        assertTrue("P4 map expansion button too small: "+mapCompact,
                            compactEvidence.getBoolean("touch"));
                        assertTrue("P4 map body overflows "+targetCss+": "+mapCompact,
                            compactEvidence.getBoolean("overflow"));
                        assertEquals("P4 must render both freshness states",2,
                            compactEvidence.getInt("presence"));
                        assertTrue("P4 must show paused partner without GPS",compactEvidence.getBoolean("privacy"));
                        assertEquals("false",compactEvidence.getString("expanded"));
                        runV5Js("const mark=document.createElement('div');"
                            + "mark.id='p4-real-frame-marker';mark.setAttribute('aria-hidden','true');"
                            + "mark.style.cssText='position:fixed;top:42px;left:22px;'+"
                            + "'width:74px;height:22px;background:#c142f0;z-index:2147483647;pointer-events:none';"
                            + "document.getElementById('journeyMapWrap').append(mark)");
                        awaitV5P3ModalPainted(beforeP4,targetCss,"p4-compact-map",193,66,240);
                        shell("screencap -p /sdcard/Download/V5-P4-map-compact-"+targetCss+".png");
                        android.graphics.Bitmap compactFrame=instrumentation.getUiAutomation().takeScreenshot();
                        assertNotNull("P4 missing compact Android framebuffer",compactFrame);
                        try {
                            runV5Js("document.querySelector('[data-action=\\\"map-immersive-toggle\\\"]').click();"
                                + "document.querySelector('#p4-real-frame-marker').style.background='#58cded'");
                            awaitJs("mapImmersive && document.body.classList.contains('map-immersive-open')"
                                + " && document.querySelector('#journeyMapWrap.immersive')"
                                + " && document.querySelector('[data-action=\\\"map-immersive-toggle\\\"]')"
                                + ".getAttribute('aria-pressed')==='true'");
                            String immersiveJson=jsWithDeadline("JSON.stringify((()=>{"
                                + "const root=document.querySelector('#journeyMapWrap.immersive'),"
                                + "map=document.querySelector('#map').getBoundingClientRect(),"
                                + "b=root.querySelector('.map-immersive-toggle').getBoundingClientRect();"
                                + "return {full:map.width>=innerWidth-3 && map.height>=innerHeight-6,"
                                + "exit:b.width>=44&&b.height>=44&&b.left>=0&&b.right<=innerWidth+2,"
                                + "overflow:document.documentElement.scrollWidth<=innerWidth+3};})())",20);
                            JSONObject immersiveEvidence=new JSONObject(immersiveJson);
                            assertTrue("P4 immersive map not full screen: "+immersiveJson,
                                immersiveEvidence.getBoolean("full"));
                            assertTrue("P4 map exit must stay touchable: "+immersiveJson,
                                immersiveEvidence.getBoolean("exit"));
                            assertTrue("P4 immersive overflow: "+immersiveJson,
                                immersiveEvidence.getBoolean("overflow"));
                            awaitV5P3ModalPainted(compactFrame,targetCss,"p4-immersive-map",88,205,237);
                            shell("screencap -p /sdcard/Download/V5-P4-map-immersive-"+targetCss+".png");
                            runV5Js("document.querySelector('[data-action=\\\"map-immersive-toggle\\\"]').click()");
                            awaitJs("!mapImmersive&&!document.body.classList.contains('map-immersive-open')");

                            // A real Android WebSettings text-zoom setting (135%),
                            // not a browser-simulated CSS viewport/font substitution.
                            // Always restore 100% before testing the next width.
                            try {
                                final java.util.concurrent.atomic.AtomicInteger appliedZoom=
                                    new java.util.concurrent.atomic.AtomicInteger();
                                scenario.onActivity(activity -> {
                                    WebView realWeb=activity.findViewById(R.id.webView);
                                    assertNotNull("P4 font zoom needs a real WebView",realWeb);
                                    realWeb.getSettings().setTextZoom(135);
                                    appliedZoom.set(realWeb.getSettings().getTextZoom());
                                });
                                assertEquals("Android native WebView text zoom did not apply",135,appliedZoom.get());
                                runV5Js("document.querySelector('#p4-real-frame-marker')"
                                    + ".style.background='#e9bf4a'");
                                awaitJs("!mapImmersive && document.querySelector('.journey-presence.paused')"
                                    + " && !!document.querySelector('.journey-alerts')");
                                String largeEvidence=jsWithDeadline("JSON.stringify((()=>{"
                                    + "const r=document.querySelector('#journeyMapWrap')"
                                    + ".getBoundingClientRect(),toggle=document.querySelector("
                                    + "'.map-immersive-toggle').getBoundingClientRect();"
                                    + "return {mapInside:r.left>=-2&&r.right<=innerWidth+2,"
                                    + "touch:toggle.width>=44&&toggle.height>=44,"
                                    + "noOverflow:document.documentElement.scrollWidth<=innerWidth+3};})())",20);
                                JSONObject largeLayout=new JSONObject(largeEvidence);
                                assertTrue("P4 native 135% font layout overflow at "+targetCss+": "+largeEvidence,
                                    largeLayout.getBoolean("mapInside")&&largeLayout.getBoolean("noOverflow"));
                                assertTrue("P4 135% map control too small",largeLayout.getBoolean("touch"));
                                awaitV5P3ModalPainted(beforeP4,targetCss,"p4-large-font",233,191,74);
                                shell("screencap -p /sdcard/Download/V5-P4-map-large-font-"+targetCss+".png");
                                System.out.println("V5_P4_ANDROID_TEXT_ZOOM=css:"+targetCss
                                    +";nativeWebSettings:135;paint:true;noHorizontalOverflow:true");
                            } finally {
                                scenario.onActivity(activity -> {
                                    WebView realWeb=activity.findViewById(R.id.webView);
                                    if(realWeb!=null)realWeb.getSettings().setTextZoom(100);
                                });
                            }

                            // VE-094/095 — exercise the actual packaged WebView
                            // disclosure and saved-place focus, across all 4 widths.
                            runV5Js("document.querySelector('.journey-place-more summary').click()");
                            awaitJs("document.querySelector('.journey-place-more[open]')"
                                + " && !!document.querySelector('.journey-place-more-content'"
                                + " + ' [data-action=\\\"memory-at-place\\\"]')");
                            runV5Js("document.querySelector('.history-place-head').click()");
                            awaitJs("view==='map' && !!map && "
                                + "Math.abs(map.center.lat-4.712)<0.000001 && "
                                + "Math.abs(map.center.lon-(-74.073))<0.000001 && "
                                + "!!document.querySelector('#map .gmap-marker.place.destination.open button') && "
                                + "document.activeElement?.closest('#map .gmap-marker.place.open')!==null");
                            String placeProof=jsWithDeadline("JSON.stringify((()=>{"
                                + "const b=document.querySelector('#map .gmap-marker.place.open button')"
                                + ".getBoundingClientRect(),mapRect=document.querySelector('#map')"
                                + ".getBoundingClientRect();"
                                + "return {focused:!!document.querySelector("
                                + "'#map .gmap-marker.place.open button:focus'),"
                                + "markerInside:b.width>=44&&b.height>=44,"
                                + "noOverflow:document.documentElement.scrollWidth<=innerWidth+3,"
                                + "mapInside:mapRect.left>=-2&&mapRect.right<=innerWidth+2};})())",20);
                            JSONObject placeLayout=new JSONObject(placeProof);
                            assertTrue("P4 focused place not keyboard accessible: "+placeProof,
                                placeLayout.getBoolean("focused")&&placeLayout.getBoolean("markerInside"));
                            assertTrue("P4 focused map outside viewport: "+placeProof,
                                placeLayout.getBoolean("noOverflow")&&placeLayout.getBoolean("mapInside"));
                            shell("screencap -p /sdcard/Download/V5-P4-map-place-"+targetCss+".png");
                            System.out.println("V5_P4_PLACE_FOCUS=css:"+targetCss
                                +";open:true;keyboardFocus:true;44px:true;noOverflow:true");

                            System.out.println("V5_P4_ANDROID_MAP=css:"+targetCss
                                +";compact:true;immersive:true;privacy:true;realDisplay:true");
                        } finally {compactFrame.recycle();}
                    } finally {
                        beforeP4.recycle();
                        runV5Js("go('home')");
                        awaitJs("view==='home' && !document.body.classList.contains('map-immersive-open')");
                        awaitV5QaPainted("p4-home-restored-"+targetCss);
                    }

                } finally {
                    topFrame.recycle();
                    runV5Js("window.scrollTo(0,0)");
                }
            }
        } finally {
            shell("wm size reset");
            runV5Js("document.getElementById('v5-qa-paint-marker')?.remove()");
            awaitCondition(() -> Math.abs(Integer.parseInt(js(
                "String(Math.round(innerWidth))"))-baselineCssWidth)<=5,UI_TIMEOUT_MS);
        }

        System.out.println("V5_P1_ANDROID_SHELL=" + new JSONObject()
            .put("result","VERIFIED_SYNTHETIC_QA")
            .put("themes",themes)
            .put("rail",rail)
            .put("nonChatModalFocusRestore",true)
            .put("responsiveViewports",responsive));
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
        typeAndroidWebInput("_IME");
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
        assertEquals("menu token or low-device suppression","true",js("window.__p8menu[0]===220||(!window.__p8menu.length&&GalaxyChatMotion.constrained())"));

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

    @Test public void gpsShare_explicitConsentAndStopAreReportedToHermeticBackend() throws Exception {
        DeviceStore device = new DeviceStore(context);
        assertFalse("Fresh paired device must not start location sharing",device.tracking());
        assertTrue("A clean QA backend should have zero GPS mutations",backend.locationRequests().isEmpty());

        String pkg=context.getPackageName();
        instrumentation.getUiAutomation().grantRuntimePermission(pkg,Manifest.permission.ACCESS_FINE_LOCATION);
        instrumentation.getUiAutomation().grantRuntimePermission(pkg,Manifest.permission.POST_NOTIFICATIONS);
        launch();
        assertFalse("Opening the map/app must not implicitly start sharing",device.tracking());
        assertTrue("No sharing before explicit consent",backend.locationRequests().isEmpty());

        scenario.onActivity(activity -> activity.startLocation(null));
        awaitCondition(device::tracking,UI_TIMEOUT_MS);
        SystemClock.sleep(800); // let the real Android foreground TrackingService initialize
        scenario.onActivity(activity -> activity.stopLocation(null));
        awaitCondition(() -> !device.tracking(),UI_TIMEOUT_MS);
        awaitCondition(() -> backend.locationRequests().stream()
            .anyMatch(sample -> !sample.optBoolean("sharing",true)),UI_TIMEOUT_MS);
        assertFalse("Stop must persist GPS-sharing disabled",new DeviceStore(context).tracking());
        System.out.println("GALAXY_F4_GPS_CONSENT=VERIFIED_STOP;locationRequests="+backend.locationRequests().size());
    }

    @Test public void gpsEta_onAndroidMapShowsLivePausedStaleAndOfflineStates() throws Exception {
        backend.setEtaScenario(QaHttpServer.EtaScenario.LIVE);
        launch();
        runJs("document.querySelector('[data-view=\\\"map\\\"]')?.click()");
        awaitJs("document.querySelector('.nav-btn.active')?.dataset.view==='map'");
        runJs("refreshMap({quiet:false,detail:true})");
        awaitJs("!!document.querySelector('#etaCard .eta-value strong')");
        assertTrue("ETA must render a numeric estimate for recent shared QA fixtures",
            js("document.querySelector('#etaCard .eta-value strong')?.innerText||''").contains("≈ "));

        backend.setEtaScenario(QaHttpServer.EtaScenario.PARTNER_PAUSED);
        runJs("refreshMap({quiet:false,detail:true})");
        awaitJs("document.querySelector('#etaCard')?.classList.contains('unavailable') && document.querySelector('#etaCard')?.innerText.includes('pausó su ubicación')");

        backend.setEtaScenario(QaHttpServer.EtaScenario.OWN_STALE);
        runJs("refreshMap({quiet:false,detail:true})");
        awaitJs("document.querySelector('#etaCard')?.classList.contains('unavailable') && document.querySelector('#etaCard')?.innerText.includes('Esperando tu ubicación')");

        backend.setEtaScenario(QaHttpServer.EtaScenario.OFFLINE);
        runJs("refreshMap({quiet:false,detail:true})");
        awaitJs("document.querySelector('#etaCard')?.classList.contains('unavailable') && document.querySelector('#etaCard')?.innerText.includes('Activa tu ubicación')");
        System.out.println("GALAXY_F4_GPS_ETA=VERIFIED;live=PASS;partner_paused=PASS;stale=PASS;offline=PASS");
    }

    @Test public void notificationDeepLink_deniesUnpairedAndChangedAccount() throws Exception {
        DeviceStore device=new DeviceStore(context);
        Intent notification=new Intent(context,MainActivity.class)
            .putExtra("galaxy_action","chat")
            .putExtra("galaxy_recipient_person","0")
            .putExtra("galaxy_entity_id","50000000-0000-4000-8000-000000000001")
            .putExtra("galaxy_event_type","chat_message");
        assertTrue("Recipient 0 must accept own notification",MainActivity.shouldAcceptNotificationDeepLink(context,notification));
        device.setPerson("1");
        assertFalse("Old notification must not redirect to newly selected profile",
            MainActivity.shouldAcceptNotificationDeepLink(context,notification));
        device.clear();
        assertFalse("Revoked phone must reject prior notification",
            MainActivity.shouldAcceptNotificationDeepLink(context,notification));
        device.save("qa-token-1","1","Second QA profile");
        assertFalse("New pairing must not inherit prior recipient's deep link",
            MainActivity.shouldAcceptNotificationDeepLink(context,notification));
        assertFalse("Unbound external intents cannot open a private chat",
            MainActivity.shouldAcceptNotificationDeepLink(context,new Intent(context,MainActivity.class)
                .putExtra("galaxy_action","chat")));
    }

    @Test public void notificationDeepLink_opensChatAfterColdLaunch() throws Exception {
        Intent intent = new Intent(context, MainActivity.class)
            .putExtra("galaxy_action", "chat")
            .putExtra("galaxy_recipient_person", "0")
            .putExtra("galaxy_entity_id", "50000000-0000-4000-8000-000000000001")
            .putExtra("galaxy_event_type", "chat_message");
        scenario = ActivityScenario.launch(intent);
        awaitJs("view==='chat' && !!document.querySelector('.chat-shell')");
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

        // Package visibility can hide DocumentsUI from queryIntentActivities on a real phone.
        // Resolve through the shell before testing the actual picker launch.
        String documentsHandler = shell("cmd package resolve-activity --brief -a android.intent.action.OPEN_DOCUMENT -c android.intent.category.OPENABLE -t '*/*'").trim();
        boolean hasDocuments = documentsHandler.contains("/");
        Assume.assumeTrue("No ACTION_OPEN_DOCUMENT handler on this device.", hasDocuments);

        String documentsComponent = documentsHandler.substring(documentsHandler.lastIndexOf('\n') + 1).trim();
        String documentsPackage = documentsComponent.substring(0, documentsComponent.indexOf('/'));
        // Capture the real app framebuffer BEFORE launching Android DocumentsUI.
        // Headless API-35 sometimes keeps an android-owned accessibility root
        // even after PickActivity is actually RESUMED and rendered. Use pixel
        // evidence in addition to the strict resumed-activity requirement.
        // Strict compositor preflight: a headless AVD may expose a VISIBLE WebView
        // DOM while its native surface is still the launcher/splash screen.
        // Without a REAL app frame, comparing screenshot deltas against DocumentsUI
        // is meaningless. Do not launch picker until this proof is positive.
        if(!isPhysicalDevice()) {
            runV5Js("const el=document.createElement('div');el.id='v5-qa-paint-marker';"
                + "el.setAttribute('aria-hidden','true');"
                + "el.style.cssText='position:fixed;top:8px;left:8px;width:64px;height:8px;'+"
                + "'background:#07e1f7;z-index:2147483647;pointer-events:none';"
                + "document.body.appendChild(el)");
            awaitJs("!!document.getElementById('v5-qa-paint-marker')");
            awaitV5QaPainted("before-real-system-document-picker");
            System.out.println("GALAXY_PICKER_APP_FRAMEBASE=real-Android-frame-confirmed");
        }
        android.graphics.Bitmap beforePicker=instrumentation.getUiAutomation().takeScreenshot();
        assertNotNull("File-picker QA requires a real app baseline frame",beforePicker);
        scenario.onActivity(a -> a.pickMedia("qa-file-picker", "chat-file"));
        UiDevice device = UiDevice.getInstance(instrumentation);
        // A transient android-owned ResolverActivity can appear BEFORE the
        // resolved DocumentsUI picker. Waiting for merely any non-app package
        // let QA press Back too early, after which DocumentsUI opened later and
        // hid MainActivity. Only the fully resolved picker is acceptable.
        try {
            // UiDevice's accessibility-root package can remain "android"
            // while ActivityTaskManager has already resumed DocumentsUI.
            // Do not accept that transient root alone: require the resolved
            // handler through accessibility OR Android's resumed activity.
            awaitCondition(() -> documentsPackage.equals(device.getCurrentPackageName())
                || isResumedPackage(documentsPackage), UI_TIMEOUT_MS);
            String pickerForeground = device.getCurrentPackageName();
            boolean actualPickerResumed = isResumedPackage(documentsPackage);
            assertTrue("OPEN_DOCUMENT did not reach resolved picker: a11y="
                    + pickerForeground + ", resolved=" + documentsComponent,
                documentsPackage.equals(pickerForeground) || actualPickerResumed);
            System.out.println("GALAXY_FILE_PICKER=" + new JSONObject()
                .put("resolvedComponent", documentsComponent)
                .put("foregroundPackage", pickerForeground)
                .put("resumedHandler", actualPickerResumed));
            // Cancel the REAL Android picker and prove that MainActivity resumes.
            // DocumentsUI may consume a Back inside its own navigation before closing.
            // Do not accept an accessibility package alone: the underlying WebView
            // must return to the foreground; this gate is never skipped.
            cancelPickerAndVerifyForeground(device, pkg, documentsPackage, beforePicker);
        } finally {
            beforePicker.recycle();
            // This QA-only marker must never leak into camera, mic, or later tests.
            if(scenario.getState()!=Lifecycle.State.DESTROYED && isResumedPackage(pkg))
                runV5Js("document.getElementById('v5-qa-paint-marker')?.remove()");
            // Keep the whole instrumented suite hermetic even when a picker
            // assertion fails. Do not mask the failure or bypass its checks.
            for (int cleanup = 0; cleanup < 3; cleanup++) {
                if (scenario.getState()==Lifecycle.State.DESTROYED || isResumedPackage(pkg)) break;
                device.pressBack();
                SystemClock.sleep(450);
            }
            // Never force-stop another provider on a physical owner's phone.
            // A transient accessibility-root package is NOT proof of resumed UI.
            if (!isPhysicalDevice() && !isResumedPackage(pkg)) {
                shell("am force-stop " + documentsPackage);
                System.out.println("GALAXY_FILE_PICKER_QA_CLEANUP=emulator_picker_stopped");
            }
        }

        Instrumentation.ActivityMonitor cameraMonitor = instrumentation.addMonitor(GalaxyCameraActivity.class.getName(), null, false);
        try {
            scenario.onActivity(a -> a.captureChatPhoto("qa-camera"));
            android.app.Activity cameraActivity = instrumentation.waitForMonitorWithTimeout(cameraMonitor, UI_TIMEOUT_MS);
            assertNotNull("Integrated camera activity never launched.", cameraActivity);
            awaitCondition(() -> pkg.equals(device.getCurrentPackageName()), UI_TIMEOUT_MS);
            assertEquals("Integrated chat camera must remain inside Nuestra Galaxia.", pkg, device.getCurrentPackageName());
            instrumentation.runOnMainSync(() -> { if (!cameraActivity.isFinishing()) cameraActivity.onBackPressed(); });
            awaitCondition(() -> shell("dumpsys activity activities | grep -m1 -E 'mResumedActivity|topResumedActivity'").contains("MainActivity"), UI_TIMEOUT_MS);
        } finally {
            instrumentation.removeMonitor(cameraMonitor);
        }
        // Microphone path is executed only when the emulator exposes an input source.
        scenario.onActivity(a -> a.startVoiceRecording("qa-mic"));
        SystemClock.sleep(700);
        scenario.onActivity(a -> a.stopVoiceRecording("qa-mic-stop"));
        awaitJs("!!document.querySelector('#app')");
    }

    /**
     * Android's document picker can contain its own internal back-stack; the
     * first Back does not always finish its Activity on an emulator. Test real
     * cancellation and actual return to the app rather than an a11y-root label.
     * A broken return still fails after the bounded attempts.
     */
    private void cancelPickerAndVerifyForeground(UiDevice device, String appPkg, String pickerPkg,
                                               android.graphics.Bitmap beforePicker) throws Exception {
        // DocumentsUI may be reported RESUMED while Android is still
        // transitioning the foreground from MainActivity to the picker.
        // CI reproduced a false "app foreground / WebView hidden" assertion
        // during this launch gap, BEFORE the first Back was even pressed.
        // Verify a stable resolved picker before sending any cancellation.
        // An Activity can be RESUMED before the OS renders DocumentsUI.
        // Some headless API-35 runners never populate mCurrentFocus at all,
        // even after the picker is Displayed. Instead require a real clickable
        // accessibility node from the resolved picker plus a dwell time.
        long readyUntil=SystemClock.elapsedRealtime()+25_000;
        int stablePickerPolls=0;
        long firstInteractiveAt=0L;
        double lastPaintDelta=0d;
        boolean lastAccessible=false;
        while(SystemClock.elapsedRealtime()<readyUntil) {
            if(scenario.getState()==Lifecycle.State.DESTROYED)
                throw new AssertionError("MainActivity destroyed before picker cancellation");
            // Keep the Android activity state requirement: a system resolver,
            // launcher or merely different accessibility package is NOT a picker.
            boolean resumed=isResumedPackage(pickerPkg);
            lastAccessible=resumed && isPickerInteractiveAndAccessible(device,pickerPkg);
            android.graphics.Bitmap pickerFrame=null;
            try {
                pickerFrame=instrumentation.getUiAutomation().takeScreenshot();
                lastPaintDelta=v5DisplayChangeRatio(beforePicker,pickerFrame);
            } finally {
                if(pickerFrame!=null)pickerFrame.recycle();
            }
            // A11y APIs can report package 'android' forever on CI. Accept
            // only REAL display-pixel transition away from the original app
            // while the resolved DocumentsUI activity is still resumed.
            // This is a second independently testable proof, not a skip.
            boolean rendered=resumed && lastPaintDelta>=0.15d;
            boolean interactive=lastAccessible || rendered;
            if(interactive) {
                if(stablePickerPolls==0)firstInteractiveAt=SystemClock.elapsedRealtime();
                stablePickerPolls++;
                if(stablePickerPolls>=4
                    && SystemClock.elapsedRealtime()-firstInteractiveAt>=1800L) break;
            } else {
                stablePickerPolls=0;
                firstInteractiveAt=0L;
            }
            SystemClock.sleep(300);
        }
        boolean stablePicker=stablePickerPolls>=4 && firstInteractiveAt>0L
            && SystemClock.elapsedRealtime()-firstInteractiveAt>=1800L;
        assertTrue("OPEN_DOCUMENT picker never had stable interactive or painted foreground UI; refusing premature Back; "
            +"pickerResumed="+isResumedPackage(pickerPkg)
            +";a11yRootMatches="+pickerPkg.equals(device.getCurrentPackageName())
            +";hasClickablePickerNode="+device.hasObject(androidx.test.uiautomator.By.pkg(pickerPkg).clickable(true))
            +";realPixelDelta="+lastPaintDelta,
            stablePicker);
        System.out.println("GALAXY_FILE_PICKER_STABLE=resumedAndRendered;polls:"+stablePickerPolls
            +";accessible:"+lastAccessible+";pixelDelta:"+lastPaintDelta);

        for (int attempt = 1; attempt <= 3; attempt++) {
            // The boolean returned by UiAutomator is NOT evidence that Back
            // did/didn't dispatch. Only send Back when the picker is still the
            // foreground Activity. Never cancel while MainActivity is resuming.
            if(!isResumedPackage(pickerPkg)) {
                if(awaitPickerMainActivityVisible(appPkg, 8_000)) {
                    System.out.println("GALAXY_FILE_PICKER_RETURN=verified;alreadyReturned:true");
                    return;
                }
                throw new AssertionError("Picker no longer foreground, but resumed visible MainActivity did not return; refusing another Back");
            }

            boolean acknowledged=device.pressBack();
            if (awaitPickerMainActivityVisible(appPkg, 4_000)) {
                System.out.println("GALAXY_FILE_PICKER_RETURN=verified;backPresses:"+attempt+";uiAck:"+acknowledged);
                return;
            }
            if (isResumedPackage(appPkg)) {
                if(awaitPickerMainActivityVisible(appPkg, 8_000)) {
                    System.out.println("GALAXY_FILE_PICKER_RETURN=verified;lateResume:"+attempt);
                    return;
                }
                throw new AssertionError("MainActivity resumed after picker cancellation but WebView remained hidden; no second Back");
            }

            // Fallback only after the OS has had time to finish the first Back,
            // and only while DocumentsUI is STILL the actually resumed Activity.
            // A late picker close must not result in a second Back to our app.
            boolean pickerStillResumed=isResumedPackage(pickerPkg);
            if (!acknowledged && pickerStillResumed && !isResumedPackage(appPkg)) {
                shell("input keyevent KEYCODE_BACK");
                System.out.println("GALAXY_FILE_PICKER_BACK_FALLBACK=pickerStillResumed;attempt:"+attempt);
                if (awaitPickerMainActivityVisible(appPkg, 4_000)) {
                    System.out.println("GALAXY_FILE_PICKER_RETURN=verified;fallback:"+attempt);
                    return;
                }
                if (isResumedPackage(appPkg)) {
                    throw new AssertionError("Picker fallback returned MainActivity but its WebView stayed hidden");
                }
            }
            System.out.println("GALAXY_FILE_PICKER_RETURN_PENDING=attempt:"+attempt
                +";pickerResumed:"+isResumedPackage(pickerPkg)
                +";appResumed:"+isResumedPackage(appPkg)
                +";rootApp:"+appPkg.equals(device.getCurrentPackageName()));
        }
        throw new AssertionError("OPEN_DOCUMENT cancellation did not restore resumed visible MainActivity;picker="
            +pickerPkg+";appResumed="+isResumedPackage(appPkg)
            +";rootApp="+appPkg.equals(device.getCurrentPackageName()));
    }

    /**
     * ActivityScenario.getState() can be checked even when the Activity has
     * been destroyed. Never call onActivity/evaluateJavascript on a dead
     * scenario: fail with an actionable lifecycle assertion instead.
     */
    private boolean awaitPickerMainActivityVisible(String appPkg,long timeoutMs) throws Exception {
        long until=SystemClock.elapsedRealtime()+timeoutMs;
        while (SystemClock.elapsedRealtime()<until) {
            if (scenario.getState()==Lifecycle.State.DESTROYED) {
                throw new AssertionError("MainActivity destroyed during document-picker return; unexpected extra Android Back");
            }
            if (isResumedPackage(appPkg)
                && scenario.getState()==Lifecycle.State.RESUMED
                && "visible".equals(js("document.visibilityState"))) return true;
            SystemClock.sleep(250);
        }
        return false;
    }

    /** The picker must be resumed and have a real interactive a11y node. */
    private boolean isPickerInteractiveAndAccessible(UiDevice device,String pickerPkg) throws Exception {
        return isResumedPackage(pickerPkg)
            && pickerPkg.equals(device.getCurrentPackageName())
            && device.hasObject(androidx.test.uiautomator.By.pkg(pickerPkg).clickable(true));
    }

    /** Match the ACTUAL foreground activity; task history alone is insufficient. */
    private boolean isResumedPackage(String expectedPackage) throws Exception {
        if (expectedPackage == null || expectedPackage.isBlank()) return false;
        String resumed = shell("dumpsys activity activities | grep -m1 -E 'mResumedActivity|topResumedActivity'");
        return resumed.contains(expectedPackage + "/");
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
        // Log only booleans and delivery counters; never log the message body, ids or auth headers.
        System.out.println("GALAXY_QA_CHAT_SUBMIT="+qaChatFailureDiagnostic());
    }

    private String qaChatFailureDiagnostic() {
        long sent = backend == null ? -1 : backend.sentCount();
        boolean sendSeen = backend != null && backend.actions().contains("chat-send");
        if (scenario == null) return "scenario=false;sent="+sent+";sendSeen="+sendSeen;
        try {
            String state = js("JSON.stringify((()=>{"
                + "const form=document.querySelector('#chatForm'),button=form?.querySelector('.chat-send'),"
                + "composer=typeof ensureChatComposer==='function'?ensureChatComposer().snapshot():null,"
                + "delivery=typeof chatDeliveryEngine==='undefined'||!chatDeliveryEngine?null:chatDeliveryEngine.snapshot();"
                + "return {chat:typeof view!=='undefined'&&view==='chat',form:!!form,"
                + "buttonType:button?.type||null,buttonDisabled:!!button?.disabled,"
                + "composerHasText:!!composer?.text?.trim(),composerDisabled:!!composer?.disabled,"
                + "composerSending:!!composer?.sending,paired:typeof native!=='undefined'&&!!native?.paired,"
                + "navigatorOnline:navigator.onLine,deliveryOnline:delivery?.online??null,"
                + "deliveryPending:delivery?.pending??null,deliverySending:delivery?.sending??null,"
                + "deliveryFailed:delivery?.failed??null,visibility:document.visibilityState};})())");
            return "sent="+sent+";sendSeen="+sendSeen+";state="+state;
        } catch (Exception | AssertionError ignored) {
            return "sent="+sent+";sendSeen="+sendSeen+";state=unavailable";
        }
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
            web.requestFocus();
            int[] location = new int[2];
            web.getLocationOnScreen(location);
            frame.set(new int[]{location[0], location[1], web.getWidth(), web.getHeight()});
        });
        // Do not gate a real Android tap on both focus flags *before* the tap:
        // headless UiAutomator may report window focus false until the first touch.
        // The post-touch DOM focus and IME checks below remain strict.
        int[] v = frame.get();
        assertNotNull("WebView must be attached before Android touch", v);
        assertTrue("WebView is not laid out for Android touch", v[2] > 0 && v[3] > 0);
        System.out.println("GALAXY_WEBVIEW_BEFORE_TOUCH=" + js(
            "JSON.stringify({visible:document.visibilityState,selector:" + quoted
            + ",found:!!document.querySelector(" + quoted + ")})"));
        // V5-P3: opening Search can asynchronously focus the input and raise
        // the IME while the physical display is being resized through wm size.
        // Coordinates measured BEFORE WebView.requestFocus() can then tap the
        // dialog backdrop instead of the field, closing the modal at 412 CSS px.
        // Recompute from live Android WebView DOM AFTER the focus/layout settles.
        // This is still a real UiAutomator touch, never JS .focus() or input.
        if ("#universalSearchInput".equals(selector)) {
            SystemClock.sleep(200);
            String latest=js("JSON.stringify((()=>{const e=document.querySelector(" + quoted + "),"
                + "r=e?.getBoundingClientRect(),x=r?(r.left+r.right)/2:0,"
                + "y=r?(r.top+r.bottom)/2:0,hit=document.elementFromPoint(x,y);"
                + "return {x,y,vw:innerWidth,vh:innerHeight,"
                + "open:!!document.querySelector('#modal')?.open,"
                + "width:r?.width||0,height:r?.height||0,"
                + "hit:hit?.tagName||'',hitId:hit?.id||'',"
                + "targetHit:!!e&&(hit===e||hit?.contains(e)||e.contains(hit))};})())");
            JSONObject live=new JSONObject(latest);
            assertTrue("P3 native search touch requires a visible, unobscured input: "+latest,
                live.optBoolean("open") && live.optBoolean("targetHit")
                && live.optDouble("width")>=30d && live.optDouble("height")>=30d);
            g=live;
            System.out.println("V5_P3_ANDROID_NATIVE_TAP_GEOMETRY="+latest);
        }
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
        if ("#chatForm textarea".equals(selector)) {
            // IME.isAcceptingText() may stay false on a headless emulator even when
            // a real touch has focused the WebView textarea. Gate on the DOM focus;
            // each caller still injects Android input and asserts it reaches the field.
            awaitJs("document.activeElement===document.querySelector('#chatForm textarea')");
            AtomicReference<Boolean> accepting = new AtomicReference<>(false);
            scenario.onActivity(a -> accepting.set(((android.view.inputmethod.InputMethodManager)a.getSystemService(Context.INPUT_METHOD_SERVICE)).isAcceptingText()));
            System.out.println("GALAXY_WEBVIEW_IME_ACCEPTING=" + accepting.get());
        }
    }

    // On a headless AVD, adb "input text" can be dropped even when Chromium's
    // textarea has DOM focus: the system IME reports that WebView is not served.
    // Fall back ONLY to Android's InputConnection / hardware KeyEvent pathways.
    // Never alter the DOM value from JavaScript; every caller still verifies it.
    private void typeAndroidWebInput(String value) throws Exception {
        typeAndroidWebInputFor("#chatForm textarea",value);
    }

    private void typeAndroidWebInputFor(String selector,String value) throws Exception {
        String expected="(document.querySelector("+JSONObject.quote(selector)+")?.value||'').includes("+
            JSONObject.quote(value)+")";
        shell("input text "+value);
        if("true".equals(js(expected)))return;
        AtomicReference<Boolean> committed=new AtomicReference<>(false);
        scenario.onActivity(activity->{
            WebView web=activity.findViewById(R.id.webView);
            android.view.inputmethod.EditorInfo editor=new android.view.inputmethod.EditorInfo();
            android.view.inputmethod.InputConnection connection=web.onCreateInputConnection(editor);
            if(connection!=null)committed.set(connection.commitText(value,1));
        });
        System.out.println("GALAXY_WEBVIEW_INPUT_CONNECTION_COMMITTED="+committed.get());
        SystemClock.sleep(200);
        if(!"true".equals(js(expected))){
            scenario.onActivity(activity->{
                WebView web=activity.findViewById(R.id.webView);
                android.view.KeyCharacterMap map=android.view.KeyCharacterMap.load(
                    android.view.KeyCharacterMap.VIRTUAL_KEYBOARD);
                android.view.KeyEvent[] keys=map.getEvents(value.toCharArray());
                assertNotNull("Android keyboard cannot generate events for WebView input.",keys);
                for(android.view.KeyEvent event:keys)web.dispatchKeyEvent(event);
            });
            System.out.println("GALAXY_WEBVIEW_NATIVE_KEYEVENT_INPUT="+value.length());
        }
        awaitJs(expected);
    }

    /**
     * Display-level QA gate: the fixed cyan 64x8 CSS-pixel mark is inserted only
     * by instrumentation. A rendered WebView behind a pairing screen, system
     * dialog or stale activity has no visible mark, and must NOT produce a PASS.
     * No visual OCR or user data is required. The mark is removed after capture.
     */
    /**
     * Verifies pixels on the actual Android display, not just WebView scrollY.
     * Crop out the fixed header, status/nav bars and paint QA marker. UI and
     * compositor can diverge briefly on software-rendered emulators. Insist
     * on two consecutive changed frames or FAIL instead of archiving a false
     * "bottom" screenshot. No screenshot bytes are sent outside CI artifacts.
     */
    /** Distinct Android framebuffer at the actual middle question, not DOM alone. */
    private double awaitV5QuestionFramePainted(android.graphics.Bitmap top,int widthCss) {
        long until=SystemClock.elapsedRealtime()+15_000;
        int consecutive=0;
        double latest=0d;
        while(SystemClock.elapsedRealtime()<until) {
            android.graphics.Bitmap frame=null;
            try {
                frame=instrumentation.getUiAutomation().takeScreenshot();
                latest=v5DisplayChangeRatio(top,frame);
                if(latest>=0.15d) {
                    if(++consecutive>=2) {
                        System.out.println("V5_P2_QUESTION_REAL_DISPLAY=css:"+widthCss
                            +";changedPixelRatio:"+latest+";verified:true");
                        return latest;
                    }
                } else consecutive=0;
            } catch(RuntimeException ignored){consecutive=0;}
            finally {if(frame!=null)frame.recycle();}
            SystemClock.sleep(250);
        }
        throw new AssertionError("P2 middle question screenshot rejected: real Android display"
            +" did not paint distinct question frame at css "+widthCss
            +";changedPixelRatio:"+latest);
    }

    /**
     * P3 display-pixel gate. DOM geometry and valid PNG headers are NOT evidence
     * that the headless Android compositor painted the active dialog.
     * Unique per-modal QA markers are shown only in isolated AVD fixture tests.
     */
    private void awaitV5P3ModalPainted(android.graphics.Bitmap previous,int widthCss,
                                       String surface,int red,int green,int blue) {
        long deadline=SystemClock.elapsedRealtime()+20_000;
        int stable=0;
        int matched=0;
        double ratio=0d;
        while(SystemClock.elapsedRealtime()<deadline) {
            android.graphics.Bitmap shot=null;
            try {
                shot=instrumentation.getUiAutomation().takeScreenshot();
                matched=0;
                if(shot!=null) {
                    ratio=v5DisplayChangeRatio(previous,shot);
                    // Scan actual Android framebuffer for the modal-specific
                    // high-chroma marker. It is invisible behind an unpainted
                    // WebView, unlike its already-updated HTML DOM.
                    for(int y=24;y<shot.getHeight()*3/4;y+=6) {
                        for(int x=12;x<shot.getWidth()*3/4;x+=6) {
                            int p=shot.getPixel(x,y);
                            if(Math.abs(android.graphics.Color.red(p)-red)<=5
                                && Math.abs(android.graphics.Color.green(p)-green)<=5
                                && Math.abs(android.graphics.Color.blue(p)-blue)<=5)matched++;
                        }
                    }
                }
                if(matched>=18&&ratio>=0.01d) {
                    if(++stable>=2) {
                        System.out.println("V5_P3_MODAL_REAL_DISPLAY=css:"+widthCss
                            +";surface:"+surface+";markerPixels:"+matched
                            +";changedPixelRatio:"+ratio+";verified:true");
                        return;
                    }
                } else stable=0;
            }catch(RuntimeException ignored){stable=0;}
            finally {if(shot!=null)shot.recycle();}
            SystemClock.sleep(250);
        }
        throw new AssertionError("P3 "+surface+" modal did not visibly paint"
            +" on real Android display at css "+widthCss
            +";markerPixels:"+matched+";changedPixelRatio:"+ratio);
    }

    private double awaitV5BottomFramePainted(android.graphics.Bitmap top,int widthCss) {
        long until=SystemClock.elapsedRealtime()+15_000;
        int consecutive=0;
        double latest=0;
        while(SystemClock.elapsedRealtime()<until) {
            android.graphics.Bitmap candidate=null;
            try {
                candidate=instrumentation.getUiAutomation().takeScreenshot();
                latest=v5DisplayChangeRatio(top,candidate);
                if(latest>=0.15d) {
                    if(++consecutive>=2) {
                        System.out.println("V5_P2_BOTTOM_REAL_DISPLAY=css:"+widthCss
                            + ";changedPixelRatio:"+latest+";verified:true");
                        return latest;
                    }
                } else consecutive=0;
            } catch(RuntimeException ignored){consecutive=0;}
            finally {if(candidate!=null)candidate.recycle();}
            SystemClock.sleep(250);
        }
        throw new AssertionError("P2 bottom screenshot rejected: Android display never painted"
            +" a visibly different lower scroll frame at css "+widthCss
            +";changedPixelRatio:"+latest
            +";JS scroll geometry alone is not screenshot evidence");
    }

    private static double v5DisplayChangeRatio(android.graphics.Bitmap top,android.graphics.Bitmap bottom) {
        if(top==null||bottom==null||top.getWidth()!=bottom.getWidth()
            ||top.getHeight()!=bottom.getHeight())return 0;
        int width=top.getWidth(),height=top.getHeight(),total=0,changed=0;
        // Text/content zone, avoiding fixed rails, wallpaper and QA marker.
        for(int y=height/4;y<height*7/10;y+=16) {
            for(int x=width/6;x<width*5/6;x+=16) {
                int a=top.getPixel(x,y),b=bottom.getPixel(x,y);
                int delta=Math.max(Math.abs(android.graphics.Color.red(a)-android.graphics.Color.red(b)),
                    Math.max(Math.abs(android.graphics.Color.green(a)-android.graphics.Color.green(b)),
                        Math.abs(android.graphics.Color.blue(a)-android.graphics.Color.blue(b))));
                total++;
                if(delta>36)changed++;
            }
        }
        return total>0?(double)changed/total:0d;
    }

    private void awaitV5QaPainted(String theme) {
        long deadline=SystemClock.elapsedRealtime()+15_000;
        int consecutive=0;
        while (SystemClock.elapsedRealtime()<deadline) {
            android.graphics.Bitmap shot=null;
            try {
                shot=instrumentation.getUiAutomation().takeScreenshot();
                int matched=0;
                if(shot!=null){
                    int maxX=Math.min(shot.getWidth(),260);
                    int maxY=Math.min(shot.getHeight(),260);
                    for(int y=20;y<maxY;y+=4){
                        for(int x=4;x<maxX;x+=4){
                            int pixel=shot.getPixel(x,y);
                            if(Math.abs(android.graphics.Color.red(pixel)-7)<=2
                                && Math.abs(android.graphics.Color.green(pixel)-225)<=2
                                && Math.abs(android.graphics.Color.blue(pixel)-247)<=2){
                                matched++;
                            }
                        }
                    }
                }
                if(matched>=20){
                    consecutive++;
                    if(consecutive>=2){
                        System.out.println("V5_P1_ANDROID_VISIBLE_FRAME="+theme+":true");
                        return;
                    }
                }else consecutive=0;
            } catch(RuntimeException ignored) { consecutive=0; }
            finally {if(shot!=null)shot.recycle();}
            SystemClock.sleep(200);
        }
        throw new AssertionError("V5 P1 screenshot rejected: real Android display has no QA home paint marker for "+theme);
    }

    // WCAG contrast of computed RGB colors, calculated on Android's Java side
    // to avoid long synchronous JavaScript on slow emulator GPUs.
    private static double v5ColorContrast(String background, String foreground) {
        double a=v5ColorLuminance(background), b=v5ColorLuminance(foreground);
        return (Math.max(a,b)+0.05d)/(Math.min(a,b)+0.05d);
    }

    private static double v5ColorLuminance(String rgb) {
        int open=rgb.indexOf('('), close=rgb.indexOf(')');
        if (open<0 || close<=open) throw new IllegalArgumentException("Unexpected CSS color: "+rgb);
        String[] channels=rgb.substring(open+1,close).split(",");
        if (channels.length<3) throw new IllegalArgumentException("Incomplete CSS RGB: "+rgb);
        double[] weights={0.2126d,0.7152d,0.0722d};
        double sum=0d;
        for (int i=0;i<3;i++) {
            double value=Double.parseDouble(channels[i].trim())/255d;
            double linear=value<=0.04045d?value/12.92d:Math.pow((value+0.055d)/1.055d,2.4d);
            sum+=weights[i]*linear;
        }
        return sum;
    }

    /**
     * Visual-only QA on software-rendered cold Android AVD: allow at most 20s
     * per action, including navigation/scroll/paint, and ASSERT the callback
     * executed. Ordinary Chat QA retains the strict 5s callback deadline.
     */
    private void runV5Js(String script) {
        String result=jsWithDeadline("(function(){" + script + ";return 'ok';})()",20);
        assertEquals("V5 Android WebView action did not complete: "+script,"ok",result);
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

    private String js(String expression) { return jsWithDeadline(expression,5); }

    // Only the P1 synthetic visual CSS sampling uses 20 seconds. Existing
    // Chat and onboarding tests retain their original 5-second hard timeout.
    private String jsWithDeadline(String expression, int timeoutSeconds) {
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
            if (!latch.await(timeoutSeconds, TimeUnit.SECONDS)) throw new AssertionError(
                "JavaScript callback timed out after " + timeoutSeconds + "s: " + expression);
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
        // Preserve the assertion while adding a privacy-safe snapshot for emulator-only failures.
        // A remote CI pass does not negate a reproducible local WebView/Chat failure.
        if (last != null) throw new AssertionError(last.getMessage()
            + "; GALAXY_QA_CHAT_TIMEOUT=" + qaChatFailureDiagnostic(), last);
        throw new AssertionError("Condition timed out after " + timeoutMs
            + " ms; GALAXY_QA_CHAT_TIMEOUT=" + qaChatFailureDiagnostic());
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
