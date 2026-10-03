package com.nuestragalaxia.companion;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.*;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import org.json.*;
import java.util.*;

public final class BondWidget extends AppWidgetProvider {
    public static void updateAll(Context c){
        AppWidgetManager manager=AppWidgetManager.getInstance(c);
        for(int id:manager.getAppWidgetIds(new ComponentName(c,BondWidget.class)))update(c,manager,id);
    }

    public static void update(Context c,AppWidgetManager manager,int id){
        DeviceStore device=new DeviceStore(c);
        BondStore bond=new BondStore(c);
        WidgetPrefs prefs=new WidgetPrefs(c);
        JSONObject data=bond.snapshot();
        RemoteViews views=new RemoteViews(c.getPackageName(),R.layout.widget_bond);
        boolean paired=device.pairedFast();
        Bundle options=manager.getAppWidgetOptions(id);
        int minWidth=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,220);
        int minHeight=options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,180);
        boolean compact=minWidth<240||minHeight<190;

        JSONArray names=data.optJSONArray("names");
        views.setTextViewText(R.id.widgetNames,paired&&names!=null?names.optString(0,"Nosotros")+" & "+names.optString(1,"Dos"):"Nuestra galaxia");

        boolean showPhoto=paired&&!compact&&prefs.enabled(id,"photo")&&bond.photo().exists();
        Bitmap bitmap=showPhoto?BitmapFactory.decodeFile(bond.photo().getAbsolutePath()):null;
        views.setViewVisibility(R.id.widgetPhoto,bitmap==null?View.GONE:View.VISIBLE);
        if(bitmap!=null)views.setImageViewBitmap(R.id.widgetPhoto,bitmap);

        views.removeAllViews(R.id.widgetModules);
        int shown=0,maxModules=compact?2:6;
        for(String module:prefs.order(id)){
            if(shown>=maxModules)break;
            if("photo".equals(module)||"hug".equals(module)||!prefs.enabled(id,module))continue;
            String value=moduleValue(module,data);
            if(value.isEmpty())continue;
            RemoteViews row=new RemoteViews(c.getPackageName(),R.layout.widget_module_text);
            row.setTextViewText(R.id.widgetModuleLabel,moduleLabel(module));
            row.setTextViewText(R.id.widgetModuleValue,value);
            views.addView(R.id.widgetModules,row);shown++;
        }

        views.setTextViewText(R.id.widgetFeedback,bond.feedback());
        views.setViewVisibility(R.id.widgetFeedback,bond.feedback().isEmpty()?View.GONE:View.VISIBLE);

        Intent open=new Intent(c,MainActivity.class);
        views.setOnClickPendingIntent(R.id.widgetRoot,PendingIntent.getActivity(c,id,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));

        boolean hugEnabled=paired&&prefs.enabled(id,"hug");
        Intent hug=new Intent(c,BondActionReceiver.class).setAction(BondActionReceiver.HUG);
        views.setOnClickPendingIntent(R.id.widgetHug,PendingIntent.getBroadcast(c,id,hug,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
        views.setViewVisibility(R.id.widgetHug,hugEnabled?View.VISIBLE:View.GONE);
        views.setBoolean(R.id.widgetHug,"setEnabled",hugEnabled);
        views.setTextViewText(R.id.widgetHug,"Enviar abrazo");
        manager.updateAppWidget(id,views);
    }

    private static String moduleLabel(String module){
        return switch(module){
            case "date" -> "PRÓXIMA FECHA";
            case "mood" -> "MOOD";
            case "distance" -> "DISTANCIA";
            case "eta" -> "ETA";
            case "song" -> "CANCIÓN ACTUAL";
            case "plan" -> "PRÓXIMO PLAN";
            case "garden" -> "NUESTRO JARDÍN";
            default -> module.toUpperCase(Locale.ROOT);
        };
    }

    private static String moduleValue(String module,JSONObject data){
        JSONObject now=data.optJSONObject("now");
        if("date".equals(module)){
            JSONObject event=data.optJSONObject("nextEvent");
            return event==null?"":event.optString("title","Nuestra fecha")+" · "+event.optString("date","");
        }
        if("mood".equals(module)){
            String mood=now==null?"":now.optString("mood","");
            return "feliz".equals(mood)?"Feliz":"tranquilo".equals(mood)?"En calma":"cansado".equals(mood)?"Sin energía":"sensible".equals(mood)?"Sensible":"abrazo".equals(mood)?"Quiere un abrazo":mood;
        }
        if("distance".equals(module)&&data.has("distanceM")&&!data.isNull("distanceM")){
            double meters=data.optDouble("distanceM",-1);if(meters<0)return"";
            return meters<1000?Math.round(meters)+" m":String.format(Locale.US,"%.1f km",meters/1000d);
        }
        if("eta".equals(module)&&data.has("etaMinutes")&&!data.isNull("etaMinutes")){
            int minutes=data.optInt("etaMinutes",0);return minutes>0?minutes+" min":"";
        }
        if("song".equals(module))return now==null?"":now.optString("listening","");
        if("plan".equals(module)){
            JSONObject plan=data.optJSONObject("nextPlan");if(plan==null)return"";
            String date=plan.optString("date","");return plan.optString("title","Próximo plan")+(date.isEmpty()?"":" · "+date);
        }
        if("garden".equals(module)){
            JSONObject garden=data.optJSONObject("garden");if(garden==null)return"";
            int total=garden.optInt("totalDays",garden.optInt("days",0)),streak=garden.optInt("currentStreak",0);
            return total+" días juntos · racha "+streak;
        }
        return "";
    }

    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){
        for(int id:ids)update(c,m,id);
        BondWorker.schedule(c);BondWorker.refresh(c);
    }

    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle options){
        update(c,m,id);
    }

    @Override public void onDeleted(Context c,int[] ids){
        WidgetPrefs prefs=new WidgetPrefs(c);for(int id:ids)prefs.delete(id);
    }

    @Override public void onEnabled(Context c){BondWorker.schedule(c);BondWorker.refresh(c);}
    @Override public void onDisabled(Context c){BondWorker.schedule(c);}
}
