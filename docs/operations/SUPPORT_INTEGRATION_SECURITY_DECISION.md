# Support Integration Security Decision

Status: `OWNER_ACCEPTED_UNTIL_EXISTING_EXPIRY` for the eight residual Mobile findings on reviewed head `4b4e5edd97842aa79225b2a8052f954f85667f57`. The acceptance ends at `2026-11-08T12:40:47Z`; this record does not renew it.

## Binding evidence

- Owner decision: PR #1356 comment `6400882068`, recorded before merge.
- Independent review: PR #1356 comment `6400804857`, P0/P1/P2/P3 = 0/0/0/0.
- Reviewed head: `4b4e5edd97842aa79225b2a8052f954f85667f57`.
- Merge: `7368305db778165d6a6dd8f83265445a6863a25b`.
- Merge tree and reviewed-head tree: `ce4c21b994a15e4b21ee363cd408ecd33b8128a7`; the compare contains zero changed files.
- Exact-head audit/SBOM digests: `sha256:0231b0f105c24ecbfece0f798da61ca70fb6bd6dc0db30350a8f4ae077858949` and `sha256:f94bd89d81548edcfe87146a2fcf8c7d539418a9144d2f9e4044441f078148f4`.
- Post-merge audit/SBOM digests: `sha256:9a83fc3c2f2d33724a25bc6a902f5429ed76445a75350c45ef13e80224bbad9a` and `sha256:d0eeb3ba608b9222b051bfb521f4f65b743d8311aa6f14e039d9455d79dd577e`.
- Current result: root zero; Mobile 0 critical, 5 high, 3 moderate, 0 low; no unknown package and no audit error.

## Residual findings

| ID | Severity | Package node | Reachability and effect | Current supported fix / countermeasure | Residual risk |
| --- | --- | --- | --- | --- | --- |
| H1 | High | `node-forge@1.4.0` | Expo CLI/code-signing tooling; no FanMind import or native bundle path. Attacker-influenced verification material could affect RSA signature integrity. | `GHSA-86w9-cpqp-85rv` / `CVE-2026-85393` affects `<=1.4.0`; no patched release is available. Trust repository/CI inputs and do not execute signing/provider flows under this exception. | Tooling/signature integrity remains. |
| H2 | High | `@expo/code-signing-certificates@0.0.6` | Inherits H1 in the CLI certificate helper; not shipped application code. | No compatible patched forge target in the installed line. Keep signing disabled and inputs trusted. | Inherited H1 remains. |
| H3 | High | `@expo/cli@57.0.32` | Build/development commands, not a native runtime import; inherits H1 directly and through H2. | No supported SDK-57 fix. Do not force an unsupported override. | Build-tool integrity remains. |
| H4 | High | `expo@57.0.31` | Direct framework package; the vulnerable path is its CLI dependency, not an on-device import. | Upgrade evaluation must be an isolated Expo SDK task. Trusted build inputs remain mandatory. | Transitive H1 remains. |
| H5 | High | `zod@3.25.76` | Only below `@expo/cli`; oversized invalid CLI/config collections could exhaust memory. No FanMind Mobile import exists. | `GHSA-mrhx-c7xc-m3w5` / `CVE-2023-54404` is fixed in Zod 4.6.6, outside Expo CLI's declared Zod 3 range. Bound input size/resources; do not force the major. | CLI availability remains. |
| M1 | Moderate | `decode-uri-component@0.2.2` | Runtime-adjacent via external Expo Router URLs; malformed percent encoding can consume CPU. | `GHSA-vcc3-ghjq-m6fr` / `CVE-2026-45822` is fixed in 0.5.0, outside the current parent range. Keep URL-length validation; Router may parse before the app guard. | Runtime availability remains. |
| M2 | Moderate | `query-string@7.1.3` | Expo Router navigation query dependency; inherits M1. | Do not force an incompatible decoder/query-string major. | Inherited M1 remains. |
| M3 | Moderate | `expo-router@57.0.29` | Direct application entry/navigation path; external links and route parameters are runtime inputs. | Official Expo SDK 58 Router source no longer declares `query-string`; validate through a complete SDK-58 migration and malformed-link regressions. | Remains until a verified migration removes the chain. |

The previously reviewed H6 `image-size` and M4 orphan `uuid` findings were removed in PR #1356. The post-merge SBOM confirms both are absent.

## Supported remediation path

High findings have priority, but no supported immediate closure exists as of 2026-10-25:

- Expo SDK 58 is released and the official guide requires an incremental upgrade, `npx expo install --fix`, `npx expo-doctor`, native-project regeneration or upgrade-helper changes, and the SDK release notes.
- Expo SDK 58 moves the supported platform to React Native 0.88 and React 19.3. Its CLI source still declares `node-forge ^1.4.0`, `@expo/code-signing-certificates ^0.0.7` and `zod ^3.25.76`; the certificate package also declares `node-forge ^1.4.0`. Therefore SDK 58 alone does not prove H1-H5 fixed.
- Expo Router 58 no longer declares `query-string`; a verified SDK-58 upgrade is the supported candidate for removing M1-M3.
- Any SDK-58 change must use a separate branch and receive a fresh audit/SBOM, Mobile CI, Mobile Native CI, Android/iOS export and prebuild checks, deep-link and malformed-percent regressions, full repository CI and independent R3 review.
- Monitor Expo, `@expo/code-signing-certificates`, node-forge and Zod for a compatible high-severity fix. When one exists, prefer the smallest vendor-supported update. A forced Zod 4 or unreviewed forge patch is not approved.

Primary references: [Expo SDK upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [Expo SDK 58 version matrix](https://docs.expo.dev/versions/v58.0.0/), [Expo CLI dependency manifest](https://github.com/expo/expo/blob/main/packages/%40expo/cli/package.json), [Expo Router dependency manifest](https://github.com/expo/expo/blob/main/packages/expo-router/package.json), and [Expo code-signing certificate manifest](https://github.com/expo/code-signing-certificates/blob/main/package.json).

## Mandatory re-evaluation

Before `2026-11-08T12:40:47Z`, Security must review a fresh exact-head audit and SBOM, vendor fix availability, actual dependency paths, reachability, relevant regression evidence and the then-current release candidate. Changing only timestamps or thresholds is forbidden. The current acceptance does not survive the deadline and does not authorize deployment, schema APPLY, feature activation, provider access, signing, store release, Production work or customer-data changes.
