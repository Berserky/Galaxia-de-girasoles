package com.nuestragalaxia.companion;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Hermetic HTTP staging backend used by Android instrumentation.
 *
 * It deliberately speaks the same JSON-over-HTTP contract as android-companion,
 * but lives only in androidTest and binds to loopback. No production data is read
 * or mutated. The app still uses ApiClient/MobileApiClient and its real WebView bridge.
 */
final class QaHttpServer implements Closeable {
    static final int PORT = 18765;
    enum NetworkMode { NORMAL, SLOW, FAIL_503, TIMEOUT }

    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final CopyOnWriteArrayList<JSONObject> sentMessages = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<String> actions = new CopyOnWriteArrayList<>();
    private final AtomicLong sequence = new AtomicLong(200);
    private volatile NetworkMode networkMode = NetworkMode.NORMAL;
    private volatile boolean running;
    private ServerSocket server;

    void start() throws IOException {
        server = new ServerSocket(PORT, 20, InetAddress.getByName("127.0.0.1"));
        running = true;
        pool.execute(() -> {
            while (running) {
                try {
                    Socket socket = server.accept();
                    pool.execute(() -> handle(socket));
                } catch (IOException e) {
                    if (running) throw new RuntimeException(e);
                }
            }
        });
    }

    void reset() { networkMode = NetworkMode.NORMAL; actions.clear(); sentMessages.clear(); sequence.set(200); }
    void setNetworkMode(NetworkMode mode) { networkMode = mode == null ? NetworkMode.NORMAL : mode; }
    List<String> actions() { return Collections.unmodifiableList(new ArrayList<>(actions)); }
    long sentCount() { return sentMessages.size(); }
    void receivePartner(int count) throws Exception {
        for(int i=0;i<count;i++){
            long seq=sequence.incrementAndGet();
            sentMessages.add(new JSONObject().put("id",UUID.randomUUID().toString()).put("client_id",UUID.randomUUID().toString())
                .put("sender_person","1").put("body","Incoming QA "+seq).put("message_type","text")
                .put("attachments",new JSONArray()).put("server_seq",seq).put("created_at",Instant.now().toString()).put("reactions",new JSONArray()));
        }
    }

    @Override public void close() {
        running = false;
        try { if (server != null) server.close(); } catch (IOException ignored) {}
        pool.shutdownNow();
    }

    private void handle(Socket socket) {
        try (Socket s = socket;
             BufferedInputStream in = new BufferedInputStream(s.getInputStream());
             BufferedOutputStream out = new BufferedOutputStream(s.getOutputStream())) {
            Request request = readRequest(in);
            if (request == null) return;

            NetworkMode mode = networkMode;
            if (mode == NetworkMode.TIMEOUT) {
                sleep(3500);
                return;
            }
            if (mode == NetworkMode.SLOW) sleep(900);
            if (mode == NetworkMode.FAIL_503) {
                write(out, 503, new JSONObject().put("error", "qa-network-unavailable").toString());
                return;
            }

            JSONObject body;
            try { body = request.body.isBlank() ? new JSONObject() : new JSONObject(request.body); }
            catch (Exception e) { body = new JSONObject(); }

            String action = body.optString("action", "");
            actions.add(action);
            JSONObject response = route(action, body, request.headers);
            write(out, response.optInt("__status", 200), stripStatus(response).toString());
        } catch (Exception ignored) {
            // A client disconnect is expected in timeout/offline tests.
        }
    }

    private JSONObject route(String action, JSONObject body, Map<String,String> headers) throws Exception {
        String token = headers.getOrDefault("x-device-token", "");
        String person = token.endsWith("-1") ? "1" : "0";

        switch (action) {
            case "pair": {
                String code = body.optString("code", "");
                String p = code.endsWith("1") ? "1" : "0";
                return new JSONObject()
                    .put("device_token", "qa-token-" + p)
                    .put("device", new JSONObject().put("person", p).put("name", p.equals("0") ? "QA Sebas" : "QA Adri"));
            }
            case "mobile-state": return mobileState(person);
            case "moments": return new JSONObject().put("items", new JSONArray());
            case "media-list": return new JSONObject().put("items", new JSONArray());
            case "map-state": return mapState(person);
            case "context-state": return mapState(person).getJSONObject("context");
            case "chat-state": return chatState(person);
            case "chat-preferences": return new JSONObject().put("preferences", new JSONObject()
                    .put("theme", "galaxy").put("notification_privacy", "full")
                    .put("show_read", true).put("show_last_seen", true).put("show_typing", true));
            case "chat-presence": return new JSONObject().put("ok", true)
                    .put("partner", new JSONObject().put("state", "ONLINE").put("online", true).put("lastActiveAt", Instant.now().toString()));
            case "chat-read":
            case "chat-metric":
            case "notifications-read":
            case "presence-set":
            case "settings-save":
            case "daily-save":
            case "status-set":
            case "transport-set":
                return new JSONObject().put("ok", true);
            case "chat-send": return chatSend(body, person);
            case "chat-poll": return pollMutation(body);
            case "chat-checklist": return checklistMutation(body);
            case "goals-engine": return goals(body);
            case "date-engine": return dateEngine();
            case "backup-export": return new JSONObject()
                    .put("schemaVersion", "20261005011401")
                    .put("backupId", "qa-backup")
                    .put("manifest", new JSONObject().put("items", 8).put("media", 0))
                    .put("payload", new JSONObject().put("qa", true));
            case "backup-import": return new JSONObject().put("ok", true).put("restored", true);
            case "notifications-list": return new JSONObject().put("items", new JSONArray()).put("unread", 0);
            case "frequent-places": return new JSONObject().put("items", new JSONArray());
            case "encounter-stats": return new JSONObject().put("count", 0).put("togetherSeconds", 0);
            case "today-history": return new JSONObject().put("items", new JSONArray());
            case "monthly-summary":
            case "insights-summary":
                return emptyInsights();
            case "intelligence-search": return new JSONObject().put("items", new JSONArray())
                    .put("results", new JSONArray()).put("answer", "QA");
            case "intelligence-connections": return new JSONObject().put("connections", new JSONArray());
            case "push-token-register":
            case "push-token-unregister":
            case "push-preferences":
                return new JSONObject().put("ok", true).put("configured", false);
            default: return new JSONObject().put("ok", true);
        }
    }

    private JSONObject mobileState(String person) throws Exception {
        String day = LocalDate.now().toString();
        JSONArray items = new JSONArray()
            .put(item("10000000-0000-4000-8000-000000000001", "memory", "Primer QA", "Un recuerdo de integración", "2026-10-01"))
            .put(item("10000000-0000-4000-8000-000000000002", "plan", "Plan QA", "Prueba de plan", "2026-10-12"))
            .put(item("10000000-0000-4000-8000-000000000003", "event", "Evento QA", "Prueba de evento", "2026-10-20"))
            .put(new JSONObject().put("id", "10000000-0000-4000-8000-000000000004").put("kind", "capsule").put("author", "1")
                .put("created", Instant.now().toString()).put("version", 1)
                .put("data", new JSONObject().put("title", "Cápsula QA").put("unlockType", "date")
                    .put("unlockAt", "2099-01-01T05:00:00Z").put("unlockDate", "2099-01-01").put("locked", true)));

        JSONArray daily = new JSONArray()
            .put(new JSONObject().put("day", day).put("person", "0").put("mood", "feliz").put("answer", "Respuesta QA 0"))
            .put(new JSONObject().put("day", day).put("person", "1").put("mood", "tranquilo").put("answer", "Respuesta QA 1"));

        JSONArray locations = locations();
        JSONArray presence = new JSONArray()
            .put(new JSONObject().put("person", "0").put("share_battery", true).put("share_song", false).put("battery", 75).put("updated_at", Instant.now().toString()))
            .put(new JSONObject().put("person", "1").put("share_battery", true).put("share_song", false).put("battery", 62).put("updated_at", Instant.now().toString()));

        return new JSONObject()
            .put("person", person)
            .put("device", new JSONObject().put("id", "qa-device-" + person).put("name", "QA Android " + person))
            .put("today", day)
            .put("settings", new JSONObject().put("id", 1).put("version", 1)
                .put("data", new JSONObject().put("names", new JSONArray().put("Sebas").put("Adri")).put("startDate", "2026-05-01")))
            .put("items", items)
            .put("daily", daily)
            .put("bond", new JSONObject().put("garden", new JSONObject().put("days", 8).put("stage", 2)).put("items", new JSONArray()))
            .put("locations", locations)
            .put("places", new JSONArray().put(new JSONObject().put("id", 1).put("name", "Lugar QA").put("kind", "favorite")
                .put("latitude", 4.7110).put("longitude", -74.0721).put("created_at", Instant.now().toString())))
            .put("presence", presence)
            .put("devices", new JSONArray().put(new JSONObject().put("id", "qa-device-" + person).put("person", person).put("name", "QA Android " + person)))
            .put("chat", new JSONObject().put("unread", 1))
            .put("notifications", new JSONObject().put("unread", 0))
            .put("nextEvent", new JSONObject().put("title", "Evento QA").put("date", "2026-10-20"))
            .put("capabilities", new JSONObject()
                .put("photos", true).put("music", true).put("voice", true).put("widget", true)
                .put("backgroundLocation", true).put("trips", true).put("backup", true)
                .put("presence", true).put("profileManagement", true).put("intelligence", true)
                .put("transcription", true).put("book", true).put("chat", true).put("notifications", true));
    }

    private JSONObject mapState(String person) throws Exception {
        JSONObject context = new JSONObject()
            .put("sessions", new JSONArray().put(new JSONObject()
                .put("id", "70000000-0000-4000-8000-000000000001").put("person", person)
                .put("mode", "eta").put("status", "active").put("label", "Casa QA")
                .put("progress_pct", 42).put("eta_seconds", 780).put("last_distance_m", 3200).put("updated_at", Instant.now().toString())))
            .put("settings", new JSONArray()).put("events", new JSONArray()).put("suggestions", new JSONArray());
        return new JSONObject()
            .put("locations", locations())
            .put("places", new JSONArray().put(new JSONObject().put("id", 1).put("name", "Lugar QA").put("kind", "favorite")
                .put("latitude", 4.7110).put("longitude", -74.0721)))
            .put("tripPoints", new JSONArray())
            .put("context", context);
    }

    private JSONArray locations() throws Exception {
        String now = Instant.now().toString();
        return new JSONArray()
            .put(new JSONObject().put("person", "0").put("sharing", true).put("latitude", 4.7110).put("longitude", -74.0721)
                .put("accuracy", 8).put("speed", 0.5).put("heading", 0).put("motion", "walking").put("status", "QA").put("updated_at", now))
            .put(new JSONObject().put("person", "1").put("sharing", true).put("latitude", 4.7150).put("longitude", -74.0690)
                .put("accuracy", 10).put("speed", 0).put("heading", 0).put("motion", "still").put("status", "QA").put("updated_at", now));
    }

    private JSONObject chatState(String person) throws Exception {
        JSONArray messages = new JSONArray();
        int seq = 1;
        for (JSONObject card : cardFixtures()) {
            messages.put(messageForCard(seq++, person.equals("0") ? "1" : "0", card));
        }
        for (JSONObject sent : sentMessages) messages.put(new JSONObject(sent.toString()));
        return new JSONObject()
            .put("messages", messages)
            .put("unread", 0)
            .put("nextBeforeSeq", JSONObject.NULL)
            .put("partnerPresence", new JSONObject().put("state", "ONLINE").put("online", true).put("lastActiveAt", Instant.now().toString()))
            .put("pinnedIds", new JSONArray());
    }

    private JSONObject chatSend(JSONObject body, String person) throws Exception {
        long seq = sequence.incrementAndGet();
        String id = UUID.randomUUID().toString();
        JSONObject message = new JSONObject()
            .put("id", id).put("client_id", body.optString("clientId", UUID.randomUUID().toString()))
            .put("sender_person", person).put("body", body.optString("body", ""))
            .put("message_type", body.optString("messageType", "text"))
            .put("attachment", body.optJSONObject("attachment") == null ? new JSONObject() : body.optJSONObject("attachment"))
            .put("attachments", body.optJSONArray("attachments") == null ? new JSONArray() : body.optJSONArray("attachments"))
            .put("server_seq", seq).put("status", "SENT").put("schedule_state", "sent")
            .put("created_at", Instant.now().toString()).put("server_received_at", Instant.now().toString())
            .put("sent_at", Instant.now().toString()).put("reactions", new JSONArray());
        sentMessages.add(message);
        return new JSONObject().put("__status", 201).put("message", message).put("scheduled", false).put("idempotent", false);
    }

    private JSONObject pollMutation(JSONObject body) throws Exception {
        String op = body.optString("operation", "vote");
        JSONObject poll = pollCard();
        if ("close".equals(op)) {
            poll.put("closed", true).put("closedAt", Instant.now().toString())
                .put("winner", new JSONObject().put("id", "81000000-0000-4000-8000-000000000001").put("label", "Opción A").put("votes", 1));
        }
        return new JSONObject().put("poll", poll).put("card", poll).put("ok", true);
    }

    private JSONObject checklistMutation(JSONObject body) throws Exception {
        JSONObject card = checklistCard();
        return new JSONObject().put("checklist", card).put("card", card).put("ok", true);
    }

    private JSONObject goals(JSONObject body) throws Exception {
        JSONObject goal = new JSONObject()
            .put("id", "30000000-0000-4000-8000-000000000001")
            .put("kind", "goal").put("title", "Objetivo QA").put("description", "Instrumentación")
            .put("category", "project").put("status", "active").put("version", 1).put("progressPct", 35)
            .put("participants", new JSONArray().put("0").put("1")).put("steps", new JSONArray())
            .put("links", new JSONArray()).put("contributions", new JSONArray());
        return new JSONObject().put("goals", new JSONArray().put(goal));
    }

    private JSONObject dateEngine() throws Exception {
        return new JSONObject().put("question", new JSONObject()
            .put("id", "qa-question").put("day", LocalDate.now().toString()).put("deck", "future")
            .put("text", "¿Qué construimos después?").put("question", "¿Qué construimos después?").put("favorite", false));
    }

    private JSONObject emptyInsights() throws Exception {
        return new JSONObject()
            .put("period", new JSONObject().put("kind", "month").put("key", LocalDate.now().toString().substring(0,7))
                .put("startDay", LocalDate.now().withDayOfMonth(1).toString()).put("endDay", LocalDate.now().plusDays(1).toString()))
            .put("counts", new JSONObject()).put("trips", new JSONObject()).put("encounters", new JSONObject())
            .put("connection", new JSONObject()).put("bond", new JSONObject()).put("goals", new JSONObject())
            .put("highlights", new JSONArray()).put("achievements", new JSONArray()).put("series", new JSONObject())
            .put("places", new JSONObject().put("visits", new JSONArray())).put("photos", new JSONArray());
    }

    private JSONObject item(String id, String kind, String title, String body, String date) throws Exception {
        return new JSONObject().put("id", id).put("kind", kind).put("author", "0")
            .put("created", Instant.now().toString()).put("version", 1)
            .put("data", new JSONObject().put("title", title).put("body", body).put("date", date).put("category", "qa"));
    }

    private List<JSONObject> cardFixtures() throws Exception {
        List<JSONObject> cards = new ArrayList<>();
        cards.add(baseCard("MEMORY", "memory", "41000000-0000-4000-8000-000000000001", "Recuerdo QA").put("body", "Card MEMORY").put("date", "2026-10-01"));
        cards.add(baseCard("PLAN", "plan", "41000000-0000-4000-8000-000000000002", "Plan QA").put("body", "Card PLAN").put("date", "2026-10-12"));
        cards.add(baseCard("GOAL", "goal", "41000000-0000-4000-8000-000000000003", "Objetivo QA").put("category", "Proyecto").put("progressPct", 35));
        cards.add(baseCard("PLACE", "place", "1", "Lugar QA").put("latitude", 4.7110).put("longitude", -74.0721).put("note", "Card PLACE"));
        cards.add(baseCard("SONG", "song", "41000000-0000-4000-8000-000000000005", "Canción QA").put("artist", "QA").put("source", "Prueba"));
        cards.add(baseCard("ETA", "context_session", "41000000-0000-4000-8000-000000000006", "Casa QA")
            .put("person", "1").put("etaSeconds", 780).put("distanceM", 3200).put("progressPct", 42).put("transport", "Moto")
            .put("updatedAt", Instant.now().toString()).put("visualStatus", "EN CAMINO"));
        cards.add(baseCard("CHECK_IN", "context_session", "41000000-0000-4000-8000-000000000007", "Universidad QA")
            .put("person", "1").put("etaSeconds", 300).put("distanceM", 900).put("progressPct", 78).put("transport", "Caminando")
            .put("updatedAt", Instant.now().toString()).put("visualStatus", "CHECK-IN"));
        cards.add(pollCard());
        cards.add(checklistCard());
        cards.add(baseCard("CAPSULE", "capsule", "41000000-0000-4000-8000-000000000010", "Cápsula QA")
            .put("locked", true).put("unlockType", "date").put("unlockAt", "2099-01-01T05:00:00Z"));
        cards.add(baseCard("DAILY_QUESTION", "daily_question", LocalDate.now().toString(), "¿Qué construimos después?")
            .put("day", LocalDate.now().toString()).put("answeredByMe", true).put("revealed", true)
            .put("myAnswer", "Más galaxia").put("partnerAnswer", "Más aventuras"));
        cards.add(baseCard("EVENT", "event", "41000000-0000-4000-8000-000000000012", "Evento QA").put("date", "2026-10-20").put("time", "18:00"));
        cards.add(baseCard("STATUS", "status", "1", "Todo bien").put("status", "QA activo"));
        return cards;
    }

    private JSONObject pollCard() throws Exception {
        JSONArray options = new JSONArray()
            .put(new JSONObject().put("id", "81000000-0000-4000-8000-000000000001").put("label", "Opción A").put("position", 0).put("votes", 1).put("percent", 50).put("selected", true))
            .put(new JSONObject().put("id", "81000000-0000-4000-8000-000000000002").put("label", "Opción B").put("position", 1).put("votes", 1).put("percent", 50).put("selected", false));
        return baseCard("POLL", "poll", "41000000-0000-4000-8000-000000000008", "Encuesta QA")
            .put("question", "¿Plan A o B?").put("createdBy", "0").put("allowMultiple", false)
            .put("closed", false).put("totalPeople", 2).put("totalVotes", 2).put("options", options);
    }

    private JSONObject checklistCard() throws Exception {
        JSONArray rows = new JSONArray()
            .put(new JSONObject().put("id", "82000000-0000-4000-8000-000000000001").put("label", "Paso QA 1").put("position", 0).put("checked", true).put("version", 1))
            .put(new JSONObject().put("id", "82000000-0000-4000-8000-000000000002").put("label", "Paso QA 2").put("position", 1).put("checked", false).put("version", 1));
        return baseCard("CHECKLIST", "checklist", "41000000-0000-4000-8000-000000000009", "Checklist QA")
            .put("createdBy", "0").put("version", 1).put("done", 1).put("total", 2).put("items", rows);
    }

    private JSONObject baseCard(String type, String entityKind, String entityId, String title) throws Exception {
        return new JSONObject().put("available", true).put("type", type).put("entityKind", entityKind).put("entityId", entityId).put("title", title);
    }

    private JSONObject messageForCard(int seq, String sender, JSONObject card) throws Exception {
        return new JSONObject()
            .put("id", String.format(Locale.ROOT, "50000000-0000-4000-8000-%012d", seq))
            .put("client_id", String.format(Locale.ROOT, "51000000-0000-4000-8000-%012d", seq))
            .put("sender_person", sender).put("body", "").put("message_type", "card")
            .put("card", card).put("attachments", new JSONArray()).put("reactions", new JSONArray())
            .put("server_seq", seq).put("status", "DELIVERED").put("schedule_state", "sent")
            .put("created_at", Instant.now().minusSeconds(200 - seq).toString())
            .put("server_received_at", Instant.now().minusSeconds(200 - seq).toString())
            .put("delivered_at", Instant.now().toString());
    }

    private JSONObject stripStatus(JSONObject input) throws Exception {
        JSONObject out = new JSONObject(input.toString());
        out.remove("__status");
        return out;
    }

    private static final class Request {
        final Map<String,String> headers;
        final String body;
        Request(Map<String,String> headers, String body) { this.headers = headers; this.body = body; }
    }

    private Request readRequest(BufferedInputStream in) throws IOException {
        ByteArrayOutputStream head = new ByteArrayOutputStream();
        int a=-1,b=-1,c=-1,d;
        while ((d=in.read())!=-1) {
            head.write(d);
            a=b; b=c; c=d;
            byte[] x=head.toByteArray();
            int n=x.length;
            if (n>=4 && x[n-4]=='\r' && x[n-3]=='\n' && x[n-2]=='\r' && x[n-1]=='\n') break;
            if (n>64*1024) throw new IOException("headers too large");
        }
        String raw = head.toString(StandardCharsets.ISO_8859_1);
        String[] lines = raw.split("\\r?\\n");
        Map<String,String> headers = new HashMap<>();
        int length=0;
        for (int i=1;i<lines.length;i++) {
            int colon=lines[i].indexOf(':');
            if (colon<=0) continue;
            String key=lines[i].substring(0,colon).trim().toLowerCase(Locale.ROOT);
            String value=lines[i].substring(colon+1).trim();
            headers.put(key,value);
            if ("content-length".equals(key)) try { length=Integer.parseInt(value); } catch (NumberFormatException ignored) {}
        }
        byte[] body = in.readNBytes(Math.max(0,length));
        return new Request(headers, new String(body, StandardCharsets.UTF_8));
    }

    private void write(BufferedOutputStream out, int status, String body) throws IOException {
        byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
        String reason=status>=200&&status<300?"OK":status==503?"Service Unavailable":"Error";
        String headers="HTTP/1.1 "+status+" "+reason+"\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: "+bytes.length+"\r\nConnection: close\r\n\r\n";
        out.write(headers.getBytes(StandardCharsets.ISO_8859_1));
        out.write(bytes);
        out.flush();
    }

    private static void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }
}
