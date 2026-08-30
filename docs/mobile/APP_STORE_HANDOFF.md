# Apple App Store Handoff – FanMind iPhone 1.0.0

## Status und Grenze

Die iPhone-App-Store-Unterlagen sind repository-seitig vorbereitet. Dieser
Stand erzeugt keinen iOS-Build, startet kein TestFlight, registriert kein Gerät
und überträgt nichts an App Store Connect. Ohne signierten iOS-Build und ohne
iPhone-/Simulatorabnahme wird weder die Lauffähigkeit noch eine Apple-Freigabe
behauptet. Diese externen Schritte bleiben in Phase 8.

Die vollständige portalnahe Feldübergabe steht in
`docs/mobile/APP_STORE_CONNECT_WORKSHEET.md`. Sie trennt 30 Felder
maschinengeprüft in technisch vorbereitet, Eigentümer-/Rechtsentscheidung und
Phase-8-Nachweis. Offene Konto-, Rechts-, Steuer- oder Gerätewerte werden
nicht erfunden.

## Unveränderliche App-Identität

| Feld | Vorbereiteter Wert |
|---|---|
| App-Name | FanMind |
| Version | `1.0.0` |
| Bundle Identifier | `ch.fanmind.app` |
| Plattform | iPhone-only; `supportsTablet=false` |
| Kategorie | Business; sekundär Productivity |
| Sprache | Deutsch und Englisch |
| Support | `https://fanmind.ch/support` |
| Datenschutz | `https://fanmind.ch/datenschutz` |
| Account-Löschung | `https://fanmind.ch/account-deletion` |
| Recovery | `fanmind://reset-password` |

App Store Connect, Team-ID, App-ID, Signierung, Review-Zugang und Verträge sind
externe Kontowerte. Sie werden niemals im Repository ergänzt.

## Jetzt vorbereitet

- deutsche und englische Beschreibung, Untertitel, Keywords, Werbetext und
  Versionshinweise in `docs/mobile/STORE_LISTING.md`;
- öffentliche HTTPS-Support-, Datenschutz- und Account-Lösch-URLs;
- App-Privacy-Entwurf und app-eigenes `PrivacyInfo.xcprivacy`-Mapping;
- 1024×1024 deckendes App-Icon und iPhone-only Native-Konfiguration;
- sechs sichere Screenshot-Motive aus einem synthetischen Test-Workspace;
- Screenshot-Masterformat `1320 × 2868` Pixel für die 6,9-Zoll-iPhone-Klasse;
- getrennte Review- und Tester-Handoffs ohne Zugangsdaten in Git.

Apple akzeptiert pro Gerätegröße ein bis zehn Screenshots. Wenn die UI über die
Größen identisch ist, kann der höchste passende Auflösungssatz für die
Skalierung verwendet werden. Die Bilder dürfen keine Transparenz enthalten.
FanMind erstellt sie erst aus dem späteren signierten Build und kennzeichnet
sie bis dahin nicht als abgenommen.

Aktuelle Apple-Referenzen:

- [Screenshots hochladen](https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/)
- [Screenshot-Spezifikationen](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- [App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Altersfreigabe](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)
- [Verschlüsselungsdokumentation](https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-app-encryption-documentation/)

## App-Store-Connect-Vorbereitung

Nach Verfügbarkeit des bestätigten Apple-Developer-Kontos:

1. Bundle-ID und neuen App-Datensatz exakt als `ch.fanmind.app` / `FanMind`
   anlegen; keine abweichende Ersatz-ID erzeugen.
2. Primärsprache, Business/Productivity, URLs und vorbereitete Texte
   übertragen; alle Portal-Zeichenlimits erneut prüfen.
   Die genaue Übertragungs- und Freigabematrix steht in
   `docs/mobile/APP_STORE_CONNECT_WORKSHEET.md`.
3. Verträge, Steuer-/Bankangaben und Rechteinhaber im realen Konto bestätigen.
4. Altersfragebogen anhand der tatsächlich signierten Funktionen beantworten;
   keine Bewertung aus dem Repository vorwegnehmen.
5. App-Privacy-Antworten mit dem finalen Binary, Supabase/OpenAI-Verträgen und
   externer Datenschutz-/Rechtsfreigabe abgleichen.
6. Accessibility-Angaben erst nach VoiceOver-, Textgrößen-, Kontrast-, Fokus-
   und Bewegungsprüfung des finalen Builds veröffentlichen.
7. Review-Zugang und englische Hinweise aus
   `docs/mobile/STORE_REVIEW_ACCESS.md` ausschließlich im geschützten Portal
   hinterlegen.

## Spätere Phase-8-Reihenfolge

1. Apple-Team, Signierung und App-Store-Datensatz gegen die unveränderliche
   Identität prüfen.
2. Genau einen ausdrücklich autorisierten iOS-Build starten; kein Android-AAB
   ersetzen oder erneut bauen.
3. TestFlight-/Store-Scan, Export-Compliance und mögliche Privacy-Manifest-
   Warnungen des signierten Binaries prüfen. `ITSAppUsesNonExemptEncryption`
   ist im App-Config-Entwurf `false`, ersetzt aber keine Portalentscheidung.
4. Auf iPhone und/oder passendem iOS-Simulator die Kernflüsse testen und den
   privaten iOS-Gerätenachweis führen. Dass aktuell kein iPhone verfügbar ist,
   bleibt sichtbar offen.
5. Sechs reale, inhaltsgeprüfte `1320 × 2868`-Screenshots mit ausschließlich
   synthetischen Daten aufnehmen.
6. Erst nach technischer, Datenschutz-/Rechts- und Portalabnahme zur Review
   einreichen. TestFlight-Erfolg ist keine App-Store-Freigabe.

## Harte Grenzen

- kein iOS-Build, kein TestFlight und kein Gerätetest in diesem Vorbereitungsschritt;
- keine Zugangsdaten, Geräte-UDIDs, Zertifikate oder Schlüssel in Git;
- keine echten Kunden-, Kontakt-, Nachrichten- oder Recovery-Daten in Bildern;
- keine iPad-Freigabe ohne eigene Layout-, Geräte- und Screenshot-Abnahme;
- keine Accessibility-, Datenschutz- oder Altersfreigabe ohne reale Prüfung;
- keine automatische Nachrichtenzustellung behaupten oder aktivieren.
