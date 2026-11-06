# Kommerzieller Online-Start – geprüfte Vorbereitung, 06.11.2026

Status: **VORBEREITET / KEINE KOMMERZIELLE FREIGABE**. Owner-Auftrag: bestehenden PR #1438 fertigstellen, bestehende Stripe-/Meta-Strukturen lesend prüfen; kein Merge, Deployment, Zahlungs-/Konto-/Secret-/Provider-Write. Rechtliche oder steuerliche Fachfreigabe wird nicht aus technischer CI abgeleitet.

## A. Technisch vorbereitet

- Main und zuletzt tatsächliches Staging: ac3229faa5290c3aa313e89a7e43d2e2bbd9d8c5. Production zuletzt a798d7938bb4e7e168f615f0c32d1a603dd47d4a; keine Veränderung in diesem Auftrag.
- ChatAdmin, Website-Chat, Support-Schema, Support-Transaktionen und Bereinigung haben ihre vorhandenen Nachweise; unveränderte Abläufe werden nicht neu getestet. Support: [42215921178](https://github.com/FanMind/FanMind/actions/runs/42215921178), [42216049407](https://github.com/FanMind/FanMind/actions/runs/42216049407).
- PR #1438 bleibt ausschließlich eine Betreiber-/Rechtstext- und Nachweiskorrektur. Keine Billing-, Steuer-, Auth-, RLS- oder Providerlogik wird geändert.
- Registrierung, Anmeldung, Workspace-Zuordnung, Checkout, Zahlungsstatus, Webhook-Verarbeitung, Rechnungszugriff und Kündigungsgrenzen besitzen bestehende Implementierungen und Regressionstests. Ein synthetischer lokaler Provider-Test ist nicht gleichbedeutend mit einem tatsächlichen Stripe-Testmodus-End-to-End-Lauf.
- Das externe Evidenzregister ist strukturell gültig, bleibt für einen kommerziellen Start jedoch gesperrt: ein GISA-Control bestätigt, 26 von 27 Controls offen. Keine erfundene UID oder Firmenbuchnummer.

## Bestätigte Unternehmensdaten und GISA-Abgleich

Rechtliche Betreiberin/Vertragspartnerin/Medieninhaberin: Brigitte Erika Guggenberger, Einzelunternehmen unter der unveränderten Geschäftsbezeichnung FanMind. Gewerbestandort: Bahnstraße 11, Stiege 2, Tür 1, 2351 Wiener Neudorf, Österreich. GISA 40314440, Entstehung 29.10.2026, Behörde Bezirkshauptmannschaft Mödling. Gewerbewortlaut: Dienstleistungen in der automatischen Datenverarbeitung und Informationstechnik.

Der private amtliche Originalauszug vom 02.11.2026 wurde inhaltlich gegen die Owner-Angaben und das Begleitschreiben geprüft. Der vorhandene sichere Hash-Befehl hat den Original-PDF-Hash für operator.gisaNumber erzeugt; nur dieser Hash samt tatsächlichem Prüfdatum und Wert wird registriert. Keine Ausweisdaten, Geburtsdaten, Behördenakten oder PDFs in Git. Eine gesonderte kryptographische Amtssignaturvalidierung wird nicht behauptet.

Bernd Guggenberger übernimmt operative Leitung und technischen Kontakt. Der zuvor widersprüchliche AVV-Unterschriftsweg im externen Register ist korrigiert: Brigitte oder eine tatsächlich bevollmächtigte Person akzeptiert Verträge. Keine Vollmacht für Bernd wird unterstellt.

## Stripe – tatsächlicher lesender Kontobefund

Das vorhandene FanMind-Livekonto wird beibehalten. Technisch charges_enabled=true, payouts_enabled=true; keine currently_due, past_due oder pending_verification. business_type=individual, verifizierte Individual-Identität weiterhin Bernd Guggenberger. Supportanschrift weiterhin Turnerstrasse 18/1, 2345 Brunn am Gebirge; Support-E-Mail weiterhin kontakt@fanmind.ch. Diese Abweichungen wurden nicht verändert. Die Identität weicht von der bestätigten Betreiberin ab und ist ein Startblocker.

Aktiver Produktkatalog: drei monatliche Euro-Tarife 99/199/312 EUR netto und vier einmalige Datenpakete 14,99/37,49/74,99/149 EUR netto; jeweils exclusive. Legacy-Produkte sind archiviert, teilweise bleiben deren Price-Objekte aktiv. Das ist kein Beweis, dass diese Preise durch den serverseitigen Checkout auswählbar sind; bestehende Preis-Allowlist muss vor Start mit dem Runtime-Readinessbeleg übereinstimmen. Interner täglicher Testtarif separat, nicht als öffentliches Angebot.

Subscription-Inventur aller Zustände: genau eine stornierte Subscription, keine aktive. Keine bestehenden Abonnements oder Zahlungen verändert. Keine Kundeninhalte im Bericht.
Customer-Portal-Konfigurationen: keine. Ein Portal-Kündigungsweg ist damit nicht bewiesen; vorhandener eigener Kündigungs-/Supportweg muss gegen die Vertragsfristen abgenommen werden.
Produktive Webhook-URL https://fanmind.ch/api/stripe/webhook ist enabled, Version 2026-06-24.dahlia. Lifecycle-, Zahlungs-, Rechnungs-, Refund- und Dispute-Events sind konfiguriert. customer.tax_id.created und customer.tax_id.deleted fehlen gegenüber der bestehenden Checklist; customer.tax_id.updated ist vorhanden. Die Prüfung der übrigen aktuell vorgeschriebenen Risikoevents und ihrer tatsächlichen Handler bleibt vor Billing-Freigabe nötig. Keine Endpointänderung in diesem Auftrag.
Rechnungsstandard: default_account_tax_ids leer; korrekte Aussteller-UID bzw. bestätigte Nichtanwendbarkeit nicht belegt.

**Steuerbefund:** Tax Settings status=active, default tax_behavior=exclusive, Head-Office-Land AT. Die Liste aller Tax Registrations ist leer. Aktive Settings sind keine steuerliche Registrierung und kein Beleg für Umsatzsteuererhebung. Es wurde keine Registrierung angelegt und kein Live-Steuerberechnungs- oder Rechnungsvorschau-POST ausgelöst.

### Vorbereiteter Stripe-Klärungsprozess

Laut Stripe ist vor einem Wechsel zu einer anderen rechtlichen Einheit Stripe Support einzubeziehen: [Entity transfer](https://support.stripe.com/questions/transfer-a-stripe-account-to-a-different-entity-due-to-a-business-sale-or-acquisition?locale=en-GB). Ein Wechsel des Dashboard-Owners allein ersetzt die Identität des Vertragspartners nicht. FanMind beantragt keine erfundene Veräußerung; Stripe soll klären, ob die bisherige Erfassung berichtigt oder ein von Stripe geführter Entity-Transfer benötigt wird und ob das vorhandene österreichische Konto erhalten werden kann.

Vorbereitete Anfrage, **nicht gesendet**:
> FanMind soll durch Brigitte Erika Guggenberger als österreichisches Einzelunternehmen betrieben werden. Das vorhandene Konto ist derzeit auf Bernd Guggenberger als Individual registriert. Marke, Website und Konto sollen möglichst erhalten bleiben. Bitte klären Sie den zulässigen Korrektur-/Entity-Transfer-Prozess, benötigte Nachweise und Auswirkungen auf Rechnungen, Steuerdaten, bestehende Objekte und Auszahlungen. Die derzeit berechtigte Person und die neue rechtliche Betreiberin können die erforderliche Bestätigung über Ihren sicheren Prozess erbringen. Keine Änderung oder neues Konto ohne Ihre konkrete Verfahrensbestätigung.

Bereitzuhalten: amtlicher GISA-Auszug, Nachweis der Betreiberin/Adresse, bestätigter Steuer-/UID-Status, gegebenenfalls von Stripe verlangter Identitäts-/Vertretungsnachweis. Identitätsdaten ausschließlich im sicheren Stripe-Upload, keine Ausweiskopie per E-Mail oder Git. Auszahlungskonto nicht in diesem Auftrag lesen/ändern; erforderliche Namens-/Inhaberkonsistenz separat mit Stripe klären. Kein zweites Konto anlegen, solange Stripe keine Notwendigkeit bestätigt.

## Meta, Facebook, Instagram

Der verfügbare Zugang zur Meta Business Suite zeigt eine Anmeldeseite; kein authentifizierter Portfolio-Zugang nachgewiesen. Daher Portfolio, Seiten-/Instagram-Business-Bindung, Unternehmens-/Domainverifizierung, App Review und Administratoren **NICHT VERIFIZIERT**, nicht als fehlend oder erledigt markiert. Keine neuen Konten, Rollen oder Ads angelegt.

Bestehende Repository-Integration und Consent-PageView-Pixel sind Implementierungshinweise, kein Nachweis eines verifizierten Meta-Portfolios oder produktiv freigegebener Kanäle. Die bestehenden Workspace-/Channel- und Providergrenzen aus docs/integrations/META_CONTENT_INTELLIGENCE.md bleiben bestehen. Weiterer lesender Kontocheck braucht authentifizierten Zugang zum richtigen bestehenden Portfolio.

Prüfvorlage: Portfolio/Seite/IG-Business/App-IDs privat zuordnen; rechtlichen Namen und Adresse mit GISA abgleichen; Domain fanmind.ch und vorhandenen Verifizierungsmethodenstatus prüfen; Rollen/2FA/App-Review/erforderliche Scopes lesen; Datenschutz-/Datenlösch-URL, Providerverträge, Consent und Kanalgrenzen prüfen. Keine Domain-DNS-, Administrator-, App-, Review-Einreichungs- oder Integrationänderung ausführen.

## B. Rechtlich/steuerlich noch offen

- Qualifizierte Endprüfung von Impressum/Offenlegung, B2B-AGB, Zahlungs-/Kündigungsbedingungen, Referral, Datenschutz und unterschriftsfähiger AVV. Es liegt keine Fachfreigabe vor.
- Unternehmerstatus der Kunden, Vertragsannahme/Version, wirksame elektronische Bestätigung, Kündigungsfristen und 12-Monatsbindung praktisch und rechtlich abgleichen.
- UID-/Steuerregistrierung bzw. begründete Nichtanwendbarkeit; Umsatzsteuerpflicht oder Kleinunternehmerregelung; etwaige Option, EU-B2B/Reverse Charge und Ausland getrennt durch Steuerberatung klären. Nicht eigenmächtig 20 Prozent oder Steuerfreiheit aus Gewerbeschein/Stripe ableiten.
- Rechnungsaussteller muss Betreiberin und bestätigter Anschrift entsprechen; UID/Steuerhinweis, laufende Nummer, Leistungsbeschreibung/-zeitraum, Empfänger, Steuerbasis/-betrag und gegebenenfalls Reverse-Charge-Hinweis fachlich prüfen.
- Kontobezogene Anbieter-DPA-Annahmen, Verarbeitungsregionen, Unterauftragsverarbeiter und Drittlandgrundlagen einschließlich OpenAI/Supabase/Exoscale/Stripe/Meta/bedingtem E-Mail-Anbieter dokumentieren.
- Aufbewahrungs-/Löschentscheidungen, Backup-Grenzen und reale Anbieter-/Lösch-/Alarmnachweise bleiben separate Nachweise; ein grüner Support-Rollbacktest ersetzt keine gesamte Datenschutzfreigabe.

Offizielle Prüfeinstiege: [WKO Impressum](https://www.wko.at/internetrecht/website-impressum-nicht-im-firmenbuch), [WKO ECG](https://www.wko.at/internetrecht/informationspflichten-nach-dem-e-commerce-gesetz--dem-unte), [USP Rechnung](https://www.usp.gv.at/themen/steuern-finanzen/umsatzsteuer-ueberblick/rechnung.html), [USP Kleinunternehmen](https://www.usp.gv.at/themen/steuern-finanzen/umsatzsteuer-ueberblick/weitere-informationen-zur-umsatzsteuer/weitere-steuertatbestaende-und-befreiungen/kleinunternehmen.html). Diese Quellen sind Orientierung für die dokumentierten offenen Fachfragen, keine individuelle Steuerentscheidung.

## C. Freigabepflichtige Restarbeiten

1. Owner-Abnahme des endgültigen PR-Commits nach grüner CI; Merge und Production-Deployment ausdrücklich separat, hier nicht ausgeführt.
2. Stripe Support-Prozess durch berechtigte Person klären; erst danach genaue Owner-Freigabe für Identität/Kontodaten/gegebenenfalls Steuerkonfiguration. Keine pauschale Änderungsfreigabe unterstellen.
3. Authentifizierter lesender Meta-Portfoliozugang für Bestandsprüfung; Änderungen/Scopes/Verifizierungseinreichung/Admins bleiben separat.
4. Bestehende Stripe-Testumgebung zugänglich machen: Die aktuelle Session bietet ausschließlich Livekontext. Kein Umbenennen von livemode und kein Live-Zahlungsersatz. Reale Testmodus-Kette mit synthetischem Kunden, Checkout, signierten Webhooks, exakter Workspace-Bindung, Aktivierung, Rechnung, Kündigung, Fehler und Refund vor kommerzieller Aktivierung vollständig nachweisen.
5. Offene 26 externe Controls mit tatsächlich passenden privaten Belegen, Versionen, Datum und Hash schließen. Erst dann gezielte kommerzielle Live-Schaltung zur gesonderten Freigabe vorlegen.

