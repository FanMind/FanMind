import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { ContactForm } from "@/components/ContactForm";
import {
  EmptyState,
  LoadingState,
  Screen,
  SecondaryButton,
} from "@/components/ui";
import { getContact, updateContact } from "@/lib/data";
import {
  contactToDraft,
  type ContactDraft,
} from "@/lib/contactDraftPolicy.mjs";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import type { Contact } from "@/types";

export default function EditContactScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const contactId = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspace?.id || !contactId) {
      setContact(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await getContact(workspace.id, contactId);
    setContact(result.contact);
    setError(result.error);
    setLoading(false);
  }, [contactId, workspace?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(draft: ContactDraft) {
    if (!workspace?.id || !contactId) return;
    setBusy(true);
    setError(null);
    const result = await updateContact({
      workspaceId: workspace.id,
      workspaceRole: workspace.role,
      contactId,
      draft,
    });
    setBusy(false);
    setError(result.error);
    if (result.contact) {
      router.replace(`/(app)/contacts/${result.contact.id}`);
    }
  }

  if (workspaceLoading || loading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Kontakt wird geladen…" />
      </Screen>
    );
  }

  if (!workspace) {
    return (
      <Screen
        title="Kontakt bearbeiten"
        right={<SecondaryButton onPress={() => router.back()}>Zurück</SecondaryButton>}
      >
        <EmptyState
          title="Noch kein Workspace"
          description={
            workspaceError ??
            "Schließe zuerst das FanMind-Onboarding ab, bevor du Kontakte bearbeitest."
          }
        />
      </Screen>
    );
  }

  if (workspace.role !== "owner") {
    return (
      <Screen
        title="Kontakt bearbeiten"
        right={<SecondaryButton onPress={() => router.back()}>Zurück</SecondaryButton>}
      >
        <EmptyState
          title="Teamzugang · nur lesen"
          description="Kontakte können mit einem Teamzugang derzeit sicher gelesen, aber nicht bearbeitet werden."
        />
      </Screen>
    );
  }

  if (!contact) {
    return (
      <Screen
        title="Kontakt bearbeiten"
        right={<SecondaryButton onPress={() => router.back()}>Zurück</SecondaryButton>}
      >
        <EmptyState
          title="Kontakt nicht verfügbar"
          description={error ?? "Dieser Kontakt gehört nicht zu deinem Workspace."}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Kontakt bearbeiten"
      subtitle={contact.display_name}
      right={<SecondaryButton onPress={() => router.back()}>Abbrechen</SecondaryButton>}
    >
      <ContactForm
        initialValue={contactToDraft(contact)}
        submitLabel="Änderungen speichern"
        busy={busy}
        error={error}
        onSubmit={submit}
      />
    </Screen>
  );
}
