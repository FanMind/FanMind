import {
  normalizeAiPromptSettings,
  selectAiPromptContext,
} from "@/lib/aiPromptPolicy.mjs";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";

export type WorkspaceAiPromptProfile = {
  id: string;
  name: string;
  instruction: string;
  isActive: boolean;
  isDefault: boolean;
};

export type WorkspaceAiPromptSettings = {
  companyPrompt: string;
  profiles: WorkspaceAiPromptProfile[];
  updatedAt: string | null;
};

type WorkspaceAiPromptSettingsRow = {
  workspace_id: string;
  company_prompt: string;
  profiles: unknown;
  updated_at: string | null;
};

const EMPTY_SETTINGS: WorkspaceAiPromptSettings = {
  companyPrompt: "",
  profiles: [],
  updatedAt: null,
};

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
}

function serviceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function toPublicSettings(
  row: WorkspaceAiPromptSettingsRow | null | undefined,
): WorkspaceAiPromptSettings {
  if (!row) return EMPTY_SETTINGS;
  const normalized = normalizeAiPromptSettings({
    companyPrompt: row.company_prompt,
    profiles: row.profiles,
  });
  return {
    companyPrompt: normalized.companyPrompt,
    profiles: normalized.profiles.map(
      (profile: WorkspaceAiPromptProfile) => ({ ...profile }),
    ),
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceAiPromptSettings(
  workspaceId: string,
): Promise<{
  settings: WorkspaceAiPromptSettings;
  error: string | null;
}> {
  const key = serviceKey();
  if (!key || !validUuid(workspaceId)) {
    return {
      settings: EMPTY_SETTINGS,
      error: "KI-Prompt-Einstellungen sind momentan nicht verfügbar.",
    };
  }

  try {
    const url = new URL(getSupabaseRestUrl("workspace_ai_prompt_settings"));
    url.searchParams.set(
      "select",
      "workspace_id,company_prompt,profiles,updated_at",
    );
    url.searchParams.set("workspace_id", `eq.${workspaceId}`);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: getSupabaseHeaders(key),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return {
        settings: EMPTY_SETTINGS,
        error: "KI-Prompt-Einstellungen sind momentan nicht verfügbar.",
      };
    }

    const rows = (await response.json()) as WorkspaceAiPromptSettingsRow[];
    return {
      settings: toPublicSettings(rows[0]),
      error: null,
    };
  } catch {
    return {
      settings: EMPTY_SETTINGS,
      error: "KI-Prompt-Einstellungen sind momentan nicht verfügbar.",
    };
  }
}

export async function saveWorkspaceAiPromptSettings(input: {
  workspaceId: string;
  userId: string;
  companyPrompt: unknown;
  profiles: unknown;
}): Promise<{
  settings: WorkspaceAiPromptSettings | null;
  error: string | null;
}> {
  const key = serviceKey();
  if (
    !key ||
    !validUuid(input.workspaceId) ||
    !validUuid(input.userId)
  ) {
    return {
      settings: null,
      error: "KI-Prompt-Einstellungen konnten nicht gespeichert werden.",
    };
  }

  const normalized = normalizeAiPromptSettings(
    {
      companyPrompt: input.companyPrompt,
      profiles: input.profiles,
    },
    { assignIds: true },
  );

  try {
    const url = new URL(getSupabaseRestUrl("workspace_ai_prompt_settings"));
    url.searchParams.set("on_conflict", "workspace_id");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...getSupabaseHeaders(key),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        company_prompt: normalized.companyPrompt,
        profiles: normalized.profiles,
        updated_by_user_id: input.userId,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return {
        settings: null,
        error: "KI-Prompt-Einstellungen konnten nicht gespeichert werden.",
      };
    }
    const rows = (await response.json()) as WorkspaceAiPromptSettingsRow[];
    return {
      settings: toPublicSettings(rows[0]),
      error: null,
    };
  } catch {
    return {
      settings: null,
      error: "KI-Prompt-Einstellungen konnten nicht gespeichert werden.",
    };
  }
}

export async function getWorkspaceAiPromptContext(
  workspaceId: string,
  requestedProfileId: unknown,
  companyOnly = false,
) {
  const result = await getWorkspaceAiPromptSettings(workspaceId);
  if (result.error) {
    return selectAiPromptContext(EMPTY_SETTINGS, null);
  }
  return selectAiPromptContext(
    companyOnly ? { ...result.settings, profiles: [] } : result.settings,
    typeof requestedProfileId === "string" ? requestedProfileId : null,
  );
}
