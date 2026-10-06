import type { ChatCharacterFanMemory } from "@/lib/chatAdmin";

const MEMORY_KEYS = ["interests","content_preferences","buying_signals","purchase_history","price_reactions","personal_details","no_gos","conversation_hooks"] as const;

export function normalizeFanMemory(candidate:Record<string,unknown>, previous:ChatCharacterFanMemory):ChatCharacterFanMemory {
  const next:ChatCharacterFanMemory={...previous};
  for(const key of MEMORY_KEYS){
    const value=candidate[key];
    if(Array.isArray(value)) next[key]=value.filter((item):item is string=>typeof item==="string"&&Boolean(item.trim())).map(item=>item.trim()).slice(0,30);
  }
  const style=candidate.preferred_style;
  next.preferred_style=typeof style==="string"&&style.trim()?style.trim().slice(0,500):null;
  next.last_learned_at=new Date().toISOString();
  return next;
}

export function fanMemoryLearningInput(memory:ChatCharacterFanMemory,messages:Array<{direction:string;content:string}>) {
  return JSON.stringify({
    existing_memory:memory,
    recent_confirmed_conversation:messages.filter(message=>message.direction!=="suggested_reply").slice(-12),
  });
}
