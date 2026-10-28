# Mobile dependency consolidation receipt — 26 October 2026

Status: **RELEASED_FOR_PR**
Risk: **R3 / repository-only dependency reconciliation**
Task: `FM-MOBILE-DEPENDENCY-CONSOLIDATION-20261026`
Base: `ab7b9dd0a3d8061b771740bc202892f2c225cc61`
Sources: **#1362-#1366**

## Compatibility decision

FanMind is on Expo SDK 57, React Native 0.86.3 and React 19.2.3. Expo's
canonical SDK 57 bundle requires Notifications 57.0.24, Reanimated 4.5.1,
Safe Area 5.7.x, Screens 4.26.x, React Native Web 0.21.x and Worklets 0.10.1.

Only #1362 is admissible without changing the SDK:

- #1362: integrate the already-declared `react-native-web ~0.21.0` lock
  resolution 0.21.2 -> 0.21.4. Its original Mobile CI and both native builds
  passed.
- #1363: exclude Worklets 0.13.0. Reanimated 4.5.1 requires Worklets 0.10.x;
  npm reproducible install fails with ERESOLVE.
- #1364: exclude Notifications 58.1.6. It is the SDK 58 bundle version; SDK 57
  Expo Doctor fails, Android autolinking rejects its publication metadata and
  iOS compilation fails against mixed Expo module APIs.
- #1365: exclude Safe Area 5.10.1. It is the SDK 58 bundle version and fails
  SDK 57 Expo Doctor.
- #1366: exclude Screens 4.30.0. It is the SDK 58 bundle version and fails
  SDK 57 Expo Doctor.

No force, legacy-peer mode, Doctor suppression or dependency-validation
exclusion is used. The SDK 58 updates require a separately bounded Expo SDK 58
upgrade task rather than piecemeal admission into SDK 57.

## Minimal diff and controlled sources

The Mobile lockfile changes only the `react-native-web` version, tarball URL and
integrity. Npm-generated Sharp key-order/nesting churn from the Dependabot source
is deliberately excluded.

`apps/mobile/package.json`, root `package.json`, the Capacity manifest,
all 18 Capacity-controlled sources, workflows, native configuration and
application code remain byte-identical. The Owner's conditional Capacity
rebaseline authorization is therefore not consumed.

## CI history and required verification

Historical source checks establish:

- #1362: Mobile CI and Android/iOS native CI successful; only Project Memory
  Guard failed because the bot PR had no required R3 task record.
- #1363: reproducible install failure propagates to Mobile, native, CodeQL and
  Supply Chain.
- #1364: Expo Doctor plus both native platforms fail from the SDK mismatch.
- #1365/#1366: Expo Doctor rejects the SDK 58 package versions.
- Project Memory Guard failed on all five bot PRs because they lacked the
  mandatory meaningful-change record; this integration supplies Started Work,
  Lock and this receipt.

Merge requires fresh exact-head Mobile and native builds, Browser E2E, full
FanMind CI including PostgreSQL 17/Capacity, CodeQL, Supply Chain, Project
Memory/God Mode and an independent R3 countercheck.

## Recovery and boundary

Recovery is a separately reviewed repository revert of the single Mobile
lockfile resolution and these evidence records. No database, provider, signing,
Store, Staging/Production activation or deployment action is included.

2026-10-28 — Project status: `FM-MOBILE-DEPENDENCY-CONSOLIDATION-20261026` is merged and independently counterchecked; the earlier `RELEASED_FOR_PR` labels are the historical pre-merge state. Evidence: PR #1376 head `98d38adb2ad730f388eecd83a6a41582ae4d08ee` passed all 11 required workflows and merged unchanged as main `832c1f8b452586c1206d1868e2188fc0959a3778`; the independent R3 review returned PASS.
