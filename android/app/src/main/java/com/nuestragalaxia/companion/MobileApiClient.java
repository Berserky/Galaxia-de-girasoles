package com.nuestragalaxia.companion;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public final class MobileApiClient {
    private MobileApiClient(){}

    private static JSONObject response(HttpURLConnection c) throws Exception {
        int code=c.getResponseCode();
        InputStream stream=code>=200&&code<300?c.getInputStream():c.getErrorStream();
        String text="";
        if(stream!=null){
            try(BufferedReader r=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){
                StringBuilder b=new StringBuilder(); String line;
                while((line=r.readLine())!=null)b.append(line);
                text=b.toString();
            }
        }
        JSONObject result=text.trim().isEmpty()?new JSONObject():new JSONObject(text);
        if(code<200||code>=300)throw new ApiClient.ApiException(code,result.optString("error","Error de red "+code));
        return result;
    }

    public static JSONObject post(String token,JSONObject body) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(BuildConfig.EDGE_URL).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(15000);
        c.setReadTimeout(25000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type","application/json");
        c.setRequestProperty("apikey",BuildConfig.SUPABASE_PUBLISHABLE_KEY);
        c.setRequestProperty("x-device-token",token);
        byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
        c.setFixedLengthStreamingMode(bytes.length);
        try(OutputStream out=c.getOutputStream()){out.write(bytes);}
        try{return response(c);}finally{c.disconnect();}
    }

    public static JSONObject upload(Context context,String token,Uri uri,String kind) throws Exception {
        String mime=context.getContentResolver().getType(uri);
        if(mime==null||mime.isBlank())mime="voice".equals(kind)?"audio/mpeg":"music".equals(kind)?"audio/mpeg":"image/jpeg";
        String name=fileName(context,uri);
        long length=fileSize(context,uri);

        HttpURLConnection c=(HttpURLConnection)new URL(BuildConfig.EDGE_URL).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(20000);
        c.setReadTimeout(45000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type",mime);
        c.setRequestProperty("apikey",BuildConfig.SUPABASE_PUBLISHABLE_KEY);
        c.setRequestProperty("x-device-token",token);
        c.setRequestProperty("x-mobile-action","upload");
        c.setRequestProperty("x-media-kind",kind);
        c.setRequestProperty("x-file-name",URLEncoder.encode(name,"UTF-8"));
        if(length>=0&&length<=Integer.MAX_VALUE)c.setFixedLengthStreamingMode((int)length);
        else c.setChunkedStreamingMode(8192);

        try(InputStream in=context.getContentResolver().openInputStream(uri);OutputStream out=c.getOutputStream()){
            if(in==null)throw new IOException("No se pudo leer el archivo.");
            byte[] buffer=new byte[8192]; int read;
            while((read=in.read(buffer))!=-1)out.write(buffer,0,read);
        }
        try{return response(c);}finally{c.disconnect();}
    }

    public static JSONObject uploadVoiceFile(Context context,String token,File file) throws Exception {
        String mime="audio/mp4",name=file.getName();
        HttpURLConnection c=(HttpURLConnection)new URL(BuildConfig.EDGE_URL).openConnection();
        c.setRequestMethod("POST");c.setConnectTimeout(20000);c.setReadTimeout(45000);c.setDoOutput(true);
        c.setRequestProperty("Content-Type",mime);c.setRequestProperty("apikey",BuildConfig.SUPABASE_PUBLISHABLE_KEY);
        c.setRequestProperty("x-device-token",token);c.setRequestProperty("x-mobile-action","upload");
        c.setRequestProperty("x-media-kind","voice");c.setRequestProperty("x-file-name",URLEncoder.encode(name,"UTF-8"));
        c.setFixedLengthStreamingMode(file.length());
        try(InputStream in=new FileInputStream(file);OutputStream out=c.getOutputStream()){
            byte[] buffer=new byte[8192];int read;while((read=in.read(buffer))!=-1)out.write(buffer,0,read);
        }
        try{return response(c);}finally{c.disconnect();}
    }

    private static String fileName(Context context,Uri uri){
        try(Cursor cursor=context.getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
            if(cursor!=null&&cursor.moveToFirst()){
                int i=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if(i>=0)return cursor.getString(i);
            }
        }catch(Exception ignored){}
        String tail=uri.getLastPathSegment();
        return tail==null?"archivo":tail;
    }

    private static long fileSize(Context context,Uri uri){
        try(Cursor cursor=context.getContentResolver().query(uri,new String[]{OpenableColumns.SIZE},null,null,null)){
            if(cursor!=null&&cursor.moveToFirst()){
                int i=cursor.getColumnIndex(OpenableColumns.SIZE);
                if(i>=0&&!cursor.isNull(i))return cursor.getLong(i);
            }
        }catch(Exception ignored){}
        return -1;
    }
}
