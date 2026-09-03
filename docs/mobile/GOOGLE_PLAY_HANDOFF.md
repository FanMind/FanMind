# Google Play handoff – FanMind Android 1.0.0

## Zweck und aktueller Stand

Dieses Dokument ist die operatorische Übergabe für den Android-Test und die
spätere öffentliche Veröffentlichung. Es führt selbst keine Portalaktion aus.

Am 3. September 2026 wurde das verifizierte Android-`1.0.0`-AAB im
geschlossenen Google-Play-Alpha-Track für Deutschland, Österreich und die
Schweiz veröffentlicht. Die Tester werden über die E-Mail-Liste `FanMind Alpha
Tester` verwaltet. Diese Veröffentlichung macht die App nur für zugelassene,
beigetretene Tester verfügbar; sie ist keine öffentliche Production-
Freigabe. Der Portalnachweis verlangt derzeit mindestens zwölf angemeldete
Tester und eine Testdauer von mindestens 14 Tagen. Dieser Lauf beginnt erst,
wenn FanMind übergabereif ist und die Tester tatsächlich beigetreten sind.

## Unveränderliche Release-Bindung

| Feld | Verbindlicher Wert |
|---|---|
| App | FanMind |
| Version | `1.0.0` |
| Android Package | `ch.fanmind.app` |
| AAB-Merge | `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` |
| Production Readiness | Lauf `33316105624`, Job `99269748215`, bestanden |
| Store Build | Lauf `33316172583`, Job `99269924756`, bestanden |
| Play-Track | Geschlossener Test – Alpha, veröffentlicht am 3. September 2026 |
| Datenschutz | `https://fanmind.ch/datenschutz` |
| Account-Löschung | `https://fanmind.ch/account-deletion` |
| Recovery Scheme | `fanmind://reset-password` |

Genau das bereits verifizierte Android-`1.0.0`-AAB ist für den aktuellen
Alpha-Baseline-Test wiederzuverwenden. Keinen neuen Build starten, keine Versionsnummer
erhöhen und keine Signing Credentials neu anlegen, nur um die Portalarbeit
fortzusetzen. Falls Google oder der Artefaktbestand später einen echten
Falsifikationsnachweis liefert – beispielsweise nicht abrufbares oder falsch
gebundenes AAB – ist zuerst ein neuer explizit autorisierter Release-Vorgang
zu planen; kein automatischer Retry.

## Bereits vorbereitet

- deutsche und englische Store-Beschreibung sowie Google-Kurzbeschreibung;
- Kategorie `Business`, B2B-/Erwachsenen-Zielgrenze, keine Werbung und keine
  Mobile-In-App-Käufe als technischer Portalentwurf;
- sechs Android-Screenshot-Motive mit synthetischer Staging-Datengrenze;
- deckendes 512×512-Google-Play-Icon und sprachneutrale
  1024×500-Feature-Grafik aus den bestehenden FanMind-Vektorquellen;
- technische Google-Play-Data-Safety-Matrix in
  `docs/mobile/STORE_PRIVACY_DECLARATIONS.md`;
- öffentlich erreichbare Support-, Datenschutz- und Account-Löschseiten;
- Production-Auth-Redirect `fanmind://reset-password`;
- signierter Android Preview als historische UI/Runtime-Evidence;
- verifiziertes Production-AAB samt redacted Production-Receipt für den
  späteren Play-Upload und den daran gebundenen 19-Punkte-Gerätelauf.

## Vor Beginn des 14-Tage-Tests noch ausführbar

1. Die beiden reproduzierbaren Google-Play-Grafiken mit
   `cd apps/mobile && npm run store:render && npm run store:check` prüfen.
2. Review-Zugang, englische Prüferhinweise und private Testerorganisation aus
   `docs/mobile/STORE_REVIEW_ACCESS.md` und
   `docs/mobile/STORE_TESTER_PROGRAM.md` vorbereiten. Keine Zugangsdaten oder
   Tester-E-Mails in Git ablegen.
3. Technische Data-Safety-Antworten gemeinsam mit Datenschutz/Recht sowie den
   aktuellen Supabase-/OpenAI-Verträgen final bestätigen.
4. Den vorhandenen privaten Android-Production-Receipt aus Store-Build
   `33316172583` sicher aufbewahren. Noch keinen
   19-Punkte-PASS und keine finalen Screenshots erzeugen: Die Owner-Entscheidung
   bindet diese Abnahme an die spätere Installation aus dem Play-Test-Track.

Fehlt der Receipt oder ein Testzugang, bleibt der jeweilige Punkt offen. Das
rechtfertigt keinen neuen Build und keine erfundene Abnahme.

## Ablauf zum Start des 14-Tage-Tests

1. Mindestens zwölf echte Testpersonen in der bestehenden E-Mail-Liste
   verwalten; keine Adressen im Repository speichern.
2. Allen Testern den Opt-in-Link des Alpha-Tracks geben. Gezählt werden erst
   Tester, die mit dem eingetragenen Google-Konto beitreten.
3. Sobald der Download im Play-Test-Track verfügbar ist, genau diesen Store-
   Install auf einem realen Android-Gerät verwenden. Den unveränderten,
   redacted Android-Production-Receipt aus Store-Build `33316172583` / Job
   `99269924756` für Commit
   `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` privat mit Modus `0600`
   bereitstellen; niemals den älteren Preview-Receipt als Store-Nachweis
   verwenden. Erst dann die private, vollständig `pending` gesetzte Datei mit
   `npm run mobile:device:acceptance:prepare` erzeugen und alle 19 Punkte aus
   `docs/mobile/DEVICE_ACCEPTANCE.md` durchführen.
4. Den privaten Validator ausführen und nur dessen redacted PASS-Zähler plus
   Evidence-SHA übernehmen. Private Datei, Receipt, Testkonto und Recovery-
   Links niemals nach Git oder in ein Issue übertragen.
5. Aus demselben synthetischen Test-Workspace sechs reale Android-Screenshots
   erzeugen, auf sichtbare E-Mails, Tokens, IDs, Recovery-Links und Kunden-
   beziehungsweise Production-Daten prüfen und anschließend hochladen.
6. Erst nach grüner Portalvollständigkeit, vollständigem Geräte-PASS und
   abgeschlossenem Testprogramm
   eine Review-Einreichung separat bestätigen. Veröffentlichung oder Rollout
   niemals aus einem grünen Build oder Upload ableiten.

## Harte Grenzen

- kein zweites AAB und kein automatischer EAS-Retry;
- kein Submit, Update, Review oder öffentlicher Rollout ohne den jeweils
  sichtbaren Portalzustand und die dafür erforderliche Bestätigung;
- keine Production-/Kundendaten in Tests oder Screenshots;
- keine Push-Zustellung aktivieren; die Push-Grundlage bleibt separat;
- iPhone-App-Store-Metadaten dürfen separat vorbereitet werden; iOS-Build,
  TestFlight und iPhone-Geräteabnahme gehören weiterhin zu Phase 8;
- keine rechtliche Annahme aus technischen Tests ableiten.
