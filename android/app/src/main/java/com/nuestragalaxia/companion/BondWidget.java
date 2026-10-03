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

        JSONObject event=data.optJSONObject("nextEvent");
        views.setTextViewText(
            R.id.widgetDate,
            !paired?"Vincula este teléfono para compartir momentos":
                event==null?"Un pequeño universo, solo nuestro":
                    event.optString("title")+" · "+event.optString("date")
        );

        JSONObject now=data.optJSONObject("now");
        views.setTextViewText(R.id.widgetNow,nowText(now));
        views.setViewVisibility(R.id.widgetNow,paired&&now!=null?View.VISIBLE:View.GONE);

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
        if(now==null)return "";
        java.util.ArrayList<String> bits=new java.util.ArrayList<>();
        String mood=now.optString("mood","");
        if(!mood.isEmpty())bits.add("feliz".equals(mood)?"Feliz":"tranquilo".equals(mood)?"En calma":"cansado".equals(mood)?"Sin energía":"sensible".equals(mood)?"Sensible":"abrazo".equals(mood)?"Quiere un abrazo":mood);
        if(now.optBoolean("sharing",false)){
            String motion=now.optString("motion","");
            bits.add("walking".equals(motion)?"Caminando":"vehicle".equals(motion)?"En movimiento":"still".equals(motion)?"En un lugar":"Ubicación activa");
            String status=now.optString("status","");if(!status.isEmpty())bits.add(status);
        }
        String listening=now.optString("listening","");if(!listening.isEmpty())bits.add("Escuchando "+listening);
        if(now.has("battery")&&!now.isNull("battery"))bits.add("Batería "+Math.round(now.optDouble("battery",0))+"%");
        return bits.isEmpty()?"Sin novedades compartidas ahora":String.join(" · ",bits);
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
