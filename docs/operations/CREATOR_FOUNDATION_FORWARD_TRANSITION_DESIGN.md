# Creator Foundation: begrenzter Forward-Übergang

Stand 2026-09-27. **PROFIL-/DESIGN-SOURCE ACCEPTED; ÜBERGANGSGENERATOR IN_PROGRESS AUF EXACT BASE `a165f3c074e8e0eb2b24ea3882a3fd57db011939`; TARGET-AUSFÜHRUNG BLOCKIERT.** Dieses Dokument plant einen neuen Übergang. Es führt kein SQL aus, ändert keine Zielkonfiguration und ersetzt keine Targetabnahme. Die konsumierten Foundation-Apply-/PT409-Upgrade-Actions bleiben konsumiert. Ein generischer `--apply`-Pfad wird weder benutzt noch entsperrt.

## Nachgewiesener Ausgangspunkt

Einzige zugrunde gelegte Staging-Katalogbeobachtung: `2026-09-26T18:24:28.937033+00:00`; privat gesicherter Katalog, SHA256 `c004ae7e7feacb2c286cc6cfe53f479b2fe3677663118011ee9deaed8ca651bc`.

Der Offline-Vergleich aller sieben **Creator-Kernsektionen** (`tables`, `columns`, `constraints`, `indexes`, `policies`, `triggers`, `functions`) ist vollständig gleich der isolierten Legacy-Referenz. Gegenüber Current unterscheiden sich nur `functions` und `policies`. Das ist ein Vergleichsergebnis, **kein `LEGACY_EXACT`-Targeturteil**: Der tatsächliche Classifier bleibt `INCOMPLETE` mit `reference_pin_missing` und `auth_uid_provider_contract_missing`.

Isolierte Referenzen: `legacy.json`, `current.json` und `manifest.json` aus CI `36261538537/1`, Job `108458188956`, Artefakt `10912722295`. Geprüfter PR-Head `092e89ebb9757af2046f174796282bb237ddadd8`; tatsächlicher CI-Merge-Checkout `f8d6083423bba16794896e64f6922f666debbee2`. Source ist über PR #1204 zusammengeführt. Der Native-Test bestätigt 6 Parent-/Dependency-Tabellen, 144 Spalten, 22 Policies, 7 Parent-Helper und 5 User-Trigger. Diese Referenz ist keine genehmigte Hosted-Rollenvorlage.

PR #1207 hat die drei zuvor offenen Profilbeweise als Repository-Source akzeptiert: originaler `auth.uid()`-Ersteller/Ownertransfer, Daily-Parentprofil ohne optionalen Billing-Check und vollständiges Hosted-PG17-Rollen-/Membership-Profil. Geprüfter Source-Head `3cd67cedbcdc051be855d09de8d5ea3225179217`; tatsächlicher CI-Checkout `b323361cafc3829e470f6da611c7ab7d8c8664f6`; Referenzartefakt `10916053961`, Manifest-SHA256 `f21e3fbdb01fe136e3a1b3924e86f6982423cfca57f3e845baf037e89a6d87bb`. Der daraus deterministisch gebildete, unabhängig akzeptierte Referenz-JSON-Hash ist `0543eacab3872c71ec289100d62204fb2fd1660be242b14ae55bf007701b456c`; ein caller-supplied Hash desselben Inputs ist kein Trust Root. Der begrenzte Übergangsgenerator und seine nativen Rollback-/Datenerhaltbeweise werden in PR #1209 umgesetzt und sind bis grüner Exact-Head-CI/Review nicht akzeptiert.

## Unveränderliche SQL-Herkunft

Repository-relative Dateien; die spätere Implementierung prüft Bytes und Pins vor jeder Planung:

| Quelle | SHA256 | Zweck |
|---|---|---|
| `scripts/operations/creator-foundation-reconciliation-artifacts/legacy-foundation.sql` | `8065596853f07feffd419ac1473a34fe727a6152f1f742161af16a909d2f457f` | Akzeptierte historische Foundation aus `f0c7a84e6105752d34b489520fb92d2bb7e5b61a` |
| `scripts/operations/creator-foundation-reconciliation-artifacts/legacy-pt409.sql` | `7e1111357bf1b210023fe43913d11247f3fe6eea32d1a7440b8079d988e671ee` | Tatsächlicher Legacy-RPC-Stand einschließlich PT409 |
| `supabase/controlled/creator_intelligence_foundation.sql` | `d892c74c0285487f1e786dddea90cbc5cb3102f794de0b5037e48295d2a61f4b` | Exakte vier aktuellen Policy-Prädikate und Current-Gesamtvertrag |
| `supabase/controlled/creator_revision_conflict_fix.sql` | `d3e984bfd7ef240c63d0e47431d25ca9f21a18d0287b25375830a1a721d88e3f` | Originaldefinitionen für Access-Helper und beide aktuellen RPCs |

Die vorhandenen `CREATOR_FOUNDATION_SOURCE_PINS` enthalten zusätzlich die Git-Blob-IDs. Die Übergangsquelle wird daraus erzeugt, als eigenes begrenztes Source-Artefakt geprüft und unabhängig gepinnt. Ganze Foundation-DDL wird nicht erneut abgespielt. `buildCreatorConflictUpgrade()` ist ungeeignet: historischer konsumierter, als function-only/empty-foundation definierter Ablauf; die vier veränderten Policies fehlen dort.

## Exakter Änderungsumfang

1. `public.creator_workspace_access_allowed(uuid)` neu anlegen, Originaldefinition und explizites Revoke/Grant aus Current-PT409-Quelle. Owner `postgres`, PL/pgSQL, STABLE, SECURITY DEFINER, `search_path=''`; Direkte EXECUTE-ACL ausschließlich für Owner, `authenticated`, `service_role`, jeweils ohne explizite Grant Option; inhärente Ownerrechte und mittelbare Providerrollen bleiben Teil des separat zu prüfenden vollständigen Rollenvertrags. Erwarteter Body-SHA256: `fa8ce664ee6442fb6349f60290f988bb073fc047f03fb3cf49df10191c5571cd`.
2. `public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean)` durch die exakte Current-PT409-Definition ersetzen. Body vorher `a737238da30e091d75a455386389eb730f60fc19d89743dae5f7e2ed48f0d6fc`, danach `f9d8702899678a36d1c876382e524b112ee309a06eb1f72036100c74208a30e8`.
3. `public.record_creator_fan_review(uuid,uuid,jsonb,jsonb)` entsprechend ersetzen. Body vorher `70f0cf915ee3f75bfdb5b681a76b0551a8113fadd8673c0117cb79ce856e9549`, danach `8b92c5b80764e45e5376867a4b1a1879f3609000c415430598b6af04625cac25`.
4. Nur das USING-Prädikat der vier vorhandenen Policies `<table>_member_read` per `ALTER POLICY ... USING (...)` ersetzen: `creators`, `creator_voice_profiles`, `creator_sales_playbooks`, `creator_commercial_events`. Exaktes Prädikat aus dem gepinnten Foundation-Template: bestehende Member-/Owner-Bedingung **und** `public.creator_workspace_access_allowed(<table>.workspace_id)`. Name, SELECT-Command, Rolle `authenticated`, Permissiveness und WITH CHECK bleiben exakt gleich.

Bei beiden RPCs unterscheiden sich heute ausschließlich die Body-Hashes. CREATE OR REPLACE erhält Identität, Owner und ACL; diese werden davor und danach vollständig geprüft. `guard_creator_identity()` bleibt byte-/metadatengleich. Keine Tabellen-, Spalten-, Index-, Trigger-, Daten-, Parent-, Rollen- oder Namespace-Reparaturen gehören zum Übergang. Insbesondere werden weder Workspace-Checks noch `auth.uid()`-ACLs verändert, um einen Test grün zu machen.

## Zwingende Vorbedingungen und noch offene Verträge

- Neuer eng benannter Source-/späterer Ausführungsscope mit eigener Action-ID, einmaliger Autorisierung, Lock und Receipt; keine Wiederverwendung konsumierter Actions. Staging-Identität, exakter Review-Head/Tree, Query-/Source-/Referenzpins und Freshness müssen im späteren Ausführungsvertrag gebunden sein.
- **Die unabhängigen Profilinputs sind durch #1207 akzeptiert:** vollständiger Hosted-Rollen-/Membership-/Grantor-Vertrag, Namespace-/Auth-Vertrag, originaler `auth.uid()`-Ersteller/Ownertransfer und Daily-Parentprofil ohne optionalen Billing-Check. Beobachtete Targetwerte bleiben trotzdem keine Allowlist; Generator und Assertions dürfen nur die gepinnten akzeptierten Profile verwenden.
- Parent-Abweichungen sind nun profilseitig erklärt: `workspaces_billing_provider_check` gehört nicht zum akzeptierten Daily-Profil; Commercial-Option- und Payment-Method-Checks stammen aus der gepinnten Daily-Quelle. Ob ein Target dieses Profil tatsächlich erfüllt, bleibt ein späterer geschützter read-only Befund.
- `auth.uid()` stimmt außer einer zusätzlichen expliziten CI-EXECUTE-ACL für `postgres` überein. #1207 reproduziert die ursprüngliche Erstellung als `postgres` vor Ownertransfer und pinnt die Provider-Variante; der Generator muss genau dieses Profil fail-closed prüfen. Kein Target-Grant als Ausweichlösung.
- Die Helper-/RPC-/Policy-Inventare müssen frisch und innerhalb des späteren Transaktionsschutzes exakt Legacy sein. Unbekannte Overloads, zusätzliche Policies/Trigger, falsche Owner/ACLs, Mischzustände oder vorhanden-abweichender Access-Helper blockieren. Ein bereits exakt aktueller Zustand ist ein separater read-only Befund, kein Anlass zum erneuten Übergang.
- `admin_crm_read_allowed(uuid)` ist im beobachteten Katalog abwesend. Dieses begrenzte Übergangsprofil setzt weiterhin dessen Abwesenheit voraus; vorhandenes AdminCRM verlangt eine separat geprüfte Variante. Der neue Helper gibt bei Abwesenheit `true` zurück, lässt aber bestehende Workspace-/Owner-Prüfungen bestehen. Das allein aktiviert keine CRM-Berechtigung.
- Aktuelle Row-Belegung und laufender Creator-Verkehr sind aus diesem Katalog nicht bekannt. Der SQL-Übergang darf keine Produktdaten schreiben. Ob die erste Ausführung konservativ nur leere Creator-Tabellen zulässt oder mit vorhandenen Daten freigegeben wird, muss der begrenzte Ausführungsvertrag entscheiden; vorhandene Daten werden in CI jedenfalls unverändert erhalten getestet.

## Atomarer Ablauf und Recovery

Vor späterer Ausführung: Creator-Schreibzugänge kontrolliert stilllegen, eingehende/queued/in-flight RPCs ausschließen bzw. ablaufen lassen; exakte Methode und Nachweis sind noch zu spezifizieren. Ein Advisory-Lock allein ist kein Schutz gegen fremde Administratoren oder bereits laufende alte Funktionsaufrufe. Kein pauschales Beenden fremder Sessions.

Eine einzige PostgreSQL-Transaktion mit kurzen Lock-/Statement-/Idle-Timeouts und einem dedizierten Advisory-Xact-Lock. Die vier Creator-Tabellen in deterministischer Reihenfolge sperren; unmittelbar vor dem ersten DDL-Schritt den vollständigen freigegebenen Legacy-/Provider-/Parentvertrag unter diesem Schutz frisch vergleichen. Zwischen den Schritten gelten nur die ausdrücklich definierten Zwischenzustände; der bereits veränderte Katalog kann nicht nochmals als exakt Legacy geprüft werden. Keine temporären Referenz-Tabellen/Fakefunktionen auf dem Target: erwartete Katalogverträge stammen aus unabhängig geprüften nativen CI-Artefakten. Die feste Katalog-SELECT-Nutzlast benötigt für diesen Kontext einen separaten, geprüften Assertions-Wrapper; der existierende read-only CLI-Transaktionsrahmen wird nicht als Write-Runner zweckentfremdet.

Innerhalb derselben Transaktion: Helper anlegen und ACL schließen → zwei RPCs ersetzen → vier Policies ändern → vollständigen Current-Vertrag und unveränderte Parent-/Providerverträge prüfen → COMMIT. Erfolg erst nach anschließendem unabhängigem frischem read-only Gegencheck und durablem Receipt/Consumption. Keine Zwischenphase als akzeptierten Zustand ausgeben.

Fehler vor COMMIT müssen alles zurückrollen; Nachweis umfasst Helper-Abwesenheit, Legacy-RPCs/Policies und unveränderte Daten. Bei Verbindungsabbruch um COMMIT ist der Ausgang unbekannt: nur read-only neu feststellen, kein blindes Retry. Nach bestätigtem COMMIT kein automatischer Rückbau auf schwächere Legacy-Regeln. Abweichungen sperren weiteren Fortschritt und benötigen eine eigene begrenzte Recovery-Entscheidung.

## Erforderliche native PG17-Beweise vor Ausführungszulassung

- Gepinnte vollständige Legacy-Replays → Übergang → exakter Current-Kern; alle übrigen Katalogsektionen identisch. Null zusätzliche Objekt-/Grant-/Datenschreiboperationen. Reproduzierbarer Artefaktexport mit Source-/Query-/Provider-/Parentprofil-Pins.
- Jeder Vorbedingungsfehler blockiert ohne DDL: fehlender/abgewandelter Pin oder Hosted-Vertrag, zusätzliche Policy/Overload, falscher RPC-Body/ACL/Owner, unbekannter Rollenpfad, Mischzustand, bereits Current und unerwartetes AdminCRM.
- Fehler gezielt nach Helper, jedem RPC und jedem Policy-Schritt erzwingen: vollständiger Rollback. Zweite Verbindung prüft Sichtbarkeit/Lock-Timeout; ein laufender alter RPC muss durch das bewiesene Quieszenzverfahren ausgeschlossen sein.
- Mit synthetischen gespeicherten Daten: Creator-Revisionen, Voice/Playbook, Events und Parent-Profile bleiben unverändert. Danach Owner-Flow, fremdes Workspace/Member-Denial, direkte Browser-Writes verboten, echte PT409-Konflikte und atomarer Rollback ungültiger Teilupdates. Vorhandene PG17-Tests sind wiederverwendbare Szenarien, kein Nachweis für einen noch nicht implementierten Übergang.
- Optionaler separater Testkontext mit **echter gepinnter** AdminCRM-Implementierung: active/blocked und Direktreads/RPCs prüfen; keine Fake-Allow-Funktion. Dieser Test autorisiert noch keine zusätzliche Targetvariante.

Aktuelle konkrete Source-Arbeit ist `NBA-CREATOR-FOUNDATION-TRANSITION-GENERATOR`: der begrenzte Generator/Assertions-Wrapper aus den durch #1207 akzeptierten Profilen wird mit den oben geforderten nativen Rollback-, Negativ- und Datenerhaltbeweisen umgesetzt. Diese Repository-Arbeit ist **IN_PROGRESS** auf exact base `a165f3c074e8e0eb2b24ea3882a3fd57db011939` unter `LOCK-FM-CREATOR-FOUNDATION-TRANSITION-GENERATOR-20260927`, autonom und braucht keine neue Owner-Freigabe. Sie darf weder Targetwerte lesen noch SQL anwenden. Erst nach unabhängiger Source-Abnahme kann eine getrennt autorisierte Target-Reconciliation folgen; ein erfolgreicher Targetabschluss erlaubt anschließend einen neuen read-only Learning-VERIFY. Learning-Schema, Runtime, Qualitätsabnahme und Creator-Produktabschluss bleiben separate offene Nachweise.

## Gesicherte Evidenz und Lesepfad

Tatsächliche Receipt: `project-memory/receipts/creator-foundation-staging-catalog-observation.json`. Unabhängige, redigierte Diagnose: `project-memory/receipts/creator-foundation-staging-catalog-diagnostic.json`. Die private Evidenzdatei `FanMind-Creator-Staging-Evidence-private-20260926.zip` enthält den unveränderten Katalog, das tatsächliche Classifier-Ergebnis und die isolierten CI-Referenzen; SHA256 `53a58c1ff8377cb1c64e61308594b4cb6eec4932cc68d43da9466c27cdf93d61`. Keine Rollen-Konfigurationswerte gehören ins Repository.
