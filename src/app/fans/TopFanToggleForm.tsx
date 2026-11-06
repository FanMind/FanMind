"use client";

import { useFormStatus } from "react-dom";
import dashboardStyles from "../dashboard/dashboard.module.css";
import { updateTopFanMark } from "./actions";

type TopFanToggleFormProps = {
  contactId: string;
  isTopFan: boolean | null;
  returnTo: string;
  compact?: boolean;
};

export function TopFanToggleForm({
  contactId,
  isTopFan,
  returnTo,
  compact = false,
}: TopFanToggleFormProps) {
  const marked = Boolean(isTopFan);

  return (
    <form
      action={updateTopFanMark}
      onSubmit={(event) => {
        if (marked && !window.confirm("Top-Fan-Markierung wirklich entfernen?")) {
          event.preventDefault();
        }
      }}
    >
      <input name="contact_id" type="hidden" value={contactId} />
      <input name="is_top_fan" type="hidden" value={marked ? "false" : "true"} />
      <input name="return_to" type="hidden" value={returnTo} />
      <SubmitButton compact={compact} marked={marked} />
    </form>
  );
}

function SubmitButton({ compact, marked }: { compact: boolean; marked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={marked ? dashboardStyles.secondaryButton : dashboardStyles.primaryButton}
      disabled={pending}
      type="submit"
    >
      {pending
        ? "Speichern ..."
        : compact
          ? marked
            ? "Top Fan entfernen"
            : "Top Fan markieren"
          : marked
            ? "Top-Fan-Markierung entfernen"
            : "Als Top Fan markieren"}
    </button>
  );
}
