"use server";
import { controlStagingFacebookIngress } from './facebookWebhookActions';
export async function inspectStagingFacebookIngress() { return controlStagingFacebookIngress(false); }
export async function activateStagingFacebookIngress() { return controlStagingFacebookIngress(true); }
