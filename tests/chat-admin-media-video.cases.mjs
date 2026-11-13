import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,mkdtempSync,rmSync,readdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import * as policy from "../src/lib/chatAdminMediaPolicy.mjs";
import * as catalogue from "../src/lib/chatAdminMediaCatalogue.mjs";
const require=createRequire(import.meta.url),exports={};
runInNewContext(ts.transpileModule(readFileSync("src/lib/chatAdminMediaVideo.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,require:name=>name==="./chatAdminMediaPolicy.mjs"?policy:name==="./chatAdminMediaCatalogue.mjs"?catalogue:require(name)});
const {normalizeMediaVideo}=exports;
test("actual bounded video normalization accepts synthetic MP4/WebM and removes metadata",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"media-video-test-"));
 try{
  for(const format of ["mp4","webm"]){
   const path=join(dir,`fixture.${format}`);
   execFileSync("/usr/bin/ffmpeg",["-nostdin","-hide_banner","-loglevel","error","-f","lavfi","-i","color=c=blue:s=160x120:r=10:d=0.4","-an","-c:v",format==="mp4"?"libx264":"libvpx-vp9","-threads","1","-metadata","title=SYNTHETIC_PRIVATE_METADATA",path],{timeout:10000});
   const result=await normalizeMediaVideo(readFileSync(path));
   assert.equal(result.bytes.subarray(4,8).toString(),"ftyp");
   assert.ok(result.duration_ms>=350&&result.duration_ms<=700);
   assert.ok(result.bytes.length<catalogue.MEDIA_VIDEO_MAX_BYTES);
   assert.ok(!result.bytes.includes(Buffer.from("SYNTHETIC_PRIVATE_METADATA")));
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("invalid, oversized, truncated and concurrent video inputs fail closed and clean temp files",async()=>{
 const before=readdirSync(tmpdir()).filter(name=>name.startsWith("fanmind-media-video-"));
 for(const bytes of [Buffer.alloc(0),Buffer.alloc(catalogue.MEDIA_VIDEO_MAX_BYTES+1),Buffer.from("not-a-video"),Buffer.from("0000ftypbadbroken")])await assert.rejects(normalizeMediaVideo(bytes),error=>["invalid_video","invalid_video_size"].includes(error.code));
 const pending=normalizeMediaVideo(Buffer.from("0000ftypbadbroken"));
 await assert.rejects(normalizeMediaVideo(Buffer.from("0000ftypbadbroken")),error=>error.code==="media_processing_busy");
 await assert.rejects(pending,error=>error.code==="invalid_video");
 assert.deepEqual(readdirSync(tmpdir()).filter(name=>name.startsWith("fanmind-media-video-")),before);
});
