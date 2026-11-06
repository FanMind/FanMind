export type MessageAttachmentKind = "image" | "video" | "audio" | "file" | "unknown";
export type MessageKind = MessageAttachmentKind | "text" | "mixed";

export type MessageAttachmentInput = {
  type?: string | null;
  url?: string | null;
  sticker_id?: string | null;
  title?: string | null;
  name?: string | null;
  mime_type?: string | null;
  size?: number | null;
};

export type NormalizedMessageAttachment = {
  type: MessageAttachmentKind;
  url?: string;
  sticker_id?: string;
  title?: string;
  name?: string;
  mime_type?: string;
  size?: number;
};

export function normalizeMessageAttachments<T extends MessageAttachmentInput>(
  attachments: T[] | null | undefined,
): NormalizedMessageAttachment[] | null {
  if (!attachments?.length) return null;

  const normalized = attachments
    .map((attachment) => ({
      type: normalizeAttachmentType(attachment.type),
      ...(normalizeSafeHttpUrl(attachment.url)
        ? { url: normalizeSafeHttpUrl(attachment.url)! }
        : {}),
      ...(normalizeOptionalText(attachment.sticker_id)
        ? { sticker_id: normalizeOptionalText(attachment.sticker_id)! }
        : {}),
      ...(normalizeOptionalText(attachment.title)
        ? { title: normalizeOptionalText(attachment.title)! }
        : {}),
      ...(normalizeOptionalText(attachment.name)
        ? { name: normalizeOptionalText(attachment.name)! }
        : {}),
      ...(normalizeOptionalText(attachment.mime_type)
        ? { mime_type: normalizeOptionalText(attachment.mime_type)! }
        : {}),
      ...(typeof attachment.size === "number" && Number.isFinite(attachment.size)
        ? { size: attachment.size }
        : {}),
    }))
    .filter((attachment) => attachment.type || attachment.url || attachment.sticker_id);

  return normalized.length ? normalized : null;
}

export function getMessageKindFromAttachments(
  content: string | null | undefined,
  attachments: MessageAttachmentInput[] | null | undefined,
): MessageKind {
  const normalizedAttachments = normalizeMessageAttachments(attachments);
  if (!normalizedAttachments?.length) return content?.trim() ? "text" : "text";
  if (content?.trim()) return "mixed";
  const types = Array.from(new Set(normalizedAttachments.map((attachment) => attachment.type)));
  return types.length === 1 ? types[0] : "mixed";
}

export function buildAttachmentFallbackText(
  attachments: MessageAttachmentInput[] | null | undefined,
  direction: "inbound" | "outbound" = "inbound",
): string | null {
  const normalizedAttachments = normalizeMessageAttachments(attachments);
  const type = normalizedAttachments?.[0]?.type;
  if (!type) return null;
  const suffix = direction === "outbound" ? "gesendet" : "empfangen";
  return {
    image: `Bild ${suffix}`,
    video: `Video ${suffix}`,
    audio: `Audio ${suffix}`,
    file: `Datei ${suffix}`,
    unknown: `Anhang ${suffix}`,
  }[type];
}

export function normalizeAttachmentType(value: unknown): MessageAttachmentKind {
  return value === "image" || value === "video" || value === "audio" || value === "file"
    ? value
    : "unknown";
}

export function normalizeSafeHttpUrl(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized && /^https?:\/\//i.test(normalized) ? normalized : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
