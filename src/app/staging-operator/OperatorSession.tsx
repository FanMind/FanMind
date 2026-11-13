'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OperatorSession() {
  const router = useRouter();
  const [status, setStatus] = useState('Bereit.');
  const [busy, setBusy] = useState(false);
  async function resume() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/staging-operator/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (response.ok) { router.replace('/dashboard'); router.refresh(); }
      else {
        const outcome = await response.json().catch(() => null);
        const safeCodes = ['unavailable', 'origin_forbidden', 'body_forbidden', 'sign_in_required', 'configuration_unavailable', 'retry_later', 'operator_required', 'workspace_required', 'provider_unavailable'];
        const code = safeCodes.includes(outcome?.code) ? outcome.code : 'request_failed';
        setStatus(response.status === 401 ? 'Bitte einmal sicher anmelden. Die Sitzung ist abgelaufen oder wurde widerrufen.' : `Die Sitzung konnte nicht fortgesetzt werden. Bitte den Staging-Zugang prüfen. (${response.status}: ${code})`);
      }
    } catch { setStatus('Staging ist gerade nicht erreichbar. Bitte später erneut versuchen.'); }
    finally { setBusy(false); }
  }
  return <main style={{ padding: '2rem', maxWidth: '42rem', margin: 'auto' }}>
    <h1>FanMind Staging Operator</h1>
    <p>Setze deine bestehende Staging-Sitzung sicher fort.</p>
    <button type="button" onClick={resume} disabled={busy}>{busy ? 'Sitzung wird geprüft …' : 'Sitzung fortsetzen'}</button>
    <p role="status">{status}</p>
    <a href="/login">Sicher anmelden</a>
  </main>;
}
