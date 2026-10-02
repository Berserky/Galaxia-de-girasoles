package com.nuestragalaxia.companion;

import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public final class ApiClient {
    public static final class ApiException extends IOException {
        public final int status;
        ApiException(int status,String message){super(message);this.status=status;}
    }
    public static final class PairResult { public final String token,person,name; PairResult(String t,String p,String n){token=t;person=p;name=n;} }

    private static JSONObject post(JSONObject body,String deviceToken) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(BuildConfig.EDGE_URL).openConnection();
        c.setRequestMethod("POST"); c.setConnectTimeout(15000); c.setReadTimeout(15000); c.setDoOutput(true);
        c.setRequestProperty("Content-Type","application/json");
        c.setRequestProperty("apikey",BuildConfig.SUPABASE_PUBLISHABLE_KEY);
        if(deviceToken!=null)c.setRequestProperty("x-device-token",deviceToken);
        byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
        try(OutputStream out=c.getOutputStream()){out.write(bytes);}
        int code=c.getResponseCode();
        InputStream stream=code>=200&&code<300?c.getInputStream():c.getErrorStream();
        String text; try(BufferedReader r=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){StringBuilder b=new StringBuilder();String line;while((line=r.readLine())!=null)b.append(line);text=b.toString();}
        JSONObject result=text.trim().isEmpty()?new JSONObject():new JSONObject(text);
        if(code<200||code>=300)throw new ApiException(code,result.optString("error","Error de red "+code));
        return result;
    }
    public static PairResult pair(String code,String deviceName) throws Exception {
        JSONObject body=new JSONObject().put("action","pair").put("code",code).put("device_name",deviceName);
        JSONObject result=post(body,null),device=result.getJSONObject("device");
        return new PairResult(result.getString("device_token"),String.valueOf(device.get("person")),device.optString("name",deviceName));
    }
    public static void location(String token,double lat,double lon,double accuracy,double speed,double heading,String motion,boolean history,boolean tripPoint,String capturedAt,String sampleId) throws Exception {
        JSONObject body=new JSONObject().put("action","location").put("sharing",true).put("latitude",lat).put("longitude",lon)
            .put("accuracy",accuracy).put("speed",speed).put("heading",heading).put("motion",motion)
            .put("history",history).put("trip_point",tripPoint).put("captured_at",capturedAt).put("sample_id",sampleId);
        post(body,token);
    }
    public static void history(String token,PendingPointStore.Point p) throws Exception {
        JSONObject body=new JSONObject().put("action","history").put("latitude",p.lat).put("longitude",p.lon)
            .put("accuracy",p.accuracy).put("speed",p.speed).put("heading",p.heading).put("motion",p.motion)
            .put("captured_at",p.capturedAt).put("sample_id",p.sampleId);
        post(body,token);
    }
    public static void stop(String token) throws Exception {
        post(new JSONObject().put("action","location").put("sharing",false),token);
    }
    public static JSONObject moments(String token) throws Exception {return post(new JSONObject().put("action","moments"),token);}
    public static void gesture(String token,String gesture) throws Exception {post(new JSONObject().put("action","gesture").put("gesture",gesture),token);}
}
