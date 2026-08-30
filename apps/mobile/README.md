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
- Start-Dashboard mit ausschließlich den Fans, die noch ungesehene eingehende
  Nachrichten besitzen, plus offenem Follow-up-Zähler und den am aktuellen
  Tag fälligen, direkt zum Fan führenden Follow-ups; beim erneuten Fokus wird
  der Zustand frisch geladen. Die Tageszahl ist exakt, bis zu 1.000 Einträge
  werden seitenweise geladen, semantisch nach Priorität sortiert und eine
  mögliche Begrenzung wird sichtbar ausgewiesen; das Dashboard zeigt davon
  höchstens die wichtigsten 20;
- Kontaktliste und Suche;
- Kontakt als Workspace-Owner in Mobile anlegen und bearbeiten; Teammitglieder sehen CRM-Daten nur lesend;
- Kontaktdetail mit den für jeden Fan verfügbaren Bereichen `Nachrichten`,
  `Follow-ups` und `Kontaktwissen`; Profil und Tags liegen im Kontaktwissen,
  die Kennung bleibt im Kopf einzeilig. Der sichtbare, read-only
  Gesprächsverlauf aus bis zu 100 aktuellen, per Workspace und Kontakt
  gefilterten Nachrichten; neueste Nachrichten erscheinen zuerst, der Verlauf
  lässt sich sichtbar aktualisieren und pro Fan dynamisch über `Alle` sowie
  jede tatsächlich vorhandene Plattform filtern;
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
- gespeicherte Fan-Analyse im Kontaktwissen nur zusammen mit Herkunftszeitraum,
  Stichprobengröße, Konfidenz und Prüfstatus lesen; fehlen diese Nachweise,
  bleibt die Darstellung fail-closed. Die Bearer-authentifizierte
  Owner-Neuerzeugung ist serverseitig vorbereitet, wird in Mobile aber bis zur
  technisch aktivierten und geprüften Workspace-Datenschutz-/Aufbewahrungs-
  Freigabe ehrlich als `In Vorbereitung` ohne Aktionsbutton gezeigt; keine
  Diagnose und keine sensiblen Ableitungen;
- Follow-up als Owner direkt im Fan-Detail oder aus einem KI-Vorschlag speichern;
- offene Follow-ups global oder je Fan anzeigen; globale und heutige Einträge
  führen in den Follow-up-Bereich des jeweiligen Fans. Owner können
  abschließen, Teammitglieder bleiben read-only;
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
- nativer quadratischer Splashscreen mit `FM` über der bestätigten
  FanMind-Wortmarke für das dunkle App-Theme;
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
ausgegeben. Preview und Production wurden inzwischen über die geschützten
Läufe `33298699290` beziehungsweise `33316105624` für ihre exakten
Merge-Commits bestätigt; Development bleibt nur bei tatsächlichem Bedarf
separat abzunehmen.

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

Die aktuelle Android-Abnahme verwendet nach Download aus dem Google-Play-
Test-Track den privaten Geräte-Abnahmevalidator aus
`docs/mobile/DEVICE_ACCEPTANCE.md`. Der neue
Vorbereitungsbefehl `npm run mobile:device:acceptance:prepare` bindet die
private Arbeitsdatei an den redigierten Receipt, lässt aber alle 19 realen
Prüfpunkte fail-closed auf `pending`. Er führt selbst keinen Build,
Store-Upload oder Production-Schreibzugriff aus. Ein separater iOS-Nachweis
folgt nur, wenn Phase 8 ausdrücklich startet. App-Store-Metadaten,
Supportseite und Screenshot-/Review-Plan sind bereits vorbereitet und gelten
nicht als iOS-Build oder TestFlight.

## Kontrollierter Android-Store-Build

Der separate Workflow `FanMind Mobile Android Store Build` bereitet die
Android-Erstveröffentlichung als Version `1.0.0` vor. Er ist nur auf `main`,
das geschützte Environment `mobile-production`, das Profil `production` und
Android begrenzt. Nach `npm ci` muss auf genau diesem Commit zunächst
`npm run store:check` bestehen; erst danach werden EAS-Projektbindung und die
öffentlichen FanMind-Production-Ziele erneut geprüft.

Der Build erzeugt explizit ein Android App Bundle, verwendet ausschließlich
vorhandene Credentials mit `--freeze-credentials` und akzeptiert nur ein
terminal erfolgreiches Store-Artefakt für denselben Commit. GitHub erhält nur
einen kurzlebigen redaktierten Receipt ohne Build-ID oder private URL. EAS
Submit und Update bleiben deaktiviert. Play-App-Datensatz, Data Safety,
Testtrack und Veröffentlichung sind nachgelagerte Portalabnahmen und werden
nicht aus einem erfolgreichen AAB abgeleitet.

Der erste kontrollierte Production-Lauf ist abgeschlossen: Readiness
`33316105624` und Store-Build `33316172583` sind auf dem exakten Merge
`e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` erfolgreich; genau ein
Android-`1.0.0`-AAB wurde terminal verifiziert. Submit und Update blieben
deaktiviert. Der Build darf für die Portalfortsetzung nicht wiederholt werden.
Google-Identitätsprüfung, App-Datensatz, Testtrack, Upload und Veröffentlichung
bleiben extern offen.

## EAS-Profile

Die Profile binden ihre öffentlichen Werte ausdrücklich an getrennte
EAS-Umgebungen:

| Profil | Umgebung | Zweck |
|---|---|---|
| `development` | `development` | signierbarer interner Development-Client |
| `native-validation` | `development` | Android-Debug-/iOS-Simulator-Prüfung ohne Release-/Store-Credentials |
| `preview` | `preview` | signierter interner Beta-Build |
| `production` | `production` | Android App Bundle für getrennte Store-Abnahme |

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

Vor einem weiteren signierten EAS-Build müssen EAS-Projekt-ID, Signierung und
Store-Konten weiterhin bewusst geprüft werden. Für Android existieren bereits
ein akzeptierter Preview-Build und genau ein verifiziertes Production-AAB;
dieses AAB darf für die Play-Portalfortsetzung nicht neu gebaut werden. Private
Werte werden nicht erfunden oder aus der Web-Anwendung übernommen.

## App-Identität

```text
Name: FanMind
Deep-Link-Schema: fanmind://
Recovery-Route: fanmind://reset-password
iOS Bundle Identifier: ch.fanmind.app
Android Package: ch.fanmind.app
```

Der Recovery-Redirect ist seit 30. August 2026 in der bestätigten
Supabase-Production-Auth-Allowlist gespeichert. Der reale positive/negative
E-Mail-/Gerätetest bleibt separat offen; Details stehen in
`docs/mobile/BETA_RELEASE.md`.

## Release-Unabhängigkeit

- Website-Deployments veröffentlichen keine Mobile-App.
- Mobile-App-Builds deployen keine Website.
- Mobile-Änderungen werden unter `apps/mobile/**` geprüft.
- Backend-Vertragsänderungen müssen Web und Mobile separat abnehmen.
- Neue Website-Komponenten werden nicht automatisch in Mobile übernommen.

## Nächste Mobile-Schritte

1. Nach Google-Kontofreigabe den Play-App-Datensatz anlegen und das bestehende
   Android-`1.0.0`-AAB ohne Neubau in den verlangten Test-Track laden.
2. Erst nach Download aus diesem Track den gespeicherten Supabase-Redirect
   `fanmind://reset-password`, den vollständigen privaten receipt-gebundenen
   19-Punkte-Android-Gerätenachweis sowie App-Icon/Splashscreen real abnehmen.
3. Den getrennten read-only Push-Ressourcencheck, Staging-Apply und die
   rollback-only Acceptance durchführen; erst danach Migration/Secret-
   Konfiguration in einem signierten Development-/Preview-Build real testen;
   den separat zu genehmigenden Delivery-Ledger entwerfen, migrieren und
   rollback-only abnehmen; danach genau einen synthetischen Send-/Receipt-Test
   ausführen.
4. Data Safety und das portalgeforderte Testprogramm vervollständigen, nach
   der Track-Installation sechs reale Screenshots erstellen und anschließend
   die Review-/Rollout-Entscheidung getrennt bestätigen. Die exakte Reihenfolge
   steht in `docs/mobile/GOOGLE_PLAY_HANDOFF.md`.
5. Die vorbereiteten Store-Texte, technischen Datenschutzentwürfe und
   Screenshot-Matrix nach realen Gerätetests sowie externer
   Datenschutz-/Rechtsprüfung final abnehmen.
6. Die vorbereiteten iPhone-App-Store-Unterlagen aus
   `docs/mobile/APP_STORE_HANDOFF.md` verwenden; iOS-Signierung, Gerätetest und
   TestFlight erst in Phase 8 beginnen.

Der lokale Befehl `npm run store:check` prüft davor ohne Portalzugriff die
Zeichenlimits, App-IDs, Wortmarke, Icons, Screenshot-Matrix sowie die exakt
gepinnte EAS- und sichere Internal-/Draft-Submit-Konfiguration.

Die Produkt- und Release-Checkliste für diese Schritte steht in
`docs/mobile/BETA_RELEASE.md`; die vorbereiteten Store-Metadaten stehen in
`docs/mobile/STORE_LISTING.md`, die portalnahe Datenschutzvorlage in
`docs/mobile/STORE_PRIVACY_DECLARATIONS.md`; das Apple-Handoff steht in
`docs/mobile/APP_STORE_HANDOFF.md`.
