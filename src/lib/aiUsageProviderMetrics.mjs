function exactNonNegativeInteger(value) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function optionalDetailCounter(value) {
  if (value == null) return 0;
  return exactNonNegativeInteger(value);
}

export function normalizeOpenAiResponseUsage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const inputTokens = exactNonNegativeInteger(value.input_tokens);
  const outputTokens = exactNonNegativeInteger(value.output_tokens);
  const totalTokens = exactNonNegativeInteger(value.total_tokens);
  const inputDetails = value.input_tokens_details;
  const outputDetails = value.output_tokens_details;
  const cachedInputTokens = optionalDetailCounter(inputDetails?.cached_tokens);
  const cacheWriteTokensValue = optionalDetailCounter(inputDetails?.cache_write_tokens);
  const cacheCreationTokens = optionalDetailCounter(inputDetails?.cache_creation_tokens);
  const cacheWriteTokens = inputDetails?.cache_write_tokens == null
    ? cacheCreationTokens
    : cacheWriteTokensValue;
  const reasoningOutputTokens = optionalDetailCounter(outputDetails?.reasoning_tokens);

  if (
    inputTokens === null ||
    outputTokens === null ||
    totalTokens === null ||
    cachedInputTokens === null ||
    cacheWriteTokensValue === null ||
    cacheCreationTokens === null ||
    reasoningOutputTokens === null ||
    totalTokens !== inputTokens + outputTokens ||
    cachedInputTokens > inputTokens ||
    cacheWriteTokens > inputTokens ||
    reasoningOutputTokens > outputTokens
  ) {
    return null;
  }

  return {
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
  };
}
