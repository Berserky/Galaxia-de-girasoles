package com.nuestragalaxia.companion;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;

public final class MediaSniffer {
    public static final String DOCX_MIME="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    public static final String XLSX_MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final String OCTET="application/octet-stream";
    private static final Set<String> HEIC_BRANDS=Set.of("heic","heix","hevc","hevx","heim","heis");
    private static final Set<String> HEIF_BRANDS=Set.of("mif1","msf1");
    private MediaSniffer(){}

    public static String sniff(byte[] bytes,String declaredMime){
        if(bytes==null||bytes.length==0)return "";
        String declared=canonical(declaredMime);
        if(starts(bytes,new int[]{0xff,0xd8,0xff},0))return "image/jpeg";
        if(starts(bytes,new int[]{0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a},0))return "image/png";
        if(starts(bytes,new int[]{0x52,0x49,0x46,0x46},0)&&"WEBP".equals(ascii(bytes,8,4)))return "image/webp";
        String six=ascii(bytes,0,6);if("GIF87a".equals(six)||"GIF89a".equals(six))return "image/gif";
        if("%PDF-".equals(ascii(bytes,0,5)))return "application/pdf";
        if(starts(bytes,new int[]{0x1a,0x45,0xdf,0xa3},0))return "audio/webm".equals(declared)?"audio/webm":"video/webm";
        if("OggS".equals(ascii(bytes,0,4)))return "audio/ogg";
        if("ID3".equals(ascii(bytes,0,3))||(bytes.length>1&&(bytes[0]&0xff)==0xff&&((bytes[1]&0xff)&0xe0)==0xe0))return "audio/mpeg";
        String brand=containerBrand(bytes);
        if(!brand.isBlank()){
            if(HEIC_BRANDS.contains(brand))return "image/heic";
            if(HEIF_BRANDS.contains(brand))return "image/heif";
            if("m4a ".equals(brand)||"m4b ".equals(brand)||"audio/mp4".equals(declared))return "audio/mp4";
            return "video/mp4";
        }
        boolean zip=starts(bytes,new int[]{0x50,0x4b,0x03,0x04},0)||starts(bytes,new int[]{0x50,0x4b,0x05,0x06},0)||starts(bytes,new int[]{0x50,0x4b,0x07,0x08},0);
        if(zip){
            String raw=new String(bytes,StandardCharsets.ISO_8859_1);
            if(raw.contains("[Content_Types].xml")&&raw.contains("word/"))return DOCX_MIME;
            if(raw.contains("[Content_Types].xml")&&raw.contains("xl/"))return XLSX_MIME;
            return "application/zip";
        }
        if(looksText(bytes))return "text/plain";
        return OCTET;
    }

    public static String containerBrand(byte[] bytes){
        if(bytes==null||bytes.length<12)return "";
        int limit=Math.min(bytes.length,256*1024),offset=0,boxes=0;
        while(offset+8<=limit&&boxes++<64){
            long size=uint32(bytes,offset);String type=ascii(bytes,offset+4,4);int header=8;
            if(size==1){
                if(offset+16>limit)return "";
                long high=uint32(bytes,offset+8),low=uint32(bytes,offset+12);
                if(high>0x1fffffL)return "";
                size=high*4294967296L+low;header=16;
            }else if(size==0)size=limit-offset;
            if(size<header)return "";
            if("ftyp".equals(type)){
                if(size<header+4L||offset+header+4>limit)return "";
                return ascii(bytes,offset+header,4).toLowerCase(java.util.Locale.ROOT);
            }
            if(size>limit-offset)return "";
            offset+=(int)size;
        }
        return "";
    }

    public static String sniff(File file,String declaredMime) throws IOException {try(InputStream in=new FileInputStream(file)){return sniff(readPrefix(in,2*1024*1024),declaredMime);}}
    public static boolean isHeif(String mime){String value=canonical(mime);return "image/heic".equals(value)||"image/heif".equals(value);}
    public static byte[] readPrefix(InputStream in,int max) throws IOException {
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int read,total=0;
        while(total<max&&(read=in.read(buffer,0,Math.min(buffer.length,max-total)))!=-1){out.write(buffer,0,read);total+=read;}return out.toByteArray();
    }
    private static long uint32(byte[] bytes,int offset){
        if(offset<0||offset+4>bytes.length)return -1L;
        return ((long)(bytes[offset]&0xff)<<24)|((long)(bytes[offset+1]&0xff)<<16)|((long)(bytes[offset+2]&0xff)<<8)|(long)(bytes[offset+3]&0xff);
    }
    private static String canonical(String value){
        String mime=value==null?"":value.split(";",2)[0].trim().toLowerCase();
        if("image/jpg".equals(mime))return "image/jpeg";if("application/x-zip-compressed".equals(mime))return "application/zip";return mime.isEmpty()?OCTET:mime;
    }
    private static boolean starts(byte[] bytes,int[] signature,int offset){
        if(bytes.length<offset+signature.length)return false;for(int i=0;i<signature.length;i++)if((bytes[offset+i]&0xff)!=signature[i])return false;return true;
    }
    private static String ascii(byte[] bytes,int start,int length){
        if(start<0||start>=bytes.length||length<=0)return "";int end=Math.min(bytes.length,start+length);return new String(bytes,start,end-start,StandardCharsets.ISO_8859_1);
    }
    private static boolean looksText(byte[] bytes){
        int length=Math.min(bytes.length,64*1024),controls=0;for(int i=0;i<length;i++){int value=bytes[i]&0xff;if(value==0)return false;if(value<32&&value!=9&&value!=10&&value!=13)controls++;}
        return controls<=Math.max(1,length/100);
    }
}
