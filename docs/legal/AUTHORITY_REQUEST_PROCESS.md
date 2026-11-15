# Behördenanfragen: Verfahren und Einführungsnachweis

Version: 1.0 · vorbereitet am 14.11.2026 · Bezug: #1480 / #1464

**ZUR FREIGABE VORBEREITET.** Der Owner hat die Einführung der erforderlichen
Verfahren beauftragt. Das ist keine dokumentierte Rechtsprüfung dieser Fassung,
keine Vertretungsvollmacht und kein Nachweis bereits betriebener Fallbearbeitung.
Bis zur rechtlichen Einzelfallprüfung und zuständigen menschlichen Freigabe
werden keine angeforderten personenbezogenen Daten herausgegeben.

## 1. Zweck, Geltung und bestehende Governance

Dieses einheitliche Verfahren deckt Rechtmäßigkeitsprüfung, Zurückweisung oder
Anfechtung, Datenminimierung sowie vertrauliche Dokumentation behördlicher
Anfragen ab. Es gilt für alle Beschäftigten und Beauftragten sowie FanMind-eigene
und im Kundenauftrag verarbeitete Daten, einschließlich Meta-Plattformdaten,
Metadaten, Nachrichten, Kommentare, Kontodaten und Sicherungsbestände.
Erhaltungsanordnungen, freiwillige Auskunftsersuchen, verbindliche Anordnungen,
Notfallersuchen und behauptete Geheimhaltungspflichten werden getrennt bewertet.
Eine Erhaltungspflicht ist keine Herausgabefreigabe.

Bestehende Quellen bleiben maßgeblich:

- [AVV-Arbeitsfassung](AVV_WORKING_DRAFT.md): Verantwortlicher/Auftragsverarbeiter,
  Weisungen, TOM und Unterstützung. Keine nachträgliche Behauptung einer signierten AVV.
- [Externes Freigaberegister](EXTERNAL_APPROVAL_REGISTER.md) und
  `external-approval-evidence.json`: einzige Freigabestruktur für Rechtsprüfung,
  Aufbewahrungsentscheidung, Kunden-AVV und Anbieterbelege. Keine neuen Controls,
  keine Änderungen von `pending` zu `confirmed` ohne echten Beleg.
- [Retention-Register](RETENTION_REGISTER.md): technische Ist-Grenzen;
  [Datenschutz-Anfragen](../operations/SUPPORT_PRIVACY_PROCESS.md): bestehender
  Eingang und Weiterleitung. Deren vorhandene Funktionen werden nicht verändert.
- [Sicherheitsgrenzen](../SECURITY_RLS_SECRETS_CHECK.md): bestehende
  Workspace-Autorisierung, RLS und Geheimnisschutz bleiben erhalten.

Das nachfolgende vertrauliche Fallregister ist ein Nachweisanhang dieser
Governance, kein zweites Freigabesystem, keine Datenbank und kein neuer Dienst.
Ein Repository-Ordner ist noch kein gemeinsam betriebener sicherer Fallraum.

## 2. Verantwortung und Vertretung

Die rechtliche Betreiberin laut kanonischem Betreiberregister trägt die
Verfahrensverantwortung und gibt jede Herausgabe frei. Der dort benannte
operative Ansprechpartner nimmt an, koordiniert, überwacht Fristen und führt
den Nachweis. Diese Aufgabe verleiht keine rechtsgeschäftliche Vollmacht.

Eine qualifizierte menschliche Rechtsprüfung bewertet jede Anfrage vor einer
inhaltlichen Antwort, Herausgabe, Zurückweisung mit rechtlichen Folgen oder
Anfechtung. Fachliche Bewertung und Freigabe werden mit Datum und genauer
Fassung vertraulich dokumentiert. Technik führt nur den freigegebenen Umfang aus.
Eine Person darf nicht allein Eingang, Rechtsprüfung und Herausgabe freigeben.

Eine Vertretung wird von der Betreiberin namentlich, schriftlich, befristet und
mit Umfang bestimmt; Zugang wird einzeln erteilt und widerrufen. Eine solche
Bevollmächtigung ist aktuell nicht nachgewiesen. Ohne erreichbare berechtigte
Vertretung bleibt die Herausgabe gesperrt; Fristen sofort an Betreiberin und
Rechtsberatung eskalieren, erforderlichenfalls Fristverlängerung beantragen.
Zeitdruck, Urlaub oder eine behauptete Notlage ersetzen keine Freigabe.

## 3. Eingang und sichere Erfassung

1. Bestehenden veröffentlichten Datenschutz-/Unternehmenskontakt verwenden.
   Auch postalische, telefonische oder fehlgeleitete Anfragen intern sicher
   dorthin eskalieren. Kein neuer öffentlicher Upload und keine neue Mailadresse.
2. Original in den freigegebenen vertraulichen Fallraum übernehmen; zufällige,
   nicht sprechende Fallkennung vergeben. Eingangszeit, Frist und Zeitzone,
   Kanal, Bearbeitung, Anfrageart und Prüfstatus erfassen. Keine CRM-Inhalte
   zur bloßen Eingangsdokumentation kopieren. Verdächtige Anhänge isoliert prüfen.
3. Keine Geheimnisse, Ausweiskopien, Nutzerdaten, Aktenzeichen oder Trace-IDs in
   GitHub, öffentliche Tickets, allgemeine Logs oder KI-Eingaben übertragen.
   Antragsteller erhalten nicht automatisch Zugriff auf den Fallraum.
4. Zulässige Eingangsbestätigung enthält weder Datenbestand noch Kontobestätigung
   und keine Zusage der Herausgabe. Sie wird bei möglicher Geheimhaltung oder
   sonstiger rechtlicher Wirkung vor Versand menschlich geprüft.
5. Operativer Ansprechpartner prüft Fristen unmittelbar nach Eingang und danach
   arbeitstäglich für offene Fälle. Kritische Fristen sofort eskalieren.
   Ein tatsächlich betreuter Eingang mit Vertretung muss vor Einführung belegt sein.

## 4. Rechtmäßigkeit, Identität und Zuständigkeit

Die Rechtsprüfung erhält das unveränderte Original und einen minimierten
Sachverhalt. Sie dokumentiert für jede Frage Ergebnis, Begründung, offene
Punkte und zugrunde gelegte Rechtsfassung:

- Echtheit der Behörde und Befugnis der anfragenden Person unabhängig über
  amtlich ermittelten Kontakt verifizieren; keine Telefonnummer oder Links aus
  einer ungeprüften Anfrage als alleinigen Nachweis verwenden.
- Zuständige Behörde, örtliche/sachliche Zuständigkeit, Adressat, Verfahren,
  genaue Rechtsgrundlage, verpflichtende Wirkung, Form, Frist und Rechtsbehelf prüfen.
- Verantwortlichen-/Auftragsverarbeiterrolle des betroffenen Datenbestands
  feststellen. Kundenweisung und erforderliche Information des Kunden prüfen;
  ein behauptetes Verbot muss rechtlich überprüft, begrenzt und nachkontrolliert werden.
- Datenarten, Personen-/Konto-/Workspace-Bindung, Zeitraum, Zweck, Erforderlichkeit
  und Verhältnismäßigkeit bestimmen. Eine unbestimmte Anfrage rechtfertigt
  weder Suche über alle Kunden noch vorsorgliche Vollsicherung.
- Rechtsgrundlage der Verarbeitung, besondere Kategorien, Vertraulichkeit,
  Informationsrechte und etwaige Übermittlungsregeln getrennt beurteilen.
- Bei Drittstaatenbehörden Anerkennung/Vollstreckbarkeit sowie Rechtsgrundlage
  und Kapitel-V-Übermittlungsgrundlage gesondert prüfen. Eine ausländische
  Anordnung ist nicht automatisch eine ausreichende Grundlage; Art.48 DSGVO
  ist selbst keine Übermittlungsgrundlage. Rechtshilfewege durch Rechtsberatung klären.

Ergebnis: **ungeklärt**, **Nachforderung**, **zurückzuweisen/anzufechten**,
**Erhaltung gesondert zulässig** oder **eng begrenzte Herausgabe rechtlich zulässig**.
Ungeklärt bedeutet keine Freigabe. Die technische Existenz von Daten oder
eine gültige Providerberechtigung beweist keine rechtliche Herausgabepflicht.

## 5. Zurückweisung, Einschränkung und Anfechtung

Folgende Befunde führen zur Sperre und menschlichen Entscheidung: nicht
verifizierbare Identität, fehlende Zuständigkeit/Rechtsgrundlage oder Form,
unzureichende Bindung an Daten/Zeitraum, überschießender Umfang, unzulässiger
Zweck, unaufgelöster Normenkonflikt, fehlende Transfergrundlage, ungeprüfte
Geheimhaltung oder Anforderung von Zugangsdaten statt zulässiger Einzeldaten.

Rechtsberatung empfiehlt schriftlich Nachforderung, Umfangsreduktion,
begründete Zurückweisung oder geeigneten Rechtsbehelf und prüft Frist,
aufschiebende Wirkung und zuständigen Rechtsweg. Betreiberin entscheidet und
beauftragt Vertretung. Keine automatische gerichtliche Eingabe und kein
standardisiertes pauschales Verweigern wirksamer Pflichten. Nur die tatsächlich
angefochtene/gesperrte Teilmenge wird so behandelt; unstrittige Teile benötigen
weiterhin eigene dokumentierte Freigabe.

## 6. Datenminimierung und kontrollierte Ausführung

Vor einem Zugriff erstellt Technik einen noch inhaltsfreien Umfangsplan:
Workspace/Konto-Bindung, Datenquellen, Felder, Zeitraum, Ausschlüsse,
Erwartungsmenge, autorisiertes Werkzeug und Empfänger. Betreiberin und
Rechtsprüfung bestätigen genau diese Version. Änderungen erfordern neue Freigabe.

- Vorhandene zulässige Werkzeuge und serverseitige Autorisierung verwenden.
  Kein neuer globaler Export, keine RLS-Abschaltung, keine Umgehung durch
  Service-Role im Browser und kein unfreigegebenes SQL/Restore.
- Nur erforderliche Datensätze und Felder erheben; andere Workspaces,
  unbeteiligte Personen, interne Notizen und Geheimnisse ausschließen.
  Tokens, Passwörter oder App-Secrets werden nicht als Antwort bereitgestellt.
- Minimierte Arbeitskopie im vertraulichen Fallraum; Originale und Schwärzungen
  nachvollziehbar halten, keine Inhalte in technischen Logs. Ein Manifest
  dokumentiert Kategorie, Zeitraum, Anzahl und Integrität, nicht unnötig Rohinhalte.
- Zweite menschliche Prüfung von Identität, Umfang, Schwärzungen, Manifest und
  endgültigem Empfänger; danach dokumentierte finale Betreiberfreigabe.
- Nur freigegebener verschlüsselter Transfer mit unabhängig verifiziertem
  Empfänger, begrenztem Zugriff und Ablauf; Schlüssel getrennt übermitteln.
  Ein normaler E-Mail-Anhang oder öffentlicher Link ist kein belegter sicherer Kanal.
- Versandzeit, freigegebene Version/Hash und Empfangsnachweis dokumentieren;
  temporäre Kopien und Links nach bestätigtem Zweckende kontrolliert entfernen.

Ohne nachgewiesenen geeigneten Transferkanal wird kein Export versandt.

## 7. Vertrauliches Nachweisregister

Vorlagen: [Fallregister](templates/AUTHORITY_REQUEST_REGISTER_TEMPLATE.md).
Keine echten Fälle im Repository. Das Register enthält je Fall Eingang/Frist,
verantwortliche Rollen, verifizierte Behörde und Anfrageart, Rechtsprüfung,
Umfangsentscheidungen, Nachforderungen/Rechtsmittel, Benachrichtigungsentscheidung,
Freigaben mit Version/Datum, tatsächlich übermittelte Kategorien/Menge,
Empfangsnachweis, Aufbewahrungsgrund/-termin und Abschluss/Löschung.
Originale liegen zugriffsbeschränkt daneben; Indexeinträge referenzieren sie.
Änderungen sind versioniert nachvollziehbar, nicht still überschrieben.

Zugriff: Betreiberin, schriftlich autorisierte Fallbearbeitung und erforderliche
Rechtsberatung nach Need-to-know. Technik erhält nur fallbezogenen Umfang.
Keine pauschale Freigabe an Plattform-Admins, Support oder externe Creator.
MFA, Einzelkonten, Entzug, sichere Sicherung, Zugriffsprüfung und Wiederherstellung
sind am ausgewählten bestehenden Ablageort praktisch nachzuweisen.
Dateimodi allein beweisen diese organisatorischen Eigenschaften nicht.

Der vorhandene ignorierte Bereich `docs/legal/private-evidence/` kann im
autorisierten Arbeitsumfeld Belege aufnehmen (Verzeichnis0700/Datei0600,
keine Symlinks, nicht im Git). Er ist dadurch noch kein dauerhaft freigegebener
Mehrpersonen-Fallraum. Nur geprüfte Freigabe-Hashes gehören in das bestehende
externe Register: Rechtsprüfung unter `approvals.legalReview`, Fristen unter
`approvals.retentionDecision`. Umfang der jeweiligen Sammelfreigabe explizit angeben.

## 8. Aufbewahrung, Erhaltung und Löschung

Für jeden realen Fall legt die Rechtsprüfung eine begründete Frist und einen
Überprüfungstermin fest; Betreiberin bestätigt sie. Vorher keine pauschale
Siebenjahresfrist, keine unbegrenzte Sammlung und keine neue öffentliche Zusage.
Es gilt das bestehende Retention-Register; dessen offene Rechtsentscheidungen
werden nicht durch dieses Dokument ersetzt.

**Freigabevorschlag, noch nicht aktiv:** Überprüfung spätestens alle90Tage;
Arbeits-/Transferkopien spätestens30Tage nach rechtskräftigem/fachlich
bestätigtem Abschluss löschen, soweit kein konkreter dokumentierter Grund
entgegensteht; minimierten Entscheidungsnachweis nach24Monaten erneut bewerten
und ohne fortbestehenden Zweck löschen. Fristbeginn und Abweichung sind
einzelfallbezogen festzulegen. Diese Vorschläge sind weder implementierte Timer
noch eine rechtlich bestätigte allgemeine Frist.

Erhaltungsanordnungen nur nach Rechtsprüfung auf bestimmte Daten, Grundlage,
Dauer und Wiedervorlage begrenzen. Löschsperre, laufender Rechtsbehelf und
Backup-Generationen getrennt behandeln. Nach Wegfall der Sperre Löschung erneut
freigeben und nachweisen; Wiederherstellung darf gesperrte/löschfällige Daten
nicht unbemerkt reaktivieren. Keine bestehenden Kundendaten oder Backups im
Rahmen dieser Vorbereitung löschen oder länger speichern.

## 9. Fehler, unzulässige Zugriffe und Sicherheitsvorfälle

Verdächtige Anfrage isolieren, Herausgabe stoppen, Zugriffe/Links im zulässigen
Umfang sperren und sofort Betreiberin einschalten. Bei Fehlversand sichere
Rückruf-/Löschbitte und Empfängerklärung durch den zuständigen Menschen;
Beweise minimiert erhalten, kein stilles Löschen des Fehlers. Rechtsberatung
bewertet Umfang, Risiko, gesetzliche Benachrichtigung und Abhilfe.

Als Auftragsverarbeiter betroffenen Verantwortlichen ohne unangemessene
Verzögerung informieren. Für FanMind als Verantwortlichen Meldepflicht nach
Art.33 DSGVO prüfen: unverzüglich, möglichst binnen72Stunden ab Bekanntwerden,
außer voraussichtlich kein Risiko; bei hohem Risiko zusätzlich Betroffene nach
Art.34 informieren, soweit anwendbar. Fristbeginn, Risikobeurteilung, Entscheidung
und spätere Ergänzungen dokumentieren. Keine automatische externe Meldung.
Bestehende Sicherheits- und Datenschutzwege nutzen; Support nicht umbauen.

## 10. Einführungs- und Freigabeprotokoll

| Gegenstand | Stand am14.11.2026 | Zum nächsten Status erforderlicher Nachweis |
| --- | --- | --- |
| Owner-Auftrag zur Einführung | VERBINDLICH FREIGEGEBEN als Einführungsentscheidung | Keine Gleichsetzung mit fertig betriebenem Verfahren |
| Diese Fassung1.0 samt Vorlagen | ZUR FREIGABE VORBEREITET | Versionsbezogene Rechtsprüfung und Freigabe der Betreiberin |
| Operative Rolle / Vertretung | Rolle aus bestehender Governance; konkrete Vertretung offen | Schriftliche Übernahme, Vollmachtsumfang/Vertretung, Fristenbetreuung |
| Vertraulicher Fallraum / Register / Transfer | ENTWURF bzw. Vorlage | Bestehenden geeigneten Ort bestimmen; ACL/MFA/Entzug/Transfer/Recovery testen |
| Vier Meta-Prozessbehauptungen | Noch nicht als tatsächlich eingeführt belegbar | Freigegebene Fassung, echte Zuständigkeit, Einweisung und dokumentierte Übung |
| Produktseitige Zugriffsschranken | Im bestehenden Code belegt; kein neuer Live-Test | Für konkreten Ausführungsweg gesonderte Umgebungs-/Berechtigungsprüfung |

Vor Betriebsfreigabe gemeinsam durchspielen: gefälschte Behörde;
unbestimmte Vollauskunft; Drittstaatenorder ohne geklärten Transfer; enge
zulässige Anfrage mit getrennten Freigaben; Eilfall ohne Vertretung;
Anforderung eines Tokens; abgelaufene Löschsperre; Fehlversand.
Verwenden ausschließlich synthetische Inhalte ohne Provideraufruf. Pro Fall
Erwartung, tatsächliche Entscheidung, Bearbeiterrollen, Abweichung und Korrektur
vertraulich protokollieren. Eine entworfene Übung ist noch kein bestandenes Training.

Erst danach darf ein Verantwortlicher `TATSÄCHLICH IMPLEMENTIERT UND GEPRÜFT`
für die jeweils belegte Maßnahme bestätigen. Keine Meta-Checkbox vorweg aktivieren.

## 11. Historische Meta-Erklärung

Ein heute leer angelegtes Register beweist keine frühere Nichtweitergabe.
Für die Frage nach nationalen Sicherheitsanfragen muss der Verantwortliche den
konkreten rollierenden Zwölfmonatszeitraum prüfen; am14.11.2026 ist der
Prüfzeitraum14.11.2025–14.11.2026. Unternehmensbeginn und neue Verfahren verkürzen
nicht stillschweigend Metas abgefragten Zeitraum. Strafrechtliche Durchsuchungs-
oder Gerichtsanordnungen nach Metas Frageabgrenzung nicht automatisch mitzählen.
Ohne vollständig geeigneten Nachweis und verantwortliche Tatsachenbestätigung
bleibt die Antwort **UNBEKANNT**, nicht `No` und nicht `0`.

Für den ausdrücklich bestätigten Zeitraum14.11.2025–einschließlich14.11.2026
liegt jetzt die [Owner-Tatsachenbestätigung vom14.11.2026](META_NATIONAL_SECURITY_ATTESTATION_20261114.md)
vor: keine national-security-bedingte Meta-Datenweitergabe. Diese begrenzte
historische Antwort istNo; die Einführung dieses Verfahrens bleibt davon getrennt.

## Quellen und rechtliche Prüfung

- EDPB, [Leitlinien02/2024 Art.48 DSGVO, endgültige Fassung2.1](https://www.edpb.europa.eu/system/files/documents/2025-06/edpb_guidelines_202402_article48_v2_en.pdf), insbesondere Rn.4–5,16ff.,33ff.: Drittstaatenanfragen und getrennte Rechts-/Transferprüfung.
- Österreichische DSB, [Data-Breach-Verfahren](https://dsb.gv.at/ueber-die-datenschutzbehoerde/data-breach-verfahren): Melde-/Benachrichtigungspflichten.

Die übrigen operativen Schritte sind ein FanMind-Verfahrensvorschlag zur
versionsbezogenen Rechtsprüfung, keine Behauptung eines bestimmten gesetzlichen
Rechtsbehelfs, einer gesetzlichen Standardfrist oder bereits gelebter Praxis.

## 12. Konkrete Einführungsvorlage zur Schlussprüfung

Status: ZUR FREIGABE VORBEREITET; keine rechtsverbindliche Annahme oder
Betriebsfreigabe durch das Erstellen dieser Vorlage. Sie konkretisiert die
bestehenden Abschnitte2,7,8 und10, ohne eine neue Zuständigkeit zu erfinden.

| Maßnahme | Konkret vorbereiteter Ablauf | Vor tatsächlicher Betriebsfreigabe zu belegen |
| --- | --- | --- |
| Fallraum | Bestehenden FanMind-Unternehmensablageort nutzen. Original, minimiertes Fallblatt und Änderungshistorie je zufälliger Fallkennung getrennt führen. | Betreiberin benennt den Ort und Berechtigte; Identität des Ablage-Owners, Einzelkonten/MFA, Entzug und Sicherung/Recovery prüfen. Kein neues Konto oder öffentlicher Link. |
| Übermittlung | Vorhandenen verwalteten Dateiaustausch nur mit benanntem, unabhängig verifiziertem Empfänger, Zugriffsbefristung und separat übermitteltem Schlüssel verwenden. Test ausschließlich mit neutralem synthetischem Inhalt. | Konkreter Kanal/Vertrag, Empfänger-Authentisierung, Ablauf und Sperr-/Entzugstest fehlen. Normale E-Mail/Drive-Link allein ist keine geprüfte Zustelllösung. |
| Vertretung | Schriftliche Übernahme der operativen Rolle und benannte, befristet bevollmächtigte Vertretung; Fristennachverfolgung im bestehenden Fallregister. | Betreiberin bestätigt Personen, Umfang und Erreichbarkeit. Keine automatische Übertragung von Herausgabe- oder Unterschriftsrechten an den operativen Kontakt. |
| Einweisung | Verfahrensfassung lesen; Eingang/Frist, Identitätsprüfung, Rechtsprüfung, Freigabe, Umfang und Incidentweg gemeinsam anhand der acht Szenarien aus Abschnitt10 durchgehen. | Teilnahme, tatsächliche Entscheidungen, Abweichungen und Korrekturen mit Datum privat dokumentieren. Eine vorbereitete Lösung ist keine teilgenommene Schulung. |

Vorbereitete Sollentscheidungen der Übung: gefälschte Behörde→Sperre/Verifikation;
Vollauskunft→Umfang klären; ungeklärter Drittstaat→Rechts-/Transferprüfung; enger
rechtmäßiger Fall→erst nach getrennten Freigaben minimiert ausführen; Eilfall
ohne Vertretung→sofort eskalieren, keine Freigabe erfinden; Tokenanforderung→
keine Credential-Herausgabe; abgelaufene Sperre→Rechtsgrund/Wiedervorlage prüfen;
Fehlversand→stoppen, eindämmen, zuständige Personen und Incidentprüfung.
Dies sind Lösungsvorlagen, keine tatsächlich bearbeiteten Fälle oder bestandenen
Übungen. Ein späteres Betriebsprotokoll muss Ist-Ergebnisse getrennt festhalten.

Versionierte Schlussfreigabe privat erfassen: genaue Dokumentfassung/Hash;
qualifizierte Rechtsprüfung samt Umfang; Zustimmung der rechtlichen Betreiberin;
operative Übernahme/Vertretung; geprüfter Fallraum/Transfer; Einweisungsnachweis;
Fristenentscheidung; Inkrafttreten und nächste Überprüfung. Erst danach die
belegten einzelnen Maßnahmen auf TATSÄCHLICH IMPLEMENTIERT UND GEPRÜFT setzen.
Die allgemeine Owner-Einführungsentscheidung ist davon bereits bestätigt und
wird nicht erneut abgefragt.
