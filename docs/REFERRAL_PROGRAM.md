# FanMind Referral Growth Window

Stand: Juli 2026

Dieses Dokument beschreibt das geplante Referral-Programm. Es ist eine Produkt-/Billing-Roadmap und darf erst als aktiv verkauft oder automatisiert werden, wenn Tracking, Billing-Verrechnung, Missbrauchsschutz sowie rechtliche/steuerliche Prüfung abgeschlossen sind.

## 1. Kernidee

FanMind startet ein zeitlich bzw. wachstumsbasiert begrenztes Referral-Programm. Nicht nur die ersten 100 Nutzer bekommen diese Chance. Stattdessen läuft die Aktion, bis FanMind global `2.000` aktive zahlende FanMind-Kunden/Workspaces erreicht.

Innerhalb dieses Growth Windows kann jeder berechtigte zahlende FanMind-Nutzer über einen persönlichen Referral-Link neue zahlende FanMind-Kunden bringen und dadurch seine Starter-Grundgebühr von 312 €/Monat senken.

Regel:

- Pro aktivem geworbenen zahlenden Kunden/Workspace: `5 %` Rabatt auf die eigene Starter-Grundgebühr von 312 €/Monat.
- Maximal wirksam pro Referrer: `20` aktive geworbene Kunden/Workspaces.
- Bei 20 aktiven geworbenen Kunden/Workspaces: rechnerisch `100 %` Rabatt auf die eigene Starter-Grundgebühr.
- Wenn ein geworbener Kunde kündigt, nicht zahlt, gesperrt wird oder nicht mehr aktiv ist, fällt dessen `5 %` wieder weg.
- Die Aktion ist global auf das Wachstum bis `2.000` aktive zahlende FanMind-Kunden/Workspaces begrenzt.
- Sobald der 2.000. aktive zahlende FanMind-Kunde/Workspace erreicht ist, wird das Referral Growth Window geschlossen.
- Nach Schließung bleiben bereits erworbene aktive Referral-Rabatte bestehen, solange die geworbenen Kunden aktiv bleiben.
- Nach Schließung können keine neuen zusätzlichen Rabattprozente mehr verdient werden, außer FanMind fällt wieder unter die definierte Schwelle und öffnet das Growth Window ausdrücklich erneut.

## 2. Warum 2.000 statt erste 100

Die erste Idee `100 Nutzer × 20 Referrals = 2.000 Nutzer` wird sauberer umgesetzt, wenn nicht nur 100 Referrer begrenzt werden, sondern das gesamte Programm an das globale Wachstumsziel gekoppelt wird.

Vorteile:

- Jeder frühe FanMind-Kunde hat eine faire Chance, seine Kosten zu senken.
- Das Programm bleibt trotzdem wirtschaftlich gedeckelt.
- FanMind belohnt Wachstum bis zum strategischen Ziel von 2.000 aktiven Kunden/Workspaces.
- Sobald dieses Ziel erreicht ist, endet die Aktion für neue Rabattsteigerungen.
- Bestehende Rabatte bleiben nachvollziehbar, solange die dazugehörigen geworbenen Kunden aktiv bleiben.

## 3. Beispiel

| Aktive geworbene Kunden/Workspaces | Rabatt | Effekt |
| --- | ---: | --- |
| 0 | 0 % | volle Starter-Grundgebühr; Add-ons zusätzlich |
| 1 | 5 % | 95 % der Starter-Grundgebühr; Add-ons zusätzlich |
| 5 | 25 % | 75 % der Starter-Grundgebühr; Add-ons zusätzlich |
| 10 | 50 % | 50 % der Starter-Grundgebühr; Add-ons zusätzlich |
| 20 | 100 % | Starter-Grundgebühr rechnerisch 0 €; Add-ons bleiben zahlbar |

Wenn von 20 aktiven geworbenen Kunden einer kündigt, bleiben 19 aktive Referrals. Der Rabatt fällt dann von 100 % auf 95 %.

Wenn das globale Growth Window bereits geschlossen ist, kann der Referrer diesen verlorenen 5-%-Anteil nicht automatisch durch einen neuen Referral ersetzen, solange FanMind nicht wieder unter die definierte Schwelle fällt oder Admin das Programm ausdrücklich erneut öffnet.

## 4. Globale Programmphase

Das Programm braucht einen globalen Status.

Mögliche Status:

- `open`: Referral Growth Window ist offen. Neue Referrals können Rabatt erzeugen.
- `closing`: 2.000er-Schwelle ist erreicht oder wird geprüft. Neue Attribution wird eingefroren oder nur noch admin-geprüft.
- `closed`: Aktion ist beendet. Bestehende aktive Rabatte bleiben dynamisch erhalten, aber neue zusätzliche Rabattprozente entstehen nicht mehr.
- `reopened`: Aktion wurde ausdrücklich wieder geöffnet, z. B. falls die aktive Kundenzahl dauerhaft unter die Schwelle fällt.

Standardregel:

- Bei Erreichen von `2.000` aktiven zahlenden Kunden/Workspaces wird der Status `closed`.
- Ab `closed` werden keine neuen Rabattansprüche mehr aufgebaut.
- Bestehende Referral-Beziehungen bleiben gespeichert und werden weiter für bestehende Rabattansprüche ausgewertet.

## 5. Was genau zählt als 2.000?

Für die Begrenzung sollte FanMind nicht reine User-Accounts zählen, sondern aktive zahlende Kunden/Workspaces.

Empfohlene Zählgröße:

`active_paid_workspace_count`

Ein Workspace zählt für die 2.000er-Schwelle, wenn:

- Workspace ist nicht Demo-only.
- Plan ist zahlungspflichtig oder bezahlt.
- Billing-Status ist aktiv oder innerhalb akzeptierter Zahlungsfrist.
- Workspace ist nicht gekündigt, gesperrt, dauerhaft zahlungsfehlerhaft oder refundiert.

Warum Workspace statt User:

- Ein Kunde kann mehrere Teammitglieder haben.
- Mehrere Teammitglieder derselben Firma sollen nicht mehrfach als Kundenziel zählen.
- Es schützt vor Fake-Accounts und mehrfachen Self-Registrierungen.

Wenn FanMind später doch einzelne Nutzer zählen will, muss dieses Dokument bewusst geändert werden. Standard bleibt: Workspace/Kunde zählt.

## 6. Begriffe

### Referrer

Der bestehende FanMind-Kunde/Workspace, der seinen Referral-Link teilt.

### Referred Customer / Referred Workspace

Der neue zahlende FanMind-Kunde/Workspace, der über den Referral-Link oder Referral-Code zugeordnet wurde.

### Aktiver geworbener Kunde

Ein geworbener Kunde zählt nur, wenn alle Bedingungen erfüllt sind:

- Registrierung oder Checkout über gültigen Referral-Link oder eindeutig zuordenbaren Referral-Code.
- Workspace ist nicht Demo-only.
- Zahlungspflichtiger Plan ist aktiv oder bezahlt.
- Billing-Status ist nicht gekündigt, nicht gesperrt, nicht dauerhaft fehlgeschlagen.
- Keine Rückerstattung, kein Testmissbrauch, kein Self-Referral.
- Das Referral wurde während eines offenen Referral Growth Windows erzeugt oder vom Admin ausdrücklich zugelassen.

## 7. Was rabattiert wird

Standardregel:

- Der Rabatt gilt ausschließlich auf die Starter-Grundgebühr von 312 €/Monat.
- Einmalige Einrichtung, nachgekaufte AI-Kapazität und andere Add-ons sind nicht rabattfähig.
- Rabatte werden nicht bar ausgezahlt.
- Nicht genutzte Rabatte werden nicht in Guthaben umgewandelt.
- Rabatt kann nicht unter 0 € fallen.

Formel:

`discount_percent = min(active_referrals * 5, 100)`

`discounted_monthly_fee = monthly_fee * (1 - discount_percent / 100)`

## 8. Statuslogik für Referrals

Ein Referral kann diese Status haben:

- `pending`: Registrierung oder Lead erkannt, aber noch nicht zahlend aktiv.
- `qualified`: Checkout/Plan passt, aber Wartefrist/Prüfung läuft noch.
- `active`: zählt für Rabatt.
- `inactive`: zählt nicht, z. B. gekündigt, gesperrt, abgelaufen.
- `rejected`: abgelehnt, z. B. Self-Referral, Missbrauch, Duplikat.
- `refunded`: zählt nicht.
- `locked_after_window_closed`: nach Programmende erfasst, aber nicht rabattwirksam.

Nur `active` zählt für Rabatt.

## 9. Rabattverlust nach Programmende

Wichtiges Verhalten nach dem 2.000er-Cap:

- Bereits aktive Referrals bleiben rabattwirksam, solange sie aktiv bleiben.
- Fällt ein aktives Referral weg, sinkt der Rabatt entsprechend um 5 %.
- Nach geschlossenem Growth Window kann dieser verlorene Rabatt nicht automatisch durch ein neues Referral ersetzt werden.
- Eine Ausnahme gibt es nur, wenn der globale Programmstatus wieder auf `open` oder `reopened` gesetzt wird.

Beispiel:

- Referrer hat 12 aktive Referrals = 60 % Rabatt.
- FanMind erreicht 2.000 aktive zahlende Workspaces. Growth Window schließt.
- Zwei geworbene Workspaces kündigen.
- Referrer fällt auf 10 aktive Referrals = 50 % Rabatt.
- Neue Referrals nach Programmschluss erhöhen den Rabatt nicht, solange das Programm geschlossen bleibt.

## 10. Attribution-Regeln

Verbindliche Regel: `first_valid_click_wins`.

- Referral-Link setzt `referral_code`.
- Die erste gültige Zuordnung eines Workspaces zu einem Referrer ist technisch eindeutig und danach unveränderlich.
- Ein Workspace kann nur einem Referrer zugeordnet werden.
- Nullsetzung der optionalen User-Bezüge bei einer rechtmäßigen Kontolöschung bleibt möglich; eine nachträgliche Neuzuordnung ist gesperrt.
- Keine Multi-Level-Logik.
- Keine Provision auf Referrals von Referrals.
- Self-Referral wird sowohl auf Workspace- als auch auf User-Ebene blockiert.
- Admin kann Status und Notizen bei Streitfällen korrigieren, aber keine bestehende Attribution auf einen anderen Referrer umhängen.

Die technische Staging-Abnahme dieser Regeln folgt dem getrennten,
checksum- und commitgebundenen Verify/Apply-Pfad in
`docs/operations/REFERRAL_ATTRIBUTION_STAGING.md`. Erst ein grüner read-only
Postflight darf die vollständig zurückgerollte Lifecycle-Acceptance starten;
beide Schritte lassen Billing und Stripe deaktiviert.

## 11. Missbrauchsschutz

Nicht erlaubt:

- Self-Referral mit eigener E-Mail, eigenem Workspace oder eigener Firma.
- Mehrfachaccounts zur Rabattmaximierung.
- Fake-Registrierungen.
- Rückerstattung/Chargeback und trotzdem Rabatt behalten.
- Referral-Spam im Namen von FanMind.
- Irreführende Versprechen über aktive Integrationen, automatische Sendung oder Preise.
- Referrals nach geschlossenem Growth Window als rabattwirksam darstellen.

Admin muss Referrals sperren, ablehnen oder manuell korrigieren können.

## 12. Transparenz im Produkt

Späteres Dashboard-Modul für berechtigte Nutzer:

- persönlicher Referral-Link;
- globaler Programmstatus: offen / geschlossen;
- globale Zählung: z. B. `1.284 / 2.000 aktive zahlende Workspaces`;
- Anzahl geworbener Kunden;
- Anzahl aktiver rabattwirksamer geworbener Kunden;
- aktueller Rabatt in Prozent;
- rechnerischer monatlicher Vorteil;
- Hinweis: Rabatt hängt von aktiven, zahlenden geworbenen Kunden ab;
- Hinweis: Wenn ein geworbener Kunde kündigt, sinkt der Rabatt wieder;
- Hinweis: Nach Schließung des Growth Windows können verlorene Prozente nicht automatisch ersetzt werden;
- Limit: maximal 20 aktive Referrals für 100 % Rabatt.

## 13. Adminbereich

Admin braucht eine Übersicht:

- globaler Programmstatus;
- aktueller aktiver zahlender Workspace-/Kundenzähler;
- Cap: 2.000;
- alle Referrer;
- Referral-Code / Link;
- aktive Referrals;
- pending/inactive/rejected/locked Referrals;
- aktueller Rabatt;
- verlorener Rabatt durch inaktive Referrals;
- manueller Override;
- Missbrauchsnotizen;
- Billing-Verrechnung;
- Export für Prüfung.

## 14. Datenmodell-Vorschlag

### `referral_program_state`

- `id`
- `status`
- `active_paid_workspace_cap`
- `active_paid_workspace_count_snapshot`
- `closed_at`
- `reopened_at`
- `updated_at`
- `updated_by_user_id`
- `admin_note`

### `referral_program_members`

- `id`
- `workspace_id`
- `user_id`
- `referral_code`
- `eligible`
- `status`
- `joined_at`
- `created_at`
- `updated_at`
- `admin_note`

### `referrals`

- `id`
- `referrer_workspace_id`
- `referrer_user_id`
- `referred_workspace_id`
- `referred_user_id`
- `referral_code`
- `status`
- `created_during_program_status`
- `first_seen_at`
- `qualified_at`
- `activated_at`
- `deactivated_at`
- `deactivation_reason`
- `billing_status_snapshot`
- `locked_reason`
- `created_at`
- `updated_at`

### `referral_discount_snapshots`

- `id`
- `workspace_id`
- `active_referral_count`
- `discount_percent`
- `monthly_fee_cents_before_discount`
- `monthly_discount_cents`
- `monthly_fee_cents_after_discount`
- `program_status_snapshot`
- `calculated_at`

## 15. Billing-Regel

Billing darf nicht nur beim Signup berechnen. Es muss regelmäßig neu berechnen:

- vor Rechnungslauf;
- nach Kündigung eines geworbenen Kunden;
- nach fehlgeschlagener Zahlung;
- nach Rückerstattung;
- nach Admin-Override;
- nach Reaktivierung eines geworbenen Kunden;
- nach Schließung oder Wiederöffnung des Referral Growth Windows.

Wenn ein geworbener Kunde wegfällt, steigt der zu zahlende Betrag beim Referrer entsprechend wieder.

Nach Programmschluss dürfen neue Referrals nicht automatisch Rabatt erzeugen, selbst wenn ein Referrer Rabatt verloren hat. Ausnahme: Programm wird ausdrücklich wieder geöffnet.

## 16. Recht/Steuer/AGB

Vor Aktivierung prüfen und in AGB/Zahlungsbedingungen ergänzen:

- Teilnahmebedingungen;
- Rabatt statt Auszahlung;
- keine Auszahlung von Guthaben;
- globales Cap bis 2.000 aktive zahlende FanMind-Kunden/Workspaces;
- maximal 20 aktive Referrals pro Referrer;
- Wegfall des Rabatts bei Kündigung/Inaktivität geworbener Kunden;
- kein automatisches Nachverdienen neuer Rabatte nach geschlossenem Growth Window;
- Missbrauchsausschluss;
- Admin-Entscheid bei Streitfällen;
- Datenschutz bei Referral-Tracking;
- steuerliche Behandlung von Rabatten/Gutschriften.

## 17. Status in FanMind

Aktueller Status:

- Admin-only Datenmodell und Adminübersicht sind als Grundlage vorbereitet.
- Noch nicht aktiv als öffentliche Rabatt- oder automatische Billing-Funktion.
- Darf erwähnt werden als geplantes Growth-/Referral-Programm bis zum 2.000er-Ziel, aber nur mit klarer Einschränkung.
- Nicht in Gerhards Standarddemo zeigen, solange Tracking/Billing/Legal nicht fertig ist.

## 18. Akzeptanzkriterien für Umsetzung

- [x] Globales Referral Growth Window ist auf 2.000 aktive zahlende Workspaces/Kunden begrenzt (`active_paid_workspace_count` als globale Cap-Größe).
- [ ] Jeder berechtigte zahlende Nutzer/Workspace kann teilnehmen, solange das Growth Window offen ist.
- [x] Jeder berechtigte Workspace kann einen eindeutigen Referral-Code/Link in der Nutzeransicht sehen.
- [x] Referral-Code wird bei Registrierung erfasst und als Attribution zwischen Referrer-Workspace und neuem Workspace gespeichert; Aktivierung bleibt Admin-/Billing-Prüfung.
- [ ] Nur aktive zahlende geworbene Workspaces/Kunden zählen.
- [x] Statusanzeige berechnet Rabatt = aktive Referrals * 5 %, maximal 100 %, ohne automatische Billing-Verrechnung.
- [x] Maximal 20 aktive Referrals pro Referrer werden in der Statusberechnung berücksichtigt.
- [ ] Erreichen von 2.000 aktiven zahlenden Workspaces/Kunden schließt das Programm für neue Rabattsteigerungen.
- [ ] Kündigung/Deaktivierung eines geworbenen Kunden reduziert Rabatt automatisch.
- [x] Nach Programmschluss bzw. 2.000er Cap werden neue Attributions als `locked_after_window_closed` vorbereitet und nicht automatisch rabattwirksam.
- [x] Admin kann Programmstatus, Referrals, aktive Referrals, Rabattberechnung und Overrides in einer Adminübersicht prüfen und Referral-Status/Admin-Notiz korrigieren.
- [ ] Billing berücksichtigt Rabatt erst nach validiertem Status.
- [ ] Dashboard zeigt Rabatt und globalen Programmstatus transparent.
- [ ] AGB/Zahlungsbedingungen sind aktualisiert (separater Legal-/Payment-Schritt vor Aktivierung).
- [x] Security/RLS verhindert fremde Referral-Daten im ersten Schritt durch admin-only Service-Role-Zugriff ohne öffentliche authenticated Policies.


## 21. Phase 2 Umsetzungsstand (Issue #461)

Phase 2 ergänzt den öffentlichen Referral-Link pro berechtigtem Workspace, die Erfassung von `ref`/`referral_code` bei der Registrierung, die serverseitige Speicherung der Attribution und eine Nutzeransicht für Code, Link, Growth-Window-Cap, aktive Referrals und vorbereiteten Rabattstatus. Die Adminansicht erlaubt Status-/Notiz-Korrekturen. Das ist weiterhin keine Auszahlung, keine zweite Ebene und keine automatische Billing-Verrechnung; Aktivierung eines Referrals setzt Zahlungs-/Aktivitätsprüfung voraus.

## Öffentliche Teilnahmebedingungen

Öffentliche Teilnahmebedingungen: `/referral-bedingungen`. Die automatische Rabattverrechnung bleibt bis zum freigegebenen Stripe-Sandbox-Lifecycle-Test sowie zur steuerlichen und rechtlichen Prüfung deaktiviert.
