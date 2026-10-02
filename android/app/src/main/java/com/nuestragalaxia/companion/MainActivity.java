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
    private static final int REQ_LOCATION=100,REQ_NOTIFICATIONS=101,REQ_BACKGROUND=102,REQ_BOND_NOTIFICATIONS=103;

    private DeviceStore store;
    private TextView status,updateStatus;
    private LinearLayout pairPanel;
    private EditText pairCode;
    private Button startButton,stopButton,updateButton;
    private ProgressBar updateProgress;
    private UpdateManager updater;
    private final ExecutorService io=Executors.newSingleThreadExecutor();

    @Override protected void onCreate(Bundle b){
        super.onCreate(b);
        setContentView(R.layout.activity_main);

        ((TextView)findViewById(R.id.versionLabel)).setText("v"+BuildConfig.VERSION_NAME);
        findViewById(R.id.rootView).setOnApplyWindowInsetsListener((v,insets)->{
            if(Build.VERSION.SDK_INT>=30){
                android.graphics.Insets bars=insets.getInsets(
                    android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.displayCutout()
                );
                v.setPadding(bars.left,bars.top,bars.right,bars.bottom);
            }else{
                v.setPadding(
                    insets.getSystemWindowInsetLeft(),
                    insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(),
                    insets.getSystemWindowInsetBottom()
                );
            }
            return insets;
        });
        findViewById(R.id.rootView).requestApplyInsets();

        store=new DeviceStore(this);
        status=findViewById(R.id.status);
        pairPanel=findViewById(R.id.pairPanel);
        pairCode=findViewById(R.id.pairCode);
        startButton=findViewById(R.id.startButton);
        stopButton=findViewById(R.id.stopButton);
        updateButton=findViewById(R.id.updateButton);
        updateStatus=findViewById(R.id.updateStatus);
        updateProgress=findViewById(R.id.updateProgress);

        updater=new UpdateManager(this,(t,p,busy)->{
            updateStatus.setText(t);
            updateProgress.setProgress(p);
            updateProgress.setVisibility(busy?View.VISIBLE:View.GONE);
            updateButton.setEnabled(!busy);
        });

        findViewById(R.id.pairButton).setOnClickListener(v->pair());
        startButton.setOnClickListener(v->startFlow());
        stopButton.setOnClickListener(v->stopTracking());
        findViewById(R.id.backgroundButton).setOnClickListener(v->backgroundPermission());
        findViewById(R.id.openGalaxyButton).setOnClickListener(v->
            startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://berserky.github.io/Galaxia-de-girasoles/")))
        );
        updateButton.setOnClickListener(v->updater.check(true));

        setupBond();
        render();
        refreshBondInBackground();
        updater.check(false);
    }

    @Override protected void onResume(){
        super.onResume();
        render();
        refreshBondInBackground();
    }

    private void render(){
        boolean paired=store.pairedFast();
        pairPanel.setVisibility(paired?View.GONE:View.VISIBLE);
        if(!paired)findViewById(R.id.pairButton).setEnabled(true);

        findViewById(R.id.addWidgetButton).setEnabled(paired);
        findViewById(R.id.unpairButton).setEnabled(paired);

        Switch bondToggle=findViewById(R.id.bondNotifications);
        bondToggle.setEnabled(paired);
        bondToggle.setChecked(new BondStore(this).enabled());

        startButton.setEnabled(paired);
        stopButton.setEnabled(paired);

        String t=paired
            ?"Vinculado como "+store.name()+" · "+(store.tracking()?"servicio solicitado":"ubicación detenida")
            :"Este teléfono todavía no está vinculado.";

        if(Build.VERSION.SDK_INT>=30&&checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)!=PackageManager.PERMISSION_GRANTED){
            t+="\nPermiso de ubicación en segundo plano: opcional/no concedido.";
        }
        status.setText(t);
    }

    private void refreshBondInBackground(){
        Context app=getApplicationContext();
        try{
            io.execute(()->{
                try{
                    BondWorker.schedule(app);
                    BondWorker.refresh(app);
                }catch(Exception ignored){
                    // La UI no debe bloquearse si WorkManager tarda o falla al inicializar.
                }
            });
        }catch(RejectedExecutionException ignored){
            // Activity is already closing.
        }
    }

    private void setupBond(){
        Switch toggle=findViewById(R.id.bondNotifications);
        toggle.setChecked(new BondStore(this).enabled());
        toggle.setOnCheckedChangeListener((button,enabled)->{
            BondStore bond=new BondStore(this);
            if(bond.enabled()==enabled)return;

            if(enabled&&Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQ_BOND_NOTIFICATIONS);
                return;
            }

            bond.enabled(enabled);
            refreshBondInBackground();
        });

        findViewById(R.id.addWidgetButton).setOnClickListener(v->{
            android.appwidget.AppWidgetManager manager=getSystemService(android.appwidget.AppWidgetManager.class);
            if(Build.VERSION.SDK_INT>=26&&manager.isRequestPinAppWidgetSupported()){
                manager.requestPinAppWidget(new ComponentName(this,BondWidget.class),null,null);
            }else{
                toast("Mantén pulsado un espacio en la pantalla de inicio y elige Widgets → Nuestra Galaxia.");
            }
        });

        findViewById(R.id.unpairButton).setOnClickListener(v->unpair());
    }

    private void unpair(){
        findViewById(R.id.unpairButton).setEnabled(false);
        status.setText("Desvinculando teléfono…");
        stopService(new Intent(this,TrackingService.class));

        io.execute(()->{
            String previous=store.token();
            store.clear();
            if(previous!=null){
                try{
                    ApiClient.stop(previous);
                }catch(Exception ignored){}
            }
            runOnUiThread(()->{
                render();
                toast("Teléfono desvinculado. Puedes revocar también el dispositivo desde Ajustes en la web.");
            });
        });
    }

    private void pair(){
        String code=pairCode.getText().toString().trim();
        if(code.isEmpty()){
            toast("Pega el código generado en Nuestra Galaxia.");
            return;
        }

        findViewById(R.id.pairButton).setEnabled(false);
        status.setText("Vinculando teléfono…");

        io.execute(()->{
            try{
                ApiClient.PairResult r=ApiClient.pair(code,Build.MANUFACTURER+" "+Build.MODEL);
                store.save(r.token,r.person,r.name);
                runOnUiThread(()->{
                    toast("Teléfono vinculado.");
                    render();
                    refreshBondInBackground();
                });
            }catch(Exception e){
                runOnUiThread(()->{
                    status.setText("No se pudo vincular: "+e.getMessage());
                    findViewById(R.id.pairButton).setEnabled(true);
                });
            }
        });
    }

    private void startFlow(){
        if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(
                new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},
                REQ_LOCATION
            );
            return;
        }

        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},REQ_NOTIFICATIONS);
        }
        startTracking();
    }

    private void startTracking(){
        startForegroundService(new Intent(this,TrackingService.class).setAction(TrackingService.ACTION_START));
        store.setTracking(true);
        render();
        toast("Ubicación activa. Android mostrará la notificación mientras compartes.");
    }

    private void stopTracking(){
        startService(new Intent(this,TrackingService.class).setAction(TrackingService.ACTION_STOP));
        store.setTracking(false);
        render();
        toast("Ubicación detenida.");
    }

    private void backgroundPermission(){
        if(Build.VERSION.SDK_INT==29){
            requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION},REQ_BACKGROUND);
            return;
        }

        if(Build.VERSION.SDK_INT>=30){
            new AlertDialog.Builder(this)
                .setTitle("Ubicación en segundo plano")
                .setMessage("Para máxima continuidad, habilita «Permitir todo el tiempo» desde los ajustes de esta app.")
                .setNegativeButton("Ahora no",null)
                .setPositiveButton("Abrir ajustes",(d,w)->
                    startActivity(new Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:"+getPackageName())
                    ))
                )
                .show();
            return;
        }

        toast("Tu versión de Android no necesita un permiso separado.");
    }

    @Override public void onRequestPermissionsResult(int r,String[] p,int[] g){
        super.onRequestPermissionsResult(r,p,g);

        if(r==REQ_LOCATION&&g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED){
            startFlow();
        }else if(r==REQ_BOND_NOTIFICATIONS){
            boolean allowed=g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED;
            new BondStore(this).enabled(allowed);
            render();
            refreshBondInBackground();
        }else{
            render();
        }
    }

    private void toast(String s){
        Toast.makeText(this,s,Toast.LENGTH_LONG).show();
    }

    @Override protected void onDestroy(){
        updater.close();
        io.shutdown();
        super.onDestroy();
    }
}
