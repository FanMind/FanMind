#!/usr/bin/env node
const allowed = new Set(['backup_server_config','backup_database','backup_storage','backup_full']);
const jobType = process.argv[2];
if (!allowed.has(jobType)) { console.error('job_type_not_allowed'); process.exit(64); }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('supabase_config_missing'); process.exit(78); }
const idempotency = `schedule:${jobType}:${new Date().toISOString().slice(0,10)}`;
const title = `Scheduled ${jobType}`;
const response = await fetch(`${url.replace(/\/$/,'')}/rest/v1/admin_operation_jobs`, {
  method: 'POST',
  headers: { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
  body: JSON.stringify({ job_type:jobType, status:'queued', severity:'info', requested_at:new Date().toISOString(), title, summary:'Scheduled backup job created by root-owned systemd timer.', idempotency_key:idempotency, priority: jobType === 'backup_full' ? 50 : 100, metadata:{ source:'systemd_timer' } }),
});
if (response.status === 409) process.exit(0);
if (!response.ok) { console.error(`enqueue_failed_${response.status}`); process.exit(1); }
console.log(JSON.stringify({ ok:true, job_type:jobType }));
