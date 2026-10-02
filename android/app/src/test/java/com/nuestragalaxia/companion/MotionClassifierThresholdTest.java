package com.nuestragalaxia.companion;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

import java.util.List;

public class MotionClassifierThresholdTest {
    @Test public void stillBelowOnePointFiveKmh(){
        assertEquals("still",MotionClassifier.motionForMedianKmh(0));
        assertEquals("still",MotionClassifier.motionForMedianKmh(1.49));
    }

    @Test public void walkingBetweenOnePointFiveAndTenKmh(){
        assertEquals("walking",MotionClassifier.motionForMedianKmh(1.5));
        assertEquals("walking",MotionClassifier.motionForMedianKmh(5.0));
        assertEquals("walking",MotionClassifier.motionForMedianKmh(9.99));
    }

    @Test public void vehicleAtTenKmhAndAbove(){
        assertEquals("vehicle",MotionClassifier.motionForMedianKmh(10));
        assertEquals("vehicle",MotionClassifier.motionForMedianKmh(55));
    }

    @Test public void medianIgnoresSingleGpsSpeedSpike(){
        assertEquals("walking",MotionClassifier.classifySpeeds(List.of(
            1.2,1.3,1.4,20.0,1.5
        )));
    }

    @Test public void invalidSamplesDoNotForceVehicle(){
        assertEquals("still",MotionClassifier.classifySpeeds(List.of(
            Double.NaN,-1.0,100.0,0.0,0.2
        )));
    }
}
