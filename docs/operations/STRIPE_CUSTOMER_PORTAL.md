# Bestehendes Stripe-Kundenportal: isolierter Staging-Zugang

Fortsetzung des Owner-Auftrags zu FanMind Stripe, FM-AI-001.
Sourceumfang R3; FM-CONTRACT-REG-ENTITLEMENT-001 / FM-IGATE-REG-ENTITLEMENT-001
(Owner-/Workspace-/Billing-Route). Kein Entitlement- oder monetärer Lifecycle-Write;
FM-CONTRACT-AI-BILLING-001 / FM-IGATE-AI-BILLING-001 bleiben unverändert blockiert.

## Implementiert

Die vorhandene Rechnungsseite wird um einen getrennten Portalzugang ergänzt.
POST /api/billing/portal verwendet bestehende Auth-, CSRF-, Demo-/Admin-CRM-,
Workspace-, Freeze- und Rate-Limit-Prüfungen. Member und fremde Workspaces werden
vor Providerzugriff abgewiesen. Der Body muss ein leeres JSON-Objekt sein;
Customer, Konfiguration und Rücksprungziel stammen ausschließlich vom Server.
Authentifizierungs-/Providerfehler liefern nur fixe Codes und no-store.

Der bestehende Stripe-Client und API-/SDK-Pin bleiben unverändert. Zugelassen sind
nur Runtime staging, exakter Host https://staging.fanmind.ch, ein Testschlüssel
und STRIPE_BILLING_PORTAL_CONFIGURATION mit expliziter bpc-ID. Ohne diese Bindung
erscheint kein Button. Freeze bleibt eine zusätzliche Sperre.

Die Rückwärtsauflösung muss denselben Workspace eindeutig liefern. Der kanonisch
abgerufene Customer muss im Testmodus existieren. Eine vorhandene
metadata.workspace_id darf der autoritativen gespeicherten Bindung nicht
widersprechen. Legacy-Customer ohne diese Metadaten bleiben mit eindeutiger
gespeicherter Vorwärts-/Rückwärtsbindung zulässig; keine Metadaten-Befüllung oder
E-Mail-Gleichheit ersetzt eine fehlende gespeicherte Zuordnung.

Die explizite aktive Testkonfiguration muss dem eigenen Konto zugeordnet sein
(application=null), die öffentliche Loginseite deaktivieren und ausschließlich
die Rechnungshistorie aktivieren. Customer-, Zahlungsmittel-, Kündigungs- und
Aboänderungen sind deaktiviert. Unbekannte Feature-Schlüssel sperren den Zugang.
Es gibt keinen Default-Fallback, keinen Deep-Link-Flow und keine Konfigurations-
oder Customer-Erstellung. Nach den Providerreads werden Freeze, Ziel und
Konfigurations-ID erneut geprüft. Eine nachfolgende Stripe-Adminänderung der
Konfiguration ist nicht atomar mit der Session-Erstellung sperrbar; vor tatsächlicher
Abnahme muss diese Konfiguration separat kontrolliert bleiben.

Die erhaltene Session wird auf erwarteten Customer, Konfiguration, Rücksprungziel,
Objekttyp und sicheren HTTPS-Host billing.stripe.com geprüft. Nur die kurzlebige
URL erreicht den Client; keine SDK-/Kundendaten oder Providerfehlermeldungen.
Die URL wird nicht geloggt oder gespeichert. Rechnungshistorie kann Zahlungslinks
für offene Testrechnungen enthalten; deshalb wird keine allgemeine vollständige
Schreibfreiheit des Stripe-Portals behauptet. Production und Live bleiben gesperrt.

## Geprüft und noch offen

Die bereits registrierte Stripe-Route-Suite führt echten transpilierten Routecode
mit dem echten Portalprüfer aus. Sie prüft Erfolg, CSRF, Auth, Owner/Member, Demo,
Admin-CRM, Rate, fehlende/falsche Umgebung, Freeze, leere Payloadgrenze, fremde/
gelöschte/live Customer, zweideutige Rückwärtsbindung, veränderte Konfiguration,
Mutationsfunktionen, neue unbekannte Features, Providerfehler und Redirecttausch.
Providerantworten sind synthetisch; kein Hosted-Portal-Nachweis.

Lokaler Build einschließlich TypeScript und gezieltes ESLint bestanden.
56 gezielte/regressive Tests und 123 Governance-Tests bestanden. Eine lokale
Mutationsprobe entfernt vorübergehend die tatsächliche Route-Ownerprüfung:
der Fremdzugriffstest wird rot; nach exakter Wiederherstellung bestehen alle
Portaltests. Das ist ein Negativnachweis, keine unabhängige Zielabnahme.
Bestehende Rechnungs-/Topup-/Webhook-Pfade bleiben erhalten. Current-head CI,
Review und Staging-Abnahme bleiben eigene Schritte. Keine neue Dependency,
Migration, Datenbank, Stripe-Identität, Steuerregistrierung, Zahlung, Subscription,
Konfiguration, Umgebungsvariable oder Kundentestdaten wurden extern erzeugt.

Für die echte Abnahme ist eine kontrollierte, vorhandene Sandbox-Konfiguration
mit obigen Eigenschaften und ein autorisierter synthetischer Workspace mit
korrekt gebundenem Test-Customer erforderlich. Der derzeitige Stripe-Connector
stellt nur Live-Kontext bereit; die zuvor genutzte Browser-Verbindung ist nicht
verfügbar. Es wird weder auf Live ausgewichen noch ein neues Konto angelegt.
Die benötigte bpc-ID wird erst nach tatsächlicher Prüfung in der bestehenden
Staging-Umgebung gebunden. Vorher bleibt die neue Funktion geschlossen.

Die bisher offenen Steuer-, kontrollierten Capacity-Schema-, monatlichen
Checkout-/Entitlement-/Vertrags- und vollständigen Lifecycle-Abnahmen bleiben
offen. Das Portal allein macht keines der neuen Monatspakete verkaufsfähig.

Recovery: gewöhnlicher Source-Revert. STRIPE_BILLING_PORTAL_CONFIGURATION
nicht setzen/entfernen bzw. vorhandenen Billing-Freeze beibehalten sperrt den
Portalzugang. Es gibt keine externe Daten-/Vertragsänderung zurückzunehmen.
