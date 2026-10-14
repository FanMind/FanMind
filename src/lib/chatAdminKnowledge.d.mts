export type ChatAdminLearnedFact = {kind:"communication"|"interest"|"boundary";quote:string;source:string;source_sequence?:number};
export type ChatAdminCommercial = {stage?:"new"|"familiar"|"trusted";resumeAfterReplyId?:string;salesHold?:boolean;source?:string;lastPurchaseAt?:string|null;lastOfferAt?:string|null;lastDeclinedAt?:string|null};
export type ChatAdminKnowledge = {manual:string;facts:ChatAdminLearnedFact[];commercial:ChatAdminCommercial};
export function readChatAdminKnowledge(notes:unknown):ChatAdminKnowledge;
export function normalizeChatAdminCommercial(value?:unknown):ChatAdminCommercial;
export function writeChatAdminKnowledge(value:ChatAdminKnowledge):string;
export function learnChatAdminKnowledge(notes:string,proposed:unknown,sources:Array<{id:string;direction:string;content:string;memory_source?:string;sequence?:number}>):string;
export function deriveChatAdminStrategy(playbook:import("./creatorIntelligencePolicy.mjs").CreatorPlaybook,fan:Record<string,unknown>,requestedOffer:Record<string,unknown>|null,now?:number):Record<string,unknown> & {sellNow:boolean};

export function extractChatAdminFacts(content:unknown,source:string):ChatAdminLearnedFact[];

export function deriveChatAdminReplyPause(notes:unknown,confirmed:{id:string;direction:string;content:string}|null|undefined):{paused:boolean;closing_reply_id:string|null};
export function resumeChatAdminReplies(notes:unknown,confirmedReplyId:string):string;
