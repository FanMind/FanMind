# FanMind Mobile Beta – Recovery, EAS und externe Freigaben

## Ziel

Dieses Runbook trennt den im Repository fertigstellbaren Mobile-Code von den einmaligen externen Konten und Einstellungen. Das Vorhandensein von `app.json`, `eas.json`, App-IDs oder Buildprofilen bedeutet nicht, dass bereits ein signierter Store-Build existiert.

## Im Repository umgesetzt

- eigenständige Expo-/React-Native-App, keine WebView-Hülle;
- Deep-Link-Schema `fanmind://`;
- iOS Bundle Identifier und Android Package `ch.fanmind.app`;
- E-Mail-/Passwort-Login;
- SecureStore-Sitzung mit Chunking;
- PKCE-basierte Passwort-Recovery mit kompatiblem Token-Fallback;
- Recovery-Route `fanmind://reset-password`;
- neues Passwort nur nach bestätigter Recovery-Sitzung;
- keine dauerhafte Speicherung vollständiger Recovery-URLs im React-Zustand oder in Refs;
- Kontaktanlage und Kontaktbearbeitung;
- sichtbarer read-only Gesprächsverlauf mit höchstens 100 aktuellen,
  ausdrücklich nach Workspace und Kontakt gefilterten Nachrichten; keine
  Nachrichtenpersistenz im Offline-Cache; neueste Nachrichten zuerst und mit
  sichtbarer manueller Aktualisierung/Fehleranzeige; `Alle` und jede je Fan
  tatsächlich vorhandene Plattform sind direkt umschaltbar;
- Start-Dashboard mit ausschließlich Fans, deren eingehende Nachrichten noch
  kein `seen_at` besitzen; ausgehende Nachrichten erzeugen dort keinen Eintrag;
- direktes manuelles Owner-Follow-up im Fan-Detail mit Grund, Datum und
  Priorität; Member bleiben read-only;
- drei einheitliche Fan-Bereiche für Nachrichten, Follow-ups und
  Kontaktwissen, einzeilige Kennung, nachweisgebundene gespeicherte
  Fan-Analyse sowie klickbare globale/heutige Follow-ups mit Navigation zum
  jeweiligen Fan; eine neue Analyse bleibt bis zur technisch geprüften
  Workspace-Datenschutz-/Aufbewahrungsfreigabe ohne irreführenden Button als
  `In Vorbereitung` markiert;
- quadratischer nativer Splashscreen mit `FM` über `FanMind`, damit die
  Wortmarke auf schmalen Android-Startflächen nicht beschnitten wird;
- Antwortvorschläge kopieren oder über die native Android-/iOS-Teilen-Auswahl
  weitergeben; der Share-Payload enthält ausschließlich den ausgewählten
  Antworttext, niemals Kontakt-, Workspace-, Kontext-, Notiz- oder
  Zugangsdaten, und FanMind führt keinen Versand aus;
- Owner-Rolle, Workspace-Filter plus Supabase RLS bei jeder Kontaktmutation; Member bleiben read-only;
- minimale Duplikatprüfung für Handle plus Quelle;
- verschlüsselte, User-/Workspace-gebundene Offline-Kontaktübersicht mit 24-Stunden-Ablauf, maximal 50 Kontakten und Nur-Lesen-Oberfläche;
- lokaler Logout-Purge für registrierte FanMind-SecureStore-Schlüssel;
- Expo-konforme SecureStore-Schlüssel ohne Doppelpunkte sowie serialisierte Speicherzugriffe;
- einmalige, fail-closed Migration beziehungsweise Bereinigung der früheren v1-SecureStore-Schlüssel beim App-Upgrade;
- begrenzte, serialisierte SecureStore-Schreibfolge mit Cleanup bei Teilfehlern;
- vollständige Account-Löschanfrage in Mobile sowie öffentlicher Webressourcenpfad;
- authentifizierter Status/Widerruf und service-role-only Request-Queue;
- manueller Dry-Run-first Account-Löschprocessor ohne Timer;
- eigener SDK-57-Development-Client über `expo-dev-client`;
- getrennte Mobile-CI mit TypeScript, Expo Doctor, Android-/iOS-JavaScript-Export, isoliertem nativen Android-/iOS-Prebuild, echtem Android-Debug-APK, codesign-freier iOS-Simulator-App und Architekturgrenze;
- native Push-Grundlage mit minimal validierter Follow-up-Navigation,
  Auth-Handoff, Einmalverarbeitung und ausdrücklichem Opt-in für eine
  verschlüsselte, service-role-only Ein-Gerät-Registrierung; Migration,
  Serverkey, reale Registrierung und Zustellung bleiben deaktiviert;
- checksum-gebundener, strikt Staging-only Push-Kontrollpfad mit getrenntem
  read-only Ressourcencheck, separat bestätigtem Migrations-Apply und
  rollback-only Acceptance für synthetische Nicht-Demo-Owner/-Member/-Geräte;
  er wurde noch nicht extern ausgeführt und aktiviert weder Registrierung
  noch Zustellung;
- serverseitiger, standardmäßig deaktivierter Einzelsendevertrag mit fester
  Follow-up-Payload samt einstündiger TTL, Tenant-/Ressourcenprüfung,
  gemeinsam gebundenem server-only Zielkontext, begrenztem Retry und Expo-
  Ticket-/Receipt-Auswertung; ohne separat genehmigten atomaren Ledger gibt es
  keine Route, keinen Timer und keinen realen Provideraufruf;
- konfliktfreie native Splashscreen-Konfiguration mit der bestätigten FanMind-Wortmarke für das dunkle App-Theme;
- getrennte 1024×1024-App-Icons für iOS/Legacy-Android und Android Adaptive
  Icon aus einer eigenständigen Vektorquelle; keine Hochskalierung des
  96×96-Social-Avatars;
- explizite EAS-Umgebungen für `development`, `preview` und `production`;
- Android-Debug-/iOS-Simulator-Validierung ohne Release-/Store-Credentials, die ausdrücklich kein signierter Beta-Build ist.

## Passwort-Recovery

### App-Vertrag

1. Nutzer öffnet `Passwort vergessen?`.
2. Die App ruft `resetPasswordForEmail` mit dem Redirect `fanmind://reset-password` auf.
3. Die sichtbare Bestätigung bleibt unabhängig davon gleich, ob ein Konto existiert.
4. Der Link muss auf demselben Gerät geöffnet werden, auf dem die Recovery angefordert wurde.
5. Die App akzeptiert ausschließlich:
   - einen PKCE-`code`; oder
   - ein vollständiges Paar aus `access_token` und `refresh_token` für kompatible bestehende Links.
6. Gemischte, unvollständige, überlange oder fremde Links werden abgelehnt.
7. Tokens, Codes und vollständige Callback-URLs werden weder protokolliert noch zur Duplikaterkennung im Speicher behalten; dafür werden ausschließlich nicht sensible Boolean-Flags verwendet.
8. Ein PKCE-Code muss zusätzlich durch das Supabase-Ereignis `PASSWORD_RECOVERY` bestätigt werden.
9. Erst nach einer bestätigten Recovery-Sitzung kann `updateUser({ password })` ausgeführt werden.

### Einmalig in Supabase einzurichten

In den Auth-Redirect-Einstellungen des **richtigen FanMind-Projekts** muss exakt folgender Redirect freigegeben werden:

```text
fanmind://reset-password
```

Diese Einstellung darf nicht geraten und nicht im Repository als erledigt markiert werden. Vor der Änderung ist die Projekt-ID mit der aktuellen Production-/späteren Staging-Dokumentation abzugleichen.

### Realer Gerätetest

Die verbindliche, private und SHA-gebundene Android-/iOS-Abnahme ist in
[`DEVICE_ACCEPTANCE.md`](./DEVICE_ACCEPTANCE.md) definiert. Sie verbindet jeden
Gerätenachweis mit dem redigierten Receipt des exakten signierten Builds; die
folgenden Schritte bleiben die Recovery-Teilmenge dieses Gesamtbelegs.

1. internen signierten Build auf einem Testgerät installieren;
2. in der App eine ausschließlich für Tests vorgesehene E-Mail-Adresse eingeben;
3. Recovery-Mail auf demselben Gerät öffnen;
4. prüfen, dass FanMind direkt die Reset-Route öffnet;
5. ungültige oder bereits verwendete Links müssen eine generische Fehlermeldung zeigen;
6. neues Passwort setzen;
7. App vollständig schließen und erneut öffnen;
8. Anmeldung mit dem neuen Passwort prüfen;
9. sicher abmelden und prüfen, dass kein alter Workspace-Zustand sichtbar bleibt.

Keine echten Recovery-URLs, Codes oder Tokens in Screenshots, Tickets oder Chat-Nachrichten kopieren.

## Kontaktanlage und -bearbeitung

### Felder

- Name: Pflicht, maximal 160 Zeichen;
- Handle: optional, ohne Leerzeichen;
- Quelle/Plattform: reine Herkunftsangabe, keine externe Synchronisierung;
- Sprache: kurzer Code wie `de`, `en` oder `de-ch`;
- Status: `new`, `warm`, `buyer`, `vip` oder `inactive`;
- höchstens 20 normalisierte Tags;
- Zusammenfassung und interne Notiz mit begrenzter Länge.

### Autorisierungsgrenze

- Die App verwendet ausschließlich den öffentlichen Supabase-Key und den angemeldeten User-JWT.
- `workspace_id` wird bei Insert, Select und Update ausdrücklich gesetzt beziehungsweise gefiltert.
- RLS bleibt die verbindliche letzte Autorisierungsschicht.
- Kein Service-Role-Key befindet sich in der App.
- Ein Update ohne Datensatz im autorisierten Workspace wird als Fehler behandelt.

### Manueller Negativtest im späteren Staging

- Owner A darf einen Kontakt in Workspace A anlegen und bearbeiten; Member A sieht ihn, erhält aber keine Mutationscontrols.
- Nutzer A darf eine bekannte Kontakt-ID aus Workspace B weder laden noch verändern.
- Gleicher Handle plus gleiche Quelle wird innerhalb des eigenen Workspaces als mögliches Duplikat abgelehnt.
- Ein Kontakt aus einem anderen Workspace darf durch die Duplikatprüfung nicht als Information sichtbar werden.

Dieser Mehrnutzer-Negativtest bleibt an das separate Staging aus #643 gebunden und wird nicht gegen Production-Kundendaten ausgeführt.

## Lokaler Daten-Purge

`Sicher abmelden und lokale Daten entfernen` führt folgende Schritte aus:

1. neue Offline-Schreibvorgänge sperren und bereits gestartete Cache-Vorgänge abwarten;
2. lokale Supabase-Sitzung beenden;
3. alle von FanMind registrierten SecureStore-Schlüssel und deren Chunks einschließlich Offline-Cache entfernen;
4. Recovery-Zustand zurücksetzen;
5. Session im React-Kontext auf `null` setzen;
6. Workspace-Zustand sofort leeren.

Zusätzliche Speichergrenzen:

- eine Sitzung darf höchstens 64 SecureStore-Chunks verwenden;
- der Schlüssel wird vor dem Schreiben der Chunks registriert;
- die erwartete Chunkzahl wird vor den Chunks gespeichert, damit Teilfehler auffindbar bleiben;
- bei einem Schreibfehler werden angelegte Teilstände sofort entfernt;
- nicht vollständig löschbare Schlüssel bleiben registriert und werden beim nächsten Purge erneut versucht;
- ein Registry-Eintrag wird lieber zu lange behalten, als Sitzungsdaten unregistriert zurückzulassen.

Der Offline-Cache verwendet exakt einen registrierten SecureStore-Schlüssel und wird nur nach einem erfolgreichen, ungefilterten Online-Abruf geschrieben. Er enthält höchstens 50 Kontakte, ist maximal 24 Stunden gültig und speichert nur Workspace-Name sowie Kontakt-ID, Workspace-ID, Name, Handle, Plattform, Status und Änderungszeit. Kontaktwissen, Zusammenfassungen, Nachrichten, KI-Inhalte, interne Notizen, Follow-ups und Zugangsdaten werden nicht übernommen. Nur ein Transportstatus `0` darf den Nur-Lesen-Fallback aktivieren; Auth-, RLS- und Serverfehler löschen beziehungsweise verwerfen den Cache fail-closed.

## KI-Unternehmens-Prompt und Antwortprofile

Die mobile Antwortvorschlagsfunktion übernimmt serverseitig den aktiven Workspace-Unternehmens-Prompt und das Standard-Antwortprofil. Die App speichert oder sendet keinen freien Prompttext und benötigt deshalb keine zusätzliche Secret-Konfiguration. Bearbeitung und situationsbezogene Profilauswahl erfolgen zunächst in der Web-Oberfläche; ohne Auswahl bleibt das aktive Standardprofil verbindlich. Sicherheits-, Wahrheits-, Datenschutz- und Manuell-Senden-Regeln haben immer Vorrang.

## Android-Vorabtest mit Expo Go

Der noch unsignierte App-Kern kann bereits auf einem Android-Telefon geprüft werden:

1. die [offizielle Expo-Go-Version 57.0.2](https://github.com/expo/expo-go-releases/releases/tag/Expo-Go-57.0.2) für SDK 57 installieren;
2. auf dem Rechner Node.js `>=22.13.0` und Git bereitstellen;
3. Repository klonen, in `apps/mobile` wechseln und `npm ci` ausführen;
4. `.env.example` nach `.env.local` kopieren und ausschließlich die öffentlichen Supabase-URL, den öffentlichen Anon-/Publishable-Key und `https://fanmind.ch` als API-URL eintragen;
5. `npm run check` und danach `npm run start:go` ausführen;
6. Rechner und Telefon in dasselbe WLAN bringen und den QR-Code mit Expo Go scannen;
7. falls das lokale Netzwerk blockiert, `@expo/ngrok` installieren und `npx expo start --go --tunnel` verwenden.

Solange echtes Staging fehlt, darf dieser Vorabtest nur mit einem eigens dafür vorgesehenen Testkonto erfolgen. Expo Go ersetzt keinen signierten Beta-Build: konfigurierte App-Icons und Splashscreen, eigenständige Installation, verlässliche Deep Links, Push und Store-Verhalten müssen später mit dem signierten APK/AAB geprüft werden. Für native Funktionen ist der eigene Development-Client verbindlich; der Standardbefehl `npm run start` startet deshalb mit `--dev-client`.

## EAS-Konfiguration

Vorhandene Profile in `apps/mobile/eas.json`:

- `development`: echter Development-Client, interne Distribution, Android APK, EAS-Umgebung `development`;
- `native-validation`: erbt `development`, überspringt Signing-Credentials und erzeugt auf iOS ausschließlich einen Simulator-Build;
- `preview`: interne signierte Beta-Distribution, Android APK, EAS-Umgebung `preview`;
- `production`: Store-Build mit automatischer Buildnummer und EAS-Umgebung `production`;
- alle Profile verwenden Node.js `22.13.1`;
- EAS CLI exakt `21.2.0`;
- Build nur aus einem Commit (`requireCommit=true`).

Die öffentliche App-Konfiguration wird in EAS je Umgebung mit exakt diesen
Namen angelegt, aber nicht mit geratenen Werten im Repository:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_FANMIND_API_URL
```

`EXPO_PUBLIC_*`-Werte werden in die App eingebettet und dürfen daher niemals
Service-Role-, OpenAI-, Stripe- oder andere Server-Secrets enthalten.

### Read-only Ressourcenprüfung vor Build und Signing

Der manuelle GitHub-Workflow
`.github/workflows/mobile-release-resource-readiness.yml` ist die vorgelagerte,
nicht schreibende Abnahme. Er akzeptiert nur den geprüften `main`-Stand und die
Bestätigung `verify-mobile-release-resources`. Je Auswahl verwendet er ein
eigenes geschütztes GitHub-Environment:

- `development` → `mobile-development`;
- `preview` → `mobile-preview`;
- `production` → `mobile-production`.

Einmalig je GitHub-Environment zu hinterlegen:

```text
Secret: EXPO_TOKEN
Variable: FANMIND_MOBILE_EAS_OWNER
Variable: FANMIND_MOBILE_EAS_PROJECT_ID
Variable: FANMIND_MOBILE_SUPABASE_PROJECT_REF
Variable: FANMIND_PRODUCTION_SUPABASE_PROJECT_REF
Variable: FANMIND_MOBILE_API_ORIGIN
```

Die EAS-Umgebung selbst enthält ausschließlich die drei freigegebenen
`EXPO_PUBLIC_*`-Werte. Die echte, zuvor über `eas init` bestätigte Owner- und
Projektbindung liegt als geschützte Variable im jeweiligen GitHub-Environment.
`apps/mobile/app.config.js` ergänzt sie erst bei der Expo-Auswertung; die
statische `app.json` bleibt frei von echten EAS-IDs. Der Prüfer verlangt
zusätzlich `ch.fanmind.app` für Android und iOS sowie `fanmind` als Schema.
Development und Preview dürfen weder den Production-Supabase-Ref noch
`https://fanmind.ch` verwenden; Production muss exakt auf beide bestätigten
Production-Ziele zeigen.

Die EAS CLI ist auf `21.2.0` gepinnt. Der Workflow führt nur `project:info` und
`env:exec` aus. Die Schalter für EAS Build, Submit und Update stehen zwingend
auf `false`; Signing Credentials, Keystore, Apple-Team- oder Store-IDs werden
nicht geladen. Die Ausgabe enthält nur redigierte Statuscodes, niemals
EAS-Projekt-ID, Owner, URL oder Key-Werte.

Dieser Vorabcheck ist vorbereitet, aber noch nicht extern ausgeführt. Ein
grüner Lauf bestätigt nur Ressourcenbindung und öffentliche
Client-Konfiguration. Er erzeugt kein Binary und belegt weder Signing, Android
Internal Testing noch TestFlight.

### Getrennter Staging-Kontrollpfad für Push-Registrierung

Die Datenbankvorbereitung für Push besitzt einen eigenen Kontrollpfad und ist
nicht Teil des EAS-Ressourcenchecks oder eines Mobile-Builds:

- `FanMind Mobile Push Staging Resource Readiness` prüft read-only den exakten
  `main`-Commit, Staging-API, Staging-Supabase, Staging-DB und die
  synthetischen Nicht-Demo-Ressourcen;
- `FanMind Mobile Push Staging Migration` wendet ausschließlich die
  festgeschriebene Migration
  `20260729120000_mobile_push_registrations.sql` nach separater Bestätigung
  auf Staging an und prüft RLS sowie die service-role-only Rechte;
- `FanMind Mobile Push Staging Acceptance` lässt Browserzugriffe scheitern,
  führt service-role CRUD nur mit synthetischen Werten aus, rollt vollständig
  zurück und belegt den Cleanup.

Jeder Workflow verlangt zusätzlich den manuell bestätigten exakten
`main`-Commit und das geschützte GitHub-Environment `staging`. Production-API,
Production-Supabase und Production-DB-Host sind ausdrücklich ausgeschlossen.
Es werden keine echten Push-Tokens erzeugt oder ausgegeben und kein Expo-,
FCM- oder APNs-Endpunkt aufgerufen. Das Runbook steht in
`docs/operations/MOBILE_PUSH_STAGING_CONTROL.md`.

### Noch deaktivierter Push-Delivery-Vertrag

`docs/mobile/PUSH_DELIVERY.md` beschreibt den bereits synthetisch getesteten
Serverbaustein. Er kann nur in Staging, nach unabhängiger EAS-Projektprüfung
und nach unabhängiger Prüfung des Staging-App-Hosts sowie der Staging- und
Production-Supabase-Refs für genau ein fälliges offenes Follow-up arbeiten.
Sichtbarer Text ist fest; CRM-Inhalt wird weder geladen noch übertragen. Expo-
Tickets und Receipts werden nur über feste redigierte Zustände verarbeitet.

Der dafür notwendige persistente Idempotenz-/Receipt-Ledger existiert noch
nicht. Seine Tabellen- und Aufbewahrungsentscheidung sowie eine
checksum-gebundene Migration brauchen eine eigene Genehmigung und
rollback-only Staging-Abnahme. Die Reserve-RPC muss alle Workspace-,
Membership-, Kontakt-, Follow-up- und Registrierungsgrenzen in derselben
Transaktion mit demselben validierten Supabase-Binding wie der Loader erneut
prüfen und den aktuellen Token-Fingerprint atomar binden. Bis dahin bleibt der Baustein ohne Route,
Timer/Worker und externen Request fail-closed; CI blockiert eine vorzeitige
Verdrahtung. Production ist nicht freigeschaltet.

### Manuell freigegebener signierter interner Build

Der nachgelagerte Workflow
`.github/workflows/mobile-signed-internal-build.yml` ist die kontrollierte
Brücke vom Read-only-Nachweis zu genau einem EAS-Build. Er kann ausschließlich
auf `main` mit der Bestätigung `queue-one-signed-mobile-build` gestartet werden
und erlaubt nur:

- Environment/Profil `development` oder `preview`;
- Plattform `android` oder `ios`;
- genau den ausgelösten `main`-Commit;
- bereits vorhandene, mit `--freeze-credentials` unverändert verwendete
  Signing-Credentials.

Der Workflow wiederholt `project:info` und die redigierte
`env:exec`-Ressourcenprüfung, bevor der Build-Schalter nur für die Build-Schritte
geöffnet wird. Danach führt er `eas build` mit gepinnter CLI,
`--non-interactive`, `--no-wait`, `--json` und `--freeze-credentials` aus.
Submit, Update, Production-Profil, automatische Store-Übertragung und
Credential-Erzeugung sind ausgeschlossen.

Die EAS-Antwort wird aus einer privaten temporären Datei nur auf genau einen
passenden Commit, Plattform und Profil geprüft. ID und URL werden weder
ausgegeben noch in einen Receipt geschrieben. Nur die vollständig validierte
Antwort bedeutet „Build eingereiht“. Danach liest derselbe Ablauf den
EAS-Endstatus mit `build:view --json`, ohne Build-ID oder URL auszugeben. Nur
derselbe Commit, dieselbe Plattform, dasselbe Profil, interne Distribution,
Status `FINISHED`, ein gültiger Abschlusszeitpunkt und ein vorhandenes
HTTPS-Artefakt ergeben den redigierten Abschlussnachweis. Scheitert der
Queue-Aufruf, bleibt die Abschlussprüfung unklar oder ist eine Antwort
ungültig, wird der Lauf als `indeterminate-do-not-retry` ausgewiesen und darf
nicht wiederholt werden, bevor das geschützte EAS-Projekt direkt geprüft wurde.
Die Installation auf einem realen Gerät bleibt ein eigener Nachweis. Der
Workflow lädt das signierte APK/IPA ausdrücklich nicht in GitHub-Artefakte;
dort wird ausschließlich der kurzlebige redigierte Receipt gespeichert. Das
interne Installationsartefakt bleibt im geschützten EAS-Projekt und wird für
den Gerätetest von einem berechtigten Operator direkt aus dem überprüften EAS-
Build übernommen, privat behandelt und nach der Abnahme lokal gelöscht. Das
ist keine Play- oder App-Store-Veröffentlichung.

### Native-Prüfung ohne Release-/Store-Credentials

Der lokale Prebuild-Nachweis benötigt weder EAS-Login noch Signing:

```bash
cd apps/mobile
npm run native:prebuild:check
```

Er generiert Android und iOS in einem temporären Verzeichnis, prüft Package- und
Bundle-ID, Deep-Link-Schema, SecureStore-Backup-Regeln, Verschlüsselungsangabe,
dunkles App-Theme, Splashscreen und das Fehlen serverseitiger Secret-Bezeichner
und entfernt den temporären Stand anschließend.

Die GitHub-Native-CI generiert danach frische native Projekte, kompiliert
`assembleDebug` auf Android mit dem lokalen Standard-Debug-Key und baut mit
`CODE_SIGNING_ALLOWED=NO` eine iOS-Simulator-App. Die Artefakte heißen
ausdrücklich `not-for-release`, verwenden keine Release-/Store-Credentials und
belegen weder Play-Internal-Testing noch TestFlight.

Nach `eas init` kann zusätzlich das credentialfreie EAS-Profil verwendet werden:

```bash
cd apps/mobile
npx eas-cli@21.2.0 build --platform android --profile native-validation
npx eas-cli@21.2.0 build --platform ios --profile native-validation
```

Das Android-Artefakt ist ein nicht mit Production-/Store-Credentials signierter
Debug-Validierungsbuild; das iOS-Artefakt läuft nur im Simulator. Beides ist
**kein signierter Beta-Build**, keine TestFlight-Freigabe und keine
Store-Einreichung. Auch diese Cloud-Builds brauchen ein Expo-Konto und eine
echte EAS-Projekt-ID.

### Einmalige externe Einrichtung

Noch nicht durch Code erledigt:

1. Expo-Organisation beziehungsweise Expo-Konto festlegen.
2. In einer kontrollierten lokalen Arbeitskopie `eas init` ausführen, Owner
   und echte EAS-Projekt-ID bestätigen und anschließend ausschließlich als
   geschützte GitHub-Environment-Variablen hinterlegen; keine feste ID in
   `app.json` committen.
3. In EAS die drei Umgebungen `development`, `preview` und `production` mit den jeweils richtigen öffentlichen FanMind-Werten anlegen.
4. `EXPO_TOKEN` und die erwarteten Projekt-/Zielvariablen in den drei
   geschützten GitHub-Environments hinterlegen.
5. Den Read-only-Ressourcencheck zuerst für Development und Preview, danach
   separat für Production ausführen.
6. Android-Keystore kontrolliert durch EAS erzeugen oder einen bestätigten bestehenden Keystore hinterlegen.
7. Für iOS ein bezahltes Apple-Developer-Konto bereitstellen.
8. Für interne iOS-Ad-hoc-Builds Testgeräte registrieren.
9. App in App Store Connect und Google Play Console anlegen.
10. App Store Connect App-ID und Google-Service-Account erst danach in die Submit-Konfiguration aufnehmen.
11. Zugriff auf interne Build-URLs im Expo-Projekt auf authentifizierte Teammitglieder begrenzen.

Keine erfundene EAS-Projekt-ID, Apple-Team-ID, App-Store-ID oder Google-Service-Account-Datei eintragen.

### Interner Android-Build

Nach EAS-Einrichtung:

```bash
cd apps/mobile
npx eas-cli@21.2.0 build --platform android --profile preview
```

Das Preview-Profil erzeugt ein direkt installierbares APK für den internen Test. Der Build-Link ist wie ein vertrauliches internes Artefakt zu behandeln.

### Kontrollierter Android-Store-Build

Der manuelle Workflow
`.github/workflows/mobile-android-store-build.yml` erzeugt genau ein signiertes
Android-App-Bundle aus dem geprüften `main`-Commit. Er ist ausschließlich an
das geschützte Environment `mobile-production`, das EAS-Profil `production`,
die Plattform `android` und die Bestätigung
`queue-one-android-store-build` gebunden.

Vor dem Build werden die vorhandene EAS-Projektbindung sowie die öffentlichen
Production-Ziele erneut geprüft. Production muss exakt auf das bestätigte
FanMind-Supabase-Projekt und `https://fanmind.ch` zeigen. Der Workflow verwendet
vorhandene Signing-Credentials unverändert (`--freeze-credentials`), wartet auf
den terminalen EAS-Status und akzeptiert nur ein Store-Artefakt für denselben
Commit. Er speichert ausschließlich einen redaktierten, kurzlebigen Receipt;
Build-ID und private Artefakt-URL werden nicht in GitHub ausgegeben.

Submit und Update bleiben in diesem Workflow technisch deaktiviert. Das AAB
wird erst in einem separaten Schritt in Google Play übertragen, nachdem der
Play-App-Datensatz, die Store-Fragebögen, die Datenschutzfreigabe und die
unmittelbare Veröffentlichungsbestätigung vorliegen. Ein erfolgreicher
Store-Build ist deshalb noch keine Veröffentlichung.

### Interner iOS-Build

Nach Apple-Account und Geräte-Registrierung:

```bash
cd apps/mobile
npx eas-cli@21.2.0 device:create
npx eas-cli@21.2.0 build --platform ios --profile preview
```

Bei Ad-hoc-Distribution können nur Geräte installiert werden, deren UDID in der verwendeten Provisioning-Datei enthalten ist.

### TestFlight und Play Internal Testing

Erst nach realen Gerätetests und Store-Voraussetzungen:

```bash
cd apps/mobile
npx eas-cli@21.2.0 build --platform ios --profile production
npx eas-cli@21.2.0 build --platform android --profile production
```

Die anschließende Übertragung benötigt echte Store-Konten. EAS Submit lädt Binärdateien hoch, ersetzt aber keine Store-Texte, Screenshots, Datenschutzangaben oder Review-Freigaben.

Der erste iOS-Release ist bewusst iPhone-only. `supportsTablet=false` und der
isolierte Native-Prebuild erzwingen `TARGETED_DEVICE_FAMILY = 1`. Eine spätere
iPad-Freigabe benötigt eine eigene Layout-, Geräte- und Screenshot-Abnahme und
wird nicht stillschweigend über denselben Beta-Nachweis mitbehauptet.

## Branding und Store-Unterlagen

Die bestätigte FanMind-Wortmarke liegt unverändert unter
`apps/mobile/assets/branding/fanmind-wordmark.png` und wird über das
`expo-splash-screen`-Config-Plugin nativ eingebunden. Das über
`expo-system-ui` verbindlich dunkle App-Theme verwendet genau eine
Splashscreen-Variante, damit iOS keine widersprüchlichen Interface-Style-Werte
generiert. Die Quelle ist 754 × 252 Pixel groß und wird mit 300 Pixel
Bildbreite ausschließlich verkleinert, nicht hochskaliert.

Die Wortmarke bleibt ausdrücklich **vom Store-App-Icon getrennt**. Für das
App-Icon besteht eine eigenständige 1024 × 1024 Pixel große Icon-Quelle mit dem
bereits in FanMind verwendeten weißen `F` und cyan-blauen `M`. Daraus sind zwei
native PNG-Verträge erzeugt:

- `fanmind-app-icon.png`: vollständig deckend für iOS und Legacy-Android;
- `fanmind-adaptive-icon.png`: transparentes, innerhalb der Android-Safe-Zone
  skaliertes Foreground bei festem dunklem Hintergrund.
- `fanmind-notification-icon.png`: weißes, transparentes Android-Small-Icon
  für den festen Kanal `followup-reminders`; die System-Akzentfarbe ist
  `#149EF2`.

Die bearbeitbaren SVG-Quellen liegen im selben Branding-Ordner. Das vorhandene
96 × 96 Pixel große Social-Avatar-Asset wurde nicht hochskaliert. Der isolierte
Native-Prebuild muss sowohl das iOS-AppIcon-Set als auch Androids Adaptive
Foreground tatsächlich erzeugen. Die visuelle Abnahme unter realen
Android-/iOS-Masken bleibt an den ersten signierten Build gebunden.

Vorbereitete deutsche und englische Store-Texte, URLs, Screenshot-Slots und die
noch manuell in den Store-Portalen zu bestätigenden Datenschutzangaben stehen in
`docs/mobile/STORE_LISTING.md`. Die getrennte technische Vorlage für Apple App
Privacy und Google Play Data Safety steht in
`docs/mobile/STORE_PRIVACY_DECLARATIONS.md`; sie bleibt bis zur Prüfung des
signierten Builds und zur externen Datenschutz-/Rechtsfreigabe ein Entwurf.

`npm run store:check` prüft die Store-Texte vor jedem Release zusätzlich gegen
die aktuellen Zeichenlimits, die sechs synthetischen Screenshot-Slots, die
bestätigte Wortmarke, beide Iconverträge, native App-IDs, exakt EAS CLI
`21.2.0` sowie eine ausschließlich interne Android-Draft-Konfiguration. Der
Check führt keinen Build, Submit oder Portalzugriff aus.

Der iOS-Prebuild erzeugt zusätzlich ein eigenes `PrivacyInfo.xcprivacy` mit den
Required-Reason-APIs der installierten Expo-/React-Native-Bibliotheken, ohne
Tracking-Domains. Der Android-Prebuild wird gegen `compileSdk=36` und
`targetSdk=36` geprüft. Beides ist ein technischer Store-Readiness-Nachweis,
aber weder eine App-Privacy-Portalantwort noch ein signierter Store-Build.

## Noch offen nach diesem Block

- visuelle Abnahme der vorbereiteten App-Icons in signierten Android-/iOS-Builds;
- echter Recovery-E-Mail-/Gerätetest nach Supabase-Redirect-Freigabe;
- EAS-Projekt-ID und Signing Credentials;
- Expo-Token, geschützte Mobile-Environments und drei erfolgreiche
  Read-only-Ressourcenchecks;
- reale öffentliche EAS-Werte in getrennten Development-/Preview-/Production-Umgebungen;
- Android Internal Testing und iOS TestFlight;
- Push-Migration und dedizierten Serverkey kontrolliert aktivieren, danach
  nach grünem Ressourcencheck, Apply und rollback-only Acceptance die
  Berechtigung und Token-Registrierung im signierten Build real abnehmen;
- echte Follow-up-Zustellung erst nach gesonderter Staging-/Datenschutzprüfung;
- realer Account-Löschantrag/Widerruf auf signiertem Android-/iOS-Gerät;
- reale Android-/iOS-Gerätetestprotokolle;
- Store-Datenschutzangaben und Screenshots final abnehmen; Metadaten sind vorbereitet.
- iPad-Unterstützung erst in einer separaten späteren Phase mit eigener
  Layout-, Geräte- und Screenshot-Abnahme aktivieren.

Diese Punkte bleiben sichtbar offen und dürfen nicht allein aufgrund der vorhandenen Konfigurationsdateien als abgeschlossen markiert werden.
