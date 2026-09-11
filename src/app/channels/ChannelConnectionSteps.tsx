export function ChannelConnectionSteps({ name }: { name: string }) {
  return <div aria-label={`So verbindest du ${name}`}>
    <ol>
      <li>Wähle „Verbinden“ in deinem FanMind-Account.</li>
      <li>Melde dich auf der offiziellen Seite von {name} an und bestätige den Zugriff.</li>
      <li>Du kehrst zu FanMind zurück. Hier siehst du dein verbundenes Konto und den verfügbaren Nachrichtenabruf.</li>
    </ol>
    <p>Benutzername, Passwort und eine zusätzliche Anmeldebestätigung gibst du direkt bei {name} ein. FanMind erhält dein Plattform-Passwort nicht. Wenn du dort bereits angemeldet bist, kann die erneute Passworteingabe entfallen.</p>
  </div>;
}
