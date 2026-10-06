package com.nuestragalaxia.companion;

import android.content.Context;
import android.database.Cursor;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.provider.OpenableColumns;
import org.json.JSONObject;
import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

public final class MediaInspector {
    private static final Set<String> CHAT_IMAGES=Set.of("image/jpeg","image/png","image/webp","image/heic","image/heif");
    private static final Set<String> CHAT_VIDEOS=Set.of("video/mp4","video/webm");

    private MediaInspector(){}

    public static JSONObject inspect(Context context,Uri uri) throws IOException {
        if(context==null||uri==null)throw new IOException("Archivo multimedia no válido.");
        String declared=context.getContentResolver().getType(uri);
        byte[] prefix;
        try(InputStream in=context.getContentResolver().openInputStream(uri)){
            if(in==null)throw new IOException("No se pudo leer el archivo.");
            prefix=MediaSniffer.readPrefix(in,2*1024*1024);
        }
        if(prefix.length==0)throw new IOException("El archivo está vacío.");
        String sniffed=MediaSniffer.sniff(prefix,declared);
        String mime=(sniffed==null||sniffed.isBlank()||"application/octet-stream".equals(sniffed))
            ?canonical(declared):canonical(sniffed);
        long size=querySize(context,uri);
        JSONObject out=new JSONObject();
        try{
            out.put("mime",mime);
            out.put("declaredMime",canonical(declared));
            out.put("size",Math.max(0,size));
            if(CHAT_IMAGES.contains(mime))inspectImage(context,uri,out);
            else if(CHAT_VIDEOS.contains(mime))inspectVideo(context,uri,out);
        }catch(Exception e){
            if(e instanceof IOException io)throw io;
        }
        return out;
    }

    public static String chatKind(Context context,Uri uri) throws IOException {
        String mime=inspect(context,uri).optString("mime","");
        if(CHAT_IMAGES.contains(mime))return "chat-photo";
        if(CHAT_VIDEOS.contains(mime))return "chat-video";
        throw new IOException("Formato multimedia no soportado.");
    }

    public static boolean isChatImage(String mime){return CHAT_IMAGES.contains(canonical(mime));}
    public static boolean isChatVideo(String mime){return CHAT_VIDEOS.contains(canonical(mime));}

    private static void inspectImage(Context context,Uri uri,JSONObject out){
        BitmapFactory.Options options=new BitmapFactory.Options();
        options.inJustDecodeBounds=true;
        try(InputStream in=context.getContentResolver().openInputStream(uri)){
            BitmapFactory.decodeStream(in,null,options);
            if(options.outWidth>0)out.put("width",options.outWidth);
            if(options.outHeight>0)out.put("height",options.outHeight);
        }catch(Exception ignored){}
    }

    private static void inspectVideo(Context context,Uri uri,JSONObject out){
        MediaMetadataRetriever retriever=new MediaMetadataRetriever();
        try{
            retriever.setDataSource(context,uri);
            putLong(out,"durationMs",retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
            putLong(out,"width",retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
            putLong(out,"height",retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
            putLong(out,"rotation",retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION));
        }catch(Exception ignored){}finally{try{retriever.release();}catch(Exception ignored){}}
    }

    private static void putLong(JSONObject out,String key,String raw){
        if(raw==null||raw.isBlank())return;
        try{out.put(key,Long.parseLong(raw));}catch(Exception ignored){}
    }

    private static long querySize(Context context,Uri uri){
        try(Cursor cursor=context.getContentResolver().query(uri,new String[]{OpenableColumns.SIZE},null,null,null)){
            if(cursor!=null&&cursor.moveToFirst()){
                int ix=cursor.getColumnIndex(OpenableColumns.SIZE);
                if(ix>=0&&!cursor.isNull(ix))return cursor.getLong(ix);
            }
        }catch(Exception ignored){}
        return -1;
    }

    private static String canonical(String value){
        String mime=value==null?"":value.split(";",2)[0].trim().toLowerCase();
        if("image/jpg".equals(mime))return "image/jpeg";
        return mime.isBlank()?"application/octet-stream":mime;
    }
}
