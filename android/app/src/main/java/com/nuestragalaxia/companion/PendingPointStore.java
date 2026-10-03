package com.nuestragalaxia.companion;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import java.util.*;

public final class PendingPointStore extends SQLiteOpenHelper {
    public static final class Point {
        public final long id; public final String sampleId,capturedAt,motion; public final double lat,lon,accuracy,speed,heading;
        Point(long id,String sampleId,String capturedAt,double lat,double lon,double accuracy,double speed,double heading,String motion){
            this.id=id;this.sampleId=sampleId;this.capturedAt=capturedAt;this.lat=lat;this.lon=lon;this.accuracy=accuracy;this.speed=speed;this.heading=heading;this.motion=motion;
        }
    }
    public PendingPointStore(Context c){super(c,"galaxy_pending.db",null,1);}
    public void onCreate(SQLiteDatabase db){db.execSQL("create table pending(id integer primary key autoincrement,sample_id text not null unique,captured_at text not null,lat real not null,lon real not null,accuracy real,speed real,heading real,motion text)");}
    public void onUpgrade(SQLiteDatabase db,int oldV,int newV){}
    public synchronized void add(String sampleId,String capturedAt,double lat,double lon,double accuracy,double speed,double heading,String motion){
        ContentValues v=new ContentValues();v.put("sample_id",sampleId);v.put("captured_at",capturedAt);v.put("lat",lat);v.put("lon",lon);v.put("accuracy",accuracy);v.put("speed",speed);v.put("heading",heading);v.put("motion",motion);
        getWritableDatabase().insertWithOnConflict("pending",null,v,SQLiteDatabase.CONFLICT_IGNORE);
        getWritableDatabase().execSQL("delete from pending where id not in (select id from pending order by id desc limit 5000)");
    }
    public synchronized List<Point> batch(int limit){
        ArrayList<Point> out=new ArrayList<>();
        try(Cursor c=getReadableDatabase().rawQuery("select id,sample_id,captured_at,lat,lon,accuracy,speed,heading,motion from pending order by id limit ?",new String[]{String.valueOf(limit)})){
            while(c.moveToNext())out.add(new Point(c.getLong(0),c.getString(1),c.getString(2),c.getDouble(3),c.getDouble(4),c.getDouble(5),c.getDouble(6),c.getDouble(7),c.getString(8)));
        }
        return out;
    }
    public synchronized void remove(long id){getWritableDatabase().delete("pending","id=?",new String[]{String.valueOf(id)});}
    public synchronized int clear(){int count=count();getWritableDatabase().delete("pending",null,null);return count;}
    public synchronized int count(){try(Cursor c=getReadableDatabase().rawQuery("select count(*) from pending",null)){return c.moveToFirst()?c.getInt(0):0;}}
}
