"use server";
import { inspectUnifiedInstagramIngress, syncUnifiedInstagramComments } from './instagramWebhookActions';
export async function inspectInstagramIngress() { return inspectUnifiedInstagramIngress(false); }
export async function activateInstagramIngress() { return inspectUnifiedInstagramIngress(true); }
export async function syncInstagramComments() { return syncUnifiedInstagramComments(); }
