"use client";
import { useState } from 'react';
import { inspectStagingFacebookIngress, activateStagingFacebookIngress } from './stagingFacebookIngressActions';
export function StagingFacebookIngressControls() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function run(activate: boolean) {
    setBusy(true);
    try {
      const result = await (activate ? activateStagingFacebookIngress() : inspectStagingFacebookIngress());
      setStatus(`Seitenabonnement: ${result.ok ? 'bestätigt' : result.code}. Messenger: ${result.messages ? 'aktiv' : 'fehlt'}. Kommentare: ${result.feed ? 'aktiv' : 'fehlt'}.`);
    } catch { setStatus('Seitenabonnement konnte nicht geprüft werden.'); }
    finally { setBusy(false); }
  }
  return <div>
    <button type="button" disabled={busy} onClick={() => run(false)}>Staging-Seitenabonnement prüfen</button>
    <button type="button" disabled={busy} onClick={() => run(true)}>Staging-Empfang aktivieren</button>
    <p role="status">{status}</p>
  </div>;
}
