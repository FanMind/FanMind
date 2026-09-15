export type AdminCrmAccessMode = "permanent" | "temporary" | "blocked";

export type AdminCrmAccessTransition =
  | { ok: false; error: string }
  | {
      ok: true;
      values: Record<string, unknown> & {
        billing_status: string;
        billing_manual_override: boolean;
        workspace_access_mode: string;
        test_access_flags: Record<string, unknown>;
      };
    };

export function resolveAdminCrmAccessTransition(
  input: { mode?: unknown; expiresAt?: unknown },
  now?: Date,
): AdminCrmAccessTransition;

export function adminCrmAccessLabel(
  workspace: {
    billing_status?: string | null;
    billing_manual_override?: boolean | null;
    test_access_flags?: Record<string, unknown> | null;
  } | null | undefined,
  now?: Date,
): string;

export function isAdminCrmAccessWorkspace(
  workspace: { test_access_flags?: Record<string, unknown> | null } | null | undefined,
): boolean;
