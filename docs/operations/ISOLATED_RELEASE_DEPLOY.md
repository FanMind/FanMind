# FanMind Isolated Release Deployment

## Purpose

The existing Production workflow builds inside `/var/www/fanmind`, which is also the current PM2 working directory. During `npm ci` and `next build`, the live process can therefore observe changing files in its own application directory.

The isolated release path builds a complete release in a separate directory while the previous release continues serving traffic. PM2 switches only after the new build, product-truth verification, lint and operations tests have succeeded.

## Status

The isolated path is **active on Production since 2026-07-19**. The rolling
PM2 release contract was added after a short nginx `502` was observed during
the former delete/start switch.

Production uses:

```text
FANMIND_ENABLE_ISOLATED_RELEASE_DEPLOY=true
FANMIND_RELEASE_RETENTION_COUNT=4
```

The first controlled activation exposed a permission problem while atomically updating `/var/www/fanmind-current`; PR #586 corrected the privileged symlink update. Deploy FanMind run #407 then completed successfully for commit `c61ee5668e52af1bcbd454028820614d730d2bc8`, including Product Truth, lint, operations tests, build, PM2 switch, public smoke tests and release-link update.

If the isolated-deploy flag is absent or not exactly `true`, the workflow falls back to the legacy in-place path.

## Directories

```text
/var/www/fanmind
  Git checkout and protected .env.production source

/var/www/fanmind-releases/<full-commit-sha>
  Immutable built application release

/var/www/fanmind-current
  Atomic symlink used as the stable PM2 working directory
```

The release directory receives the exact Git tree for the expected `origin/main` commit. `.env.production` is linked from the protected source checkout and is never copied into Git or logs.

## Deployment sequence

1. Read and validate the exact 40-character commit that triggered the GitHub
   Actions run.
2. Fetch `origin/main` without modifying the live source checkout and require
   that the triggering commit is still reachable from it.
3. Export the target Git tree into a temporary release directory.
4. Link the existing protected `.env.production`.
5. Run:

```bash
npm ci --no-audit --no-fund
npm run verify:truth
npm run lint
npm run test:operations
NEXT_DEPLOYMENT_ID="$RELEASE_COMMIT" npm run build
```

6. Verify that the resulting Next.js server metadata contains the exact
   40-character release commit as its deployment identifier. This activates
   Next.js version-skew protection for the rolling transition.
7. Validate Next.js build metadata and nginx configuration.
8. Read the current PM2 working directory and current live release commit.
9. Start a private, temporary public availability probe against `/api/version`.
10. Atomically point `/var/www/fanmind-current` at the built release.
11. Reload the single PM2 cluster worker through the stable symlink. PM2 starts
   the replacement worker before draining the old worker.
12. Verify that exactly one `fanmind` process is online in `cluster_mode`, uses
    the stable symlink as `pm_cwd`, and carries the exact release commit.
13. Test `/login` and the full public smoke suite.
14. Stop the availability probe and require at least two successful samples
    with no non-`200` response during the switch. The probe stores only HTTP
    status codes in a mode-`0600` temporary file and deletes it on exit.
15. On failure, restore the previous symlink target and release commit through
    the same rolling mechanism. The old legacy start remains only as a
    fail-safe fallback.
16. After a successful smoke test, synchronize `/var/www/fanmind` to the deployed commit.
17. Retain a limited number of release directories.

## Safety properties

- The old application remains available throughout dependency installation,
  build and every steady-state release switch.
- Production keeps one steady-state Next.js worker. PM2 briefly overlaps the
  old and new worker only while reloading, so nginx never loses its upstream.
- The one-time transition from the legacy fork process to the rolling cluster
  contract may still require a controlled delete/start. Every later isolated
  deploy is required to use `pm2 reload` without deleting the live process.
- Next.js receives up to 30 seconds to drain in-flight requests, matching its
  documented graceful-shutdown guidance.
- Each build uses the release commit as its Next.js deployment identifier, so
  browsers detect version skew during the rolling overlap and perform a hard
  navigation instead of mixing incompatible client navigation responses.
- A release is rejected and rolled back if the public transition probe sees
  any non-`200` response. The probe records neither bodies nor URLs, cookies,
  headers, tokens or other request data.
- The target is always the immutable commit that triggered the workflow. A
  later `main` update cannot silently replace it; the target must remain
  reachable from `origin/main` immediately before building.
- The new PM2 process starts only from a completed release directory.
- Login and public route checks must succeed before the release is accepted.
- Unexpected failures after the PM2 switch trigger rollback through the EXIT trap.
- Release cleanup is restricted to direct children of the configured release root.
- The active and immediately previous PM2 working directories are not removed.
- No database migration, Stripe change, secret change or referral activation is performed.
- The current-release symlink is updated atomically with the privileges required for root-managed `/var/www`.

## Production verification

After a deployment, verify:

```bash
pm2 status
pm2 jlist | node -e '
let b="";process.stdin.on("data",c=>b+=c);process.stdin.on("end",()=>{
 const p=JSON.parse(b).find(x=>x.name==="fanmind");
 console.log(p?.pm2_env?.pm_cwd ?? "unknown");
});'
curl -fsS https://fanmind.ch/api/version
curl -fsS -o /dev/null -w 'LOGIN_HTTP=%{http_code}\n' https://fanmind.ch/login
sudo nginx -t
```

Expected PM2 path:

```text
/var/www/fanmind-current
```

Expected PM2 mode: `cluster_mode`, one online process, with
`FANMIND_RELEASE_COMMIT` equal to `/api/version`.

## Disable or return to legacy deployment

Set:

```text
FANMIND_ENABLE_ISOLATED_RELEASE_DEPLOY=false
```

The next deployment uses the existing in-place path. This does not immediately move a currently running isolated release; the next successful legacy deployment restarts PM2 from `/var/www/fanmind`.

## Manual emergency rollback

The deployment script automatically rolls back if the new release fails health or smoke checks. For manual intervention, identify a known-good retained release and its commit before changing PM2.

Do not guess a path. Confirm the directory contains `package.json` and `.next/required-server-files.json`, then use the documented PM2 start pattern. After rollback, verify `/api/version`, `/login`, nginx and PM2.

## Retention

Production retains four release directories. The active and previous working directories are protected even if this temporarily exceeds the requested count. Retention applies only after a successful release.


## ChatAdmin: stärkeres Modell — 14. Oktober 2026

Der Owner hat ein stärkeres Modell für bessere ChatAdmin-Antworten freigegeben.
Die ChatAdmin-Route verwendet dafür das bestehende serverseitige Profil
„Premium“ aus dem versionierten Provider-Katalog, einschließlich dessen
Reasoning- und Standard-Verarbeitungswerten. Dies aktiviert keine allgemeinen
bezahlten KI-Stufen, Entitlements oder andere CRM-KI-Pfade. Character-Stimme,
Fanwissen, manuelle Versandgrenze und Preiswächter bleiben unverändert.

Das gemeinsame Tokenlimit beträgt 8192 einschließlich Reasoning; die bestehenden
kurzen Antwort- und Kontextgrenzen bleiben wirksam. Die Provider-Wartefrist ist
auf 45 Sekunden begrenzt. Usage verwendet tatsächliche Provider-Tokens inklusive
Reasoning und Cache sowie den vorhandenen USD-Preiskatalog für diesen ChatAdmin-
Pfad. Fehlende Provider-Usage bleibt als Schätzung erkennbar.

Vor dem Live-Wechsel prüft der geschützte isolierte Release-Weg den bestehenden
Serverzugang durch genau eine begrenzte synthetische Responses-Anfrage mit
store=false. Modellbindung, vollständiges Ergebnis, drei Antworten und Preiswächter
müssen bestehen; sonst bleibt der bisherige Release aktiv. Es gibt keinen stillen
Modell-Fallback. Keine Fan-/Character-Daten werden für diese Probe gelesen oder
geschrieben und keine Provider-Inhalte oder Schlüssel protokolliert. Ein erfolgreicher
Probeaufruf belegt API-Zugang und Antwortvertrag, keine allgemeine Qualitätsabnahme.
Echte Natürlichkeit und Gedächtniswirkung sind anschließend manuell zu beurteilen.
