# Konkrete Freigabevorlage: optionale Support-KI

ENTWURF14.11.2026, #1350. Kein Vertrag wird durch diesen Entwurf angenommen.
Die bestehende Production-Hilfe bleibt freigegeben; diese Vorlage betrifft nur
die dauerhafte Kontoentscheidung und deren zusätzliche Datenverarbeitung.

## Zur Veröffentlichung vorgeschlagener Text (bei Auswahl B)

> Die KI-Beantwortung im FanMind-Plattformsupport ist freiwillig. Verantwortliche
> ist Brigitte Erika Guggenberger, Einzelunternehmen FanMind; Kontakt:
> fanmind@fanmind.ch. Mit Ihrer Aktivierung werden Ihre aktuelle Supportfrage und
> höchstens zwei frühere eigene Supportfragen mit Antworten an OpenAI zur
> Beantwortung übermittelt. Private Fan-Nachrichten, Character-Einstellungen,
> Personas und Medien werden nicht automatisch geladen. Rechtsgrundlage der
> optionalen Übermittlung ist Ihre Einwilligung nach Art6Abs1lit.aDSGVO.
>
> Ohne Aktivierung steht Ihnen die lokale Hilfe zur Verfügung. Wir speichern Ihre
> Entscheidung mit Nutzerzuordnung, Textversion und serverseitigen Zeitpunkten
> kontobezogen und verwenden eine weiterhin gültige Zustimmung bei späteren
> Supportnutzungen. Unter „KI & Datenschutz“ im Support und „Einstellungen →
> Support-KI“ können Sie jederzeit für die Zukunft widerrufen. Eine bereits
> übermittelte Anfrage kann nicht zurückgerufen werden. Künftige KI-Anfragen
> werden nach Widerruf blockiert. Eine AGB-Annahme ersetzt diese Entscheidung nicht.
>
> Eigene Supportfragen und Antworten werden nach der bestehenden Regel bis zu
> 30Tage gespeichert; ihr Export und ihre Löschung sind im Support erreichbar.
> Gesprächslöschung und Widerruf sind getrennte Funktionen. Der aktuelle positive
> Nachweis bleibt während der Aktivierung gespeichert; nach Widerruf wird der
> vollständige Nachweis innerhalb von30Tagen minimiert. Anschließend bleiben nur
> Nutzerzuordnung, deaktivierter Status und Revision bis Kontolöschung erhalten,
> damit ältere Anfragen eine widerrufene Freigabe nicht wiederherstellen können.
> Nachweisführung und dieser minimale Sicherheitszweck sind getrennt von der
> freiwilligen KI-Verarbeitung zu beurteilen.
>
> OpenAI verarbeitet die Anfragen über seine API. Die dokumentierten Standard-
> Datenkontrollen sehen keine Trainingsverwendung ohne gesonderte Freigabe vor;
> Anbieter-Sicherheitsprotokolle können befristet gespeichert werden. FanMind
> verspricht weder EU-only-Verarbeitung noch Zero Data Retention. Ergänzend gelten
> die in dieser Datenschutzerklärung nach bestätigter Anbieterprüfung genannten
> Empfänger, Transfergrundlagen und Betroffenenrechte. Sie können Auskunft,
> Berichtigung, Löschung und gegebenenfalls Einschränkung und Datenübertragbarkeit
> verlangen; für eine Verarbeitung aufgrund berechtigter Interessen gilt das
> Widerspruchsrecht. Eine Beschwerde bei der österreichischen Datenschutzbehörde
> bleibt möglich. Der Widerruf berührt die Rechtmäßigkeit vorheriger Verarbeitung nicht.

**Noch NICHT veröffentlichungsreif:** Der letzte Anbieterabschnitt muss durch die
konkret bestätigte FanMind-Vertragspartner-/API-Projekt-/DPA-/Transferzuordnung und
deren Informationspflichten ergänzt werden. Ein allgemeiner DPA-Weblink beweist
keine Zuordnung des eingesetzten API-Schlüssels. Frist B erfordert das kontrollierte
Upgrade aus SUPPORT_AI_RETENTION_DECISION.md, bisher nicht aktiviert. Kein neuer
Text wird still in /datenschutz oder /agb übernommen.

## Getrennte, konkrete Entscheidungen

1. **Recht/Fachlichkeit:** obiger Zweck, optionale Einwilligungsgrundlage,
   Informationstext, Fristvorschlag B30Tage plus minimaler Sperrstand und dessen
   Interessenabwägung. Bis Bestätigung kein „rechtlich freigegeben“.
2. **Anbieterbeleg:** FanMind verwendete API-Organisation/Projekt und Vertragspartner
   privat zuordnen; wirksame DPA-Fassung, Transfers/SCC, Region und tatsächliche
   Datenkontrollen bestätigen. Keine neue Vertragsannahme durch den Assistenten.
3. **Datenbank:** separat genau die freigegebene SQL-Fassung/Hash und den aktuellen
   tatsächlichen Production-SHA benennen. Der neue geschützte Workflow bietet
   verify und apply, standardmäßig verify; apply ist hier ausdrücklich NICHT genehmigt.
   Bei B zunächst kontrolliertes Upgrade/Staging; der1491-Hash allein implementiert B nicht.
4. **Webrelease/Aktivierung:** erst nach vorstehenden Punkten exakten aktuellen
   gemeinsamen Main und erfolgreiches Shared-Gate benennen. Bestehende Funktionen,
   Billing, Meta, Instagram und Adminchat erhalten. Danach separat den Versionsschalter
   support-ai-20261114-v1 aktivieren und Desktop-Production-Abnahme durchführen.

Aktuell geprüfte Webbaseline: Productionbb799466d2c235195fedcb4d80568f9f0bd56969;
Staging95c93bf69046fb9349cecc28afc69b70a7a133c7. Main kann durch andere freigegebene
Arbeitsstränge weiterlaufen. Deshalb ist kein veralteter Main hier vorab als späterer
Deploymentauftrag freigegeben. Die Vorlage ist konkret hinsichtlich Text/SQL/Grenzen;
der endgültige Release-SHA muss unmittelbar vor der Entscheidung frisch ergänzt werden.
