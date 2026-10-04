package com.nuestragalaxia.companion;

import android.webkit.JavascriptInterface;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;

public final class GalaxyBridge {
    private final MainActivity activity;

    GalaxyBridge(MainActivity activity){this.activity=activity;}

    void dispatchMessage(String raw,Uri sourceOrigin,boolean isMainFrame){
        if(!isMainFrame||sourceOrigin==null
            ||!"https".equalsIgnoreCase(sourceOrigin.getScheme())
            ||!"appassets.androidplatform.net".equalsIgnoreCase(sourceOrigin.getHost()))return;
        String requestId=null;
        try{
            JSONObject message=new JSONObject(raw==null?"{}":raw);
            requestId=message.optString("id","");
            String method=message.optString("method","");
            JSONArray args=message.optJSONArray("args");
            if(args==null)args=new JSONArray();
            switch(method){
                case "nativeState" -> activity.resolve(requestId,activity.nativeState());
                case "api" -> api(requestId,args.optString(0,"{}"));
                case "pair" -> pair(requestId,args.optString(0,""));
                case "unpair" -> unpair(requestId);
                case "copyText" -> copyText(requestId,args.optString(0,""),args.optString(1,""));
                case "pickMedia" -> pickMedia(requestId,args.optString(0,""));
                case "pickPhotos" -> pickPhotos(requestId);
                case "pickChatPhotos" -> pickChatPhotos(requestId);
                case "capturePhoto" -> capturePhoto(requestId);
                case "captureChatPhoto" -> captureChatPhoto(requestId);
                case "captureChatVideo" -> captureChatVideo(requestId);
                case "pickDriveFolder" -> pickDriveFolder(requestId);
                case "syncDriveFolder" -> syncDriveFolder(requestId);
                case "disconnectDriveFolder" -> disconnectDriveFolder(requestId);
                case "startVoiceRecording" -> startVoiceRecording(requestId);
                case "stopVoiceRecording" -> stopVoiceRecording(requestId);
                case "pauseVoiceRecording" -> pauseVoiceRecording(requestId);
                case "resumeVoiceRecording" -> resumeVoiceRecording(requestId);
                case "playVoiceRecording" -> playVoiceRecording(requestId);
                case "discardVoiceRecording" -> discardVoiceRecording(requestId);
                case "saveVoiceRecording" -> saveVoiceRecording(requestId);
                case "saveChatVoiceRecording" -> saveChatVoiceRecording(requestId);
                case "exportJson" -> exportJson(requestId,args.optString(0,""),args.optString(1,"{}"));
                case "importJson" -> importJson(requestId);
                case "clearPendingGps" -> clearPendingGps(requestId);
                case "startLocation" -> startLocation(requestId);
                case "stopLocation" -> stopLocation(requestId);
                case "refreshLocation" -> refreshLocation(requestId);
                case "requestGalaxyNotifications" -> requestGalaxyNotifications(requestId);
                case "setMomentNotifications" -> setMomentNotifications(requestId,args.optBoolean(0,false));
                case "testMomentNotification" -> testMomentNotification(requestId);
                case "setBondHaptics" -> setBondHaptics(requestId,args.optBoolean(0,false));
                case "setContextPushPrefs" -> setContextPushPrefs(requestId,args.optBoolean(0,false),args.optBoolean(1,false));
                case "addWidget" -> addWidget(requestId);
                case "setSystemTheme" -> setSystemTheme(requestId,args.optString(0,"daylight"));
                case "openChatFile" -> openChatFile(requestId,args.optString(0,""),args.optString(1,"archivo"),args.optString(2,"application/octet-stream"));
                case "openAppSettings" -> openAppSettings(requestId);
                case "clearChatNotifications" -> clearChatNotifications(requestId);
                case "checkUpdate" -> checkUpdate(requestId);
                case "refreshMoments" -> refreshMoments(requestId);
                case "closeApp" -> closeApp();
                default -> activity.reject(requestId,"Acción nativa no permitida.");
            }
        }catch(Exception e){
            activity.reject(requestId,e.getMessage()==null?"Mensaje nativo no válido.":e.getMessage());
        }
    }

    @JavascriptInterface public String nativeState(){
        return activity.nativeState().toString();
    }

    @JavascriptInterface public void api(String requestId,String payload){
        activity.api(requestId,payload);
    }

    @JavascriptInterface public void pair(String requestId,String code){
        activity.pair(requestId,code);
    }

    @JavascriptInterface public void unpair(String requestId){
        activity.unpair(requestId);
    }

    @JavascriptInterface public void copyText(String requestId,String label,String value){
        activity.copyText(requestId,label,value);
    }

    @JavascriptInterface public void pickMedia(String requestId,String kind){
        activity.pickMedia(requestId,kind);
    }
    @JavascriptInterface public void pickPhotos(String requestId){ activity.pickPhotos(requestId); }
    @JavascriptInterface public void pickChatPhotos(String requestId){ activity.pickChatPhotos(requestId); }
    @JavascriptInterface public void capturePhoto(String requestId){ activity.capturePhoto(requestId); }
    @JavascriptInterface public void captureChatPhoto(String requestId){ activity.captureChatPhoto(requestId); }
    @JavascriptInterface public void captureChatVideo(String requestId){ activity.captureChatVideo(requestId); }
    @JavascriptInterface public void pickDriveFolder(String requestId){ activity.pickDriveFolder(requestId); }
    @JavascriptInterface public void syncDriveFolder(String requestId){ activity.syncDriveFolder(requestId); }
    @JavascriptInterface public void disconnectDriveFolder(String requestId){ activity.disconnectDriveFolder(requestId); }

    @JavascriptInterface public void startVoiceRecording(String requestId){ activity.startVoiceRecording(requestId); }
    @JavascriptInterface public void stopVoiceRecording(String requestId){ activity.stopVoiceRecording(requestId); }
    @JavascriptInterface public void pauseVoiceRecording(String requestId){ activity.pauseVoiceRecording(requestId); }
    @JavascriptInterface public void resumeVoiceRecording(String requestId){ activity.resumeVoiceRecording(requestId); }
    @JavascriptInterface public void playVoiceRecording(String requestId){ activity.playVoiceRecording(requestId); }
    @JavascriptInterface public void discardVoiceRecording(String requestId){ activity.discardVoiceRecording(requestId); }
    @JavascriptInterface public void saveVoiceRecording(String requestId){ activity.saveVoiceRecording(requestId); }
    @JavascriptInterface public void saveChatVoiceRecording(String requestId){ activity.saveChatVoiceRecording(requestId); }

    @JavascriptInterface public void exportJson(String requestId,String fileName,String json){ activity.exportJson(requestId,fileName,json); }
    @JavascriptInterface public void importJson(String requestId){ activity.importJson(requestId); }
    @JavascriptInterface public void clearPendingGps(String requestId){ activity.clearPendingGps(requestId); }

    @JavascriptInterface public void startLocation(String requestId){
        activity.startLocation(requestId);
    }

    @JavascriptInterface public void stopLocation(String requestId){
        activity.stopLocation(requestId);
    }

    @JavascriptInterface public void refreshLocation(String requestId){
        activity.refreshLocation(requestId);
    }

    @JavascriptInterface public void requestGalaxyNotifications(String requestId){
        activity.requestGalaxyNotifications(requestId);
    }

    @JavascriptInterface public void setMomentNotifications(String requestId,boolean enabled){
        activity.setMomentNotifications(requestId,enabled);
    }

    @JavascriptInterface public void testMomentNotification(String requestId){
        activity.testMomentNotification(requestId);
    }

    @JavascriptInterface public void setBondHaptics(String requestId,boolean enabled){
        activity.setBondHaptics(requestId,enabled);
    }

    @JavascriptInterface public void setContextPushPrefs(String requestId,boolean nearby,boolean arrivedSafe){
        activity.setContextPushPrefs(requestId,nearby,arrivedSafe);
    }

    @JavascriptInterface public void addWidget(String requestId){
        activity.addWidget(requestId);
    }

    @JavascriptInterface public void setSystemTheme(String requestId,String theme){
        activity.setSystemTheme(requestId,theme);
    }

    @JavascriptInterface public void openChatFile(String requestId,String url,String name,String mime){ activity.openChatFile(requestId,url,name,mime); }

    @JavascriptInterface public void openAppSettings(String requestId){
        activity.openAppSettings(requestId);
    }

    @JavascriptInterface public void clearChatNotifications(String requestId){
        activity.clearChatNotifications(requestId);
    }

    @JavascriptInterface public void checkUpdate(String requestId){
        activity.checkUpdate(requestId);
    }

    @JavascriptInterface public void refreshMoments(String requestId){
        activity.refreshMoments(requestId);
    }

    @JavascriptInterface public void closeApp(){
        activity.closeApp();
    }
}
