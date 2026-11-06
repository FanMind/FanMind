# FanMind Register für externe Rechts-, Steuer- und Anbieterfreigaben

Stand: 6. November 2026

Dieses Register macht die externen Route-23-Abschlussnachweise prüfbar. Es
ersetzt weder eine Rechts- oder Steuerberatung noch die Vertragsannahme in
einem Anbieter-Konto. Der maschinenlesbare Status steht in
`external-approval-evidence.json`; öffentlich zugängliche Anbieterunterlagen
sind nur Prüfeinstiege.

## Status- und Beweisregel

- **pending**: Der konkrete FanMind-Nachweis fehlt.
- **confirmed**: Die Angabe ist durch einen kontobezogenen Beleg oder eine
  externe Freigabe bestätigt. Im JSON wird nur dessen SHA-256-Prüfsumme
  eingetragen.
- **not_applicable**: Eine externe Fachperson hat dokumentiert bestätigt, dass
  die Angabe nicht anwendbar ist; auch dafür wird ein Hash hinterlegt.
- Signierte Verträge, Kontoauszüge, UID-/Registerbescheide, Screenshots,
  Anbieter-IDs und personenbezogene Beratungsunterlagen werden **nicht** in
  GitHub gespeichert. `docs/legal/private-evidence/` ist vorsorglich von Git
  ausgeschlossen.
- Jeder abgeschlossene Control benötigt zusätzlich sein tatsächliches
  Bestätigungs-/Annahme-/Freigabedatum. Rechts-, Steuer-, AVV- und
  Transferprüfungen werden an eine nichtleere `reviewedVersion`, Anbieter-DPAs
  an eine nichtleere `documentVersion` gebunden. Datenstandorte und
  Registerwerte benötigen bei `confirmed` den konkret bestätigten Wert. So
  kann kein bloßer Hash ohne fachlich zuordenbare Fassung als Abschluss gelten.

Mit `npm run legal:evidence:check` wird die Struktur geprüft. Der strengere
Befehl `npm run legal:evidence:require-complete` bleibt so lange rot, bis jeder
erforderliche externe Nachweis bestätigt oder fachlich als nicht anwendbar
belegt ist. Das ist ein bewusstes Go-live-Gate.

`npm run legal:evidence:handoff` erzeugt aus demselben Register eine
reproduzierbare, nach Zuständigkeit gruppierte Aufgabenliste für Bernd,
Steuerberatung, Rechts-/Datenschutzberatung und die Anbieter-Konten. Sie zeigt
nur offene Control-IDs und die benötigte Belegart. Werte, Beweis-Hashes,
Dateipfade, Kontokennungen und bereits abgeschlossene Controls werden nicht
ausgegeben. Der Handoff verändert keinen Status und ersetzt keine Prüfung.

### Private Belege sicher hashen

Der lokale Hash-Befehl liest genau eine Datei aus dem von Git ausgeschlossenen
Verzeichnis `docs/legal/private-evidence/`. Er akzeptiert nur ein privates
Verzeichnis mit Modus `0700` sowie eine reguläre, nicht verlinkte Datei des
aktuellen Systembenutzers mit Modus `0600` und höchstens 25 MiB. Weder
Dateiname, Pfad noch Inhalt werden ausgegeben:

```bash
install -d -m 700 docs/legal/private-evidence
install -m 600 /sicherer/pfad/exoscale-dpa.pdf \
  docs/legal/private-evidence/exoscale-dpa.pdf
npm run legal:evidence:hash -- \
  --control provider.exoscale.dpa \
  --file exoscale-dpa.pdf
```

Die ausgegebene `LEGAL_EXTERNAL_EVIDENCE_REF=sha256:...` wird erst nach
inhaltlicher Prüfung zusammen mit Status, Fassung und Datum manuell in
`external-approval-evidence.json` übernommen. Der Befehl verändert das
Register nicht, akzeptiert keine erfundenen Control-IDs und nimmt keine
Vertragsannahme vor. Derselbe Beleg darf mehrere Controls nur dann stützen,
wenn die fachliche Prüfung tatsächlich alle betreffenden Aussagen abdeckt.

## 1. Betreiber-, UID- und Registerangaben

Gemäß GISA-Auszug vom 02.11.2026 und Owner-Bestätigung vom 06.11.2026:

- Brigitte Erika Guggenberger als Gewerbeinhaberin und rechtliche Betreiberin;
- Einzelunternehmen unter der Geschäftsbezeichnung FanMind;
- Bahnstraße 11, Stiege 2, Tür 1, 2351 Wiener Neudorf, Österreich;
- GISA-Zahl 40314440, Gewerbebeginn 29.10.2026;
- Bernd Guggenberger als operativer Ansprechpartner (keine hiermit nachgewiesene rechtsgeschäftliche Vollmacht);
- zuständige Gewerbebehörde: Bezirkshauptmannschaft Mödling.

Noch mit Steuerberatung beziehungsweise amtlichem Nachweis zu klären:

| Angabe | Aktueller Stand | Erforderlicher Beleg |
| --- | --- | --- |
| UID | nicht mitgeteilt | UID-Bescheid/FinanzOnline-Bestätigung oder fachliche Bestätigung „nicht vorhanden/nicht anwendbar“ |
| Firmenbuchnummer | nicht mitgeteilt | aktueller Firmenbuchauszug oder Bestätigung „nicht eingetragen“ |
| Firmenbuchgericht | nicht mitgeteilt | Firmenbuchauszug oder Bestätigung „nicht anwendbar“ |
| GISA-Zahl | 40314440 laut amtlichem Auszug vom 02.11.2026 | Original-PDF privat geprüft und gehasht; `operator.gisaNumber` am 06.11.2026 mit Wert und SHA-256-Beleg bestätigt |
| Stripe Tax / Nettopreise | technisch auf 20 % für steuerpflichtige Österreich-Umsätze entschieden; externe Prüfung offen | schriftliche Steuerfreigabe für Checkout, internationale Behandlung, Angebot, Rechnung und Rechnungshinweis |

Der Zusatz `e.U.` darf nur verwendet werden, wenn die Eintragung samt
Firmenbuchnummer und Firmenbuchgericht bestätigt ist. Eine Steuernummer gehört
nicht automatisch auf eine öffentliche Rechtsseite; ihre konkrete Verwendung
entscheidet die Steuerberatung.

## 2. Empfohlene externe Zuständigkeiten

### Steuerberatung

Die Steuerberatung soll schriftlich und versionsbezogen bestätigen:

1. UID-Status, Firmenbuch-/Registerstatus und gegebenenfalls GISA-Angabe;
2. Nettopreis-/Stripe-Tax-Regel, österreichische 20 %, internationale Umsatzsteuer beziehungsweise Reverse Charge und Rechnungspflichtangaben;
3. steuerliche Aufbewahrungsfrist und deren Fristbeginn;
4. Trennung zwischen aufzubewahrenden Rechnungsnachweisen und löschbaren
   CRM-, Support- oder KI-Nutzungsdaten.

Österreichs § 132 BAO nennt für Bücher, Aufzeichnungen und zugehörige Belege
grundsätzlich sieben Jahre ab dem dort geregelten Fristbeginn; anhängige
Verfahren können eine längere Aufbewahrung erfordern. Die Anwendung auf die
konkreten FanMind-Datensätze muss die Steuerberatung bestätigen.

### Rechts-/Datenschutzberatung

Eine Rechtsanwältin, ein Rechtsanwalt oder entsprechend qualifizierte
Datenschutzberatung soll die konkrete, versionierte Fassung von Impressum,
Datenschutz, AGB, Zahlungsbedingungen, Referral-Bedingungen und AVV prüfen.
Zur Prüfung gehören insbesondere Rollen, Unterauftragsverarbeiter,
Drittlandtransfers, Haftung, Audit, Sicherheitsvorfälle, Kündigungsfolgen und
Löschfristen.

### Wer die AVV unterschreibt

Die Steuerberatung prüft die steuerlichen Fristen und Stammdaten, ist aber
normalerweise nicht Vertragspartei der FanMind-Kunden-AVV. Empfohlen ist:

1. Rechts-/Datenschutzberatung macht aus
   `AVV_WORKING_DRAFT.md` eine freigegebene Vertragsfassung;
2. Steuerberatung bestätigt nur die steuer- und rechnungsbezogenen Teile;
3. Brigitte Erika Guggenberger oder eine nachweislich bevollmächtigte Person unterschreibt beziehungsweise akzeptiert für FanMind; Bernd ist operativer Ansprechpartner, ohne hiermit behauptete Vollmacht;
4. der jeweilige B2B-Kunde unterschreibt oder akzeptiert wirksam für seine
   Organisation;
5. Version, Datum und Beweis-Hash werden im externen Register dokumentiert.

## 3. Anbieter-DPAs, Regionen und Transfers

| Anbieter | Öffentlicher, aktuell geprüfter Stand | Für FanMind noch einzuholender Kontonachweis |
| --- | --- | --- |
| Exoscale / Akenes SA | [DPA](https://www.exoscale.com/dpa/) ist laut Anbieter ab der im Konto gespeicherten Annahme bindend; öffentliche [Zonen](https://www.exoscale.com/datacenters/) umfassen unter anderem `AT-VIE-1` und `AT-VIE-2` | Annahmedatum/Fassung aus dem Legal-Bereich, Zone von `fanmind-prod-01`, Zone und Anbieter des Offsite-Ziels |
| Supabase | Eine statische [DPA](https://supabase.com/legal/dpa) reicht laut Anbieter nicht; die bindende Fassung muss über den Legal-Documents-Bereich als PandaDoc angefordert und ausgefüllt werden. Die [Projektregion](https://supabase.com/docs/guides/platform/regions) ist separat zu belegen | unterschriebene PandaDoc-DPA, Produktionsprojektregion, aktuelle Unterauftragsliste |
| OpenAI | [DPA](https://openai.com/de-DE/policies/data-processing-addendum/) mit OpenAI Ireland Ltd. für EWR-Kunden ist seit 1. Januar 2026 wirksam; Annahme kann über Zustimmung, Bestellformular oder Nutzung erfolgen. [EU-Datenresidenz](https://openai.com/de-DE/index/introducing-data-residency-in-europe/) ist eine konkrete Projektoption, keine automatische Kontoeigenschaft | kontobezogener Vertrags-/DPA-Nachweis, Organisation/Projekt intern zugeordnet, Region des verwendeten API-Projekts, aktuelle [Unterauftragsliste](https://openai.com/policies/sub-processor-list/) und Transferprüfung |
| Stripe | [DPA](https://stripe.com/at/legal/dpa) ist Bestandteil des Stripe-Vertrags; außerhalb Amerikas ist grundsätzlich Stripe Payments Europe, Limited Vertragspartner. Stripe beschreibt zugleich globale Übermittlungen | österreichisches Konto und Vertragspartner, verwendete Produkte/Rollen, DPA-Fassung, aktuelle [Service-Provider-Liste](https://stripe.com/en-at/legal/service-providers) und Transferprüfung; keine erfundene einzelne Speicherregion |
| Meta | Das Pixel fällt unter die [Meta Business Tools Terms](https://www.facebook.com/legal/terms/businesstools); die Rollen hängen vom konkreten Datenfluss ab | Eigentümer von Business-Konto und Pixel, akzeptierte [Data Processing Terms](https://www.facebook.com/legal/terms/dataprocessing), Rollen-/Transferprüfung für die drei parameterlosen Events |
| Resend | [DPA](https://resend.com/legal/dpa) wird laut Anbieter mit Vertragsannahme oder Ausführung bindend. Eine [EU-Senderegion](https://resend.com/docs/dashboard/domains/regions) ändert nicht den US-Speicherort der Konto-, E-Mail-Metadaten, Logs und API-Daten | zunächst bestätigen, ob Produktion tatsächlich Resend statt SMTP nutzt; dann DPA-Beleg, Domain-Senderegion, US-Datenhaltung, [Unterauftragsliste](https://resend.com/legal/subprocessors) und Transferprüfung |

Die OpenAI-Projektoption `Europe` ist nur dann als FanMind-Region einzutragen,
wenn genau das produktiv verwendete Projekt so angelegt wurde. `store: false`
im Anwendungscode ist ein Datenminimierungsmerkmal, aber kein Beleg für die
Konto- oder Projektregion.

Bei Resend bedeutet `eu-west-1` nur Versand aus Irland. Nach aktueller
Anbieterdokumentation verbleiben Konto-, E-Mail-Metadaten, Logs und
API-Aufzeichnungen unabhängig von der Senderegion in den USA. Diese
Drittlandverarbeitung muss daher ausdrücklich bewertet werden.

## 4. Fristenvorschlag zur fachlichen Freigabe

Folgender Vorschlag dient als kurze Entscheidungsvorlage. Er wird erst nach
Bernds Entscheidung und externer Rechts-/Steuerbestätigung zur finalen
Produktwahrheit:

| Datenbereich | Vorschlag | Freigabe durch |
| --- | --- | --- |
| Kontakte, Nachrichten, Kontaktwissen, Follow-ups und gespeicherte KI-Ausgaben | Vertragsdauer; reguläre Löschung spätestens 30 Tage nach wirksamer Vertragsbeendigung oder früherer bestätigter Löschweisung, soweit keine Sperre/Pflicht entgegensteht | Bernd + Rechtsberatung |
| abgeschlossene Support- und Vertragsanfragen ohne Vertragsabschluss | 24 Monate nach Abschluss oder letzter relevanter Kommunikation | Bernd + Rechtsberatung |
| minimierte KI-Kostenereignisse | 12 Monate; danach löschen oder irreversibel aggregieren. Rechnungsrelevante Summen getrennt nach Steuerfrist | Bernd + Rechts-/Steuerberatung |
| Vertrags-, Rechnungs- und Steuerbelege | 7 Jahre nach dem fachlich bestätigten gesetzlichen Fristbeginn; länger nur bei konkreter Pflicht oder laufendem Verfahren | Steuerberatung |
| lokale und Offsite-Backups | harte Höchstfrist 90 Tage; Löschung über kontrollierte Generationen, mit dokumentiertem Restore-/Lösch-Nachweis | Bernd + Rechtsberatung + Technik |
| Account-Löschanfrage | operatives Bearbeitungsziel höchstens 30 Tage; rechtlich gesperrte Datensätze getrennt und zugriffsbeschränkt | bereits technisch umgesetzt; Rechtsprüfung offen |

Der 90-Tage-Vorschlag für Backups ist noch **nicht** umgesetzt: Die aktuelle
Policy ist zählerbasiert, und die Offsite-Ausführung bleibt read-only. Eine
öffentliche 90-Tage-Zusage darf erst nach technischer Umsetzung und
Restore-/Löschtest erfolgen.

## 5. Abschlussreihenfolge

1. Bernd bestätigt UID-/Registerstatus und die vorgeschlagenen Fristen.
2. Steuerberatung bestätigt Stammdaten, Steuermodus, Rechnungsangaben und
   steuerliche Frist.
3. Anbieter-Konten liefern DPA-/Regions-/Transferbelege; diese werden privat
   mit `npm run legal:evidence:hash` gehasht und nur die geprüften Hashes
   registriert.
4. Rechts-/Datenschutzberatung prüft die exakt versionierten öffentlichen
   Texte und macht die AVV unterschriftsfähig.
5. Brigitte Erika Guggenberger (oder eine nachweislich bevollmächtigte Person) und der jeweilige B2B-Kunde nehmen die finale AVV wirksam an.
6. `npm run legal:evidence:require-complete` muss grün sein, bevor echte
   Drittpersonendaten eines Pilotkunden verarbeitet werden.

