export function buildWebRegistrationRedirect(origin: string, language?: string): string;
export function buildRegistrationAccountMetadata(input: Record<string, unknown>): Record<string, unknown>;
export function readWebRegistrationSession(input?: { hash?: string; search?: string }): {
  access_token: string; refresh_token: string; expires_in: number;
} | null;
export function registrationErrorMessage(error: unknown, language?: string): string;
