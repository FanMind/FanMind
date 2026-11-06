import type { SVGProps } from "react";

export type FanMindFunctionIconKey =
  | "dashboard"
  | "contacts"
  | "channels"
  | "followups"
  | "knowledge"
  | "ai"
  | "roadmap"
  | "security"
  | "settings"
  | "profile"
  | "referral"
  | "invoices"
  | "usage"
  | "topFans"
  | "reactivation"
  | "admin"
  | "campaigns"
  | "analytics"
  | "segments"
  | "import"
  | "generic";

type FanMindFunctionIconProps = {
  name: FanMindFunctionIconKey;
  className?: string;
  size?: number | string;
  title?: string;
};

function normalized(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("de")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function resolveFanMindFunctionIcon(
  iconOrKey?: string | null,
  labelOrHref?: string | null,
): FanMindFunctionIconKey {
  const semantic = normalized(labelOrHref);
  const source = `${semantic} ${normalized(iconOrKey)}`;

  if (/ki-nutzung|ai usage|verbrauch|credits|kontingent/u.test(source)) return "usage";
  if (/kontaktwissen|gedaechtnis|memory|historie|kontext/u.test(source)) return "knowledge";
  if (/antwort|\bki\b|\bai\b|copilot|insight/u.test(source)) return "ai";
  if (/follow.?up|nachfass|erinnerung|timing|naechste schritt/u.test(source)) return "followups";
  if (/csv|import/u.test(source)) return "import";
  if (/kontakt|fans?|profil.*kontakt/u.test(source)) return "contacts";
  if (/kanael|channel|social|inbox|quelle/u.test(source)) return "channels";
  if (/dashboard|uebersicht|⌂/u.test(source)) return "dashboard";
  if (/rechnung|invoice|billing|zahlung/u.test(source)) return "invoices";
  if (/empfehl|referral/u.test(source)) return "referral";
  if (/top fans?|vip|favorit/u.test(source)) return "topFans";
  if (/reaktiv/u.test(source)) return "reactivation";
  if (/kampagn|campaign|📣|☆/u.test(source)) return "campaigns";
  if (/analytics|auswertung|performance|reichweite/u.test(source)) return "analytics";
  if (/segment|gruppe/u.test(source)) return "segments";
  if (/roadmap|coming soon|geplant/u.test(source)) return "roadmap";
  if (/sicher|kontrolle|schutz|dsgvo|privacy/u.test(source)) return "security";
  if (/admin/u.test(source)) return "admin";
  if (/profil|konto|account/u.test(source)) return "profile";
  if (/einstellung|settings|⚙/u.test(source)) return "settings";

  if (iconOrKey === "🧠") return "knowledge";
  if (["✦", "✧"].includes(iconOrKey ?? "")) return "ai";
  if (["♙", "✉"].includes(iconOrKey ?? "")) return "contacts";
  if (["◴", "◷"].includes(iconOrKey ?? "")) return "followups";
  if (iconOrKey === "⬟") return "security";
  if (iconOrKey === "▥") return "roadmap";
  if (iconOrKey === "▣") return "channels";
  if (iconOrKey === "◌") return "segments";

  return "generic";
}

function IconBase({
  children,
  className,
  size,
  title,
}: Pick<FanMindFunctionIconProps, "className" | "size" | "title"> & {
  children: SVGProps<SVGSVGElement>["children"];
}) {
  const labelled = Boolean(title);

  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
      className={className}
      fill="none"
      height={size}
      role={labelled ? "img" : undefined}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        {children}
      </g>
    </svg>
  );
}

export function FanMindFunctionIcon({
  name,
  className,
  size = "1em",
  title,
}: FanMindFunctionIconProps) {
  switch (name) {
    case "dashboard":
      return (
        <IconBase className={className} size={size} title={title}>
          <rect height="7" rx="1.5" width="7" x="3" y="3" />
          <rect height="4" rx="1.5" width="7" x="14" y="3" />
          <rect height="7" rx="1.5" width="7" x="14" y="14" />
          <rect height="4" rx="1.5" width="7" x="3" y="17" />
        </IconBase>
      );
    case "contacts":
      return (
        <IconBase className={className} size={size} title={title}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20v-1.2A5.5 5.5 0 0 1 9 13.3a5.5 5.5 0 0 1 5.5 5.5V20" />
          <path d="M15.5 5.5a3 3 0 0 1 0 5.7M16 14a5.2 5.2 0 0 1 4.5 5.2V20" />
        </IconBase>
      );
    case "channels":
      return (
        <IconBase className={className} size={size} title={title}>
          <circle cx="5" cy="12" r="2.5" />
          <circle cx="19" cy="5" r="2.5" />
          <circle cx="19" cy="19" r="2.5" />
          <path d="m7.2 10.8 9.5-4.7M7.2 13.2l9.5 4.7" />
        </IconBase>
      );
    case "followups":
      return (
        <IconBase className={className} size={size} title={title}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3.2 2M7.5 3.5 5 6M16.5 3.5 19 6" />
        </IconBase>
      );
    case "knowledge":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M9.2 4.2A3.3 3.3 0 0 0 5.8 7.5c0 .5.1.9.3 1.3A3.5 3.5 0 0 0 7 15.5V17a3 3 0 0 0 3 3h2V4.8a2.8 2.8 0 0 0-2.8-.6Z" />
          <path d="M14.8 4.2a3.3 3.3 0 0 1 3.4 3.3c0 .5-.1.9-.3 1.3a3.5 3.5 0 0 1-.9 6.7V17a3 3 0 0 1-3 3h-2V4.8a2.8 2.8 0 0 1 2.8-.6ZM8 10h2M14 8h2M14 13h2" />
        </IconBase>
      );
    case "ai":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z" />
          <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM5.5 14l.6 1.6 1.6.6-1.6.6-.6 1.7-.6-1.7-1.6-.6 1.6-.6.6-1.6Z" />
        </IconBase>
      );
    case "roadmap":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M5 4v16M5 6h8l-1.5 3L13 12H5M13 12h6l-1.5 3 1.5 3h-8" />
        </IconBase>
      );
    case "security":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M12 3 5 6v5.2c0 4.3 2.8 8.2 7 9.8 4.2-1.6 7-5.5 7-9.8V6l-7-3Z" />
          <path d="m8.7 12 2.1 2.1 4.6-4.7" />
        </IconBase>
      );
    case "settings":
      return (
        <IconBase className={className} size={size} title={title}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7.6 7.6 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.5 7.5 0 0 0-2.1-1.2L14 3h-4l-.4 2.7a7.5 7.5 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.5A7.6 7.6 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7.5 7.5 0 0 0 2.1 1.2L10 21h4l.4-2.7a7.5 7.5 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
        </IconBase>
      );
    case "profile":
      return (
        <IconBase className={className} size={size} title={title}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </IconBase>
      );
    case "referral":
      return (
        <IconBase className={className} size={size} title={title}>
          <circle cx="7" cy="8" r="3" />
          <circle cx="17" cy="16" r="3" />
          <path d="M9.5 9.5 14.5 14.5M14 7h5v5M10 17H5v-5" />
        </IconBase>
      );
    case "invoices":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M6 3h9l3 3v15l-3-1.5-3 1.5-3-1.5L6 21V3Z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </IconBase>
      );
    case "usage":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M4 19V9M9.3 19V5M14.7 19v-7M20 19V3" />
          <path d="M2.5 19.5h19" />
        </IconBase>
      );
    case "topFans":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1.1 6.1-5.6-2.9L6.4 20l1.1-6.1L3 9.5l6.2-.9L12 3Z" />
        </IconBase>
      );
    case "reactivation":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M20 7v5h-5M19.2 12a7.5 7.5 0 1 0 .3 4" />
          <path d="M12 7v5l3 2" />
        </IconBase>
      );
    case "admin":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M12 3 5 6v5.5c0 4.2 2.8 8 7 9.5 4.2-1.5 7-5.3 7-9.5V6l-7-3Z" />
          <path d="M9 15.5v-1a3 3 0 0 1 6 0v1M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </IconBase>
      );
    case "campaigns":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M4 13h3l9 4V5L7 9H4v4Z" />
          <path d="m8 13 1.5 6h3L11 14M19 8.5c1 .8 1.5 2 1.5 3.5s-.5 2.7-1.5 3.5" />
        </IconBase>
      );
    case "analytics":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M3 20h18" />
        </IconBase>
      );
    case "segments":
      return (
        <IconBase className={className} size={size} title={title}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="8" r="3" />
          <circle cx="12" cy="16" r="3" />
        </IconBase>
      );
    case "import":
      return (
        <IconBase className={className} size={size} title={title}>
          <path d="M12 3v11M8 10l4 4 4-4" />
          <path d="M5 17v3h14v-3" />
        </IconBase>
      );
    default:
      return (
        <IconBase className={className} size={size} title={title}>
          <rect height="14" rx="3" width="14" x="5" y="5" />
          <path d="M9 9h6v6H9z" />
        </IconBase>
      );
  }
}
