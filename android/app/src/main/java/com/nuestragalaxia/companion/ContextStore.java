package com.nuestragalaxia.companion;

import android.content.Context;
import android.content.SharedPreferences;

public final class ContextStore {
    private final SharedPreferences prefs;
    public ContextStore(Context context){prefs=context.getSharedPreferences("galaxy_context",Context.MODE_PRIVATE);}
    public boolean nearbyEnabled(){return prefs.getBoolean("nearbyEnabled",false);}
    public boolean arrivedSafeEnabled(){return prefs.getBoolean("arrivedSafeEnabled",false);}
    public void pushPrefs(boolean nearby,boolean arrivedSafe){
        prefs.edit().putBoolean("nearbyEnabled",nearby).putBoolean("arrivedSafeEnabled",arrivedSafe).commit();
    }
    public void clear(){prefs.edit().clear().commit();}
}
