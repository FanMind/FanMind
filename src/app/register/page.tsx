import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";
import { PUBLIC_DAILY_PLAN_ENABLED } from "@/lib/publicDailyPlanPolicy.mjs";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
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
  const enablePublicDailyTestPlan = PUBLIC_DAILY_PLAN_ENABLED && await getPublicDailyTestPlanEnabled();
  return <RegisterClient key={JSON.stringify([params.plan, params.option, params.test_plan, params.lang, enablePublicDailyTestPlan])} searchParams={params}
    enablePublicDailyTestPlan={enablePublicDailyTestPlan}
    paidActivationAvailable={paidActivationAvailable} />;
}
