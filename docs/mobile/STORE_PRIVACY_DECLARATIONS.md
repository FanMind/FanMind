# FanMind Mobile – technische Vorlage für Store-Datenschutzangaben

Stand: 30. August 2026

## Status

Diese Datei ist eine technische, repository-gebundene Arbeitsvorlage für
Apple App Store Connect und Google Play Console. Sie ist keine rechtliche
Freigabe und darf nicht ungeprüft in einem Store veröffentlicht werden.

Vor der Portalbestätigung sind der signierte Release-Build, die realen
Production-Verträge, die aktuelle Datenschutzerklärung und die dann
angezeigten Store-Fragebögen gemeinsam mit Datenschutz/Recht abzugleichen.

Für Android ist der signierte Release-Build technisch vorhanden: das einmalig
erzeugte FanMind-`1.0.0`-AAB für Merge
`e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`, verifiziert durch den geschützten
Store-Build-Lauf `33316172583` / Job `99269924756`. Submit und Update waren
deaktiviert. Dieser Nachweis ersetzt weder die Portalantworten noch die externe
Datenschutz-/Rechtsfreigabe und darf nicht durch einen unnötigen Neubau ersetzt
werden.

Verbindliche aktuelle Hilfeseiten:

- Apple:
  [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Apple:
  [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- Google:
  [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- Google:
  [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- Expo:
  [Privacy manifests](https://docs.expo.dev/guides/apple-privacy/)

## Geprüfte Release-Basis

Die aktuelle Mobile-App:

- verwendet E-Mail-/Passwort-Login über Supabase;
- verarbeitet Workspace-, CRM-, Kontaktwissen- und Follow-up-Daten;
- sendet einen vom Nutzer gewählten Nachrichtenkontext an den
  authentifizierten FanMind-KI-Endpunkt;
- verwendet beim OpenAI-Responses-Aufruf `store: false`;
- speichert nur eine begrenzte verschlüsselte Kontaktübersicht lokal;
- verwendet kein Mobile-Werbe-SDK, kein Mobile-Meta-Pixel und kein
  Cross-App-Tracking;
- greift nicht auf das Geräteadressbuch, Standort, Kamera, Mikrofon oder die
  Medienbibliothek zu;
- fordert eine Push-Berechtigung ausschließlich nach ausdrücklichem Opt-in an
  und bereitet die verschlüsselte, kontogebundene Registrierung eines
  Expo-Push-Tokens vor; Migration, Serverkey und Zustellung bleiben bis zur
  externen Abnahme deaktiviert;
- besitzt für diese Migration einen checksum-gebundenen, strikt
  Staging-only Kontrollpfad mit read-only Ressourcenprüfung und vollständig
  zurückgerollter synthetischer Acceptance; er wurde noch nicht extern
  ausgeführt und verarbeitet keine echten Push-Tokens;
- führt kein Mobile-Billing aus;
- bietet die Account-Löschanfrage in der App und zusätzlich öffentlich unter
  `https://fanmind.ch/account-deletion` an;
- verweist auf `https://fanmind.ch/datenschutz`;
- überträgt Netzwerkdaten ausschließlich über HTTPS.

Die öffentliche Datenschutzerklärung und die öffentliche Account-Löschseite
unter `https://fanmind.ch/account-deletion` wurden am 30. August 2026 ohne
Store-Login live geladen. Die Löschseite beschreibt sowohl den In-App- als
auch den authentifizierten Web-Löschweg, die Widerrufsgrenze und die maximale
Bearbeitungsfrist von 30 Tagen. Vor dem Portalabschluss sind beide URLs erneut
zu öffnen, da Erreichbarkeit veränderliche externe Evidence ist.

Diese Basis muss nach jeder Dependency-, Berechtigungs-, Tracking-, Push-,
KI-, Auth-, Offline- oder Backend-Änderung neu geprüft werden.

## Apple PrivacyInfo.xcprivacy

Das native iOS-Privacy-Manifest ist nicht mit den App-Privacy-Antworten in
App Store Connect gleichzusetzen.

`apps/mobile/app.json` deklariert die Required-Reason-APIs der tatsächlich
installierten Expo-/React-Native-Bibliotheken:

| Kategorie | Gründe aus den installierten Bibliotheken |
|---|---|
| User Defaults | `CA92.1` |
| File Timestamp | `0A2A.1`, `3B52.1`, `C617.1` |
| System Boot Time | `35F9.1` |
| Disk Space | `85F4.1`, `E174.1` |

Das Manifest setzt Tracking auf `false` und enthält keine Tracking-Domains.
Die im generierten Manifest leere Liste `NSPrivacyCollectedDataTypes` ersetzt
nicht die vollständigen App-Privacy-Antworten im Portal. Apple kann nach einem
TestFlight-/Store-Upload zusätzliche Required-Reason-Hinweise aus dem
signierten Binary melden; diese müssen vor Freigabe geprüft werden.

## Apple App Privacy – technischer Antwortentwurf

`Ja` bedeutet hier: auf Grundlage des aktuellen Codes vorsorglich für die
Portalprüfung auswählen. Die finale Auslegung von „collect“ und die
Processor-/Aufbewahrungsgrenzen bleiben extern zu bestätigen.

| Apple-Datentyp | Entwurf | Mit Nutzer verknüpft | Tracking | Zweck / technische Begründung |
|---|---:|---:|---:|---|
| Contact Info – Email Address | Ja | Ja | Nein | Login, Account Management und App Functionality |
| Contact Info – Name | Ja | Ja | Nein | Pflichtfeld `display_name` für nutzererstellte CRM-Kontakte; Speicherung im autorisierten Workspace für App Functionality |
| Identifiers – User ID | Ja | Ja | Nein | Supabase-User, Workspace-Autorisierung und Account Management |
| User Content – Other User Content | Ja | Ja | Nein | CRM-Kontakte, Handles, Zusammenfassungen, interne Notizen, Kontaktwissen und Follow-up-Gründe |
| User Content – Emails or Text Messages | Prüfen / vorsorglich Ja | Ja | Nein | Nur vom Nutzer eingefügter Kontext für KI-Vorschläge; `store: false`, aber Übermittlung an FanMind und OpenAI muss final bewertet werden |
| Usage Data – Product Interaction | Prüfen / vorsorglich Ja | Ja | Nein | KI-Nutzungsmetadaten wie Feature, Status und geschätzte Tokens; keine Prompt- oder Antwortvolltexte im Usage-Event |
| Diagnostics – Crash / Performance Data | Nein | – | Nein | Kein Mobile-Crash-/Performance-SDK im aktuellen Build |
| Identifiers – Device ID | Ja | Ja | Nein | Optionaler Expo-Push-Token nach ausdrücklichem Opt-in; verschlüsselt, ein aktives Gerät pro Konto, 30-Tage-Ablauf; Zustellung noch deaktiviert |
| Contacts | Nein | – | Nein | Kein Zugriff auf das Geräteadressbuch; CRM-Kontakte sind nutzererstellte Workspace-Daten |
| Purchases / Financial Info | Nein | – | Nein | Kein Billing in der Mobile-App |
| Location, Photos, Audio, Browsing History | Nein | – | Nein | Keine entsprechenden Berechtigungen oder Funktionen |

Für alle als `Ja` beziehungsweise `vorsorglich Ja` markierten Typen ist als
aktueller Zweck nur `App Functionality` und – bei E-Mail/User-ID –
`Account Management` vorgesehen. Keine Typen dienen Advertising, Marketing
oder Tracking.

## Google Play Data Safety – technischer Antwortentwurf

### Allgemeine Fragen

| Frage | Technischer Entwurf | Vor Veröffentlichung bestätigen |
|---|---|---|
| Sammelt oder teilt die App erforderliche Nutzerdaten? | Ja, sie überträgt Konto- und CRM-Daten vom Gerät | Vollständigkeit anhand des signierten Builds |
| Sind alle übertragenen Nutzerdaten verschlüsselt? | Ja, HTTPS/TLS | Reale Production-Endpunkte und Zertifikate |
| Können Nutzer die Löschung beantragen? | Ja, in der App und über die öffentliche Löschseite | End-to-End-Anfrage mit realem Testkonto |
| Werden Daten geteilt? | Vorläufig Nein bei reiner Auftragsverarbeitung | Supabase-/OpenAI-Verträge gegen Googles Service-Provider-Definition prüfen |
| Ist die Datenerhebung optional? | E-Mail/User-ID erforderlich; CRM-/KI-Inhalte funktionsabhängig | Portalwortlaut und reale UX bestätigen |

### Datentypen

| Google-Datentyp | Erhebung | Teilen | Zweck | Hinweis |
|---|---:|---:|---|---|
| Personal info – Email address | Ja | Vorläufig Nein | App functionality, Account management | Für Login erforderlich |
| Personal info – Name | Ja | Vorläufig Nein | App functionality | Pflichtfeld `display_name` für nutzererstellte CRM-Kontakte im autorisierten Workspace |
| Personal info – User IDs | Ja | Vorläufig Nein | App functionality, Account management | User-/Workspace-Autorisierung |
| App activity – Other user-generated content | Ja | Vorläufig Nein | App functionality | CRM-Inhalte, Kontaktwissen und Follow-ups |
| Messages – Other messages | Prüfen / vorsorglich Ja | Vorläufig Nein | App functionality | Vom Nutzer eingefügter KI-Kontext; ephemerale Verarbeitung im Portal exakt kennzeichnen |
| App activity – App interactions | Prüfen / vorsorglich Ja | Vorläufig Nein | Analytics nur als betriebliche KI-Nutzungs-/Kostenmessung, App functionality | Keine Mobile-Werbeanalytik; keine Inhaltsvolltexte im Usage-Event |
| App activity – In-app search history | Ja | Vorläufig Nein | App functionality | Online-Suchbegriffe werden für die Kontaktabfrage an Supabase/PostgREST übertragen, aber nicht als eigene Suchhistorie gespeichert |
| Device or other IDs | Ja | Vorläufig Nein | App functionality | Optionaler Expo-Push-Token nach ausdrücklichem Opt-in; verschlüsselt, kontogebunden und ohne aktive Zustellung |
| Contacts | Nein | Nein | – | Kein Geräteadressbuchzugriff |
| Diagnostics | Nein | Nein | – | Kein Mobile-Crash-/Performance-SDK |
| Financial info / Purchase history | Nein | Nein | – | Kein Mobile-Billing |
| Location, Photos/Videos, Audio, Files/Documents | Nein | Nein | – | Keine entsprechenden Funktionen/Berechtigungen |

Google verlangt auch ephemerale Übermittlungen im Fragebogen; ob sie auf der
öffentlichen Data-Safety-Fläche angezeigt werden, entscheidet die genaue
Portalangabe. „Vorläufig Nein“ bei Teilen ist nur zulässig, wenn Supabase und
OpenAI für diesen Datenfluss tatsächlich ausschließlich als Service Provider
im Auftrag von FanMind gelten.

## Push-Aktivierungsgrenze

Die Token-Registrierung ist im Code vorbereitet, aber noch nicht migriert oder
für reale Geräte freigegeben. Vor der späteren Zustellungsaktivierung muss diese
Vorlage erneut geöffnet werden. Mindestens zu prüfen sind:

- Device or other IDs / Device ID wegen Expo- beziehungsweise nativer
  Push-Token sind bereits vorsorglich als Erhebung eingeordnet;
- Empfängerbindung, Zweck, Aufbewahrung und Token-Löschung bei Logout oder
  Account-Löschung;
- Expo, FCM und APNs als beteiligte Dienste;
- Berechtigungsdialog und Ablehnungspfad;
- keine Kontakt-, Nachrichten- oder CRM-Inhalte im Push-Payload;
- echte Zustellung nur aus einem signierten Build.

Die aktuelle Vorbereitung ist keine Portal-Freigabe und kein Nachweis einer
echten Zustellung.

## Portal-Freigabeprotokoll

Vor Bestätigung in App Store Connect oder Play Console:

1. für Google das vorhandene Android-AAB an Merge
   `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` binden; iOS erst in Phase 8
   getrennt behandeln;
2. native Android-Berechtigungen aus dem finalen Binary beziehungsweise dem
   Play-Scan prüfen;
3. Dependency-/SDK-Inventar mit dem Build abgleichen;
4. Datenschutz- und Account-Lösch-URLs öffentlich und ohne Login testen;
5. Löschanfrage, Widerruf und Abschluss mit synthetischem Testkonto belegen;
6. Supabase-/OpenAI-Verträge, Regionen und Aufbewahrung extern bestätigen;
7. Apple- und Google-Antworten getrennt prüfen – die Taxonomien sind nicht
   gleich und Apple ist im aktuellen Android-Handoff nicht freizugeben;
8. externe Datenschutz-/Rechtsfreigabe dokumentieren;
9. erst dann die Portalantworten veröffentlichen.
