import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const STORAGE_FINALIZATION_PATH='supabase/controlled/chat_admin_media_storage_finalization.sql';
export const STORAGE_FINALIZATION_SHA='d021366a66d968d3ddeeb594a67ded277e723a0bd9759a439e4f8fb5ae3f8218';
export function storageFinalizationSource(){
 const source=readFileSync(STORAGE_FINALIZATION_PATH,'utf8');
 if(createHash('sha256').update(source).digest('hex')!==STORAGE_FINALIZATION_SHA)throw Error('media_storage_source_mismatch');
 const match=/create or replace function public\.chat_admin_media_object_guard\(\) returns trigger\n language plpgsql security invoker set search_path='' as \$\$([^]*?)\$\$;/.exec(source);
 if(!match)throw Error('media_storage_source_mismatch');
 return {source,statement:match[0],body:match[1]};
}
// Exact source-derived replacement of just the guard; every other catalogue
// field, function ACL, RLS policy, trigger, table and bucket remains identical.
export function storageFinalizationCatalogue(catalogue){
 const next=structuredClone(catalogue),guard=next.functions.filter(f=>f.name==='chat_admin_media_object_guard');
 if(guard.length!==1||!guard[0].definition.includes('AS $function$'))throw Error('media_storage_reference_invalid');
 guard[0].definition=guard[0].definition.replace(/AS \$function\$[^]*?\$function\$/u,()=>`AS $function$${storageFinalizationSource().body}$function$`);
 return next;
}
