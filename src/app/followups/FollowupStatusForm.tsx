"use client";

import type { FormEvent } from "react";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import type { FollowupRow } from "@/lib/supabase/server";
import dashboardStyles from "../dashboard/dashboard.module.css";
import { updateManualFollowupStatus } from "../fans/[id]/contextActions";

type Props = {
  followup: FollowupRow;
  contactId: string;
  locale: FanMindLanguage;
  returnTo: "contact" | "followups";
};

export function FollowupStatusForm({ followup, contactId, locale, returnTo }: Props) {
  const isCompleted = followup.status === "completed" || followup.status === "done";
  const nextStatus = isCompleted ? "open" : "completed";
  const label = isCompleted
    ? locale === "en"
      ? "Reopen"
      : "Wieder öffnen"
    : locale === "en"
      ? "Mark as completed"
      : "Als erledigt markieren";

  return (
    <form
      action={updateManualFollowupStatus}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        if (nextStatus !== "completed") return;
        const confirmed = window.confirm("Dieses Follow-up als erledigt markieren?");
        if (!confirmed) event.preventDefault();
      }}
    >
      <input name="contact_id" type="hidden" value={contactId} />
      <input name="followup_id" type="hidden" value={followup.id} />
      <input name="next_status" type="hidden" value={nextStatus} />
      <input name="return_to" type="hidden" value={returnTo} />
      <input name="lang" type="hidden" value={locale} />
      <button className={dashboardStyles.secondaryButton} type="submit">
        {label}
      </button>
    </form>
  );
}
