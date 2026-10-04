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

    private static final int MAX_JSON_RESPONSE_BYTES=4*1024*1024;

    private static long uploadLimit(String kind){
        return switch(kind){
            case "photo" -> 12L*1024L*1024L;
            case "music" -> 20L*1024L*1024L;
            case "voice" -> 5L*1024L*1024L;
            case "chat-photo","chat-audio" -> 15L*1024L*1024L;
            case "chat-video" -> 60L*1024L*1024L;
            case "chat-file" -> 30L*1024L*1024L;
            default -> -1L;
        };
    }

    private static JSONObject response(HttpURLConnection c) throws Exception {
        int code=c.getResponseCode();
        InputStream stream=code>=200&&code<300?c.getInputStream():c.getErrorStream();
        String text="";
        if(stream!=null){
            try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int read,total=0;
                while((read=in.read(buffer))!=-1){
                    total+=read;
                    if(total>MAX_JSON_RESPONSE_BYTES)throw new IOException("Respuesta demasiado grande.");
                    out.write(buffer,0,read);
                }
                text=new String(out.toByteArray(),StandardCharsets.UTF_8);
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
        if(mime==null||mime.isBlank())mime="voice".equals(kind)||"music".equals(kind)?"audio/mpeg":"chat-file".equals(kind)?"application/octet-stream":"image/jpeg";
        String name=fileName(context,uri);
        long length=fileSize(context,uri),limit=uploadLimit(kind);
        if(limit<0)throw new IOException("Tipo de archivo no válido.");
        if(length>limit)throw new IOException("El archivo supera el límite permitido.");

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
            byte[] buffer=new byte[8192];int read;long sent=0;
            while((read=in.read(buffer))!=-1){
                sent+=read;
                if(sent>limit)throw new IOException("El archivo supera el límite permitido.");
                out.write(buffer,0,read);
            }
        }
        try{return response(c);}finally{c.disconnect();}
    }

    public static JSONObject uploadVoiceFile(Context context,String token,File file) throws Exception {
        return uploadVoiceFile(context,token,file,"voice");
    }

    public static JSONObject uploadVoiceFile(Context context,String token,File file,String kind) throws Exception {
        if(!"voice".equals(kind)&&!"chat-audio".equals(kind))throw new IOException("Tipo de audio no válido.");
        String mime="audio/mp4",name=file.getName();
        long limit=uploadLimit(kind);
        if(file.length()<1||limit<0||file.length()>limit)throw new IOException("El audio supera el límite permitido.");
        HttpURLConnection c=(HttpURLConnection)new URL(BuildConfig.EDGE_URL).openConnection();
        c.setRequestMethod("POST");c.setConnectTimeout(20000);c.setReadTimeout(45000);c.setDoOutput(true);
        c.setRequestProperty("Content-Type",mime);c.setRequestProperty("apikey",BuildConfig.SUPABASE_PUBLISHABLE_KEY);
        c.setRequestProperty("x-device-token",token);c.setRequestProperty("x-mobile-action","upload");
        c.setRequestProperty("x-media-kind",kind);c.setRequestProperty("x-file-name",URLEncoder.encode(name,"UTF-8"));
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
