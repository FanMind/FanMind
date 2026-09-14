# Registrierung, Zahlungsmodelle und offene Gesamtabnahmen

Stand: 10. September 2026. Auftrag: FM-BILL-002 / FM-CR-027.

**Die drei Angebote und der kostenlose Kontoeinstieg sind veröffentlicht.**
[PR #1096](https://github.com/FanMind/FanMind/pull/1096) ist abgeschlossen;
Release `0b54ffba3e46757f47e1a3a1c6c4696d6e26b098` wurde durch
[Deployment](https://github.com/FanMind/FanMind/actions/runs/34502092289),
[getrennten Production-Audit](https://github.com/FanMind/FanMind/actions/runs/34502241951)
und [öffentliche Prüfung](https://github.com/FanMind/FanMind/actions/runs/34502241927)
bestätigt. **Die vollständige kostenpflichtige Aktivierung bleibt teilweise offen.**
Der veröffentlichte Katalog und die noch fehlende Aktivierung haben getrennte
Statusangaben; eine weitere Preis- oder Veröffentlichungsfreigabe wird dafür
nicht erneut verlangt.

Bernd hat die Veröffentlichung und diese drei dauerhaften Angebote bestätigt:

| Angebot | Setup | Laufender Preis | Bestehende Konditionen |
| --- | ---: | ---: | --- |
| Starter Flex | 990 € | 312 €/Monat | Monatlich kündbar |
| Starter 12 Monate | 0 € | 312 €/Monat | 12 Monate Mindestlaufzeit, danach monatlich |
| Daily | 0 € | 1 €/Tag | Täglich kündbar, kein Referral-Rabatt |

Die bestehende Nettopreisbasis bleibt erhalten. Die Preise existieren bereits
im verbundenen Stripe-Live-Konto; sie werden weder neu angelegt noch ersetzt.
Daily verwendet aus Kompatibilitätsgründen weiterhin die bisherige interne
Engine. Die frühere 24-Stunden-Freigabe beschränkt den öffentlichen Katalog
nicht mehr. Die Auswahl wird im kostenlosen Konto nur als unverbindlicher
Paketwunsch gespeichert; sie erteilt keine Zahlungs- oder Workspace-Rechte.

## Was erledigt ist und was tatsächlich noch fehlt

| Gesamtpunkt | Belegt erledigt | Offene Abschlussarbeit |
| --- | --- | --- |
| Vollständiger Restore-Test | Isolierter Datenbank-Restore und DB_POSTCHECKED sind abgenommen. | Tatsächlicher Storage-Restore auf gesondertem temporärem Ziel, Konfigurationsprüfung, Aufräumen und Abschlusskontrolle. Der Owner hatte zuletzt nur lokale Storage-Tests gewählt; ein reales Ziel benötigt seine konkrete Kosten-/Löschentscheidung. |
| Echte Registrierung | Kostenloses Konto, Bestätigungs-/Fortsetzungsseite und erneute Bestätigungsmail sind als Web-Code mit PR #1095 veröffentlicht; alle drei Angebote einschließlich DE/EN-Auswahl sind mit #1096 veröffentlicht. | Zugestellte Mail mit freigegebenem Testempfänger, Produktions-Rollout der Workspace-Funktionen und Rechte, passende versionierte Vertragsannahme sowie echter vollständiger Aktivierungs-/Checkout-Nachweis. |
| KI-/Billing-Gesamtabnahme | Vorhandene Preise und die belegten technischen Staging-/Lifecycle-/Ledger-Prüfungen bleiben erhalten. | Produkt-/Qualitäts-/Kostenentscheidungen für bezahlte KI-Stufen, kanonische Billing-Verarbeitung, Produktions-Rollout, Steuer-/Vertragsvoraussetzungen und vollständige Provider-/Webhook-Abnahme. Die gesonderte Aktionsautorisierung des technischen September-8-Laufs bleibt zu klären; kein Wiederholungslauf nur für die Dokumentation. |
| Security- und Meta-Abnahme | Web-Paketkorrekturen aus #1089 sind veröffentlicht. Die Production-Triggerhärtung sowie der Schutz gegen geleakte Passwörter in Production und Staging sind separat umgesetzt und unabhängig verifiziert. | Begrenzte Staging-RPC-Ausnahmen sowie echte Meta-Events-/App-Review-/Provider-Nachweise. Mobile-Pakete brauchen weiterhin ihren eigenen signierten aktuellen Release. |

Ein erfolgreicher Teilschritt wird nicht erneut als unerledigt behandelt.
Ein offener Gesamtpunkt behauptet aber auch keine vollständige Abnahme seiner
fehlenden Teilstücke. Die getrennte Produktions-/Testumgebung bleibt ACCEPTED.

## Aktuell nachgewiesene Aktivierungshindernisse

1. Der Live-Katalog enthält die drei passenden EUR-Preise. Die aktuelle
   Stripe-Abfrage liefert jedoch **null Tax-Registrierungen** (`has_more=false`).
   Aktive Tax-Einstellungen allein ersetzen diese nicht. Die tatsächliche
   steuerliche Einordnung und Registrierungen sind vom Betreiber zu belegen;
   keine erfundene UID, Registrierung oder automatische Kleinunternehmerwahl.
2. Im Produktionskatalog fehlen sowohl `ensure_current_user_workspace(...)`
   als auch `ensure_internal_daily_test_workspace(...)`. Direkte Browser-
   INSERT-Rechte auf Workspaces sind noch nicht durch den Contract-Schritt
   entzogen. Der bestehende kontrollierte Expand-/Contract-Ablauf ist nötig;
   das ist Engineering-Arbeit und nicht nur eine ausstehende Owner-Zustimmung.
3. Die öffentliche Zahlungsdarstellung enthält die drei Angebote. Die aktive
   Consent-Policy bleibt auf der ungeklärten Version `2026-06-v1` gesperrt.
   Eine dazu passende neue Vertragsversion muss mit SQL, Server-Prüfung und
   echter erneuter Annahme ausgerollt werden. Alte Zustimmungen dürfen nicht
   rückwirkend umetikettiert werden. Die Preisfreigabe ist dokumentiert;
   eine nicht vorliegende juristische Abnahme wird nicht erfunden.
4. Die beiden Billing-Ledger und ihre kanonische Produktionsverarbeitung
   behalten ihre getrennten technischen Rollout-Voraussetzungen. Diese werden
   durch eine öffentliche Preiskarte nicht erfüllt.
5. Das bestehende Stripe-Daily-Produkt trägt noch den historischen Namen
   `FanMind Internal Daily Test`. Vor echtem öffentlichen Checkout ist auch
   die Provider-Darstellung auf `FanMind Daily` abzugleichen. Im vorliegenden
   Lauf war keine passende Produkt-Schreiboperation verfügbar; es wurde kein
   Preis oder Produkt geändert.

Die Registrierung darf bereits ein kostenloses Konto anlegen. Eine
kostenpflichtige Aktivierung wird erst mit den tatsächlichen Voraussetzungen
ermöglicht. Es wurde keine Zahlung ausgelöst und keine Kundendaten- oder
Vertragsmigration als Nebenwirkung der Website-Veröffentlichung ausgeführt.

## Verifizierte Nachweise

- Passwortschutz: Authenticated Save/Reopen in beiden getrennten FanMind-Projekten; unabhängige Supabase-Advisors am 10. September um 16:11:50 UTC (Production) und 16:19:32 UTC (Staging) bestätigen, dass die Leaked-Password-Warnung entfernt ist. Keine anderen Auth-Einstellungen, Passwörter, Konten oder Sessions wurden verändert.

- Konto-Veröffentlichung: [PR #1095](https://github.com/FanMind/FanMind/pull/1095),
  Release `9a6e9d016cb0928e58b89c6c2d5b6183379c50ed`;
  [Deploy](https://github.com/FanMind/FanMind/actions/runs/34493661010),
  [Production-Audit](https://github.com/FanMind/FanMind/actions/runs/34493830507)
  und [öffentliche Bereitschaftsprüfung](https://github.com/FanMind/FanMind/actions/runs/34493830467)
  erfolgreich.
- Production-Triggerhärtung auf derselben Version:
  [Apply](https://github.com/FanMind/FanMind/actions/runs/34496892707) liefert
  `applied`; [getrennter Verify](https://github.com/FanMind/FanMind/actions/runs/34497099991)
  liefert `verified`. Alle Audits davor/danach bestanden. Unabhängige
  Supabase-Advisors um 15:38:41 UTC: drei Search-Path- und zwei Browser-EXECUTE-
  Warnungen verschwunden. Die damals noch bestehende Auth-Warnung wurde danach durch die oben belegte Passwortschutz-Aktivierung beseitigt. Vierzehn serviceinterne
  RLS-INFO-Einträge sind kein Grund, Browserrechte zu erteilen.
- Restore: bestehende Receipts
  `FM-RST-001-ISOLATED-DATABASE-RESTORE-ACCEPTED-20260828.md` und
  `FM-RST-001-DATABASE-POSTCHECK-ACCEPTED-20260907.md` unter
  `project-memory/receipts/`; ursprünglicher Restore-Run `33178878764`.
- Abgeschlossene Angebotsveröffentlichung: 1.446 Node-Tests bestanden,
  ein Test übersprungen, keine Fehler. Alle 13 Checks auf dem finalen
  PR-Stand `637e72790e651ba84c7a6c4868768410f9da8378` bestanden, einschließlich
  öffentlicher Desktop-/Mobile- und synthetischer Kernablauf-Browserprüfungen.
  Alle drei Review-Punkte sind geschlossen. Die tatsächliche Live-Prüfung von
  Daily in DE/EN und der drei Landingpage-Angebote ist im finalen
  [PR-Nachweis](https://github.com/FanMind/FanMind/pull/1096) festgehalten.
  Der unabhängige Audit meldet die oben genannte exakte Release-Version und
  `PRODUCTION_AUDIT_VERIFIED=true` um 16:27:53 UTC.

Die aktuellen Provider-Abfragen sind datierte Beobachtungen. Vor einer
späteren Aktivierung werden die veränderlichen Einstellungen erneut geprüft.
Unveränderliche erfolgreiche Restore-/Build-/Workflow-Nachweise bleiben gültig
für die jeweils belegte Version und den belegten Teilschritt.

## Reihenfolge

Die genehmigte Veröffentlichung des Kontoeinstiegs und der drei Angebote ist
abgeschlossen. Als nächste Registrierungsarbeit bleiben der kontrollierte
Production-Rollout für Workspace, Vertragsannahme und Billing sowie der
vollständige Nachweis von E-Mail bis Checkout/Webhook.
Offene Restore-, Mobile-/Push-, KI-/Billing-, Security-/Meta- und Social-
Abnahmen bleiben ihren bestehenden Aufgaben zugeordnet. Creator Intelligence
bleibt dauerhaft unter FM-CREATOR-001 in Phase 7b: nach abgenommener
Verkaufsübergabe, vor weiterer Phase 8. `sales_ready` bleibt bis zu den
vollständigen Nachweisen der erforderlichen Gates `false`.
