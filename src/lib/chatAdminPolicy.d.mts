export const CHAT_ADMIN_CAPABILITY: "chat_admin_multi_character";
export const CHAT_ADMIN_MAX_TEXT: number;
export class ChatAdminPolicyError extends Error { code:string; constructor(code:string); }
export type ChatAdminCharacterInput={display_name:string;profile_image_path?:string|null;public_age:number;bio:string;location?:string|null;languages:string[];personality:string;writing_style:string;emoji_style:string;sentence_style:string;typical_phrases:string[];forbidden_phrases:string[];flirt_style:string;sales_rules:string;example_messages:string[];status?:"active"|"inactive"};
export function assertChatAdminCharacterInput(input:unknown):ChatAdminCharacterInput;
export function buildChatAdminCharacterContext(character:Record<string,unknown>,incomingMessage:unknown,fanLabel?:string):string;
