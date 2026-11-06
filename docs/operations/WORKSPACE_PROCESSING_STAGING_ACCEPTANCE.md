# Workspace-Verarbeitung: rollback-only Staging-Abnahme

## Zweck und Grenze

Dieser manuelle Kontrollpfad belegt im getrennten Supabase-Staging, dass die
kanonische serverseitige Verarbeitungs-Policy aktive, gesperrte und später
reaktivierte Workspaces eindeutig unterscheidet. Er ist ein technischer
Nachweis für Meta-Ingress, manuelle Meta-Syncs und die vorbereitete
Catch-up-Queue. Er verbindet kein Meta-Konto, ruft keinen Provider auf,
aktiviert keinen Worker und verändert Production nicht.

Alle Änderungen an den Billing- und Zugriffsmerkmalen des synthetischen
Workspace laufen unter einer exklusiven Zeilensperre in genau einer
PostgreSQL-Transaktion und werden vollständig zurückgerollt. Ein zweiter
Postflight vergleicht den ursprünglichen und den zurückgerollten Zustand.

## Erforderlicher synthetischer Workspace

Der Workflow akzeptiert ausschließlich einen dauerhaft dafür vorgesehenen
Staging-Workspace mit diesen Eigenschaften:

- Name exakt `FanMind Staging Processing Acceptance`;
- Environment-Variable
  `FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID` enthält seine UUID;
- `workspace_access_mode = active` und `billing_status = active`;
- `test_access_flags.workspace_processing_acceptance = true`;
- keine Stripe Customer- oder Subscription-ID.

Diese Markierung ist kein Produktzugang und darf nicht für Kunden-, Demo-,
Billing- oder Production-Daten verwendet werden. Fehlt eine der Bedingungen,
stoppt der Lauf vor der ersten Mutation.

## Sicherheitsvertrag

Der Workflow `FanMind Workspace Processing Staging Acceptance` verlangt
gleichzeitig:

- `main` und den exakten, vollständig geprüften 40-stelligen Commit;
- das geschützte GitHub-Environment `staging`;
- Staging-App-Origin und Supabase-Projektreferenz, jeweils eindeutig von
  Production getrennt;
- den Supabase-Session-Pooler auf Port `5432`, den daraus abgeleiteten Benutzer
  `postgres.<staging-project-ref>` und TLS `verify-full`;
- eine private, eigentümergeführte `PGPASSFILE`-Kopie mit Modus `0600`;
- `FANMIND_ENABLE_NON_PRODUCTION_WRITES=true`,
  `I_UNDERSTAND_NON_PRODUCTION_ONLY` und die Bestätigung
  `run-workspace-processing-staging-acceptance`;
- den gemeinsamen read-only Staging-Rollout-State mit
  `STAGING_DATABASE_ROLLOUT_STATE=PASS` vor dem schreibenden Schritt.

Connection-URLs, `PGPASSWORD`, `PGHOSTADDR`, libpq-Services und andere
Zielumleitungen sind gesperrt. Der Runner gibt keine Workspace-ID, Billing-
Details, Stripe-Referenz, Nachricht, Meta-ID oder Secret aus.

## Geprüfte Zustände

Die Transaktion erzeugt und validiert neun redigierte Policy-Fixtures:

1. aktives Billing erlaubt Verarbeitung;
2. `archived_readonly` sperrt;
3. erreichtes Vertragsende sperrt;
4. Suspendierung ohne Override/Grace sperrt;
5. gültige Zahlungs-Grace erlaubt vorübergehend;
6. expliziter manueller Override erlaubt;
7. nicht abgelaufener, serverseitig markierter Testzugang erlaubt;
8. abgelaufener Testzugang sperrt;
9. Reaktivierung auf den aktiven Zustand erlaubt wieder.

Zusätzlich bleiben fehlender Workspace und unbekannter Zugriffsstatus in der
kanonischen Policy fail-closed. Der Lauf akzeptiert nur die festen
Reason-Codes; freie Datenbank- oder Providerfehler werden nicht ausgegeben.

## Ablauf

1. Den Acceptance-Code vollständig prüfen und nach `main` mergen.
2. Offline ausführen:

   ```bash
   npm run workspace:processing:staging:check
   ```

3. Den synthetischen Staging-Workspace einmalig mit obigem Namen und Marker
   bereitstellen; keine Kunden- oder Production-ID verwenden.
4. Seine UUID als
   `FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID` ausschließlich im
   GitHub-Environment `staging` setzen.
5. Den Workflow auf `main` mit dem exakten Commit und der Bestätigung
   `run-workspace-processing-staging-acceptance` starten.
6. Nur einen Lauf akzeptieren, der gemeinsam meldet:

   - `WORKSPACE_PROCESSING_STAGING_DATABASE_CASES=9`;
   - `WORKSPACE_PROCESSING_STAGING_POLICY_CASES=11`;
   - `WORKSPACE_PROCESSING_STAGING_DENIAL_REACTIVATION=PASS`;
   - `WORKSPACE_PROCESSING_STAGING_ROLLBACK=PASS`;
   - `WORKSPACE_PROCESSING_STAGING_PROVIDER_CALLS=0`;
   - `SECRETS_WURDEN_NICHT_AUSGEGEBEN=true`.

## Danach weiterhin offen

Dieser Nachweis beweist Policy, reale Staging-Spalten und vollständigen
Rollback. Er ersetzt nicht den späteren synthetischen Meta-Ende-zu-Ende-Test.
Vor Production bleiben insbesondere Webhook-Drop ohne neue CRM-Zeile,
konservativer Cursor nach Reaktivierung, echte OAuth-/Token-Revocation,
Catch-up-Queue/Worker, App Review sowie das Rechtsgate getrennt abzunehmen.
