# FanMind Mobile

Eigenständige FanMind-App für Android und iOS auf Basis von React Native und Expo.

## Architekturgrenze

Diese App ist **keine umverpackte Website**:

- kein WebView als Haupt-App;
- kein Import aus `src/app`, `src/components` oder Website-CSS;
- eigene Expo-Router-Navigation;
- eigene mobile UI-Komponenten und Design-Tokens;
- eigene Paketverwaltung, eigene Releases und eigene Mobile-CI;
- eigene Android-/iOS-App-IDs und Releaseprofile.

Gemeinsam mit der Web-Anwendung bleiben ausschließlich:

- das Supabase-Projekt und dessen RLS-Regeln;
- freigegebene Tabellen und Geschäftslogik;
- die serverseitige FanMind-KI-API;
- die Produktwahrheit: Mensch prüft und sendet final selbst.

## Aktueller App-Kern

- native E-Mail-/Passwort-Anmeldung;
- verschlüsselte, in Chunks gespeicherte Supabase-Sitzung über `expo-secure-store`;
- PKCE-basierte Passwort-Recovery über `fanmind://reset-password`;
- geschützte App-Navigation;
- Dashboard mit Kontakt- und Follow-up-Kennzahlen;
- Kontaktliste und Suche;
- Kontakt als Workspace-Owner in Mobile anlegen und bearbeiten; Teammitglieder sehen CRM-Daten nur lesend;
- Kontaktdetail mit Profil, Kontaktwissen und einem sichtbaren, read-only
  Gesprächsverlauf aus bis zu 100 aktuellen, per Workspace und Kontakt
  gefilterten Nachrichten; neueste Nachrichten erscheinen zuerst und der
  Verlauf lässt sich sichtbar aktualisieren;
- KI-Antwortvorschläge über Bearer-authentifizierte FanMind-API;
- gespeicherter Gesprächsverlauf ausschließlich serverseitig aus dem
  autorisierten Workspace; die App sendet keinen frei eingefügten
  Verlaufsblock. Die effektive KI-Stufe begrenzt den Kontext auf 50/100/150
  aktuelle Nachrichten;
- serverseitig angewendeter Workspace-Unternehmens-Prompt und Standard-Antwortprofil; die Mobile-App überträgt keinen freien Prompttext;
- Antwortvorschläge kopieren oder über die native Android-/iOS-Teilen-Auswahl
  bewusst weitergeben; ausschließlich der ausgewählte Antworttext wird
  übergeben, Zielwahl und finaler Versand bleiben beim Menschen;
- Kontaktwissen aus KI-Vorschlag speichern;
- Follow-up als Owner aus KI-Vorschlag speichern;
- offene Follow-ups anzeigen und als Owner abschließen; Teammitglieder bleiben read-only;
- verschlüsselte, maximal 24 Stunden alte Offline-Kontaktübersicht mit höchstens 50 Einträgen im Nur-Lesen-Modus;
- native Push-Grundlage mit streng validierter Navigation zu Follow-ups sowie
  ausdrücklichem Opt-in für eine verschlüsselte, kontogebundene
  Ein-Gerät-Registrierung; ein getrenntes serverseitiges Staging-Modul für
  genau eine inhaltsfreie Follow-up-Erinnerung ist synthetisch getestet, aber
  ohne Route, Timer und persistenten Ledger deaktiviert;
- checksum-gebundener, strikt Staging-only Kontrollpfad für die vorbereitete
  Push-Tabelle: read-only Ressourcenprüfung, separat bestätigter Apply und
  rollback-only Acceptance ohne echte Tokens oder Zustellung; externe Läufe
  stehen noch aus;
- nativer Splashscreen mit der bestätigten FanMind-Wortmarke für das dunkle App-Theme;
- eigenständiges deckendes 1024×1024-App-Icon für iOS/Legacy-Android und
  transparentes, maskensicher skaliertes Android-Adaptive-Foreground;
- iOS-Privacy-Manifest mit den Required-Reason-APIs der installierten nativen
  Bibliotheken, ohne Tracking-Domains, sowie fail-closed Android-API-36-Prüfung;
- bewusst iPhone-only gehaltener erster iOS-Release; iPad bleibt bis zu einer
  separaten Layout-, Geräte- und Screenshot-Abnahme außerhalb des Beta-Scope;
- technische, noch extern zu prüfende Vorlagen für Apple App Privacy und
  Google Play Data Safety;
- sichere lokale Abmeldung mit Purge registrierter FanMind-SecureStore-Schlüssel und Workspace-Zustand.

## Sicherheitsgrenzen

Die App darf nur öffentliche Client-Konfiguration enthalten:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_FANMIND_API_URL
```

Verboten in App, EAS-Update und Repository:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `OPENAI_API_KEY`;
- Stripe Secret Keys;
- Webhook-Secrets;
- Production-Backup-Schlüssel;
- externe Social-Login-Daten.

Die Datenzugriffe laufen direkt über Supabase und müssen durch RLS auf den angemeldeten Nutzer beziehungsweise dessen Workspace begrenzt sein. Member laden den Workspace über die minimale Safe-RPC-Projektion und besitzen keine Mobile-CRM-Mutationscontrols. KI-Aufrufe gehen ausschließlich an den FanMind-Server; der OpenAI-Key bleibt serverseitig.

Recovery-Codes, Zugriffstokens, Refresh-Tokens und vollständige Callback-URLs dürfen weder protokolliert noch in Tickets oder Screenshots übernommen werden.

Die Offline-Übersicht wird ausschließlich nach einem erfolgreichen, ungefilterten Online-Abruf erneuert. Sie enthält nur User-/Workspace-Bindung, Workspace-Name sowie Kontakt-ID, Name, Handle, Plattform, Status und Änderungszeit. Kontaktwissen, Zusammenfassungen, Nachrichten, KI-Inhalte, interne Notizen, Follow-ups und Zugangsdaten sind ausgeschlossen. Ein Fallback ist nur bei einem echten Transportausfall erlaubt; Auth-, RLS- und Serverfehler dürfen nie mit Cache-Daten verdeckt werden.

## Lokale Einrichtung

```bash
cd apps/mobile
cp .env.example .env.local
npm ci
npm run check
npm run start:go
```

Für den aktuellen Expo-SDK-57-Stand muss auf Android die [offizielle Expo-Go-Version 57.0.2](https://github.com/expo/expo-go-releases/releases/tag/Expo-Go-57.0.2) installiert sein. Rechner und Telefon müssen im selben WLAN sein; anschließend wird der QR-Code aus dem Terminal mit Expo Go gescannt. Falls das lokale Netzwerk die Verbindung blockiert, kann nach Installation von `@expo/ngrok` mit `npx expo start --go --tunnel` gestartet werden. Ohne separates Staging darf dafür ausschließlich ein Testkonto verwendet werden.

Expo Go bleibt nur der begrenzte Vorabtest. Der normale Startbefehl zielt auf
den eigenen Development-Client:

```bash
npm run start
# identisch:
npm run start:dev-client
```

Der Development-Client enthält die echten nativen FanMind-Module und ist damit
die Grundlage für Push-, Deep-Link- und Store-nahe Tests. Nach Änderungen an
`app.json` oder nativen Abhängigkeiten wird die generierte Android- und
iOS-Konfiguration isoliert geprüft:

```bash
npm run native:prebuild:check
```

Mit lokal eingerichtetem Android Studio beziehungsweise Xcode kann anschließend
ohne Expo-Konto kompiliert werden:

```bash
npm run android
npm run ios
```

Der iOS-Befehl benötigt macOS und Xcode. Die generierten Verzeichnisse
`android/` und `ios/` werden bei diesem Continuous-Native-Generation-Ansatz
nicht committed.

Die getrennte Native-CI führt denselben CNG-Vertrag anschließend bis zur echten
Kompilierung weiter: ein Android-Debug-APK ohne Release-Credentials und eine
codesign-freie iOS-Simulator-App. Beide Artefakte sind ausdrücklich nur
Build-Nachweise, keine signierten Beta- oder Store-Pakete.

## Read-only EAS-Ressourcencheck

Vor dem ersten signierten Build ist ein eigener manueller GitHub-Workflow
vorbereitet: `FanMind Mobile Release Resource Readiness`. Er läuft nur von
`main` und bindet die Auswahl an ein geschütztes GitHub-Environment:

| Auswahl | GitHub-Environment |
|---|---|
| `development` | `mobile-development` |
| `preview` | `mobile-preview` |
| `production` | `mobile-production` |

Der Workflow verwendet die exakt gepinnte EAS CLI `21.2.0` ausschließlich für
`project:info` und `env:exec`. Er prüft die echte EAS-Owner-/Projektbindung,
beide nativen App-IDs, das Deep-Link-Schema sowie genau diese drei öffentlichen
EAS-Werte:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_FANMIND_API_URL
```

Development und Preview müssen von Production getrennte Supabase- und
API-Ziele verwenden; Production muss exakt auf die bestätigten
Production-Ziele zeigen. Die geschützten GitHub-Variablen für Owner und
Projekt-ID werden ausschließlich bei der Expo-Konfigurationsauswertung durch
`app.config.js` ergänzt; `app.json` bleibt frei von echten EAS-Bindungen.
Build, Submit und Update sind technisch ausgeschaltet, Signing Credentials
werden nicht geladen und konkrete Projekt-, URL- oder Key-Werte werden nicht
ausgegeben. Der vorbereitete Workflow zählt erst nach echter EAS-Einrichtung
und erfolgreichem externem Lauf als Nachweis.

## Staging-Kontrolle für Push-Registrierung

Die Datenbankvorbereitung der Push-Registrierung ist bewusst vom EAS- und
Signing-Ablauf getrennt. Drei manuelle Workflows sind vorbereitet:

1. `FanMind Mobile Push Staging Resource Readiness` prüft ausschließlich
   read-only den exakten, manuell bestätigten `main`-Commit, die getrennten
   Staging-Ziele und synthetische Nicht-Demo-Owner/-Member/-Geräte;
2. `FanMind Mobile Push Staging Migration` wendet nach eigener Bestätigung die
   checksum-festgeschriebene Migration nur auf Staging an;
3. `FanMind Mobile Push Staging Acceptance` prüft Browserverweigerung und
   service-role CRUD vollständig innerhalb einer zurückgerollten Transaktion.

Production-API, Production-Supabase und Production-DB-Host werden jeweils
fail-closed ausgeschlossen. Kein Workflow erzeugt ein Expo-Token, sendet eine
Push-Nachricht, aktiviert Delivery oder verändert EAS-/Signing-Ressourcen. Der
normale Web-Deploy kann die Migration nicht anwenden. Details und geschützte
Konfiguration: `docs/operations/MOBILE_PUSH_STAGING_CONTROL.md`.

Der nachgelagerte, weiterhin inaktive Serververtrag ist in
`docs/mobile/PUSH_DELIVERY.md` beschrieben. Er verlangt vor jedem Providerbyte
einen atomaren Idempotenz-Ledger, unabhängig geprüfte EAS-, Staging-App-,
Staging-Supabase- und Production-Supabase-Bindings, ein fälliges offenes
Follow-up und dieselbe User-/Workspace-/Kontaktgrenze. Der spätere Reserve-RPC
muss dasselbe validierte Supabase-Binding wie der Loader verwenden und alle
persistenten Grenzen einschließlich des aktuellen Token-Fingerprints in einer
Transaktion erneut prüfen; die feste Payload verfällt nach einer Stunde. Da das bestehende Schema keinen solchen
Ledger besitzt, gibt es keine Sendroute, keinen Timer und keinen realen
Expo-Aufruf. Eine CI-Invariante sperrt jede vorzeitige Verdrahtung.

## Kontrollierter signierter interner Build

Nach einem grünen Read-only-Ressourcencheck kann der getrennte manuelle
GitHub-Workflow `FanMind Mobile Signed Internal Build` genau einen Build
einreihen. Er läuft nur von `main`, akzeptiert ausschließlich
`development` oder `preview` sowie genau eine Plattform und verwendet dasselbe
geschützte `mobile-development`- beziehungsweise `mobile-preview`-Environment.

Vor dem Build wiederholt er Projekt- und Client-Umgebungsprüfung. Der EAS-Aufruf
ist nicht interaktiv, verwendet die gepinnte CLI `21.2.0`, setzt
`--freeze-credentials`, reiht den Cloud-Build zunächst mit `--no-wait` ein und
schreibt alle JSON-Antworten nur in temporäre, anschließend gelöschte Dateien.
Danach fragt derselbe Ablauf den Build mit dem read-only Befehl `build:view`
ab. Er akzeptiert ausschließlich den erfolgreichen Endstatus, interne
Distribution und ein HTTPS-Artefakt für exakt denselben Commit, dieselbe
Plattform und dasselbe Profil. Build-ID, Projekt-ID, URLs und öffentliche
Clientwerte werden nicht ausgegeben.

Der Ablauf erzeugt oder verändert keine Signing-Credentials und ruft weder
Submit noch Update auf. Vorhandene gültige Credentials sind daher externe
Voraussetzung. Nur eine vollständig validierte EAS-Antwort bestätigt, dass
genau ein Build für den geprüften Commit eingereiht wurde; erst die getrennt
validierte Abschlussantwort bestätigt das fertige interne Artefakt. Ist der
Queue-Aufruf, die Statusprüfung oder ihre Antwort unklar, wird der Lauf ausdrücklich als
`indeterminate-do-not-retry` markiert und darf erst nach direkter Prüfung des
geschützten EAS-Projekts erneut gestartet werden. Installation, Push, Recovery,
Android Internal Testing und TestFlight bleiben gesondert abzunehmen.

Nach einem erfolgreichen Build erzeugt der Workflow einen redigierten Receipt
ohne Build-ID oder Artefakt-URL. Der signierte APK-/IPA-Inhalt wird nicht als
GitHub-Artefakt gespeichert. Ein berechtigter Operator übernimmt das interne
Installationsartefakt direkt aus dem geschützten, bereits verifizierten EAS-
Build, hält es privat und löscht die lokale Kopie nach der Geräteabnahme. Es
ist ein interner Testbuild und keine Play-/App-Store-Freigabe.

Die Abnahme verwendet anschließend den privaten Geräte-Abnahmevalidator aus
`docs/mobile/DEVICE_ACCEPTANCE.md` und bindet daran die separaten realen
Android-/iOS-Nachweise; er führt selbst keinen Build, Store-Upload oder
Production-Schreibzugriff aus.

## EAS-Profile

Die Profile binden ihre öffentlichen Werte ausdrücklich an getrennte
EAS-Umgebungen:

| Profil | Umgebung | Zweck |
|---|---|---|
| `development` | `development` | signierbarer interner Development-Client |
| `native-validation` | `development` | Android-Debug-/iOS-Simulator-Prüfung ohne Release-/Store-Credentials |
| `preview` | `preview` | signierter interner Beta-Build |
| `production` | `production` | späterer Store-Build |

`withoutCredentials=true` bedeutet ausschließlich, dass das Validierungsprofil
keine verwalteten Release-/Store-Credentials anfordert. Das Android-Debug-APK
wird dennoch mit einem lokalen Debug-Key signiert; es ist kein Release-Artefakt.
Ein EAS-Cloud-Build braucht außerdem weiterhin ein Expo-Konto und eine echte,
per `eas init` erzeugte Projekt-ID. Das Repository enthält bewusst keine feste
EAS-Projekt-ID, Apple-Team-ID, Store-ID oder Schlüsseldatei; die Projektbindung
wird aus dem jeweils geschützten GitHub-Environment dynamisch ergänzt.

Nach der externen EAS-Einrichtung:

```bash
npx eas-cli@21.2.0 build --profile native-validation --platform android
npx eas-cli@21.2.0 build --profile native-validation --platform ios
npx eas-cli@21.2.0 build --profile preview --platform android
npx eas-cli@21.2.0 build --profile preview --platform ios
```

Vor einem signierten EAS-Build müssen EAS-Projekt-ID, Signierung und Store-Konten bewusst eingerichtet werden. Diese Werte werden nicht erfunden oder aus der Web-Anwendung übernommen.

## App-Identität

```text
Name: FanMind
Deep-Link-Schema: fanmind://
Recovery-Route: fanmind://reset-password
iOS Bundle Identifier: ch.fanmind.app
Android Package: ch.fanmind.app
```

Der Recovery-Redirect muss zusätzlich einmalig in der Supabase-Auth-Allowlist des richtigen Projekts freigegeben werden. Details und Negativtests stehen in `docs/mobile/BETA_RELEASE.md`.

## Release-Unabhängigkeit

- Website-Deployments veröffentlichen keine Mobile-App.
- Mobile-App-Builds deployen keine Website.
- Mobile-Änderungen werden unter `apps/mobile/**` geprüft.
- Backend-Vertragsänderungen müssen Web und Mobile separat=�λ����k�w��nt-gated parameterless PageView-only Pixel Production path; advanced Facebook/Instagram OAuth/token/content/conversation foundation; 95/95 focused local tests; direct transaction-level read-only Staging catalog countercheck; exact-main protected read-only runs `33007156552`, `33007311870` and `33007481167` all passed with Apply not requested, runtime activation disabled where applicable and postflight rollback markers. Canonical readers now record that continuation and queue schemas are present in isolated Staging, and `EV-META-STAGING-FOUNDATION-20260826` expires the mutable observation. FM-FAIL-015 preserves the read-before-rollout sequencing deviation.
- Still open: external Events Manager positive/negative browser reception and provider-side no-PII/no-unexpected-conversion proof; App Review/permissions and real account/webhook/conversation E2E; final relevant security/legal acceptance.
- Evidence so far: FM-EV-007, FM-EV-023, `META_TECHNICAL_READONLY_RECONCILIATION_2026-08-26.md`, #714, Source of Truth and the three exact-main runs/jobs.
- Exact next step: external Events Manager/App Review/provider/legal work remains owner-controlled under `FM-META-OWNER-001`; keep conversion events, Advanced Matching and CAPI disabled. Do not repeat the evidence runs merely for closeout. After Staging freshness expiry/invalidation or before another Meta database action, acquire a new lock and revalidate shared rollout state first.
- Owner action needed: external Meta account/access and legal approval where required.

## FM-SOC3-001
- Started: foundation work before 2026-08-19
- Updated: 2026-08-19
- Status: PARTIAL
- Risk: R3
- Scope: Phase 3 real Facebook, Instagram and WhatsApp connectors.
- Branch/PR: existing Meta/WhatsApp foundations on main.
- Work lock: acquire per connector before external mutation.
- Dependencies: non-Social finishline sufficiently closed; provider credentials/permissions; legal boundaries.
- Assumptions: existing foundation is not a live accepted connector.
- Completed so far: Facebook/Instagram foundation advanced; dormant WhatsApp inbound foundation merged.
- Still open: final real E2E for all three, including auth, tenant isolation, idempotency, token/revocation/reconnect and no-auto-send evidence.
- Evidence so far: Source of Truth, #874 Gate 6, Meta/WhatsApp commits.
- Exact next step: run Social only after Gates 2-5 are sufficiently closed; reuse existing Meta foundation.
- Owner action needed: provider credentials/App Review where externally required.

## FM-SOC7-001
- Started: feasibility assessment before 2026-08-19
- Updated: 2026-08-19
- Status: PARTIAL
- Risk: R3
- Scope: Phase 7 TikTok, X/Twitter, Discord and conditional OnlyFans.
- Branch/PR: no accepted real connector set yet.
- Work lock: acquire per platform before implementation.
- Dependencies: Phase 3/non-Social finishline; official platform scope; X cost approval; OnlyFans official/contractual feasibility.
- Assumptions: Login/content-posting capability is not equivalent to inbox/DM/comment capability.
- Completed so far: platform feasibility notes in #874.
- Still open: official scope revalidation and real connector/E2E work.
- Evidence so far: #874 platform-feasibility comment.
- Exact next step: after prior gates, verify current official API capability before coding each connector.
- Owner action needed: yes for paid X/API spend or external platform onboarding where required.

## FM-SALES-001
- Started: sales materials prepared before 2026-08-19
- Updated: 2026-08-19
- Status: BLOCKED
- Risk: R2
- Scope: final technical sales handoff to Gerhard.
- Branch/PR: sales docs already exist; no new sales claim until finishline accepted.
- Work lock: none required until closeout.
- Dependencies: FM-SOC3-001, FM-SOC7-001 and final exact-release demo/production truth.
- Assumptions: Phase 4 completion or existing sales docs do not equal sales handoff.
- Completed so far: sales one-pager/demo script/objection material prepared and canonical truth aligned to Phase-7 finishline.
- Still open: required social acceptance, final 5-minute Production demo, final reader/material sync, formal technical handoff.
- Evidence so far: Source of Truth, #874, commit `74c3a6aa357215c52d3a4d9b01ba8513bba1b57f`.
- Exact next step: remain blocked until social finishline; do not prematurely mark sellable technical handoff.
- Owner action needed: final operator/sales acceptance at handoff.

## FM-LEGAL-001
- Started: before 2026-08-19
- Updated: 2026-08-19
- Status: BLOCKED
- Risk: R3
- Scope: final external law/tax/AVV/provider evidence.
- Branch/PR: technical legal evidence framework on main.
- Work lock: none for collecting evidence; protected review for public/legal mutations.
- Dependencies: actual advisor/register/provider documents.
- Assumptions: technical truth cannot substitute legal/tax approval.
- Completed so far: confirmed operator/business facts and technical reader/evidence framework.
- Still open: tax/register/UID, legal review, final AVV/subprocessor/region/transfer/retention evidence and acceptance.
- Evidence so far: issue #564.
- Exact next step: incorporate only confirmed external evidence when received.
- Owner action needed: yes/external advisors.

## FM-SEC-001
- Started: 2026-08-20
- Updated: 2026-08-26
- Status: RECONCILIATION_REQUIRED
- Risk: R3
- Scope: reconcile fresh live Supabase Production/Staging security advisors with the controlled hardening design before any database/Auth mutation.
- Branch/PR: read-only verify evidence PR #1008 final exact head `ed64255f3786eea257011778a40492d6c7c9447e`, squash merge `4efb4eeef07d850fd0fd9117244187cf94bfed41`; refresh PR #1006 merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`; prior lock closeout #1007 merge `5cb9c193e262f8939b5fc0c700fce154dde616e6`; issue #982 comments `5428919200`/`5428996454`/`5429302086`.
- Work lock: `LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826` RELEASED after exact-head acceptance and merge. Acquire a separate exact authorization and new lock before any Production DB/Auth change.
- Dependencies: FM-DEP-010; exact deployed Production commit; controlled trigger-hardening checksum/runner; current Production/Staging Supabase projects; provider/Auth access for leaked-password decision.
- Assumptions: Production trigger warnings indicate pre-apply/not-accepted state; Staging authenticated workspace RPC may be intentional but its exception status must be explicitly reviewed.
- Completed so far: provider advisors and direct Production/Staging catalogs reconfirmed no drift; deploy run `32996396550` job `98266724400` proved Production at exact `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`. Exactly one protected `verify` then ran as `32997946812` job `98271985321`: preflight audit passed, the installed read-only database verifier returned fixed `hardening_not_ready`, and the always-run postflight audit passed on the same release. Fresh Production advisors remained unchanged. Focused Staging provisioning tests passed 24/24 and classify the RPC as constrained intentional exposure pending explicit exception acceptance.
- Still open: separately authorized protected Production Apply and post-advisor proof; explicit Staging RPC exception acceptance; separately authorized leaked-password protection changes on both targets.
- Evidence so far: FM-EV-014, FM-EV-019 and FM-EV-020; run `32997946812`/job `98271985321`; live Supabase advisors/catalog ACLs; controlled SQL/runbook; 24/24 focused Staging tests.
- Exact next step: keep `FM-SEC-OWNER-001`/`002` deferred until explicit owner resume and continue the generated parallel-safe Mobile read-only action. Do not rerun the verify.
- Owner action needed: yes for `FM-SEC-OWNER-001` protected Apply and `FM-SEC-OWNER-002` Auth-setting/exception decisions; neither is standing-authorized.

## Closed work

## FM-MEM-005
- Started: 2026-08-19 08:40 Europe/Vienna
- Closed: 2026-08-19
- Status: ACCEPTED
- Risk: R3
- Scope: Project Memory V2-V6, exhaustive FanMind finishline audit and machine-enforced finishline controls.
- Branch/PR: `project-memory-v4-started-work` / PR #975
- Result: exact head `2a62dc8337673be0b33acfd4338d0f452224e779` passed Project Memory Guard/Quality V6/Status, FanMind CI, Supply Chain, Landing, CodeQL and Browser E2E; merged as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`.
- Evidence: PR #975, merge commit and exact-head workflow runs.
- Follow-up: maintain V6; continue `FM-RST-001`.

## FM-MEM-008
- Started: 2026-08-19
- Closed: 2026-08-20
- Status: ACCEPTED
- Risk: R3
- Scope: Project Memory V8 cross-chat reconciliation, impact matrix, owner-action inbox, automatic handoff and V8 quality enforcement.
- Branch/PR: `project-memory-v8-crosschat-impact` / #980.
- Result: after correcting missing V5 bookkeeping and stale generated status, final exact head `704fec4b6264dd5a0dd83cc8e0029352672485d0` passed Guard, Quality, Status, FanMind CI, Supply Chain, Landing, CodeQL and Browser E2E, then squash-merged as `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Evidence: exact-head GitHub workflow runs and merge commit; independent Browser E2E run #915.
- Follow-up: maintain V8; any stale/contradictory handoff must downgrade to revalidation rather than being trusted.
