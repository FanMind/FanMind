"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body style={{ margin: 0, background: "#06142c", color: "#f4f8ff" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <section style={{ width: "min(100%, 38rem)", textAlign: "center" }}>
            <p style={{ color: "#72e6ff", fontWeight: 800, letterSpacing: "0.08em" }}>
              FANMIND
            </p>
            <h1>FanMind konnte gerade nicht vollständig geladen werden.</h1>
            <p style={{ color: "#c7d5e8", lineHeight: 1.6 }}>
              Es werden keine technischen Fehlerdetails angezeigt. Bitte versuche den sicheren
              Neustart dieser Ansicht.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: "999px",
                padding: "0.8rem 1.25rem",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Ansicht neu laden
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
