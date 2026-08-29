export const ALL_MESSAGE_CHANNELS = "all";

const PLATFORM_LABELS = Object.freeze({
  email: "E-Mail",
  facebook: "Facebook",
  instagram: "Instagram",
  manual: "Manuell",
  messenger: "Messenger",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  x: "X",
  twitter: "X",
  other: "Sonstige",
});

export function normalizeMessagePlatform(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || "other";
}

export function messagePlatformLabel(value) {
  const key = normalizeMessagePlatform(value);
  if (PLATFORM_LABELS[key]) return PLATFORM_LABELS[key];

  const readable = key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : "Sonstige";
}

export function buildMessageChannelOptions(messages) {
  const counts = new Map();

  for (const message of messages ?? []) {
    const key = normalizeMessagePlatform(message?.source_platform);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [
    { key: ALL_MESSAGE_CHANNELS, label: "Alle", count: messages?.length ?? 0 },
    ...Array.from(counts, ([key, count]) => ({
      key,
      label: messagePlatformLabel(key),
      count,
    })),
  ];
}

export function filterMessagesByChannel(messages, selectedChannel) {
  if (!selectedChannel || selectedChannel === ALL_MESSAGE_CHANNELS) {
    return [...(messages ?? [])];
  }

  const normalizedChannel = normalizeMessagePlatform(selectedChannel);
  return (messages ?? []).filter(
    (message) => normalizeMessagePlatform(message?.source_platform) === normalizedChannel,
  );
}
