// Provider bodies are untrusted. Only the documented key-absence class may
// confirm the exact authenticated key probed by the existing deletion path.
// Supabase Storage 1.94.2 also transports this 404 class as HTTP 400.
export async function isChatAdminStorageObjectAbsent(response) {
 const reader=response.body?.getReader();
 if(!reader)return false;
 try {
  if(![400,404].includes(response.status)||response.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return false;
  const declared=response.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/u.test(declared)||Number(declared)>1024))return false;
  const chunks=[];let length=0;
  while(true){const item=await reader.read();if(item.done)break;length+=item.value.byteLength;if(length>1024)return false;chunks.push(item.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let error,text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);error=JSON.parse(text);}catch{return false;}
  if(!error||typeof error!=='object'||Array.isArray(error)||Object.keys(error).some(key=>!['code','message','statusCode','error'].includes(key)))return false;
  // Reject duplicate or escaped field names instead of accepting JSON.parse's
  // last value for contradictory provider classifications.
  if((text.match(/"(?:code|message|statusCode|error)"\s*:/gu)??[]).length!==Object.keys(error).length)return false;
  if(error.code!=='NoSuchKey'||error.message!=='Object not found')return false;
  if(error.statusCode!==undefined&&error.statusCode!=='404'&&error.statusCode!==404)return false;
  if(error.error!==undefined&&error.error!=='not_found')return false;
  return response.status===404||((error.statusCode==='404'||error.statusCode===404)&&error.error==='not_found');
 }finally{await reader.cancel().catch(()=>{});}
}
