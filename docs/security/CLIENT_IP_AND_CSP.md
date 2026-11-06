# FanMind Client-IP Trust and CSP Baseline

## Purpose

FanMind uses client identity only for bounded abuse and cost protection. Raw IP addresses must not be persisted in customer tables, written to GitHub issues or included in application diagnostics. This document records the verified Production proxy topology and the application policy derived from it.

## Verified Production topology

The read-only runtime audit in workflow run `29996249092` confirmed:

- nginx terminates HTTPS and proxies FanMind to the local application;
- `X-Real-IP` is overwritten with nginx `$remote_addr`;
- `X-Forwarded-For` is produced with `$proxy_add_x_forwarded_for`;
- `X-Forwarded-Proto` is fixed to HTTPS;
- `CF-Connecting-IP` is not established as a trusted header;
- nginx has no `real_ip_header`, `set_real_ip_from` or Proxy Protocol trust layer;
- Production currently runs one PM2 process in `fork_mode`.

## Canonical client identity

`src/lib/clientIpPolicy.mjs` is the single policy for inquiry, AI and public-demo client identity.

Order:

1. use a syntactically valid `X-Real-IP` value, because the verified nginx configuration overwrites it with `$remote_addr`;
2. if that header is unavailable, accept only a bounded, fully valid `X-Forwarded-For` chain and use its final hop, because nginx appends `$remote_addr` on the right;
3. otherwise use the endpoint-specific anonymous/unknown fallback.

The policy never trusts the first `X-Forwarded-For` entry and never trusts `CF-Connecting-IP` under the current topology. IPv4, IPv6 and IPv4-mapped IPv6 values are normalized. Lists, hostnames, ports on unbracketed literals, invalid hops, excessive hop counts and overlong headers fail closed.

Any future CDN, load balancer, Proxy Protocol or nginx `real_ip` deployment requires a new read-only runtime audit and an explicit policy change. Merely adding a header at the edge is not sufficient.

## Storage and logging boundary

- public-demo IP values are HMAC-hashed before the atomic Supabase limiter;
- process-local inquiry/AI limit keys are memory-only and must not be logged;
- raw headers and raw IP values must not be included in error telemetry;
- shared multi-process rate limiting is tracked separately in #664.

## Enforced CSP baseline

FanMind applies the following low-risk directives on every route:

```text
frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'
```

These directives:

- prevent framing;
- restrict document base URL manipulation;
- disable legacy plugin/object content;
- restrict HTML form submission to FanMind itself.

A complete resource CSP for scripts, styles, images and connections is intentionally not enforced in this change because Next.js runtime scripts and external providers need a measured nonce/hash policy. Such a policy must first be observed in Report-Only mode and tested across login, registration, checkout, Supabase and the mobile API boundary.

## Verification

Required automated checks:

```bash
npm run lint
npm run test:operations
npm run build
```

After deployment, verify without response bodies:

- `Content-Security-Policy` is present;
- all four baseline directives are present in the enforced header;
- the previous Report-Only-only state is gone;
- HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy and COOP remain present;
- `/api/health`, login and registration remain healthy.
