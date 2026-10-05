package com.nuestragalaxia.companion;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;

public class UpdateManagerReleaseTest {
    @Test public void lowerOrEqualVersion_isRejected() {
        assertFalse(UpdateManager.isNewerVersion(34,35));
        assertFalse(UpdateManager.isNewerVersion(35,35));
        assertTrue(UpdateManager.isNewerVersion(36,35));
    }

    @Test public void corruptPayload_failsShaVerification() throws Exception {
        File dir=Files.createTempDirectory("galaxy-update-sha").toFile();
        File apk=new File(dir,"candidate.apk");
        Files.write(apk.toPath(),"corrupt-apk".getBytes(StandardCharsets.UTF_8));
        assertFalse(UpdateManager.hashMatches(apk,repeat("00",32)));
        assertTrue(UpdateManager.hashMatches(apk,sha256(apk)));
    }

    @Test public void interruptedDownload_leavesNoFinalOrPartialApk() throws Exception {
        File dir=Files.createTempDirectory("galaxy-update-interrupt").toFile();
        File apk=new File(dir,"NuestraGalaxia-update.apk");
        InputStream broken=new InputStream(){
            int remaining=32;
            @Override public int read() throws IOException {
                if(remaining<=0)throw new IOException("forced interruption");
                remaining--;
                return 'A';
            }
            @Override public int read(byte[] b,int off,int len)throws IOException{
                if(remaining<=0)throw new IOException("forced interruption");
                int n=Math.min(len,remaining);
                for(int i=0;i<n;i++)b[off+i]='A';
                remaining-=n;
                return n;
            }
        };
        try{
            UpdateManager.writeDownload(broken,apk,-1,1024,null);
            fail("Interrupted download must fail.");
        }catch(IOException expected){
            assertTrue(expected.getMessage().contains("forced interruption"));
        }
        assertFalse(apk.exists());
        assertFalse(new File(apk.getAbsolutePath()+".part").exists());
    }

    @Test public void successfulDownload_isPromotedFromPartToFinalFile() throws Exception {
        File dir=Files.createTempDirectory("galaxy-update-success").toFile();
        File apk=new File(dir,"NuestraGalaxia-update.apk");
        byte[] body="valid-payload".getBytes(StandardCharsets.UTF_8);
        UpdateManager.writeDownload(new java.io.ByteArrayInputStream(body),apk,body.length,1024,null);
        assertTrue(apk.isFile());
        assertFalse(new File(apk.getAbsolutePath()+".part").exists());
        assertTrue(UpdateManager.hashMatches(apk,sha256(apk)));
    }

    private static String sha256(File file)throws Exception{
        MessageDigest md=MessageDigest.getInstance("SHA-256");
        md.update(Files.readAllBytes(file.toPath()));
        StringBuilder out=new StringBuilder();
        for(byte b:md.digest())out.append(String.format(java.util.Locale.US,"%02x",b));
        return out.toString();
    }

    private static String repeat(String value,int count){
        StringBuilder out=new StringBuilder(value.length()*count);
        for(int i=0;i<count;i++)out.append(value);
        return out.toString();
    }
}
