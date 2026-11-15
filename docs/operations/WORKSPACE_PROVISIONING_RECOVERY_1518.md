# Billing1518: bestehende Workspace-Struktur kontrolliert wiederherstellen

Source-Vorbereitung ab Main e48eea970e5c0b541ebfe58e8aeb7ccd3dea8ae8.
PR1518 ist gemergt; dieser Folgeumfang ist weder gemergt noch installiert.
Keine Production-SQL-Anwendung, Kundendatenänderung oder kommerzielle Aktivierung.

## Implementierter Umfang

Der Generator scripts/operations/workspace-provisioning-recovery.mjs erzeugt
supabase/controlled/workspace_provisioning_existing_recovery.sql außerhalb
der generischen Migrationen. Er besitzt nur Offline-Modi --write/--check,
keinen DB-Client, kein Secret und keinen Apply-/Dispatchpfad.
Die vorhandene RPC-Konfliktkorrektur vom13August wird über SHA256
874caa0399822e07d6618f502906853c5187021cc7fe4fc2bcfe5389926c03a3 gebunden.

Dieselbe vorhandene API-Signatur und Antwort workspace_id/created werden
beibehalten. Übernommen werden Auth-Identität und Advisory-Lock; die gesamte
historische Starter-Anlage und Membership-UPSERT werden entfernt.
Die Recovery-Fassung ist **SECURITY INVOKER**, liest nur unter den bestehenden
Caller-RLS-Regeln und gibt ausschließlich einen bereits vorhandenen eigenen
Workspace mit vorhandener Owner-Mitgliedschaft zurück, created=false.
Fehlender Workspace oder fehlende Owner-Mitgliedschaft sperren. Argumente
können keine fremde Identität, Planänderung oder Annahme auslösen.

Es gibt weder neue Legacy-/Capacity-Zulassung noch automatische Reparatur einer
Mitgliedschaft oder eines Vertrags. Daily hat seine bestehende getrennte
service-only RPC; keine Änderung daran. Diese kleine bestehende-Workspace-
Recovery ersetzt ausdrücklich keinen künftig abgenommenen Paketcheckout.

Der feste Suchpfad, Owner, Sprache, Signatur, Parameter-/Resultatnamen,
Definer=false, fehlende Default-/Variadicargumente, vollständige prosrc-SHA256
und direkte/effective EXECUTE-Grenzen werden nachgewiesen. EXECUTE nur für
authenticated und Funktionsowner; PUBLIC/anon/service_role sowie unbekannte
Grantees oder Grantoptionen sperren. Es entsteht kein zusätzlicher SECURITY-
DEFINER und keine Lockerung des geprüften39/29-Backupvertrags.

## Strukturelle Transaktion und Rückfall

Eine Transaktion mit Advisory-/Tabellenlocks und festen Lock-/Statementlimits:

1. PG17/Role/RLS/Relation-/Column-Prüfung und fehlende RPC ohne unbekannten
   Overload nachweisen. Browser dürfen public nicht beschreiben/CREATE.
2. Den vorhandenen benannten, gültigen, unmittelbaren, ungefilterten Membership-
   Unique-Constraint auf(workspace_id,user_id) exakt nachweisen und wiederverwenden.
   Kein neuer Membership-Index, keine Umbenennung.
3. NULL-/doppelte Owner-Identitäten sperren. Jede bereits geeignete Owner-
   Eindeutigkeit wiederverwenden; nur wenn sie tatsächlich fehlt den einen
   workspaces_owner_user_id_uidx anlegen. Eine Namenskollision sperrt.
4. Die abgeleitete rein lesende Invoker-RPC installieren und EXECUTE begrenzen.
5. Vollständigen Funktions-/Index-/ACL-Postflight vor COMMIT ausführen.

Keine Workspace-/Member-/Demo-DML, kein Annahme-Backfill und keine Änderung
der Migrationshistorie wird bei Installation ausgeführt. Unbekannte/partielle
Zustände sperren. Bei bereits vorhandener RPC zuerst den read-only Postflight
klassifizieren, nicht blind erneut anwenden. Der Generator überschreibt keine
unbekannte installierte Funktion.

Fehler vor COMMIT rollen Index und Funktion gemeinsam zurück. Unbekannter
COMMIT-Ausgang verlangt frischen read-only Zustandsvergleich. Nach COMMIT
keine automatische DROP-/ACL-Rückweitung oder Datenwiederherstellung;
additive Struktur erhalten, Vorgang anhalten und gezielt vorwärts reparieren.
Jeder geschützte Gegenschritt benötigt eigene konkrete Freigabe.

Die vorhandene Billing-Contract-Datei bleibt bytegleich, SHA256
a015aabfa4f7ac778f3159fbd5e2a3126cd56c86571c8def946c5f4998ad8591.
Sie wird nicht von der Recovery aufgerufen. Ihre Legacy-Annahmeprüfung muss
nach einer strukturellen Recovery weiterhin scheitern, solange Datenbelege fehlen.

## Tatsächliche lesende Ziel-/Nachweisinventur

Die neu generierte Postflight-SELECT wurde ohne Funktionsaufruf in einer
READ ONLY/ROLLBACK-Sitzung auf dem bestehenden Production-Projekt geprüft:
owner_unique=false, membership_unique=true, rpc_exact=false.
Das ist ein funktionsfähiger lesender Klassifikator, kein Target-Apply oder
vollständiger vorbereitender DDL-Preflight. Keine Projekt-/Hostbindung aus einem
PostgreSQL-Objektnamen ableiten.

| Datenbefund | Tatsächlich geprüft | Konsequenz |
| --- | --- | --- |
| Zwei Legacy-Annahmen | Version/Zeitpunkt/Actor fehlen; kein Annahmenachweis in den geprüften vorhandenen Workspace-Feldern | Kein Backfill ohne autoritative Belege |
| Operations-Audit |1 zugehöriger Eintrag,0 Root- oder verschachtelte Terms-Version-/Zeit-/Actorfelder | Kein rekonstruierbarer Annahmenachweis aus diesem geprüften Auditbestand |
| Auth-Metadaten |0 serververwaltete App-Metadaten-Kandidaten;1 veränderbarer User-Metadaten-Kandidat | User-Metadaten nicht als Zustimmung/Planquelle verwenden |
| Ein Legacy-Workspace | billing_status,billing_provider,payment_collection_method NULL; keine Customer-/Subscription-/Checkout-/PaymentIntent-Referenz | Keine sichere kanonische Stripe-Zuordnung für eine Wertreparatur vorhanden |

Nur aggregierte Zähler/Schlüsselinventur; keine Kunden-IDs, Adressen, Tokens,
Metadateninhalte oder Zahlungsobjekte veröffentlicht. Die Suche beweist nicht,
dass außerhalb der geprüften Datenbestände keine Vertragsunterlagen existieren.
Externe Originalnachweise oder eine künftig tatsächlich neu abgegebene
Zustimmung wären getrennt zu prüfen; keine Rückdatierung/Defaultwerte.

## Regressionen und Grenzen

tests/workspace-provisioning-recovery.cases.mjs ist im vorhandenen Pflichtroot
workspace-server-owned-fields.test.mjs importiert. Der vorhandene native PG17-
Job setzt REQUIRED=true und führt auch diese Fälle aus; kein neuer Runner,
kein Supabase-Projekt und kein zusätzlicher Target-Testkanal.

Tests: deterministische Sourcepins/Artefaktbytes; doppelte/NULL-Owner;
falscher Membership-Constraint, unbekannte RPC-Overloads und Indexkollision;
Rollback und tatsächliche Postflight-ACL-Mutation; Wiederverwendung äquivalenter
Indizes ohne Doppelindex; unveränderte Daten inkl. fehlender Annahmen;
Owner/owning Creator positiv, Member/Fremdnutzer/anon/service_role negativ;
geschlossene Caller-RLS und falsche Auth-Claims; keinerlei neue Paketaufnahme;
fehlende Owner-Mitgliedschaft ohne Eskalation; keine neue Definer-Kohorte;
Original-Contract-Guard und Server-Billingwriter nach ausschließlich synthetisch
belegter Annahme; anschließendes Entfernen der isolierten CI-Testdatenbank.

Das sind echte PostgreSQL-ACL/RLS/DDL-Tests mit synthetischen Claims, keine
echten Supabase-JWT-/PostgREST-/Browser- oder Zahlungsabnahmen. Lokale Umgebung
ohne Docker meldet Native-SKIP; hosted Pflichtausführung ist separat erforderlich.
Die Tests enthalten bewusst nur isolierte synthetische Annahmedaten und sind
keine Vorlage zum Umschreiben realer Kundenannahmen.

## Konkrete spätere Freigabegrenzen

Vor einer strukturellen Production-Anwendung fehlen weiterhin: regulärer
Quellreview/Source-Merge, endgültige SQL-SHA, frische tatsächliche Production-
Version und vollständiger kalter Preflight, sichere Backup-/Restore-/Lock-
Nachweise sowie genaue Bindung an den bestehenden geschützten Ausführungskanal.
Dieser PR baut bewusst keinen automatisch erreichbaren Apply-/Hostpfad.
Keine SQL-Anwendung allein aufgrund eines grün generierten Pakets erlauben.

Eine spätere Strukturfreigabe dürfte ausschließlich den einen fehlenden Owner-
Index und die oben beschriebene lesende vorhandene-Workspace-RPC umfassen.
Keine Demo-DML, Kunden-/Vertrags-/Memberdatenänderung oder Admission-Aktivierung.
Die Production-Billing-Contract-Freigabe bleibt ein weiterer eigener Schritt
nach echter JWT-/Login-/Demo-Kompatibilität und geklärten Datenbelegen.

## Capacity und Sandbox

SupportPR1500 wurde frisch auf317493e12e8643d90ceb1917baac6c17e663089d als
offener Draft bestätigt. Seine Implementierung und die bestehenden Capacity-
Installations-/Writercontroller bleiben unverändert. Keine zweite Implementierung.
Fehlende monetäre Staging-RPCs und vier tenant_binding_missing-Events bleiben
getrennt BLOCKED und unverändert; keine Replays/Zuordnungen/Grants.

Vor positiver Sandboxkette: tatsächliche Staging-Installation und Writer-/Verify-
Nachweise aus Support übernehmen, isoliertes Konto/Price-/Runtime-/Steuergates
und genehmigte synthetische Identitäten binden. Dann ausschließlich separat
zulässige Checkout-/Abbruch-/signierte-Webhooks-/Entitlement-/Grant-/Verbrauch-/
Reversal-/Idempotenz-/Parallel-Replay-/Isolation-/Cleanup-Fälle. Kein Livefallback.
Aktuell: externe positive Sandboxkette NOT TESTED/BLOCKED, keine Buchung.
