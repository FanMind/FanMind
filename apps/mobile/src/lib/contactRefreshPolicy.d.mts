export function createContactLoadSequence(initialSearch?: string): {
  begin(): number;
  invalidate(): void;
  isCurrent(sequence: number): boolean;
  updateSearch(nextSearch: string): boolean;
};

type ContactLoadTarget<TWorkspace> = {
  workspace: TWorkspace | null;
  transportUnavailable: boolean;
};

export function resolveContactLoadTarget<TWorkspace>(
  current: ContactLoadTarget<TWorkspace>,
  refreshResult?: ContactLoadTarget<TWorkspace>,
): ContactLoadTarget<TWorkspace>;
