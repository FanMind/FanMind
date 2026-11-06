export const DATA_DISCLOSURE_CONTACT_PAGE_SIZE = 500;
export const DATA_DISCLOSURE_CONTACT_MAX_ROWS = 50_000;

export type DisclosureContactRow = {
  id: string;
  workspace_id: string;
  display_name: string;
  handle: string | null;
  source_platform: string | null;
  language: string | null;
  status: string | null;
  tags: string[] | null;
  summary: string | null;
  internal_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export class DataDisclosureExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataDisclosureExportError";
  }
}

export type DisclosureContactPageRequest = {
  offset: number;
  limit: number;
};

type CollectDisclosureContactsInput = {
  workspaceId: string;
  fetchPage: (
    request: DisclosureContactPageRequest,
  ) => Promise<DisclosureContactRow[]>;
  pageSize?: number;
  maxRows?: number;
};

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || !value || value < 1) return fallback;
  return Math.min(value, maximum);
}

export async function collectAllDisclosureContacts({
  workspaceId,
  fetchPage,
  pageSize: requestedPageSize,
  maxRows: requestedMaxRows,
}: CollectDisclosureContactsInput): Promise<DisclosureContactRow[]> {
  const normalizedWorkspaceId = workspaceId.trim();
  if (!normalizedWorkspaceId) {
    throw new DataDisclosureExportError(
      "Autorisierter Workspace fehlt für die Datenauskunft.",
    );
  }

  const pageSize = normalizePositiveInteger(
    requestedPageSize,
    DATA_DISCLOSURE_CONTACT_PAGE_SIZE,
    1_000,
  );
  const maxRows = normalizePositiveInteger(
    requestedMaxRows,
    DATA_DISCLOSURE_CONTACT_MAX_ROWS,
    250_000,
  );
  const contacts: DisclosureContactRow[] = [];
  const seenIds = new Set<string>();
  let offset = 0;

  while (contacts.length < maxRows) {
    const limit = Math.min(pageSize, maxRows - contacts.length);
    const page = await fetchPage({ offset, limit });

    if (!Array.isArray(page) || page.length > limit) {
      throw new DataDisclosureExportError(
        "Kontakte konnten nicht vollständig exportiert werden: ungültige Seitengröße.",
      );
    }

    for (const row of page) {
      if (!row || row.workspace_id !== normalizedWorkspaceId || !row.id) {
        throw new DataDisclosureExportError(
          "Datenauskunft wurde abgebrochen, weil eine Kontaktzeile nicht zum autorisierten Workspace gehört.",
        );
      }
      if (seenIds.has(row.id)) {
        throw new DataDisclosureExportError(
          "Datenauskunft wurde abgebrochen, weil die paginierte Kontaktliste nicht stabil war.",
        );
      }
      seenIds.add(row.id);
      contacts.push(row);
    }

    if (page.length < limit) return contacts;
    offset += page.length;
  }

  const probe = await fetchPage({ offset, limit: 1 });
  if (!Array.isArray(probe) || probe.length > 1) {
    throw new DataDisclosureExportError(
      "Kontakte konnten nicht vollständig exportiert werden: ungültige Prüfseite.",
    );
  }
  if (probe.length) {
    throw new DataDisclosureExportError(
      `Der Workspace enthält mehr als ${maxRows} Kontakte. Der Export wurde ohne Datenabschneidung abgebrochen.`,
    );
  }

  return contacts;
}
