# FanMind Supply-Chain-Sicherheit

## Ziel

FanMind behandelt GitHub Actions, npm-Abhängigkeiten, statische Sicherheitsanalyse und Software-Stücklisten als Teil der Production-Lieferkette. Änderungen werden ausschließlich über nachvollziehbare Pull Requests vorgenommen. Es gibt kein Auto-Merge für Dependency- oder Action-Updates.

## Unveränderliche GitHub Actions

Alle externen `uses:`-Referenzen in `.github/workflows` müssen auf einen vollständigen 40-stelligen Commit-SHA zeigen. Mutable Tags wie `@v4`, Branches wie `@main` oder verkürzte SHAs werden durch `scripts/verify-actions-pinned.mjs` fail-closed abgelehnt.

Aktuell geprüfte Pins:

| Action | Commit-SHA | lesbarer Versionshinweis |
| --- | --- | --- |
| `actions/checkout` auf GitHub-gehosteten Runnern | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `v7.0.1` |
| `actions/checkout` auf `fanmind-restore` | `11d5960a326750d5838078e36cf38b85af677262` | `v4` |
| `actions/setup-node` | `820762786026740c76f36085b0efc47a31fe5020` | `v7.0.0` |
| `actions/setup-java` | `b6effb05e454b25005698d916606bdc6ffcbf961` | `v5.7.0` |
| `actions/upload-artifact` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | `v7.0.1` |
| `github/codeql-action` | `ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd` | `v4.37.7` |

`actions/checkout` bleibt absichtlich gemischt gepinnt. Alle Checkout-Schritte
auf GitHub-gehosteten Runnern verwenden v7.0.1. Die geschützten Restore-Jobs
verwenden den getrennten v4-Pin mit `persist-credentials: false` und
`set-safe-directory: false`; vor diesem Checkout läuft bereits die erneute
Readiness-Prüfung des vorinstallierten Host-Gates. Restore-Jobs verwenden weder
`actions/setup-node` noch `npm install`.

### Fester Restore-Host vor Checkout und Secrets

`.github/workflows/restore-drill-host-readiness.yml` prüft ausschließlich den
isolierten Host und kann keinen Restore auslösen. Er hat keinen Checkout, keine
GitHub-Environment-Bindung, keine Restore-Secrets und keine Datenbank- oder
Backup-Verbindung. Die beiden geschützten Restore-Workflows führen denselben
Gate zuerst in einem secret-freien Job und anschließend erneut in einem
separaten environment-gebundenen Job vor Checkout aus.

Alle diese Jobs benötigen die Organisations-Runner-Gruppe
`fanmind-restore-drill` und exakt die fünf Routing-Labels `self-hosted`,
`fanmind-restore`, `fanmind-restore-01`, `linux` und `x64`. Labels sind keine
Autorisierungs- oder Hostprüfgrenze. Das derzeit öffentliche, persönlich
gehaltene Repository kann die Gruppe noch nicht bereitstellen; deshalb muss
`FANMIND_RESTORE_RUNNER_SCOPE` unset bleiben und jeder Dispatch vor dem
Self-hosted-Job stoppen. Erst nach Organisations-Transfer und einer auf die
drei `main`-Restore-Workflows begrenzten Gruppen-Allowlist darf der Wert
`organization-workflow-allowlist` gesetzt werden. Die Variable ist nur die
Operatorbestätigung einer unabhängig geprüften Gruppen-Allowlist und kein
GitHub-Admin-API-Nachweis. Der private Admin-Beleg muss
`visibility=selected`, Repository-ID `1259448985`,
`restricted_to_workflows=true`, exakt drei Workflow-/`main`-Einträge und bei
weiterhin öffentlichem Repository `allows_public_repositories=true` zeigen.
Der externe Controller muss für die beiden Jobs nacheinander zwei
frische Ein-Job-JIT-Runner registrieren und danach entfernen. Eine persistente
Runner-Registrierung, Credential-Wiederverwendung oder parallele Nutzung ist
nicht zulässig; GitHub-Workflow-YAML allein kann diese externe Lebensdauer
nicht garantieren.

Der Bootstrap verwendet ausschließlich den root-eigenen, nicht schreibbaren
Node-Pfad `/opt/fanmind-restore/node-v24.19.0-linux-x64/bin/node` und den
root-eigenen, nicht schreibbaren Gate-Pfad
`/opt/fanmind-restore/restore-host-readiness.mjs`. Der aktuell gebundene
Gate-SHA-256 ist `71249afb3364203908d7ecf8bb85d50d02efaf605f2d36b12faf32e1e5f64ac2`. Das Gate bindet die bei einem Owner-Transfer stabile
GitHub-Repository-ID `1259448985`. Die Workflows prüfen vor der
Ausführung zusätzlich Eigentümer, Modus, kanonischen Pfad, Parent-Verzeichnisse
und die Node-Version 24.19.0.

Das Gate bindet Ubuntu 24.04, PostgreSQL-Tools 17.11, age 1.1.1, GNU tar 1.35,
gzip 1.12, Bash und GNU coreutils 9.4 an feste absolute, root-eigene und nicht
schreibbare Pfade. Der Runner-Benutzer besitzt keine Zusatzgruppe, kein
erfolgreiches non-interactive `sudo`, keine Capabilities und keinen Zugriff auf
privilegierte Container-/Virtualisierungssockets; `NoNewPrivs=1` ist Pflicht.

Der Workflow leert Proxy-, TLS-/CA-, Loader-, OpenSSL-, Git-Konfigurations- und
Trace-, Node-Debug-/Loader-, Python- und Shell-Injection-Variablen. Der Gate
selbst erhält über `env -i` nur eine feste Allowlist. Insbesondere bleiben
libpq-Ziele, Backup-/Production-/Supabase-Werte und alle Restore-Secrets außen.
`GIT_TRACE_REDACT=true` und `NODE_TLS_REJECT_UNAUTHORIZED=1` werden zusätzlich
explizit erzwungen; alle anderen Trace- und Debug-Ziele bleiben leer.

Die Host-Readiness-Prüfung verbindet sich nicht mit PostgreSQL, entschlüsselt kein
Artefakt und aktiviert keine Schreibgrenze. Der einzige Upload ist ein
redigierter, drei Tage aufbewahrter Host-Receipt. Outbound-Firewall-Regeln
müssen extern GitHub nur für die JIT-Auftragsabwicklung und im geschützten
zweiten Job zusätzlich ausschließlich das isolierte Restore-Ziel zulassen;
Production-, Cloud-Metadata- und privilegierte Host-Endpunkte bleiben gesperrt.

Jeder Workflow benötigt außerdem einen ausdrücklichen top-level `permissions:`-Block. `permissions: write-all` ist verboten. Schreibrechte werden nur für den konkreten Zweck vergeben, beispielsweise `security-events: write` für CodeQL oder `issues: write` für den Uptime-Alarm.

### Action aktualisieren

1. Dependabot-PR oder manuellen kleinen PR verwenden.
2. Release-/Changelog und Repository-Eigentümer prüfen.
3. Das Ziel-Tag read-only auf den vollständigen Commit-SHA auflösen.
4. SHA im Workflow ersetzen und den lesbaren Versionskommentar beibehalten.
5. Bei Actions, die in einem Workflow als zusammengehöriges Paar verwendet werden, alle Varianten gemeinsam aktualisieren; für CodeQL bedeutet das mindestens `init` und `analyze` auf denselben Release-Commit.
6. `npm run verify:actions-pinned` ausführen.
7. FanMind CI, betroffene Fach-CI und Supply-Chain-CI vollständig grün abwarten.
8. Keine Action direkt auf `main` aktualisieren und keine unbekannte Drittanbieter-Action ungeprüft aufnehmen.

## Dependency-Audit

`npm run security:audit` prüft:

- Web-/Server-Production-Abhängigkeiten über `npm audit --omit=dev --json`;
- sämtliche Mobile-Abhängigkeiten über `npm audit --json`;
- ausschließlich strukturierte Zähler und Paketnamen, keine Roh-Advisory-Ausgabe;
- exakte Next.js-/ESLint-Config-Patchstände;
- einen vollständig sauberen Root-Production-Baum ohne Review-Ausnahme.

### Aktueller geprüfter Zustand vom 3. September 2026

Am 17. August wurde Next.js `16.3.1` zusammen mit dem passenden
`eslint-config-next` erneut gegen den vollständigen Release- und
Production-Audit geprüft. FanMind verwendet jetzt:

- Next.js und `eslint-config-next` exakt `16.3.1`;
- `postcss` `8.5.23`;
- `sharp` `0.35.3`.

Die beiden Production-Korrekturen werden ausschließlich unter
`next@16.3.1` als npm-Overrides exakt festgeschrieben. Ein dauerhafter Test verarbeitet mit
der aufgelösten Sharp-Version ein echtes Bild, zusätzlich zum vollständigen
Next.js-Production-Build.

Im reinen Entwickler-Werkzeugbaum werden außerdem die innerhalb ihrer
bestehenden Parent-Ranges verfügbaren Korrekturen `brace-expansion` `1.1.18`
und `5.0.9` sowie `js-yaml` `4.3.1` eng begrenzt erzwungen. Damit sind auch
die am 30. Juli beziehungsweise 5. August 2026 veröffentlichten
High-Advisories `GHSA-rgw5-rvv9-x895` und `GHSA-5p4m-2wfm-xmqj` behoben,
ohne ESLint, Next.js oder einen Parent auf eine neue Major-Version zu heben.
Ein dauerhafter Policy-Test bindet sowohl die drei Range-selektiven Overrides
als auch alle aufgelösten 1.x-, 5.x- und 4.x-Lockfile-Knoten an diese
Patchstände.

Der vollständige Root-Audit einschließlich Entwicklerabhängigkeiten meldet
auf diesem Lockfile keine hohen oder kritischen Befunde. Der Production-Audit
bleibt davon unabhängig strenger und verlangt weiterhin einen vollständig
sauberen Root-Production-Baum ohne Review-Ausnahme.

Der reproduzierte Root-Production-Audit meldet danach:

- `0` kritische Befunde;
- `0` hohe Befunde;
- `0` moderate Befunde;
- `0` niedrige Befunde;
- keine Root-Paket-Ausnahme.

Der vorherige, bis 7. August befristete Production-Reviewvertrag ist entfernt.
Das Gate akzeptiert im Root-Production-Baum jetzt ausschließlich einen
vollständig sauberen Audit und exakt Next.js sowie `eslint-config-next`
`16.3.1`. Jeder neue Production-Paketname oder Befund lässt die Prüfung
fail-closed fehlschlagen.

Der Mobile-Baum enthält weiterhin den ungepatchten `image-size`-DoS-Hinweis
GHSA-w3rx-r6r6-pgpr/GHSA-5p2g-fcmc-qvqq im Expo-/Metro-Buildpfad. FanMind
verarbeitet dort keine nicht vertrauenswürdigen ICNS-, JXL- oder HEIF-Dateien.
Am 3. September wurden außerdem die neu gemeldeten transitiven Hinweise für
`@xmldom/xmldom` (XML-Serialisierung), `decode-uri-component`/`query-string`
(aufwendig zu dekodierende fehlerhafte URL) und die bereits bekannten
`uuid`-/Xcode-Pfade erneut geprüft. npm bietet für den aktuellen Expo-SDK-57-
Baum keinen kompatiblen automatischen Fix an; die vorgeschlagenen Downgrades
auf Expo 46 beziehungsweise Router 5 sind keine sichere Patch-Aktualisierung.

Deshalb bleibt die Ausnahme ausschließlich zeitlich, namentlich und mengenmäßig
begrenzt. Das Gate erlaubt exakt den am 3. September reproduzierten Stand von
höchstens `4` hohen und `15` moderaten Befunden, weiterhin `0` niedrige,
kritische oder informative Befunde, und läuft am 17. September 2026 um 18:40
UTC ab. Ein neuer Paketname, ein zusätzlicher Befund oder ein abgelaufener
Review lässt die Supply-Chain-Prüfung fail-closed scheitern. Ein vollständig
sauberer Mobile-Audit benötigt keine Ausnahme und bleibt auch nach dem Ablauf
zulässig. Spätestens vor dem Ablauf werden Expo-SDK-57-kompatible Upstream-
Patches erneut geprüft; die Ausnahme ersetzt kein Upgrade.

## CodeQL / SAST

`.github/workflows/codeql.yml` analysiert JavaScript und TypeScript mit der unveränderlich gepinnten CodeQL-v4-Action `4.37.7` und `security-extended`:

- bei Pull Requests gegen `main`;
- bei Pushes auf `main`;
- wöchentlich;
- manuell über `workflow_dispatch`.

`init` und `analyze` werden immer gemeinsam auf exakt denselben CodeQL-Release-Commit aktualisiert. Der Workflow besitzt nur `contents: read`, `actions: read`, `packages: read` und `security-events: write`. Die CodeQL-Fähigkeit einschließlich Extraktion, Analyse und SARIF-Upload wird bei jedem Action-Update erneut im Pull Request ausgeführt.

Ein CodeQL-Alarm wird nicht durch Abschalten der Query, pauschales Ignorieren oder Entfernen des Workflows gelöst. Echte Befunde werden in kleinen Folge-PRs behoben oder mit konkreter, zeitlich begrenzter Begründung dokumentiert.

## CycloneDX-SBOM

`npm run security:sbom` erzeugt und validiert zwei CycloneDX-JSON-Stücklisten:

- `fanmind-web.cdx.json`;
- `fanmind-mobile.cdx.json`.

Die Dateien werden ausschließlich als kurzlebige GitHub-Actions-Artefakte mit sieben Tagen Aufbewahrung bereitgestellt. Sie werden nicht in Git eingecheckt und enthalten keine `.env`-Werte oder Secrets. Die Generator-Policy prüft Format, Spec-Version und strukturierte Komponentenliste vor dem Upload.

## Dependabot

`.github/dependabot.yml` erstellt wöchentliche Pull Requests für:

- npm im Root-Projekt;
- npm in `apps/mobile`;
- GitHub Actions.

Patch-Updates werden sinnvoll gruppiert, aber niemals automatisch gemergt. Jeder PR durchläuft weiterhin Product Truth, Lint, Operations-Tests, Build, Mobile-Gates, Action-Pin-Policy, Dependency-Audit und gegebenenfalls CodeQL.

## Reproduzierbarkeit

- Root und Mobile besitzen getrennte `package-lock.json`-Dateien.
- CI verwendet `npm ci` statt freier Auflösung.
- Next.js und `eslint-config-next` sind für den geprüften Patchstand exakt gepinnt.
- Lockfile-Änderungen ohne zugehörige Manifeständerung beziehungsweise nachvollziehbaren Audit-Fix werden nicht gemergt.

## Keine Secrets in Artefakten

Supply-Chain-Workflows lesen keine Production-ENV-Dateien. Audit-Berichte enthalten nur:

- Schweregrad-Zähler;
- geprüfte Paketnamen;
- Policy-Ergebnis und Ablaufdatum;
- SBOM-Komponentenmetadaten aus den Lockfiles.

Nicht zulässig sind Tokens, Registry-Credentials, `.env`-Inhalte, Supabase-/Stripe-/OpenAI-Schlüssel, private URLs oder Kundeninhalte.

## Störungs- und Rollback-Regeln

Bei einem fehlerhaften Dependency-/Action-Update:

1. PR nicht mergen beziehungsweise den Release auf den letzten gesunden Commit zurückrollen.
2. Production-Health und Kernrouten prüfen.
3. Keine Audit-Regel, Action-Pin-Prüfung oder CodeQL-Analyse zur Umgehung des Fehlers abschalten.
4. Ursache in einem kleinen Folge-PR beheben.
5. Lockfile, SBOM und Audit-Bericht erneut erzeugen.

Bei einem Registry- oder GitHub-Ausfall darf ein geplanter Supply-Chain-Run fehlschlagen. Der Fehler wird nicht durch ungeprüfte Cache-/`--force`-/`--legacy-peer-deps`-Umgehungen verdeckt.
