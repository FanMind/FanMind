# Google Play handoff – FanMind Android 1.0.0

## Zweck und aktueller Stand

Dieses Dokument ist die operatorische Übergabe für die erste Android-
Veröffentlichung. Es ist kein Nachweis einer Google-Freigabe und führt keine
Portalaktion aus.

Am 30. August 2026 ist die Repository-, Production-Environment- und
AAB-Vorbereitung abgeschlossen. Google prüft weiterhin die
Entwickleridentität beziehungsweise die eingereichten Dokumente. Solange diese
Prüfung läuft, bleiben Kontakttelefon-Verifizierung und `App erstellen`
gesperrt. Die bestehende tägliche Statusüberwachung meldet nur eine relevante
Änderung.

## Unveränderliche Release-Bindung

| Feld | Verbindlicher Wert |
|---|---|
| App | FanMind |
| Version | `1.0.0` |
| Android Package | `ch.fanmind.app` |
| AAB-Merge | `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` |
| Production Readiness | Lauf `33316105624`, Job `99269748215`, bestanden |
| Store Build | Lauf `33316172583`, Job `99269924756`, bestanden |
| Submit / Update | deaktiviert |
| Datenschutz | `https://fanmind.ch/datenschutz` |
| Account-Löschung | `https://fanmind.ch/account-deletion` |
| Recovery Scheme | `fanmind://reset-password` |

Genau das bereits verifizierte Android-`1.0.0`-AAB ist nach der Google-
Freigabe wiederzuverwenden. Keinen neuen Build starten, keine Versionsnummer
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
- signierter Android Preview als vorhandene Build-Evidence; der private
  19-Punkte-Gerätelauf folgt erst nach Installation aus dem Play-Test-Track;
- verifiziertes Production-AAB für den späteren Play-Upload.

## Vor Google-Freigabe noch ausführbar

1. Die beiden reproduzierbaren Google-Play-Grafiken mit
   `cd apps/mobile && npm run store:render && npm run store:check` prüfen.
2. Review-Zugang, englische Prüferhinweise und private Testerorganisation aus
   `docs/mobile/STORE_REVIEW_ACCESS.md` und
   `docs/mobile/STORE_TESTER_PROGRAM.md` vorbereiten. Keine Zugangsdaten oder
   Tester-E-Mails in Git ablegen.
3. Technische Data-Safety-Antworten gemeinsam mit Datenschutz/Recht sowie den
   aktuellen Supabase-/OpenAI-Verträgen final bestätigen.
4. Den vorhandenen privaten Preview-Receipt sicher aufbewahren. Noch keinen
   19-Punkte-PASS und keine finalen Screenshots erzeugen: Die Owner-Entscheidung
   bindet diese Abnahme an die spätere Installation aus dem Play-Test-Track.

Fehlt der Receipt oder ein Testzugang, bleibt der jeweilige Punkt offen. Das
rechtfertigt keinen neuen Build und keine erfundene Abnahme.

## Ablauf unmittelbar nach Google-Freigabe

1. Im exakt bestehenden FanMind-Entwicklerkonto die freigeschaltete
   Kontakttelefon-Verifizierung und den angezeigten Kontostatus abschließen.
2. Den Play-App-Datensatz für `FanMind` / `ch.fanmind.app` anlegen und die im
   Portal tatsächlich angezeigten Erklärungen prüfen.
3. Store-Texte, Kategorie, Zielgruppe, Werbung, App-Zugriff, Support-,
   Datenschutz- und Lösch-URL sowie 512×512-Icon und 1024×500-Feature-Grafik
   aus den vorbereiteten Unterlagen übertragen. Review-Zugangsdaten
   ausschließlich im geschützten Portal hinterlegen, niemals im Repository.
4. Die final bestätigte Data-Safety-Erklärung übertragen. Die technische
   Vorlage allein ist keine Rechtsfreigabe.
5. Das bereits verifizierte `1.0.0`-AAB in genau den vom Konto verlangten
   Test-Track hochladen. Die im Portal angezeigte Tester-/Daueranforderung
   dokumentieren und erfüllen; keine Anforderung aus älteren Konten oder
   Repository-Texten ableiten.
6. Sobald der Download im Play-Test-Track verfügbar ist, genau diesen Store-
   Install auf einem realen Android-Gerät verwenden. Erst dann die private,
   vollständig `pending` gesetzte Datei mit
   `npm run mobile:device:acceptance:prepare` erzeugen und alle 19 Punkte aus
   `docs/mobile/DEVICE_ACCEPTANCE.md` durchführen.
7. Den privaten Validator ausführen und nur dessen redacted PASS-Zähler plus
   Evidence-SHA übernehmen. Private Datei, Receipt, Testkonto und Recovery-
   Links niemals nach Git oder in ein Issue übertragen.
8. Aus demselben synthetischen Test-Workspace sechs reale Android-Screenshots
   erzeugen, auf sichtbare E-Mails, Tokens, IDs, Recovery-Links und Kunden-
   beziehungsweise Production-Daten prüfen und anschließend hochladen.
9. Erst nach grüner Portalvollständigkeit, vollständigem Geräte-PASS und
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
