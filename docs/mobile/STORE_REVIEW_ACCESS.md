# Store-Review-Zugang und Prüferhinweise

## Sicherheitsgrenze

Google und Apple benötigen für eine loginpflichtige App einen funktionierenden
Review-Zugang. Benutzername, Passwort, Recovery-Link, MFA-Seed und private IDs
stehen niemals im Repository, in einem PR, Issue, Screenshot oder Chat-Log.
Sie werden erst unmittelbar vor Einreichung in den geschützten Portal-Feldern
hinterlegt.

Der Review-Zugang ist ein dedizierter synthetischer Production-Testaccount mit
nicht realen Kontakt- und Nachrichtendaten. Er muss während der Review 24/7
verfügbar, mehrfach verwendbar und frei von ablaufenden Einmalpasswörtern,
Standortfiltern oder einem für den Prüfer nicht lösbaren MFA-Schritt sein. Nach
abgeschlossener Review wird er kontrolliert rotiert oder deaktiviert.

## Vor Portal-Eintrag prüfen

- Login im exakt eingereichten Store-Build funktioniert;
- Test-Workspace besitzt synthetische Kontakte, Kontaktwissen, einen
  Nachrichtenkontext und Follow-ups für die dokumentierten Prüfschritte;
- Account hat keine Admin-, Billing-, Provider- oder Service-Role-Rechte;
- Passwort ist nur im Store-Portal gespeichert und läuft während der Review
  nicht ab;
- Support kann den Accountstatus prüfen, ohne das Passwort anzufordern;
- Löschanfrage wird nur demonstriert, aber nicht versehentlich final ausgeführt.

## Englischer Review-Hinweis

```text
FanMind is an authenticated CRM and AI-assisted reply workspace. Sign in with
the reusable review credentials supplied in the protected review fields.

After sign-in:
1. Open Start to view synthetic contacts with unseen inbound context.
2. Open a contact to review channel-specific history and contact memory.
3. Generate reply suggestions. FanMind never sends a message automatically;
   the reviewer chooses whether to copy or share selected text.
4. Create or complete a follow-up.
5. Account deletion is available from Settings > Account and data.

No external social-media account, purchase or physical device permission is
required for these core review steps.
```

## Google-Play-spezifisch

Die App-Access-Anweisungen müssen in englischer Sprache vollständig sein und
den wiederverwendbaren Zugang enthalten. Google darf nicht an OTP, QR-Code,
regionalem Zugriff oder einem erst anzufordernden Freischaltprozess scheitern.

Offizielle Referenz:
[App access](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en-GB)

## Apple-spezifisch

Die Review Notes verweisen auf denselben synthetischen Ablauf. Ist später ein
besonderer Deep-Link oder eine nicht sichtbare Funktion für die Review nötig,
wird der exakte Weg im Portal ergänzt, nicht in Git. Support-URL und
Kontaktadresse müssen während der Review erreichbar bleiben.
