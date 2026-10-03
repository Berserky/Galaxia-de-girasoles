package com.nuestragalaxia.companion;
import android.content.*;
import java.io.*;
import java.util.*;
import org.json.*;
public final class BondStore {
 private final Context context;private final SharedPreferences prefs;
 public BondStore(Context c){context=c.getApplicationContext();prefs=context.getSharedPreferences("galaxy_moments",Context.MODE_PRIVATE);}
 public boolean enabled(){return prefs.getBoolean("enabled",false);}
 public void enabled(boolean enabled){prefs.edit().putBoolean("enabled",enabled).putBoolean("initialized",false).remove("seen").remove("latestCreated").commit();if(!enabled){android.app.NotificationManager manager=context.getSystemService(android.app.NotificationManager.class);for(android.service.notification.StatusBarNotification n:manager.getActiveNotifications())if(n.getNotification().getChannelId()!=null&&n.getNotification().getChannelId().startsWith("galaxy-moments"))manager.cancel(n.getTag(),n.getId());}}
 public JSONObject snapshot(){try{return new JSONObject(prefs.getString("snapshot","{}"));}catch(Exception e){return new JSONObject();}}
 public void snapshot(JSONObject data){JSONObject safe=new JSONObject();try{safe.put("names",data.optJSONArray("names"));safe.put("nextEvent",data.optJSONObject("nextEvent"));safe.put("now",data.optJSONObject("now"));}catch(Exception ignored){}prefs.edit().putString("snapshot",safe.toString()).commit();}
 public File photo(){return new File(context.getFilesDir(),"widget-photo.jpg");}
 public String feedback(){return prefs.getString("feedback","");}
 public void feedback(String text){prefs.edit().putString("feedback",text).commit();}
 public boolean consumeDate(String key){if(key.equals(prefs.getString("dateSeen","")))return false;return prefs.edit().putString("dateSeen",key).commit();}
 public List<String> consume(JSONArray gestures){
  List<String> ids=new ArrayList<>();for(int i=0;i<gestures.length();i++){JSONObject g=gestures.optJSONObject(i);if(g!=null)ids.add(g.optString("id"));}
  Set<String> seen=prefs.getStringSet("seen",Collections.emptySet());List<String> fresh=GestureLedger.fresh(prefs.getBoolean("initialized",false),seen,ids);
  String cutoff=prefs.getString("latestCreated","");String latest=cutoff;
  for(int i=0;i<gestures.length();i++){JSONObject g=gestures.optJSONObject(i);if(g==null)continue;String created=g.optString("created","");if(GestureLedger.before(created,cutoff))fresh.remove(g.optString("id"));if(!created.isEmpty()&&(latest.isEmpty()||GestureLedger.before(latest,created)))latest=created;}
  // Server window is bounded at 30 rows/7 days; retain the full currently visible window.
  Set<String> retained=new HashSet<>(ids);if(latest.equals(cutoff))retained.addAll(seen);
  if(!prefs.edit().putStringSet("seen",retained).putString("latestCreated",latest).putBoolean("initialized",true).commit())return Collections.emptyList();
  return fresh;
 }
 public void clear(){prefs.edit().clear().commit();photo().delete();new File(context.getFilesDir(),"widget-photo.tmp").delete();}
}
