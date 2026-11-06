const ALLOWED_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

const FANMIND_MUTATION_URL_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "FANMIND_APP_URL",
  "FANMIND_SITE_URL",
];

function httpOrigin(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

export function isTrustedMutationRequest(request, configuredUrls = []) {
  const requestOrigin = httpOrigin(request?.url);
  const suppliedOrigin = httpOrigin(request?.headers?.get?.("origin"));
  if (!requestOrigin || !suppliedOrigin) return false;

  const allowedOrigins = new Set([requestOrigin]);
  for (const configuredUrl of configuredUrls) {
    const origin = httpOrigin(configuredUrl);
    if (origin) allowedOrigins.add(origin);
  }
  if (!allowedOrigins.has(suppliedOrigin)) return false;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  return !fetchSite || ALLOWED_FETCH_SITES.has(fetchSite);
}

export function isTrustedFanMindMutationRequest(
  request,
  environment = process.env,
) {
  return isTrustedMutationRequest(
    request,
    FANMIND_MUTATION_URL_KEYS.map((name) => environment?.[name]),
  );
}

export function inspectDeclaredBodyLength(value, maximumBytes) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new TypeError("maximumBytes must be a positive safe integer");
  }
  if (value === null || value === undefined) return "unknown";
  const normalized = String(value).trim();
  if (!/^\d+$/u.test(normalized)) return "invalid";
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return "invalid";
  return parsed > maximumBytes ? "too_large" : "accepted";
}

async function readBoundedBodyBytes(request, maximumBytes) {
  const declaredLength = inspectDeclaredBodyLength(
    request.headers.get("content-length"),
    maximumBytes,
  );
  if (declaredLength === "invalid") {
    return { ok: false, reason: "invalid_content_length", value: null };
  }
  if (declaredLength === "too_large") {
    return { ok: false, reason: "payload_too_large", value: null };
  }

  const body = request?.body;
  if (body?.getReader) {
    const reader = body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, reason: "invalid_body", value: null };
        }
        totalBytes += value.byteLength;
        if (totalBytes > maximumBytes) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, reason: "payload_too_large", value: null };
        }
        chunks.push(value);
      }
    } catch {
      await reader.cancel().catch(() => undefined);
      return { ok: false, reason: "invalid_body", value: null };
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, reason: null, value: bytes };
  }

  try {
    const bytes = new TextEncoder().encode(await request.text());
    return bytes.byteLength > maximumBytes
      ? { ok: false, reason: "payload_too_large", value: null }
      : { ok: true, reason: null, value: bytes };
  } catch {
    return { ok: false, reason: "invalid_body", value: null };
  }
}

export async function readBoundedJsonRequest(request, maximumBytes) {
  const body = await readBoundedBodyBytes(request, maximumBytes);
  if (!body.ok) return body;
  try {
    const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(body.value);
    return { ok: true, reason: null, value: JSON.parse(rawBody) };
  } catch {
    return { ok: false, reason: "invalid_json", value: null };
  }
}

export async function readBoundedFormDataRequest(request, maximumBytes) {
  const body = await readBoundedBodyBytes(request, maximumBytes);
  if (!body.ok) return body;

  const contentType = request.headers.get("content-type")?.trim() ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (
    mediaType !== "application/x-www-form-urlencoded" &&
    mediaType !== "multipart/form-data"
  ) {
    return { ok: false, reason: "invalid_form_data", value: null };
  }

  try {
    const replay = new Request("https://fanmind.invalid/", {
      method: "POST",
      headers: { "content-type": contentType },
      body: body.value,
    });
    return { ok: true, reason: null, value: await replay.formData() };
  } catch {
    return { ok: false, reason: "invalid_form_data", value: null };
  }
}
