# FanMind aktueller Datenbank- und RLS-Stand

Stand: August 2026

Dieses Dokument ersetzt die alte Lesart von `docs/database/fanmind_mvp_schema.sql` als vollständiges Schema. Die Datei `fanmind_mvp_schema.sql` bleibt nur als historischer Auth-/Workspace-Basisstand erhalten.

Die aktuelle Datenbankwahrheit ergibt sich aus:

1. den Supabase-Migrationen unter `supabase/migrations/`,
2. den einzeln freizugebenden Contract-Schritten unter
   `supabase/controlled/`,
3. den tatsächlich verwendeten Queries und Typen in `src/lib/supabase/server.ts`,
4. dieser Dokumentation.

## 1. Grundprinzip

Alle produktiven Daten sind workspace-scoped oder user-scoped.

- Jede Kundendaten-Tabelle braucht `workspace_id`, wenn sie nicht ausschließlich user-scoped ist.
- Jede API-Route und Server Action muss User -> Workspace -> Ressource prüfen.
- Supabase Service Role ist nur serverseitig erlaubt.
- Browser-Code nutzt nur Supabase URL und Anon Key.
- RLS muss für workspace- und userbezogene Tabellen aktiv sein.
- Reine Triggerfunktionen sind keine Browser-RPCs. Die kontrollierte,
  checksum-gebundene Härtung ihrer Suchpfade und `EXECUTE`-Rechte liegt unter
  `supabase/controlled/20260806203023_harden_trigger_function_privileges.sql`.
  Sie wurde über den getrennten Staging-Pfad in
  `docs/operations/TRIGGER_FUNCTION_HARDENING_STAGING.md` abgenommen. Der
  separate Production-Kontrollweg steht in
  `docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md`; ein normaler
  Deploy installiert dort nur nicht aktivierte Kontrollartefakte. Ein
  generisches `supabase db push`, der Web-Deploy selbst und ein Merge dürfen
  die SQL nicht ausführen. Der Production-Apply bleibt bis zu einer erneuten
  ausdrücklichen Freigabe offen.

## 2. Auth-/Workspace-Kern

### `profiles`

Zweck: Nutzerprofil zu Supabase Auth User.

Wichtige Felder:

- `id`
- `email`
- `display_name`
- `phone`
- `role_audience`
- `created_at`

RLS-Erwartung:

- Nutzer darf eigenes Profil lesen, anlegen und aktualisieren.
- Andere Profile dürfen nicht sichtbar sein, außer explizit admin-/workspace-scoped später freigegeben.

### `workspaces`

Zweck: Mandanten-/Workspace-Ebene.

Wichtige Felder laut aktuellem Code:

- `id`
- `name`
- `owner_user_id`
- `plan_id`
- `commercial_option`
- `setup_fee_cents`
- `monthly_fee_cents`
- `commitment_months`
- `billing_status`
- `billing_provider`
- `payment_collection_method`
- `payment_terms_version`
- `payment_terms_accepted_at`
- `payment_terms_accepted_by_user_id`
- `billing_suspended_at`
- `billing_suspended_reason`
- `billing_manual_override`
- `billing_last_payment_failed_at`
- `billing_last_payment_at`
- `billing_retry_count`
- `billing_next_retry_at`
- `billing_grace_until`
- `billing_admin_note`
- `test_access_flags` (JSONB, serverseitige Flags für interne Testzugänge; Default `{}`)
- `billing_updated_at`
- `billing_updated_by_user_id`
- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_checkout_session_id`
- `stripe_payment_intent_id`
- `stripe_mandate_id`
- `billing_note`
- `last_invoice_id`
- `last_invoice_status`
- `last_invoice_amount_due_cents`
- `last_invoice_amount_paid_cents`
- `last_invoice_hosted_url`
- `last_invoice_pdf_url`
- `organization_name`
- `street_address`
- `postal_code`
- `city`
- `country`
- `vat_id`
- `tax_number`
- `company_register_number`
- `company_register_court`

RLS-Erwartung:

- Owner darf eigenen Workspace lesen.
- Workspace-Mitglieder dürfen nach dem kontrollierten Member-Boundary-Apply
  nicht die Basiszeile lesen, sondern nur die parameterlose Safe-RPC-Projektion
  aus ID, Name, Plan, normalisierter Member-Rolle und Processing-Bool. Der
  checksum-gebundene Control ist derzeit `CHECKED_NOT_APPLIED`; sein
  geschützter Staging-Apply-/Verify-Pfad ist vorbereitet, aber noch nicht
  extern ausgeführt.
- `workspace_analysis_settings` enthält administrative Legal-, AVV-,
  Retention- und Bestätigerfelder und wird erst nach nachgewiesenem Apply
  desselben Controls für direkte Browser-Reads auf den Owner begrenzt.
- Owner darf ausschließlich Name, Organisations-/Adress- und Steuerstammdaten
  direkt mutieren.
- Neue öffentliche Starter-Workspaces und die Owner-Membership entstehen
  atomar über `ensure_current_user_workspace(...)`; Plan, Preis, Billing und
  Zahlungsannahme werden dort serverseitig abgeleitet.
- Vorbereiteter Daily-Provisioning-Rollout (noch nicht als Production-Stand
  abgenommen): Der außergewöhnliche öffentliche Daily-Test nutzt separat
  `ensure_internal_daily_test_workspace(...)`. Dieser atomare RPC nimmt nur
  die serververifizierte Auth-ID, den Anzeigenamen und die bestätigte
  Zahlungsbedingung an; Tarif, Nullbeträge, Stripe/Card und Billing-Status sind
  fest verdrahtet. `PUBLIC`, `anon` und `authenticated` besitzen kein
  `EXECUTE`; ausschließlich `service_role` darf ihn nach einer frischen
  Zeitfensterprüfung aufrufen. Derselbe einzeln freizugebende SQL-Schritt unter
  `supabase/controlled/` erweitert und validiert die kanonischen CHECKs für
  `commercial_option = internal_daily_test` und
  `payment_collection_method = card`, bevor er den RPC freigibt; generische
  Migration Discovery darf ihn nicht sehen.
- `internal_daily_test_workspace_provisioning_ready()` ist ebenfalls
  `service_role`-only und liefert nur dann `true`, wenn der Daily-RPC vorhanden
  ist, beide validierten Workspace-CHECKs exakt den kanonischen erweiterten
  Wertvertrag abbilden und weder `anon` noch `authenticated` direkte Tabellen-
  oder Spaltenrechte für Workspace-`INSERT` besitzen. Ohne diesen Postflight
  wird die öffentliche Daily-Auswahl in Anwendung und Adminoberfläche
  fail-closed verborgen beziehungsweise blockiert. Erst Migration,
  Staging-Abnahme und Production-Postflight nach
  `docs/operations/INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING.md` machen diesen
  vorbereiteten Vertrag zum produktiven Schema. Die App öffnet die Admission
  zusätzlich nur bei vollständig konfiguriertem Daily-Preis, Stripe-Secret,
  App-URL und Stripe-Webhook-Secret.
- Direkter `INSERT` sowie table-level `UPDATE` für `authenticated` werden mit
  `supabase/controlled/20260726121000_workspace_server_owned_columns.sql`
  entzogen. Nur zehn
  ausdrücklich freigegebene Stammdatenspalten behalten ein Spaltenrecht.
- Billing-, Stripe-, Invoice-, Subscription-, Owner- und
  `test_access_flags`-Felder bleiben serververwaltet.
- Der Production-Rollout ist erst nach dem zweiphasigen Runbook
  `docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md` abgeschlossen.

### `workspace_members`

Zweck: Nutzer-Workspace-Zuordnung.

Wichtige Felder:

- `id`
- `workspace_id`
- `user_id`
- `role`
- `created_at`

RLS-Erwartung:

- Nutzer sieht eigene Memberships.
- Owner darf Membership für eigenen Workspace vorbereiten, soweit MVP benötigt.
- Member-Mutationen sind im App-Vertrag deaktiviert. Die direkte JWT-/RLS-
  Grenze ist bis zum nachgewiesenen Apply noch offen; danach erzwingt der
  vorbereitete Control für zwölf Tabellen aktive Workspace-Ownership, während
  bestehende Member-Reads erhalten bleiben. Der Nachweis erfordert App-first-
  Deploy, getrennten Apply/Verify, reale Chromium-Abnahme und finalen Verify.
  Details:
  `docs/operations/WORKSPACE_MEMBER_DATA_BOUNDARY.md`.

## 3. CRM-Kern

### Website-Chat-Sicherheitsgrundlage

`website_chat_installations`, `website_chat_allowed_origins`,
`website_chat_visitor_sessions` und `website_chat_message_receipts` bilden eine
deaktivierte, server-only
Vorstufe für Website-Chat. Installationen und Sitzungen sind vollständig an
einen Workspace gebunden. Erlaubte Origins müssen exakt als HTTPS-Origin
vorliegen und separat verifiziert sein. Besuchertokens werden nie im Klartext
gespeichert, sondern nur als HMAC-SHA256-Subjekt. Alle drei Tabellen haben RLS;
`public`, `anon` und `authenticated` besitzen keine direkten Tabellenrechte.
Die ausschließlich für `service_role` ausführbare, transaktionale
`SECURITY INVOKER`-Funktion `ingest_website_chat_message` prüft Installation,
Origin, Sessionablauf und Widerruf erneut. Sie erzeugt je Sitzung einen Kontakt
und eine Conversation und schreibt idempotente eingehende Nachrichten in
`conversation_messages`; der Receipt enthält keinen Nachrichtentext. Der Block
enthält keine KI-Antwort und keine Sendefunktion. Aktivierung und Migration
sind zuerst im isolierten Staging abzunehmen.

### `contacts`

Zweck: Fan-/Kontaktstammdaten pro Workspace und Kanal.

Wichtige Felder:

- `id`
- `workspace_id`
- `display_name`
- `handle`
- `source_platform`
- `language`
- `status`
- `tags`
- `summary`
- `internal_notes`
- `created_at`
- `updated_at`

RLS-Erwartung:

- Nur Kontakte im eigenen Workspace lesen/schreiben.
- Kein Kontaktzugriff nur über `contact_id` ohne Workspace-Prüfung.

### `memories`

Zweck: gespeichertes Fan-Gedächtnis / relevante Kontextnotizen.

Wichtige Felder:

- `id`
- `workspace_id`
- `contact_id`
- `type`
- `content`
- `importance`
- `created_at`

RLS-Erwartung:

- Nur Memories des eigenen Workspaces lesen/schreiben.
- `contact_id` muss zu demselben Workspace gehören.

### `followups`

Zweck: manuelle Nachfass-Aufgaben.

Wichtige Felder:

- `id`
- `workspace_id`
- `contact_id`
- `due_date`
- `priority`
- `reason`
- `status`
- `created_at`

RLS-Erwartung:

- Nur Follow-ups des eigenen Workspaces lesen/schreiben.
- Offene Follow-ups im Dashboard und in Kontaktliste dürfen nur workspace-scoped erscheinen.

## 4. Conversations / Messages

### `conversations`

Zweck: Arbeitskonversationen pro Kontakt.

Wichtige Felder:

- `id`
- `workspace_id`
- `contact_id`
- `status`
- `priority`
- `source_platform`
- `source_type`
- `source_url`
- `reply_target_url`
- `external_thread_id`
- `external_message_id`
- `external_post_id`
- `external_video_id`
- `external_comment_id`
- `original_author_label`
- `original_text_excerpt`
- `last_inbound_at`
- `last_outbound_at`
- `last_message_preview`
- `assigned_owner`
- `ai_status`
- `next_step`
- `created_at`
- `updated_at`

RLS-Erwartung:

- Nur Conversations des eigenen Workspaces lesen/schreiben.
- Archivierte Conversations dürfen nicht versehentlich als offene Arbeit erscheinen.

Rollout-Hinweis:

- `assigned_user_id` ist als stabile Auth-Identität für atomare Übernahme und
  Freigabe vorbereitet, gehört aber noch nicht zum aktuellen Production-
  Schema. Die Anwendung erkennt die fehlende Spalte und blendet Handoff-
  Aktionen fail-closed aus.
- Vor einer Aktivierung müssen Spalte, atomare Mutationsgrenze sowie getrennte
  RLS- und Spaltenrechte kontrolliert auf Staging angewendet und abgenommen
  werden. Die bestehende breite Workspace-Member-Policy allein genügt dafür
  nicht.

### `conversation_messages`

Zweck: gespeicherter Nachrichten-/Timeline-Kontext.

Wichtige Felder:

- `id`
- `workspace_id`
- `conversation_id`
- `contact_id`
- `direction`
- `message_type`
- `source_platform`
- `source_type`
- `source_url`
- `reply_target_url`
- `external_thread_id`
- `external_message_id`
- `external_post_id`
- `external_video_id`
- `external_comment_id`
- `original_author_label`
- `original_text_excerpt`
- `author_label`
- `content`
- `attachments`
- `message_kind`
- `created_at`
- `seen_at`

RLS-Erwartung:

- Nur Messages des eigenen Workspaces lesen/schreiben.
- Anhänge/URLs dürfen keine ungeprüften Secrets enthalten.
- Externe IDs sind Kontextdaten, keine Login-Daten.

### `conversation_summaries`

Zweck: zusammengefasster Conversation-Kontext für KI und UI.

Wichtige Felder:

- `id`
- `workspace_id`
- `conversation_id`
- `contact_id`
- `summary`
- `key_points`
- `open_questions`
- `last_summarized_message_at`
- `message_count_seen`
- `updated_at`
- `created_at`

RLS-Erwartung:

- Nur Summaries des eigenen Workspaces lesen/schreiben.

## 5. KI-/Profil-Tabellen

### `contact_ai_profiles`

Zweck: vorsichtig abgeleitete Kommunikations-/Profilhinweise pro Kontakt.

Wichtige Felder:

- `id`
- `workspace_id`
- `contact_id`
- `language`
- `tone`
- `sentiment`
- `interests`
- `buying_signals`
- `no_gos`
- `preferred_style`
- `response_triggers`
- `risk_notes`
- `confidence_score`
- `source_message_count`
- `source_from_at`
- `source_to_at`
- `review_status`
- `reviewed_by`
- `reviewed_at`
- `updated_at`
- `created_at`

RLS-Erwartung:

- Lesen nur im eigenen Workspace; generierte Reports werden ausschließlich
  serverseitig geschrieben.
- Keine sensiblen, diagnostischen oder geschützten Eigenschaften als harte Tatsachen speichern.

### `workspace_voice_profiles`

Zweck: Schreibstil-/Voice-Kontext pro Workspace/User.

Wichtige Felder:

- `id`
- `workspace_id`
- `user_id`
- `owner_label`
- `language`
- `tone`
- `sentence_length`
- `emoji_style`
- `greeting_style`
- `closing_style`
- `common_phrases`
- `avoided_phrases`
- `sales_style`
- `examples_count`
- `confidence_score`
- `source_from_at`
- `source_to_at`
- `source_scope` (fest `confirmed_manual_outbound`)
- `review_status`
- `reviewed_by`
- `reviewed_at`
- `updated_at`
- `created_at`

RLS-Erwartung:

- Lesen nur im eigenen Workspace, ggf. User-spezifisch eingeschränkt;
  generierte Profile werden ausschließlich serverseitig geschrieben.
- Lernquelle sind ausschließlich bestätigte manuelle ausgehende Nachrichten;
  niemals KI-Entwürfe, Notizen oder eingehende Fan-Nachrichten.

### `workspace_ai_tier_entitlements` (auf Staging angewendet)

Zweck: serververwaltete Source of Truth für genau ein optionales KI-Add-on
eines Workspaces. Eine fehlende Zeile bedeutet KI Standard.

Wichtige Felder:

- `workspace_id`
- `tier_id` (`plus` oder `ultra`)
- `status`
- `source` (ausschließlich `stripe`)
- `stripe_subscription_id`
- `stripe_subscription_item_id`
- `stripe_price_id`
- `effective_at`
- `expires_at`
- `last_stripe_event_id`
- `last_stripe_event_created_at`
- `created_at`
- `updated_at`

RLS-/Privilege-Erwartung:

- RLS und `FORCE ROW LEVEL SECURITY` sind aktiv.
- Es existiert keine Browser-Policy.
- `public`, `anon` und `authenticated` besitzen weder Tabellen- noch
  Spaltenrechte.
- Nur `service_role` darf lesen und mutieren.
- Stripe-Referenzen werden niemals an Browser oder den KI-Resolver
  weitergegeben.
- Fehlende, mehrdeutige oder ungültige Daten fallen auf KI Standard zurück.
- Die Migration `20260727090000_workspace_ai_tier_entitlements.sql` ist auf
  dem getrennten Supabase-Staging angewendet und katalogseitig nachgeprüft;
  auf Production ist sie nicht angewendet.
- Offline-Checksum-Prüfung sowie zielgebundener Read-only-Postflight und
  expliziter Apply stehen über
  `scripts/operations/ai-tier-entitlement-migration-runner.mjs` bereit; ein
  Web-Deploy führt keinen dieser Datenbankschritte aus.
- Die anschließende Owner-/Member-RLS-, Service-Role-CRUD- und
  Stripe-Testkatalog-Abnahme ist als manueller rollback-only Workflow
  vorbereitet. Sie wendet keine Migration an und darf nur gegen ein getrenntes
  Staging mit synthetischem Workspace laufen.

### `workspace_ai_prompt_settings`

Zweck: Workspace-weiter Unternehmens-Prompt und bis zu acht auswählbare Antwortprofile für KI-Antwortvorschläge.

Wichtige Felder:

- `workspace_id`
- `company_prompt`
- `profiles`
- `updated_by_user_id`
- `updated_at`
- `created_at`

RLS-/Security-Erwartung:

- Lesen nur im eigenen Workspace.
- Schreiben ausschließlich serverseitig nach Owner-/Admin-Prüfung und Mutation-Origin-Prüfung.
- `company_prompt` maximal 3.000 Zeichen; `profiles` ist ein JSON-Array mit maximal acht servervalidierten Profilen.
- Keine Passwörter, Tokens oder unnötigen personenbezogenen Daten speichern.
- Prompttexte werden nicht in `ai_usage_events` kopiert.

### `fan_analysis_reports`

Zweck: gespeicherte Fan-Analyse-Reports.

Wichtige Felder:

- `id`
- `workspace_id`
- `contact_id`
- `report_json`
- `summary`
- `model`
- `source_message_count`
- `source_from_at`
- `source_to_at`
- `confidence_score`
- `review_status`
- `reviewed_by`
- `reviewed_at`
- `generated_at`
- `created_at`
- `updated_at`

RLS-Erwartung:

- Lesen nur im eigenen Workspace; generierte Reports werden ausschließlich
  serverseitig geschrieben.
- Reports müssen vorsichtig formuliert bleiben und dürfen keine geschützten/sensiblen Eigenschaften als Tatsachen speichern.
- Quellenzeitraum, Stichprobengröße, Konfidenz und menschlicher Reviewstatus
  müssen nachvollziehbar bleiben.

### `workspace_analysis_settings` (Migration vorbereitet)

Zweck: fail-closed Aktivierung von Fan-, Gesprächs-, Nutzer-Schreibstil- und
Content-Analyse je Workspace.

Wichtige Felder:

- `workspace_id`
- `fan_analysis_enabled`
- `conversation_analysis_enabled`
- `user_voice_analysis_enabled`
- `content_insights_enabled`
- `meta_sync_mode` (fest `incremental_cache`)
- `personal_content_retention_days` (fest `0`; keine Spiegelung persönlicher
  fremder Posts/Profile)
- `legal_basis_status`
- `transparency_status`
- `data_processing_agreement_status`
- `retention_status`
- `data_subject_rights_status`
- `message_retention_days`
- `content_cache_retention_days`

Die zwei Meta-Content-Migrationen bleiben auf Production unangewendet. Der
einzige vorbereitete Apply-/Postflight-Pfad ist
`docs/operations/META_CONTENT_STAGING_MIGRATION.md`: checksum-gebunden,
`main`- und commit-genau, TLS-verifiziert und ausschließlich für ein von
Production getrenntes Staging. Der Postflight prüft RLS, Select-only-
Browserzugriff, Spaltenrechte einschließlich Tokenausschluss, Service-Role-
Zugriff, Indizes und den entfernten 50er-Löschtrigger. Ein bestandener
Schema-Apply aktiviert weder Meta noch Analyse.
- `analysis_retention_days`
- `confirmed_by`
- `confirmed_at`

RLS-/Security-Erwartung:

- alle Analysearten standardmäßig `false`;
- Lesen nur im eigenen Workspace, Schreiben ausschließlich serverseitig nach
  Owner-/Admin-Prüfung;
- Aktivierung nur im inkrementellen Cache-/Chat-Modus ohne gespiegelte
  persönliche Fremdprofile sowie bei fünf
  bestätigten Rechts-/Datenschutzkontrollen und
  dokumentierter bestätigender Person samt Zeitpunkt.

### `communication_analysis_reports` (Migration vorbereitet)

Zweck: vorsichtige, überprüfbare Analyse eines konkreten Gesprächs, getrennt
von einem allgemeinen Kontaktbericht.

Wichtige Felder:

- `workspace_id`
- `conversation_id`
- `contact_id`
- `report_json`
- `source_message_count` (0 bis 150; abhängig von der serverseitig
  freigegebenen KI-Stufe)
- `source_from_at`, `source_to_at`
- `confidence_score`, `review_status`
- `reviewed_by`, `reviewed_at`
- `model`, `generated_at`

RLS-/Security-Erwartung:

- Lesen nur im eigenen Workspace; Mutation ausschließlich serverseitig.
- Keine sensiblen oder diagnostischen Ableitungen.
- Korrigierbar, verwerfbar und löschbar.

### `content_sources`

Zweck: Workspace-gebundener Cache eigener Posts, Reels und Videos des
verbundenen Business-/Creator-Kontos.

Wichtige Felder:

- `workspace_id`
- `source_platform`
- `source_type`
- `external_source_id`
- `external_post_id`
- `external_video_id`
- `title`
- `summary`
- `caption_excerpt`
- `permalink_url`
- `published_at`
- `metadata`
- `social_connection_id`
- `external_account_id`
- `media_type`
- `content_format`
- `campaign_label`

RLS-/Security-Erwartung:

- Lesen nur im eigenen Workspace; Schreiben ausschließlich serverseitig;
- keine Tokens, Login-Daten oder unnötigen privaten Profildaten in `metadata`;
- jeder Conversation-/Fan-Kontext bleibt am konkreten Post/Thread statt an
  einer vermischten Social-Sammlung.
- persönliche fremde Posts/Profile werden nicht in dieser Tabelle gespiegelt.

### `content_metric_snapshots` (Migration vorbereitet)

Zweck: versionierte, aggregierte Reichweiten- und Interaktionswerte für eigene
gecachte Inhalte, damit Veränderungen ohne vollständigen Neuabruf vergleichbar
bleiben.

Wichtige Felder:

- `workspace_id`, `social_connection_id`, `content_source_id`
- `platform`, `external_account_id`, `external_content_id`
- `reach`, `impressions`, `views`, `plays`
- `likes`, `comments`, `shares`, `saves`
- `link_clicks`, `profile_visits`, `follows`
- `direct_messages`, `new_contacts`, `paid_reach`, `paid_impressions`
- `source_metric_names`, `metric_payload_version`, `captured_at`

RLS-/Security-Erwartung:

- Lesen nur im eigenen Workspace; Schreiben ausschließlich serverseitig.
- Nur erlaubte nicht-negative Metriken; keine Followerlisten oder persönlichen
  Fremdprofile.

## 6. Reply Targets / Originalkanal-Kontext

### `contact_reply_targets`

Zweck: gespeicherte Direktlinks oder Originalkanal-Ziele, vor allem Facebook/Messenger-Hilfen.

Wichtige Felder:

- `id`
- `workspace_id`
- `contact_id`
- `source_platform`
- `source_type`
- `label`
- `url`
- `quality`
- `created_at`
- `updated_at`

RLS-Erwartung:

- Nur eigener Workspace.
- URLs dürfen nicht ungeprüft als Login-/Token-URLs gespeichert werden.
- Demo-Modus blockiert externe Direktlinks.

## 7. Social / Meta / Webhooks

### `social_connections`

Zweck: vorbereitete, mandantengetrennte Social-/Meta-Verbindungen pro
Workspace. Jeder Kunde verbindet sein eigenes externes Geschäftskonto.

Wichtige Felder:

- `id`
- `workspace_id`
- `platform`
- `provider`
- `status`
- `external_account_id`
- `external_account_name`
- `page_id`
- `page_name`
- `page_access_token_encrypted`
- `token_last_four`
- `scopes`
- `webhook_subscribed`
- `connected_by`
- `connected_at`
- `disconnected_at`
- `last_event_at`
- `last_comment_fetch_at`
- `last_comment_fetch_count`
- `last_comment_fetch_error`
- `last_messenger_sync_at`
- `last_messenger_sync_checked_count`
- `last_messenger_sync_imported_inbound_count`
- `last_messenger_sync_imported_outbound_count`
- `last_messenger_sync_imported_media_count`
- `last_messenger_sync_skipped_count`
- `last_messenger_sync_error`
- `last_messenger_sync_outbound_at`
- `messenger_sync_continuation_after`
- `messenger_sync_continuation_started_at`
- `oauth_login_type`
- `external_account_type`
- `token_expires_at`
- `permissions_verified_at`
- `analytics_enabled`
- `created_at`
- `updated_at`

RLS-Erwartung:

- Nach dem kontrollierten Member-Boundary-Apply dürfen nur Workspace-Owner
  oder Admins `social_connections` lesen; normale Member-Browserzugriffe
  erhalten dann keine Connector-Zeile. Owner-Browserzugriffe sind anschließend
  auf die dokumentierten nicht geheimen Statusspalten read-only begrenzt.
- Nach demselben Apply ist `page_access_token_encrypted` verschlüsselt und nur
  über Service Role les-/schreibbar; Browser erhalten dann ausschließlich
  sichere Statusspalten. Bis zum Apply bleibt diese direkte Browser-ACL-Grenze
  ein dokumentierter Go-live-Blocker.
- `messenger_sync_continuation_after` und
  `messenger_sync_continuation_started_at` bilden einen server-only
  Fortsetzungszustand: beide sind gemeinsam leer oder gesetzt und besitzen
  keine Browser-Spaltenrechte. Die Migration
  `20260811220000_meta_conversation_sync_continuation.sql` ist im isolierten
  Staging installiert und read-only nachgeprüft, aber nicht in Production
  angewendet. Sie darf im Staging nicht erneut angewendet werden; Acceptance,
  Aktivierung und realer Meta-Test bleiben getrennt offen.
- Aktive `(platform, external_account_id)`-Bindungen sind global eindeutig,
  damit ein externes Konto nicht zwei Workspaces zugeordnet werden kann.
- Der vorbereitete WhatsApp-Cloud-Inbound-Pfad benötigt zusätzlich die nicht
  angewendete Controlled Migration
  `20260817230000_whatsapp_cloud_inbound_foundation.sql`. Sie erzwingt eine
  global eindeutige aktive `page_id` als exakte `phone_number_id`, ergänzt
  auf Social Connection, `phone_number_id` und WAMID zusammengesetzte
  Nachrichtenidentität sowie die FORCE-RLS-Tabelle
  `whatsapp_cloud_webhook_receipts`. `conversation_messages` erhält dafür die
  server-owned Spalten `whatsapp_social_connection_id`,
  `whatsapp_phone_number_id` und `whatsapp_payload_fingerprint`; direkte
  Browser-Mutationen dieser Identität werden restriktiv blockiert. Der
  SHA-256-Fingerprint rahmt die zwölf exakt normalisierten Eventfelder mit
  ihrer UTF-8-Bytelänge. Ein Retry derselben Identity mit verändertem Text,
  Absender, Label, Thread oder Zeitstempel ist deshalb kein Duplikat, sondern
  ein HTTP-409-`idempotency_conflict`.
- WhatsApp-Kontakt-Handle und externe Thread-ID werden zusätzlich mit der
  konkreten Social-Connection-ID gebunden. Dadurch kann eine wiederverwendete
  Telefonnummer oder neu angelegte Connection keine bestehende Kontakt- oder
  Conversation-Zeile einer anderen Connection übernehmen.
- Der Receipt-Fremdschlüssel auf die CRM-Nachricht verwendet
  `ON DELETE SET NULL (conversation_message_id)`: nach fachlicher
  Nachrichtenlöschung bleiben Connection, `phone_number_id`, WAMID und
  Fingerprint als Anti-Resurrection-Tombstone erhalten. Workspace- oder
  Connection-Löschung cascadiert den Receipt. Frist, Löschlauf und externe
  Legal-/Retention-Freigabe sind vor realem Pilotbetrieb noch festzulegen.
  Direkte Tabellenrechte bleiben für Browser und Service Role entzogen;
  ausschließlich die service-role-only Claim-/Atomic-Store-/Disconnect-RPCs
  dürfen den Zustand verändern.
- OAuth, Callback und Trennung verlangen Owner-/Admin-Rolle; bei mehreren
  verwalteten Seiten ist eine ausdrückliche Auswahl Pflicht.
- Keine externen Login-Passwörter speichern.
- Nicht als allgemein live verkaufen, solange nicht validiert.

### `meta_webhook_events`

Zweck: Debug-/Audit-/Ingestion-Ereignisse für Meta-Webhooks.

Wichtige Felder:

- `id`
- `workspace_id`
- `social_connection_id`
- `platform`
- `source`
- `event_type`
- `page_id`
- `sender_id`
- `recipient_id`
- `text`
- `message_text`
- `raw_payload`
- `status`
- `error_reason`
- `message_id`
- `received_at`
- `created_at`

RLS-Erwartung:

- Webhook-Inserts serverseitig.
- Lesen nur eigener Workspace/Admin.
- `raw_payload` kann sensible Kontextdaten enthalten und darf nicht öffentlich sichtbar sein.

### `meta_conversation_catchup_jobs` (auf Staging angewendet)

Zweck: langlebige, gezielte Facebook-/Instagram-Conversation-Nachholarbeit
außerhalb des Webhook-Requests.

Wichtige Felder:

- `workspace_id`, `social_connection_id`, `platform`, `fan_sender_id`
- `contact_id`
- `status` (`pending`, `claimed`, `retry`, `succeeded`, `dead_letter`, `cancelled`)
- `attempt_count`, `generation`, `claimed_generation`
- `available_at`, `worker_id`, `lease_token`, `lease_until`
- `last_error_code`, `created_at`, `updated_at`, `finished_at`

RLS-/Privilege-Erwartung:

- Workspace und Connection sowie optionaler Kontakt sind über zusammengesetzte
  Fremdschlüssel mandantengebunden.
- RLS und `FORCE ROW LEVEL SECURITY` sind aktiv; Browserrollen besitzen keine
  Tabellen- oder RPC-Rechte.
- `service_role` darf die Tabelle direkt nur lesen und ausschließlich die drei
  `SECURITY DEFINER`-RPCs zum Enqueue/Coalescing, Claim und Finish ausführen.
- Ein partieller eindeutiger Index erlaubt je Workspace/Connection/Plattform/
  Thread höchstens einen offenen Auftrag. `FOR UPDATE SKIP LOCKED`, Lease-Token
  und Worker-ID verhindern gleichzeitige Claims derselben Zeile.
- Der Schritt liegt checksum-gebunden unter
  `supabase/controlled/20260811230000_meta_conversation_catchup_queue.sql`.
  Er ist im isolierten Staging installiert und read-only nachgeprüft, aber nicht
  in Production angewendet; im Staging darf er nicht erneut angewendet werden.
  Kein normaler Web-Deploy entdeckt ihn. Rollback-only Acceptance,
  Worker-/Webhook-E2E, Aktivierung und Rollback folgen
  `docs/operations/META_CATCHUP_QUEUE.md`.

## 8. Billing-Grundlagen

Billing-Felder liegen aktuell primär auf `workspaces`.

Aktiv verwendete Logik:

- `Pilot / Setup = 990 € einmalig`
- `Starter Flex = 990 € Setup + 312 €/Monat`
- `Starter 12 Monate = 0 € Setup + 312 €/Monat`
- Stripe Checkout / SEPA Setup, sofern ENV vollständig gesetzt ist
- Demo-User dürfen Checkout nicht starten
- Growth/Agency nicht produktiv buchbar

RLS-/Security-Erwartung:

- Normale User dürfen Billing-Felder nicht beliebig ändern.
- Admin-Änderungen nur über admin-only Routen.
- Kostenfreie interne Testzugänge nutzen eine admin-only Markierung auf `workspaces` (`billing_status = demo_free`, `billing_manual_override = true`, `billing_admin_note` enthält „Interner Testzugang“) und serverseitige `test_access_flags` (`admin`, `demo`, `internal`, `test`, `billing_disabled`, `mail_confirmed`, `no_expiry`, `ai_maintenance`). Normale Kunden behalten den Default `{}` und werden davon nicht beeinflusst.
- Das interne Stripe-Live-Testabo nutzt dieselben Billing-Felder mit `commercial_option = internal_daily_test`, `STRIPE_PRICE_INTERNAL_DAILY_TEST` und Stripe-Webhook-Updates für Checkout-Session, Subscription, letzte Zahlung und Rechnungsstatus. Ein im Adminbereich gestarteter Lauf setzt zusätzlich `test_access_flags.stripe_live_daily_test = true`. Das Abo ist im Normalbetrieb admin-only; ausnahmsweise ist die öffentliche Registrierung ausschließlich innerhalb einer serverseitig erzwungenen, vom Admin gestarteten Freigabe von höchstens 24 Stunden, nach dem getrennt abgenommenen Daily-Provisioning-Rollout und bei vollständiger Stripe-/Webhook-Konfiguration möglich. Der Tarif kostet 1 € pro Tag, ist kündbar/deaktivierbar und löst keine Referral- oder Rabatt-Automation aus.
- Stripe-Webhooks müssen Signatur prüfen.
- Vor jedem Stripe-Billing-PATCH wird das Workspace-Ziel per Service Role
  gegen eine temporäre Demo-Session und die feste Sandra-Auth-Identität
  geprüft. Diese beiden serverseitigen Identitäten blockieren Demo-Ziele
  unabhängig von Stripe-Referenz oder direkter Objekt-Metadaten-ID;
  owner-veränderbare Status-, Commercial- und Testflag-Felder sind vor dem
  kontrollierten Spalten-Contract kein alleiniger Ablehnungsgrund.
- Stripe-Referenz-, Guard-, Auth-, Session- und PATCH-Infrastrukturfehler
  werden nicht wie „nicht gefunden“ oder ein Demo-Block bestätigt, sondern
  lösen einen Stripe-Retry aus. Nur erfolgreiche Nulltreffer aller vorhandenen
  Referenzen gelten als nicht zugeordnet; doppelte Referenzzeilen oder
  widersprüchliche Customer-/Subscription-/Payment-Intent-Ziele lösen
  ebenfalls einen Retry aus. Erst ein PATCH mit exakt einer zurückgegebenen
  erwarteten Workspace-ID darf die Referral-Synchronisierung starten; ein
  Nullzeilen-Update startet sie nur dann nicht erneut, wenn eine nachgelagerte
  Service-Role-Abfrage exakt `manual_suspended` bestätigt. Fehlende Zeile,
  `NULL`, anderer Status und Lesefehler bleiben retryable.
- Stripe-IDs nicht unnötig im Client anzeigen.
- Das noch nicht angewendete kontrollierte KI-Event-Ledger erweitert
  `workspace_ai_tier_entitlements` um `stripe_sync_state` und
  `stripe_sync_revision`. Seine Event- und Reconciliation-Tabellen sind
  service-role-only; Entitlement-Writes laufen danach ausschließlich über
  zwei atomare RPCs. Gleiche Stripe-Sekunden werden nicht nach Event-ID
  sortiert, sondern dauerhaft `reconciliation_needed` und im Loader
  fail-closed. Die Reconciliation-Quittung bindet die vorherige und die
  kanonische Basis-Subscription und speichert
  `snapshot_event_created_cutoff`; Event-Ingest berücksichtigt diese Grenze
  auch dann, wenn für einen Starter-only-Snapshot keine Entitlement-Zeile
  existiert. Das allgemeine Basis-Billing auf `workspaces` besitzt ein
  kontrolliertes, noch nicht angewendetes, standardmäßig dormantes und alle
  mutierenden Eventtypen umfassendes Ledger; der externe Cutover bleibt offen.
  Das kontrollierte SQL würde die Forced-RLS-Tabellen
  `workspace_stripe_billing_events`, `workspace_stripe_billing_streams`,
  `workspace_stripe_billing_object_bindings` und
  `workspace_stripe_billing_reconciliations` sowie ausschließlich
  service-role-ausführbare Apply-/Canonical-RPCs anlegen. Diese Objekte gehören
  bis zum getrennten Apply ausdrücklich **nicht** zum angewendeten Schema. Ein
  zusätzlicher owner-only Schema-Verifier prüft sie innerhalb des Apply und
  anschließend, bytegenau an das Control gebunden, erneut read-only.

## 9. KI-Usage-Tabelle

`ai_usage_events` ist das aktive serverseitige Kosten-/Usage-Observability-Log für KI-Aufrufe. Es speichert keine Prompt- oder Antwortvolltexte, sondern nur Zähler, Modell, Feature, Status und geschätzte Kosten. Die bestehenden `estimated_*_tokens`-Spalten enthalten bei vollständiger und konsistenter OpenAI-Responses-Usage die echten Provider-Zähler; bei fehlender oder ungültiger Usage bleiben sie die begrenzte Zeichenlängen-Schätzung. Die Spaltennamen bleiben aus Kompatibilitätsgründen bestehen.

Spalten:

- `id`
- `workspace_id`
- `user_id`
- `contact_id`
- `feature` (`reply_suggestions`, `fan_analysis`, `summary`, ...)
- `model`
- `provider`
- `input_chars`
- `output_chars`
- `estimated_input_tokens`
- `estimated_output_tokens`
- `estimated_total_tokens`
- `estimated_cost_cents`
- `currency`
- `status` (`ok`, `error`, `skipped`)
- `error_code`
- `latency_ms`
- `source_route`
- `created_at`

RLS-Erwartung:

- Workspace-Mitglieder sehen nur Usage ihres eigenen Workspace.
- Inserts laufen serverseitig; der Helper nutzt Service Role, damit Logging nicht am User-Token hängt.
- Admin-Aggregation läuft ausschließlich nach `requirePlatformAdmin()` über serverseitige Service-Role-Abfragen.
- Normale User sehen keine anderen Workspaces.

### Mobile Push Registrations

`supabase/migrations/20260729120000_mobile_push_registrations.sql` bereitet
eine service-role-only Tabelle für genau eine aktive Beta-Geräteregistrierung
pro Auth-Nutzer vor:

- `user_id` und `workspace_id` sind kaskadierend an Auth-Nutzer und Workspace
  gebunden;
- `expo_token_ciphertext` enthält ausschließlich AES-256-GCM-Ciphertext;
- `expo_token_hash` ist ein keyed HMAC für Eindeutigkeit und Konfliktschutz;
- `platform` ist auf `android` oder `ios` begrenzt;
- `expires_at` liegt höchstens 31 Tage nach `last_seen_at`;
- `anon` und `authenticated` besitzen keinerlei Tabellenrechte;
- Löschung des Auth-Nutzers oder Workspace entfernt die Registrierung
  kaskadierend.

Der normale Web-Deploy wendet diese Migration nicht an. Ohne getrennte
Migration, `FANMIND_PUSH_TOKEN_ENCRYPTION_KEY`, serverseitig gebundene
`FANMIND_MOBILE_PUSH_EAS_PROJECT_ID`, signierten Build und reale Geräteabnahme
bleibt die Registrierung nicht verfügbar. Service-Abfragen binden Status und
Widerruf an `user_id` plus aktuell autorisierte `workspace_id`; eine neue
Registrierung ersetzt die höchstens eine alte User-Bindung. Die Migration
enthält keinen Versandjob; serverseitige Follow-up-Zustellung bleibt separat
deaktiviert.

Der vorbereitete Apply ist SHA-256-festgeschrieben und ausschließlich über
den getrennten Staging-Pfad in
`docs/operations/MOBILE_PUSH_STAGING_CONTROL.md` zulässig. Read-only
Ressourcencheck, Migration und rollback-only Acceptance besitzen getrennte
Bestätigungen, sind an `main`, den geprüften exakten Commit und das geschützte
`staging`-Environment gebunden und vergleichen API-, Supabase- und DB-Ziel mit
Production. Die Acceptance prüft Browser-Verweigerung sowie service-role CRUD
mit synthetischen Nicht-Demo-Owner/-Member/-Gerätewerten und muss vollständigen
Rollback und Cleanup belegen. Dieser Pfad wurde noch nicht extern ausgeführt.

## 10. Migrations- und Reader-Regel

Wenn Tabellen, Spalten oder RLS-Policies geändert werden:

1. Migration unter `supabase/migrations/` ergänzen.
2. `src/lib/supabase/server.ts` Typen/Columns anpassen.
3. `docs/database/fanmind_current_schema.md` aktualisieren.
4. `docs/SECURITY_RLS_SECRETS_CHECK.md` prüfen.
5. README und `docs/SOURCE_OF_TRUTH.md` nur anpassen, wenn sich Produktwahrheit oder Demo-/Billing-/Integrationslogik ändert.

Workspace-RPC und Spaltenrechte werden gemäß
`docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md` deploy-before-migrate als
Expand-/Contract-Rollout ausgerollt. Der kompatible App-Brückenstand setzt
keine Step-A-Spalte voraus und wiederholt nur einen exakt daran gescheiterten
Insert mit dem älteren kommerziellen Core. Der Contract-Schritt liegt
außerhalb `supabase/migrations`; ein Web-Deploy oder generisches
`supabase db push` wendet ihn nicht an.

## 11. Bekannte Altlast

`docs/database/fanmind_mvp_schema.sql` enthält historische Aussagen wie „Kontakte, Messages, Memories, Follow-ups und KI-Ausgaben bleiben spätere Tabellen“. Das ist nicht mehr der aktuelle Stand. Diese Datei bleibt nur als Auth-Basis-Snapshot erhalten und verweist künftig auf dieses Dokument.

## 12. Referral Growth Window (admin-only foundation)

Issue #442 ist bewusst als Admin-Grundlage umgesetzt, nicht als öffentliche Rabattfunktion.

Neue Tabellen aus `supabase/migrations/20260706143000_referral_program_admin_foundation.sql`:

- `referral_program_state`: globaler Programmstatus mit `status in ('open','closing','closed','reopened')`, `active_paid_workspace_cap` und `active_paid_workspace_count` als globale Cap-Größe. Standard-Cap ist `2.000` aktive zahlende Workspaces/Kunden.
- `referral_program_members`: berechtigte/referrende Workspaces mit Referral-Code, Teilnahme-/Prüfstatus, Admin-Notiz und manuellen Override-Feldern für aktive Referrals oder Rabattprozent.
- `referrals`: einzelne Zuordnungen zwischen Referrer-Workspace und geworbenem Workspace mit Status `pending`, `qualified`, `active`, `inactive`, `rejected` oder `locked_after_window_closed`.
- `referral_discount_snapshots`: vorbereitete Rabatt-Snapshots mit aktiver Referral-Zahl, Prozentwert und monatlichen Beträgen vor/nach Rabatt. Diese Snapshots sind noch keine aktive Billing-Verrechnung.

RLS/Scope:

- RLS ist für alle vier Referral-Tabellen aktiviert.
- Es gibt im ersten Schritt bewusst keine öffentlichen `authenticated` Policies. Die Adminübersicht nutzt serverseitige Service-Role-Abfragen nach `requirePlatformAdmin()`.
- Normale Nutzer dürfen Referral-Ökonomie, fremde Codes und Rabatt-Snapshots nicht sehen oder verändern.
- Signup-/Checkout-Attribution, Nutzerdashboard, automatische Snapshot-Erzeugung und Billing-Verrechnung sind separate Schritte.
- AGB/Zahlungsbedingungen, Missbrauchsschutz und steuerliche Prüfung müssen vor öffentlicher Aktivierung ergänzt werden.


### Phase 2 Ergänzungen (20260707120000)

Die Migration `20260707120000_referral_growth_window_phase_2.sql` ergänzt eindeutige Workspace-/Referred-Workspace-Indizes für Referral-Mitglieder und Attributionen sowie Update-Trigger/Kommentare. Die App nutzt serverseitige Service-Role-Zugriffe, um berechtigten Workspaces den eigenen Referral-Code/Link anzuzeigen und Signup-Attributionen zu speichern. Normale Nutzer erhalten weiterhin keinen Zugriff auf fremde Referral-Ökonomie; Rabattwerte sind vorbereitete Statuswerte und werden nicht automatisch mit Billing verrechnet.

Die additive Integritätsmigration
`20260814230000_referral_attribution_integrity.sql` macht die erste gültige
Workspace-Attribution über einen regulären, PostgREST-inferierbaren
Unique-Index eindeutig, validiert den User-Self-Referral-Check und sperrt die
nachträgliche Änderung der Attributionsidentitäten über eine gehärtete
Triggerfunktion. Ihr Staging-Apply ist kein Web-Deploy-Schritt, sondern folgt
dem getrennten checksum- und commitgebundenen Pfad in
`docs/operations/REFERRAL_ATTRIBUTION_STAGING.md`. Billing bleibt dabei aus.


## 13. Datenschutzsparsame Serverfehler-Telemetrie

Migration: `supabase/migrations/20260718203000_privacy_server_error_tracking.sql`

### `server_error_events`

Zweck: minimale technische Einzelereignisse für unerwartete serverseitige Next.js-Fehler.

Gespeicherte Felder:

- `id`
- `created_at`
- `fingerprint` als SHA-256
- optionaler, formatgeprüfter Next.js-`digest`
- `route_path` ausschließlich als Route-Schablone oder `/unknown`
- `route_type`
- `router_kind`
- `http_method`
- `environment`
- `release_commit`

Ausdrücklich nicht vorhanden:

- Fehlermeldung oder Stack
- Request-/Response-Body
- Header, Cookies, Query-Parameter oder IP-Adresse
- Kontakt-, Nachrichten-, Prompt-, KI- oder Zahlungsinhalte

RLS/Scope:

- RLS ist aktiviert.
- `PUBLIC`, `anon` und `authenticated` haben keine Tabellenrechte.
- Inserts erfolgen ausschließlich über die service-role-only RPC `record_server_error_event(...)`.
- Einzelereignisse werden über `cleanup_server_error_events(...)` zeitlich begrenzt bereinigt; die RPC ist ebenfalls service-role-only.

### `server_error_groups`

Zweck: Aggregation identischer technischer Fehlergruppen und Alarm-Cooldown.

Gespeicherte Felder:

- `fingerprint`
- `first_seen_at`
- `last_seen_at`
- `occurrence_count`
- optionaler `digest`
- Route-Schablone, Route-Typ, Router-Art und HTTP-Methode
- Umgebung und letzter Release-Commit
- Status, Auflösungszeitpunkt und letzte Alarmstufe

RLS/Scope:

- RLS ist aktiviert.
- Keine Browserrolle erhält Tabellen- oder RPC-Zugriff.
- Platform-Admins lesen aggregierte Gruppen ausschließlich serverseitig nach `requirePlatformAdmin()` über Service Role.
- Admin-Meldungen enthalten nur generische Texte und eine verkürzte Fingerprint-Referenz; keine Route, Fehlermeldung oder Stackdaten.

### RPCs

- `record_server_error_event(...)`: validiert alle Metadaten, schreibt Ereignis und Gruppe atomar, berechnet das 10-Minuten-Fenster und erzeugt höchstens eine aktive Admin-Meldung je Fingerprint. Ausführung ausschließlich `service_role`.
- `cleanup_server_error_events(integer)`: löscht minimale Einzelereignisse nach 7 bis 365 Tagen. Ausführung ausschließlich `service_role`.

Aktivierung:

- Code bleibt ohne `FANMIND_SERVER_ERROR_TRACKING_ENABLED=true` inaktiv.
- Kritische E-Mails bleiben zusätzlich über `FANMIND_SERVER_ERROR_EMAIL_ENABLED=false` gesperrt, bis ein kontrollierter Test abgeschlossen ist.
