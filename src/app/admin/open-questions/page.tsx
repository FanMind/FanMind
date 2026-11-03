import { requirePlatformAdmin } from "@/lib/admin";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";
import { QuestionsPreview } from "./QuestionsPreview";

export default async function OpenQuestionsPage() {
  const user = await requirePlatformAdmin();
  return <AdminBillingShell user={user} title="Offene Fragen" subtitle="Interne Lernübersicht – derzeit ausschließlich synthetische Testdaten.">
    <AdminTabs activeTab="open-questions" />
    <QuestionsPreview />
  </AdminBillingShell>;
}
