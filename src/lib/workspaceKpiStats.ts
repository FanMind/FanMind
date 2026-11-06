import { countUniqueFans } from "@/lib/fanIdentity";
import {
  getWorkspaceContacts,
  getWorkspaceOpenFollowups,
  type ContactRow,
} from "@/lib/supabase/server";

export type WorkspaceKpiStats = {
  totalFans: number;
  openFollowups: number;
};

export type FollowupCompletionRate = {
  completed: number;
  total: number;
  percentage: number;
};

export function calculateFollowupCompletionRate(
  open: number,
  completed: number,
): FollowupCompletionRate | null {
  if (
    !Number.isInteger(open) ||
    open < 0 ||
    !Number.isInteger(completed) ||
    completed < 0
  ) {
    return null;
  }

  const total = open + completed;

  if (total === 0) return null;

  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

export function getWorkspaceKpiStatsFromContacts(
  contacts: ContactRow[],
  openFollowups = 0,
): WorkspaceKpiStats {
  return {
    totalFans: countUniqueFans(contacts),
    openFollowups,
  };
}

export async function getWorkspaceKpiStats(
  workspaceId: string,
): Promise<WorkspaceKpiStats> {
  const [contactsResult, followupsResult] = await Promise.all([
    getWorkspaceContacts(workspaceId),
    getWorkspaceOpenFollowups(workspaceId),
  ]);

  return getWorkspaceKpiStatsFromContacts(
    contactsResult.contacts,
    followupsResult.followups.length,
  );
}
