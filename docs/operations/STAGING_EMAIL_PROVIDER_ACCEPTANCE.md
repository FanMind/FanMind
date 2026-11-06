# Staging-E-Mail-Provider-Abnahme

Stand: 17. August 2026

## Ziel und harte Grenze

Dieser Kontrollpfad beweist ausschließlich, dass ein eng begrenzter
Resend-Schlüssel von der verifizierten Staging-Sendedomain genau ein
providerseitiges, synthetisches Zustellereignis auslösen kann. Er schaltet
keinen E-Mail-Pfad der FanMind-App frei.

Die normale Staging-Runtime behält `RESEND_API_KEY` und
`FANMIND_NOTIFICATION_FROM` leer. Das ist zwingend: Inquiries und
Account-Löschung besitzen absichtlich eigene E-Mail-Pfade, die durch eine
globale Providerkonfiguration sonst reale Production-Postfächer oder
Nutzeradressen erreichen könnten. Solange dafür keine separate
Staging-Empfängergrenze existiert, bleibt `/api/health` mit
`email_config=unknown` ehrlich offen.

## Externe Voraussetzungen

Vor einem Dispatch müssen Administratoren unabhängig belegen:

1. `mail.staging.fanmind.ch` ist in einem getrennten Resend-Team oder
   wenigstens als dedizierte Domain eingerichtet; SPF, DKIM und der
   Resend-Return-Path sind öffentlich gültig.
2. Der verwendete API-Key besitzt nur `sending_access` und ist im
   Resend-Dashboard exakt auf `mail.staging.fanmind.ch` eingeschränkt. Ein
   Full-Access-Key ist unzulässig.
3. Das GitHub-Environment `staging-email-acceptance` erlaubt nur `main`, hat
   mindestens einen Required Reviewer, verhindert Self-Review und erlaubt
   keinen Admin-Bypass.
4. Dort liegt ausschließlich das Secret
   `FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY`. Die geschützte Variable
   `FANMIND_STAGING_EMAIL_SCOPE_ATTESTATION` trägt exakt
   `sending_access-domain-restricted:mail.staging.fanmind.ch`.
   `FANMIND_STAGING_EMAIL_EXPECTED_MX` bindet den exakten
   Priority-10-Resend-MX; `FANMIND_STAGING_EMAIL_DKIM_SHA256` bindet den
   SHA-256-Fingerprint des exakten öffentlichen DKIM-TXT-Werts.
5. Der zu prüfende aktuelle `main`-Commit ist bereits auf
   `https://staging.fanmind.ch` deployt.

GitHub stellt Required Reviewers auf Free-, Pro- und Team-Plänen für
öffentliche Repositories bereit. Falls FanMind vor diesem Lauf privat wird,
muss zuerst ein Organisations-/Planvertrag vorliegen, der denselben
Environment-Schutz für private Repositories unterstützt. Der Control bleibt
sonst blockiert; Required Reviewer oder `can_admins_bypass=false` dürfen nicht
durch eine bloße Variable ersetzt werden.

Die Scope-Variable ist eine Operator-Aussage, keine Resend-Fernattestierung.
Die negative `GET /api-keys`-Probe beweist einen gültigen
`sending_access`-Key, aber nicht dessen optionale Domainbindung. Diese bleibt
deshalb eine separat geprüfte Dashboard-Grenze. Ein erfolgreiches Senden mit
dem festen Absender beweist nur, dass genau diese Domain für den Key nutzbar
und beim Provider sendefähig ist.

## Einmaliger sicherer Lauf

Workflow: `FanMind Staging Email Provider Acceptance`

- Ref: `main`
- `reviewed_commit`: exakter aktueller und bereits deployter Main-SHA
- `confirmation`: `send-one-staging-email-provider-acceptance`

Der Lauf prüft Environment-Schutz, aktuellen Main-SHA, deployten
`/api/version`-SHA, öffentliche DNS-Evidenz sowie die eingeschränkte
Key-Berechtigung. Danach sendet er genau einen festen Text von
`FanMind Staging <acceptance@mail.staging.fanmind.ch>` an Resends sichere
Testadresse `delivered+fanmind-staging@resend.dev`. Diese Adresse simuliert
laut Resend ein Zustellereignis und erreicht keinen menschlichen Empfänger.
Die Payload enthält keine Namen, CRM-, Kontakt-, Nachrichten-, KI-, Zahlungs-
oder sonstigen Nutzerdaten.

Der Idempotency-Key ist stabil an den geprüften Commit gebunden. Resend hält
Idempotency-Keys 24 Stunden. Bei einem unklaren Timeout darf kein blinder
automatischer oder manueller Retry erfolgen; der Lauf meldet in diesem Fall
`INDETERMINATE_NO_RETRY` und muss zuerst im Resend-Dashboard geklärt werden.
Provider-ID, Antwortbody,
Schlüssel und Adressen werden weder ausgegeben noch als Artefakt gespeichert.

`STAGING_EMAIL_ACCEPTANCE=PASS` beweist nur den synthetischen Providerpfad.
Eine reale Signup-, Reset-, Mobile-Deep-Link- oder App-Benachrichtigungs-
Abnahme bleibt separat offen und benötigt zuerst eine geprüfte
Staging-Empfänger-Allowlist in sämtlichen produktiven Mailpfaden.

## Aktueller Status

Der Kontrollpfad ist Code-seitig vorbereitet, aber nicht ausgeführt. Die
Domain `mail.staging.fanmind.ch`, der eingeschränkte Key und das geschützte
GitHub-Environment sind externe Voraussetzungen. Es wurde durch diese
Vorbereitung keine E-Mail versendet und kein Provider-, DNS- oder Runtime-Wert
verändert.

## Primärquellen

- Resend: [API-Key-Berechtigungen](https://resend.com/docs/dashboard/api-keys/introduction)
- Resend: [sichere Testadressen](https://resend.com/docs/knowledge-base/what-email-addresses-to-use-for-testing)
- Resend: [Idempotency-Keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- GitHub: [Deployment-Environments](https://docs.github.com/en/rest/deployments/environments?apiVersion=2022-11-28)
- GitHub: [Deployment-Branch-Policies](https://docs.github.com/en/rest/deployments/branch-policies?apiVersion=2022-11-28)
