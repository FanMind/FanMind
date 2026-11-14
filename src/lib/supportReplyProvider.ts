import "server-only";

/** One transport for public and authenticated Support; never accepts billing identities. */
export class SupportProviderFailure extends Error {
  constructor(readonly definitelyRejected: boolean) { super("support_provider_unavailable"); }
}

export async function requestSupportReply(input: {
  key: string; model: string; system: string; content: string; signal: AbortSignal;
  maxOutputTokens: number; serviceTier?: string; reasoningEffort?: string;
}): Promise<{ text: string; usage: unknown }> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { Authorization: `Bearer ${input.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: input.model, store: false, max_output_tokens: input.maxOutputTokens,
      ...(input.serviceTier ? { service_tier: input.serviceTier } : {}),
      ...(input.reasoningEffort ? { reasoning: { effort: input.reasoningEffort } } : {}),
      input: [{ role: "system", content: input.system }, { role: "user", content: input.content }] }),
    signal: AbortSignal.any([input.signal, AbortSignal.timeout(20000)]),
  });
  // Network errors, timeouts and server failures never prove that no billable work occurred.
  if (!response.ok) throw new SupportProviderFailure([400, 401, 403, 404, 422, 429].includes(response.status));
  const data = await response.json();
  const text = typeof data.output_text === "string" ? data.output_text :
    (Array.isArray(data.output) ? data.output.flatMap((o: { content?: Array<{ type?: string; text?: string }> }) => o.content ?? [])
      .filter((c: { type?: string; text?: string }) => c.type === "output_text" && typeof c.text === "string")
      .map((c: { text: string }) => c.text).join("\n") : "");
  return { text, usage: data.usage };
}
