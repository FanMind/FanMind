import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestAdmissionReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import RegisterClient from "./RegisterClient";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams: Promise<{
    lang?: string | string[];
    plan?: string | string[];
    option?: string | string[];
    ref?: string | string[];
    referral_code?: string | string[];
    test_plan?: string | string[];
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const paidActivationAvailable = isPaymentTermsActivationEnabled();
  // A login account creates no commercial Workspace. Authenticated setup still
  // requires fresh consent and all existing paid-activation gates.
  const enablePublicDailyTestPlan = paidActivationAvailable
    ? isInternalDailyTestAdmissionReady({
        windowEnabled: await getPublicDailyTestPlanEnabled(),
        workspaceProvisioningReady: await isInternalDailyTestWorkspaceProvisioningReady(),
        stripeConfig: getStripeConfigStatus(),
      })
    : false;
  return <RegisterClient searchParams={params}
    enablePublicDailyTestPlan={enablePublicDailyTestPlan}
    paidActivationAvailable={paidActivationAvailable} />;
}
