import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readFile, mkdtemp, mkdir, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workflowPath = ".github/workflows/deploy-staging.yml";
const provisioningWorkflowPath = ".github/workflows/provision-staging-host.yml";
const tlsWorkflowPath = ".github/workflows/enable-staging-tls.yml";
const nginxPath = "ops/nginx/fanmind-staging.http.conf";
const runbookPath = "docs/operations/STAGING_PROVISIONING.md";
const separationPath = "docs/operations/ENVIRONMENT_SEPARATION.md";
const stagingServicePath = "ops/systemd/fanmind-staging.service";
const nginxBoundaryVerifierPath =
  "scripts/operations/verify-staging-nginx-whatsapp-boundary.awk";
const stagingCertificate =
  "/etc/letsencrypt/live/staging.fanmind.ch/fullchain.pem";
const stagingCertificateKey =
  "/etc/letsencrypt/live/staging.fanmind.ch/privkey.pem";

async function read(path) {
  return readFile(path, "utf8");
}

function verifyStagingNginxBoundary(configuration) {
  return spawnSync(
    "awk",
    [
      "-v",
      `expected_certificate=${stagingCertificate}`,
      "-v",
      `expected_certificate_key=${stagingCertificateKey}`,
      "-f",
      nginxBoundaryVerifierPath,
    ],
    { input: configuration, encoding: "utf8" },
  );
}

test("actual Staging source copy preserves live release metadata and build after a prebuild failure", async () => {
  const workflow = await read(workflowPath);
  const start = workflow.indexOf("          rsync --archive --delete");
  const end = workflow.indexOf('          if [ -e "$SOURCE_DIR/.git" ]', start);
  assert.ok(start >= 0 && end > start);
  const root = await mkdtemp(join(tmpdir(), "fanmind-staging-copy-"));
  const source = join(root, "reviewed"), target = join(root, "staging");
  try {
    await mkdir(join(source, ".git"), { recursive: true });
    await mkdir(join(target, ".next", "server"), { recursive: true });
    await writeFile(join(source, "current-source.txt"), "reviewed source");
    await writeFile(join(source, ".git", "config"), "must not reach runtime");
    await writeFile(join(target, "removed-source.txt"), "stale source");
    await writeFile(join(target, ".release.env"), "FANMIND_STRIPE_BILLING_WRITE_FREEZE=true\n", { mode: 0o600 });
    await writeFile(join(target, ".env.production"), "synthetic environment", { mode: 0o600 });
    await writeFile(join(target, ".next", "server", "live-build.json"), "live build");
    const result = spawnSync("bash", ["-euo", "pipefail", "-c", `${workflow.slice(start, end)}\nexit 41`], {
      env: { ...process.env, GITHUB_WORKSPACE: source, SOURCE_DIR: target }, encoding: "utf8", timeout: 10_000,
    });
    assert.equal(result.status, 41, "copy must complete before simulated prebuild failure");
    assert.equal(await read(join(target, ".release.env")), "FANMIND_STRIPE_BILLING_WRITE_FREEZE=true\n");
    assert.equal((await stat(join(target, ".release.env"))).mode & 0o777, 0o600);
    assert.equal(await read(join(target, ".next", "server", "live-build.json")), "live build");
    assert.equal(await read(join(target, ".env.production")), "synthetic environment");
    assert.equal(await read(join(target, "current-source.txt")), "reviewed source");
    await assert.rejects(stat(join(target, ".git")), { code: "ENOENT" });
    await assert.rejects(stat(join(target, "removed-source.txt")), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("staging deploy is manual, isolated and fail-closed", async () => {
  const workflow = await read(workflowPath);

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /inputs\.confirmation == 'deploy-staging-only'/);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /runs-on: \[self-hosted, fanmind-staging, exoscale, linux, x64\]/);
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /SOURCE_DIR="\/var\/www\/fanmind-staging"/);
  assert.match(workflow, /ENV_FILE="\$SOURCE_DIR\/\.env\.production"/);
  assert.match(workflow, /EXPECTED_RELEASE_COMMIT: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /\[ -L "\$ENV_FILE" \]/);
  assert.match(workflow, /stat -c '%a'.*!= "600"/);
  assert.match(workflow, /git -C "\$GITHUB_WORKSPACE" rev-parse HEAD/);
  assert.match(workflow, /rsync --archive --delete/);
  assert.match(workflow, /--exclude '\.git\/'/);
  assert.match(workflow, /--exclude '\.env\.production'/);
  assert.match(workflow, /--exclude '\.release\.env'/);
  assert.match(workflow, /--exclude '\.next\/'/);
  assert.match(workflow, /release_state_recovery_confirmation:[\s\S]*required: false/u);
  assert.match(workflow, /FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT: \$\{\{ inputs\.previous_release_commit \}\}/u);
  assert.ok(workflow.indexOf('git -C "$GITHUB_WORKSPACE" rev-parse HEAD') < workflow.indexOf('staging-release-state-recovery.mjs" --recover'));
  assert.ok(workflow.indexOf('staging-release-state-recovery.mjs" --recover') < workflow.indexOf('--resolve "$BILLING_WRITE_FREEZE"'));
  assert.match(workflow, /Git metadata must not persist/);
  assert.match(
    workflow,
    /NEXT_DEPLOYMENT_ID="\$EXPECTED_RELEASE_COMMIT" npm run build/u,
  );
  assert.match(
    workflow,
    /payload\?\.config\?\.deploymentId[\s\S]*FANMIND_REQUIRED_DEPLOYMENT_ID/u,
  );
  assert.match(workflow, /npm run staging:preflight/);
  assert.match(workflow, /npm run verify:truth/);
  assert.match(workflow, /npm run test:operations/);
  assert.match(workflow, /RUNTIME_SECRET_FILE="\/etc\/fanmind-staging\/runtime-secrets\.env"/);
  assert.match(workflow, /sudo systemctl enable fanmind-staging\.service/);
  assert.match(workflow, /sudo systemctl restart fanmind-staging\.service/);
  assert.match(workflow, /sudo systemctl is-active --quiet fanmind-staging\.service/);
  assert.match(workflow, /evaluatePublicHealth/);
  assert.match(workflow, /STAGING_HEALTH_COMPONENT=/);
  assert.match(workflow, /FANMIND_EXPECTED_RUNTIME_ENVIRONMENT=staging/);
  assert.match(workflow, /npm run smoke:public/);

  assert.doesNotMatch(workflow, /SOURCE_DIR="\/var\/www\/fanmind"/);
  assert.doesNotMatch(workflow, /--name fanmind(?:\s|")/);
  assert.doesNotMatch(workflow, /pm2 start/);
  assert.doesNotMatch(workflow, /\[ "\$HEALTH_STATUS" = "200" \]/);
  assert.doesNotMatch(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES=true/);
  assert.doesNotMatch(workflow, /https:\/\/fanmind\.ch/);
  assert.doesNotMatch(workflow, /persist-credentials: true/);
  assert.doesNotMatch(workflow, /git fetch|git reset --hard|git clean/);
});

test("staging documentation keeps external provisioning and deployment boundaries honest", async () => {
  const [runbook, separation] = await Promise.all([
    read(runbookPath),
    read(separationPath),
  ]);

  assert.match(runbook, /Deploy FanMind Staging/);
  assert.match(runbook, /fanmind-staging/);
  assert.match(runbook, /\/var\/www\/fanmind-staging\/\.env\.production/);
  assert.match(runbook, /deploy-staging-only/);
  assert.match(runbook, /ersetzt nicht die vollständige externe Laufzeitabnahme/);
  assert.match(separation, /\.github\/workflows\/deploy-staging\.yml/);
  assert.match(separation, /niemals auf dem Production-Runner/);
});

test("staging host provisioning creates a separate user, path, vhost and runner", async () => {
  const [workflow, nginx] = await Promise.all([
    read(provisioningWorkflowPath),
    read(nginxPath),
  ]);

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /inputs\.confirmation == 'provision-fanmind-staging-host'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /RUNNER_NAME:-.*fanmind-prod-01-exoscale/);
  assert.match(workflow, /STAGING_USER="fanmind-staging"/);
  assert.match(workflow, /SOURCE_DIR="\/var\/www\/fanmind-staging"/);
  assert.doesNotMatch(workflow, /git clone/);
  assert.match(workflow, /PORT", "3001"/);
  assert.match(workflow, /STRIPE_PRICE_STARTER_SETUP/);
  assert.match(workflow, /STRIPE_PRICE_STARTER_MONTHLY/);
  assert.match(workflow, /STRIPE_PRICE_AI_PLUS/);
  assert.match(workflow, /STRIPE_PRICE_AI_ULTRA/);
  assert.match(
    workflow,
    /STAGING_STRIPE_TAX_REGISTRATION_CONFIRMED: \$\{\{ vars\.FANMIND_STAGING_STRIPE_TAX_REGISTRATION_CONFIRMED \}\}/u,
  );
  assert.match(
    workflow,
    /FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED", confirmed\("STAGING_STRIPE_TAX_REGISTRATION_CONFIRMED"\)/u,
  );
  assert.match(
    workflow,
    /STAGING_ADMIN_EMAILS: \$\{\{ vars\.FANMIND_STAGING_ADMIN_EMAILS \}\}/u,
  );
  assert.match(workflow, /const adminEmails = \(name\) =>/u);
  assert.match(workflow, /return \[\.\.\.new Set\(emails\)\]\.join\(","\)/u);
  assert.match(
    workflow,
    /\["FANMIND_ADMIN_EMAILS", adminEmails\("STAGING_ADMIN_EMAILS"\)\]/u,
  );
  assert.doesNotMatch(workflow, /staging-admin@example\.com/u);
  assert.match(
    workflow,
    /sudo stat -c '%U:%G:%a' \/var\/www\/fanmind-staging\/\.env\.production/u,
  );
  assert.match(workflow, /fanmind-staging:fanmind-staging:600/);
  assert.match(workflow, /RUNTIME_SECRET_FILE="\$RUNTIME_SECRET_DIR\/runtime-secrets\.env"/);
  assert.match(workflow, /FANMIND_SHARED_RATE_LIMIT_SECRET/);
  assert.match(workflow, /STAGING_RUNTIME_SECRET=preserved/);
  assert.match(workflow, /randomBytes\(32\)/);
  assert.match(workflow, /ops\/systemd\/fanmind-staging\.service/);
  assert.match(workflow, /fanmind-staging-01-exoscale/);
  assert.match(workflow, /--labels fanmind-staging,exoscale/);
  assert.match(
    workflow,
    /STAGING_CERTIFICATE="\/etc\/letsencrypt\/live\/staging\.fanmind\.ch\/fullchain\.pem"/u,
  );
  assert.match(
    workflow,
    /STAGING_CERTIFICATE_KEY="\/etc\/letsencrypt\/live\/staging\.fanmind\.ch\/privkey\.pem"/u,
  );
  assert.match(workflow, /STAGING_NGINX_TLS=preserved/u);
  assert.match(workflow, /WHATSAPP_TLS_BOUNDARY/u);
  assert.match(
    workflow,
    /verify-staging-nginx-whatsapp-boundary\.awk/u,
  );
  assert.match(workflow, /expected_certificate="\$STAGING_CERTIFICATE"/u);
  assert.match(
    workflow,
    /expected_certificate_key="\$STAGING_CERTIFICATE_KEY"/u,
  );
  assert.ok(
    workflow.indexOf('if sudo test -e "$STAGING_CERTIFICATE"')
      < workflow.indexOf("ops/nginx/fanmind-staging.http.conf"),
  );
  assert.match(workflow, /actions-runner-linux-x64-2\.336\.0\.tar\.gz/);
  assert.match(
    workflow,
    /04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d/,
  );
  assert.match(
    workflow,
    /sudo install -o "\$RUNNER_USER" -g "\$RUNNER_USER" -m 0600 "\$DOWNLOAD_PATH" "\$PRIVATE_ARCHIVE_PATH"/u,
  );
  assert.match(
    workflow,
    /sudo -u "\$RUNNER_USER" -H tar -xzf "\$PRIVATE_ARCHIVE_PATH" -C "\$RUNNER_DIR"/u,
  );
  assert.doesNotMatch(
    workflow,
    /sudo -u "\$RUNNER_USER" -H tar -xzf "\$RUNNER_TEMP/u,
  );
  assert.match(workflow, /STAGING_SECRETS_OUTPUT=false/);
  assert.doesNotMatch(workflow, /\.env\.production.*\/var\/www\/fanmind(?:["'\s]|$)/);
  assert.doesNotMatch(workflow, /pm2 (?:delete|restart|reload|start).*fanmind(?:["'\s]|$)/);
  assert.doesNotMatch(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES", "true"/);

  assert.match(nginx, /server_name staging\.fanmind\.ch;/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3001;/);
  const whatsappBlock = nginx.match(
    /location = \/api\/webhooks\/whatsapp \{([\s\S]*?)^    \}/mu,
  );
  assert.ok(whatsappBlock);
  assert.equal(
    (nginx.match(/location = \/api\/webhooks\/whatsapp \{/gu) ?? []).length,
    1,
  );
  assert.match(whatsappBlock[1], /^        access_log off;$/mu);
  assert.match(whatsappBlock[1], /^        error_log \/dev\/null crit;$/mu);
  assert.match(
    whatsappBlock[1],
    /^        proxy_pass http:\/\/127\.0\.0\.1:3001;$/mu,
  );
  assert.match(workflow, /"\$WHATSAPP_TLS_BOUNDARY" != "valid"/u);
  assert.match(
    workflow,
    /Existing staging TLS virtual host lacks the exact WhatsApp query-redaction boundary/u,
  );
  assert.doesNotMatch(nginx, /server_name (?:www\.)?fanmind\.ch;/);
});

test("staging nginx verifier binds the log boundary to one exact TLS server", () => {
  const valid = `
server {
    listen 80;
    server_name staging.fanmind.ch;
    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name staging.fanmind.ch;
    ssl_certificate ${stagingCertificate};
    ssl_certificate_key ${stagingCertificateKey};
    location = /api/webhooks/whatsapp {
        access_log off;
        error_log /dev/null crit;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
`;
  const accepted = verifyStagingNginxBoundary(valid);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(accepted.stdout.trim(), "valid");

  const certbotManaged = valid.replace(
    `    ssl_certificate_key ${stagingCertificateKey};`,
    `    ssl_certificate_key ${stagingCertificateKey};
    include /etc/letsencrypt/options-ssl-nginx.conf;`,
  );
  const certbotAccepted = verifyStagingNginxBoundary(certbotManaged);
  assert.equal(certbotAccepted.status, 0, certbotAccepted.stderr);
  assert.equal(certbotAccepted.stdout.trim(), "valid");

  const includeInsideProtectedLocation = valid.replace(
    "        access_log off;",
    `        access_log off;
        include /etc/letsencrypt/options-ssl-nginx.conf;`,
  );
  assert.equal(
    verifyStagingNginxBoundary(includeInsideProtectedLocation).stdout.trim(),
    "invalid",
  );

  const unexpectedServerInclude = valid.replace(
    `    ssl_certificate_key ${stagingCertificateKey};`,
    `    ssl_certificate_key ${stagingCertificateKey};
    include /etc/nginx/conf.d/unreviewed.conf;`,
  );
  assert.equal(
    verifyStagingNginxBoundary(unexpectedServerInclude).stdout.trim(),
    "invalid",
  );

  const protectedHttpButLoggedTls = `
server {
    listen 80;
    server_name staging.fanmind.ch;
    location = /api/webhooks/whatsapp {
        access_log off;
        error_log /dev/null crit;
        proxy_pass http://127.0.0.1:3001;
    }
}
server {
    listen 443 ssl;
    server_name staging.fanmind.ch;
    ssl_certificate ${stagingCertificate};
    ssl_certificate_key ${stagingCertificateKey};
    access_log /var/log/nginx/fanmind-staging.access.log;
    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
`;
  const rejected = verifyStagingNginxBoundary(protectedHttpButLoggedTls);
  assert.equal(rejected.status, 0, rejected.stderr);
  assert.equal(rejected.stdout.trim(), "invalid");

  const quotedBraceDepthBypass = valid.replace(
    "        access_log off;",
    `        access_log off;
        set $quoted_open "{";
        access_log /var/log/nginx/whatsapp-query-leak.log;
        set $quoted_close "}";`,
  );
  const quotedBraceRejected = verifyStagingNginxBoundary(
    quotedBraceDepthBypass,
  );
  assert.equal(quotedBraceRejected.status, 0, quotedBraceRejected.stderr);
  assert.equal(quotedBraceRejected.stdout.trim(), "invalid");

  const duplicateHttpLocation = valid.replace(
    "    location / {",
    `    location = /api/webhooks/whatsapp {
        access_log off;
        error_log /dev/null crit;
        proxy_pass http://127.0.0.1:3001;
    }
    location / {`,
  );
  const duplicateLocationRejected = verifyStagingNginxBoundary(
    duplicateHttpLocation,
  );
  assert.equal(
    duplicateLocationRejected.status,
    0,
    duplicateLocationRejected.stderr,
  );
  assert.equal(duplicateLocationRejected.stdout.trim(), "invalid");

  const splitServerDeclarationBypass = `${valid}
server
{
    listen 443 ssl;
    server_name staging.fanmind.ch;
    ssl_certificate ${stagingCertificate};
    ssl_certificate_key ${stagingCertificateKey};
    access_log /var/log/nginx/fanmind-staging.access.log;
    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
`;
  const splitServerRejected = verifyStagingNginxBoundary(
    splitServerDeclarationBypass,
  );
  assert.equal(splitServerRejected.status, 0, splitServerRejected.stderr);
  assert.equal(splitServerRejected.stdout.trim(), "invalid");

  const splitListenDirectiveBypass = `${valid}
server {
    listen
        443 ssl;
    server_name staging.fanmind.ch;
    ssl_certificate ${stagingCertificate};
    ssl_certificate_key ${stagingCertificateKey};
    access_log /var/log/nginx/fanmind-staging.access.log;
    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
`;
  const splitListenRejected = verifyStagingNginxBoundary(
    splitListenDirectiveBypass,
  );
  assert.equal(splitListenRejected.status, 0, splitListenRejected.stderr);
  assert.equal(splitListenRejected.stdout.trim(), "invalid");

  const splitAccessLogDirectiveBypass = valid.replace(
    `        access_log off;
        error_log /dev/null crit;
        proxy_pass http://127.0.0.1:3001;`,
    `        access_log off;
        error_log /dev/null crit;
        proxy_pass http://127.0.0.1:3001;
        access_log
            /var/log/nginx/whatsapp-query-leak.log;`,
  );
  const splitAccessLogRejected = verifyStagingNginxBoundary(
    splitAccessLogDirectiveBypass,
  );
  assert.equal(splitAccessLogRejected.status, 0, splitAccessLogRejected.stderr);
  assert.equal(splitAccessLogRejected.stdout.trim(), "invalid");

  const rewriteRedirectBypass = valid.replace(
    "        proxy_http_version 1.1;",
    `        rewrite ^ /logged-webhook last;
        proxy_http_version 1.1;`,
  );
  const rewriteRedirectRejected = verifyStagingNginxBoundary(
    rewriteRedirectBypass,
  );
  assert.equal(rewriteRedirectRejected.status, 0, rewriteRedirectRejected.stderr);
  assert.equal(rewriteRedirectRejected.stdout.trim(), "invalid");

  const serverRewriteBypass = valid.replace(
    `    ssl_certificate_key ${stagingCertificateKey};`,
    `    ssl_certificate_key ${stagingCertificateKey};
    rewrite ^/api/webhooks/whatsapp$ /logged-webhook last;
    location = /logged-webhook {
        access_log /var/log/nginx/whatsapp-query-leak.log;
        proxy_pass http://127.0.0.1:3001;
    }`,
  );
  const serverRewriteRejected = verifyStagingNginxBoundary(serverRewriteBypass);
  assert.equal(serverRewriteRejected.status, 0, serverRewriteRejected.stderr);
  assert.equal(serverRewriteRejected.stdout.trim(), "invalid");

  const closeThenServerRewriteBypass = valid.replace(
    `    ssl_certificate_key ${stagingCertificateKey};
    location = /api/webhooks/whatsapp {`,
    `    ssl_certificate_key ${stagingCertificateKey};
    location = /harmless {
        proxy_pass http://127.0.0.1:3001;
    } rewrite ^/api/webhooks/whatsapp$ /logged-webhook last;
    location = /logged-webhook {
        access_log /var/log/nginx/whatsapp-query-leak.log;
        proxy_pass http://127.0.0.1:3001;
    }
    location = /api/webhooks/whatsapp {`,
  );
  const closeThenRewriteRejected = verifyStagingNginxBoundary(
    closeThenServerRewriteBypass,
  );
  assert.equal(closeThenRewriteRejected.status, 0, closeThenRewriteRejected.stderr);
  assert.equal(closeThenRewriteRejected.stdout.trim(), "invalid");

  const quotedListen443Bypass = `${valid}
server {
    listen "443" ssl;
    server_name staging.fanmind.ch;
    ssl_certificate ${stagingCertificate};
    ssl_certificate_key ${stagingCertificateKey};
    access_log /var/log/nginx/fanmind-staging.access.log;
    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
`;
  const quotedListenRejected = verifyStagingNginxBoundary(
    quotedListen443Bypass,
  );
  assert.equal(quotedListenRejected.status, 0, quotedListenRejected.stderr);
  assert.equal(quotedListenRejected.stdout.trim(), "invalid");

  const leadingZeroListen443Bypass = `${valid}
server {
    listen 0443 ssl;
    server_name staging.fanmind.ch;
    ssl_certificate ${stagingCertificate};
    ssl_certificate_key ${stagingCertificateKey};
    access_log /var/log/nginx/fanmind-staging.access.log;
    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
`;
  const leadingZeroListenRejected = verifyStagingNginxBoundary(
    leadingZeroListen443Bypass,
  );
  assert.equal(leadingZeroListenRejected.status, 0, leadingZeroListenRejected.stderr);
  assert.equal(leadingZeroListenRejected.stdout.trim(), "invalid");

  const addressLeadingZeroListen443Bypass = `${valid}
server {
    listen 0.0.0.0:0443 ssl default_server;
    server_name staging.fanmind.ch;
    ssl_certificate ${stagingCertificate};
    ssl_certificate_key ${stagingCertificateKey};
    access_log /var/log/nginx/fanmind-staging.access.log;
    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
`;
  const addressLeadingZeroListenRejected = verifyStagingNginxBoundary(
    addressLeadingZeroListen443Bypass,
  );
  assert.equal(
    addressLeadingZeroListenRejected.status,
    0,
    addressLeadingZeroListenRejected.stderr,
  );
  assert.equal(addressLeadingZeroListenRejected.stdout.trim(), "invalid");

  const ipv6ListenWithoutSsl = valid.replace(
    "    listen [::]:443 ssl;",
    "    listen [::]:443;",
  );
  const ipv6WithoutSslRejected = verifyStagingNginxBoundary(
    ipv6ListenWithoutSsl,
  );
  assert.equal(ipv6WithoutSslRejected.status, 0, ipv6WithoutSslRejected.stderr);
  assert.equal(ipv6WithoutSslRejected.stdout.trim(), "invalid");
});

test("staging application is owned by a hardened system service", async () => {
  const service = await read(stagingServicePath);

  assert.match(service, /^User=fanmind-staging$/mu);
  assert.match(service, /^Group=fanmind-staging$/mu);
  assert.match(service, /^WorkingDirectory=\/var\/www\/fanmind-staging$/mu);
  assert.match(service, /^EnvironmentFile=\/var\/www\/fanmind-staging\/\.env\.production$/mu);
  assert.match(service, /^EnvironmentFile=\/etc\/fanmind-staging\/runtime-secrets\.env$/mu);
  assert.match(service, /^EnvironmentFile=\/var\/www\/fanmind-staging\/\.release\.env$/mu);
  assert.match(service, /^ExecStart=\/usr\/bin\/npm start$/mu);
  assert.match(service, /^NoNewPrivileges=true$/mu);
  assert.match(service, /^ProtectSystem=strict$/mu);
  assert.match(service, /^ReadWritePaths=\/var\/www\/fanmind-staging$/mu);
  assert.doesNotMatch(service, /fanmind(?:\.ch|\/var\/www\/fanmind$)/u);
});

test("staging TLS is manual, DNS-bound and reuses the existing certbot account", async () => {
  const workflow = await read(tlsWorkflowPath);

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /inputs\.confirmation == 'enable-fanmind-staging-tls'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /getent ahostsv4 staging\.fanmind\.ch/);
  assert.match(workflow, /\[ "\$DNS_IPV4" != "\$SERVER_IPV4" \]/);
  assert.match(workflow, /sudo test -d \/etc\/letsencrypt\/accounts/);
  assert.match(workflow, /--domain staging\.fanmind\.ch/);
  assert.match(workflow, /--keep-until-expiring/);
  assert.doesNotMatch(workflow, /--agree-tos|register-unsafely-without-email/);
  assert.doesNotMatch(workflow, /https:\/\/fanmind\.ch\//);
});
