package com.nuestragalaxia.companion;

import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.util.Size;
import org.json.JSONObject;
import org.json.JSONArray;
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

    public static JSONObject giphySearch(String token,String query,boolean stickers) throws Exception {
        String q=query==null?"":query.trim();
        if(q.length()>50)q=q.substring(0,50);
        return post(token,new JSONObject()
            .put("action","giphy-search")
            .put("query",q)
            .put("stickers",stickers));
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

    private static final class UploadSource {
        final Context context;
        final Uri uri;
        final File file;
        final String mime;
        final String name;
        final long length;
        final boolean temporary;

        private UploadSource(Context context,Uri uri,File file,String mime,String name,long length,boolean temporary){
            this.context=context;this.uri=uri;this.file=file;this.mime=mime;this.name=name;this.length=length;this.temporary=temporary;
        }
        static UploadSource uri(Context context,Uri uri,String mime,String name,long length){
            return new UploadSource(context,uri,null,mime,name,length,false);
        }
        static UploadSource file(File file,String mime,String name,boolean temporary){
            return new UploadSource(null,null,file,mime,name,file.length(),temporary);
        }
        InputStream open() throws IOException {
            if(file!=null)return new FileInputStream(file);
            try{
                InputStream in=context.getContentResolver().openInputStream(uri);
                if(in==null)throw new IOException("No se pudo leer el archivo.");
                return in;
            }catch(SecurityException e){
                throw new IOException("Android perdió el permiso para leer este archivo. Selecciónalo de nuevo.",e);
            }
        }
        void cleanup(){if(temporary&&file!=null)try{file.delete();}catch(Exception ignored){}}
    }

    public static JSONObject upload(Context context,String token,Uri uri,String kind) throws Exception {
        long limit=uploadLimit(kind);
        if(limit<0)throw new IOException("Tipo de archivo no válido.");
        UploadSource source;
        try{source=prepareUpload(context,uri,kind,limit);}
        catch(SecurityException e){throw new IOException("Android perdió el permiso para leer este archivo. Selecciónalo de nuevo.",e);}
        try{return uploadWithRetry(token,kind,source,limit);}
        finally{source.cleanup();}
    }

    private static UploadSource prepareUpload(Context context,Uri uri,String kind,long limit) throws Exception {
        String declared=context.getContentResolver().getType(uri);
        String name=fileName(context,uri);
        if(name==null||name.isBlank())name="archivo";
        long length=fileSize(context,uri);
        if(length==0)throw new IOException("El archivo está vacío.");
        if(length>limit)throw new IOException("El archivo supera el límite permitido.");

        byte[] prefix;
        try(InputStream in=context.getContentResolver().openInputStream(uri)){
            if(in==null)throw new IOException("No se pudo leer el archivo.");
            prefix=MediaSniffer.readPrefix(in,2*1024*1024);
        }
        if(prefix.length==0)throw new IOException("El archivo está vacío.");
        String actual=MediaSniffer.sniff(prefix,declared);
        if(declared==null||declared.isBlank()||"application/octet-stream".equalsIgnoreCase(declared)){
            declared=actual==null||actual.isBlank()?"application/octet-stream":actual;
        }

        boolean photoKind="photo".equals(kind)||"chat-photo".equals(kind);
        if(photoKind&&(MediaSniffer.isHeif(actual)||MediaSniffer.isHeif(declared))){
            File jpeg=transcodeHeifToJpeg(context,uri,limit);
            return UploadSource.file(jpeg,"image/jpeg",replaceExtension(name,"jpg"),true);
        }
        return UploadSource.uri(context,uri,declared,name,length);
    }

    private static File transcodeHeifToJpeg(Context context,Uri uri,long limit) throws Exception {
        File dir=new File(context.getCacheDir(),"normalized-media");
        if(!dir.exists()&&!dir.mkdirs())throw new IOException("No se pudo preparar la conversión HEIC/HEIF.");
        File output=File.createTempFile("galaxy-heif-", ".jpg",dir);
        Bitmap bitmap=null;
        try{
            if(Build.VERSION.SDK_INT>=28){
                ImageDecoder.Source source=ImageDecoder.createSource(context.getContentResolver(),uri);
                bitmap=ImageDecoder.decodeBitmap(source,(decoder,info,src)->{
                    Size size=info.getSize();
                    int width=size.getWidth(),height=size.getHeight(),max=4096;
                    if(width>max||height>max){
                        double scale=Math.min((double)max/Math.max(1,width),(double)max/Math.max(1,height));
                        decoder.setTargetSize(Math.max(1,(int)Math.round(width*scale)),Math.max(1,(int)Math.round(height*scale)));
                    }
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                });
            }else{
                BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
                try(InputStream in=context.getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,bounds);}
                int sample=1;
                while(bounds.outWidth/sample>4096||bounds.outHeight/sample>4096)sample*=2;
                BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=Math.max(1,sample);
                try(InputStream in=context.getContentResolver().openInputStream(uri)){bitmap=BitmapFactory.decodeStream(in,null,options);}
            }
            if(bitmap==null)throw new IOException("Android no pudo convertir esta imagen HEIC/HEIF.");
            int quality=92;
            while(true){
                try(OutputStream out=new FileOutputStream(output,false)){
                    if(!bitmap.compress(Bitmap.CompressFormat.JPEG,quality,out))throw new IOException("Android no pudo convertir esta imagen HEIC/HEIF.");
                }
                if(output.length()>0&&output.length()<=limit)break;
                quality-=8;
                if(quality<68)throw new IOException("La foto convertida supera el límite permitido.");
            }
            return output;
        }catch(Exception e){
            try{output.delete();}catch(Exception ignored){}
            throw e;
        }finally{
            if(bitmap!=null&&!bitmap.isRecycled())bitmap.recycle();
        }
    }

    private static String replaceExtension(String name,String extension){
        String value=name==null||name.isBlank()?"foto":name;
        int slash=Math.max(value.lastIndexOf('/'),value.lastIndexOf('\\'));
        int dot=value.lastIndexOf('.');
        if(dot<=slash)value=value+"."+extension;
        else value=value.substring(0,dot+1)+extension;
        return value;
    }

    private static JSONObject uploadWithRetry(String token,String kind,UploadSource source,long limit) throws Exception {
        String uploadId=java.util.UUID.randomUUID().toString();
        Exception last=null;
        for(int attempt=0;attempt<2;attempt++){
            try{return uploadOnce(token,kind,source,limit,uploadId);}
            catch(ApiClient.ApiException e){
                last=e;
                if(e.status<500&&e.status!=408&&e.status!=425&&e.status!=429)throw e;
            }catch(IOException e){last=e;}
            if(attempt==0){
                try{Thread.sleep(300L);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw last;}
            }
        }
        throw last==null?new IOException("No pudimos completar la subida."):last;
    }

    private static JSONObject uploadOnce(String token,String kind,UploadSource source,long limit,String uploadId) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(BuildConfig.EDGE_URL).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(20000);
        c.setReadTimeout(45000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type",source.mime);
        c.setRequestProperty("apikey",BuildConfig.SUPABASE_PUBLISHABLE_KEY);
        c.setRequestProperty("x-device-token",token);
        c.setRequestProperty("x-mobile-action","upload");
        c.setRequestProperty("x-media-kind",kind);
        c.setRequestProperty("x-file-name",URLEncoder.encode(source.name,"UTF-8"));
        c.setRequestProperty("x-upload-id",uploadId);
        if(source.length>=0&&source.length<=Integer.MAX_VALUE)c.setFixedLengthStreamingMode((int)source.length);
        else c.setChunkedStreamingMode(8192);

        try{
            long sent=0;
            try(InputStream in=source.open();OutputStream out=c.getOutputStream()){
                byte[] buffer=new byte[8192];int read;
                while((read=in.read(buffer))!=-1){
                    sent+=read;
                    if(sent>limit)throw new IOException("El archivo supera el límite permitido.");
                    out.write(buffer,0,read);
                }
            }
            if(sent<1)throw new IOException("El archivo está vacío.");
            if(source.length>=0&&sent!=source.length)throw new IOException("El archivo cambió mientras se enviaba. Intenta de nuevo.");
            return response(c);
        }finally{c.disconnect();}
    }

    public static JSONObject uploadVoiceFile(Context context,String token,File file) throws Exception {
        return uploadVoiceFile(context,token,file,"voice");
    }

    public static JSONObject uploadVoiceFile(Context context,String token,File file,String kind) throws Exception {
        if(!"voice".equals(kind)&&!"chat-audio".equals(kind))throw new IOException("Tipo de audio no válido.");
        long limit=uploadLimit(kind);
        if(file.length()<1)throw new IOException("El audio está vacío.");
        if(limit<0||file.length()>limit)throw new IOException("El audio supera el límite permitido.");
        UploadSource source=UploadSource.file(file,"audio/mp4",file.getName(),false);
        return uploadWithRetry(token,kind,source,limit);
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
