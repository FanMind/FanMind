const META_PROVIDER_ERROR_TYPE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u;

export function sanitizeMetaProviderError(value) {
  const error =
    value && typeof value === "object" && !Array.isArray(value) ? value : null;
  const code =
    Number.isSafeInteger(error?.code) && error.code >= 0 && error.code <= 999_999
      ? error.code
      : null;
  const candidateType =
    typeof error?.type === "string" ? error.type.trim() : "";
  const type = META_PROVIDER_ERROR_TYPE.test(candidateType)
    ? candidateType
    : null;
  return Object.freeze({ code, type });
}
