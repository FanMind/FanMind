import { router } from "expo-router";
import { useState } from "react";

import { ContactForm } from "@/components/ContactForm";
import {
  EmptyState,
  LoadingState,
  Screen,
  SecondaryButton,
} from "@/components/ui";
import { createContact } from "@/lib/data";
import { emptyContactDraft, type ContactDraft } from "@/lib/contactDraftPolicy.mjs";
import { useWorkspace } from "@/providers/WorkspaceProvider";

export default function NewContactScreen() {
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(draft: ContactDraft) {
    if (!workspace?.id) return;
    setBusy(true);
    setError(null);
    const result = await createContact({
      workspaceId: workspace.id,
      workspaceRole: workspace.role,
      draft,
    });
    setBusy(false);
    setError(result.error);
    if (result.contact) {
      router.replace(`/(app)/contacts/${result.contact.id}`);
    }
  }

  if (workspaceLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Workspace wird geladen…" />
      </Screen>
    );
  }

  if (!workspace) {
    return (
      <Screen
        title="Kontakt anlegen"
        right={<SecondaryButton onPress={() => router.back()}>Zurück</SecondaryButton>}
      >
        <EmptyState
          title="Noch kein Workspace"
          description={
            workspaceError ??
            "Schließe zuerst das FanMind-Onboarding ab, bevor du Kontakte anlegst."
          }
        />
      </Screen>
    );
  }

  if (workspace.role !== "owner") {
    return (
      <Screen
        title="Kontakt anlegen"
        right={<SecondaryButton onPress={() => router.back()}>Zurück</SecondaryButton>}
      >
        <EmptyState
          title="Teamzugang · nur lesen"
          description="Kontakte können mit einem Teamzugang derzeit sicher gelesen, aber nicht angelegt werden."
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Kontakt anlegen"
      subtitle="Manuell, sicher und direkt in deinem Workspace"
      right={<SecondaryButton onPress={() => router.back()}>Abbrechen</SecondaryButton>}
    >
      <ContactForm
        initialValue={emptyContactDraft()}
        submitLabel="Kontakt anlegen"
        busy={busy}
        error={error}
        onSubmit={submit}
      />
    </Screen>
  );
}
