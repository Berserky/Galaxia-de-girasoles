package com.nuestragalaxia.companion;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import java.util.*;

public final class WidgetConfigureActivity extends Activity {
 private static final String[] MODULES={"photo","date","hug","mood","distance","eta","song","plan","garden"};
 private static final Map<String,String> LABELS=Map.ofEntries(
  Map.entry("photo","Foto"),Map.entry("date","Próxima fecha"),Map.entry("hug","Abrazo rápido"),
  Map.entry("mood","Mood"),Map.entry("distance","Distancia"),Map.entry("eta","ETA"),
  Map.entry("song","Canción actual"),Map.entry("plan","Próximo plan"),Map.entry("garden","Jardín y racha")
 );
 private int widgetId;private WidgetPrefs widgetPrefs;private LinearLayout list;

 @Override protected void onCreate(Bundle state){
  super.onCreate(state);setResult(RESULT_CANCELED);
  widgetId=getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,AppWidgetManager.INVALID_APPWIDGET_ID);
  if(widgetId==AppWidgetManager.INVALID_APPWIDGET_ID){finish();return;}
  widgetPrefs=new WidgetPrefs(this);
  boolean paired=new DeviceStore(this).paired();

  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(36,16,36,8);
  TextView intro=new TextView(this);
  intro.setText(paired?"Elige qué mostrar. Batería, canción y ubicación siguen respetando los permisos de privacidad de la app. Puedes ordenar los módulos con las flechas.":"Primero vincula este teléfono desde Nuestra Galaxia.");
  intro.setPadding(0,0,0,16);root.addView(intro);
  list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);root.addView(list);
  if(paired)renderRows();

  new AlertDialog.Builder(this).setTitle("Widget Nuestra Galaxia 2.0").setView(root)
   .setNegativeButton("Cancelar",(dialog,which)->finish())
   .setNeutralButton(paired?"Abrir app":"Vincular teléfono",(dialog,which)->{startActivity(new Intent(this,MainActivity.class));finish();})
   .setPositiveButton("Añadir widget",(dialog,which)->{
      BondWidget.update(this,AppWidgetManager.getInstance(this),widgetId);
      BondWorker.schedule(this);BondWorker.refresh(this);
      setResult(RESULT_OK,new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,widgetId));finish();
   }).setOnCancelListener(dialog->finish()).show();
 }

 private void renderRows(){
  list.removeAllViews();
  List<String> order=widgetPrefs.order(widgetId);
  for(String module:order){
   LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(0,4,0,4);
   CheckBox box=new CheckBox(this);box.setText(LABELS.getOrDefault(module,module));box.setChecked(widgetPrefs.enabled(widgetId,module));
   box.setLayoutParams(new LinearLayout.LayoutParams(0,ViewGroup.LayoutParams.WRAP_CONTENT,1));
   box.setOnCheckedChangeListener((button,checked)->widgetPrefs.setEnabled(widgetId,module,checked));
   Button up=new Button(this);up.setText("↑");up.setContentDescription("Subir "+LABELS.getOrDefault(module,module));up.setOnClickListener(v->moveUp(module));
   Button down=new Button(this);down.setText("↓");down.setContentDescription("Bajar "+LABELS.getOrDefault(module,module));down.setOnClickListener(v->moveDown(module));
   row.addView(box);row.addView(up,new LinearLayout.LayoutParams(60,60));row.addView(down,new LinearLayout.LayoutParams(60,60));list.addView(row);
  }
 }
 private void moveUp(String module){widgetPrefs.moveUp(widgetId,module);renderRows();}
 private void moveDown(String module){widgetPrefs.moveDown(widgetId,module);renderRows();}
}
