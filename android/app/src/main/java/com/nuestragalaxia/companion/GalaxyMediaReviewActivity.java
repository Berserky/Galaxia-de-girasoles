package com.nuestragalaxia.companion;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ImageDecoder;
import android.graphics.drawable.GradientDrawable;
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
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.fragment.app.FragmentActivity;
import org.json.JSONObject;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.concurrent.*;

public final class GalaxyMediaReviewActivity extends FragmentActivity {
    public static final String EXTRA_URIS="uris";
    public static final String EXTRA_CAPTION="caption";
    private static final int CHROME=0xA612121A;
    private static final int CONTROL=0x18FFFFFF;

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
        getWindow().setStatusBarColor(Color.BLACK);getWindow().setNavigationBarColor(Color.BLACK);
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){cancel();}});
        build();
    }

    private void build(){root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);setContentView(root);renderCurrent();}

    private void renderCurrent(){
        if(items.isEmpty()){cancel();return;}
        index=Math.max(0,Math.min(index,items.size()-1));releasePreview();root.removeAllViews();
        Uri uri=items.get(index);int expectedIndex=index,generation=renderGeneration;
        TextView loading=label("Preparando vista previa…",15,false);
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
            }catch(Exception e){
                runOnUiThread(()->{if(!isFinishing()&&generation==renderGeneration&&index==expectedIndex)removeCurrent();});
            }
        });
    }

    private void renderResolved(Uri uri,String mime,Bitmap bitmap){
        root.removeAllViews();
        if(MediaInspector.isChatVideo(mime)){
            VideoView view=new VideoView(this);activeVideo=view;view.setVideoURI(uri);view.setMediaController(new MediaController(this));view.setContentDescription("Vista previa del video seleccionado");
            view.setOnPreparedListener(mp->{if(activeVideo==view&&!isFinishing()){mp.setLooping(true);view.start();}});
            root.addView(view,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        }else{
            ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setContentDescription("Vista previa de la imagen seleccionada");
            activeBitmap=bitmap;image.setImageBitmap(bitmap);
            root.addView(image,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));
        }

        LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.HORIZONTAL);top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(6),dp(4),dp(6),dp(4));top.setBackground(roundRect(CHROME,24,0,0));top.setElevation(dp(8));
        TextView close=iconControl("×","Cancelar selección");close.setTextSize(30);close.setOnClickListener(v->cancel());top.addView(close,new LinearLayout.LayoutParams(dp(56),dp(56)));
        counter=label((index+1)+" / "+items.size(),14,true);top.addView(counter,new LinearLayout.LayoutParams(0,dp(56),1));
        TextView remove=iconControl("⌫","Quitar elemento");remove.setOnClickListener(v->removeCurrent());top.addView(remove,new LinearLayout.LayoutParams(dp(56),dp(56)));
        FrameLayout.LayoutParams topParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(64),Gravity.TOP);topParams.leftMargin=dp(14);topParams.rightMargin=dp(14);root.addView(top,topParams);

        LinearLayout bottom=new LinearLayout(this);bottom.setOrientation(LinearLayout.VERTICAL);bottom.setPadding(dp(12),dp(10),dp(12),dp(10));
        bottom.setBackground(roundRect(CHROME,26,0,0));bottom.setElevation(dp(8));
        caption=new EditText(this);caption.setHint("Añadir comentario…");caption.setHintTextColor(0xFFB8B5C6);caption.setTextColor(Color.WHITE);caption.setTextSize(15);
        caption.setMaxLines(3);caption.setSingleLine(false);caption.setContentDescription("Comentario opcional");caption.setText(getIntent().getStringExtra(EXTRA_CAPTION));
        caption.setPadding(dp(14),0,dp(14),0);caption.setBackground(roundRect(0x661F1F2A,18,1,0x22FFFFFF));
        bottom.addView(caption,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(52)));

        LinearLayout actions=new LinearLayout(this);actions.setGravity(Gravity.CENTER_VERTICAL);
        TextView previous=iconControl("‹","Anterior");previous.setTextSize(30);previous.setEnabled(index>0);previous.setAlpha(index>0?1f:.35f);previous.setOnClickListener(v->{if(index>0){saveCaption();index--;renderCurrent();}});
        actions.addView(previous,new LinearLayout.LayoutParams(dp(52),dp(52)));
        TextView next=iconControl("›","Siguiente");next.setTextSize(30);next.setEnabled(index<items.size()-1);next.setAlpha(index<items.size()-1?1f:.35f);next.setOnClickListener(v->{if(index<items.size()-1){saveCaption();index++;renderCurrent();}});
        actions.addView(next,new LinearLayout.LayoutParams(dp(52),dp(52)));
        TextView use=actionButton("Usar "+items.size(),"Confirmar selección",true);use.setOnClickListener(v->confirm());
        LinearLayout.LayoutParams useParams=new LinearLayout.LayoutParams(0,dp(52),1);useParams.setMargins(dp(10),0,0,0);actions.addView(use,useParams);
        LinearLayout.LayoutParams actionParams=new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60));actionParams.topMargin=dp(8);bottom.addView(actions,actionParams);
        FrameLayout.LayoutParams bottomParams=new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(140),Gravity.BOTTOM);bottomParams.leftMargin=dp(14);bottomParams.rightMargin=dp(14);root.addView(bottom,bottomParams);
        applySafeInsets(top,topParams,bottom,bottomParams);
    }

    private void applySafeInsets(View top,FrameLayout.LayoutParams topParams,View bottom,FrameLayout.LayoutParams bottomParams){
        ViewCompat.setOnApplyWindowInsetsListener(root,(view,insets)->{
            Insets status=insets.getInsets(WindowInsetsCompat.Type.statusBars()),navigation=insets.getInsets(WindowInsetsCompat.Type.navigationBars());
            topParams.topMargin=status.top+dp(10);top.setLayoutParams(topParams);
            bottomParams.bottomMargin=Math.max(navigation.bottom,dp(4))+dp(8);bottom.setLayoutParams(bottomParams);
            return insets;
        });ViewCompat.requestApplyInsets(root);
    }

    private TextView label(String text,int size,boolean strong){
        TextView view=new TextView(this);view.setText(text);view.setTextColor(Color.WHITE);view.setTextSize(size);view.setGravity(Gravity.CENTER);
        if(strong)view.setTypeface(view.getTypeface(),android.graphics.Typeface.BOLD);return view;
    }
    private TextView iconControl(String text,String description){
        TextView view=label(text,22,false);view.setContentDescription(description);view.setClickable(true);view.setFocusable(true);view.setMinWidth(dp(48));view.setMinHeight(dp(48));return view;
    }
    private TextView actionButton(String text,String description,boolean primary){
        TextView view=label(text,14,true);view.setContentDescription(description);view.setClickable(true);view.setFocusable(true);view.setMinHeight(dp(48));
        view.setBackground(roundRect(primary?0xFFF0ECFF:CONTROL,18,primary?0:1,0x30FFFFFF));if(primary)view.setTextColor(0xFF221742);return view;
    }
    private GradientDrawable roundRect(int color,int radiusDp,int strokeDp,int strokeColor){
        GradientDrawable shape=new GradientDrawable();shape.setShape(GradientDrawable.RECTANGLE);shape.setColor(color);shape.setCornerRadius(dp(radiusDp));if(strokeDp>0)shape.setStroke(dp(strokeDp),strokeColor);return shape;
    }

    private void saveCaption(){if(caption!=null)getIntent().putExtra(EXTRA_CAPTION,caption.getText().toString());}
    private void removeCurrent(){saveCaption();if(!items.isEmpty())items.remove(index);if(items.isEmpty()){cancel();return;}if(index>=items.size())index=items.size()-1;renderCurrent();}
    private void confirm(){
        saveCaption();Intent result=new Intent().putParcelableArrayListExtra(EXTRA_URIS,new ArrayList<>(items)).putExtra(EXTRA_CAPTION,getIntent().getStringExtra(EXTRA_CAPTION));
        result.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);ClipData clip=null;
        for(Uri uri:items){if(clip==null)clip=ClipData.newUri(getContentResolver(),"galaxy-media",uri);else clip.addItem(new ClipData.Item(uri));}
        if(clip!=null)result.setClipData(clip);setResult(Activity.RESULT_OK,result);finish();
    }

    @Override protected void onSaveInstanceState(Bundle outState){
        saveCaption();super.onSaveInstanceState(outState);ArrayList<String> values=new ArrayList<>();for(Uri uri:items)values.add(uri.toString());
        outState.putStringArrayList("review.uris",values);outState.putInt("review.index",index);outState.putString("review.caption",getIntent().getStringExtra(EXTRA_CAPTION));
    }

    private void cancel(){releasePreview();setResult(Activity.RESULT_CANCELED);finish();}
    private void releasePreview(){renderGeneration++;VideoView video=activeVideo;activeVideo=null;if(video!=null)try{video.stopPlayback();}catch(Exception ignored){}Bitmap bitmap=activeBitmap;activeBitmap=null;if(bitmap!=null&&!bitmap.isRecycled())bitmap.recycle();}

    private Bitmap decodeScaled(Uri uri,int max){
        try{
            if(Build.VERSION.SDK_INT>=28){
                ImageDecoder.Source source=ImageDecoder.createSource(getContentResolver(),uri);
                return ImageDecoder.decodeBitmap(source,(decoder,info,src)->{
                    int w=info.getSize().getWidth(),h=info.getSize().getHeight();
                    if(w>max||h>max){double scale=Math.min((double)max/Math.max(1,w),(double)max/Math.max(1,h));decoder.setTargetSize(Math.max(1,(int)Math.round(w*scale)),Math.max(1,(int)Math.round(h*scale)));}
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                });
            }
            BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;try(InputStream in=getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,bounds);}
            int sample=1;while(bounds.outWidth/sample>max||bounds.outHeight/sample>max)sample*=2;BitmapFactory.Options options=new BitmapFactory.Options();options.inSampleSize=Math.max(1,sample);
            try(InputStream in=getContentResolver().openInputStream(uri)){return BitmapFactory.decodeStream(in,null,options);}
        }catch(Exception e){return null;}
    }

    @Override protected void onPause(){if(activeVideo!=null)try{activeVideo.pause();}catch(Exception ignored){}super.onPause();}
    @Override protected void onDestroy(){releasePreview();mediaIo.shutdownNow();super.onDestroy();}
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
}
