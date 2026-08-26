# FanMind P0-Abschluss-Tracker

Stand: 16. August 2026

GitHub-Issue [#640](https://github.com/Bernds-tech/FanMind/issues/640) ist
abgeschlossen und bleibt der historische P0-Arbeitsnachweis. Der externe
Restore-Nachweis wird unter [#874](https://github.com/Bernds-tech/FanMind/issues/874)
weitergeführt. Dieses Dokument hält die dauerhafte Repository-Zusammenfassung
fest, damit bereits erledigte Arbeit nicht erneut umgesetzt wird.

## Statusmodell

Ein Punkt gilt erst dann als vollständig abgeschlossen, wenn alle zutreffenden Ebenen dokumentiert sind:

1. **Code:** Implementierung in `main`.
2. **Prüfung:** Product Truth, Lint, Operations-Tests, Mobile-CI und Production-Build grün.
3. **Deployment:** erwarteter Commit durch `/api/version` nachgewiesen.
4. **Production-Abnahme:** öffentliche Produktwahrheit und Kernrouten gegen die tatsächlich ausgelieferte Anwendung geprüft.
5. **Externe Freigabe:** nur dort, wo Recht, Steuer, Store-Konten oder externe Infrastruktur erforderlich sind.

Eine Änderung auf dem P0-Branch ist damit noch kein Abschlussnachweis. Dieser Tracker trennt bewusst zwischen **umgesetzt**, **gemergt**, **deployed** und **extern abgenommen**.

## Kanonischer Fortschrittsstand

Die Prozentwerte sind konservative Managementwerte. Sie ersetzen keinen der
oben definierten technischen oder externen Nachweise.

Diese eine Tabelle führt sowohl die acht gewichteten Abschlussblöcke als auch
alle unterstützenden Arbeits- und Nachweiszeilen. `W-*`-Zeilen sind bewusst
nicht nochmals in den Gesamtwert eingerechnet, damit es keine Doppelzählung
gibt. Die stabilen IDs werden durch einen Regressionstest geschützt.

| ID | Typ | Fortschrittspunkt | Vorher | Jetzt / Iststand | Nächstes Abschluss-Gate |
| --- | --- | --- | ---: | --- | --- |
| A-01 | Abschlussblock | Isoliertes Staging – Infrastruktur/Deploy/Readiness | 83 % | **100 %** | abgeschlossen; Stripe-/Billing-Abnahme wird getrennt in A-08 und W-03 geführt |
| A-02 | Abschlussblock | Restore-Drill | 82 % | **88 %** | commit-genauen Datenbank-Workflow extern ausführen, Wegwerfziel löschen sowie Storage-, Konfigurations- und Evidenznachweis abschließen |
| A-03 | Abschlussblock | Mobile Signing/TestFlight | 68 % | **68 %** | signierte Android-/iOS-Preview-Builds und Realgeräteabnahme |
| A-04 | Abschlussblock | Offline/Push/Stores | 88 % | **89 %** | Push-Staging-Acceptance, private Gerätetests und Store-Abnahme |
| A-05 | Abschlussblock | Security/Dependencies | 99 % | **99 %** | finale Live- und externe Prüfung |
| A-06 | Abschlussblock | Recht/Steuer/AVV | 56 % | **56 %** | externe Rechts-, Steuer-, AVV- und Providerbelege |
| A-07 | Abschlussblock | Meta Events Manager | 92 % | **94 %** | synthetischer Meta-E2E, App Review und Rechtsfreigabe |
| A-08 | Abschlussblock | KI Standard/Plus/Ultra | 87 % | **89 %** | Stripe-Testpreise, Lifecycle- sowie Qualitäts-/Kostenabnahme |
| W-01 | Arbeitszeile | Restore-Datenbankkontrolle und checksum-only Prüfung | – | neues verschlüsseltes Full-Backup mit Datenbank-, Storage- und Serverkonfigurationsanteil erfolgreich validiert und Offsite übertragen; schema-2 Authorization-/Extension-Vertrag und separater checksum-only Verifikationslauf bestanden | kontrollierten externen Restore-Lauf samt drei privaten Receipts ausführen |
| W-02 | Arbeitszeile | Isolierter Restore-Drill | – | Host-Readiness für zwei frische JIT-Runner, verschlüsseltes Full-Backup und receipt-gebundener Transaktions-/5-5-5-Postcheck-Pfad vorhanden | isolierten selbst kontrollierten PG17-Zielcluster bereitstellen, Wegwerfziel löschen sowie Storage-, Server-Konfigurations- und finalen Evidenznachweis abschließen |
| W-03 | Arbeitszeile | KI Plus/Ultra und Stripe-Abnahme | – | AI-Ledger auf Staging installiert und leer/rechtegebunden verifiziert; fünf Testpreise, exakter Test-Webhook und signierter mutationsfreier Bindungs-Smoke nachgewiesen | allgemeinen Billing-Ledger/Cutover, aktuelle Post-Ledger-Rollback-Acceptance, echte Stripe-Testzustellung sowie Qualitäts-/Kostenbelege getrennt abnehmen |
| W-04 | Arbeitszeile | Meta-Abschluss | – | Foundation, History und Tenant-Idempotenz auf Staging; Providerfehlergrenzen gehärtet | E2E, App Review und Rechtsfreigabe abschließen |
| W-05 | Arbeitszeile | Mobile Signing, Android-Beta und TestFlight | – | kontrollierte Workflows und geschützter Android-APK-Handoff vorbereitet | signierte Binaries, Realgeräte und Verteilung extern nachweisen |
| W-06 | Arbeitszeile | Push, Gerätetests und Store-Unterlagen | – | Push-Schema auf Staging und Unterlagen vorbereitet | Acceptance und externe Nachweise abschließen |
| W-07 | Arbeitszeile | Technische Rechts-/AVV-Unterlagen | – | Arbeitsfassungen, Register und Validatoren vorhanden | technische Belege final mit externen Entscheidungen synchronisieren |
| W-08 | Arbeitszeile | Externe Rechts-/Steuerfreigaben | – | weiterhin extern offen | Rechts-, Steuer-, AVV- und Providerbelege einholen |
| W-09 | Arbeitszeile | Roadmap Phase 1–7 und Umsatzmodell | – | MVP-Auftrag und Roadmap abgeglichen; Core-, KI-, Connection-, Referral- und Agency-Regeln zentral testbar; regulärer Gerhard-Core-Flow lokal deterministisch über echte Routen und Server-Actions abgenommen | isolierte Staging-/Provider-Abnahme, Stripe-Testpreise, Rechts-/Steuerfreigabe und Agency-Aktivierung separat abnehmen |

- Produkt-/MVP-Stand: **ca. 89 %**
- Abschlussreife der acht Blöcke: **ca. 85 %**
- Repository-technische Vorbereitung: **ca. 89 %**

Das echte isolierte Staging mit eigenem Host/Runner, DNS/TLS, separatem
Supabase-Projekt, commit-genauem Deploy und grüner Readiness ist abgeschlossen.
Die fünf Stripe-Testpreise, die read-only Webhook-Konfiguration und der
signierte mutationsfreie Bindungs-Smoke sind nachgewiesen. Die echte
Stripe-Testzustellung, Billing-/Ledger-Cutover- und aktuelle KI-Post-Ledger-
Lifecycle-Nachweise sind keine offene Staging-Infrastruktur und werden
ausschließlich unter A-08/W-03 gezählt.

### Arbeits- und Umsatzsystem als eigener Produktquerschnitt

Die acht Abschlussblöcke messen vor allem technische und externe Abschlussreife.
Das Zielsystem wird deshalb zusätzlich eigenständig geführt:

| Produktfähigkeit | Stand | Offene Grenze |
| --- | --- | --- |
| Kontaktwissen / Fan-Gedächtnis | MVP gebaut | automatische Analyse bleibt bis Staging-, Meta- und Rechtsfreigabe aus |
| KI-Antwortvorschläge | KI Standard gebaut | Plus/Ultra bleiben bis vollständiger Readiness und Stripe-Abnahme fail-closed |
| Kontakte | gebaut | keine bekannte P0-Kernlücke |
| Follow-ups | gebaut | keine automatische Nachrichtenzustellung |
| Kanalübergreifende Organisation | teilgebaut | gemeinsame Inbox und Meta-Beta vorhanden; weitere Kanäle bleiben Roadmap |
| Teamarbeit | Basis teilgebaut | Einladungen, differenzierte Rollen und Agency-/Multi-Client-Steuerung offen |
| Erfolgsmessung | teilgebaut | operative KPIs und KI-Kosten vorhanden; vollständige Umsatz-/Kampagnenanalyse offen |

FanMind bleibt dabei ein spezialisiertes Arbeits- und Umsatzsystem, in dem der
Mensch jede externe Nachricht selbst prüft und sendet. Phase 3 enthält
Facebook, Instagram und WhatsApp; Phase 7 enthält TikTok, X/Twitter, Discord
und die unverbindliche OnlyFans-Prüfung. Phase 8 mit LinkedIn und allen
übrigen späteren Plattformanbindungen ist noch nicht begonnen und zählt nicht
in die acht Abschlussblöcke.

Das verbindliche Umsatzmodell besteht aus 312 € Core pro Monat mit einem
Creator/Workspace, KI Standard und zehn Connections inklusive. Je weitere fünf
Connections sind 49 € pro Monat vorgesehen; KI Plus kostet 100 € und KI Ultra
200 € zusätzlich. Referral reduziert ausschließlich die Core-Gebühr. Agency
bleibt Coming Soon: selbstzahlende Creator werden nicht doppelt verrechnet;
bei Agenturzahlung gelten Hub plus Creator-Lizenzen mit 0/5/10/15 % Staffel.
Referral und Agency-Mengenrabatt sind nicht kombinierbar.

## Ausgangsstand

- Ausgangs-`main`: `c40ff79a6ffa2393cf70c9a4a71a6a5ea0e79201`.
- PR #637 enthält bereits die sichere Self-Service-Kündigung und den Archiv-/Lesemodus.
- Der ältere konfliktbehaftete PR #636 wurde deshalb ohne Merge geschlossen; die Kündigungslogik wird nicht doppelt gebaut.
- Die native Mobile-App unter `apps/mobile` ist bereits ein eigenständiger React-Native-/Expo-Kern und keine WebView-Hülle.
- Der historische P0-Branch `p0/completion-20260722` und PR #641 sind
  abgeschlossen; der aktuelle Stand wird ausschließlich aus `main`, dem
  Production-Commit und den externen Nachweisen abgeleitet.

## P0-Änderungsblöcke

### Live-Produktwahrheit und Deployment-Gate

- gemeinsame Source of Truth für tatsächlich ausgelieferten Text unter `scripts/public-product-truth.mjs`;
- finaler Go-Live-Preflight und unmittelbarer Deployment-Smoke verwenden dieselben Regeln;
- der Deployment-Smoke prüft zusätzlich `/api/version`, Production-Environment und `/api/health`;
- Pflichtkomponenten wie Anwendung, Supabase, Stripe und OpenAI blockieren bei einem ungesunden Zustand;
- optionale E-Mail-Konfiguration wird als Warnung behandelt und verursacht ohne produktive Pflicht keinen falschen Rollback;
- alte Preise, aktives Pilot-Angebot, eine pauschale oder als Kleinunternehmer dargestellte Steuerbehandlung, MVP-/Memory-Terminologie und andere bekannte Drift werden als Deployment-Fehler behandelt;
- ein einmaliger read-only Production-Runtime-Audit hat Node, npm, PM2, Server-HEAD, `origin/main`, Live-Commit, Environment und Health geprüft; der temporäre Audit-Workflow wurde danach wieder entfernt.

### Mobile

- kanonischer abgeschlossener Follow-up-Status: `completed`;
- bestehende Altdaten mit `done` bleiben rückwärtskompatibel und werden nicht als offen gezählt;
- Mobile schreibt neue Abschlüsse als `completed`;
- Web-Kontaktdetail, Zähler und Mobile-Listen verwenden dieselbe Statuswahrheit;
- Regressionstest verhindert eine erneute Abweichung zwischen Web und Mobile;
- Expo-SDK-57-Abhängigkeiten werden exakt und reproduzierbar gelockt; transitive Worklets-Versionen dürfen nicht unkontrolliert auf eine inkompatible Veröffentlichung springen.
- ein manueller, nur von `main` startbarer Read-only-EAS-Ressourcencheck ist
  vorbereitet und an getrennte geschützte Mobile-Environments gebunden;
- der Check bestätigt Projekt-/Owner-Bindung, App-Identität und ausschließlich
  öffentliche Clientwerte, ohne Build, Submit, Update oder Signing-Zugriff;
- ein getrenntes manuelles Gate kann nach derselben Ressourcenprüfung genau
  einen credential-frozen Development-/Preview-Build auf Android oder iOS
  einreihen; Production, Submit, Update und Credential-Erzeugung bleiben
  blockiert, und der Queue-Nachweis gilt nicht als fertiges Binary;
- eigenständige 1024×1024-Icon-Quellen und getrennte PNG-Verträge für
  iOS/Legacy-Android sowie Android Adaptive Icon sind im Native-Prebuild
  abgesichert; die visuelle Abnahme bleibt beim signierten Realgeräte-Build;
- iOS-Privacy-Manifest, fehlende Tracking-Domains, minimale native
  Berechtigungen und Android API 36 werden im isolierten Prebuild geprüft;
- getrennte technische Entwürfe für Apple App Privacy und Google Play Data
  Safety sind vorbereitet, bleiben aber bis zum signierten Build und zur
  externen Datenschutz-/Rechtsfreigabe unveröffentlicht;
- der externe Lauf, signierte Android-/iOS-Builds und Store-Verteilung bleiben
  offen.

### PDF-Datenauskunft

- alter Mailto-Ablauf und zusätzlicher Abmelden-Button aus der Datenauskunftskarte entfernt;
- ein lokalisierter, authentifizierter PDF-Download bleibt als einzige Kartenaktion;
- Export enthält sichere Konto-, Workspace-, Vertrags- und Kontaktdaten;
- keine Secrets, Tokens, Sessiondaten, Stripe-IDs, Admin-Notizen oder fremden Workspace-Daten;
- Kontaktabfrage erfolgt stabil paginiert mit angemeldeter User-Session und bestehender RLS, nicht mit einer Service Role;
- jede Kontaktzeile wird erneut gegen den autorisierten Workspace geprüft;
- doppelte IDs, instabile Pagination, ungültige Seiten oder mehr als die definierte Sicherheitsobergrenze brechen explizit ab, statt Daten still abzuschneiden;
- mehrseitige PDF-Erzeugung erfolgt als PDF/A-2u mit NFC-Normalisierung und eingebetteten Noto-Schriften;
- nicht-lateinische Namen und Inhalte bleiben zusätzlich als exaktes Unicode-`ActualText` im getaggten PDF erhalten;
- deutsche und englische Ausgabe sowie ehrliche Leerzustände;
- Regressionstests decken 140 PDF-Kontakte, 1.201 paginierte Kontakte, Sicherheitsgrenze, Workspace-Grenze sowie kyrillische, griechische, chinesische, polnische, arabische und Emoji-Daten ab.

### Zentrale Produktdokumentation

- Mobile wird in `docs/SOURCE_OF_TRUTH.md`, `README.md`, `AGENTS.md` und der Roadmap als eigener aktiver Produktstream geführt;
- Roadmap-Phase 8 bleibt als öffentliche Zukunftsplanung erhalten, gehört aber
  nicht zum aktuellen Abschlussumfang der acht Fertigstellungsblöcke und wird
  in deren Fortschritt nicht mitgezählt;
- signierte Builds, Store-Konten, TestFlight und Google-Play-Internal-Testing bleiben klar von bereits vorhandenem Code getrennt;
- der ursprüngliche MVP-Arbeitsauftrag bleibt als historische Scope-Grundlage erhalten, während aktuelle Preise, Terminologie und Produktfreigaben aus `docs/SOURCE_OF_TRUTH.md` gelten.
- eine nicht unterschriftsreife AVV-Arbeitsfassung und ein technisches
  Retention-Register bündeln die intern belegbaren Datenschutzgrundlagen;
- Product-Truth-CI verhindert, dass die Datenschutzerklärung hinter den
  consent-gesteuerten Meta-Events oder den bestätigten technischen
  Retention-Werten zurückfällt;
- Anbieter-Verträge, Regionen, Drittlandgrundlagen, finale Fristen und
  Rechts-/Steuerfreigabe bleiben ausdrücklich externe Nachweise.
- Ein strukturiertes externes Freigaberegister benennt pro UID-/Registerwert,
  Fachfreigabe und Anbieter den erforderlichen konto- und versionsbezogenen
  Nachweis. Der normale Check validiert die Struktur; ein getrenntes
  fail-closed Vollständigkeitsgate verhindert, dass fehlende externe Belege
  als Abschluss ausgegeben werden.

### Restore-Drill-Vorbereitung

- Zielgrenze, transaktionaler Datenbank-Runner und redigierter Evidence-Validator sind implementiert;
- ein root-owned, SHA-gebundenes Host-Gate prüft vor den geschützten Phasen
  einen secretfreien JIT-Runner mit der exakten Identität
  `fanmind-restore-01`; Ressourcen- und Datenbankworkflow benötigen jeweils
  einen zweiten frischen One-Job-JIT-Runner. Vor jeder Runner-Registrierung
  fehlen noch Organisations-Transfer und die auf die drei `main`-Workflows
  beschränkte Gruppe `fanmind-restore-drill`; die Scope-Variable muss bis zur
  unabhängigen Prüfung dieses externen Vertrags unset bleiben und blockiert
  dann standardmäßig fail-closed. Sie ist selbst kein API-Nachweis. Die fünf Labels dienen nur der Route und
  ersetzen keine Hostprüfung oder Autorisierung;
- ein manueller, `main`-gebundener Ressourcencheck prüft danach nur die
  isolierte Zielidentität und die Prüfsumme eines verschlüsselten Full-Backups;
- der Ressourcencheck verbindet sich nicht mit PostgreSQL, entschlüsselt
  nichts und aktiviert keine Schreibfreigabe;
- der tatsächliche Restore-, RLS-, Storage-, Server-Konfigurations- und
  Cleanup-Nachweis bleibt ausdrücklich extern offen.
- ein getrennter `main`-, reviewed-commit-, Environment- und Runner-gebundener
  Datenbankworkflow wiederholt beide read-only Gates, friert age-Identity,
  Passfile und CA symlink-sicher ein, erzwingt TLS `verify-full`, führt den
  receipt-gebundenen Transaktionsrestore samt 5/5/5-Postcheck aus und stellt
  ausschließlich drei private Receipts drei Tage geschützt bereit. Das
  Full-Backup-Receipt ist vertraulich und enthält die begrenzte Liste
  erforderlicher Datenbankrollennamen; Runner- und Postcheck-Receipt bleiben
  namenfrei;
- der Workflow lädt keinen Dump und kein Secret hoch und behauptet weder
  Wegwerfziel-Cleanup noch den vollständigen Restore-Drill.

## Noch nicht als P0-Codeabschluss auszugeben

Diese Punkte benötigen einen eigenen externen oder produktiven Nachweis und dürfen nicht durch eine reine Codeänderung als erledigt markiert werden:

- tatsächlicher Production-Commit und Live-HTML nach dem Merge;
- signierter Android-Build und iOS-TestFlight-Build;
- Apple-/Google-Store-Konten und Signing Credentials;
- Stripe-Testkatalog, Webhook-Konfiguration und signierter mutationsfreier
  Bindungs-Smoke sind nachgewiesen; echte Stripe-Testzustellung, Billing-
  Lifecycle durch den angewendeten Ledger und der reale Lauf der vorbereiteten
  dauerhaften synthetischen Billing-/E2E-Fixtures bleiben offen. Web-Staging-Host, eigener Runner,
  DNS/TLS und das separate Supabase-Staging-Projekt sind vorhanden. Die
  Staging-Datenbank darf nicht als Restore-Ziel dienen;
- externe Rechts- und Steuerfreigabe;
- isolierter Restore-Drill und belegte Offsite-Retention.

## Abschlussnachweis

Der finale Abschlusskommentar in Issue #640 enthält als historischer Nachweis mindestens:

- Merge-Commit;
- grüne CI-/Testläufe;
- Deployment-Run;
- `/api/version`-Commit;
- `/api/health`-Status;
- Live-Prüfung der deutschen und englischen Landingpage und Registrierung;
- verbleibende externe Handgriffe mit exakt minimalem Nutzeranteil.
