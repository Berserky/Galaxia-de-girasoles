package com.nuestragalaxia.companion;

import android.*;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.View;
import android.widget.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
    private static final int REQ_LOCATION=100,REQ_NOTIFICATIONS=101,REQ_BACKGROUND=102;
    private DeviceStore store; private TextView status; private LinearLayout pairPanel; private EditText pairCode;
    private Button startButton,stopButton; private final ExecutorService io=Executors.newSingleThreadExecutor();

    @Override protected void onCreate(Bundle saved){
        super.onCreate(saved);setContentView(R.layout.activity_main);store=new DeviceStore(this);
        status=findViewById(R.id.status);pairPanel=findViewById(R.id.pairPanel);pairCode=findViewById(R.id.pairCode);
        startButton=findViewById(R.id.startButton);stopButton=findViewById(R.id.stopButton);
        findViewById(R.id.pairButton).setOnClickListener(v->pair());
        startButton.setOnClickListener(v->startFlow());
        stopButton.setOnClickListener(v->stopTracking());
        findViewById(R.id.backgroundButton).setOnClickListener(v->backgroundPermission());
        findViewById(R.id.openGalaxyButton).setOnClickListener(v->startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://berserky.github.io/Galaxia-de-girasoles/"))));
        render();
    }
    @Override protected void onResume(){super.onResume();render();}
    private void render(){
        boolean paired=store.paired();pairPanel.setVisibility(paired?View.GONE:View.VISIBLE);
        startButton.setEnabled(paired);stopButton.setEnabled(paired);
        String text=paired?"Vinculado como "+store.name()+" · "+(store.tracking()?"servicio solicitado":"ubicación detenida"):"Este teléfono todavía no está vinculado.";
        if(Build.VERSION.SDK_INT>=30&&checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)!=PackageManager.PERMISSION_GRANTED)text+="\nPermiso de ubicación en segundo plano: opcional/no concedido.";
        status.setText(text);
    }
    private void pair(){
        String code=pairCode.getText().toString().trim();if(code.isEmpty()){toast("Pega el código generado en Nuestra Galaxia.");return;}
        findViewById(R.id.pairButton).setEnabled(false);status.setText("Vinculando teléfono…");
        io.execute(()->{try{
            ApiClient.PairResult r=ApiClient.pair(code,Build.MANUFACTURER+" "+Build.MODEL);
            store.save(r.token,r.person,r.name);runOnUiThread(()->{toast("Teléfono vinculado.");render();});
        }catch(Exception e){runOnUiThread(()->{status.setText("No se pudo vincular: "+e.getMessage());findViewById(R.id.pairButton).setEnabled(true);});}});
    }
    private void startFlow(){
        if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},REQ_LOCATION);return;
        }
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQ_NOTIFICATIONS);
        }
        startTracking();
    }
    private void startTracking(){
        Intent i=new Intent(this,TrackingService.class).setAction(TrackingService.ACTION_START);
        startForegroundService(i);store.setTracking(true);render();toast("Ubicación activa. Android mostrará la notificación mientras compartes.");
    }
    private void stopTracking(){
        Intent i=new Intent(this,TrackingService.class).setAction(TrackingService.ACTION_STOP);startService(i);store.setTracking(false);render();toast("Ubicación detenida.");
    }
    private void backgroundPermission(){
        if(Build.VERSION.SDK_INT==29){requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},REQ_BACKGROUND);return;}
        if(Build.VERSION.SDK_INT>=30){
            new AlertDialog.Builder(this).setTitle("Ubicación en segundo plano").setMessage("Para máxima continuidad, Android permite habilitar «Permitir todo el tiempo» desde los ajustes de esta app. El servicio seguirá siendo visible mediante una notificación permanente.")
                .setNegativeButton("Ahora no",null).setPositiveButton("Abrir ajustes",(d,w)->{
                    Intent i=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));startActivity(i);
                }).show();return;
        }
        toast("Tu versión de Android no necesita un permiso separado.");
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==REQ_LOCATION&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)startFlow();
        else render();
    }
    private void toast(String s){Toast.makeText(this,s,Toast.LENGTH_LONG).show();}
    @Override protected void onDestroy(){io.shutdown();super.onDestroy();}
}
