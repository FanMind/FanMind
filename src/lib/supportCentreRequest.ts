/** Limit bytes before allocation/JSON parsing; callers must authenticate first. */
export async function readSupportRequest(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_request");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw new Error("invalid_request");
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_request");
    return value as Record<string, unknown>;
  } finally { await reader.cancel().catch(() => undefined); }
}
