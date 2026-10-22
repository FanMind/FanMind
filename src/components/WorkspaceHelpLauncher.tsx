"use client";

import { useEffect, useState } from "react";

/**
 * UI-only entry point. No account data, messages, or credentials leave the browser.
 * A server-authenticated support endpoint must be added before enabling chat.
 */
export function WorkspaceHelpLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open]);

  return (
    <aside aria-label="FanMind Hilfe" style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1000 }}>
      {open ? (
        <section
          id="fanmind-inapp-help-panel"
          aria-label="FanMind Hilfe"
          style={{ width: "min(340px, calc(100vw - 40px))", background: "#fff", color: "#14243a", border: "1px solid #cbd5e1", borderRadius: 12, padding: 16, marginBottom: 8, boxShadow: "0 12px 36px #0003" }}
        >
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Wie können wir helfen?</h2>
          <p style={{ margin: "0 0 12px" }}>Der persönliche Support-Chat wird vorbereitet. Eine Kontoprüfung oder Reparatur ist hier noch nicht verfügbar.</p>
          <button type="button" onClick={() => setOpen(false)}>Schließen</button>
        </section>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="fanmind-inapp-help-panel"
        onClick={() => setOpen((current) => !current)}
        style={{ background: "#0877d9", color: "#fff", border: 0, borderRadius: 24, padding: "12px 18px", fontWeight: 700, cursor: "pointer" }}
      >
        {open ? "Hilfe schließen" : "Hilfe"}
      </button>
    </aside>
  );
}
