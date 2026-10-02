package com.nuestragalaxia.companion;

import android.location.Location;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;

public final class MotionClassifier {
    private final ArrayDeque<Double> speeds=new ArrayDeque<>();
    private Location previous;
    public Result classify(Location location){
        double speed=location.hasSpeed()&&location.getSpeed()>=0?location.getSpeed():fallback(location);
        if(!Double.isFinite(speed)||speed<0||speed>=80)speed=0;
        speeds.addLast(speed);
        while(speeds.size()>5)speeds.removeFirst();
        ArrayList<Double> sorted=new ArrayList<>(speeds); Collections.sort(sorted);
        double medianKmh=sorted.get(sorted.size()/2)*3.6;
        String motion=medianKmh<1.5?"still":medianKmh<10?"walking":"vehicle";
        previous=new Location(location);
        return new Result(speed,motion);
    }
    private double fallback(Location current){
        if(previous==null)return 0;
        long dt=current.getTime()-previous.getTime(); if(dt<2000)return 0;
        return previous.distanceTo(current)/(dt/1000.0);
    }
    public static final class Result {
        public final double speedMs; public final String motion;
        Result(double speedMs,String motion){this.speedMs=speedMs;this.motion=motion;}
    }
}
