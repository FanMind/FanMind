export const ALL_MESSAGE_CHANNELS: "all";

export type MessageChannelInput = {
  source_platform?: string | null;
};

export type MessageChannelOption = {
  key: string;
  label: string;
  count: number;
};

export function normalizeMessagePlatform(value: unknown): string;
export function messagePlatformLabel(value: unknown): string;
export function buildMessageChannelOptions(
  messages: readonly MessageChannelInput[],
): MessageChannelOption[];
export function filterMessagesByChannel<T extends MessageChannelInput>(
  messages: readonly T[],
  selectedChannel: string,
): T[];
