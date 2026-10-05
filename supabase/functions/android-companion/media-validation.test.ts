import { assertEquals, assertMatch } from "jsr:@std/assert@1";
import { DOCX_MIME, XLSX_MIME, sniffMedia, validateUploadMedia } from "./media-validation.ts";

const bytes=(...values:number[])=>new Uint8Array(values);
const ascii=(value:string)=>new TextEncoder().encode(value);
const concat=(...parts:Uint8Array[])=>{
  const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;
  for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
};
const ftyp=(brand:string)=>concat(bytes(0,0,0,24),ascii("ftyp"),ascii(brand.padEnd(4," ").slice(0,4)),bytes(0,0,0,0),ascii("isom"));

Deno.test("detecta matriz multimedia principal por contenido",()=>{
  const cases:[string,Uint8Array,string][]=[
    ["jpeg",bytes(0xff,0xd8,0xff,0xe0),"image/jpeg"],
    ["png",bytes(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a),"image/png"],
    ["webp",concat(ascii("RIFF"),bytes(0,0,0,0),ascii("WEBP")),"image/webp"],
    ["heic",ftyp("heic"),"image/heic"],
    ["heif",ftyp("mif1"),"image/heif"],
    ["mp4",ftyp("isom"),"video/mp4"],
    ["webm",bytes(0x1a,0x45,0xdf,0xa3,0x01),"video/webm"],
    ["mp3",concat(ascii("ID3"),bytes(4,0,0,0)),"audio/mpeg"],
    ["ogg",concat(ascii("OggS"),bytes(0,2,3,4)),"audio/ogg"],
    ["pdf",ascii("%PDF-1.7\n"),"application/pdf"],
    ["txt",ascii("Hola galaxia\nTexto UTF-8 ✓"),"text/plain"],
    ["zip",concat(bytes(0x50,0x4b,0x03,0x04),ascii("archivo.bin")),"application/zip"],
    ["docx",concat(bytes(0x50,0x4b,0x03,0x04),ascii("[Content_Types].xml word/document.xml")),DOCX_MIME],
    ["xlsx",concat(bytes(0x50,0x4b,0x03,0x04),ascii("[Content_Types].xml xl/workbook.xml")),XLSX_MIME]
  ];
  for(const [name,data,mime] of cases)assertEquals(sniffMedia(data,name==="webm"?"video/webm":"").mime,mime,name);
});

Deno.test("rechaza vacío y MIME falso con explicación clara",()=>{
  const empty=validateUploadMedia("chat-file","application/pdf","vacío.pdf",new Uint8Array());
  assertEquals(empty.ok,false);
  if(!empty.ok)assertMatch(empty.message,/vacío/i);
  const fake=validateUploadMedia("chat-photo","image/png","foto.png",bytes(0xff,0xd8,0xff,0xe0));
  assertEquals(fake.ok,false);
  if(!fake.ok)assertMatch(fake.message,/MIME declarado/i);
});

Deno.test("chat-file acepta PDF TXT ZIP DOCX XLSX y sanea extensión extraña",()=>{
  const cases:[string,string,Uint8Array][]=[
    ["a.pdf","application/pdf",ascii("%PDF-1.5")],
    ["ñandú.txt","text/plain",ascii("texto válido")],
    ["datos.zip","application/zip",concat(bytes(0x50,0x4b,0x03,0x04),ascii("x"))],
    ["informe.docx",DOCX_MIME,concat(bytes(0x50,0x4b,0x03,0x04),ascii("[Content_Types].xml word/document.xml"))],
    ["tabla.xlsx",XLSX_MIME,concat(bytes(0x50,0x4b,0x03,0x04),ascii("[Content_Types].xml xl/workbook.xml"))]
  ];
  for(const [name,mime,data] of cases)assertEquals(validateUploadMedia("chat-file",mime,name,data).ok,true,name);
  const unknown=validateUploadMedia("chat-file","application/octet-stream","archivo.💫",bytes(1,2,3,4,5));
  assertEquals(unknown,{ok:true,mime:"application/octet-stream",extension:"bin"});
});

Deno.test("HEIC/HEIF crudo en chat-photo exige normalización Android",()=>{
  for(const brand of ["heic","mif1"]){
    const result=validateUploadMedia("chat-photo",brand==="heic"?"image/heic":"image/heif","foto."+brand,ftyp(brand));
    assertEquals(result.ok,false);
    if(!result.ok)assertMatch(result.message,/convertirse a JPEG/i);
  }
});
