package com.nuestragalaxia.companion;

import android.location.Location;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class MotionClassifier {
    private final ArrayDeque<Double> speeds=new ArrayDeque<>();
    private Location previous;

    public Result classify(Location location){
        double speed=location.hasSpeed()&&location.getSpeed()>=0?location.getSpeed():fallback(location);
        if(!Double.isFinite(speed)||speed<0||speed>=80)speed=0;
        speeds.addLast(speed);
        while(speeds.size()>5)speeds.removeFirst();

        String motion=classifySpeeds(new ArrayList<>(speeds));
        previous=new Location(location);
        return new Result(speed,motion);
    }

    static String classifySpeeds(List<Double> speedsMs){
        ArrayList<Double> valid=new ArrayList<>();
        for(Double value:speedsMs){
            if(value!=null&&Double.isFinite(value)&&value>=0&&value<80)valid.add(value);
        }
        if(valid.isEmpty())return "still";
        Collections.sort(valid);
        double medianKmh=valid.get(valid.size()/2)*3.6;
        return motionForMedianKmh(medianKmh);
    }

    static String motionForMedianKmh(double medianKmh){
        if(!Double.isFinite(medianKmh)||medianKmh<1.5)return "still";
        if(medianKmh<10)return "walking";
        return "vehicle";
    }

    private double fallback(Location current){
        if(previous==null)return 0;
        long dt=current.getTime()-previous.getTime();
        if(dt<2000)return 0;
        return previous.distanceTo(current)/(dt/1000.0);
    }

    public static final class Result {
        public final double speedMs;
        public final String motion;
        Result(double speedMs,String motion){this.speedMs=speedMs;this.motion=motion;}
    }
}
