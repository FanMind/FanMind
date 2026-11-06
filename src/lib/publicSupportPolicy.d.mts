export type PublicSupportInput={question:string;history:Array<{role:"user"|"assistant";text:string}>;language:"de"|"en"};
export const PUBLIC_SUPPORT_PRICE_GUIDANCE:string;
export const PUBLIC_SUPPORT_INSTRUCTIONS:string;
export function parsePublicSupportRequest(value:unknown):PublicSupportInput;
export function guardPublicSupportReply(value:unknown,language:"de"|"en"):string;
