# Legacy Issue Reconciliation

Canonical, machine-validated mapping for historical issues #642, #643 and #644. The active finishline remains #874. This document prevents unchecked historical items from being mistaken for a zero-state while retaining every unproved gate.

- Reconciled: 2026-08-30
- Task/change: FM-MEM-009 / FM-CR-008
- Master issue: #874

| Issue | Disposition | Historical checkboxes | Result |
| --- | --- | ---: | --- |
| #642 | `KEEP_OPEN_RECONCILED` | 0 checked / 23 unchecked | Staging infrastructure and the rollback-only Referral lifecycle are proven, but provider-real payment semantics, several combined negative cases, Legal/Tax and explicit Production activation remain genuine gates. |
| #643 | `KEEP_OPEN_RECONCILED` | 27 checked / 9 unchecked | The isolated Staging base and bounded read-only login/contact/admin paths are proven. Token tampering and the complete read/write/export/AI/PDF tenant-negative matrix remain explicit acceptance work. |
| #644 | `CLOSE_SUPERSEDED` | 54 checked / 14 unchecked | This historical P1 umbrella no longer owns execution. Every formerly unchecked item is accepted, partially accepted with a named current gate, or transferred to #874/its canonical task. |

## Evidence index

- `STAGING_MILESTONE`: project-memory/milestones/STAGING_ACCEPTED_2026-08-19.json — commit `cdf4a59517b5ea1c34e672b207878b95145d2d01`.
- `ADMIN_STAGING_RUN`: https://github.com/FanMind/FanMind/actions/runs/31837057323 — commit `30213663382d9ef21214027b39667b8721beb598`, conclusion `success`.
- `REFERRAL_STAGING_RUN`: https://github.com/FanMind/FanMind/actions/runs/31895476403 — commit `b13ac3bceacdfefeb8a22bc060422f1b4e3dcff9`, conclusion `success`.
- `MOBILE_AAB_EVIDENCE`: FM-EV-028 — commit `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`.
- `MOBILE_REDIRECT_EVIDENCE`: FM-EV-029 — commit `3082490451dd45b5127bdf9d9ae55b4712255b72`.
- `MOBILE_DEVICE_EVIDENCE`: FM-EV-027 — commit `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`.

## Issue #642

Staging infrastructure and the rollback-only Referral lifecycle are proven, but provider-real payment semantics, several combined negative cases, Legal/Tax and explicit Production activation remain genuine gates.

Target GitHub state: `open`; successor: #874.

### Formerly unchecked items

- `ACCEPTED` — separates Supabase-Staging-Projekt bereitstellen — evidence `STAGING_MILESTONE`
- `ACCEPTED` — Stripe Test Mode mit eigenen Testprodukten/-preisen bereitstellen — evidence `STAGING_MILESTONE`
- `ACCEPTED` — eigene Staging-Webhooks und Signing Secrets konfigurieren — evidence `STAGING_MILESTONE`
- `ACCEPTED` — eindeutige Staging-/Test-Environment-Marker setzen — evidence `STAGING_MILESTONE`, `REFERRAL_STAGING_RUN`
- `ACCEPTED` — ausschließlich synthetische Test-Workspaces und Testkontakte verwenden — evidence `STAGING_MILESTONE`, `REFERRAL_STAGING_RUN`
- `RETAINED_GATE` — Referral-Teilnahmebedingungen steuerlich und rechtlich freigeben — retained as `REFERRAL_LEGAL_TAX`
- `ACCEPTED` — eindeutige Attribution prüfen — evidence `REFERRAL_STAGING_RUN`
- `ACCEPTED` — Self-Referral sicher ablehnen — evidence `REFERRAL_STAGING_RUN`
- `ACCEPTED` — gültige Zuordnung nach Aktivierung nicht unkontrolliert wechseln lassen — evidence `REFERRAL_STAGING_RUN`
- `PARTIAL` — erfolgreiche Testzahlung aktiviert das Referral nach der freigegebenen Regel — evidence `REFERRAL_STAGING_RUN`; retained as `REFERRAL_PROVIDER_REAL_PAYMENT`
- `ACCEPTED` — Kündigung und dauerhafter Zahlungsausfall deaktivieren das Referral — evidence `REFERRAL_STAGING_RUN`
- `PARTIAL` — Refund und Chargeback deaktivieren das Referral — evidence `REFERRAL_STAGING_RUN`; retained as `REFERRAL_CHARGEBACK`
- `ACCEPTED` — Reaktivierung kann ein zulässiges Referral wieder aktivieren — evidence `REFERRAL_STAGING_RUN`
- `PARTIAL` — vor dem Rechnungslauf Rabatt neu berechnen und als unveränderlichen Snapshot speichern — evidence `REFERRAL_STAGING_RUN`; retained as `REFERRAL_SNAPSHOT_IMMUTABILITY`
- `PARTIAL` — Setup-Gebühr und KI-Add-ons bleiben unberührt — evidence `REFERRAL_STAGING_RUN`; retained as `REFERRAL_AI_ADDON_ISOLATION`
- `ACCEPTED` — 20-Referral-/100-%-Grenze und kein negativer Rechnungsbetrag bestätigen — evidence `REFERRAL_STAGING_RUN`
- `PARTIAL` — Growth Window schließt beim 2.000. aktiven zahlenden Workspace transaktional — evidence `REFERRAL_STAGING_RUN`; retained as `REFERRAL_EXACT_2000_BOUNDARY`
- `RETAINED_GATE` — Webhook-, Reconciliation- und Admin-Korrekturpfade vollständig dokumentieren — retained as `REFERRAL_OPERATOR_PATHS`
- `ACCEPTED` — vollständiges Testprotokoll anhängen — evidence `REFERRAL_STAGING_RUN`
- `RETAINED_GATE` — Security-/RLS-Prüfung ohne Production-Schreibzugriff abschließen — retained as `REFERRAL_SECURITY_RLS`
- `RETAINED_GATE` — Rechts-/Steuerfreigabe referenzieren — retained as `REFERRAL_LEGAL_TAX`
- `PARTIAL` — Rollback-/Deaktivierungsplan dokumentieren — evidence `REFERRAL_STAGING_RUN`; retained as `REFERRAL_PRODUCTION_ROLLBACK_PLAN`
- `RETAINED_GATE` — erst danach separate Production-Aktivierung ausdrücklich entscheiden — retained as `REFERRAL_PRODUCTION_ACTIVATION`

### Genuine retained/successor gates

- `REFERRAL_LEGAL_TAX`
- `REFERRAL_PROVIDER_REAL_PAYMENT`
- `REFERRAL_CHARGEBACK`
- `REFERRAL_SNAPSHOT_IMMUTABILITY`
- `REFERRAL_AI_ADDON_ISOLATION`
- `REFERRAL_EXACT_2000_BOUNDARY`
- `REFERRAL_OPERATOR_PATHS`
- `REFERRAL_SECURITY_RLS`
- `REFERRAL_PRODUCTION_ROLLBACK_PLAN`
- `REFERRAL_PRODUCTION_ACTIVATION`

## Issue #643

The isolated Staging base and bounded read-only login/contact/admin paths are proven. Token tampering and the complete read/write/export/AI/PDF tenant-negative matrix remain explicit acceptance work.

Target GitHub state: `open`; successor: #874.

### Formerly unchecked items

- `PARTIAL` — `npm run staging:preflight` und Workflow `FanMind Staging Readiness` gegen die echten Staging-Ressourcen grün ausführen — evidence `STAGING_MILESTONE`; retained as `STAGING_PREFLIGHT_RUN_REFERENCE`
- `RETAINED_GATE` — abgelaufene oder manipulierte Tokens werden fail-closed abgelehnt — retained as `STAGING_TOKEN_NEGATIVE`
- `PARTIAL` — Nutzer A kann Kontakte, Kontaktwissen, Follow-ups, Nachrichten und Rechnungen des eigenen Workspaces lesen — evidence `ADMIN_STAGING_RUN`; retained as `STAGING_OWN_RESOURCE_MATRIX`
- `RETAINED_GATE` — Mutationen auf Ressourcen aus Workspace B werden serverseitig abgelehnt — retained as `STAGING_CROSS_TENANT_MUTATION_NEGATIVE`
- `RETAINED_GATE` — Listen, Zähler, Suche, Exporte und KI-Endpunkte bleiben workspace-gebunden — retained as `STAGING_DERIVED_RESOURCE_MATRIX`
- `RETAINED_GATE` — PDF-Datenauskunft enthält ausschließlich den autorisierten Workspace — retained as `STAGING_PDF_TENANT_BOUNDARY`
- `RETAINED_GATE` — RLS- und serverseitige Autorisierungsfehler erzeugen keine Secret- oder Datenlecks — retained as `STAGING_ERROR_LEAK_NEGATIVE`
- `RETAINED_GATE` — keine frei eingebbare Shell-, Restore- oder Secret-Ausgabe im Browser — retained as `STAGING_ADMIN_DANGEROUS_INPUT_NEGATIVE`
- `SUPERSEDED_PROCEDURE` — nur tatsächlich gefundene Fehler in kleinen Folge-PRs beheben — evidence `STAGING_MILESTONE`

### Genuine retained/successor gates

- `STAGING_PREFLIGHT_RUN_REFERENCE`
- `STAGING_TOKEN_NEGATIVE`
- `STAGING_OWN_RESOURCE_MATRIX`
- `STAGING_CROSS_TENANT_MUTATION_NEGATIVE`
- `STAGING_DERIVED_RESOURCE_MATRIX`
- `STAGING_PDF_TENANT_BOUNDARY`
- `STAGING_ERROR_LEAK_NEGATIVE`
- `STAGING_ADMIN_DANGEROUS_INPUT_NEGATIVE`

## Issue #644

This historical P1 umbrella no longer owns execution. Every formerly unchecked item is accepted, partially accepted with a named current gate, or transferred to #874/its canonical task.

Target GitHub state: `closed`; successor: #874.

### Formerly unchecked items

- `TRANSFERRED` — isolierten Restore-Drill ausschließlich in einer getrennten Testumgebung vorbereiten und durchführen — retained as `874_GATE_2_RESTORE`
- `ACCEPTED` — separates HTTPS-Staging bereitstellen — evidence `STAGING_MILESTONE`
- `ACCEPTED` — separates Supabase-Staging-Projekt — evidence `STAGING_MILESTONE`
- `ACCEPTED` — Stripe Test Mode mit separaten Produkten, Preisen und Webhooks — evidence `STAGING_MILESTONE`
- `ACCEPTED` — zwei synthetische Nutzer in zwei getrennten Workspaces — evidence `STAGING_MILESTONE`, `ADMIN_STAGING_RUN`
- `PARTIAL` — Session-, Workspace-/RLS- und Admin-Negativtests — evidence `ADMIN_STAGING_RUN`; retained as `ISSUE_643_RETAINED_NEGATIVES`
- `ACCEPTED` — Referral-Lifecycle ausschließlich im Staging — evidence `REFERRAL_STAGING_RUN`
- `ACCEPTED` — keine Production-Secrets oder echten Kundendaten in den externen Staging-Ressourcen — evidence `STAGING_MILESTONE`, `ADMIN_STAGING_RUN`, `REFERRAL_STAGING_RUN`
- `ACCEPTED` — Supabase-Redirect `fanmind://reset-password` im eindeutig geprüften Projekt extern freigeben — evidence `MOBILE_REDIRECT_EVIDENCE`
- `TRANSFERRED` — echten Recovery-E-Mail-/Gerätetest durchführen — retained as `874_GATE_3_ANDROID_ACCEPTANCE`
- `ACCEPTED` — EAS-Projekt und Signing Credentials extern einrichten — evidence `MOBILE_AAB_EVIDENCE`
- `ACCEPTED` — signierten internen Android-Build durchführen — evidence `MOBILE_AAB_EVIDENCE`
- `TRANSFERRED` — iOS-TestFlight erst mit Apple-Developer-/App-Store-Connect-Konto durchführen — retained as `PHASE_8_IOS`
- `PARTIAL` — reale Android-/iOS-Gerätetests dokumentieren — evidence `MOBILE_DEVICE_EVIDENCE`; retained as `874_GATE_3_ANDROID_ACCEPTANCE_AND_PHASE_8_IOS`

### Genuine retained/successor gates

- `874_GATE_2_RESTORE`
- `ISSUE_643_RETAINED_NEGATIVES`
- `874_GATE_3_ANDROID_ACCEPTANCE`
- `PHASE_8_IOS`
- `874_GATE_3_ANDROID_ACCEPTANCE_AND_PHASE_8_IOS`

## Safety boundary

This reconciliation changes governance and GitHub issue metadata only. It does not authorize a Production/Stripe/database/provider mutation, a payment, a Mobile build, iOS Phase 8, legal acceptance or completion of any retained gate.
