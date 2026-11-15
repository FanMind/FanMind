# Meta App Review — Vorbereitung #1480 / #1464

**Neue Owner-Freigabe15.11.2026:** vollständige Einreichung nach echten
Pflichtnachweisen und geschütztem Umfangsabgleich grundsätzlich genehmigt.
Keine erneute allgemeine Freigabe nötig. Spätere Production ist nur für diese
Integration nach Meta-Freigabe, vollständiger Staging-Fachabnahme und allen
Production-/Backup-/Restore-Gates genehmigt; noch nicht durchgeführt.
IconPASS und alte10CI-PASS sind übernommen, kein Kontoabonnement-PASS.

**Aktualisierung15.11.2026:** Maßgeblicher neuer Fragebogen-/Teilfreigabe-/
Betriebs-/API-Stand in der [konkreten Antwortmatrix](META_DATA_HANDLING_QUESTION_MATRIX_20261115.md).
Externe anwaltliche Schlussprüfung vorerst zurückgestellt, kein positives
Rechtsergebnis. Operative Rolle ausdrücklich übernommen. Fallraum mit
Owner-only/MFA und acht Assistenz-Tischfällen vorbereitet, menschliche
Einweisung/externer Transfer nicht vollständig abgenommen. Aktuelle Meta-
Anzeige: basicAbgeschlossen, messages1Testaufruf, comments0von1.
Die nachfolgenden14.11.-Anzeigen bleiben historisch; kein Abonnement-PASS.

Stand14.11.2026 · ZUR FREIGABE VORBEREITET · keine Einreichung/Freischaltung.
Genau `instagram_basic`, `instagram_manage_messages`,
`instagram_manage_comments`. Bestehende App und Token erhalten. Keine neue
Autorisierung, Berechtigung, Provideranfrage, Laufzeit- oder Productionänderung.
Geschützte App-/Konto-/Antragsdetails und der bestehende Supporttext bleiben
im privaten Statusbericht; keine Originalantworten/Trace-IDs hier hinterlegen.

## 1. Nachweismatrix

| Anforderung | Beleg/Stand | Offener Abschluss |
| --- | --- | --- |
| Unternehmensverifizierung | Im bisherigen offiziellen Dialog Verified zurückgelesen | Keine Wiederholung |
| Tech-Anbieter-Einstufung | Owner-freigegeben durchgeführt; Reviewpfad danach verfügbar | Separate Access Verification dadurch nicht abgeschlossen |
| Reviewauswahl | Zuletzt nach Neuladen exakt drei Instagram-Rechte, nicht eingereicht | Vor finaler Einreichung erneut lesen |
| Standard Access / Tester | Bestehende App-Rolle und angenommene Instagram-Testerrolle dokumentiert | Für eigene berechtigte Testkonten getrennt von externen Konten bewerten |
| Advanced Access / App Review | Noch nicht erteilt | Nutzungsbelege, Erklärungen und echte Reviewer-Demo fehlen |
| Separate Access Verification | Bisher angeboten, nicht nachgewiesen abgeschlossen | Offiziellen Dialog und verlangte Nachweise vor Einreichung prüfen |
| Nachrichten-/Kommentar-App-Webhooks | Beide Felder aufv27 dokumentiert | App-Konfiguration ist kein Kontoabonnement |
| Kontoabonnement | GET/POST HTTP400, Code100/Subcode33, object_unavailable | Kein PASS, genaue Providerursache nicht nachgewiesen |
| Unabhängiger Kontozugriff | Bestehender gleichgebundener Kommentarabgleich:0Medien,0Kommentare | Kein erfolgreicher Kommentar-API-Aufruf daraus ableitbar |
| Kommentar-Testbadge | Zuletzt offiziell0von1 | Tatsächlicher berechtigter Kommentar-Aufruf und providerseitige Zählung fehlen |
| Weitere API-Testanzeigen, frisch14.11.2026 gelesen | instagram_basic0von1; instagram_manage_messages0API-Testaufrufe | Nachrichtenanzeige enthält hier keine1-Aufruf-Mindestanforderung; trotzdem kein echter Nutzungsnachweis |
| Behördenprozesse | Betreiberzustimmung zur unveränderten Fassung unter Prüfvorbehalten übermittelt; [Status](../legal/AUTHORITY_REQUEST_RELEASE_STATUS.md) | Qualifizierte Rechtsprüfung, tatsächlicher Fallraum/Transfer, Rollen/Vertretung und Übung offen |
| Historische Sicherheitsanfragen | Owner am14.11.2026 ausdrücklich: keine national-security-bedingte Weitergabe14.11.2025–einschließlich14.11.2026 | [Begrenzter Tatsachennachweis](../legal/META_NATIONAL_SECURITY_ATTESTATION_20261114.md); keine Ausweitung auf andere Fragen |
| Anbieter/DPA/Region/Transfers | Bestehende Kandidaten und offenes externes Register | Tatsächliche Empfänger-/Kontobelege und fachliche Rollenprüfung |

Der Reviewdialog und die Instagram-Testanzeige wurden am14.11.2026 in der
Fortsetzung wieder tatsächlich gelesen. HistorischesNo ist automatisch
gespeichert. Die drei ausgewählten Rechte bleiben unverändert. Ein früherer
Fokus-/CDP-Timeout ist kein aktueller Portal-Blocker mehr. Testdaten können laut
aktuellem Dialog bis24Stunden verzögert sein und sind jeweils30Tage gültig.

## 2. API-Nachweis und Fehler100/33

Quellnachweis `src/lib/instagramIntegration.ts`:
`verifyUnifiedInstagramCredential` prüft Token/App und zugeordnetes Konto;
`fetchInstagramOwnComments` ruft zuerst `/{accountId}/media` ab und erst
innerhalb der Schleife über erhaltene Medien `/{postId}/comments`.
Bei leerer Medienliste findet kein Kommentaraufruf statt. Der dokumentierte
Null-Lauf belegt deshalb keinen gezählten Aufruf für `instagram_manage_comments`.
Ein lokaler Test, eine Webhook-Testsimulation, ein Token-Scope oder das bloße
Öffnen des Portals ersetzt den tatsächlichen Providerbeleg nicht.

Nächster zulässiger Nachweisweg: vorhandenes eigenes, rechtmäßig zugängliches
Medium und dessen echte Kommentare mit derselben App/Kontobindung über den
bestehenden freigegebenen Pfad lesen; nur bei tatsächlichem erfolgreichen
Aufruf als genutzt dokumentieren. Neue Testinhalte werden erst nach bestätigtem
Kontoabonnement angefordert. Keine Abfrage eines geratenen/fremden Medienobjekts,
keine zusätzlichen Scopes und kein wiederholter Blindaufruf.
Danach Metas Anzeigeverzögerung (im Dialog bis24Stunden) berücksichtigen und
das tatsächliche Badge lesen. Eine Wartezeit ist kein Erfüllungsnachweis.

Die ausstehende Advanced-Freigabe ist für externe Konten relevant; die separate
Webhook-Kommentaranforderung ist fachlich zu beachten. Sie erklärt nicht
automatisch exakt100/33 bei dieser eigenen Testbindung. Die erfolgreiche
Unternehmensverifizierung oder Tech-Einstufung beweist ebenso keine Behebung.
Kein Codefehler ist hier neu nachgewiesen. Keine Änderung auf Verdacht.

100/33 blockiert die nachgewiesene Ende-zu-Ende-Eingangsprüfung: ohne bestätigtes
Abonnement keine Abnahme des automatischen DM-/Kommentareingangs, der Kontakt-
zuordnung, Kanaltrennung oder Dublettenvermeidung. Nicht jede isolierte
Leseoperation ist dadurch zwingend unmöglich. Bestehenden technischen
Supportfall bei weiter ungeklärter Kombination verwenden; Freigabefragen und
Providerobjektfehler getrennt vorlegen. Keine Veröffentlichung ohne Prüfung;
erforderliche Trace-IDs ausschließlich im geschützten Meta-Kanal behandeln.

## 3. Englische Nutzungsbeschreibungen — zur Prüfung, noch nicht bestätigt

### instagram_basic

FanMind is a communication management platform for professional creators.
We use instagram_basic to identify the professional Instagram account that
the creator explicitly connects and to associate its profile and own media
with that creator's authorized FanMind workspace. This account binding is
required to keep Instagram records separated from other creators' records
and to display the connected account in channel settings. We do not request
access to unrelated accounts. External-creator access is the purpose of this
review; it is not claimed to be generally approved or available today.

### instagram_manage_messages

FanMind requests instagram_manage_messages so an authorized professional
creator can receive and organize Instagram direct-message conversations in
their own FanMind workspace. Incoming messages are associated with the
corresponding Instagram contact and displayed in the direct-message
conversation. The creator can review the conversation and prepare a response.
FanMind does not automatically send messages. The intended review demonstration
will show a real permitted inbound message and its account/workspace binding;
that end-to-end Instagram demonstration remains pending successful account
subscription and must not be represented as completed in this draft.

### instagram_manage_comments

FanMind requests instagram_manage_comments to read and organize comments on
media belonging to the professional Instagram account explicitly connected by
the creator. Comments are associated with the corresponding contact and shown
as comments, separately from direct-message conversations. The creator can
review the comment and open its original Instagram context. We are not
requesting this permission to access unrelated accounts' comments or to
automatically post, delete or moderate comments. A real successful comment
API call and end-to-end screencast are still required before submission.

Before final use remove only the draft-status sentences after their conditions
are actually fulfilled; verify each claimed screen/action against the real UI.
Do not turn intended external-creator access into a present-tense deployment claim.

## 4. Englische Datenverarbeitungsantworten — bedingte Arbeitsfassung

**Responsible person/entity and country:** use the existing verified legal
operator exactly as held in the private dossier, Austria. Operational contact
is not substituted for legal responsibility. Review controller/processor roles
for the Meta app and customer-directed CRM processing before certification.

**Processors/service providers:** do not answerNo. Existing architecture
identifies hosting and database/auth/storage providers and conditional AI
processing. Verify the exact contracting entities and whether each receives
Meta Platform Data. Draft: "FanMind uses service providers for hosting and
database/authentication/storage. Where an authorized AI feature processes
selected communication content, the configured AI service provider also
processes that content. The final provider list is limited to verified actual
data recipients and their actual services." This is an internal drafting note,
not a complete provider list ready for the form. Account-specific DPA, region,
transfer and recipient evidence remain in the existing external register.
Do not include payment/email providers solely because they exist; examine
actual Meta-data access, including operational access and diagnostic flows.

**National-security requests in the past12months:** confirmed by the Owner on
14November2026 for14November2025 through14November2026 inclusive:

"No. FanMind has not disclosed Meta user personal data to government authorities
in response to national security requests during the specified 12-month period."

Source: [explicit Owner attestation](../legal/META_NATIONAL_SECURITY_ATTESTATION_20261114.md).
The correspondingNo selection is saved in the existing official draft. This
confirms only that historical fact, not other requests, future periods, legally
reviewed procedures or completed operating safeguards. No submission is authorized.


**Review legality / challenge unlawful requests / minimize disclosure /
document requests and responses:** no implemented-process checkbox is yet
supported solely by the new documents. After real adoption and verification,
the following wording may be used, subject to the exact question:

"FanMind verifies the requesting authority's identity and jurisdiction and
obtains human legal review of the legal basis, scope and proportionality before
disclosing personal data. Requests with unresolved deficiencies are held for
clarification; unlawful or disproportionate requests are rejected, narrowed or
challenged through the appropriate legal route. Any disclosure requires
documented authorization by the legal operator, is limited to the legally
required data and is transmitted through an approved secure channel. A
restricted case record tracks the request, legal assessment, decisions,
approvals, response, disclosure scope and retention/deletion review."

This wording describes the proposed procedure; do not paste it as a claim of
operating practice before the introduction evidence is complete. Neither
"none of these" nor "prohibited from answering" is a substitute for an unknown
or unfinished process. Prepare the final selection after resolving the gaps.

## 5. Screencast and reviewer package

Use a dedicated authorized review workspace, real eligible Meta accounts with
the participants’ permission, and synthetic test content. Never create fake
Facebook/Instagram identities for review. Do not record tokens, passwords, private fan content,
unrelated workspaces or identity documents. Provide protected test access via
Meta's intended reviewer field only after checking its least-privilege scope;
no credentials in GitHub or this plan. No fresh OAuth is performed by this task.

| Sequence | Actual action to record after prerequisites | Evidence / stop condition |
| --- | --- | --- |
| 1 | Show FanMind entry, sign-in and exact navigation to channel settings | Current reviewed build and actual UI; cut password entry |
| 2 | Show connected professional account and its workspace | Existing connection, no secret or unrelated account; explain reviewer path |
| 3 | Show successful account subscription to the correct app with messages/comments | Readback must confirm both; stop if100/33 or mismatch |
| 4 | Show own profile/media used by the account | Real permitted API result; no empty-result substitute for comments |
| 5 | After subscriptionPASS ask Owner for one new synthetic DM | Show automatic arrival, correct contact, DM conversation |
| 6 | After subscriptionPASS ask for a synthetic comment on own medium | Show actual comment, contact and separate comment thread/original context |
| 7 | Repeat existing safe sync or receive permitted retry | Same source IDs stay unique; no duplicated contacts/messages/comments |
| 8 | Show human response preparation/open-original flow | Only actual controls; no claim of automatic sending |
| 9 | Show existing privacy/deletion entry and disconnect information | Verify actual behavior; do not erase live creator data for a video |

Annotate each video with the permission it demonstrates, exact clicks, expected
results and reviewer instructions. Agree the final language/duration with the
current official form. Link video and permission, do not provide a staged UI
mock as evidence. Record counts and sanitized build evidence separately.

The current Unified staging pilot is explicitly account/workspace-bound.
Do not assume an external reviewer can connect another account or access an
operator-only route. Before submission verify that Meta reviewers have a
lawful reproducible testing route without opening foreign workspaces or
weakening the existing restriction. If no route exists, document that blocker
and prepare its narrow follow-up separately; do not silently broaden this task.

## 6. Final release checklist — all still independent

- [x] Operator consent to exact head8dc11de / procedure SHA2567d1fb132… was explicitly relayed by the Owner, with legal/verification reservations; not an independently authenticated signature.
- [ ] Qualified legal review; assigned handling/representation, secure case space/transfer and actual exercise evidence remain open.
- [x] Historical national-security answer expressly confirmed by the Owner on14.11.2026 for14.11.2025–14.11.2026 inclusive; limited attestation recorded.
- [ ] Actual Meta-data recipients, legal entities, DPA/regions/transfers verified.
- [ ] Separate Access Verification requirements read and satisfied where required.
- [ ] Real API evidence for each requested permission and current provider badges.
- [ ] Correct account subscription readbackPASS, then realDM/comment acceptance.
- [ ] Reproducible safe reviewer access and real matching screencasts available.
- [ ] Exactly three scopes, policy/deletion URLs, app mode and all answers reviewed.
- [ ] Final Owner approval of exact complete submission; only then submit.

This documentation introduces no runtime/data/permission change, no new
compliance service, and no API retry. Passing source checks is not legal
approval, Meta approval, Staging acceptance or permission to merge/deploy.

## Official review references

- [Meta: common App Review mistakes](https://developers.facebook.com/docs/app-review/submission-guide/common-mistakes): actual reviewer access, current functionality and permission-specific recordings; no fake Facebook account.
- [Meta: Instagram webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-instagram): check the documented Advanced Access requirement separately from an app-dashboard field subscription. The current account-edge error is not thereby diagnosed.

The existing external register has27 controls across the whole business. Its25
pending controls are not all automatically Instagram-review prerequisites:
map actual Meta-data recipients and the relevant legal/retention controls to
the form. Unrelated tax/payment controls are neither changed nor declared a
new blocker for this preparation.

## Konkrete Betriebs- und Kontonachweise dieser Fortsetzung

Der bestehende FanMind-Unternehmensordner im verbundenen Drive wurde nur auf
Metadaten und vorhandene Dokumentnamen geprüft. Ergebnis: nicht geteilt, eine
Owner-Berechtigung, kein offener Link/Domain-/Gruppenzugriff in der gelesenen
Berechtigungsliste. Das ist ein konkreter Ablagekandidat; Zuordnung des Owners
zur befugten Betreiberrolle, MFA, Audit, Entzug/Recovery und Übermittlungsweg
sind damit noch nicht geprüft. Keine Rechte erweitert und keine echten
Fall-/Creator-/Credential-Dateien geöffnet. Kein produktiver Fallraum eingerichtet.

Gezielte Suche nach FanMind-DPA-/Vertragsbelegen in der verbundenen Ablage
lieferte keine passenden Treffer. Das beweist weder fehlende Verträge noch
derzeit gültige Annahmen. Vorhandene DPA-/Region-/Transfer-Controls bleiben
pending; keine pauschale externe Bestätigung aus öffentlichen Vertragstexten.
Die konkrete Schlussprüfungs-/Einweisungsvorlage steht in Abschnitt12 des
Behördenverfahrens. Sie benennt die jetzt tatsächlich fehlenden persönlichen
Freigaben und Zugriffsnachweise statt die allgemeine Einführung erneut abzufragen.
