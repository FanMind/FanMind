# Stripe-Unternehmensprüfung – 8. November 2026

Betroffene Grenzen: FM-CONTRACT-AI-BILLING-001 / FM-IGATE-AI-BILLING-001 und FM-CONTRACT-REG-ENTITLEMENT-001 / FM-IGATE-REG-ENTITLEMENT-001. Diese Sourcekorrektur bestätigt ausschließlich die UID und ihre öffentliche Darstellung; kein Billing-/Tax-/Produktionsgate wird freigegeben.

## Durchgeführt und nachgelesen

- EU-VIES REST-Abfrage am 08.11.2026 um 17:01:43 UTC: ATU66320126 gültig, Name „Guggenberger Brigitte Erika“, Anschrift Bahnstraße 11/Stg. 2/1, AT-2351 Wiener Neudorf. Vollständige Antwort privat dokumentiert; Hash im bestehenden externen Freigaberegister. Kein qualifiziertes FinanzOnline-Protokoll: requestIdentifier leer, Vergleichsfelder NOT_PROCESSED. Originaler übermittelter Nachweis nennt dieselbe UID und die separat geführte Steuernummer.
- Bestehendes Stripe-Live-Konto: company.name auf Brigitte Erika Guggenberger, Geschäfts- und Supportadresse auf Bahnstraße 11, Stiege 2, Tür 1, 2351 Wiener Neudorf korrigiert. FanMind bleibt Handelsname.
- Steuernummer im vorgesehenen Unternehmens-Steuerfeld und UID im vorgesehenen Umsatzsteuerfeld gespeichert. Stripe-Readback: tax_id_provided=true und vat_id_provided=true. Die Steuernummer wird nicht in diesem öffentlichen Bericht oder im Impressum veröffentlicht.
- Support-E-Mail von kontakt@fanmind.ch auf die ausdrücklich bestätigte fanmind@fanmind.ch korrigiert. Geschäftliche Telefonnummer +43 676 536 72 36 beibehalten. Abweichendes Mailto-Ziel aus der Ergänzung nicht übernommen.
- UID zusätzlich als AT VAT in den Kundenrechnungs-Einstellungen gespeichert, getrennt in Live und bestehender Sandbox. Dies ist keine ausgeführte oder geprüfte Kundenrechnung; der API-Readback liefert weiterhin default_account_tax_ids=[] und beweist daher keine automatische Default-Zuordnung.
- Stripe-Tax-Hauptsitz vervollständigt; status=active, bestehendes exclusive-Steuerverhalten beibehalten. Keine Registrierung, Befreiung, OSS-Option oder Produktklassifikation hinzugefügt.
- Readback nach Änderungen: charges_enabled=true, payouts_enabled=true, keine currently_due/past_due/pending_verification. Bankverbindung und Auszahlungsplan nicht geändert. Browser zeigt Bernd als Super-Administrator; keine Team-/Rollenänderung.

## Rechtliche Identität bleibt offen

company.name ist korrigiert. Das Konto bleibt business_type=individual mit Bernd als verifizierter Person und representative=true; owner=false. Dies ist keine vollständige Berichtigung der rechtlichen Kontoinhaberin. Die Einzelpersonenmaske verlangt rechtsgültigen Namen, Geburtsdatum und Privatadresse. Es wurde weder Bernds bestehendes Geburtsdatum Brigitte zugeordnet noch eine Vollmacht erfunden. Brigitte ist wirtschaftlich die Inhaberin des Einzelunternehmens; Bernd darf operativer Ansprechpartner und Administrator bleiben. Eine Vertretungsbefugnis muss gesondert belegt und von Stripe akzeptiert werden. Die administrative Rolle allein ersetzt diese nicht.

Der sichere nächste Eingriff ist die persönliche beziehungsweise von Stripe freigeschaltete Berichtigung des bestehenden Einzelpersonen-Kontos einschließlich Brigittes vollständiger Identitätsdaten und gegebenenfalls Vollmacht für Bernd. Kein neues Konto, kein Team-Transfer und keine Supportnachricht versendet. Offizielle Stripe-Einstiege: https://support.stripe.com/questions/transfer-a-stripe-account-to-a-different-entity-due-to-a-business-sale-or-acquisition und https://support.stripe.com/questions/change-the-owner-of-a-stripe-account . Der zweite Artikel betrifft den administrativen Kontobesitz, nicht allein die wirtschaftliche Identität.

## Kataloge und Steuerblocker

Live vollständig paginiert: 13 Preisobjekte. Acht aktive gewünschte Produkte: 99/199/312 EUR monatlich, Datenpakete 14,99/37,49/74,99/149 EUR einmalig und 1 EUR täglich. Fünf Legacy-Produkte bereits archiviert, ihre Preisobjekte noch aktiv. Die einzige zurückgegebene historische Subscription ist ein gekündigter Daily-Test; keine aktiven Abos beobachtet. Historische Workspace-Verträge und Source-Preisreferenzen bleiben relevant, deshalb keine weiteren Preise deaktiviert und keine Zahlungshistorie gelöscht.

Bestehende Sandbox im Browser zugänglich: genau dieselben acht aktiven Produktnamen und Beträge; keine zusätzlichen Konten/Produkte angelegt. Bei den drei neuen Monatsprodukten und vier Datenpaketen fehlt in der Sandbox der Produkt-Steuercode. Live haben die drei Monatsprodukte den vorhandenen Code txcd_10103001; die vier Datenpakete keinen. Die Zuordnung ist vor B2C/B2B-Verkaufsfreigabe zu bestätigen; kein Code geraten.

Live Tax Registrations: leere Liste, has_more=false. Monitoring computed_at=2026-11-07T00:00:00Z, locations und unattributed_locations leer; keine Aussage zu außerhalb Stripe liegenden Umsätzen. Sandbox enthält eine ältere Registrierung „Österreich – Kleines Handelsunternehmen (EU)“ seit 09.08.2026, Zustand „Erforderliche Maßnahmen / Problem bei der Steuereinrichtung“, Erhebung und Einreichung=0. Diese bestehende Einstellung wurde nicht stillschweigend durch Regelbesteuerung oder OSS ersetzt. UID-Gültigkeit beweist keine konkrete OSS-Anmeldung oder Wahl der Kleinunternehmer-/Regelbesteuerung.

## Geprüfte technische Grenzen

- Vollständiger Next-Build einschließlich TypeScript: PASS; 18 bestehende Rechts-/Nachweis-Tests und 80 Stripe-/Katalog-/Webhook-/Top-up-/Reconciliationtests: PASS, keine Skips. Gezieltes ESLint, Product/Referral/Legal/Actions-Prüfungen und Driftprüfung: PASS. 162 Governance-Adversarialtests: PASS; konservative Releaseentscheidung weiterhin BLOCK.
- Staging /api/version am 08.11.2026 17:10:52 UTC: 83130e7471e5d342cecfb198c36759f7ce4aa0be, runtimeEnvironment=staging. Production 17:10:56 UTC: unverändert a798d7938bb4e7e168f615f0c32d1a603dd47d4a.
- Tatsächliche Staging-Webhooksignaturprüfung: POST mit leerem unsigniertem Objekt -> HTTP 400, „Ungültige Stripe-Signatur.“ Keine gültige Zahlungsnachricht simuliert oder Zahlung ausgelöst.
- Staging-Registrierung zeigt vor Integration von #1444 noch 990 EUR Starter Flex und zwölfmonatige Legacy-Auswahl. Bestehenden PR #1444 wiederverwendet, aktuellen Main #1447 konfliktfrei integriert. Neue Source nicht als deployt ausgegeben.
- #1446 ist bereits installiert; seine Dokumentation hält fehlende Entitlement-/Grant-/Reversal-RPCs, gesperrte Readiness und blockierte Capacity-Baseline fest. Diese Zielbefunde stammen aus der vorherigen Abnahme, wurden hier nicht als neue Datenbankmessung ausgegeben. Kein SQL, Secret, Flag oder Hostmapping verändert.
- Neue Capacity-Grundpaket-Checkout-/Entitlement-Verdrahtung ist noch nicht allgemein verkaufsfähig; #1444 ist eine kostenlose Registrierung und Präferenzwahl. Kein erfolgreicher Hosted-Checkout, keine Aboanlage, kein signierter Zahlungs-/Grant-/Refund-End-to-End-Test und keine Rechnungs-PDF-Abnahme behauptet. Keine Kundentestdaten erzeugt, somit keine zu bereinigen.

Recovery: öffentliche Source durch regulären Revert. Externe Unternehmens-/Steuerkorrekturen nicht pauschal zurücksetzen: die alten Angaben waren falsch. Bank, Identität, Verträge und Zahlungsereignisse wurden nicht überschrieben. Support-Arbeiten bleiben unabhängig.

Nachtrag: Frischer signierter Staging-Smoke auf 83130e74 am 08.11.2026 bestanden, Run 42504599797 / Job 128804400483: Release verifiziert, Signatur akzeptiert, HTTP 200, Mutationen=0. Das ist weiterhin kein bezahlter Checkout-/Abo-/Grant-Nachweis. Im ersten Testcommit war die vollständige Steuernummer als unnötiger negativer Vergleichswert enthalten; der Folgecommit ersetzt sie durch eine allgemeine Formatprüfung. Die frühere Git-Version bleibt nachvollziehbar; keine Historienbereinigung oder Löschung behauptet. Im öffentlichen Impressum stand die Steuernummer nie.
