"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { updateReferralAdminCorrection } from "@/lib/referrals";
import type { ReferralStatus } from "@/lib/adminReferrals";

const allowedStatuses = new Set<ReferralStatus>(["pending", "qualified", "active", "inactive", "rejected", "locked_after_window_closed"]);

export async function updateReferralStatusAction(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as ReferralStatus;
  const adminNote = String(formData.get("adminNote") ?? "").trim();
  if (!id || !allowedStatuses.has(status)) return;
  await updateReferralAdminCorrection({ id, status, adminNote: adminNote || null });
  revalidatePath("/admin/referrals");
}
