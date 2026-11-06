import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
} from "@/lib/supabase/server";
import { AccountDeletionClient } from "./AccountDeletionClient";
import styles from "./account-deletion.module.css";

export const metadata: Metadata = {
  title: "FanMind Account löschen",
  description:
    "Authentifizierter Prozess zum vollständigen Löschen eines FanMind-Accounts und der zugehörigen Daten.",
};

export const dynamic = "force-dynamic";

export default async function SettingsAccountDeletionPage() {
  const { data } = await getSupabaseServerUser();
  if (!data.user) {
    redirect("/login?returnTo=%2Fsettings%2Faccount-deletion");
  }
  if (!data.user.email) {
    redirect("/settings/profile?profile_error=Account-E-Mail%20ist%20nicht%20verf%C3%BCgbar.");
  }

  const workspaceResult = await getUserWorkspaceDashboard(data.user);

  return (
    <main className={styles.page}>
      <AccountDeletionClient
        accountEmail={data.user.email}
        workspaceName={workspaceResult.workspace?.name ?? null}
      />
    </main>
  );
}
