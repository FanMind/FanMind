export type InboxMetricLocale = "de" | "en";

export declare function formatInboxWaitingTime(
  minutes: number,
  locale: InboxMetricLocale,
): string;

export declare function formatInboxAverageResponseTime(
  minutes: number,
  locale: InboxMetricLocale,
): string;
