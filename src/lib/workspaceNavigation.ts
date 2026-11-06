import { type WorkspaceNavLink } from "@/components/WorkspaceShell";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { isPlatformAdminEmail } from "@/lib/admin";
import { wt } from "@/lib/workspaceCopy";

export type WorkspaceRouteKey =
  | "dashboard"
  | "fans"
  | "inbox"
  | "channels"
  | "reach"
  | "onboarding"
  | "settings"
  | "aiUsage"
  | "referral"
  | "billing"
  | "top-fans"
  | "reactivation"
  | "followups"
  | "admin";

export function localizedWorkspaceHref(
  path: string,
  locale: FanMindLanguage,
): string {
  if (locale !== "en") return path;

  const url = new URL(path, "https://fanmind.invalid");
  url.searchParams.set("lang", "en");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getWorkspaceNavigationForUser(
  activeRoute: WorkspaceRouteKey,
  email: string | null | undefined,
  locale: FanMindLanguage = "de",
  dueFollowupCount = 0,
  workspaceRole: string | null | undefined = "owner",
) {
  return getWorkspaceNavigation(
    activeRoute,
    locale,
    dueFollowupCount,
    isPlatformAdminEmail(email),
    workspaceRole,
  );
}

export function getWorkspaceNavigation(
  activeRoute: WorkspaceRouteKey,
  locale: FanMindLanguage = "de",
  dueFollowupCount = 0,
  showAdminArea = false,
  workspaceRole: string | null | undefined = "owner",
): {
  mainNavigation: WorkspaceNavLink[];
  settingsNavigation: WorkspaceNavLink[];
  savedViews: WorkspaceNavLink[];
} {
  const showOwnerArea = workspaceRole?.trim().toLowerCase() === "owner";
  return {
    mainNavigation: [
      {
        label: wt(locale, "Dashboard"),
        href: "/dashboard",
        icon: "dashboard",
        active: activeRoute === "dashboard",
      },
      {
        label: wt(locale, "Fans"),
        href: "/fans",
        icon: "contacts",
        active: activeRoute === "fans",
      },
      {
        label: locale === "en" ? "Inbox" : "Posteingang",
        href: localizedWorkspaceHref("/inbox", locale),
        icon: "channels",
        active: activeRoute === "inbox",
      },
      {
        label: "Follow-ups",
        href: "/followups",
        icon: "followups",
        active: activeRoute === "followups",
        badge: dueFollowupCount > 0 ? String(dueFollowupCount) : undefined,
      },
      ...(showOwnerArea
        ? [
            {
              label: wt(locale, "Onboarding"),
              href: "/onboarding",
              icon: "roadmap" as const,
              active: activeRoute === "onboarding",
            },
            {
              label: wt(locale, "Kanäle"),
              href: "/channels",
              icon: "channels" as const,
              active: activeRoute === "channels",
              badge: "Sync",
            },
          ]
        : []),
    ],
    settingsNavigation: [
      ...(showOwnerArea
        ? [
            {
              label:
                locale === "en" ? "Profile & account" : "Profil & Konto",
              href: "/settings/profile",
              icon: "profile" as const,
              active: activeRoute === "settings",
            },
          ]
        : []),
      ...(showAdminArea
        ? [
            {
              label: "Adminbereich",
              href: "/admin/billing",
              icon: "admin" as const,
              active: activeRoute === "admin",
            },
          ]
        : []),
    ],
    savedViews: showOwnerArea
      ? [
          {
            label: wt(locale, "Top Fans"),
            href: "/top-fans",
            icon: "topFans",
            active: activeRoute === "top-fans",
          },
          {
            label: wt(locale, "Reaktivierung"),
            href: "/reactivation",
            icon: "reactivation",
            active: activeRoute === "reactivation",
          },
        ]
      : [],
  };
}
