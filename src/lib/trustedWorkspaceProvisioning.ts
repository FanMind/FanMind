import "server-only";

import {
  CURRENT_PAYMENT_TERMS_VERSION,
  evaluatePaymentTermsSubmission,
} from "@/lib/paymentTermsActivationPolicy.mjs";
import type { SupabaseServerUser } from "@/lib/supabase/server";

export type TrustedProvisioningSelection =
  | { planId: "starter"; commercialOption: "starter_paid_setup" }
  | { planId: "starter"; commercialOption: "starter_no_setup_commitment" }
  | { planId: "pilot"; commercialOption: "internal_daily_test" };

export function parseTrustedProvisioningSelection(input: {
  planId?: unknown;
  commercialOption?: unknown;
}): TrustedProvisioningSelection | null {
  if (
    input.planId === "starter" &&
    input.commercialOption === "starter_paid_setup"
  ) {
    return { planId: "starter", commercialOption: "starter_paid_setup" };
  }
  if (
    input.planId === "starter" &&
    input.commercialOption === "starter_no_setup_commitment"
  ) {
    return {
      planId: "starter",
      commercialOption: "starter_no_setup_commitment",
    };
  }
  if (
    input.planId === "pilot" &&
    input.commercialOption === "internal_daily_test"
  ) {
    return { planId: "pilot", commercialOption: "internal_daily_test" };
  }
  return null;
}

export function buildTrustedProvisioningUser(
  user: SupabaseServerUser,
  selection: TrustedProvisioningSelection,
  paymentTermsAccepted: boolean,
  paymentTermsVersion: unknown,
  now = new Date(),
): SupabaseServerUser | null {
  if (!evaluatePaymentTermsSubmission({
    paymentTermsAccepted,
    paymentTermsVersion,
  }).ready) {
    return null;
  }

  const acceptedAt = now.toISOString();

  // ensureUserWorkspace still consumes a metadata-shaped compatibility input.
  // These security-relevant fields are overwritten here from an authenticated,
  // same-origin server request. Values in persistent Auth user_metadata are not
  // treated as acceptance or package authority.
  return {
    ...user,
    user_metadata: {
      ...(user.user_metadata ?? {}),
      plan: selection.planId,
      plan_id: selection.planId,
      commercialOption: selection.commercialOption,
      commercial_option: selection.commercialOption,
      payment_terms_accepted: true,
      payment_terms_version: CURRENT_PAYMENT_TERMS_VERSION,
      payment_terms_accepted_at: acceptedAt,
    },
  };
}
