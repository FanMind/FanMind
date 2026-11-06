# Regulärer Workspace für einen Staging-Operator

## Zweck

Der manuelle Workflow `FanMind Staging Operator Workspace Provisioning` gibt
einer **bereits vorhandenen und bestätigten** Staging-Admin-Identität einen
regulären Workspace. Das behebt den Fall, dass die Anmeldung erfolgreich ist
und direkte Admin-Routen funktionieren, normale Produkt-Routen wie Dashboard
oder Fans aber nach `/workspace/setup` umleiten.

Der Ablauf erweitert die vorhandene, geschützte Staging-Provisionierung. Er
ändert weder die allgemeine Login- noch die Onboarding-Logik und umgeht keine
Produktions- oder Kundengrenze.

## Voraussetzungen und Verhalten

- Der Auth-Nutzer muss im isolierten Staging-Supabase-Projekt bereits genau
  einmal vorhanden sein.
- Seine E-Mail-Adresse muss in der Staging-Variable
  `FANMIND_STAGING_ADMIN_EMAILS` enthalten sein.
- Für den Nutzer darf noch kein fremder regulärer Workspace existieren.
- Der Ablauf erstellt höchstens einen Workspace namens
  `FanMind Staging Operator` und markiert ihn mit
  `staging_operator_workspace = true`.
- Ein bereits markierter Operator-Workspace wird idempotent geprüft und
  aktualisiert. Ein unmarkierter vorhandener Workspace stoppt fail-closed.

Der Workspace verwendet ausschließlich interne manuelle Staging-Werte:

- `billing_provider = manual`;
- `payment_collection_method = none`;
- `billing_manual_override = true`;
- Gebühren und Bindung jeweils `0`;
- keine Stripe-Referenzen;
- keine Annahme oder Fälschung von Zahlungsbedingungen.

Der Workflow erstellt keinen Auth-Nutzer, setzt kein Passwort und nimmt keine
Änderung an Production vor. Er ist auch kein Ersatz für das öffentliche
Kunden-Onboarding oder die spätere entgeltliche Aktivierung.

## Sicherheitsgrenzen

Der Workflow verlangt gleichzeitig:

- Branch `main` und den exakten vollständig geprüften Commit;
- das geschützte GitHub-Environment `staging`;
- die Bestätigung `provision-staging-operator-workspace`;
- eine in `FANMIND_STAGING_ADMIN_EMAILS` freigegebene Operator-E-Mail;
- verschiedene Staging-/Production-Supabase-Projektreferenzen;
- `FANMIND_ENABLE_NON_PRODUCTION_WRITES=true` und
  `I_UNDERSTAND_NON_PRODUCTION_ONLY`;
- den gemeinsamen read-only Datenbank-Rollout-State `PASS`;
- Supavisor Session-Pooler, Port `5432` und TLS `verify-full`.

## Kontrollierter Lauf

1. Code vollständig prüfen und nach `main` mergen.
2. Workflow `FanMind Staging Operator Workspace Provisioning` auswählen.
3. Branch `main` verwenden.
4. Exakten aktuellen `main`-Commit eintragen.
5. Als `operator_email` die bereits vorhandene Staging-Admin-E-Mail
   eintragen.
6. Bestätigung `provision-staging-operator-workspace` eintragen.
7. Nur einen Lauf akzeptieren, der gemeinsam meldet:

   ```text
   FANMIND_STAGING_OPERATOR_WORKSPACE_ID=<UUID>
   STAGING_OPERATOR_WORKSPACE_PAYMENT_TERMS_WRITES=0
   STAGING_OPERATOR_WORKSPACE_STRIPE_REFERENCES=0
   STAGING_OPERATOR_WORKSPACE=PASS
   ```

## Danach

Auf `https://staging.fanmind.ch` abmelden und normal über `/login` wieder
anmelden. Danach müssen `/dashboard` und `/fans` in den regulären Workspace
führen; `/admin/billing` bleibt für die freigegebene Admin-Adresse erreichbar.

Bleibt die alte Weiterleitung im Browser erhalten, einmal abmelden und die
Seite neu laden. Ein erneuter Provisionierungslauf ist dafür nicht nötig.
