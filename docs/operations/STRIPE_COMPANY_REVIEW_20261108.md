# Stripe-Unternehmensprüfung – 8. November 2026

Betroffene Grenzen: FM-CONTRACT-AI-BILLING-001 / FM-IGATE-AI-BILLING-001 und FM-CONTRACT-REG-ENTITLEMENT-001 / FM-IGATE-REG-ENTITLEMENT-001. Diese Sourcekorrektur bestätigt ausschließlich die UID und ihre öffentliche Darstellung; kein Billing-/Tax-/Produktionsgate wird freigegeben.

## Durchgeführt und nachgelesen

- EU-VIES REST-Abfrage am 08.11.2026 um 17:01:43 UTC: ATU66320126 gültig, Name „Guggenberger Brigitte Erika“, Anschrift Bahnstraße 11/Stg. 2/1, AT-2351 Wiener Neudorf. Vollständige Antwort privat dokumentiert; Hash im bestehenden externen Freigaberegister. Kein qualifiziertes FinanzOnline-Protokoll: requestIdentifier leer, Vergleichsfelder NOT_PROCESSED. Originaler übermittelter Nachweis nennt dieselbe UID und die separat geführte Steuernummer.
- Bestehendes Stripe-Live-Konto: company.name auf Brigitte Erika Guggenberger, Geschäfts- und Supportadresse auf Bahnstraße 11, Stiege 2, Tür 1, 2351 Wiener Neudorf korrigiert. FanMind bleibt Handelsname.
- Steuernummer im vorgesehenen Unternehmens-Steuerfeld und UID im vorgesehenen Umsatzsteuerfeld gespeichert. Stripe-Readback: tax_id_provided=true und vat_id_provided=true. Die Steuernummer wird nicht in diesem öffentlichen Bericht oder im Impressum veröffentlicht.
- Support-E-Mail von kontakt@fanmind.ch auf die ausdrücklich bestätigte fanmind@fanmind.ch korrigiert. Geschäftliche Telefonnummer +43 676 536 72 36 beibehalten. Abweichendes Mailto-Ziel aus der Ergänzung nicht übernommen.
- UID zusätzlich als AT VAT in den Kundenrechnungs-Einstellungen gespeichert, getrennt in Live und bestehender Sandbox. Anschließend in beiden Umgebungen als Standard gesetzt. Erneuter Live-Readback am Abend bestätigt eine nichtleere default_account_tax_ids-Liste. Dies ist noch keine ausgeführte oder geprüfte Kundenrechnung.
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


## Erneute Prüfung und konkrete Eingriffe — 08.11.2026, Abend

Die vorigen Laufzeitabschnitte sind zeitgebundene historische Beobachtungen.
#1444 und #1448 sind inzwischen gemergt und auf Staging bereitgestellt:
Registrierung 99/199/312, 0 EUR Setup und öffentliche UID sind vorhanden.
Signierter Smoke auf dem integrierten Stand 6d0eb20c:
https://github.com/FanMind/FanMind/actions/runs/42506569015 (PASS, Mutationen=0).
Die parallele Support-Fortsetzung hat Main/Staging inzwischen auf baf0be3ed7c9a5935a46072afc094f3dd3abc818 gebracht;
Staging /api/version bestätigt dies am 08.11.2026 21:16:23 UTC.
Diese Dokumentationskorrektur verändert keine Support-Implementierung.

Live erneut gelesen: Brigitte als company.name; verifizierte individual-Person
weiterhin Bernd; charges/payouts aktiv, keine offenen requirements;
UID als Rechnungsstandard vorhanden. Telefon und bestätigte geschäftliche E-Mail
bleiben +43 676 536 72 36 und fanmind@fanmind.ch. Keine neue Personen-, Team-,
Bank- oder Steuerregistrierungsänderung in diesem Nachprüfungslauf.

Staging-Basis read-only, wiederholbare Transaktion mit abschließendem ROLLBACK:
Schema b598194f234d2510930c605a5ba5251b, fünf Foundation-Tabellen, vier Funktionen,
Projection/Lifecycle-Funktionen/-Spalten/-Index fehlen, sämtliche Geldtabellen
leer, Policy revision=2 mit 15/30/50 EUR und allen Schaltern aus/Freeze an.
Struktur sowie sonstige Sicherheitsgrenzen entsprechen der gepinnten Quelle;
Funktions- und Tabellen-ACLs entsprechen erst nach der bereits bestehenden
Supabase-Default-ACL-Normalisierung. Der unveränderte strikte Preflight bleibt
BLOCK. Diese Normalisierung ist eine Diagnose und keine Rechteberichtigung.

Die zwei historischen Supabase-Einträge wurden einschließlich SQL-Inhalt
privat ausgelesen und mit der vorhandenen kontrollierten Source verglichen:

- 20260930153430 / ai_capacity_billing_v2_activation_gates_20260930:
  vollständiger gespeicherter SQL-String MD5 3f4b7ea328c0c50aa23017512b9371d7;
  identisch zur aktuellen Aktivierungsdatei.
- 20260930153422 / ai_capacity_billing_v2_base_20260930:
  vollständiger gespeicherter SQL-String MD5 d47b8375727389ad5df05f8bd6973918;
  zur aktuellen Foundation unterscheiden sich nur die drei Budget-Defaults und
  die Erstbefüllung dieser Budgetspalten. Der tatsächliche Singleton hat bereits
  die freigegebenen Werte; es ist keine erneute Befüllung erforderlich.

Die historischen Einträge wurden weder gelöscht noch umbenannt. Die SQL-Diffs
klären deren Herkunft, ersetzen aber weder einen geprüften Reconcile-/Apply-
Controller noch dessen vollständige In-Transaction-Vor-/Nachprüfung,
Recovery-/Privacy-Review oder fehlende Entitlement-/Monatspaket-Verdrahtung.
Ein generisches db push oder direktes Überschreiben der Foundation wäre kein
ordnungsgemäßer Abschluss. Keine DB-Mutation durchgeführt.

### Vorbereiteter persönlicher Stripe-Eingriff

Das Dashboard zeigt eine Einzelpersonen-Bearbeitung, aber keine getrennte
Übertragung auf eine neue verifizierte Unternehmerin. Die geöffnete Maske wurde
unverändert abgebrochen. Stripe dokumentiert für bereits verifizierte
individual-Konten ausdrücklich die Kontaktaufnahme mit dem Support:
https://support.stripe.com/questions/change-the-account-representative-for-connected-accounts-with-platform-gathered-verification-requirements
Die Einschränkung stammt aus der Connect-Dokumentation; daraus wird keine
Berechtigung abgeleitet, dieses eigenständige Konto über die Persons API zu
verändern. Konto- und Rechtsinhaberkorrektur muss Stripe für das konkrete Konto
bestätigen; ein reiner Wechsel des administrativen Kontobesitzes genügt nicht.

Vorbereiteter Nachrichtentext, NICHT versendet:

> Bitte prüfen Sie die Berichtigung unseres bestehenden österreichischen
> FanMind-Kontos. Es ist als individual eingerichtet und die verifizierte Person
> ist derzeit Bernd Guggenberger. Rechtliche Einzelunternehmerin ist Brigitte
> Erika Guggenberger; Bernd bleibt operativer/technischer Ansprechpartner und
> berechtigter Administrator. Unternehmensname und Steuerfelder sind bereits
> korrigiert. Bitte nennen bzw. aktivieren Sie den sicheren Korrektur- und
> Verifikationsprozess im bestehenden Konto und die erforderlichen Nachweise
> sowie gegebenenfalls eine Vollmacht. Bestehende Administratorzugänge,
> Telefonnummer, geschäftliche E-Mail, Bankverbindung und Auszahlungsrechte
> sollen erhalten bleiben. Bitte zunächst keine Person entfernen und keine
> Kontosperre oder neue Kontoeinrichtung auslösen. Sensible persönliche Daten
> reichen wir ausschließlich über Ihren vorgesehenen sicheren Upload ein.

Steuerlich noch persönlich/steuerberatend zu bestätigen: tatsächliche
österreichische Umsatzsteuerregelung und deren Gültigkeitsbeginn, vorhandene
OSS-/sonstige Registrierung sowie zutreffende SaaS-Klassifikation. Der vorhandene
Monatsprodukt-Code txcd_10103001 wurde erneut aus Stripe gelesen:
Software as a service (SaaS) – business use. Stripe nennt diese Unterscheidung
zwischen geschäftlicher und privater Nutzung nur für US-Verkäufe relevant.
Dies ist eine Kandidatenbeschreibung, keine bestätigte Produkteinstufung.
