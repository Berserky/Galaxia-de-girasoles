package com.nuestragalaxia.companion;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.*;
import android.view.View;
import android.widget.RemoteViews;
import org.json.*;

public final class BondWidget extends AppWidgetProvider {
    public static void updateAll(Context c){
        AppWidgetManager manager=AppWidgetManager.getInstance(c);
        for(int id:manager.getAppWidgetIds(new ComponentName(c,BondWidget.class))){
            update(c,manager,id);
        }
    }

    public static void update(Context c,AppWidgetManager manager,int id){
        DeviceStore device=new DeviceStore(c);
        BondStore bond=new BondStore(c);
        JSONObject data=bond.snapshot();
        RemoteViews views=new RemoteViews(c.getPackageName(),R.layout.widget_bond);
        boolean paired=device.pairedFast();

        JSONArray names=data.optJSONArray("names");
        views.setTextViewText(
            R.id.widgetNames,
            paired&&names!=null?names.optString(0,"Nosotros")+" & "+names.optString(1,"Dos"):"Nuestra galaxia"
        );

        JSONObject now=data.optJSONObject("now");
        views.setTextViewText(R.id.widgetNow,paired?nowText(now):"");
        views.setViewVisibility(R.id.widgetNow,paired?View.VISIBLE:View.GONE);

        JSONObject event=data.optJSONObject("nextEvent");
        views.setTextViewText(
            R.id.widgetDate,
            !paired?"Vincula este teléfono para compartir momentos":
                event==null?"Un pequeño universo, solo nuestro":
                    event.optString("title")+" · "+event.optString("date")
        );

        views.setTextViewText(R.id.widgetFeedback,bond.feedback());
        views.setViewVisibility(R.id.widgetFeedback,bond.feedback().isEmpty()?View.GONE:View.VISIBLE);

        Bitmap bitmap=paired&&bond.photo().exists()?BitmapFactory.decodeFile(bond.photo().getAbsolutePath()):null;
        views.setViewVisibility(R.id.widgetPhoto,bitmap==null?View.GONE:View.VISIBLE);
        if(bitmap!=null)views.setImageViewBitmap(R.id.widgetPhoto,bitmap);

        Intent open=new Intent(c,MainActivity.class);
        views.setOnClickPendingIntent(
            R.id.widgetRoot,
            PendingIntent.getActivity(c,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)
        );

        Intent hug=new Intent(c,BondActionReceiver.class).setAction(BondActionReceiver.HUG);
        views.setOnClickPendingIntent(
            R.id.widgetHug,
            PendingIntent.getBroadcast(c,id,hug,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)
        );
        views.setBoolean(R.id.widgetHug,"setEnabled",paired);
        views.setTextViewText(R.id.widgetHug,paired?"Enviar abrazo":"Vincula la app");
        manager.updateAppWidget(id,views);
    }

    private static String nowText(JSONObject now){
        if(now==null)return "Ahora · nada compartido";
        java.util.ArrayList<String> parts=new java.util.ArrayList<>();
        String mood=now.optString("mood","");
        if(!mood.isEmpty()){
            String label="feliz".equals(mood)?"Feliz":"tranquilo".equals(mood)?"En calma":"cansado".equals(mood)?"Sin energía":"sensible".equals(mood)?"Sensible":"abrazo".equals(mood)?"Quiere abrazo":mood;
            parts.add(label);
        }
        String status=now.optString("status","");
        if(!status.isEmpty())parts.add(status);
        else{
            String motion=now.optString("motion","");
            if("walking".equals(motion))parts.add("Caminando");
            else if("vehicle".equals(motion))parts.add("En movimiento");
            else if("still".equals(motion))parts.add("Quieto/a");
        }
        String song=now.optString("songTitle","");
        if(!song.isEmpty())parts.add("Escucha: "+song);
        if(!now.isNull("battery")){
            int battery=now.optInt("battery",-1);
            if(battery>=0)parts.add("Batería "+battery+"%");
        }
        return parts.isEmpty()?"Ahora · nada compartido":"Ahora · "+String.join(" · ",parts);
    }

    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){
        for(int id:ids)update(c,m,id);
        BondWorker.schedule(c);
        BondWorker.refresh(c);
    }

    @Override public void onEnabled(Context c){
        BondWorker.schedule(c);
        BondWorker.refresh(c);
    }

    @Override public void onDisabled(Context c){
        BondWorker.schedule(c);
    }
}
