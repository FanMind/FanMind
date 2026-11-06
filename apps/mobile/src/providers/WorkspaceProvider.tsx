import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { loadWorkspace } from "@/lib/data";
import { useAuth } from "@/providers/AuthProvider";
import type { Workspace } from "@/types";

export type WorkspaceRefreshResult = {
  workspace: Workspace | null;
  error: string | null;
  transportUnavailable: boolean;
};

type WorkspaceContextValue = {
  workspace: Workspace | null;
  loading: boolean;
  error: string | null;
  transportUnavailable: boolean;
  refresh: () => Promise<WorkspaceRefreshResult | null>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transportUnavailable, setTransportUnavailable] = useState(false);
  const activeUserId = useRef<string | null>(session?.user.id ?? null);

  useEffect(() => {
    activeUserId.current = session?.user.id ?? null;
  }, [session?.user.id]);

  const refresh = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setWorkspace(null);
      setError(null);
      setTransportUnavailable(false);
      setLoading(false);
      return {
        workspace: null,
        error: null,
        transportUnavailable: false,
      };
    }
    setLoading(true);
    const result = await loadWorkspace(userId);
    if (activeUserId.current !== userId) return null;

    const refreshResult: WorkspaceRefreshResult = {
      workspace: result.workspace,
      error: result.error,
      transportUnavailable: result.offlineEligible,
    };

    if (result.workspace) {
      setWorkspace(result.workspace);
      setError(null);
      setTransportUnavailable(false);
    } else {
      setWorkspace(null);
      setError(result.error);
      setTransportUnavailable(result.offlineEligible);
    }
    setLoading(false);
    return refreshResult;
  }, [session?.user.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ workspace, loading, error, refresh, transportUnavailable }),
    [error, loading, refresh, transportUnavailable, workspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace muss innerhalb des WorkspaceProvider verwendet werden.");
  }
  return value;
}
