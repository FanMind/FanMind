"use client";

import { useActionState } from "react";
import { syncFacebookCommentsFromChannelPage } from "./metaSyncActions";

export function FacebookCommentSyncForm({ disabled, authorized }: {
  disabled: boolean;
  authorized: boolean;
}) {
  const [state, action, pending] = useActionState(
    syncFacebookCommentsFromChannelPage,
    null,
  );

  return (
    <form action={action} aria-busy={pending}>
      <button
        type="submit"
        disabled={disabled || !authorized || pending}
        title={authorized ? undefined : "Zuerst die Kommentar-Berechtigung bei Meta freigeben"}
      >
        {pending ? "Facebook-Kommentare werden abgerufen …" : "Facebook-Kommentare jetzt synchronisieren"}
      </button>
      <p role="status" aria-live="polite">
        {pending ? "Kommentarabruf läuft …" : state ? (
          state.ok ? (
            <>
              {state.continuationPending ? "Teilabgleich abgeschlossen. Weitere Kommentare warten auf Fortsetzung." : "Kommentarabruf abgeschlossen."}
              {" "}{state.postsChecked} Beiträge geprüft · {state.commentsChecked} Kommentare gefunden · {state.importedCount} neu importiert.
              {state.commentsChecked === 0 ? " In den geprüften Beiträgen wurden keine Kommentare gefunden." : null}
              {" "}Abruf: {new Date(state.fetchedAt).toLocaleString("de-AT")}.
            </>
          ) : "Kommentarabruf fehlgeschlagen. Verbindung und Kommentar-Berechtigung prüfen."
        ) : null}
      </p>
    </form>
  );
}
