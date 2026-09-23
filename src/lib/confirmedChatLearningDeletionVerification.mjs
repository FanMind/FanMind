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

  let url;
  try {
    url = new URL(tableUrl);
  } catch {
    return { ok: false, evidence: "failed" };
  }
  url.searchParams.set("workspace_id", `eq.${workspaceId}`);
  url.searchParams.set("contact_id", `eq.${contactId}`);
  url.searchParams.set("select", "proposal_id");
  url.searchParams.set("limit", "1");

  const response = await fetchImpl(url, {
    headers,
    cache: "no-store",
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
