package com.nuestragalaxia.companion;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.util.Size;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

public final class MediaThumbnailer {
    static final int MAX_EDGE=640;
    static final long MAX_BYTES=1536L*1024L;
    private MediaThumbnailer(){}

    public static File create(Context context,Uri uri,String mime) throws Exception {
        if(context==null||uri==null)throw new IOException("Contenido multimedia no válido.");
        Bitmap bitmap=null;
        try{
            if(MediaInspector.isChatImage(mime))bitmap=decodeImage(context,uri);
            else if(MediaInspector.isChatVideo(mime))bitmap=decodeVideo(context,uri);
            else throw new IOException("Este tipo de archivo no necesita miniatura.");
            if(bitmap==null)throw new IOException("No pudimos generar la miniatura.");
            return writeJpeg(context,bitmap);
        }finally{
            if(bitmap!=null&&!bitmap.isRecycled())bitmap.recycle();
        }
    }

    private static Bitmap decodeImage(Context context,Uri uri) throws Exception {
        if(Build.VERSION.SDK_INT>=28){
            ImageDecoder.Source source=ImageDecoder.createSource(context.getContentResolver(),uri);
            return ImageDecoder.decodeBitmap(source,(decoder,info,src)->{
                Size size=info.getSize();
                int[] target=fit(size.getWidth(),size.getHeight());
                decoder.setTargetSize(target[0],target[1]);
                decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                decoder.setMemorySizePolicy(ImageDecoder.MEMORY_POLICY_LOW_RAM);
            });
        }
        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
        try(InputStream in=context.getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,bounds);}
        if(bounds.outWidth<1||bounds.outHeight<1)throw new IOException("Android no pudo leer las dimensiones de la imagen.");
        int sample=1;
        while(bounds.outWidth/sample>MAX_EDGE*2||bounds.outHeight/sample>MAX_EDGE*2)sample*=2;
        BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=Math.max(1,sample);options.inPreferredConfig=Bitmap.Config.RGB_565;
        Bitmap decoded;
        try(InputStream in=context.getContentResolver().openInputStream(uri)){decoded=BitmapFactory.decodeStream(in,null,options);}
        if(decoded==null)throw new IOException("Android no pudo decodificar la imagen.");
        return scale(decoded,MAX_EDGE);
    }

    private static Bitmap decodeVideo(Context context,Uri uri) throws Exception {
        MediaMetadataRetriever retriever=new MediaMetadataRetriever();
        Bitmap frame=null;
        try{
            retriever.setDataSource(context,uri);
            int width=parse(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
            int height=parse(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
            int rotation=parse(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION));
            int[] target=fit(width,height);
            if(Build.VERSION.SDK_INT>=27&&target[0]>0&&target[1]>0){
                frame=retriever.getScaledFrameAtTime(0,MediaMetadataRetriever.OPTION_CLOSEST_SYNC,target[0],target[1]);
            }
            if(frame==null)frame=retriever.getFrameAtTime(0,MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if(frame==null)throw new IOException("Android no pudo extraer una vista previa del video.");
            Bitmap scaled=scale(frame,MAX_EDGE);
            if(scaled!=frame){frame.recycle();frame=scaled;}
            if(rotation==90||rotation==180||rotation==270){
                Matrix matrix=new Matrix();matrix.postRotate(rotation);
                Bitmap rotated=Bitmap.createBitmap(frame,0,0,frame.getWidth(),frame.getHeight(),matrix,true);
                if(rotated!=frame){frame.recycle();frame=rotated;}
            }
            return frame;
        }catch(Exception e){
            if(frame!=null&&!frame.isRecycled())frame.recycle();
            throw e;
        }finally{try{retriever.release();}catch(Exception ignored){}}
    }

    private static Bitmap scale(Bitmap bitmap,int maxEdge){
        int width=bitmap.getWidth(),height=bitmap.getHeight();
        if(width<=maxEdge&&height<=maxEdge)return bitmap;
        int[] target=fit(width,height);
        return Bitmap.createScaledBitmap(bitmap,target[0],target[1],true);
    }

    private static int[] fit(int width,int height){
        if(width<1||height<1)return new int[]{MAX_EDGE,Math.max(1,(int)Math.round(MAX_EDGE*9d/16d))};
        double factor=Math.min(1d,(double)MAX_EDGE/Math.max(width,height));
        return new int[]{Math.max(1,(int)Math.round(width*factor)),Math.max(1,(int)Math.round(height*factor))};
    }

    private static File writeJpeg(Context context,Bitmap bitmap) throws Exception {
        File dir=new File(context.getCacheDir(),"chat-thumbnails");
        if(!dir.exists()&&!dir.mkdirs())throw new IOException("No se pudo preparar la miniatura.");
        File file=File.createTempFile("galaxy-thumb-", ".jpg",dir);
        int quality=82;
        try{
            while(true){
                try(FileOutputStream out=new FileOutputStream(file,false)){
                    if(!bitmap.compress(Bitmap.CompressFormat.JPEG,quality,out))throw new IOException("No se pudo comprimir la miniatura.");
                }
                if(file.length()>0&&file.length()<=MAX_BYTES)return file;
                quality-=8;
                if(quality<50)throw new IOException("La miniatura supera el límite permitido.");
            }
        }catch(Exception e){try{file.delete();}catch(Exception ignored){}throw e;}
    }

    private static int parse(String value){
        try{return value==null?0:Integer.parseInt(value);}catch(Exception ignored){return 0;}
    }
}
