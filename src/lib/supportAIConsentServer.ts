import "server-only";
import {supportCentreDatabase} from "./supportCentreServer";
import {SUPPORT_AI_CONSENT_VERSION,consentState} from "./supportAIConsentPolicy";
export async function readSupportAIConsent(actor:string){return consentState(await supportCentreDatabase("rpc/support_ai_consent_state",{p_actor:actor,p_version:SUPPORT_AI_CONSENT_VERSION}));}
