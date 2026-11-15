/** Own-account export only: no tenant-wide or colleague conversation export. */
export async function collectSupportExport(readPage,{maxRows=3200}={}){
 let before,turns=[];const seen=new Set();
 for(let page=0;page<Math.ceil(maxRows/100)+1;page++){
  const rows=await readPage(before);
  if(!Array.isArray(rows)||rows.length>100)throw new Error("support_export_invalid");
  for(const row of rows){if(typeof row.request_id!=="string"||seen.has(row.request_id))throw new Error("support_export_cursor_invalid");seen.add(row.request_id);}
  turns=[...rows,...turns];if(turns.length>maxRows)throw new Error("support_export_limit");
  if(rows.length<100)return turns;
  before=rows[0].request_id;
 }
 throw new Error("support_export_incomplete");
}
