# FanMind Public Uptime Monitor

## Purpose

`.github/workflows/uptime-fanmind.yml` performs an external, read-only FanMind healthcheck every hour and can also be started manually from GitHub Actions.

It complements deployment-time checks. A successful deployment does not prove that DNS, TLS, nginx, PM2, Next.js, public Supabase health dependencies and routes remain reachable later.

## Checked endpoints

- `/`
- `/login`
- `/register`
- `/referral-bedingungen`
- `/api/health`
- `/api/version`

Page routes must return HTTP 200. `/api/health` must return `status=healthy` and `scope=public`. `/api/version` must identify FanMind, the Production environment, `runtimeEnvironment=production` and a 40-character release commit.

## Frequency and retries

- schedule: hourly at minute 17;
- manual start: `workflow_dispatch`;
- per check: 15-second timeout;
- up to three attempts with a short delay;
- only HTTPS remote targets are accepted by the monitor script.

The one-hour cadence avoids unnecessary GitHub Actions consumption while still detecting sustained outages. A separate commercial monitoring provider can be added later if SMS, phone escalation or shorter intervals are required.

## Alert behavior

On failure, the workflow creates or updates one issue with the exact title:

```text
[Uptime] FanMind public healthcheck failed
```

It does not create a new issue every hour. The issue contains only:

- check time;
- release commit when available;
- endpoint name;
- HTTP status;
- request duration;
- normalized error code;
- link to the workflow run.

Response bodies, credentials and customer data are not included.

After all checks recover, the workflow comments on and closes the open alert issue.

## Local or server-side manual check

```bash
npm run uptime:check
```

Structured output:

```bash
node scripts/monitor-public-uptime.mjs \
  --base-url https://fanmind.ch \
  --expected-runtime-environment production \
  --json
```

A nonzero exit code means at least one public check failed.

## GitHub notifications

Repository owners should enable GitHub Actions and issue notifications for the FanMind repository. The workflow itself opens the alert issue; notification delivery depends on each GitHub user's notification settings.

## Security boundaries

- GET requests only;
- no login credentials;
- no admin endpoints;
- no service-role or Stripe secrets;
- no database writes by the monitor script;
- the workflow may only create, update or close its single uptime alert issue;
- no automatic server restart or rollback.

Automatic restarts are intentionally excluded. A failed healthcheck requires diagnosis before intervention.

## Incident response

When the alert opens:

1. open the linked workflow run and identify the failed check;
2. compare `/api/version`, server HEAD and `origin/main`;
3. inspect PM2 status and uptime;
4. inspect nginx and PM2 error logs around the failure time;
5. check disk, memory and pending operating-system restart state;
6. do not expose secrets in the issue;
7. use the documented rollback or deployment process only after identifying the cause.
