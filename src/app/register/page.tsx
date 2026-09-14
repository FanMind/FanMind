import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";
import { isPublicDailyRegistrationRequest } from "@/lib/publicDailyPlanPolicy.mjs";
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
  const enablePublicDailyTestPlan = await getPublicDailyTestPlanEnabled();
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  if (!enablePublicDailyTestPlan && isPublicDailyRegistrationRequest({ planId: first(params.plan), testPlan: first(params.test_plan) })) {
    const english = first(params.lang) === "en";
    return <main><h1>{english ? "This offer is currently unavailable" : "Dieses Angebot ist derzeit nicht verfügbar"}</h1><p>{english ? "No different package has been selected for you." : "Es wurde kein anderes Paket für dich ausgewählt."}</p><a href={english ? "/register?lang=en" : "/register"}>{english ? "Show available packages" : "Verfügbare Pakete anzeigen"}</a><p><a href={english ? "/login?lang=en" : "/login"}>{english ? "Sign in to your existing account" : "Mit bestehendem Konto anmelden"}</a></p></main>;
  }
  return <RegisterClient searchParams={params}
    enablePublicDailyTestPlan={enablePublicDailyTestPlan}
    paidActivationAvailable={paidActivationAvailable} />;
}
