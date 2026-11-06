import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {X509Certificate} from "node:crypto";
import test from "node:test";
import yaml from "js-yaml";

for (const component of ["retention", "handoff"]) {
  test(`Website Chat ${component} acceptance binds verified TLS and an explicit synthetic workspace`, () => {
    const workflow=yaml.load(readFileSync(`.github/workflows/website-chat-${component}-staging-acceptance.yml`,"utf8"));
    const input=workflow.on.workflow_dispatch.inputs.workspace_id;
    assert.equal(input.required,true);assert.equal(input.type,"string");
    const jobs=Object.values(workflow.jobs);assert.equal(jobs.length,1);
    const job=jobs[0];assert.equal(job.environment,"staging");
    assert.match(job.if,/github.ref == 'refs\/heads\/main'/u);
    assert.match(job.if,/inputs.reviewed_commit == github.sha/u);
    assert.equal(job.env.PGSSLMODE,"verify-full");
    assert.equal(job.env.PGSSLROOTCERT,"${{ github.workspace }}/config/certificates/supabase-root-2021-ca.crt");
    assert.equal(job.env.FANMIND_WEBSITE_CHAT_STAGING_WORKSPACE_ID,"${{ inputs.workspace_id }}");
    assert.ok(job.steps.some(step=>step.if==="${{ always() }}" && step.run==='rm -f "$PGPASSFILE"'));
  });
}
test("Acceptance TLS uses the existing self-signed Supabase CA certificate",()=>{
  const cert=new X509Certificate(readFileSync("config/certificates/supabase-root-2021-ca.crt"));
  assert.equal(cert.ca,true);assert.equal(cert.verify(cert.publicKey),true);
});
