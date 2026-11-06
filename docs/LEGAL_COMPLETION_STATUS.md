# FanMind Legal Completion Status

Stand: 6. November 2026

Dieses Dokument trennt bestätigte öffentliche Fakten von Angaben, die noch durch Bernd, Steuerberatung oder Rechtsberatung verbindlich freigegeben werden müssen. Es ist keine Rechtsberatung und ersetzt keine unterzeichneten Vertragsunterlagen.

## Öffentlich bestätigt

- Marke/Produkt: FanMind
- Betreiberin und Vertragspartnerin: Brigitte Erika Guggenberger, Einzelunternehmen unter der Geschäftsbezeichnung FanMind
- Gewerbeinhaberin: Brigitte Erika Guggenberger; operativer Ansprechpartner: Bernd Guggenberger
- Gewerbestandort: Bahnstraße 11, Stiege 2, Tür 1, 2351 Wiener Neudorf, Österreich
- GISA-Zahl: 40314440 (amtlicher Auszug vom 02.11.2026; Original privat geprüft und mit SHA-256-Beleg im externen Register bestätigt)
- Gewerbebeginn: 29.10.2026
- Gewerbewortlaut: Dienstleistungen in der automatischen Datenverarbeitung und Informationstechnik
- Allgemeine Kontaktadresse: `fanmind@fanmind.ch`
- Website: `https://fanmind.ch`
- Produktgrenze: keine automatische Nachrichtenversendung; der Mensch prüft und sendet final selbst
- Integrationen werden nur als aktiv bezeichnet, wenn sie technisch und rechtlich freigegeben sind
- Checkout, Zahlungen und Rechnungen werden getrennt vom Kommunikationsworkflow über den ausgewiesenen Zahlungsanbieter abgewickelt

## Noch verbindlich zu entscheiden oder zu prüfen

- [ ] etwaiger künftiger Rechtsformzusatz nach einer bestätigten Firmenbucheintragung
- [ ] Zuordnung und Veröffentlichung der korrekten UID
- [ ] etwaige Firmenbuchnummer und Firmenbuchgericht
- [ ] finale AGB-Fassung für Pilot, Starter Flex und Starter 12 Monate
- [ ] finale Zahlungs-, Kündigungs- und Referral-Bedingungen
- [x] technische und fachliche AVV-Arbeitsfassung mit Rollen, Gegenstand,
      Dauer, Weisungen, Datenarten, Personengruppen, TOM, Löschung/Rückgabe
      und Unterstützungspflichten vorbereitet
- [ ] rechtsgeprüfte und unterzeichnungsfähige AVV aus der Arbeitsfassung
- [x] technische Anbieterliste mit Zweck, Aktivierungsstatus und offiziellen
      DPA-Prüfeinstiegen vorbereitet
- [x] maschinenlesbares externes Freigaberegister mit fail-closed
      Vollständigkeitsprüfung und privater Beweis-Hash-Regel vorbereitet
- [ ] kontobezogen bestätigte Unterauftragsverarbeiter,
      Verarbeitungsregionen und wirksam akzeptierte Anbieter-DPAs
- [ ] Drittland-/Transfergrundlagen, soweit relevant
- [ ] Meta-Kanalverarbeitung und Profiling/Kommunikationsanalyse: konkrete Rechtsgrundlage, transparente Betroffeneninformation, Widerspruch/Korrektur/Löschung, Meta-DPA/Transfers, Fristen und gegebenenfalls DSFA extern prüfen
- [x] im Code belegte Aufbewahrungs-, Ablauf- und Löschgrenzen in einem
      technischen Retention-Register zusammengeführt
- [ ] rechtlich und geschäftlich bestätigte Endfristen für CRM-, Support-,
      Vertrags-, Rechnungs-, Backup- und KI-Kostenereignisse
- [ ] steuerliche Freigabe der Rechnungs- und Umsatzsteuerlogik

## Intern vorbereiteter Abschlussstand

- `docs/legal/AVV_WORKING_DRAFT.md` enthält die überprüfbare fachliche
  Arbeitsfassung und grenzt sie ausdrücklich von einer unterschriebenen AVV ab.
- `docs/legal/RETENTION_REGISTER.md` trennt implementierte technische Grenzen
  von noch offenen rechtlichen Entscheidungen und externen
  Produktionsnachweisen.
- `docs/legal/EXTERNAL_APPROVAL_REGISTER.md` ordnet UID-/Registerwerte,
  Rechts-/Steuerfreigaben, Anbieter-DPAs, Regionen, Transfers, Fristen und den
  AVV-Unterschriftsweg einem konkreten Nachweis zu.
- `docs/legal/external-approval-evidence.json` speichert keine vertraulichen
  Vertragsunterlagen, sondern nur Status und später deren SHA-256-Beweis-Hash.
  `npm run legal:evidence:require-complete` bleibt bis zum realen externen
  Abschluss absichtlich rot.
- `npm run legal:evidence:hash` erzeugt aus einer privaten, nicht verlinkten
  Belegdatei ausschließlich die registrierbare SHA-256-Referenz. Der Befehl
  gibt weder Pfad noch Inhalt aus und verändert den Freigabestatus nicht.
- `npm run legal:evidence:handoff` erzeugt die verbleibende 26-von-27-Control-
  Aufgabenliste nach Zuständigkeit. Sie gibt keine Werte, Pfade,
  Kontokennungen, Beleginhalte oder vorhandenen Hashes aus und verändert das
  Register nicht.
- Die Datenschutzerklärung nennt das aktuell allein verdrahtete parameterlose
  Meta-Event `PageView` konsistent mit Code und Produktwahrheit.
- Die im Repository belegten Demo-, Consent-, Diagnose-, Log-, Mobile-,
  Account-Lösch- und Backup-Grenzen sind transparent zusammengeführt.

## Verbindliche Veröffentlichungsregel

Öffentliche Rechtsseiten dürfen keine internen Platzhalter, geratenen Rechtsformen, unbestätigten UID-/Registerangaben oder widersprüchlichen Vertretungsregeln enthalten. Noch nicht freigegebene Angaben werden als offener Abschlussstatus beschrieben und vor einer Vertragsunterzeichnung in den jeweils gültigen Unterlagen bereitgestellt.

## AVV-Status

`/avv` ist eine transparente Informations- und Anforderungsseite. Sie ist ausdrücklich keine unterschriebene AVV. Vor einem Pilot- oder Produktivbetrieb mit echten Drittpersonendaten muss die aktuelle Vertragsfassung angefordert, geprüft und von den beteiligten Parteien bestätigt werden.

## Definition of Done

- [x] Betreiber, Vertragspartner und Vertretungsregelung sind in der kanonischen Produktwahrheit festgelegt.
- [ ] Steuerberatung bestätigt UID-/Register-/Rechnungsangaben.
- [ ] Rechtsprüfung bestätigt Impressum, AGB, Zahlungsbedingungen, Referral-Bedingungen, Datenschutz und AVV.
- [x] Die bereits freigegebenen Betreiber-, Kontakt-, Preis-, Produkt- und
      technischen Retention-Werte sind zentral dokumentiert und öffentlich
      konsistent verwendet.
- [x] CI verhindert alte Kontaktadressen, veraltete Preise, widersprüchliche
      Meta-Events und öffentliche Platzhalter.
- [x] CI validiert das externe Rechts-/Steuer-/Anbieterregister und verhindert
      bestätigte Statuswerte ohne Beweis-Hash.
- [x] Production-Smoke-Test prüft `/impressum`, `/datenschutz`, `/avv`,
      `/agb` und `/zahlungsbedingungen`.
- [ ] Extern freigegebene UID-, Register-, Anbieter-, Transfer-, Steuer- und
      Rechtswerte werden nach Bestätigung zentral ergänzt.


## Kommerzieller Start – Prüfung vom 06.11.2026

Vorbereitung und konkrete Restarbeiten: `docs/legal/COMMERCIAL_LAUNCH_REVIEW_2026-11-06.md`. Das vorhandene Stripe-Konto ist technisch zahlungs- und auszahlungsfähig, aber auf Bernd statt auf die bestätigte Betreiberin registriert; alte Kontakt-/Adressdaten bleiben dort unverändert. Stripe Tax ist aktiv, jedoch ohne Steuerregistrierung. Es ist keine steuerliche Freigabe. Kein Merge, Deployment, Provider-/Kontoänderung oder echter Zahlungstest wurde damit autorisiert.
