# App Store Connect Arbeitsmatrix – FanMind iPhone 1.0.0

## Zweck und Statusmodell

Diese Matrix ist die repository-gebundene Übergabe für den ersten
iPhone-Release. Sie bündelt die Portalangaben, die Apple aktuell für
App-Information, Version, Preis und Verfügbarkeit, Datenschutz,
Barrierefreiheit sowie die Einreichung verwendet. Sie schreibt nichts in App
Store Connect und ist keine Apple-, Rechts- oder Gerätefreigabe.

Es gelten genau drei Statuswerte:

- `READY`: Der technische Wert ist im Repository eindeutig vorbereitet und
  kann später unverändert in das Portal übertragen werden.
- `OWNER_REQUIRED`: Eine Konto-, Geschäfts-, Rechts-, Steuer- oder
  Vertriebsentscheidung ist nötig. Es wird kein Wert erfunden.
- `PHASE8_REQUIRED`: Die Angabe darf erst mit signiertem iOS-Build,
  TestFlight-/Store-Scan oder realer iPhone-/Simulatorprüfung abgeschlossen
  werden.

## Portal-Arbeitsmatrix

| Nr. | App-Store-Connect-Feld | Status | Vorbereiteter Wert oder nächste Aktion | Freigabegrenze |
|---:|---|---|---|---|
| 1 | Name | READY | `FanMind` | Mit App-Datensatz übertragen |
| 2 | Subtitle | READY | DE `KI-CRM: Kontakte & Follow-ups`; EN `AI CRM: contacts & follow-ups` | Lokalisierungen aus `STORE_LISTING.md` verwenden |
| 3 | Description | READY | Vollständige deutsche und englische Beschreibung aus `STORE_LISTING.md` | Beide Lokalisierungen unverändert übertragen |
| 4 | Keywords | READY | Getrennte DE-/EN-Suchbegriffe aus `STORE_LISTING.md` | Beide geprüften, höchstens 100 Zeichen langen Sätze übertragen |
| 5 | Promotional Text | READY | Getrennter deutscher und englischer Werbetext aus `STORE_LISTING.md` | Beide geprüften, höchstens 170 Zeichen langen Texte übertragen |
| 6 | Age Rating | PHASE8_REQUIRED | Fragebogen anhand des final signierten Funktionsumfangs beantworten | Keine Bewertung vor Binary- und Inhaltsprüfung behaupten |
| 7 | Bundle ID | READY | `ch.fanmind.app` | Keine abweichende Ersatz-ID anlegen |
| 8 | SKU | OWNER_REQUIRED | Konto-internen, dauerhaften SKU-Wert festlegen | Nicht aus Bundle-ID oder Git ableiten |
| 9 | Content Rights | OWNER_REQUIRED | Rechte an App-Inhalten und verwendeten Drittdiensten im Portal bestätigen | Rechts-/Kontoinhaberentscheidung |
| 10 | Primary Language | READY | Deutsch (`de-DE`) | Englisch als weitere Lokalisierung ergänzen |
| 11 | Primary Category | READY | Business | Im realen App-Datensatz bestätigen |
| 12 | Secondary Category | READY | Productivity | Im realen App-Datensatz bestätigen |
| 13 | Digital Services Act (DSA) Status | OWNER_REQUIRED | Händlerstatus und die von Apple verlangten Kontaktdaten im Konto bestätigen | DSA-/Rechtsentscheidung; keine Repository-Ableitung |
| 14 | Regulated Medical Devices | OWNER_REQUIRED | Anwendbarkeit im aktuellen Apple-Fragebogen bestätigen | Keine medizinische Einstufung aus Technik ableiten |
| 15 | Support URL | READY | `https://fanmind.ch/support` | Öffentliche HTTPS-Seite vor Einreichung erneut prüfen |
| 16 | Marketing URL | READY | `https://fanmind.ch` | Öffentliche HTTPS-Seite vor Einreichung erneut prüfen |
| 17 | Version Number | READY | `1.0.0` | Mit App-Konfiguration und signiertem Binary abgleichen |
| 18 | Copyright | OWNER_REQUIRED | Jahr und exakten rechtlichen Rechteinhaber festlegen | Nicht aus Produktname oder Domain erraten |
| 19 | App Review Information | PHASE8_REQUIRED | Kontakt, 24/7-Prüfzugang und Hinweise aus `STORE_REVIEW_ACCESS.md` nur im Portal hinterlegen | Keine Zugangsdaten in Git; finalen Build referenzieren |
| 20 | Version Release Settings | OWNER_REQUIRED | Manuelle, automatische oder terminierte Freigabe im Portal wählen | Veröffentlichungsentscheidung unmittelbar vor Einreichung |
| 21 | App Availability | OWNER_REQUIRED | Länder/Regionen und Vertriebsart festlegen | Geschäfts-/Rechtsfreigabe erforderlich |
| 22 | Price | OWNER_REQUIRED | Kostenlos oder Preisstufe für den App-Download festlegen | Mobile besitzt keine In-App-Käufe; Storepreis trotzdem bewusst bestätigen |
| 23 | Tax Category | OWNER_REQUIRED | Im Apple-Konto mit Steuerberatung bestätigen | Keine steuerliche Einstufung aus dem Web-Angebot ableiten |
| 24 | Privacy Policy URL | READY | `https://fanmind.ch/datenschutz` | Öffentliche HTTPS-Seite und finalen Datenfluss erneut abgleichen |
| 25 | Privacy Choices URL | OWNER_REQUIRED | Separaten Wert rechtlich bestimmen oder im Portal bewusst leer lassen, falls zulässig | `https://fanmind.ch/account-deletion` nicht ungeprüft gleichsetzen |
| 26 | Data Types | PHASE8_REQUIRED | `STORE_PRIVACY_DECLARATIONS.md` gegen finalen Binary-, SDK- und Backend-Stand prüfen | Datenschutz-/Rechtsfreigabe und Portalfragebogen nötig |
| 27 | Accessibility URL | OWNER_REQUIRED | Öffentliche Accessibility-Seite bereitstellen oder Portaloption bewusst festlegen | Keine URL oder Konformität erfinden |
| 28 | Accessibility Support | PHASE8_REQUIRED | VoiceOver, größere Schrift, Kontrast, Fokus, Farbe und reduzierte Bewegung am finalen Build prüfen | Erst danach Accessibility Nutrition Labels veröffentlichen |
| 29 | Screenshots | PHASE8_REQUIRED | Sechs Motive in `1320 × 2868`, ausschließlich synthetische Daten | Erst aus signiertem Build nach visueller Abnahme erstellen |
| 30 | App Icon | PHASE8_REQUIRED | 1024×1024-Asset ist vorbereitet; Rendering des signierten Builds visuell prüfen | Keine Portalabnahme ohne Store-/Geräteansicht |
| 31 | Export Compliance | PHASE8_REQUIRED | Binary-Scan und Apple-Fragen beantworten; `ITSAppUsesNonExemptEncryption=false` gegen finalen Build prüfen | Konfigurationswert ersetzt keine Portalentscheidung |
| 32 | Signed Build | PHASE8_REQUIRED | Genau einen später ausdrücklich autorisierten iOS-Build auswählen | Kein iOS-Build, kein TestFlight und keine Einreichung in diesem Schritt |
| 33 | Mac and Apple Vision Pro Availability | OWNER_REQUIRED | Verfügbarkeit der iPhone-App auf Apple-Silicon-Macs und Apple Vision Pro bewusst festlegen | Keine automatische zusätzliche Plattformfreigabe |

## Übertragungsreihenfolge

1. Nach bestätigtem Apple-Developer-/App-Store-Connect-Konto zuerst die dreizehn
   `READY`-Werte übertragen und erneut gegen die unveränderliche App-Identität
   prüfen.
2. Die zwölf `OWNER_REQUIRED`-Felder mit Konto-, Rechts-, Steuer- und
   Vertriebsverantwortlichen entscheiden. Ein fehlender Wert bleibt offen und
   wird nicht durch eine technische Annahme ersetzt.
3. Die acht `PHASE8_REQUIRED`-Felder erst nach dem ausdrücklich autorisierten
   signierten iOS-Build, dem Store-Scan und der Geräte-/Simulatorabnahme
   abschließen.
4. Review-Zugang, Team-/App-IDs, Zertifikate, Schlüssel, Geräte-UDIDs und
   Passwörter ausschließlich in den geschützten Apple-Systemen verwalten;
   niemals im Repository speichern.
5. Erst nach vollständiger Technik-, Datenschutz-/Rechts- und Portalabnahme
   die Einreichung separat bestätigen. Keine Portalübertragung in dieser
   repository-only Vorbereitung.

## Aktuelle Apple-Quellen

- [Pflicht-, lokalisierbare und bearbeitbare
  Eigenschaften](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties/)
- [App-Information
  lokalisieren](https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information/)
- [Screenshot-Spezifikationen](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [App-Privacy verwalten](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Accessibility Nutrition Labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/)
- [Einreichung zur App Review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review/)

Die Quellen und sichtbaren Portalfragen sind unmittelbar vor der späteren
Übertragung erneut zu prüfen, weil Apple Felder und Anforderungen ändern kann.
