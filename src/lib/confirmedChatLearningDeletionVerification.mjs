export const CONFIRMED_CHAT_LEARNING_SCHEMA_STATE = "preinstall";

function missingPostgrestResource(status, payload) {
  if (status !== 404 || !payload || typeof payload !== "object") return false;
  const code = String(payload.code ?? "");
  const message = String(payload.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

async function queryConfirmedChatLearningEmpty({
  fetchImpl,
  tableUrl,
  headers,
  schemaState,
  filters,
}) {
  let url;
  try {
    url = new URL(tableUrl);
  } catch {
    return { ok: false, evidence: "failed" };
  }
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, `eq.${value}`);
  }
  url.searchParams.set("select", "proposal_id");
  url.searchParams.set("limit", "1");

  const response = await fetchImpl(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!response) return { ok: false, evidence: "failed" };

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      schemaState === "preinstall" &&
      missingPostgrestResource(response.status, payload)
    ) {
      return { ok: true, evidence: "preinstall_absent" };
    }
    return { ok: false, evidence: "failed" };
  }

  if (!Array.isArray(payload) || payload.length !== 0) {
    return { ok: false, evidence: "failed" };
  }
  return { ok: true, evidence: "verified" };
}

export async function verifyConfirmedChatLearningContactDeletion({
  fetchImpl,
  tableUrl,
  headers,
  workspaceId,
  contactId,
  schemaState,
}) {
  if (
    typeof fetchImpl !== "function" ||
    !tableUrl ||
    !workspaceId ||
    !contactId ||
    !["preinstall", "installed"].includes(schemaState)
  ) {
    return { ok: false, evidence: "failed" };
  }

  return queryConfirmedChatLearningEmpty({
    fetchImpl,
    tableUrl,
    headers,
    schemaState,
    filters: {
      workspace_id: workspaceId,
      contact_id: contactId,
    },
  });
}

export async function verifyConfirmedChatLearningAccountDeletion({
  fetchImpl,
  tableUrl,
  headers,
  workspaceIds,
  userId,
  schemaState,
}) {
  if (
    typeof fetchImpl !== "function" ||
    !tableUrl ||
    !userId ||
    !Array.isArray(workspaceIds) ||
    new Set(workspaceIds).size !== workspaceIds.length ||
    workspaceIds.some((workspaceId) => !workspaceId) ||
    !["preinstall", "installed"].includes(schemaState)
  ) {
    return { ok: false, evidence: "failed" };
  }

  let evidence = "verified";
  for (const workspaceId of workspaceIds) {
    const workspaceResult = await queryConfirmedChatLearningEmpty({
      fetchImpl,
      tableUrl,
      headers,
      schemaState,
      filters: { workspace_id: workspaceId },
    });
    if (!workspaceResult.ok) return workspaceResult;
    if (workspaceResult.evidence === "preinstall_absent") {
      return workspaceResult;
    }
  }

  const confirmerResult = await queryConfirmedChatLearningEmpty({
    fetchImpl,
    tableUrl,
    headers,
    schemaState,
    filters: { confirmed_by: userId },
  });
  if (!confirmerResult.ok) return confirmerResult;
  if (confirmerResult.evidence === "preinstall_absent") {
    evidence = "preinstall_absent";
  }

  return { ok: true, evidence };
}
