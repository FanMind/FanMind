# Billing1518: eigene Struktur-Recovery-Vorbereitung

- Basis: e48eea970e5c0b541ebfe58e8aeb7ccd3dea8ae8;1518 bereits gemergt.
- Eigene Flächen: workspace-provisioning-recovery.mjs, kontrolliertes
  workspace_provisioning_existing_recovery.sql, neue importierte Recovery-
  Testfälle, bestehender Workspace-Pflichtroot und eigene Billing-/Releaseberichte.
- Keine Änderung an alter Contract-/Expand-/RPC-Migration, Capacity, Backup,
  Support1500/1521, Adminchat oder Meta. Keine neue Arbeits-/Agentensitzung.
- Status: SOURCE_PREPARATION / CI_REQUIRED / PRODUCTION_BLOCKED.
- Invoker-RPC prüft nur vorhandenen eigenen Workspace und Owner-Mitgliedschaft;
  keine neue Admission oder Membership-/Kunden-/Vertrags-DML.
- Zielaktionen: ausschließlich lesende Katalog-/Evidenzabfragen. Kein Apply,
  Live-Stripe-/Secret-/Preis-/Zahlungs-/Guthaben-/Deployvorgang.
- Rückfall: normaler Quellrevert; keine Zielmutation zurückzusetzen.
