# Kurzlebiger Member-Zugang für die Staging-Kernabnahme

## Zweck

Der manuelle Workflow `FanMind Staging Core and CSV Acceptance` benötigt für
seinen echten Member-Login kein dauerhaft gespeichertes
`FANMIND_STAGING_E2E_MEMBER_PASSWORD` mehr. Das Passwort entsteht erst im
geschützten Hosted-Runner-Job, wird von GitHub maskiert und über die
runnerinterne `GITHUB_ENV` nur an die nachfolgenden Schritte desselben Jobs
gebunden. Es wird weder als GitHub Secret noch als Artefakt, Receipt oder
Repositorywert gespeichert.

Der Pfad erstellt keinen Nutzer, ändert keine Owner-/Secondary-Zugangsdaten
und darf niemals gegen Production laufen. Er rotiert ausschließlich das
bereits vorhandene, fest markierte synthetische Member-Konto.

## Exakter Zielvertrag

Vor jeder Passwortänderung muss der Helper gemeinsam nachweisen:

- Runtime `staging`, App-Origin exakt `https://staging.fanmind.ch`, `main` und
  exakt der geprüfte/deployte Commit;
- getrennte Staging-/Production-Supabase-Projektreferenzen und exakt der
  Supabase-Ursprung des Staging-Projekts;
- ausdrückliche Nicht-Production-Write-Bestätigung;
- genau ein Profil mit der festen Adresse
  `fanmind-ai-member-staging@example.invalid`;
- dieselbe gültige UUID im Profil und im Supabase-Auth-Admin-Objekt;
- bestätigte Auth-Adresse und die bestehenden Metadaten
  `fanmind_staging_fixture=ai_member` sowie
  `fanmind_staging_fixture_version=1`;
- genau eine Workspace-Membership dieses Nutzers, Rolle exakt `member`, im
  konfigurierten primären synthetischen Workspace;
- Workspace-Name exakt `FanMind Staging Processing Acceptance`, aktives
  Billing/Access, `staging_synthetic_fixture=true` und einen anderen gültigen
  Owner.

Eine fremde Adresse, fehlender oder abweichender Marker, mehrere Memberships,
eine Owner-Rolle, ein anderer Workspace oder ein Production-/Commit-Drift
stoppt vor dem Admin-`PUT`. Der Update-Body enthält ausschließlich
`password`; E-Mail, Marker, Bestätigungsstatus, Owner- und Secondary-Daten
werden nicht geschrieben.

## Credential-Lifecycle

Abhängigkeiten und Chromium werden vollständig installiert, bevor das
Passwort entsteht. Damit erreicht der Wert weder `npm ci` noch Playwrights
Browser-/Systempaketinstallation.

1. Der geschützte Job erzeugt 48 kryptografisch zufällige Bytes. Ein kurzer
   fester Präfix garantiert Groß-/Kleinbuchstabe, Zahl und Sonderzeichen; der
   Zufallsanteil bleibt vollständig erhalten.
2. Der Wert wird vor jeder weiteren Ausgabe mit GitHubs `add-mask` maskiert
   und unter den beiden notwendigen Prozessnamen in `GITHUB_ENV` geschrieben:
   `FANMIND_STAGING_E2E_MEMBER_PASSWORD` für die Operationsskripte und
   `FANMIND_E2E_STAGING_MEMBER_PASSWORD` für Playwright. Der Helper öffnet
   ausschließlich einen absoluten Pfad mit `O_NOFOLLOW`, verlangt bereits vor
   jeder Modusänderung eine reguläre, dem Runner gehörende Datei mit genau
   einem Hardlink, setzt über den offenen Deskriptor `0600` und bestätigt
   anschließend Typ, Eigentümer, Linkzahl und Modus erneut exakt. Ein Symlink,
   Hardlink oder anderer Dateityp erhält kein Passwort.
3. Nur der Aktivierungsschritt erhält den Staging-Service-Role-Key. Nach dem
   vollständigen Zielvertrag rotiert er genau den markierten Member. Nach dem
   Admin-`PUT` liest er die feste Profil-zu-UUID-Bindung, Auth-ID, E-Mail,
   Marker, die exakt einzelne Membership und den Workspace vollständig neu;
   erst dieser unveränderte Postflight erlaubt den Browserlauf.
4. Playwright meldet jede erzeugte Owner-, Member- und Secondary-Session
   ausdrücklich über Supabase Auth ab; der `afterEach`-Pfad wiederholt die
   Abmeldung für noch offene Testsitzungen.
5. Ein `always()`-Schritt läuft nach Daten-Cleanup auch bei Browser- oder
   Verifikationsfehlern. Er prüft den Zielvertrag erneut, rotiert den Member
   auf ein neues, nur im Prozessspeicher vorhandenes unbekanntes Passwort und
   verlangt anschließend für das zuvor bekannte Passwort exakt
   `invalid_credentials`.
6. Sollte das bekannte Passwort wider Erwarten noch eine Sitzung erzeugen,
   wird diese sofort global abgemeldet, ein zweites unbekanntes Passwort
   gesetzt und genau einmal erneut geprüft. Ohne abschließende Ablehnung gibt
   es keinen Acceptance-PASS.

Ein `EXIT`-Trap des Revoke-Schritts überschreibt beide Prozessaliase für alle
folgenden Schritte mit leeren Werten – auch wenn der Revoke fehlschlägt. Der
abschließende Datenbank-/Release-Postflight und das Evidence-Cleanup erben
damit kein Member-Passwort.

Die unbekannten Cleanup-Passwörter werden nie ausgegeben oder in
`GITHUB_ENV` geschrieben. Der Helper begrenzt Antworten und Timeouts, erlaubt
nur den fest gebundenen HTTPS-Supabase-Ursprung und lehnt Node-Loader,
zusätzliche CA-Dateien und Proxy-Umleitungen ab.

Ist ein Admin-`PUT` wegen Timeout, Antwortfehler oder Providerabbruch
unbestimmt, oder driftet der vollständige Zielvertrag nach einem angenommenen
`PUT`, bleibt der Lauf immer rot. Der Helper versucht dann genau auf der vor
dem ersten Write gebundenen Member-UUID ein frisches unbekanntes Passwort zu
setzen, das weder dem bekannten noch dem gerade verwendeten Wert entspricht.
Diese Kompensationsrotation löst weder ein neues Profil auf noch hängt sie von
der möglicherweise driftenden Membership ab. Sie prüft Auth-ID, Adresse und
Marker erneut, soweit der Auth-Read erreichbar ist; eine eindeutig fremde
Auth-Identität wird niemals verändert. Auch eine erfolgreiche Kompensation
wandelt den fehlgeschlagenen Lauf nicht in PASS um, und ein fehlgeschlagener
Kompensationsversuch bleibt ausdrücklich rot.

## Benötigte geschützte Werte

Zusätzlich zu den bestehenden Core-/CSV-Werten benötigt der Workflow im
GitHub Environment `staging` nur die bereits für die synthetische
Fixture-Provisionierung vorgesehenen Schlüssel:

```text
FANMIND_STAGING_SUPABASE_ANON_KEY
FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY
```

Es darf ausdrücklich **kein** neues persistentes
`FANMIND_STAGING_E2E_MEMBER_PASSWORD` für die Core-/CSV-Abnahme angelegt
werden. Die beiden bestehenden Owner-Passwörter bleiben unverändert und sind
dem Member-Helper nicht zugänglich.

Der kurze Betriebsvertrag lautet: kein persistentes Member-Passwort für
Core/CSV.

## PASS-Vertrag und Fehlerfall

Vor dem finalen `STAGING_CORE_CSV_ACCEPTANCE=PASS` müssen unter anderem diese
Marker aus demselben geschützten Lauf vorhanden sein:

```text
STAGING_EPHEMERAL_MEMBER_AUTH_USER=PASS
STAGING_EPHEMERAL_MEMBER_WORKSPACE_MEMBERSHIP=PASS
STAGING_EPHEMERAL_MEMBER_CREDENTIAL_ACTIVE=PASS
STAGING_EPHEMERAL_MEMBER_UNKNOWN_ROTATION=PASS
STAGING_EPHEMERAL_MEMBER_KNOWN_PASSWORD_REJECTED=PASS
STAGING_EPHEMERAL_MEMBER_CREDENTIAL_REVOKED=PASS
```

Schlägt die abschließende Rotation oder Ablehnungsprüfung fehl, bleibt der
gesamte Lauf rot und darf nicht als Staging-Abnahme gewertet werden. Dann
zuerst den geschützten Lauf und die feste Fixture-Zuordnung prüfen; niemals
auf Production ausweichen und keine Zugangsdaten in Issue, PR, Log oder Chat
kopieren. Dasselbe gilt für einen unbestimmten Admin-`PUT`, Postflight-Drift
oder eine nur kompensierte Rotation. Ein Offline-Test, Merge oder
vorbereiteter Workflow ersetzt den tatsächlichen grünen Hosted-Runner-Lauf
nicht.
