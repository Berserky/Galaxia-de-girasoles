package com.nuestragalaxia.companion;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class DeviceStore {
    private static final String PREFS="galaxy_companion", KEY_ALIAS="galaxy_device_token";
    private final SharedPreferences prefs;
    private final Context context;

    public DeviceStore(Context context){
        this.context=context.getApplicationContext();
        prefs=context.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if(!ks.containsAlias(KEY_ALIAS)){
            KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            gen.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
            gen.generateKey();
        }
        return ((KeyStore.SecretKeyEntry)ks.getEntry(KEY_ALIAS,null)).getSecretKey();
    }

    public void save(String token,String person,String name) throws Exception {
        String oldPerson=prefs.getString("person","");
        if(!oldPerson.isEmpty()&&!oldPerson.equals(person))GalaxyNotifications.resetChat(context);
        new BondStore(context).clear();
        Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE,key());
        byte[] encrypted=c.doFinal(token.getBytes(StandardCharsets.UTF_8));
        prefs.edit()
            .putString("token",Base64.encodeToString(encrypted,Base64.NO_WRAP))
            .putString("iv",Base64.encodeToString(c.getIV(),Base64.NO_WRAP))
            .putString("person",person)
            .putString("name",name)
            .apply();
    }

    /**
     * Lightweight paired-state check for UI/receiver paths.
     * It intentionally avoids AndroidKeyStore, which can be slow on some devices.
     * Background workers still call token() and validate the encrypted credential.
     */
    public boolean pairedFast(){
        return prefs.contains("token")&&prefs.contains("iv");
    }

    public String token(){
        try{
            String e=prefs.getString("token",null),iv=prefs.getString("iv",null);
            if(e==null||iv==null)return null;
            Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(iv,Base64.NO_WRAP)));
            return new String(c.doFinal(Base64.decode(e,Base64.NO_WRAP)),StandardCharsets.UTF_8);
        }catch(Exception e){
            return null;
        }
    }

    public String person(){ return prefs.getString("person",""); }
    public String name(){ return prefs.getString("name","Android"); }
    public void setPerson(String person){
        if(!"0".equals(person)&&!"1".equals(person))throw new IllegalArgumentException("Perfil no válido");
        if(!person.equals(prefs.getString("person","")))GalaxyNotifications.resetChat(context);
        prefs.edit().putString("person",person).apply();
        new BondStore(context).clear();
    }
    public boolean paired(){ return token()!=null; }
    public void setTracking(boolean value){ prefs.edit().putBoolean("tracking",value).apply(); }
    public boolean tracking(){ return prefs.getBoolean("tracking",false); }

    public void clear(){
        prefs.edit().clear().commit();
        new BondStore(context).clear();
        GalaxyNotifications.resetChat(context);
        context.stopService(new android.content.Intent(context,TrackingService.class));
        // Revoking the identity also revokes consent to retransmit offline fixes.
        try(PendingPointStore queued=new PendingPointStore(context)){queued.clear();}
        BondWorker.cancel(context);
        context.getSystemService(android.app.NotificationManager.class).cancelAll();
        BondWidget.updateAll(context);
    }
}
