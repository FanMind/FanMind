# FanMind Mobile - vorbereitete Store-Unterlagen

## Status und Grenzen

Dieses Dokument bereitet die Metadaten für Google Play und Apple App Store vor.
Es veröffentlicht keine App und bestätigt keine Angaben in den Store-Portalen.
Für Android liegt der signierte `1.0.0`-Release-Build vor. Texte, reale
Screenshots und Datenschutzdeklarationen werden erst nach der vollständigen
Android-Geräte- und Portalabnahme final freigegeben. iOS/TestFlight und der
iPhone-Screenshot-Satz folgen separat in Phase 8.

Die portalnahe technische Datenschutzvorlage mit getrennten Apple- und
Google-Taxonomien steht in
`docs/mobile/STORE_PRIVACY_DECLARATIONS.md`. Sie bleibt bis zur Prüfung des
signierten Builds sowie zur externen Datenschutz-/Rechtsfreigabe ein Entwurf.

Die App ist ein menschlich kontrollierter CRM- und Antwortassistent. Sie sendet
keine Nachrichten automatisch und behauptet keine aktiven externen
Social-Media-Integrationen.

## Identität

| Feld | Wert |
|---|---|
| App-Name | FanMind |
| Erstversion | `1.0.0` |
| Untertitel / Kurzbeschreibung DE | KI-CRM: Kontakte & Follow-ups |
| Subtitle / Short description EN | AI CRM: contacts & follow-ups |
| Android Package | `ch.fanmind.app` |
| iOS Bundle Identifier | `ch.fanmind.app` |
| Website | `https://fanmind.ch` |
| Support | `mailto:kontakt@fanmind.ch` |
| Datenschutz | `https://fanmind.ch/datenschutz` |
| Account-Löschung | `https://fanmind.ch/account-deletion` |

Das finale FanMind-App-Icon ist vorbereitet: eine vollständig deckende
1024×1024-PNG für iOS/Legacy-Android und ein transparentes, maskensicher
skaliertes Android-Adaptive-Foreground. Das Querlogo bleibt ausschließlich
Wortmarke und Splashscreen. Für Google Play wird die Darstellung aus dem
vorhandenen signierten Android-Build auf einem realen Android-Gerät visuell
bestätigt. Die iOS-Abnahme folgt erst in Phase 8.

`cd apps/mobile && npm run store:check` prüft diese Unterlagen vor jedem
Mobile-Release fail-closed gegen die aktuellen Apple-/Google-Zeichenlimits,
die App-IDs, sechs synthetische Screenshot-Slots, die bestätigte Wortmarke,
beide 1024×1024-Iconverträge und die sicheren EAS-Profile. Der Check lädt
nichts in ein Store-Portal hoch und benötigt keine Zugangsdaten.

## Portal-Handoff

| Feld | Vorbereiteter Wert | Externe Portalabnahme |
|---|---|---|
| Apple Hauptkategorie | Business | im App-Store-Connect-Datensatz bestätigen |
| Apple Nebenkategorie | Productivity | im App-Store-Connect-Datensatz bestätigen |
| Google-Play-Kategorie | Business | in der Play Console bestätigen |
| Zielgruppe | B2B / Erwachsene | Alters- und Inhaltsfragebogen bestätigen |
| Werbung in der App | Nein | Play-Console-Erklärung bestätigen |
| Mobile In-App-Käufe | Nein | Store-Verträge gegen finalen Build bestätigen |
| Login erforderlich | Ja | synthetischen Review-Zugang erst im Portal hinterlegen |
| Android Erstverteilung | Internal Testing, Entwurf | signiertes AAB und Konto erforderlich |
| iOS Erstverteilung | TestFlight, iPhone-only | Apple Developer/App Store Connect erforderlich |

Die EAS-Submit-Vorbereitung bleibt absichtlich nicht automatisch: Android ist
auf `internal` und `draft` begrenzt; iOS besitzt nur Sprache und App-Name.
Service-Account, Apple-Team-ID, App-Store-ID, Submit-Schlüssel und
Review-Zugangsdaten werden erst in den geschützten externen Konten ergänzt und
niemals in Git committed.

## Google Play - Kurzbeschreibung

```text
Kontakte, Kontaktwissen, KI-Antwortvorschläge und Follow-ups an einem Ort.
```

## Google Play und Apple - Beschreibung DE

```text
FanMind ist dein mobiler Arbeitsbereich für Kontakte, Kontaktwissen,
KI-gestützte Antwortvorschläge und Follow-ups.

Mit FanMind kannst du:

• Kontakte suchen, anlegen und bearbeiten
• wichtige Informationen als Kontaktwissen festhalten
• eingehende Nachrichten als Kontext verwenden
• mehrere passende Antwortvorschläge erstellen lassen
• Follow-ups planen und erledigen
• eine begrenzte, verschlüsselte Kontaktübersicht offline lesen

FanMind ist kein automatisch sendender Bot. Du prüfst jeden Vorschlag selbst,
kopierst ihn und sendest die endgültige Nachricht bewusst im ursprünglichen
Kanal. Externe Social-Media-Kanäle werden derzeit nicht automatisch
synchronisiert.

Für die Nutzung ist ein FanMind-Konto erforderlich.
```

## Google Play und Apple - Description EN

```text
FanMind is your mobile workspace for contacts, contact memory, AI-assisted reply
suggestions and follow-ups.

With FanMind, you can:

• search, create and edit contacts
• retain important information in contact memory
• use an incoming message as context
• generate several relevant reply suggestions
• plan and complete follow-ups
• read a limited encrypted contact overview while offline

FanMind is not an auto-sending bot. You review every suggestion, copy it and
deliberately send the final message in the original channel. External social
media channels are not automatically synchronized at this time.

A FanMind account is required.
```

## Suchbegriffe für Apple

```text
CRM,Kontakte,Follow-up,Antworten,KI,Creator,Fans,Kontaktwissen
```

Diese Begriffe sind vor Einreichung gegen die dann gültigen Store-Limits und
Richtlinien zu prüfen.

## Screenshot-Matrix

Screenshots dürfen nur aus einem synthetischen Test-Workspace stammen. Keine
echten Kundendaten, E-Mail-Adressen, Tokens, Recovery-Links oder externen
Nachrichten dürfen sichtbar sein.

| Reihenfolge | Screen | Kernaussage |
|---:|---|---|
| 1 | Dashboard | Dein mobiler FanMind-Arbeitsbereich |
| 2 | Kontaktliste | Kontakte schnell finden und pflegen |
| 3 | Kontaktdetail | Wissen und Kontext an einem Ort |
| 4 | KI-Antwortvorschläge | Mehrere Vorschläge, du entscheidest |
| 5 | Follow-ups | Offene Aufgaben im Blick behalten |
| 6 | Offline-Kontaktübersicht | Begrenzter, verschlüsselter Nur-Lesen-Zugriff |

Für die aktuelle Google-Play-Einreichung wird ein aktueller Android-
Screenshot-Satz aus dem signierten Build und ausschließlich mit synthetischen
Staging-Daten benötigt. Der iPhone-Screenshot-Satz gehört zur späteren
iOS-/TestFlight-Phase 8.
FanMind unterstützt im ersten iOS-Release ausschließlich iPhone. iPad wird
erst nach eigener Layout-, Geräte- und Screenshot-Abnahme freigegeben.

## Datenschutzdeklaration - Prüfmatrix

Die folgenden Punkte sind eine technische Vorbereitung, keine rechtliche
Freigabe. Vor Einreichung müssen sie anhand des signierten Builds, des realen
Backends und der aktuellen Store-Fragebögen gemeinsam mit Datenschutz/Recht
bestätigt werden.

| Bereich | Technischer Stand | Vor Store-Einreichung |
|---|---|---|
| Konto | E-Mail-Login über Supabase | Zweck, Verknüpfung und Löschweg bestätigen |
| Kontakte | Workspace-gebundene CRM-Daten mit RLS | Kategorien und Nutzerbezug im Portal bestätigen |
| KI | Kontext geht authentifiziert an FanMind; OpenAI-Key bleibt serverseitig | Unterauftragsverarbeitung und Regionen final bestätigen |
| Offline | Verschlüsselte, begrenzte Kontaktübersicht in SecureStore | Gerätespeicherung in den Fragebögen korrekt deklarieren |
| Push | Nur Grundlage; noch kein Token-Upload und kein Versand | Erst nach echter Implementierung neu bewerten |
| Tracking | Kein Mobile-Werbe-SDK und kein Mobile-Meta-Pixel | Vor jedem Release erneut über Dependency-Audit prüfen |
| Löschen | In-App-Anfrage und öffentliche Löschseite vorhanden | Realen End-to-End-Test dokumentieren |

Der iOS-Native-Prebuild erzeugt ein eigenes `PrivacyInfo.xcprivacy` mit den
Required-Reason-APIs der installierten Expo-/React-Native-Bibliotheken,
`NSPrivacyTracking=false` und ohne Tracking-Domains. Das Manifest ersetzt die
App-Privacy-Antworten in App Store Connect nicht.

Der Android-Native-Prebuild wird fail-closed gegen `compileSdk=36` und
`targetSdk=36` geprüft. Damit ist die Codebasis auf die von Google Play ab
31. August 2026 verlangte Android-16-Zielstufe vorbereitet. Das signierte
Android-`1.0.0`-AAB ist inzwischen für den exakten Merge
`e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` verifiziert; die Portalprüfung
bleibt trotzdem erforderlich.

## Vor Einreichung zwingend offen

- visuelle App-Icon-Abnahme unter realen Android-Masken;
- vollständiger privater Android-Gerätenachweis für Login, Recovery, Deep
  Links, Offline und Account-Löschung;
- Push-Entscheidung und gegebenenfalls erneute Datenschutzbewertung;
- finale Screenshots aus synthetischem Test-Workspace;
- externe Datenschutz-/Rechtsprüfung der Store-Angaben;
- Google-Play-Kontofreigabe, App-Datensatz, reale IDs, Data Safety,
  portalgefordertes Testprogramm und Upload des bestehenden AAB;
- iOS-Build, App-Store-Konto und Apple-TestFlight-/Store-Scan des signierten
  Binaries erst in Phase 8.

Der genaue operatorische Google-Play-Ablauf mit fertigen Artefakten,
Blockern und unveränderlichen Grenzen steht in
`docs/mobile/GOOGLE_PLAY_HANDOFF.md`.

## Google-Play-Kontostand am 30. August 2026

Das vorhandene Google-Play-Entwicklerkonto ist erreichbar, aber die
Identitäts-/Dokumentenprüfung durch Google läuft noch. Bis zu deren Abschluss
sind die Kontakttelefon-Verifizierung und das Anlegen des App-Datensatzes in
der Play Console gesperrt. Dieser externe Kontostatus blockiert nicht die
Repository-, Production-Environment- oder AAB-Vorbereitung, aber jede echte
Übertragung und Veröffentlichung.

Die AAB-Vorbereitung ist abgeschlossen: Production-Readiness-Lauf
`33316105624` und Store-Build-Lauf `33316172583` bestanden für den exakten
Merge `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`. Genau ein
Android-`1.0.0`-AAB wurde verifiziert; Submit und Update blieben deaktiviert.
Für die Fortsetzung im Play-Portal ist dieses bestehende AAB zu verwenden und
kein neuer Build anzustoßen.

Nach Freigabe sind Kontakttelefon, Kontotyp und das konkrete Testprogramm im
Portal zu bestätigen. Falls Google für dieses Konto den Produktionszugang über
einen geschlossenen Test verlangt, gilt die dann im Portal ausgewiesene
Tester-/Daueranforderung; sie darf nicht aus Repository-Evidence abgeleitet
oder übersprungen werden.
