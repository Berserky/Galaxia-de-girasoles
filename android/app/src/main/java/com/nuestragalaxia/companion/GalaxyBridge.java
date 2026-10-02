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

    @JavascriptInterface public void pickMedia(String requestId,String kind){
        activity.pickMedia(requestId,kind);
    }

    @JavascriptInterface public void startLocation(String requestId){
        activity.startLocation(requestId);
    }

    @JavascriptInterface public void stopLocation(String requestId){
        activity.stopLocation(requestId);
    }

    @JavascriptInterface public void setMomentNotifications(String requestId,boolean enabled){
        activity.setMomentNotifications(requestId,enabled);
    }

    @JavascriptInterface public void addWidget(String requestId){
        activity.addWidget(requestId);
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
}
