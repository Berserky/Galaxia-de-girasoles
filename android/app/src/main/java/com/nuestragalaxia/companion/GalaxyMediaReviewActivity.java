package com.nuestragalaxia.companion;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.TextView;
import android.widget.VideoView;
import androidx.activity.OnBackPressedCallback;
import androidx.fragment.app.FragmentActivity;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.concurrent.*;

public final class GalaxyMediaReviewActivity extends FragmentActivity {
    public static final String EXTRA_URIS="uris";
    public static final String EXTRA_CAPTION="caption";

    private FrameLayout root;
    private final ArrayList<Uri> items=new ArrayList<>();
    private int index=0;
    private EditText caption;
    private TextView counter;
    private final ExecutorService mediaIo=Executors.newSingleThreadExecutor();
    private VideoView activeVideo;
    private Bitmap activeBitmap;
    private int renderGeneration=0;

    @Override protected void onCreate(Bundle savedInstanceState){
        super.onCreate(savedInstanceState);
        ArrayList<Uri> incoming;
        if(Build.VERSION.SDK_INT>=33)incoming=getIntent().getParcelableArrayListExtra(EXTRA_URIS,Uri.class);
        else incoming=getIntent().getParcelableArrayListExtra(EXTRA_URIS);
        if(incoming!=null)items.addAll(incoming);
        if(savedInstanceState!=null){
            ArrayList<String> kept=savedInstanceState.getStringArrayList("review.uris");
            if(kept!=null&&!kept.isEmpty()){items.clear();for(String value:kept)items.add(Uri.parse(value));}
            index=savedInstanceState.getInt("review.index",0);
            getIntent().putExtra(EXTRA_CAPTION,savedInstanceState.getString("review.caption",getIntent().getStringExtra(EXTRA_CAPTION)));
        }
        if(items.isEmpty()){setResult(Activity.RESULT_CANCELED);finish();return;}
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
            @Override public void handleOnBackPressed(){cancel();}
        });
        build();
    }

    private void build(){
        root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);
        setContentView(root);
        renderCurrent();
    }

    private void renderCurrent(){
        if(items.isEmpty()){cancel();return;}
        index=Math.max(0,Math.min(index,items.size()-1));
        releasePreview();
        root.removeAllViews();
        Uri uri=items.get(index);int expectedIndex=index,generation=renderGeneration;
        TextView loading=new TextView(this);loading.setText("Preparando vista previa…");loading.setTextColor(Color.WHITE);loading.setTextSize(15);loading.setGravity(Gravity.CENTER);
        root.addView(loading,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        mediaIo.execute(()->{
            try{
                JSONObject meta=MediaInspector.inspect(this,uri);
                String mime=meta.optString("mime","");
                Bitmap bitmap=MediaInspector.isChatVideo(mime)?null:decodeScaled(uri,2048);
                runOnUiThread(()->{
                    if(isFinishing()||generation!=renderGeneration||index!=expectedIndex||items.isEmpty()||!uri.equals(items.get(index))){
                        if(bitmap!=null&&!bitmap.isRecycled())bitmap.recycle();return;
                    }
                    if(!MediaInspector.isChatVideo(mime)&&bitmap==null){removeCurrent();return;}
                    renderResolved(uri,mime,bitmap);
                });
            }catch(Exception e){runOnUiThread(()->{if(!isFinishing()&&generation==renderGeneration&&index==expectedIndex)removeCurrent();});}
        });
    }

    private void renderResolved(Uri uri,String mime,Bitmap bitmap){
        root.removeAllViews();
        if(MediaInspector.isChatVideo(mime)){
            VideoView video=new VideoView(this);activeVideo=video;video.setVideoURI(uri);video.setContentDescription("Vista previa del video seleccionado");
            MediaController controller=new MediaController(this);video.setMediaController(controller);
            video.setOnPreparedListener(mp->{if(activeVideo==video&&!isFinishing()){mp.setLooping(true);video.start();}});
            root.addView(video,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        }else{
            ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription("Vista previa de la imagen seleccionada");
            activeBitmap=bitmap;image.setImageBitmap(bitmap);
            root.addView(image,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        }

        LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.HORIZONTAL);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(12),dp(12),dp(12),dp(8));
        TextView close=control("✕","Cancelar selección");close.setOnClickListener(v->cancel());top.addView(close,new LinearLayout.LayoutParams(dp(52),dp(52)));
        counter=new TextView(this);counter.setTextColor(Color.WHITE);counter.setTextSize(14);counter.setGravity(Gravity.CENTER);counter.setText((index+1)+" / "+items.size());top.addView(counter,new LinearLayout.LayoutParams(0,dp(52),1));
        TextView remove=control("⌫","Quitar elemento");remove.setOnClickListener(v->removeCurrent());top.addView(remove,new LinearLayout.LayoutParams(dp(52),dp(52)));
        root.addView(top,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(76),Gravity.TOP));

        LinearLayout bottom=new LinearLayout(this);bottom.setOrientation(LinearLayout.VERTICAL);bottom.setPadding(dp(16),dp(8),dp(16),dp(18));bottom.setBackgroundColor(0xAA000000);
        caption=new EditText(this);caption.setHint("Añadir comentario…");caption.setHintTextColor(0xFFB8B5C6);caption.setTextColor(Color.WHITE);caption.setTextSize(16);caption.setMaxLines(3);caption.setSingleLine(false);caption.setContentDescription("Comentario opcional");
        caption.setText(getIntent().getStringExtra(EXTRA_CAPTION));
        bottom.addView(caption,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(58)));

        LinearLayout actions=new LinearLayout(this);actions.setGravity(Gravity.CENTER_VERTICAL);
        TextView previous=control("‹","Anterior");previous.setTextSize(30);previous.setEnabled(index>0);previous.setAlpha(index>0?1f:.35f);previous.setOnClickListener(v->{if(index>0){saveCaption();index--;renderCurrent();}});
        actions.addView(previous,new LinearLayout.LayoutParams(dp(58),dp(54)));
        TextView next=control("›","Siguiente");next.setTextSize(30);next.setEnabled(index<items.size()-1);next.setAlpha(index<items.size()-1?1f:.35f);next.setOnClickListener(v->{if(index<items.size()-1){saveCaption();index++;renderCurrent();}});
        actions.addView(next,new LinearLayout.LayoutParams(dp(58),dp(54)));
        TextView use=control("Usar "+items.size(),"Confirmar selección");use.setTextSize(14);use.setOnClickListener(v->confirm());
        LinearLayout.LayoutParams useParams=new LinearLayout.LayoutParams(0,dp(54),1);useParams.setMargins(dp(10),0,0,0);actions.addView(use,useParams);
        bottom.addView(actions,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(62)));
        FrameLayout.LayoutParams bottomParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(148),Gravity.BOTTOM);root.addView(bottom,bottomParams);
    }

    private void saveCaption(){
        if(caption!=null)getIntent().putExtra(EXTRA_CAPTION,caption.getText().toString());
    }

    private void removeCurrent(){
        saveCaption();
        if(!items.isEmpty())items.remove(index);
        if(items.isEmpty()){cancel();return;}
        if(index>=items.size())index=items.size()-1;
        renderCurrent();
    }

    private void confirm(){
        saveCaption();
        Intent result=new Intent().putParcelableArrayListExtra(EXTRA_URIS,new ArrayList<>(items)).putExtra(EXTRA_CAPTION,getIntent().getStringExtra(EXTRA_CAPTION));
        result.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        ClipData clip=null;
        for(Uri uri:items){
            if(clip==null)clip=ClipData.newUri(getContentResolver(),"galaxy-media",uri);
            else clip.addItem(new ClipData.Item(uri));
        }
        if(clip!=null)result.setClipData(clip);
        setResult(Activity.RESULT_OK,result);finish();
    }

    @Override protected void onSaveInstanceState(Bundle outState){
        saveCaption();
        super.onSaveInstanceState(outState);
        ArrayList<String> values=new ArrayList<>();for(Uri uri:items)values.add(uri.toString());
        outState.putStringArrayList("review.uris",values);
        outState.putInt("review.index",index);
        outState.putString("review.caption",getIntent().getStringExtra(EXTRA_CAPTION));
    }

    private void cancel(){releasePreview();setResult(Activity.RESULT_CANCELED);finish();}

    private void releasePreview(){
        renderGeneration++;
        VideoView video=activeVideo;activeVideo=null;
        if(video!=null)try{video.stopPlayback();}catch(Exception ignored){}
        Bitmap bitmap=activeBitmap;activeBitmap=null;
        if(bitmap!=null&&!bitmap.isRecycled())bitmap.recycle();
    }

    private Bitmap decodeScaled(Uri uri,int max){
        try{
            if(Build.VERSION.SDK_INT>=28){
                ImageDecoder.Source source=ImageDecoder.createSource(getContentResolver(),uri);
                return ImageDecoder.decodeBitmap(source,(decoder,info,src)->{
                    int w=info.getSize().getWidth(),h=info.getSize().getHeight();
                    if(w>max||h>max){
                        double scale=Math.min((double)max/Math.max(1,w),(double)max/Math.max(1,h));
                        decoder.setTargetSize(Math.max(1,(int)Math.round(w*scale)),Math.max(1,(int)Math.round(h*scale)));
                    }
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                });
            }
            BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
            try(InputStream in=getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,bounds);}
            int sample=1;while(bounds.outWidth/sample>max||bounds.outHeight/sample>max)sample*=2;
            BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=Math.max(1,sample);
            try(InputStream in=getContentResolver().openInputStream(uri)){return BitmapFactory.decodeStream(in,null,options);}
        }catch(Exception e){return null;}
    }

    @Override protected void onPause(){
        if(activeVideo!=null)try{activeVideo.pause();}catch(Exception ignored){}
        super.onPause();
    }

    @Override protected void onDestroy(){
        releasePreview();mediaIo.shutdownNow();super.onDestroy();
    }

    private TextView control(String text,String description){
        TextView view=new TextView(this);view.setText(text);view.setTextColor(Color.WHITE);view.setTextSize(20);view.setGravity(Gravity.CENTER);view.setContentDescription(description);
        view.setBackgroundColor(0x55000000);view.setPadding(dp(4),dp(4),dp(4),dp(4));view.setClickable(true);view.setFocusable(true);return view;
    }

    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
