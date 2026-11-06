# Social-Intake-Standard

## Referenz

Facebook Messenger ist der Referenzstandard für den Social Intake. Der implementierte Beta-Stand importiert inbound Text-DMs, inbound Bild-DMs und outbound Page-Antworten aus dem Messenger-Verlauf-Sync. Kein Social-Kanal ist allgemein live, solange reale Staging-/Meta-Kontotests, Provider-Freigaben und die rechtliche Aktivierung fehlen. Es gibt keine automatische Sendefunktion und keine automatische Antwort.

## Standardfelder für Nachrichten

Alle Kanäle sollen `conversation_messages` mit denselben Kernfeldern verwenden:

- `direction`: `inbound` oder `outbound`
- `content`
- `message_kind`: `text`, `image`, `video`, `audio`, `file`, `mixed`, `unknown`
- `attachments`
- `source_platform`, `source_type`, `source_url`, `reply_target_url`
- `external_thread_id`, `external_message_id`, `external_post_id`, `external_video_id` sofern kanalabhängig vorhanden, `external_comment_id`
- `original_author_label`, `original_text_excerpt`
- `seen_at`

Facebook-spezifische IDs bleiben erhalten; neue Kanäle mappen auf dieselben generischen Felder, statt eigene UI-Sondermodelle aufzubauen.

## Inbound, outbound und unread

- Dashboard „Neue Nachrichten“ zeigt nur ungesehene inbound Nachrichten.
- Fans-Liste/blauer Punkt basiert nur auf ungesehenen inbound Nachrichten.
- Fan-Detail zeigt inbound und outbound im gemeinsamen Verlauf.
- Outbound aus Syncs erzeugt keinen neuen Dashboard-Eintrag und keinen blauen Punkt.
- Antworten bleiben Copy-&-Open/manuell im Originalkanal.

## Medien und Attachments

Die gemeinsame Attachment-Logik normalisiert Metadaten und sichere HTTP(S)-URLs. Unterstützte Typen sind `image`, `video`, `audio`, `file`, `mixed`, `unknown`. Die UI zeigt kompakte Bild-Thumbnails und Fallbacks für Video/Audio/File, ohne bei fehlender URL abzustürzen. Keine Bildanalyse, keine Downloads und keine Storage-Architektur in diesem Standard-PR.

## Sync-Zählung

Kanal-Syncs liefern ein einheitliches Ergebnis:

- `checkedConversations`
- `checkedMessages`
- `importedInbound`
- `importedOutbound`
- `importedMedia`
- `skippedDuplicates`
- `errors`
- `syncLimit`
- `lastSyncAt`

Facebook Messenger und Instagram Professional DMs laden beim ersten Abgleich höchstens 150 aktuelle Nachrichten je Conversation. Danach werden nur neue Ereignisse mit kleinem Sicherheitsüberlapp abgerufen und über externe IDs dedupliziert. Vorbereitete Kanäle zeigen keine Fake-Zahlen; wenn kein echter Sync existiert, steht im Status „vorbereitet“, „nicht verfügbar“ oder „API-/Freigabe erforderlich“.

Der verbindungsweite Abgleich verarbeitet pro Ausführung innerhalb eines festen
45-Sekunden-Zeitbudgets höchstens eine auf 25 Conversations begrenzte
Provider-Seite. Liefert Meta eine Folgeseite, speichert
FanMind ausschließlich serverseitig den validierten `after`-Cursor und den
Start des ursprünglichen Intervalls. `last_messenger_sync_at` bleibt bis zur
vollständigen Erschöpfung aller Seiten unverändert und wird erst dann auf den
ursprünglichen Intervallstart gesetzt. Fehler erhalten die bestehende
Fortsetzung unverändert; ein Wiederholungslauf darf dieselbe Seite dank
externer Nachrichten-ID idempotent erneut verarbeiten. Provider-URLs, Tokens,
Conversation-IDs und Nachrichteninhalte gehören nicht in Diagnoseprotokolle.

Ein gezielter Catch-up aus einem Webhook darf nur den betroffenen Fan-Thread ergänzen. Der Webhook-Request selbst ruft weder das Meta-Profil noch die Conversation-Historie ab. Nach idempotenter Nachrichtenspeicherung darf er bei ausdrücklich aktiviertem Queue-Flag nur einen workspace-, connection-, plattform- und thread-gebundenen Auftrag atomar anlegen oder mit einem offenen Auftrag bündeln. Ein getrenner service-role-Worker beansprucht genau einen Auftrag per Lease, wiederholt höchstens fünfmal mit Backoff und setzt danach `dead_letter`; eine während der Verarbeitung neu eingetroffene Generation wird nicht verloren. Bei Trennung oder abgelaufenem Verarbeitungsanspruch wird fail-closed beendet, bestehende Daten bleiben lesbar. Queue und Worker schreiben weder den verbindungsweiten Erfolgs-/Fehlerstatus noch `last_messenger_sync_at`; nur ein vollständig verbindungsweiter Sync darf diesen globalen Cursor fortschreiben. Tokens, Body, Profile, Paging-URLs, Provider- oder Thread-IDs werden nicht protokolliert.

Vor jedem Meta-Webhook-Ingress und vor jedem manuellen Facebook-/Instagram-Sync prüft ein ausschließlich serverseitiger Service-Role-Resolver den Verarbeitungsanspruch des Workspaces. Archivierte oder vertraglich beendete Workspaces, abgelaufene Zahlungsfristen sowie unbekannte oder fehlerhafte Zustände werden fail-closed blockiert; bestehende CRM-Historie bleibt unverändert lesbar. Zeitlich begrenzte Verarbeitungsfreigaben benötigen ein explizites Ablaufdatum.

## Kanalstatus

Die zentrale Konfiguration in `src/lib/channelSources.ts` beschreibt pro Kanal Fähigkeiten und Status. Mindeststand:

- `facebook_messages`: implementiert/Beta, inbound/outbound/media/history-sync, 150er Erstabruf und danach inkrementell; isoliertes Schema angewendet, realer Staging-/Meta-Kontotest und Provider-Freigaben offen; nicht allgemein live und kein automatisches Senden.
- `facebook_comments`: geparkt/vorbereitet, kein Live-Test in diesem PR.
- `instagram_messages`: implementiert/Beta, inbound/outbound/history-sync, 150er Erstabruf und danach inkrementell; isoliertes Schema angewendet, echter Staging-/Meta-Kontotest und Provider-Freigaben offen; nicht allgemein live und kein automatisches Senden.
- `instagram_comments`: vorbereitet, API-/Freigabe erforderlich.
- `whatsapp_messages`: kontrollierter offizieller Inbound-Textpfad mit
  getrennter HMAC-/Verify-Token-Prüfung, exakter Phone-ID-Tenant-Bindung und
  atomarem Receipt-/CRM-Store vorbereitet; Flag und Production bleiben aus,
  Controlled Migration, reales Staging-/Meta-Konto, Provider-/Legal-Freigaben
  und Cleanup-Abnahme sind offen; kein Outbound.
- `tiktok_comments`: vorbereitet, offizielle Freigabe erforderlich, kein Scraping.
- `tiktok_messages`: nicht-live, Export/Data-Portability-Importpfad.
- `email`, `webform`, `manual`: vorbereitet/manuell ohne Fake-Live-Sync.

## Regression-Checkpoint Facebook

Vor Änderungen an Intake oder UI prüfen:

1. inbound Text-DM wird gespeichert.
2. inbound Bild-DM wird mit Attachment sichtbar.
3. outbound Page-Antwort wird über Messenger-Verlauf-Sync importiert.
4. Erster Sync liest bis zu 150 aktuelle Nachrichten je Conversation; Folgesyncs nur neue Ereignisse.
5. 26 oder mehr Conversations werden über begrenzte Fortsetzungsläufe ohne vorzeitiges Fortschreiben von `last_messenger_sync_at` vollständig erreicht.
6. Deduplikation über externe IDs bleibt bei Wiederholung einer unvollständigen Seite aktiv.
7. Der Webhook antwortet ohne Graph-Historienaufruf; doppelte Ereignisse ergeben höchstens einen offenen Catch-up-Auftrag.
8. Gleichzeitige Worker erhalten unterschiedliche Leases; Fehler landen nach fünf Versuchen im Dead Letter, und ein Neustart übernimmt abgelaufene Leases.
9. Vertragsende/Archivierung verhindert den Hintergrundabruf, ohne die bestehende Historie zu löschen.
10. Dashboard/Fans-Unread zählen nur inbound ungesehen.
11. Fan-Detail zeigt Richtung, Kanal, Ursprung und Medien korrekt.
