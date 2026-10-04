package com.nuestragalaxia.companion;

import android.webkit.JavascriptInterface;
import org.json.JSONObject;

public final class GalaxyBridge {
    private final MainActivity activity;

    GalaxyBridge(MainActivity activity){this.activity=activity;}

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

    @JavascriptInterface public void openAppSettings(String requestId){
        activity.openAppSettings(requestId);
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
