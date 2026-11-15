import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChatAdminMediaError } from "./chatAdminMediaPolicy.mjs";
import { MEDIA_VIDEO_MAX_BYTES, MEDIA_VIDEO_MAX_SECONDS } from "./chatAdminMediaCatalogue.mjs";

let processing=0;
const run=(command:string,args:string[])=>new Promise<string>((resolve,reject)=>{
 execFile(command,args,{timeout:30_000,maxBuffer:128*1024,encoding:"utf8",env:{NODE_ENV:"production",PATH:"/usr/bin:/bin",LANG:"C",LC_ALL:"C"}},(error,stdout)=>error?reject(new ChatAdminMediaError("invalid_video")):resolve(stdout));
});
type Probe={format?:{duration?:string};streams?:Array<{codec_type?:string;codec_name?:string;width?:number;height?:number}>};
function duration(probe:Probe){
 const seconds=Number(probe.format?.duration),video=probe.streams?.filter(s=>s.codec_type==="video")??[];
 if(!Number.isFinite(seconds)||seconds<=0||seconds>MEDIA_VIDEO_MAX_SECONDS||video.length!==1||!video[0].width||!video[0].height||video[0].width>3840||video[0].height>2160||
  !["h264","hevc","av1","vp8","vp9"].includes(video[0].codec_name??"")||!probe.streams||probe.streams.length>3||probe.streams.some(s=>!["video","audio"].includes(s.codec_type??"")))throw new ChatAdminMediaError("invalid_video");
 return Math.ceil(seconds*1000);
}
export async function normalizeMediaVideo(bytes:Uint8Array):Promise<{bytes:Buffer;duration_ms:number}> {
 if(!bytes.length||bytes.length>MEDIA_VIDEO_MAX_BYTES)throw new ChatAdminMediaError("invalid_video_size");
 const buffer=Buffer.from(bytes),mp4=buffer.length>=12&&buffer.subarray(4,8).toString("ascii")==="ftyp",webm=buffer.length>=4&&buffer.readUInt32BE(0)===0x1a45dfa3;
 if(!mp4&&!webm)throw new ChatAdminMediaError("invalid_video");
 if(processing)throw new ChatAdminMediaError("media_processing_busy");
 processing++;let directory:string|undefined;
 try{
  directory=await mkdtemp(join(tmpdir(),"fanmind-media-video-"));
  const input=join(directory,"input"),output=join(directory,"normalized.mp4");
  await writeFile(input,bytes,{mode:0o600,flag:"wx"});
  // Only self-contained MP4/WebM demuxers. No URL, playlist, external track,
  // user filename, environment secret, subtitle or attachment is consumed.
  const format=mp4?"mov":"matroska,webm",inputFlags=["-protocol_whitelist","file","-f",format,...(mp4?["-enable_drefs","0","-use_absolute_path","0"]:[])];
  const probe=async(path:string,flags:string[])=>JSON.parse(await run("/usr/bin/ffprobe",["-v","error","-max_alloc","67108864","-probesize","5000000","-analyzeduration","5000000",...flags,"-show_entries","format=duration:stream=codec_type,codec_name,width,height","-of","json",path])) as Probe;
  const inputDuration=duration(await probe(input,inputFlags));
  await run("/usr/bin/ffmpeg",["-nostdin","-hide_banner","-loglevel","error","-max_alloc","67108864","-threads","1",...inputFlags,"-i",input,"-map","0:v:0","-map","0:a:0?","-sn","-dn","-map_metadata","-1","-map_chapters","-1","-vf","scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30","-c:v","libx264","-preset","veryfast","-crf","25","-pix_fmt","yuv420p","-threads","1","-c:a","aac","-b:a","96k","-movflags","+faststart","-fs",String(MEDIA_VIDEO_MAX_BYTES),"-f","mp4",output]);
  const normalized=await readFile(output),outputDuration=duration(await probe(output,["-protocol_whitelist","file","-f","mov","-enable_drefs","0","-use_absolute_path","0"]));
  if(normalized.length>MEDIA_VIDEO_MAX_BYTES||Math.abs(inputDuration-outputDuration)>500)throw new ChatAdminMediaError("invalid_video");
  return {bytes:normalized,duration_ms:outputDuration};
 }catch(error){if(error instanceof ChatAdminMediaError)throw error;throw new ChatAdminMediaError("invalid_video");}
 finally{if(directory)await rm(directory,{recursive:true,force:true});processing--;}
}
