package com.nuestragalaxia.companion;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.net.Uri;
import android.os.Bundle;
public final class WidgetConfigureActivity extends Activity {
 @Override protected void onCreate(Bundle state){super.onCreate(state);setResult(RESULT_CANCELED);int id=getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,AppWidgetManager.INVALID_APPWIDGET_ID);if(id==AppWidgetManager.INVALID_APPWIDGET_ID){finish();return;}
  boolean paired=new DeviceStore(this).paired();new AlertDialog.Builder(this).setTitle("Un espacio para dos").setMessage(paired?"El widget muestra sus nombres y próxima fecha. Elijan una foto del álbum desde Ajustes en la web. El abrazo se envía al tocar su botón. Android puede retrasar las actualizaciones.":"Primero vincula este teléfono desde la app con un código de Ajustes de Nuestra Galaxia.")
   .setNegativeButton("Cancelar",(dialog,which)->finish()).setNeutralButton(paired?"Elegir foto":"Vincular teléfono",(dialog,which)->{if(paired)startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://berserky.github.io/Galaxia-de-girasoles/#ajustes")));else startActivity(new Intent(this,MainActivity.class));finish();})
   .setPositiveButton("Añadir widget",(dialog,which)->{BondWidget.update(this,AppWidgetManager.getInstance(this),id);BondWorker.schedule(this);BondWorker.refresh(this);setResult(RESULT_OK,new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id));finish();}).setOnCancelListener(dialog->finish()).show();
 }
}
