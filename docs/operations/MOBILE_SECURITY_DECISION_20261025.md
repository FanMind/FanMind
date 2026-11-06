# Mobile Security Findings for PR #1355

Status: `OWNER_DECISION_REQUIRED`. This record reviews exact PR #1355 head `47c4f437a98ddc4b7990de8195af54c08223da29` and prepares a separate corrective change. It neither accepts risk nor extends the existing exception.

## Evidence

- Supply Chain run `40205047818`; audit generated `2026-10-25T15:02:58.686Z`.
- Audit artifact `fanmind-dependency-audit-report`: `sha256:641f5040512c64214cef20990bcfb87c681eef5a602d44fa78ea3ee4de0916c9`.
- SBOM artifact `fanmind-cyclonedx-sbom`: `sha256:0be9c9fd8462ade875f472dbf356ad7d10ab40093d0806b3cf377e56c482ab2c`.
- Before correction: root 0; Mobile 0 critical, 6 high, 4 moderate, 0 low.
- Existing exception expires `2026-11-08T12:40:47Z`; this timestamp and the review timestamp remain unchanged.

npm reports vulnerable package nodes, so one advisory can propagate into multiple findings.

## Findings

| ID | Node | Advisory and impact | Actual reachability | Fix / countermeasure / residual risk |
| --- | --- | --- | --- | --- |
| H1 | `node-forge@1.4.0` | `GHSA-86w9-cpqp-85rv`, `CVE-2026-85393`: forged RSA PKCS#1 v1.5 signatures with low-exponent keys. | Expo CLI/code-signing tool path only; no FanMind import or configured Expo update-signing path. Requires attacker-influenced verification material. | Affected `<=1.4.0`; no patch. Restrict tooling inputs to trusted repository/CI material. Integrity risk remains. |
| H2 | `@expo/code-signing-certificates@0.0.6` | Inherits H1 through `node-forge`. | CLI certificate helper under `@expo/cli`; not shipped application code. | Declares `node-forge ^1.3.3`; no patched target. Avoid code-signing/provider execution for this candidate. Inherited risk remains. |
| H3 | `@expo/cli@57.0.32` | Inherits H1 directly and through H2. | Used by Expo start/export/run; build/development path, not a native bundle import. | Current SDK-57 CLI retains affected forge. No unsupported override. Build/signing integrity risk remains. |
| H4 | `expo@57.0.31` | Inherits H1 through H3. | Direct framework dependency, but vulnerable code is in its CLI dependency. No on-device path was found. | Current SDK-57 release; SDK 58 is a platform upgrade. Keep trusted build inputs. Transitive tooling risk remains. |
| H5 | `zod@3.25.76` | `GHSA-mrhx-c7xc-m3w5`, `CVE-2023-54404`: oversized failing collections can exhaust memory. | Only under `@expo/cli`; no FanMind Mobile import. Requires malicious oversized data to reach an affected CLI schema. | Affected `<4.6.6`; fixed `4.6.6`, outside CLI's `^3.25.76` major line. Bound CLI/config inputs and resources; availability risk remains. |
| H6 | `image-size@1.2.1` | `GHSA-w3rx-r6r6-pgpr` / `CVE-2025-71330` and `GHSA-5p2g-fcmc-qvqq` / `CVE-2025-71329`: infinite-loop DoS. | Build-only under `metro@0.84.4`. Metro's normal asset list excludes ICNS/JXL/HEIF; no untrusted build assets found. | Fixed by `image-size@2.0.3`, outside Metro's 1.x range. Correction uses range-compatible Metro 0.84.5, which removes `image-size`. Expected residual risk: none after verification. |
| M1 | `decode-uri-component@0.2.2` | `GHSA-vcc3-ghjq-m6fr`, `CVE-2026-45822`: exponential CPU DoS on malformed percent encoding. | Runtime reachable through external Expo Router URLs. | Affected `<=0.4.2`; fixed `0.5.0`, outside the parent range. FanMind caps recovery URLs at 8192 bytes, but Router may parse first. Availability risk remains. |
| M2 | `query-string@7.1.3` | Inherits M1. | Direct Expo Router dependency used for navigation query data; runtime reachable. | Declares decoder `^0.2.2`. Do not force an incompatible decoder/query-string major. Vendor-compatible upgrade plus malformed-link tests required. Risk remains. |
| M3 | `expo-router@57.0.29` | Inherits M1 through M2. | Direct app entry point and navigation API; external links and route parameters are runtime inputs. | No compatible SDK-57 patch removed this chain at review time; SDK 58 is a platform upgrade. Existing scheme/route/length validation is partial mitigation only. Risk remains. |
| M4 | `uuid@7.0.3` | `GHSA-w5hq-g745-h8pq`, `CVE-2026-41907`: v3/v5/v6 buffer APIs can silently partially write. | No parent edge, no FanMind import, absent from exact Mobile SBOM: lockfile-only orphan. | Fixed in `11.1.1`, `12.0.1`, `13.0.1`. Correction removes the orphan. Expected residual risk: none after verification. |

## Corrective candidate

The correction is stacked on PR #1355 and does not change its reviewed head.

- Hoist the complete Metro/ob1 suite from 0.84.4 to the already locked 0.84.5 patch level.
- Remove now unreachable `image-size`, `queue`, and orphan `uuid`.
- Contract the policy from 6 high / 4 moderate to 5 high / 3 moderate and remove only `image-size` and `uuid` from the reviewed set.
- Do not change `MOBILE_REVIEWED_AT` or `MOBILE_REVIEW_EXPIRES_AT`.

Expected after correction: 0 critical, 5 high, 3 moderate, 0 low, exactly eight reviewed package nodes. This is evidence only after fresh exact-head audit/SBOM, full CI, and independent review.

## Human decision

After those checks, an authorized human must bind exactly one outcome to the unchanged corrective head:

- [ ] `REQUIRE_FURTHER_REMEDIATION`
- [ ] `ACCEPT_RESIDUAL_UNTIL_EXISTING_EXPIRY` for H1-H5 and M1-M3 only, ending `2026-11-08T12:40:47Z`
- [ ] `REJECT`

The external record must state decider/role, timestamp, exact correction head, audit/SBOM runs and digests, rationale, follow-up owner, and due date. Any head change invalidates CI, review, and the decision. No outcome here authorizes merge, deployment, signing, provider access, schema action, feature activation, or Production mutation.
