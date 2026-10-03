const clean=(value:unknown,max=12000)=>String(value??"").trim().slice(0,max);

export async function gteSmallEmbedding(text:string){
 const input=clean(text,12000);
 if(!input)return null;
 const SupabaseAI=(globalThis as any).Supabase?.ai;
 if(!SupabaseAI?.Session)throw new Error("embedding-error: Supabase AI no disponible");
 const model=new SupabaseAI.Session("gte-small");
 const output=await model.run(input,{mean_pool:true,normalize:true});
 const values=Array.from((output as any)?.data??output??[]).map(Number);
 if(values.length!==384||values.some(v=>!Number.isFinite(v)))throw new Error("embedding-error: vector inválido");
 return values;
}

export function aiProviderConfig(){
 const apiKey=Deno.env.get("OPENAI_API_KEY")||"";
 const model=Deno.env.get("GALAXY_AI_MODEL")||"";
 const transcribeModel=Deno.env.get("GALAXY_TRANSCRIBE_MODEL")||"gpt-4o-mini-transcribe";
 return {apiKey,model,transcribeModel,configured:!!apiKey&&!!model};
}

function responseText(json:any){
 if(typeof json?.output_text==="string"&&json.output_text.trim())return json.output_text.trim();
 const parts:any[]=[];
 for(const item of json?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")parts.push(c.text);
 return parts.join("\n").trim();
}

export async function generateGroundedResponse(instructions:string,input:string,maxOutputTokens=900){
 const cfg=aiProviderConfig();
 if(!cfg.configured)throw new Error("ai-provider-unavailable");
 const response=await fetch("https://api.openai.com/v1/responses",{
  method:"POST",
  headers:{authorization:"Bearer "+cfg.apiKey,"content-type":"application/json"},
  body:JSON.stringify({model:cfg.model,instructions:clean(instructions,8000),input:clean(input,24000),max_output_tokens:Math.max(80,Math.min(2000,Number(maxOutputTokens)||900))})
 });
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error("ai-provider-error:"+response.status);
 const text=responseText(json);
 if(!text)throw new Error("ai-provider-empty");
 return text;
}

export function extractJsonObject(text:string){
 const raw=clean(text,30000).replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
 const start=raw.indexOf("{"),end=raw.lastIndexOf("}");
 if(start<0||end<=start)throw new Error("ai-json-invalid");
 return JSON.parse(raw.slice(start,end+1));
}

async function transcriptionRequest(blob:Blob,filename:string,mime:string,verbose:boolean){
 const cfg=aiProviderConfig();
 if(!cfg.apiKey)throw new Error("transcription-provider-unavailable");
 const form=new FormData();
 form.append("file",new File([blob],filename,{type:mime||"audio/mp4"}));
 form.append("model",cfg.transcribeModel);
 form.append("response_format",verbose?"verbose_json":"json");
 const response=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{authorization:"Bearer "+cfg.apiKey},body:form});
 const json=await response.json().catch(()=>({}));
 return {response,json};
}

export async function transcribeAudioBlob(blob:Blob,filename:string,mime:string){
 let pair=await transcriptionRequest(blob,filename,mime,true);
 if(!pair.response.ok&&pair.response.status===400)pair=await transcriptionRequest(blob,filename,mime,false);
 if(!pair.response.ok)throw new Error("transcription-provider-error:"+pair.response.status);
 const text=clean(pair.json?.text,30000);
 if(!text)throw new Error("transcription-provider-empty");
 const segments=Array.isArray(pair.json?.segments)?pair.json.segments.map((s:any)=>({start:Number(s?.start)||0,end:Number(s?.end)||0,text:clean(s?.text,500)})):[];
 return {text,segments,provider:"openai",model:aiProviderConfig().transcribeModel};
}