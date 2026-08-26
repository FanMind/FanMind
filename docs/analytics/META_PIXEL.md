# FanMind Meta Pixel – Consent, Events und Abnahme

## Zweck und Scope

FanMind integriert den Meta Pixel ausschließlich als optionale Marketing-Messung für freigegebene öffentliche Seiten. Das ist keine Produkt-Analytics-Suite, keine CRM-Telemetrie und keine Social-Media-Vollintegration.

Meta-Zuordnung:

- Business Portfolio: `FanMind`
- Werbekonto: `FanMind Ads`
- Dataset / Pixel: `FanMind Dataset`
- Dataset-/Pixel-ID: `2069553844439892`
- Production-Domain: `https://fanmind.ch`

## Vorabprüfung des Repositorys

Vor der Implementierung wurde der aktuelle Stand geprüft:

- Next.js `16.3.0` mit App Router unter `src/app`;
- genau ein Web-Root-Layout unter `src/app/layout.tsx`;
- kein bestehendes Meta-, Google-, Vercel-Analytics-, Plausible- oder vergleichbares Browser-Tracking;
- vorhandene Telemetrie ist datensparsame serverseitige Fehler-/Operations-Telemetrie und kein Marketing-Tracking;
- vorhandene Cookies/Browser-Speicher dienen Auth, Sprache und Helligkeit;
- vor diesem PR existierte kein Cookie-Banner und kein Marketing-Consent-Management;
- Production baut auf dem Exoscale-Host aus `/var/www/fanmind/.env.production` und deployt über `.github/workflows/deploy-fanmind.yml`;
- kanonische Domain und Smoke-Ziel sind `https://fanmind.ch`;
- die bestehende CSP-Baseline blockiert das Meta-Script nicht, weil sie keine `script-src`- oder `connect-src`-Allowlist setzt. Die bestehenden Schutzdirektiven bleiben unverändert.

## Architektur

Die Integration sitzt genau einmal in der zentralen Web-App-Struktur:

1. `src/app/layout.tsx` liest nur den Consent-Cookie und die öffentliche Pixel-ID.
2. `MarketingConsentManager` verwaltet `unset`, `denied` und `granted`.
3. Consent-UI und Loader werden nur auf explizit freigegebenen öffentlichen Routen mit unsensitiven Querywerten gerendert.
4. `MetaPixelLoader` wird nur bei `granted`, einer gültigen Pixel-ID und einer freigegebenen öffentlichen URL gerendert.
5. Das Meta-Bootstrap-Script wird über `next/script` mit `afterInteractive` genau einmal geladen.
6. Vor der Initialisierung wird Metas automatische Konfiguration mit `autoConfig=false` für diesen Pixel deaktiviert; nur FanMinds geprüfte Event-Hilfe darf Events auslösen.
7. Der Bootstrap initialisiert den Pixel und sendet anschließend ausschließlich ein browserinternes Readiness-Signal ohne Nutz- oder Kundendaten. Dadurch hängt die Event-Aktivierung nicht von einem unzuverlässigen Callback eines Inline-Scripts ab.
8. `PageView` wird getrennt und dedupliziert über den sicheren App-Router-Pfad samt freigegebener Query ausgelöst.
9. Bei Widerruf werden weitere FanMind-Events blockiert, Meta-Consent auf `revoke` gesetzt und bekannte First-Party-Meta-Cookies (`_fbp`, `_fbc`) für den aktuellen Host entfernt.
10. Beim Wechsel auf geschützte oder nicht freigegebene URLs wird Meta-Consent vorsorglich widerrufen und kein FanMind-Event ausgelöst.
11. Das dynamisch erzeugte Meta-Script erhält `referrerPolicy='no-referrer'`; zusätzlich blockiert FanMind jeden same-origin Referrer, der von einer geschützten, dynamischen oder anderweitig nicht freigegebenen FanMind-URL stammt.

Es gibt bewusst kein ungegate-tes `noscript`-Bild, weil dieses auch ohne JavaScript und ohne ausdrückliche Marketing-Einwilligung eine Meta-Anfrage auslösen würde.

## Öffentliche Routengrenze

Der Pixel darf ausschließlich auf dieser technischen Allowlist geladen werden:

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/roadmap`
- `/landing-v2`
- `/account-deletion`
- `/impressum`
- `/datenschutz`
- `/agb`
- `/avv`
- `/zahlungsbedingungen`
- `/referral-bedingungen`

Ausdrücklich ausgeschlossen sind unter anderem:

- `/dashboard`, `/fans`, `/fans/[id]`, `/inbox`, `/followups`;
- sämtliche `/settings/*`- und `/admin/*`-Seiten;
- Billing-, Checkout-, Erfolgs- und Rechnungsseiten;
- Onboarding und Workspace-Setup;
- Passwort-Recovery-Callbacks wie `/reset-password`;
- jede unbekannte oder dynamische Route.

Querystrings sind standardmäßig blockiert. Zulässig sind ausschließlich:

- `lang=de|en` auf der jeweiligen öffentlichen Route;
- `plan=starter|growth|agency` und bei Starter zusätzlich
  `option=starter_paid_setup|starter_no_setup_commitment` auf `/register`.

Parameter wie E-Mail, Referral-Code, `returnTo`, Kontakt-/Workspace-ID, Session-/Recovery-Wert oder freie Kampagnenparameter verhindern das Laden und Tracking vollständig. Damit gelangen keine CRM-IDs oder sensiblen Callback-URLs allein durch einen `PageView` an Meta. Ein same-origin Referrer aus einer solchen geschützten oder unsicheren FanMind-URL blockiert den Pixel ebenfalls; externe Referrer bleiben für die normale Marketing-Attribution zulässig.

## Consent-Vertrag

Cookie:

```text
fanmind_marketing_consent=granted|denied
```

Eigenschaften:

- Path `/`;
- SameSite `Lax`;
- auf HTTPS zusätzlich `Secure`;
- maximale Lebensdauer 180 Tage;
- kein Tracking bei fehlendem, ungültigem oder abgelehntem Consent;
- jederzeit über den auf freigegebenen öffentlichen Seiten sichtbaren Button `Datenschutz-Einstellungen` änderbar.

Die Ablehnen- und Akzeptieren-Aktionen werden gleichwertig im Banner angeboten. Ohne Auswahl bleibt der Pixel aus. Geschützte CRM-Seiten zeigen bewusst kein Marketing-Consent-UI, weil dort weder Script noch Events geladen werden.

## Environment

```text
NEXT_PUBLIC_META_PIXEL_ID=2069553844439892
```

Die Pixel-ID ist eine öffentliche technische Kennung und kein Secret. Trotzdem wird sie zentral über ENV konfiguriert, damit lokale Entwicklung, Staging und Production getrennt bleiben. In YAML-Dateien muss die lange Nummer als String in Anführungszeichen stehen, damit sie nicht in wissenschaftliche Notation umgewandelt wird.

Fail-closed-Verhalten:

- leer oder nicht gesetzt: Pixel vollständig deaktiviert;
- nicht ausschließlich numerisch oder außerhalb der erwarteten Länge: Pixel vollständig deaktiviert;
- gültige ID, aber kein Consent: Pixel vollständig deaktiviert;
- gültige ID und `granted`, aber geschützte/unsichere URL: Pixel vollständig deaktiviert;
- gültige ID, `granted` und freigegebene öffentliche URL: Pixel aktiv.

`NEXT_PUBLIC_*`-Werte werden beim Next.js-Build in den Client-Build übernommen. Eine Änderung in `.env.production` benötigt deshalb einen neuen Production-Build/Deploy.

## Aktive und vorbereitete Events

### Aktiv

| Event | Auslöser | Parameter |
| --- | --- | --- |
| `PageView` | erste freigegebene öffentliche Seite nach Einwilligung und danach genau einmal je neuem sicheren App-Router-Pfad/Queryzustand | keine |

### Nur vorbereitet, nicht verdrahtet

- `CompleteRegistration`
- `Lead`
- `ViewContent`
- `Contact`
- `Schedule`
- `StartTrial`
- `Purchase`

Diese Namen sind in der Policy typisiert, aber nicht für Laufzeitaufrufe freigegeben. Die Event-Hilfe akzeptiert ausschließlich das aktive `PageView`. Vor jeder weiteren Verdrahtung müssen Ereignisdefinition, Consent, Datenminimierung, öffentliche Routengrenze und fachliche Wahrheit separat geprüft und im selben Release synchronisiert werden.

Insbesondere wird `Purchase` nicht allein wegen eines Seitenaufrufs, Checkout-Starts oder internen Testabos gesendet. Ein späteres Purchase-Event benötigt einen bestätigten Zahlungsabschluss und eine eigene Billing-/Datenschutzabnahme.

## Datenminimierung

Die Event-Hilfsfunktion akzeptiert im aktuellen Stand absichtlich kein freies Parameterobjekt. Dadurch können nicht versehentlich folgende Daten an Meta weitergegeben werden:

- E-Mail-Adresse oder Telefonnummer;
- Name oder Benutzerkennung;
- Workspace-, Kontakt-, Conversation- oder Message-ID;
- CRM-Daten, Tags, Status oder Zusammenfassungen;
- Nachrichten-, Prompt-, KI- oder Kontaktwissen-Inhalte;
- Billing-, Rechnungs- oder Stripe-Daten;
- Auth-Tokens oder Sessionwerte.

Nicht aktiviert:

- kein Advanced Matching beziehungsweise kein erweitertes Matching;
- keine automatische Übergabe von Nutzerfeldern;
- keine Conversions API;
- kein serverseitiges Meta-Tracking;
- keine automatische Conversion-Erkennung;
- keine benutzerdefinierten Conversion-Events.

## Lokale und CI-Prüfung

Ohne Pixel-ID:

```bash
npm ci
npm run verify:truth
npm run lint
npm run test:operations
npm run build
```

Browser-E2E setzt die öffentliche Test-ID nur im CI-Build und fängt `connect.facebook.net` vollständig synthetisch ab. Es entsteht keine echte Meta-Anfrage. Geprüft werden:

1. ohne Consent kein Meta-Script und kein `PageView`;
2. `Nur notwendige` hält das Script deaktiviert;
3. `Marketing erlauben` lädt genau ein Script;
4. genau eine `autoConfig=false`- und eine `init`-Queue-Anweisung mit `2069553844439892`;
5. genau ein initiales `PageView`;
6. genau ein weiteres `PageView` nach echter Client-Navigation;
7. kein doppeltes `PageView` beim erneuten Öffnen/Bestätigen derselben Auswahl;
8. Widerruf blockiert weitere Events;
9. Policy-Tests blockieren geschützte Routen, dynamische CRM-Pfade und unsichere Querystrings.

## Production-Status und erneute Browser-Regression

Der technische Production-Pfad ist bereits bestätigt und in Issue #714 sowie
Project-Memory-Evidence `FM-EV-007` festgehalten. Insbesondere sind die
Production-ENV, der zugehörige Build/Deploy und der consent-gated
PageView-only-Pfad kein noch ausstehender Aktivierungsschritt und dürfen nicht
allein aufgrund dieses Runbooks wiederholt werden.

Die Codeintegration allein bedeutet nicht, dass der Pixel bereits auf Production aktiv ist.
Für den aktuellen FanMind-Stand stammt diese Bestätigung deshalb aus der
separaten Production-Evidence und nicht allein aus dem vorhandenen Code.

Die folgende Prüfung ist nur bei einer separat freigegebenen erneuten
Production-Regression oder als Teil der noch offenen externen Events-Manager-
Abnahme auszuführen:

1. Browser-Cookies für `fanmind.ch` löschen oder privates Fenster verwenden.
2. `/` öffnen.
3. Vor einer Auswahl im Netzwerk prüfen: keine Anfrage an `connect.facebook.net` oder `facebook.com/tr`.
4. `Nur notwendige` wählen und erneut prüfen: weiterhin keine Meta-Anfrage.
5. Datenschutz-Einstellungen öffnen und `Marketing erlauben` wählen.
6. Prüfen, dass `fbevents.js` genau einmal geladen wird.
7. In der Konsole ausschließlich technisch prüfen, dass `window.fbq` existiert; keine Queue- oder Kundendaten protokollieren.
8. Über den internen Next-Link zur Datenschutzseite navigieren und genau ein weiteres, nicht doppeltes `PageView` prüfen.
9. Eine geschützte Route öffnen und im Netzwerk bestätigen, dass FanMind dafür kein `PageView` sendet.
10. Consent widerrufen und bestätigen, dass weitere Navigationen keine FanMind-Events an Meta senden.

## Meta Events Manager / Test Events

Für die noch offene externe Abnahme auf dem bereits technisch bestätigten
Production-Pfad:

1. Meta Events Manager öffnen.
2. Dataset `FanMind Dataset` auswählen.
3. `Test Events` beziehungsweise die aktuelle Diagnoseansicht öffnen.
4. `https://fanmind.ch` in einem frischen Browserfenster öffnen.
5. Marketing-Einwilligung erteilen.
6. ein `PageView` für den initialen öffentlichen Pfad prüfen.
7. über eine sichere öffentliche Client-Navigation einen zweiten Pfad öffnen und genau ein weiteres `PageView` prüfen.
8. Eventdetails auf das Fehlen von E-Mail, Namen, Firma, Nachricht, CRM-, Kontakt-, Billing- und Advanced-Matching-Daten prüfen.
9. Bestätigen, dass weder `CompleteRegistration` noch `Lead` oder ein anderes Conversion-Event erscheint.
10. Die Meta Pixel Helper Browser-Erweiterung kann ergänzend verwendet werden, ersetzt aber nicht Netzwerk-, Routengrenz- und Consent-Prüfung.

Keine Screenshots oder Tickets dürfen Tokens, Session-Cookies, Kundeninhalte oder vollständige Browser-Netzwerk-Response-Bodies enthalten.

## Aktueller Abnahmestatus

Technisch bestätigt und nicht zu wiederholen:

- Production-ENV, Build/Deploy und consent-gated PageView-only-Pfad;
- keine Parameterübergabe, kein Advanced Matching und keine Conversions API;
- Fail-closed Routengrenze und Widerrufslogik im Repository/CI;
- aktuelle Staging-Metadaten für Content, Conversation-Continuation und
  Catch-up-Queue im Read-only-Postflight.

Weiterhin extern beziehungsweise separat freigabepflichtig:

- normaler Browser plus Meta Events Manager/Test Events: kein Event vor
  Consent, genaues `PageView` nach Consent/Navigation und keine unerwarteten
  Conversion-Events;
- Provider-seitige Sichtprüfung, dass keine PII- oder Advanced-Matching-Daten
  empfangen werden;
- rechtliche/Datenschutz-Schlussabnahme;
- Meta Business/App Review und echte Facebook-/Instagram-E2E-Abnahme als
  separater Social-Gate.

Issue #714 bleibt bis zu diesen externen Nachweisen offen. Eine technische
Production-Aktivierung oder ein Deploy ist dafür nicht erneut erforderlich.
