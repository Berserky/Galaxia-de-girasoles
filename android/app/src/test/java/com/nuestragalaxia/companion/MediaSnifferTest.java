package com.nuestragalaxia.companion;

import org.junit.Test;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class MediaSnifferTest {
    private static byte[] ascii(String value){return value.getBytes(StandardCharsets.ISO_8859_1);}
    private static byte[] concat(byte[]...parts){
        int size=0;for(byte[] part:parts)size+=part.length;
        byte[] out=new byte[size];int offset=0;
        for(byte[] part:parts){System.arraycopy(part,0,out,offset,part.length);offset+=part.length;}
        return out;
    }
    private static byte[] ftyp(String brand){
        String b=(brand+"    ").substring(0,4);
        return concat(new byte[]{0,0,0,24},ascii("ftyp"),ascii(b),new byte[]{0,0,0,0},ascii("isom"));
    }

    @Test public void detectsImagesAndHeif(){
        assertEquals("image/jpeg",MediaSniffer.sniff(new byte[]{(byte)0xff,(byte)0xd8,(byte)0xff,0},"image/jpeg"));
        assertEquals("image/png",MediaSniffer.sniff(new byte[]{(byte)0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a},"image/png"));
        assertEquals("image/webp",MediaSniffer.sniff(concat(ascii("RIFF"),new byte[]{0,0,0,0},ascii("WEBP")),"image/webp"));
        assertEquals("image/heic",MediaSniffer.sniff(ftyp("heic"),"image/heic"));
        assertEquals("image/heif",MediaSniffer.sniff(ftyp("mif1"),"image/heif"));
        assertTrue(MediaSniffer.isHeif("image/heic"));
    }

    @Test public void detectsVideoAudioAndDocuments(){
        assertEquals("video/mp4",MediaSniffer.sniff(ftyp("isom"),"video/mp4"));
        assertEquals("video/webm",MediaSniffer.sniff(new byte[]{0x1a,0x45,(byte)0xdf,(byte)0xa3},"video/webm"));
        assertEquals("audio/mpeg",MediaSniffer.sniff(ascii("ID3\u0004\u0000"),"audio/mpeg"));
        assertEquals("application/pdf",MediaSniffer.sniff(ascii("%PDF-1.7"),"application/pdf"));
        assertEquals("text/plain",MediaSniffer.sniff("hola UTF-8".getBytes(StandardCharsets.UTF_8),"text/plain"));
        assertEquals("application/zip",MediaSniffer.sniff(concat(new byte[]{0x50,0x4b,0x03,0x04},ascii("file.bin")),"application/zip"));
        assertEquals(MediaSniffer.DOCX_MIME,MediaSniffer.sniff(concat(new byte[]{0x50,0x4b,0x03,0x04},ascii("[Content_Types].xml word/document.xml")),MediaSniffer.DOCX_MIME));
        assertEquals(MediaSniffer.XLSX_MIME,MediaSniffer.sniff(concat(new byte[]{0x50,0x4b,0x03,0x04},ascii("[Content_Types].xml xl/workbook.xml")),MediaSniffer.XLSX_MIME));
    }

    @Test public void emptyIsNotPretendedToBeAType(){
        assertEquals("",MediaSniffer.sniff(new byte[0],"image/jpeg"));
    }
}
