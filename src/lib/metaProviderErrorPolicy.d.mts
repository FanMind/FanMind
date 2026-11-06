export type MetaProviderErrorDiagnostic = Readonly<{
  code: number | null;
  type: string | null;
}>;

export function sanitizeMetaProviderError(
  value: unknown,
): MetaProviderErrorDiagnostic;
