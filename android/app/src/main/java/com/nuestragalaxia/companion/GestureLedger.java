package com.nuestragalaxia.companion;
import java.util.*;
import java.time.Instant;
/** Id based baseline persisted before delivery. First sync seeds without replay. */
public final class GestureLedger {
 private GestureLedger(){}
 public static List<String> fresh(boolean initialized,Set<String> seen,List<String> incoming){
  List<String> fresh=new ArrayList<>();Set<String> unique=new HashSet<>(seen);
  for(String id:incoming)if(id!=null&&!id.trim().isEmpty()&&unique.add(id)&&initialized)fresh.add(id);
  return fresh;
 }
 public static boolean before(String created,String cutoff){if(cutoff.isEmpty())return false;try{return Instant.parse(created).isBefore(Instant.parse(cutoff));}catch(Exception invalid){return true;}}
}
