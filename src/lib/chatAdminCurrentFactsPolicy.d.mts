export type CurrentInterestBinding={workspace_id:string;character_id:string;fan_id:string;conversation_id:string};
export type CurrentInterest=CurrentInterestBinding & {topic:string;polarity:"positive"|"negative";quote:string;source_message_id:string;source_sequence:number;source_statement_index:number};
export function extractCurrentInterestAssertions(source:unknown,binding:CurrentInterestBinding):CurrentInterest[];
export function validateCurrentInterestFacts(current:unknown,binding:CurrentInterestBinding):CurrentInterest[];
export function applyCurrentInterestAssertion(current:CurrentInterest[],proposed:unknown,source:unknown,binding:CurrentInterestBinding):CurrentInterest[];

export function classifyCurrentInterestQuote(quote:unknown):{topic:string;polarity:"positive"|"negative"}|null;
