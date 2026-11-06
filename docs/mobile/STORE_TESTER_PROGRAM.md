# FanMind Store-Testerprogramm

## Android – vorbereiteter Ablauf

Die vollständige Android-Geräteabnahme startet auf ausdrückliche
Owner-Entscheidung erst, wenn das bestehende `1.0.0`-AAB aus einem
Google-Play-Test-Track zum Download steht. Der ältere direkte Preview-Install
ist weiterhin wertvolle Build-Evidence, ersetzt aber diesen finalen
Store-Installationsnachweis nicht.

Für nach dem 13. November 2023 erstellte persönliche Google-Play-Konten kann
vor Produktionszugang ein geschlossener Test mit mindestens 12 dauerhaft
eingetragenen Testern über 14 zusammenhängende Tage erforderlich sein. Ob
diese `12 Tester / 14 Tage`-Regel für das konkrete FanMind-Konto gilt,
entscheidet ausschließlich der aktuelle Portalstatus. Eine interne private
Liste mit möglichst 15 verfügbaren Personen reduziert das Risiko, dass ein
Opt-out die Mindestzahl unterschreitet. Namen und E-Mail-Adressen gehören nie
in Git.

Offizielle Referenzen:

- [Testanforderungen für neue persönliche Konten](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Test-Tracks einrichten](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)

## Android-Testsequenz nach Google-Freigabe

1. App-Datensatz anlegen und das bereits verifizierte Android-`1.0.0`-AAB
   hochladen. Keinen neuen Build starten.
2. Den im Portal verlangten Internal-/Closed-Test-Track und die private
   Testerliste einrichten.
3. Erst wenn die Play-Store-Testseite den Download anbietet, auf einem realen
   Android-Gerät von dort installieren.
4. Den privaten 19-Punkte-Nachweis aus `docs/mobile/DEVICE_ACCEPTANCE.md`
   vollständig durchführen: Login, Recovery positiv/negativ, Deep Link,
   Kernnavigation, Offline-Fail-Closed, Logout-Purge, Icon/Splash,
   Löschanfrage/Widerruf und No-Auto-Send.
5. Sechs reale Store-Screenshots ausschließlich aus einem synthetischen
   Workspace aufnehmen und auf sichtbare Identifikatoren prüfen.
6. Technisches Feedback, Crashfreiheit und Portalstatus sammeln; keine
   privaten Evidence-Dateien oder Testeridentitäten veröffentlichen.

## Testfragen

- Ist Installation und Updatepfad eindeutig dem Play-Test-Track zugeordnet?
- Funktionieren Start, Login, Recovery und Logout ohne versteckte Abhängigkeit?
- Bleiben Workspace- und Member-Rechte fail-closed?
- Wird offline nur die begrenzte verschlüsselte Kontaktübersicht angezeigt?
- Bleibt jeder Antwortvorschlag menschlich kontrolliert und ohne Auto-Send?
- Sind Icon, Splash, Texte und Navigationsziele lesbar und konsistent?
- Funktionieren Löschanfrage und Widerruf mit synthetischem Account?

## iPhone – nur vorbereitet

Für iPhone sind Testrollen, Screenshotmotive und Prüffragen vorbereitet. Ein
TestFlight-Programm, iOS-Build oder iPhone-Gerätetest ist noch nicht gestartet.
Interne TestFlight-Tester benötigen später App-Store-Connect-Zugang; externe
Tester können zusätzlich eine Apple-Beta-Review auslösen. Der tatsächliche
Kreis und die Geräte werden erst in Phase 8 festgelegt.

Da aktuell kein iPhone für die Owner-Abnahme verfügbar ist, bleiben reale
iOS-Installation, Push-/Recovery-Verhalten, Accessibility, Masken, Safe Areas
und Performance ausdrücklich offen. Ein Simulator kann Layout und Flüsse
vorprüfen, ersetzt aber nicht jede reale Gerätebeobachtung.
