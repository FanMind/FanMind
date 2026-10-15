# FanMind Master Reality Check und Finishline Audit

Stand: 15. Oktober 2026, 20:43 Uhr Europe/Vienna (18:43 UTC). Technischer Snapshot: `dc269fd80407bfa2a3e1885e19e432b0ebaed68e`. Beobachtungsbericht und Entscheidungsvorlage, keine neue Aufgabenwarteschlange und keine Aktivierungsfreigabe. Zuständigkeiten und weitere Arbeit bleiben in den bestehenden FM-Tasks und im bestehenden Aktionskatalog.

[Vollständige Acceptance-Matrix als CSV](receipts/master-reality-check-20261015-matrix.csv)

## A. Executive Summary

**FanMind ist ein implementiertes und produktiv betriebenes CRM mit KI-Antwortvorschlägen sowie einem erheblich weiterentwickelten ChatAdmin. Eine öffentliche Verkaufsfreigabe ist nicht belegt.** Die größten verbleibenden Lücken liegen in Capacity-v2-Abrechnung, belastbarer Abschlussabnahme, Rechts-/Steuer-/Providerfreigaben und der Differenz zwischen aktuellem Runtimezustand und älteren Projektregistern.

Der aktuelle Webstand ist tatsächlich deployed: manueller Deploy **38709309527** veröffentlichte `dc269fd8`; der unabhängige installierte Production-Audit **38711088856** bestätigt um **11:11 Uhr CEST** denselben Release, PM2 online, nginx aktiv und acht gesunde Health-Komponenten. Der öffentliche Go-Live-Smoke bestand 18 Prüfungen. Das sind Betriebs-/Smoke-Nachweise, keine Abnahme bezahlter Pakete, jeder Kundenreise oder der Antwortqualität.

**Capacity v2 ist vorbereitet, aber weder technisch fertig noch freigegeben.** Preise 99/199/312 EUR monatlich, 0 EUR Setup und enthaltene AI-Kostenbudgets 15/30/50 EUR sind beschlossen. Staging bestätigt aktuell Revision 2, diese Budgets, alle drei Qualitätsmodi aus, Top-ups aus, globale Capacity aus und Emergency Freeze an. Die fünf Capacity-Tabellen existieren dort, die Grant-/Reserve-/Settle-RPCs fehlen. Production enthält keine Capacity-Tabellen/-Funktionen. Der in #1248 gemeldete SQL-Fehler ist im aktuellen main weiterhin vorhanden.

**Die schnellste sichere Route ist eine gezielte Fertigstellung der bestehenden Abrechnung und ein klar abgegrenzter Web-Pilot.** Alle Social-Kanäle und Mobile sind keine technische Voraussetzung für manuell eingegebenen CRM-Kontext. Sie sind aber derzeit ausdrücklich Teil der bestehenden Sales-Finishline. Ein kleinerer Verkaufsumfang benötigt eine neue Owner-Scopeentscheidung; dieser Audit ändert ihn nicht.

**Keine neue externe Mutation:** keine Migration, kein Deployment, keine Stripe-/Provideraktivierung, keine Zahlung, kein Kunden-Datenzugriff oder Daten-Write, keine Nachricht. Supabase wurde ausschließlich über Projektmetadaten, Advisors, Kataloge und die technische Staging-Policy in Read-only-Transaktionen geprüft. Keine alten Authorizations wurden verwendet.

## B. Aktueller technischer Snapshot

### Git und Pull Requests

- GitHub main und Checkout HEAD: `dc269fd80407bfa2a3e1885e19e432b0ebaed68e`, Merge #1328 am 15.10.2026 um 10:53:45 CEST. Lokaler Branch heißt `work`; `origin/main` zeigt im bereitgestellten Checkout noch auf `d739797f` und ist als aktueller Main-Beleg ungeeignet. Live-GitHub wurde unabhängig gelesen.
- GitHub meldet `main.protected=true`. Details der Schutzregel, Reviews, Ausnahmen und vollständige Soll-Vertragserfüllung: **NOT_VERIFIED**, da der Branch-Protection-Endpunkt dem Connector HTTP 403 zurückgibt. Ältere Aussage „main ungeschützt“ ist als heutiger Fakt falsch.
- 20 offene PRs im direkt gelesenen Pulls-Snapshot: 4 Drafts, 16 weitere. Relevant: #1250 Website-AI-Dialog; #1255 Audit-Trigger; #1262 Orchestrator-Ergebnis; Drafts #1297 Release-Control, #1294 Demo-Diagnose, #1293 TLS/OCSP und #1282 Tagfilter. Weitere offene Dependency-PRs: #1001, #1045, #1046, #1047, #1118, #1148, #1149, #1150, #1269, #1299, #1300, #1301, #1302.
- Branches der offenen PRs wurden über ihre aktuellen Head-Refs erfasst; zusätzlich lieferte Branchsuche die erste Seite mit 100 Branches. Das ist keine Behauptung einer vollständigen Lösch-/Archivierungsprüfung aller historischen Branches.
- Neuere gemergte Arbeit: #1290 strukturierte Offers; #1291 Root-Dependencyfix; #1298 ursprüngliche Deploy-Sperre; #1303–#1313 ChatAdmin-Schema/Browser/Preis- und Recoverykorrekturen; #1314–#1317 Backup-/Restore-Verträge und geschützte Controller; #1318 Fanwissen; #1319 manueller Release; #1320/#1321 einstündige Backup-Audit-Policy; #1322–#1328 Angebote, Modell-/Timeout-, Abschluss- und Antwortqualitätsarbeit.

### CI und Runtime

| Nachweis | Tatsächlicher Befund | Grenze |
| --- | --- | --- |
| #1328 Head `78641201` | 17 Check-Runs erfolgreich, einschließlich wiederholter CI/PG17-Läufe; Browser, CodeQL, Memory, God Mode, Mobile und Supply Chain grün | Check-Anzahl ist keine Feature-Abnahme |
| Aktueller Merge | Browser/Supply Chain/God Mode/CodeQL grün; späterer FanMind-CI-Pushlauf 38763264205 abgebrochen | Nicht als vollständig frisch grüne Main-CI darstellen; PR-Head- und Deploy-Tests separat vorhanden |
| Deploy 38709309527 | Validate und Exoscale-Deploy erfolgreich; isolierter Release, 14-Routen-Smoke; sechs Umschaltproben, null Nicht-200 | Manueller, Owner-/Exact-main-/Environment-gebundener Weg, kein Auto-Deploy bei Merge |
| Production-Audit 38711088856 | `PRODUCTION_AUDIT_VERIFIED=true`, `PRODUCTION_RUNTIME_VERIFIED=true`, exakter Release, 8 Health-Komponenten | Beobachtung vom Vormittag, keine unbegrenzte Verfügbarkeitsgarantie |
| Go-Live 38710346551 | 18 öffentliche Prüfungen erfolgreich auf exaktem Release | Kein Kunden-CRM-, Zahlungs- oder Social-E2E |
| Uptime 38743110294 | Erfolgreich, 15.10. um 15:29 CEST gestartet | Öffentliche Erreichbarkeit |
| Staging Deploy 38432076878 | `f353f3e1`, erfolgreich am 13.10. | Letzter hier belegter Staging-Release, nicht heutiger main |
| Staging ChatAdmin 38432481036 | Probe, Browser, Verify, Cleanup, Absence, Manual Flow PASS | Datiertes echtes synthetisches Application-E2E auf `f353f3e1`; spätere Qualitätsänderungen nicht dadurch abgenommen |

Production-Audit: Node 24.18.0, ein PM2-Clusterprozess am stabilen Releasepfad, acht Health-Komponenten gesund. Backup-Paare lokal 11, Offsite 281; jüngste DB/Storage/Config-Backups 8,67 Stunden, Full Backup 20,10 Stunden alt. Reboot erforderlich; Boot-Readiness wurde erfolgreich geprüft. Daraus folgt ein planbarer Wartungspunkt, kein hier belegter Verfügbarkeitsfehler. Backup-Worker-Install **38562548105** belegt `INSTALLED`; Audit-Policy-Install **38577578826** belegt `INSTALLED_AND_VERIFIED` mit einer Stunde Fehlerfenster. Nicht auf eine unbelegte 24-Stunden-Freigabe ausweiten.

### Die sieben ausdrücklich genannten PRs

| PR | Heutiger Status | Konsequenz und Nachfolge |
| --- | --- | --- |
| #1248 Capacity-Budgets | MERGED, 02.10., `f0ec2518` | Budgets erledigt; Live-Staging bestätigt sie. SQL-Defekt weiterhin offen, keine erneute Budgetentscheidung/-Seed nötig |
| #1252 Top-ups | MERGED, 01.10., `adc9494d` | Helper/Webhook-/Reversal-Source vorhanden; unten belegte Einheiten-, Lifecycle- und Integrationslücken verhindern Aktivierung |
| #1251 Scroll | MERGED, 04.10., `3d5e1643` | Nicht erneut implementieren; Editor-/Layoutnachfolger #1289 und #1305–#1307 berücksichtigen |
| #1233 Validation | MERGED, 04.10., `9bd882a9` | Deutsche feldbezogene Rückmeldungen vorhanden; keine offene Erstimplementierung |
| #1250 Website AI | OPEN, Head `9c72af30` | Dialogroute nicht auf main; vorhandene Session/Message/Handoff-Foundation ist davon getrennt |
| #1246 Legacy Setup | MERGED, 04.10., `58243833` | Tote Setup-Readiness-Slots entfernt; bestehende Vertrags-/Auditreferenzen absichtlich bewahrt |
| #1231 OpenAI Cost Basis | CLOSED UNMERGED, superseded | Nicht rebasen/mergen: 33 % Aufschlag ist nicht 33 % Bruttomarge. #1242/Katalog/Capacity sind die Nachfolger; „Budgets unset“ im alten PR-Text ist ebenfalls überholt |

## C. Feature- und Acceptance-Matrix

Die beiliegende CSV führt für **alle 25 angefragten Systembereiche** getrennte Spalten zu Implementierung, main, Tests, Staging, Production-Deployment, Aktivierung, echtem E2E, Provider-, Rechts- und kommerzieller Freigabe sowie Blockern. **YES** bedeutet nur den genau beschriebenen belegten Teil. **PARTIAL** grenzt Teilumfang ab. **NO** bezeichnet belegte Abwesenheit/Deaktivierung, nicht fehlenden Zugriff. **NOT_VERIFIED** bedeutet fehlende aktuelle Verifikation. **DEFERRED** ist eine bewusste Verschiebung; **N/A** ein nicht einschlägiges Kriterium.

| Bereich | Belastbarer Stand | Offene Abnahme oder Umfang |
| --- | --- | --- |
| Website/Frontend | Produktive Next-Webanwendung, öffentlicher Smoke und Browser-CI | Exakte vollständige Kundenreise und abschließende Salesdemo |
| Auth/Workspace | Implementierte Auth-, Workspace-, RLS-/Admin-CRM-Grenzen; lokales Provider-Core-E2E in CI | Reale synthetische Permanent/Temporary/Blocked-Abnahme separat; technische Consentfreigabe ersetzt keine Rechtsfreigabe |
| CRM/Fans/Kontaktwissen/Follow-ups | Implementierter produktiver Kern, CSV-/Policy-/synthetische Browserabdeckung | Aktueller echter Kunden-Golden-Flow einschließlich Autorisierungsnegativen nicht frisch nachgewiesen |
| Creator-Building/ChatAdmin | Aktuelle Source deployed; beide Ziele haben fünf RLS-Tabellen, customer_tier und sales_playbook | Generische Freigabe für alle Accounts nicht belegt; spezifischer Capabilitieschutz bleibt. Neue Modell-Mehrturnqualität separat |
| Creator Intelligence/Stil-Lernen | Umfangreiche Code-/PG17-/historische Staginggrundlage; nur bestätigte manuelle Ausgänge dürfen lernen | Production hat keine creators-Tabelle; Staging-Helfer fehlt. Target-Transition/Runtime und echte Qualität offen |
| KI-Antwortvorschläge | CRM/ChatAdmin-Routen deployed; gemeinsame stilbezogene Qualität und maximal ein begrenzter Rewrite | Reale repräsentative Qualitäts-/Kostenabnahme, neue Mehrturn-Ausgaben und Capacity-Verdrahtung |
| AI Capacity v2 | Source/Policy/Tabellen/Budgets teilweise vorhanden; Staging deaktiviert | SQL kompiliert nach Sourcebefund nicht; RPCs fehlen; Produktionsschema/Entitlement/Route-E2E/Aktivierung fehlen |
| OpenAI Cost Engine/Modelle | Versionierter Katalog, Ganzzahlarithmetik, 38 lokale Cost-Tests bestanden | Katalogquelle 30.09. ist kein heutiger Providerpreis-/Accountbeleg; FX-Provenienz und reale Usage/Kosten/Qualität offen |
| Stripe/Billing/Top-ups/Refunds | SDK, Signatur, Ledger-/Lifecycle-Source, historische Staging-Subgates | Capacity-Verkauf nicht fertig; Top-up-/Reversalfehler; aktueller Stripe-Live-Readback NOT_VERIFIED wegen Reauth |
| Legacy-Verträge | Getrennter legacy_v1/capacity_v2-Vertrag und erhaltene Referenzen | Vollständiger kundenbezogener Migrationsplan, Consent, Proration/Refunds und exakte Freigabe; keine Migration hier |
| Referral | Attribution/Window/Lifecycle-Source; Legacy-Regeln abgegrenzt | Keine bewiesene produktive Automatisierung; Capacity-Berechtigung UNDECIDED/default-off |
| Facebook/Instagram | OAuth, verschlüsselte Tokens, bounded Import/Webhook/Queue-Source | App Review, konkrete Scopes/Consent, reale Inbound-/Disconnect-/Reconnect-/Tenant-Abnahme |
| Meta Content Intelligence | RLS-/Content-/Continuation-/Analysegrundlage und Consent-Pixel-Source | Provider-/Profiling-/Legal-Abnahme, tatsächliche Queue-/Analyseaktivierung und Datenqualität |
| WhatsApp | Eigener signaturgeprüfter Inbound-only-Pfad vorbereitet | Production im Code verboten; Schema-/Staging-/Meta-E2E und externes Konto offen |
| TikTok/X | Staging-only Profil-Login bzw. begrenzte DM-Lesevorschau; historische Schemainstallation | TikTok Login ist kein DM-Zugang; X-Budget/App/Consent, Provider-E2E, dauerhafte CRM-Ingestion offen |
| Website AI | Session/Origin/Inbound/Widget und dormant Handoff auf main | #1250 Dialog offen; echte Dialog-/Email-/Retention-Abnahme; Phase 8 |
| Android | Native App, aktuelle unsigned CI; historische signierte Builds und geschlossener Play-Test | Kein aktueller signierter Build-/Gerätebeleg; Mobile owner-deferred; Dependencybefunde separat |
| iOS | Nativer Code, aktueller unsignierter Simulator-Check | Signing, TestFlight, echtes Gerät/Store bewusst Phase 8 |
| Push | Registration-/Delivery-Vertrag und Stagingtabellen vorhanden; historische Ledgerabnahme | Reale Receipt/Display/Tap/Revocation und Deliveryintegration; Productiontabellen fehlen |
| Supabase/RLS/Controlled SQL | Beide Projekte ACTIVE_HEALTHY; 36 Production-/67 Stagingtabellen, jeweils null ohne RLS | RLS-Flag ist kein Tenant-E2E. RPC-Absichten/ACLs und zielgebundene Controlled-Abnahmen separat |
| Exoscale/Staging/Production | Getrennte Projekte, produktiver exakter Release, bekannte Stagingabnahme | Heutiger kompletter Staging-Runtimezustand und einzelne Aktivierungsflags nicht aus Health ableitbar |
| CI/CD | Relevante Checks grün, manueller kontrollierter Release wiederhergestellt | Offene PRs/Check-Ursachen getrennt; Branchschutzdetails nicht zugänglich; erheblicher globaler Checkumfang |
| Security | Root-Audit null Befunde; RLS aktiv; aktuelle Advisors verfügbar | Mobile 32 Befunde (20 high, 1 critical); öffentliche SECURITY DEFINER-RPCs gezielt prüfen, kein Blind-Revoke |
| Backup/Restore | Aktueller Backup-Audit PASS; historischer isolierter DB-Restore DB_POSTCHECKED | Kein aktueller vollständiger Storage/Config-Restore-/Cleanup-/20/13-Vertragsnachweis; Restore bleibt PARTIAL |
| Legal/Tax/Sales/Agenten | Rechtsseiten/Register und Sales-/Memory-/Selectorwerkzeuge vorhanden | 27/27 Rechtsnachweise pending; alte Verkaufspreise/Locks/Scope widersprechen neuem Stand; Sales false |

**Externe Security-Evidence:** Production-Advisors am 15.10. um 20:40 CEST: 10 INFO „RLS enabled, no policy“ und 5 WARN für authentifiziert ausführbare SECURITY DEFINER-Funktionen. Staging: 35 INFO und 7 solche WARN. Service-only Tabellen ohne Browserpolicy sind oft absichtlich gesperrt. Autorisierte Browser-RPCs können ebenfalls absichtlich SECURITY DEFINER sein. Keine dieser Warnungen allein beweist ein Datenleck; Absicht, Ownership-, Tenant- und Revocation-Negative müssen für die konkret genannten Funktionen bewertet werden. Aktuell keine vom Advisor gemeldete RLS-disabled-Tabelle.

Advisor-Erklärungen: [RLS ohne Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [ausführbare SECURITY DEFINER-Funktion](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## D. Kritische Blocker mit Ursache und Lösungsweg

### D1 Capacity-Grant kompiliert nicht und Reserve prüft die Policy nicht selbst

**Belegt im main:** In `supabase/controlled/ai_capacity_reserve_settle.sql:24–145` deklariert grant_credit nur `v_id` und `v_existing`, verwendet aber `v_policy`, `p_expected_policy_revision` und `p_quality_mode`. Die letzten beiden sind auch keine Funktionsparameter. Der nachfolgende Reserve-RPC deklariert zwar `v_policy`, lädt/prüft die Policy jedoch nicht; der betreffende Block steht im Grant-RPC. Der JS-Wrapper liest vor Reserve die Policy, ersetzt aber keine atomare DB-Prüfung gegen Revision, Emergency Freeze und Modus im Moment der Reservierung.

**Runtime:** heutige Staging-Katalogprüfung findet nur activation_guard und ledger_immutable, keine Grant-/Reserve-/Settle-RPCs. Production findet keine Capacity-Objekte. Damit ist „RPC-Lifecycle fertig/installiert“ widerlegt. Ein nativer neuer Compileversuch wurde hier nicht ausgeführt; der Sourcefehler und die Zielabwesenheit sind unabhängig belegt.

**Lösung:** im bestehenden FM-AI-001/FM-CR-052 exakt den Grant-/Reserve-Policyvertrag korrigieren; echte PostgreSQL-17-Installation und Aufruf prüfen, danach Concurrency, Freeze zwischen App-Read und RPC, Revision, Tenant, Included/Purchased-Split, Periodenende, Duplicate/Conflict, Missing Usage, Timeout, Over-Reservation, Reconcile und Release testen. Erst danach separate geschützte Staging-Abnahme. Keine generische Migration, kein unveränderter APPLY.

### D2 Capacity nur indirekt erfasst; echter PostgreSQL-Lifecycle fehlt

`tests/ai-capacity-policy.cases.mjs` (15 Fälle) und `tests/ai-capacity-reserve-settle.cases.mjs` (10 Fälle) werden auf dem geprüften main bereits indirekt von `tests/ai-cost-engine.test.mjs` importiert und laufen dadurch in Required CI. Die ursprüngliche Auditfassung hatte diese Importkante übersehen. `tests/test-suite-coverage.test.mjs` inventarisiert die `.cases.mjs`-Dateien nicht eigenständig. Das entscheidende Defizit ist der fehlende echte PostgreSQL-Compile-/RPC-Lifecycle; keine fehlende Ausführung der vorhandenen Texttests.

Beide Dateien bestehen lokal, obwohl D1 im SQL steht: ihre SQL-Prüfungen sind Textmuster, kein Compile-/RPC-Lifecycle. Die 8 Top-up-Tests spiegeln heutige Konstanten und prüfen keine Route-/Datenbankereignisfolge. **Grüne allgemeine CI beweist diese Verträge daher nicht.**

Lösung: bestehende Capacity-Tests explizit im Required-CI-Pfad erfassen und um echte DB-/Routennegative ergänzen. Kein Test nur für den Auditbericht.

### D3 Top-up-Einheiten und Zahlungs-/Refund-Lifecycle unvollständig

1. **Einheiten:** kanonisch 1 EUR = 100.000.000 EUR-Microcents. Die derzeitigen Grants sind topup_10 = 10.000.000 = **0,10 EUR**, topup_25 = **0,25 EUR**, topup_50 = **0,50 EUR**, topup_100 = **1 EUR** bei Verkaufspreisen 14,99/37,49/74,99/149 EUR. Der bestehende CURRENT_STATE-Abschnitt „Stripe AI capacity top-ups and purchase reversals“ dokumentiert ausdrücklich EUR 10/25/50/100 Capacity. Gegen diese dokumentierte Absicht ist der Grant um Faktor 100 zu klein. Die vorhandenen Tests wiederholen die falschen Konstanten.
2. **Async Payment:** Grant wird nur in checkout.session.completed mit payment_status=paid erzeugt. checkout.session.async_payment_succeeded aktualisiert den Billingstatus, führt aber keinen Top-up-Grant aus. Ein zunächst unbezahlter asynchroner Checkout hätte damit keinen belegten späteren Grant.
3. **Legacy Refunds:** jedes erfolgreiche Refund-/Dispute-Event mit PaymentIntent wird an reversePurchasedAiCapacity weitergereicht, ohne vorherigen Nachweis einer Capacity-Top-up-Klassifizierung. Der SQL-RPC wirft bei fehlendem Purchased-Grant. Legacy-Erstattungen könnten dadurch in Retries geraten; konkrete Laufzeitauswirkung derzeit NOT_VERIFIED, da RPCs nicht installiert und Billinggates separat sind.
4. **Refund während Reservierung:** Reversal zieht nur gerade freie Kapazität ab. Beispiel: 10 Einheiten Grant, 8 reserviert, Refund reversiert 2; späterer Release der 8 macht sie nach derzeitiger Rechnung wieder verfügbar. Es fehlt ein belegter dauerhafter Refund-/Debt-/Hold-Vertrag. Auch Teilrefundbetrag und bereits konsumierter Anteil sind nicht als vollständige kommerzielle Reconciliation implementiert.
5. **Gatebindung:** Der Top-up-Webhookzweig prüft Betrag/Währung/Metadaten, aber nicht explizit Capacity-Vertrag/Top-up-Aktivierungsreadiness. Globale Billing-Freeze-/Ledgergates sind kein Ersatz für diesen separaten Vertrag. Ein sicherer Checkout für Top-ups wurde auf main nicht gefunden.

Lösung: ein einziges zusammenhängendes, idempotentes Zahlungs-/Grant-/Refund-Design im bestehenden FM-AI-001, inklusive server-owned Price/Workspace/Contractbinding, asynchroner Zahlung, Duplikaten und Event-Reordering, Nicht-Top-up-Refunds, Partial Refunds, Held/Consumed-Reconciliation und Retry-Recovery. Kein echter Kauf zur Diagnose.

### D4 Verkauf und Vertragsunterlagen stimmen nicht überein

`docs/sales/FANMIND_SALES_ONE_PAGER.md` nennt Starter Flex mit 990 EUR Setup und Plus/Ultra +100/+200 EUR als Salesangebot. Das widerspricht README und FM-DEC-026/027: neues Ziel 99/199/312, jeweils 0 Setup; Plus/Ultra nur Legacy-Migrationsinput. Auch `docs/LEGAL_COMPLETION_STATUS.md` nennt alte Pilot/Starter-Vertragsfassungen. Sourcepreise korrigieren heißt noch keine Vertrags-/Stripeaktivierung.

Lösung: alle tatsächlich verwendeten Sales-, Demo-, AGB-/Payment-Terms-Reader in einem fokussierten bestehenden Sales/Legal-Arbeitspaket angleichen; Legacytexte ausdrücklich als Legacy kennzeichnen. Danach den genehmigten echten Verkaufsumfang an einem exakten Release vorführen.

### D5 Legal/Tax/AVV und Providerfreigaben offen

Der strikte Rechtsvalidator meldet Schema valid, **27 controls, 0 complete, 27 pending, ready=false**. Offen sind Betreiber-/Register-/Steuerangaben, Legal-/Tax-/Retention-/Customer-DPA sowie kontobezogene DPA-/Region-/Transfernachweise für Exoscale, Supabase, OpenAI, Stripe, Meta und Resend. Das beschreibt den Registerstand, nicht den Beweis, dass extern keine Dokumente existieren.

Vor echten Drittpersonendaten mindestens einschlägige Rechtsgrundlagen, Information, AVV/DPAs, Regionen/Transfers, Löschfristen und Zugriffsschutz verbindlich klären. Für öffentlichen bezahlten Verkauf zusätzlich anwendbare Steuer-/Rechnungs-/Vertrags-/Kündigungs-/Refundbehandlung und Zahlungsabnahme. Nicht benutzte Provider können bei ausdrücklich reduziertem Scope als nicht einschlägig bewertet werden; nicht ohne fachliche Entscheidung auf ACCEPTED setzen.

### D6 Restore und Mobile bleiben eigenständige offene Gates

Frische erfolgreiche Backups ersetzen keinen Restore. Historischer DB_POSTCHECKED-Beleg bleibt erhalten; keinen alten Datenbankrestore wiederholen. Nach #1317 ist ein aktueller Vertrags-/Recovery-Nachweis für die neue 20/13-Form und der noch offene Storage/Config-Teil zielgebunden zu planen.

Mobile-Supply-Chain-Job meldet auf #1328: Root 0 findings; Mobile **32 total, 20 high, 1 critical**, review_active=false, enforcement=deferred-owner, Gesamtjob success. Das ist eine explizite separate Restlast, kein grünes Mobile-Securityattest. Aktuelle SDK-57-Patches, Simulator und Debug-Build sind keine signierte Geräteveröffentlichung. Bestehende Owner-Deferral nicht eigenmächtig aufheben.

## E. Project-Memory-Konflikte und empfohlene Korrekturen

| Widerspruch | Stärkste Evidenz | Begrenzte Korrektur |
| --- | --- | --- |
| AGENTS/DEC-030 beschreiben gesperrten Deploy ohne Controller | #1319, heutiger Workflow und Deploy 38709309527 | Aktuellen Betriebsabschnitt korrigieren; DEC-030 als historische Entscheidung bewahren und gesonderte Supersession dokumentieren |
| CURRENT_STATE nennt main ungeschützt; Owner-Inbox führt Schutz als offen | Live branch.protected=true | Schutz als vorhanden melden; vollständige Vertragserfüllung wegen 403 weiter NOT_VERIFIED |
| Backup-Loop verlangt weiterhin Root-/Workerreparatur | Install 38562548105, Policy 38577578826, Audit 38711088856 PASS | Historischen Fehler bewahren, aktuellen Backupblocker nicht unverändert wiederholen; Restore separat offen lassen |
| ChatAdmin aktuelle Handovers nennen September-ABSENT/keine Productiontabellen | Heutige Kataloge beider Ziele: fünf Tabellen, customer_tier, sales_playbook; Oct13 Application-E2E PASS | Historische Receipt behalten; aktuelle Aussagen mit Datum und Teilumfang überschreiben/überlagern |
| #1248/Budgettask noch ACTIVE/IN_PROGRESS in Locks/Started Work | PR merged und heutige Stagingpolicy 15/30/50 | Source-/Budgetseed als consumed schließen; verbleibenden RPC-Defekt als eigenen Teil des bestehenden Tasks erhalten |
| Drei belegte Slots belegt, aber Arbeitszustand nicht aktuell nachgewiesen | Selector worker_used=3/3, safe_ready_set=[]; Budget-/Reserve-/Character-Fans-Alteinträge | Jeden Slot gegen laufenden Run/PR und Restumfang reconciliieren; keine Locks blind löschen |
| Selector liefert Creator owner-required statt nutzbare Capacity-Fertigstellung | Ausführbarer Selector + belegte D1/D2 | Bestehenden Aktionskatalog/Abhängigkeiten gezielt reconciliieren; keine zweite Queue anlegen |
| Roadmap-Abgleich meldet planning gaps | Drei Phase-7-Lücken plus spätere Phasen 9/10/15 im Output | Aktive Phase-7-Teilaufgaben auf bestehende Tasks mappen; spätere Erweiterungen nicht als heutige Verkaufsblocker interpretieren |
| Sales-Finishline verlangt production_ops ACCEPTED/PRODUCTION_CONFIRMED, gespeichert ist VERIFIED | sales_readiness.py meldet dies als einen von 8 Blockern trotz frischem Audit PASS | Zulässige Zustandssemantik prüfen und aktuellen Runtime-/Ops-Receipt binden; nicht einfach sales_ready=true setzen |
| legal_tax_avv BLOCKED, aber required_for_sales=false | FINISHLINE_STATE.json und strikter Rechtsvalidator | Bereits vorhandene Legalabhängigkeiten auf vollständige Abdeckung prüfen; eigenständiges Pflichtgate als gezielte Policyentscheidung vorbereiten |
| AI/Billing-Board fordert alte Plus-/Ultra-Tierentscheidungen | FM-DEC-026/027 und Capacity-v2-Source | Neues Geschäft/Capacity von echten Legacy-Lifecyclepflichten trennen; keine alten Quoten/Preise neu erfinden |
| Allgemeiner God-Mode-Check grün, RELEASE_DECISION BLOCK/alte Bindungen | God Mode Policy und Release-Baseline | Kein Widerspruch der Kontrollfunktion: strukturelles Grün ist ausdrücklich keine Laufzeit-ALLOW. Task-/Zielbindung separat |
| „Unapplied Push Ledger“ in allgemeinen Readern vs historische Installation | EXTERNAL_ACCEPTANCE, PUSH_DELIVERY.md und heutige Stagingtabellen | Nicht erneut installieren; reale Deliveryintegration und frische Target-/Geräteakzeptanz offen lassen |
| Legal-/Salesdokumente alt; Truth-Prüfung kann trotzdem grün sein | Konkrete One-Pager-Passagen vs FM-DEC-026/027 | Truth-Check-Abdeckung risikoadaptiv auf echte Salesoberflächen erweitern |
| #1231-Text nennt noch offene Budgets | Merge #1248 und heutige Policy | PR bleibt unverändert historische Source; aktuelle Reader eindeutig auf Entscheidung 027 verweisen |

**Freshness:** Der ausgeführte Freshness-Check endet PASS und listet trotzdem zahlreiche revalidation_required-Einträge. Diese Kennzeichnung ist kein aktueller externer Erfolg. Immutable alte Abnahmen bleiben für ihre Revision gültig; neue Ziel-/Runtimeaktionen brauchen die zutreffenden frischen Belege.

## F. Do Not Repeat

- Keine Neuerstellung der 99/199/312-Stripepreise oder erneute Festlegung/Seed der 15/30/50-Budgets; heutigen Stripezustand bei Bedarf nur neu lesen.
- #1231 nicht mergen, keine 33-%-Markup-Rechnung als 33-%-Marge reaktivieren.
- #1233/#1251/#1246 und strukturierte Offers/Editor-Korrekturen nicht neu implementieren.
- ChatAdmin-Staging-Grundschema, Customer-Tier- und Offers-Apply nicht blind wiederholen. Oct13 Manual Flow ist erfolgreich; spätere neue Qualitätsabnahmen klar anders benennen.
- Keine Wiederholung erfolgreicher Social-/Creator-Foundations, Policy-/Preis-Kataloge oder alter Ledger-/Restore-Aktionen allein für Dokumentationskorrekturen.
- Historischen isolierten Datenbankrestore DB_POSTCHECKED nicht erneut ausführen. Fehlenden aktuellen Restorevertrag/Storage/Config gezielt prüfen.
- Keine erneute Backup-Worker-Installation, sofern kein aktueller Drift belegt wird.
- Kein zweiter Restore-Server, kein Cloudzy-Deploy, kein alter systemctl-FanMind-Neustart.
- Kein erneuter Build des alten Androidkandidaten als Ersatz für neueren signierten Stand. Mobile bleibt owner-deferred.
- Kein pauschaler Revoke beabsichtigter Browser-RPCs und keine Browser-RLS-Policies nur zum Entfernen service-only INFOs.
- Keine abgeschlossene technische Consent-/Admin-CRM-Freigabe mit neuer rechtlicher oder finanzieller Freigabe verwechseln.
- Keine Auth-/Kunden-/Providerfreigaben, echte Fanfixtures oder Zahlungsaktionen aus früheren Authorizations ableiten.
- Keine neue parallel geführte Finishline oder eigenmächtige Scopeänderung.

## G. Sales Readiness Gates

### Begrenzter Pilot

**Synthetische beaufsichtigte Produktdemo:** freigegebener Testzugang, synthetische Daten, aktueller Release, klare Beta-/Manual-Send-Erklärung, Kostenlimit und reproduzierbarer Kernablauf. Kein pauschaler Ersatz für spätere Verkaufsabnahmen.

**Pilot mit echten Drittpersonendaten:** zusätzlich einschlägige Rechts-/AVV-/Provider-/Region-/Retentionfreigaben, nachgewiesene Tenant-/Zugriffssperren, verlässliche aktuelle Backup-/Recoverystrategie, definierter Support-/Incident-/Rollbackweg und ein exakter erfolgreicher Web-Golden-Flow. Admin-CRM-0-EUR-Zugang darf nur über seinen bestehenden geschützten Vertrag gewährt werden.

**Bezahlter Pilot:** zusätzlich akzeptierter konkreter Preis-/Leistungs-/Steuer-/Rechnungs-/Kündigungs-/Refundvertrag, vollständige sichere Zahlung/Entitlement/Usage-Abnahme und separate finanzielle Aktivierungsfreigabe. Der ehemalige kostenpflichtige Pilot/Setup-Tarif ist retired; ihn nicht erneut anbieten. Keine Zahlungsbereitschaft aus internem Gratiszugang ableiten.

### Öffentlicher Verkauf im derzeit beschlossenen Umfang

Die geltende Finishline verlangt weiterhin Restore, Android/Mobile, AI/Billing, Meta/Security, Phase 3 und Phase 7a, Ops und abschließenden Sales Handoff. Der ausgeführte Selector liefert **SALES_READY=false, 8 formale Blocker**. Legal ist unabhängig von seinem fehleranfälligen required_for_sales-Flag fachlich verbindlich. Kein Gate wird durch diesen Audit umklassifiziert.

Vor Veröffentlichung: alle tatsächlich angebotenen Funktionen akzeptiert; aktueller Release mit kompletten positiven/negativen Golden-Flows; rechtsgeprüfte Vertrags-/Datenschutz-/Steuerunterlagen; zuverlässiger Zahlungs-/Zugangs-/Kapazitäts-Lifecycle; Support und Recovery; wahrheitsgemäße Website/Preise/Demo; ausdrückliche geschützte Aktivierung.

### Entscheidungsvorlage für einen früheren Start

Ein **Web-CRM mit manueller Kontexteingabe, CSV, Kontaktwissen, KI-Entwürfen, Kopieren und Follow-ups** kann seinen Nutzen ohne direkte Socialverbindungen, Mobile, Referralautomatisierung oder Website-AI erbringen. Ein solcher Umfang würde Providerwartezeiten reduzieren. Er entfernt weder Legal noch Tenantsecurity, Kosten-/Zugangssteuerung, Wiederherstellbarkeit oder Billing bei bezahltem Verkauf.

Owner muss Zielkunden, explizit ausgeschlossene Kanäle, Pilotgröße, Preis/Leistung und Support festlegen. Danach ausschließlich die bestehende Finishline und kanonischen Reader konsistent ändern. Bis dahin bleiben Social/Mobile nach geltendem Board Verkaufsblocker. Website-AI, iOS/TestFlight, Manager-/Teamrollen, Kampagnen und Vollanalytics sind bereits spätere Scopebestandteile.

## H. Priorisierter Aktionsplan

Keine neuen Task-IDs; die Reihenfolge ist eine Empfehlung zur Reconciliation im bestehenden Katalog. „Jetzt agentenfähig“ bedeutet Source-/Analysearbeit bis zur genannten geschützten Grenze, keine Erlaubnis zum State Change.

| Reihenfolge | Bestehender Anker | Konkretes Ergebnis | Abhängigkeit | Risiko / verantwortlich |
| --- | --- | --- | --- | --- |
| 1 | FM-AI-001 / FM-CR-052 | Grant-/Reserve-Vertrag reparieren, Capacity-Tests in Required CI und echter PG17-Lifecycle | Bestehende Capacity-Locks/Restumfang reconciliieren | R4 nach Vertragsminimum, repository-only; Builder + unabhängiger Billing/DB-Countercheck |
| 2 | FM-AI-001 / #1252-Folgeumfang | Top-up-Einheit, Async Payment, Nicht-Top-up-Refund, Held/Consumed/Partial-Refund-Lifecycle beweisen | Definierter Produktwert; 1 für DB-E2E | R4, Builder + unabhängige Review; Owner nur für echte kommerzielle Unklarheit |
| 3 parallel | FM-LEGAL-001 / FM-SALES-001 | Kontobezogene Belege und konsistente Capacity-/Legacy-Sales-/Legalunterlagen | Rechts-/Steuer-/Accountzugriff | Source R1/R2; rechtliche Freigabe R4, Owner/Beratung |
| 4 | FM-AI-001 | Autoritativer Entitlement-/Periodengrant plus produktive Routeverdrahtung aller relevanten AI-Einstiege | 1/2, explizite FX-/Katalogquelle | R4, Builder; keine aktive Produktion |
| 5 | FM-AI-001 | Separat gebundene Staging-Verify/Apply/E2E inkl. webhook/reset/timeout/concurrency/negative/cleanup | 1/2/4, frische Ziel-/Rollbackbelege | Geschützt R3/R4, neue konkrete Autorisierung |
| 6 parallel | FM-RST-001 | Nur fehlenden aktuellen Vertrag und Storage/Config/Restore-Abschluss nachweisen | Isoliertes Ziel, gültiger Backupbeleg, Operatorzugriff | R4, Operator + Countercheck; DB_POSTCHECKED bewahren |
| 7 | FM-CREATOR-001 / FM-REG-003 / FM-CHATADMIN-002 | Creator-Drift diagnostizieren; Admin-CRM-Lifecycle; neue Release-/Modell-Mehrturnqualität | Je eigener Scope/Ziel/Autorisierung; keine alten Replaykommandos | R3/R4; Builder/Operator, Qualitätsreview durch fachlichen Tester |
| 8 | FM-SOC3-001 / FM-META-001 / FM-SOC7-001 | Nur tatsächlich angebotene Providerpfade offiziell abnehmen | Owner-Scopeentscheid + App/Consent/Legal/Budget | R3/R4, Owner/Provider + technischer Operator |
| 9 separat | FM-MOB-001 | Nach ausdrücklicher Wiederaufnahme Vulnerabilities, neuer signierter Stand, Store-/Geräte-/Pushabnahme | Firmen-/Owner-Deferral geklärt | R3/R4, Mobile-Builder + Owner/Tester |
| 10 | FM-OPS-001 / FM-SALES-001 | Frisches Gesamtrelease-/Recovery-/Security-/Golden-Flow-Dossier, konsistente finale Salesdemo | Tatsächlich gültige Gates einschließlich Legal | R3/R4; fachlicher Owner akzeptiert, Operator aktiviert separat |

Repository-Dokumentationskorrekturen dieses Audits ändern keine Runtime und brauchen keine Freigabe zum erneuten technischen Aufbau erledigter Arbeit.

### Geschwindigkeit und Governance

- Execution Policy v6 und FM-DEC-028/029 erlauben bereits kurze R1-/R2-Pfade. Nicht für jede Copy-/CSSänderung vollständiges Memory, Restore, Mobile und Billing neu prüfen.
- Derzeit laufen Required CI, zahlreiche Operations-/Provider-Policytests und Supply Chain auch auf breiten Sourceänderungen. #1328 musste sieben Expo-Patchstände mitändern, weil Mobile-Doctor verpflichtend ansprang. Künftige Path-/Contract-Zuordnung vorbereiten, dabei unveränderliche Required-Check-Namen/Abschlussaggregator beibehalten; keine unbemerkt „Expected“ bleibenden Checks wie vor #1303.
- Jede Laufzeitabnahme sollte einen primären Receipt mit Revision, Ziel, konkretem Ergebnis und Cleanup haben. CURRENT_STATE/FINISHLINE daraus verlinken; keine wiederholte vollständige Commitgeschichte in STARTED_WORK/WORK_LOCKS.
- Budget-/Character-Fans-/Reserve-Locks können heute den 3/3-Slotzustand mitprägen. Abschluss-/Pausenzustände aus tatsächlichen Runs/PRs ableiten; bestehende Sperren bis zur Reconciliation respektieren.
- Unveränderte erfolgreiche historische DB-/Schema-/Browseraktionen nicht aus „main ist neuer“ erneut ausführen. Nur betroffene Verbraucher/Trigger neu validieren.
- God Mode structural PASS, Release-Baseline BLOCK, R4-Ownerfreigabe und externe Providerabnahme müssen sichtbar verschiedene Aussagen bleiben. Keine zusätzliche Freigabeebene erfinden, aber den relevanten bestehenden Vertrag nicht umgehen.

Keine Workflow-, Slot-, Sicherheits-, Gate- oder Policyänderung wurde hier umgesetzt.

## I. Owner Action Liste

Nur Entscheidungen und Nachweise, die Agenten nicht selbst erzeugen können:

1. **Verkaufsumfang entscheiden:** bestehende vollständige Finishline oder ausdrücklich kleiner Web-Pilot; echte Funktionen, Zielkunden, Preis/Leistung und ausgeschlossene Kanäle. Bis zur Entscheidung gilt die vorhandene Finishline.
2. **Recht/Steuer/Firmendaten bestätigen:** echte Register-/UID-/Rechnungs-/Vertrags-/AVV-/Retentionfreigaben beschaffen und zuordnen; relevante Provider-DPA/Region/Transfers im bestehenden Register belegen.
3. **Stripeverbindung erneut authentifizieren**, falls aktueller Catalog-/Account-/Tax-Readback gewünscht; der Auditconnector meldet UNAUTHORIZED. Keine Neuerstellung von Preisen als Ersatz.
4. **Top-up-Produktwert klären, falls nicht bereits verbindlich belegt:** welcher EUR-Capacitywert gehört zu jeder Verkaufsoption, Gültigkeit, Refund-/Debtregel und Taxbasis. Vorhandene Entscheidungen zuerst nutzen; nicht 15/30/50-Budgets erneut entscheiden.
5. **Providerzugänge/Scopes/Consent/Budget:** zentrale Meta-/TikTok-/X-Apps, kontobezogene Freigaben, eigene Creatorzustimmung und erforderliche bezahlte API-Budgets für den tatsächlich gewählten Scope.
6. **Geschützte Aktionen einzeln freigeben**, wenn konkrete geprüfte Pakete vorliegen: Staging-/Production-Apply, bezahlte Lifecycleprobe, Capability, Provideraktivierung, Legacy-Migration, isolierte Restorewrites. Diese Liste ist keine solche Autorisierung.
7. **Mobile ausdrücklich wieder aufnehmen** und reale Testgeräte/Play-Testkohorte bereitstellen, sobald der bestehende Firmen-/Owner-Aufschub aufgehoben wird. Kein iOS-Zwang für den bestehenden Android-Finishlineumfang.
8. **Fachliche Produktabnahme:** echte repräsentative Antwortqualität und abschließende Demo/Salesfreigabe beurteilen. Source- und Heuristiktests können das nicht ersetzen.

Technische Fehlerkorrekturen, Testintegration, Reader-/Lock-Reconciliation und Vorbereitung reviewbarer Pakete sind Agentenarbeit; dafür keine erneute pauschale Ownerfreigabe anfordern.

## J. Next Best Action

**Ein begrenztes Sourcepaket für den bestehenden Capacity-Reserve-/Settle-Task FM-AI-001/FM-CR-052: Grant-/Reserve-Policyfehler beseitigen und den echten PostgreSQL-17-Lifecycle in Required CI beweisen.** Das entfernt einen konkreten, weiterhin vorhandenen Blocker des beschlossenen Geschäftsmodells und verhindert falsche Sicherheit durch die heutigen Texttests.

Startbedingung: im bestehenden Katalog die noch ACTIVE geführten Capacity-/Budgetlocks gegen #1248 und den aktuellen Sourceumfang reconciliieren; anschließend denselben Task fortsetzen. Der aktuell ausgeführte Selector meldet weiterhin Creator OWNER_ACTION_REQUIRED, SAFE_READY_SET leer und Planning Gaps. Diese Empfehlung ist daher **kein heimlicher Ersatz des Selectors und kein unmittelbarer Dispatch**. Für die vorliegende Auditaufgabe wird weder Source implementiert noch etwas aktiviert.

Abnahme dieses nächsten Sourcepakets: echter SQL-Compile-/RPC-Aufruf, atomare Freeze-/Revisionprüfung, grant/reserve/settle/release/reconcile, konkurrierende und wiederholte Aufrufe, Tenant-/Rollennegative, korrektes Perioden-/Bucketverhalten; relevante exakte CI und unabhängiger Countercheck. Geschütztes Staging erst anschließend als eigener Schritt.

## Prüfprotokoll und Quellen

### In diesem Audit ausgeführt

- Live-GitHub: main-Commit/Branch, offene/zuletzt geschlossene PRs, genannte Einzel-PRs, Check-Runs, Actions-Metadaten und ausgewählte tatsächliche Joblogs. Vollständiger Branchschutzvertrag nicht lesbar; keine GitHub-Schutzeinstellungen geändert.
- Repo: AGENTS, README, Source of Truth, kanonische Memory-/Finishline-/Decision-/Authorization-/Lock-/Attempt-/Owner-/Contract-/Invariant-/Gate-Dateien; relevante Routen/Module, Controlled SQL, Tests, Workflows, Mobile-/Provider-/Sales-/Legal-/Restoreverträge.
- Supabase: genaue Production-/Stagingprojektidentität, Health und Region, Security-Advisors; read-only Katalogzählungen, RLS/ACL, Capacity-RPC-Abwesenheit, ChatAdmin-Tabellen/Spalten; ausschließlich technische Staging-Capacitypolicy. Keine CRM-/Fan-/Zahlungszeilen gelesen.
- Lokale direkte Node-Testdateien: **71 Tests bestanden** (10 Reserve/Settle, 15 Capacity Policy, 38 Cost Engine, 8 Top-up). Das sind keine DB-/Provider-E2E. Ein erster node --test-Lauf meldete nur vier Datei-Ergebnisse; für die fachlichen Fallzahlen wurden die Dateien danach direkt ausgeführt.
- sales_readiness: false, 8 formale Blocker. Next-action-Selector: Creator owner-required, safe set leer, roadmap reconciliation required, 3/3 Slots.
- Drift-Preflight und God-Mode-Preflight: PASS. Evidence-Freshness: PASS mit expliziten Revalidierungshinweisen. Legal strict: erwartetes FAIL, 27 pending.
- Kein lokaler kompletter npm-Build/PG17-Lauf: kein node_modules und kein psql im bereitgestellten Checkout; vorhandene exakte GitHub-/Deploy-Checks wurden gelesen. Keine Installation zum bloßen Wiederholen bereits vorhandener Releaseevidence.
- Stripe-Live-Read: NOT_VERIFIED; Connector verlangt Reauthentication. Keine Providerpreise, Wechselkurse oder Rechtsfreigaben aus Modellwissen ergänzt.

### Primäre externe Nachweise

- [Main-Snapshot](https://github.com/FanMind/FanMind/commit/dc269fd80407bfa2a3e1885e19e432b0ebaed68e)
- [PR #1328](https://github.com/FanMind/FanMind/pull/1328), [PR #1319 manueller Release](https://github.com/FanMind/FanMind/pull/1319)
- [Deploy 38709309527](https://github.com/FanMind/FanMind/actions/runs/38709309527)
- [Production-Audit 38711088856](https://github.com/FanMind/FanMind/actions/runs/38711088856)
- [öffentlicher Go-Live-Smoke 38710346551](https://github.com/FanMind/FanMind/actions/runs/38710346551)
- [ChatAdmin reale Staging-Abnahme 38432481036](https://github.com/FanMind/FanMind/actions/runs/38432481036)
- [Staging Deploy 38432076878](https://github.com/FanMind/FanMind/actions/runs/38432076878)
- [Backup Worker Install 38562548105](https://github.com/FanMind/FanMind/actions/runs/38562548105)
- [Audit-Policy Install 38577578826](https://github.com/FanMind/FanMind/actions/runs/38577578826)

Supabase-Beobachtungen: Security 18:40:31 UTC; Capacitykatalog Staging 18:40:52 UTC, Production 18:40:59 UTC; Stagingpolicy 18:42:34 UTC; ChatAdminkatalog Production 18:42:40 UTC und Staging 18:42:46 UTC. Diese sind eigene datierte Read-only-Beobachtungen, keine synthetischen GitHub-Run-IDs. Rohdaten mit fremden Projekt-/Accountinformationen sind nicht Bestandteil dieses Berichts.

### Zentrale Sourcebelege auf dem geprüften main

- [Capacity SQL](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/supabase/controlled/ai_capacity_reserve_settle.sql#L24)
- [Capacity Runtime, noch nicht in produktiven Replyrouten verdrahtet](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/src/lib/aiCapacityRuntime.ts)
- [Top-up-Einheiten](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/src/lib/stripeAiTopupPolicy.mjs)
- [Webhook Grant und Refundzweige](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/src/app/api/stripe/webhook/route.ts#L478)
- [Test-Abdeckungsinventar](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/tests/test-suite-coverage.test.mjs)
- [Capacity-Produktvertrag](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/docs/operations/AI_CAPACITY_BILLING_V2.md)
- [Finishline](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/project-memory/FINISHLINE_STATE.json)
- [Veralteter Sales-One-Pager](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/docs/sales/FANMIND_SALES_ONE_PAGER.md)
- [Externes Rechtsregister](https://github.com/FanMind/FanMind/blob/dc269fd80407bfa2a3e1885e19e432b0ebaed68e/docs/legal/external-approval-evidence.json)

## Deutsche Management-Zusammenfassung

1. **Tatsächlich fertig:** großer produktiver CRM-Kern, aktuelle ChatAdmin-Source, zahlreiche gezielte UI-/Offer-/Antwortkorrekturen, Preis-/Budgetentscheidungen und kontrollierter manueller Webrelease.
2. **Nachweislich funktionsfähig:** exakter Production-Release/Health/öffentliche Routen, aktuelle Backup-Betriebsprüfung, echte datierte ChatAdmin-Stagingreise mit Bereinigung. Nicht jede einzelne Produktfunktion ist damit voll abgenommen.
3. **Offen:** Capacity-DB-/Route-/Zahlungslifecycle, Top-up-/Refundfehler, neue Modellqualität, finale Registrierung/Creator-/Providerabnahmen, aktueller kompletter Restore, Mobile und 27 Rechtsnachweise.
4. **Kontrollierter Verkaufsstart:** heute fehlen ein explizit abgenommener Verkaufsumfang und die zugehörigen Rechts-/Sicherheits-/Recovery-/Kosten-/Zahlungsgates; die geltende vollständige Finishline ist false.
5. **Später möglich:** bei neuer Scopeentscheidung direkte Socialkanäle, Mobile und Referral; Website-AI, iOS/TestFlight, Management-/Teamkomplexität und Vollanalytics sind ohnehin spätere Erweiterungen.
6. **Agenten können selbstständig:** konkrete Sourcefehler reparieren, echte Tests in bestehende CI einbinden, Reader und Abschlusszustände zielgenau reconciliieren, überprüfbare geschützte Pakete vorbereiten.
7. **Owner entscheidet:** tatsächlicher Launchumfang, verbindliche Rechts-/Steuer-/Provider-/kommerzielle Fakten, geschützte Ausführung, Mobile-Wiederaufnahme und fachliche Abnahme.
8. **Nächster konkreter Schritt:** im bestehenden FM-AI-001 den Scope/Locks reconciliieren, dann den Grant-/Reserve-Fehler mit echter PostgreSQL-Lifecycleabdeckung beheben. Nicht erneut Budgets, Preiskatalog oder erledigte Foundations aufbauen.

