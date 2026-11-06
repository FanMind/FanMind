"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "#06142c",
        color: "#f4f8ff",
      }}
    >
      <section
        style={{
          width: "min(100%, 38rem)",
          padding: "2rem",
          border: "1px solid rgba(93, 220, 255, 0.35)",
          borderRadius: "1.25rem",
          background: "rgba(5, 24, 52, 0.92)",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#72e6ff", fontWeight: 800, letterSpacing: "0.08em" }}>
          FANMIND
        </p>
        <h1>Diese Ansicht konnte gerade nicht geladen werden.</h1>
        <p style={{ color: "#c7d5e8", lineHeight: 1.6 }}>
          Es wurden keine technischen Details oder Inhalte angezeigt. Versuche es erneut oder
          kehre zum Dashboard zurück.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: 0,
              borderRadius: "999px",
              padding: "0.75rem 1.2rem",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
          <Link
            href="/dashboard"
            style={{
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "999px",
              padding: "0.75rem 1.2rem",
              color: "inherit",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Zum Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
