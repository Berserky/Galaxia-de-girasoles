package com.nuestragalaxia.companion;

import android.content.*;
import java.util.*;

public final class WidgetPrefs {
    public static final List<String> MODULES=List.of("photo","date","hug","mood","distance","eta","song","plan","garden");
    private static final Set<String> DEFAULT_ENABLED=Set.of("photo","date","hug","mood","garden");
    private final SharedPreferences prefs;

    public WidgetPrefs(Context context){prefs=context.getSharedPreferences("galaxy_widget_v2",Context.MODE_PRIVATE);}

    public List<String> order(int widgetId){
        String raw=prefs.getString("order_"+widgetId,"");
        List<String> out=new ArrayList<>();
        if(raw!=null&&!raw.isEmpty())for(String item:raw.split(","))if(MODULES.contains(item)&&!out.contains(item))out.add(item);
        for(String item:MODULES)if(!out.contains(item))out.add(item);
        return out;
    }

    public boolean enabled(int widgetId,String module){
        if(!MODULES.contains(module))return false;
        Set<String> saved=prefs.getStringSet("enabled_"+widgetId,null);
        return saved==null?DEFAULT_ENABLED.contains(module):saved.contains(module);
    }

    public void setEnabled(int widgetId,String module,boolean enabled){
        if(!MODULES.contains(module))return;
        Set<String> next=new HashSet<>();
        Set<String> current=prefs.getStringSet("enabled_"+widgetId,null);
        if(current==null)next.addAll(DEFAULT_ENABLED);else next.addAll(current);
        if(enabled)next.add(module);else next.remove(module);
        prefs.edit().putStringSet("enabled_"+widgetId,next).apply();
    }

    public void moveUp(int widgetId,String module){move(widgetId,module,-1);}
    public void moveDown(int widgetId,String module){move(widgetId,module,1);}

    private void move(int widgetId,String module,int delta){
        List<String> order=order(widgetId);int from=order.indexOf(module),to=from+delta;
        if(from<0||to<0||to>=order.size())return;
        Collections.swap(order,from,to);
        prefs.edit().putString("order_"+widgetId,String.join(",",order)).apply();
    }

    public void delete(int widgetId){
        prefs.edit().remove("order_"+widgetId).remove("enabled_"+widgetId).apply();
    }
}
