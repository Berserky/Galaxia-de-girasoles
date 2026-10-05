export const DOCX_MIME="application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX_MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type MediaInspection={mime:string,extension:string};
export type MediaValidation=
 | {ok:true,mime:string,extension:string}
 | {ok:false,status:number,message:string};

const OCTET="application/octet-stream";
const HEIF_MIMES=new Set(["image/heic","image/heif"]);
const canonicalExt:Record<string,string>={
  "image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","image/heic":"heic","image/heif":"heif",
  "video/mp4":"mp4","video/webm":"webm",
  "audio/mpeg":"mp3","audio/ogg":"ogg","audio/webm":"webm","audio/mp4":"m4a",
  "application/pdf":"pdf","application/zip":"zip",[DOCX_MIME]:"docx",[XLSX_MIME]:"xlsx","text/plain":"txt"
};

function canonicalMime(value:string){
  const mime=String(value||"").split(";")[0].trim().toLowerCase();
  if(mime==="image/jpg")return "image/jpeg";
  if(mime==="application/x-zip-compressed")return "application/zip";
  if(mime==="application/x-pdf")return "application/pdf";
  return mime||OCTET;
}
function starts(bytes:Uint8Array,signature:number[],offset=0){
  if(bytes.length<offset+signature.length)return false;
  return signature.every((value,index)=>bytes[offset+index]===value);
}
function ascii(bytes:Uint8Array,start:number,length:number){
  let out="";
  const end=Math.min(bytes.length,start+length);
  for(let i=start;i<end;i++)out+=String.fromCharCode(bytes[i]);
  return out;
}
function containsAscii(bytes:Uint8Array,needle:string){
  const pattern=new TextEncoder().encode(needle);
  if(!pattern.length||bytes.length<pattern.length)return false;
  const windows:[[number,number],[number,number]]=[
    [0,Math.min(bytes.length,1024*1024)],
    [Math.max(0,bytes.length-1024*1024),bytes.length]
  ];
  for(const [start,end] of windows){
    outer:for(let i=start;i<=end-pattern.length;i++){
      for(let j=0;j<pattern.length;j++)if(bytes[i+j]!==pattern[j])continue outer;
      return true;
    }
  }
  return false;
}
function safeOriginalExtension(name:string){
  const tail=String(name||"").split(/[\\/]/).pop()||"";
  const dot=tail.lastIndexOf(".");
  if(dot<1||dot===tail.length-1)return "bin";
  const ext=tail.slice(dot+1).toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,12);
  return ext||"bin";
}
function looksLikeText(bytes:Uint8Array){
  const sample=bytes.slice(0,Math.min(bytes.length,64*1024));
  if(!sample.length)return false;
  for(const value of sample)if(value===0)return false;
  try{
    const value=new TextDecoder("utf-8",{fatal:true}).decode(sample);
    let controls=0;
    for(const char of value){
      const code=char.codePointAt(0)||0;
      if(code<32&&code!==9&&code!==10&&code!==13)controls++;
    }
    return controls<=Math.max(1,Math.floor(value.length*0.01));
  }catch{return false;}
}

export function sniffMedia(bytes:Uint8Array,declaredMime=""):MediaInspection{
  const declared=canonicalMime(declaredMime);
  if(bytes.length<1)return {mime:"",extension:""};
  if(starts(bytes,[0xff,0xd8,0xff]))return {mime:"image/jpeg",extension:"jpg"};
  if(starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))return {mime:"image/png",extension:"png"};
  if(starts(bytes,[0x52,0x49,0x46,0x46])&&ascii(bytes,8,4)==="WEBP")return {mime:"image/webp",extension:"webp"};
  if(ascii(bytes,0,6)==="GIF87a"||ascii(bytes,0,6)==="GIF89a")return {mime:"image/gif",extension:"gif"};
  if(ascii(bytes,0,5)==="%PDF-")return {mime:"application/pdf",extension:"pdf"};
  if(starts(bytes,[0x1a,0x45,0xdf,0xa3]))return declared==="audio/webm"?{mime:"audio/webm",extension:"webm"}:{mime:"video/webm",extension:"webm"};
  if(ascii(bytes,0,4)==="OggS")return {mime:"audio/ogg",extension:"ogg"};
  if(ascii(bytes,0,3)==="ID3"||(bytes.length>1&&bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0))return {mime:"audio/mpeg",extension:"mp3"};

  if(bytes.length>=12&&ascii(bytes,4,4)==="ftyp"){
    const brand=ascii(bytes,8,4).toLowerCase();
    const heic=new Set(["heic","heix","hevc","hevx","heim","heis"]);
    const heif=new Set(["mif1","msf1"]);
    if(heic.has(brand))return {mime:"image/heic",extension:"heic"};
    if(heif.has(brand))return {mime:"image/heif",extension:"heif"};
    if(brand==="m4a "||brand==="m4b "||declared==="audio/mp4")return {mime:"audio/mp4",extension:"m4a"};
    return {mime:"video/mp4",extension:"mp4"};
  }

  const zip=starts(bytes,[0x50,0x4b,0x03,0x04])||starts(bytes,[0x50,0x4b,0x05,0x06])||starts(bytes,[0x50,0x4b,0x07,0x08]);
  if(zip){
    const contentTypes=containsAscii(bytes,"[Content_Types].xml");
    if(contentTypes&&containsAscii(bytes,"word/"))return {mime:DOCX_MIME,extension:"docx"};
    if(contentTypes&&containsAscii(bytes,"xl/"))return {mime:XLSX_MIME,extension:"xlsx"};
    return {mime:"application/zip",extension:"zip"};
  }
  if(looksLikeText(bytes))return {mime:"text/plain",extension:"txt"};
  return {mime:OCTET,extension:"bin"};
}

function compatible(actual:string,declared:string){
  if(!declared||declared===OCTET)return true;
  return canonicalMime(actual)===canonicalMime(declared);
}
function allowed(kind:string,mime:string){
  const image=new Set(["image/jpeg","image/png","image/webp"]);
  const audio=new Set(["audio/mpeg","audio/ogg","audio/webm","audio/mp4"]);
  if(kind==="photo"||kind==="chat-photo")return image.has(mime);
  if(kind==="music")return mime==="audio/mpeg";
  if(kind==="voice"||kind==="chat-audio")return audio.has(mime);
  if(kind==="chat-gif")return mime==="image/gif"||mime==="image/webp";
  if(kind==="chat-video")return mime==="video/mp4"||mime==="video/webm";
  if(kind==="chat-file")return true;
  return false;
}

export function validateUploadMedia(kind:string,declaredMime:string,originalName:string,bytes:Uint8Array):MediaValidation{
  if(bytes.length<1)return {ok:false,status:400,message:"El archivo está vacío."};
  const declared=canonicalMime(declaredMime);
  const inspected=sniffMedia(bytes,declared);
  if(HEIF_MIMES.has(inspected.mime)&&(kind==="photo"||kind==="chat-photo")){
    return {ok:false,status:415,message:"HEIC/HEIF debe convertirse a JPEG antes de enviarse. Vuelve a seleccionar la foto desde Android."};
  }
  if(!allowed(kind,inspected.mime)){
    if(kind==="chat-file"&&inspected.mime===OCTET){
      return {ok:true,mime:OCTET,extension:safeOriginalExtension(originalName)};
    }
    return {ok:false,status:415,message:"El contenido real del archivo no es compatible con este tipo de envío."};
  }
  if(inspected.mime===OCTET){
    return kind==="chat-file"
      ?{ok:true,mime:OCTET,extension:safeOriginalExtension(originalName)}
      :{ok:false,status:415,message:"No pudimos reconocer el formato real del archivo."};
  }
  if(!compatible(inspected.mime,declared)){
    return {ok:false,status:415,message:"El MIME declarado no coincide con el contenido real del archivo."};
  }
  return {ok:true,mime:inspected.mime,extension:canonicalExt[inspected.mime]||inspected.extension||"bin"};
}
