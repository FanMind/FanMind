import { cookies } from "next/headers";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
} from "@/lib/supabase/config";
import {
  collectAllDisclosureContacts,
  DataDisclosureExportError,
  type DisclosureContactPageRequest,
  type DisclosureContactRow,
} from "./dataDisclosurePagination";

export {
  DATA_DISCLOSURE_CONTACT_MAX_ROWS,
  DATA_DISCLOSURE_CONTACT_PAGE_SIZE,
  DataDisclosureExportError,
  type DisclosureContactRow,
} from "./dataDisclosurePagination";

type FetchContactsInput = {
  workspaceId: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
  pageSize?: number;
  maxRows?: number;
};

const DISCLOSURE_CONTACT_COLUMNS = [
  "id",
  "workspace_id",
  "display_name",
  "handle",
  "source_platform",
  "language",
  "status",
  "tags",
  "summary",
  "internal_notes",
  "created_at",
  "updated_at",
].join(",");

async function fetchContactPage(input: {
  workspaceId: string;
  accessToken: string;
  request: DisclosureContactPageRequest;
  fetchImpl: typeof fetch;
}): Promise<DisclosureContactRow[]> {
  const url = new URL(getSupabaseRestUrl("contacts"));
  url.searchParams.set("select", DISCLOSURE_CONTACT_COLUMNS);
  url.searchParams.set("workspace_id", `eq.${input.workspaceId}`);
  url.searchParams.set("order", "created_at.asc.nullsfirst,id.asc");
  url.searchParams.set("limit", String(input.request.limit));
  url.searchParams.set("offset", String(input.request.offset));

  let response: Response;
  try {
    response = await input.fetchImpl(url, {
      method: "GET",
      headers: getSupabaseHeaders(input.accessToken),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new DataDisclosureExportError(
      "Kontakte konnten wegen eines Netzwerkfehlers nicht vollständig exportiert werden.",
    );
  }

  if (!response.ok) {
    throw new DataDisclosureExportError(
      `Kontakte konnten nicht vollständig exportiert werden (HTTP ${response.status}).`,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(payload)) {
    throw new DataDisclosureExportError(
      "Kontakte konnten nicht vollständig exportiert werden: ungültige Serverantwort.",
    );
  }

  return payload as DisclosureContactRow[];
}

export async function fetchAllWorkspaceContactsForDisclosure({
  workspaceId,
  accessToken,
  fetchImpl = fetch,
  pageSize,
  maxRows,
}: FetchContactsInput): Promise<DisclosureContactRow[]> {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedAccessToken = accessToken.trim();
  if (!normalizedWorkspaceId || !normalizedAccessToken) {
    throw new DataDisclosureExportError(
      "Autorisierter Workspace oder Sitzung fehlt für die Datenauskunft.",
    );
  }

  return collectAllDisclosureContacts({
    workspaceId: normalizedWorkspaceId,
    pageSize,
    maxRows,
    fetchPage: (request) =>
      fetchContactPage({
        workspaceId: normalizedWorkspaceId,
        accessToken: normalizedAccessToken,
        request,
        fetchImpl,
      }),
  });
}

export async function getAllWorkspaceContactsForDisclosure(
  workspaceId: string,
): Promise<DisclosureContactRow[]> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value?.trim();
  if (!accessToken) {
    throw new DataDisclosureExportError(
      "Die FanMind-Sitzung ist für die Datenauskunft nicht verfügbar.",
    );
  }

  return fetchAllWorkspaceContactsForDisclosure({
    workspaceId,
    accessToken,
  });
}
