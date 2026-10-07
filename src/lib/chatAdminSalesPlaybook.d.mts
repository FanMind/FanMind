import type { CreatorOffer, CreatorPlaybook } from "./creatorIntelligencePolicy.mjs";
export const CHAT_ADMIN_OFFER_CATEGORIES: ReadonlyArray<Readonly<{id:string;name:string;category:string}>>;
export function defaultChatAdminSalesPlaybook():CreatorPlaybook;
export function normalizeChatAdminSalesPlaybook(value:unknown):CreatorPlaybook;
export function resolveChatAdminRequestedOffer(playbook:unknown,incomingMessage:unknown):{playbook:CreatorPlaybook;requestedOffer:Pick<CreatorOffer,"id"|"name"|"category"|"currency"|"minimumPriceMinor"|"recommendedPriceMinor"|"maximumPriceMinor"|"maximumDiscountPercent"|"requiresConfirmation">|null};
export function assertChatAdminReplyPrices(replies:string[],requestedOffer:Record<string,unknown>|null):string[];
