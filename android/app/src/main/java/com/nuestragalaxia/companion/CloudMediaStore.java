package com.nuestragalaxia.companion;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import java.util.HashSet;
import java.util.Set;

public final class CloudMediaStore {
    private static final String PREFS="galaxy-cloud-media";
    private static final String KEY_DRIVE_URI="drive_tree_uri";
    private static final String KEY_DRIVE_NAME="drive_tree_name";
    private static final String KEY_DRIVE_IMPORTED="drive_imported";
    private final SharedPreferences prefs;

    public CloudMediaStore(Context context){
        prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }

    public Uri driveTree(){
        String value=prefs.getString(KEY_DRIVE_URI,"");
        if(value==null||value.isBlank())return null;
        try{return Uri.parse(value);}catch(Exception ignored){return null;}
    }

    public String driveName(){
        String value=prefs.getString(KEY_DRIVE_NAME,"");
        return value==null?"":value;
    }

    public boolean connected(){return driveTree()!=null;}

    public void saveDrive(Uri uri,String name){
        prefs.edit()
            .putString(KEY_DRIVE_URI,uri==null?"":uri.toString())
            .putString(KEY_DRIVE_NAME,name==null?"Carpeta de Google Drive":name)
            .putStringSet(KEY_DRIVE_IMPORTED,new HashSet<>())
            .apply();
    }

    public Set<String> imported(){
        Set<String> values=prefs.getStringSet(KEY_DRIVE_IMPORTED,Set.of());
        return values==null?new HashSet<>():new HashSet<>(values);
    }

    public void markImported(Set<String> values){
        prefs.edit().putStringSet(KEY_DRIVE_IMPORTED,new HashSet<>(values)).apply();
    }

    public void clearDrive(){
        prefs.edit().remove(KEY_DRIVE_URI).remove(KEY_DRIVE_NAME).remove(KEY_DRIVE_IMPORTED).apply();
    }
}
