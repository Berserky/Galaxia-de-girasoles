package com.nuestragalaxia.companion;
import android.content.*;
public final class BondActionReceiver extends BroadcastReceiver {
 public static final String HUG="com.nuestragalaxia.companion.SEND_HUG";
 @Override public void onReceive(Context c,Intent intent){if(HUG.equals(intent.getAction()))BondWorker.sendHug(c);}
}
