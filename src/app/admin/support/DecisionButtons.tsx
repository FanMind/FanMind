"use client";
import { useState } from "react";

export function DecisionButtons({ workspace, id }: { workspace: string; id: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function decide(decision: "approve" | "reject") {
    setState("busy");
    try {
      const response = await fetch("/api/admin/support/decision", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace, id, decision }) });
      if (!response.ok) throw new Error("unavailable");
      setState("done");
      window.location.reload();
    } catch { setState("error"); }
  }
  return <div>
    <button type="button" disabled={state !== "idle"} onClick={() => void decide("approve")}>Freigeben und einmal prüfen</button>{" "}
    <button type="button" disabled={state !== "idle"} onClick={() => void decide("reject")}>Ablehnen</button>
    {state === "busy" && <p role="status">Entscheidung und Nachprüfung werden protokolliert …</p>}
    {state === "error" && <p role="alert">Ergebnis nicht bestätigt. Bitte neu laden und Verlauf prüfen. Keine erneute Ausführung starten.</p>}
  </div>;
}
