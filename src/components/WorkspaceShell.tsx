"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import dashboardStyles from "../app/dashboard/dashboard.module.css";
import sidebarStyles from "./WorkspaceSidebar.module.css";
import responsiveStyles from "./WorkspaceSidebarResponsive.module.css";
import { FanMindLogo } from "./FanMindLogo";
import { WorkspaceHelpLauncher } from "./WorkspaceHelpLauncher";
import {
  FanMindFunctionIcon,
  resolveFanMindFunctionIcon,
  type FanMindFunctionIconKey,
} from "./FanMindFunctionIcon";
import { WorkspaceHeader, type WorkspaceHeaderProps } from "./WorkspaceHeader";
import { WorkspaceKpiStrip } from "./WorkspaceKpiStrip";
import { wt } from "@/lib/workspaceCopy";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import type { FollowupCompletionRate } from "@/lib/workspaceKpiStats";

export type WorkspaceNavLink = {
  label: string;
  href: string;
  icon?: FanMindFunctionIconKey;
  active?: boolean;
  badge?: string;
  disabled?: boolean;
};

type WorkspaceShellProps = {
  workspaceName: string;
  userLabel: string;
  planLabel: string;
  planMeta: string;
  planStatus: string;
  mainNavigation: WorkspaceNavLink[];
  settingsNavigation: WorkspaceNavLink[];
  savedViews: WorkspaceNavLink[];
  header: WorkspaceHeaderProps;
  contactCount: number;
  openFollowupCount?: number;
  followupCompletionRate?: FollowupCompletionRate | null;
  showStats?: boolean;
  logoutAction: () => Promise<void>;
  profileHref?: string;
  locale?: FanMindLanguage;
  children: ReactNode;
};

function getInitials(nameOrEmail?: string): string {
  const fallback = "FM";

  if (!nameOrEmail) {
    return fallback;
  }

  const parts = nameOrEmail
    .replace(/@.*/, "")
    .split(/[.\s_-]+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return fallback;
  }

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || fallback
  );
}

function isHiddenProductNavigationItem(item: WorkspaceNavLink): boolean {
  const normalizedLabel = item.label.toLowerCase();
  const normalizedHref = item.href.toLowerCase();

  return (
    normalizedLabel.includes("onboarding") ||
    normalizedHref.includes("/onboarding") ||
    normalizedLabel.includes("agent") ||
    normalizedHref.includes("/agent")
  );
}

function SidebarItem({
  item,
  collapsed = false,
}: {
  item: WorkspaceNavLink;
  collapsed?: boolean;
}) {
  const { label, icon, active = false, badge, disabled = false, href } = item;
  const iconName = icon ?? resolveFanMindFunctionIcon(href, label);
  const badgeKind = badge && /^\d+$/u.test(badge) ? "count" : "status";
  const itemClassName = `${active ? sidebarStyles.navItemActive : sidebarStyles.navItem} ${
    collapsed ? sidebarStyles.navItemCollapsed : ""
  }`;

  return (
    <a
      aria-disabled={disabled || undefined}
      aria-label={collapsed ? label : undefined}
      className={itemClassName}
      href={href}
      title={collapsed ? label : undefined}
      tabIndex={disabled ? -1 : undefined}
      data-sidebar-link={label}
    >
      <span className={sidebarStyles.navItemLead}>
        <span className={sidebarStyles.navIconSlot} aria-hidden="true">
          <FanMindFunctionIcon name={iconName} />
        </span>
        <span className={sidebarStyles.navItemLabel}>{label}</span>
      </span>
      {badge ? (
        <small
          className={sidebarStyles.navItemBadge}
          data-badge-kind={badgeKind}
          aria-label={`${label}: ${badge}`}
        >
          {badge}
        </small>
      ) : null}
    </a>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M10 5H6.8A2.8 2.8 0 0 0 4 7.8v8.4A2.8 2.8 0 0 0 6.8 19H10" />
      <path d="m14 8 4 4-4 4M18 12H9" />
    </svg>
  );
}

export function WorkspaceShell({
  workspaceName,
  userLabel,
  mainNavigation,
  settingsNavigation,
  savedViews,
  header,
  contactCount,
  openFollowupCount = 0,
  followupCompletionRate,
  showStats = true,
  logoutAction,
  profileHref = "/settings/profile",
  children,
  locale = "de",
}: WorkspaceShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window === "undefined"
      ? false
      : localStorage.getItem("fanmind_sidebar_collapsed") === "true",
  );

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("fanmind_sidebar_collapsed", String(next));
      return next;
    });
  }

  const visibleMainNavigation = mainNavigation.filter(
    (item) => !isHiddenProductNavigationItem(item),
  );
  const visibleSettingsNavigation = settingsNavigation.filter(
    (item) => !isHiddenProductNavigationItem(item),
  );
  const visibleSavedViews = savedViews.filter(
    (item) => !isHiddenProductNavigationItem(item),
  );
  const toggleLabel = sidebarCollapsed
    ? wt(locale, "Sidebar ausklappen")
    : wt(locale, "Sidebar einklappen");
  const logoutLabel = wt(locale, "Abmelden");

  return (
    <div
      className={`${dashboardStyles.dashboardShell} ${responsiveStyles.shell} ${
        sidebarCollapsed
          ? `${dashboardStyles.dashboardShellCollapsed} ${responsiveStyles.shellCollapsed}`
          : ""
      }`}
      data-sidebar-state={sidebarCollapsed ? "collapsed" : "expanded"}
    >
      <aside
        className={`${sidebarStyles.sidebar} ${responsiveStyles.sidebarSurface} ${
          sidebarCollapsed ? sidebarStyles.sidebarCollapsed : ""
        }`}
        aria-label="FanMind Navigation"
      >
        <div className={sidebarStyles.sidebarTop}>
          <div className={sidebarStyles.brandSlot}>
            <div
              className={sidebarStyles.brandExpanded}
              aria-hidden={sidebarCollapsed}
            >
              <FanMindLogo
                href={sidebarCollapsed ? undefined : "/dashboard"}
                ariaLabel="FanMind Dashboard"
                subtitle="Multi-Channel CRM"
              />
            </div>
            <a
              className={sidebarStyles.brandCollapsed}
              aria-label="FanMind Dashboard"
              aria-hidden={!sidebarCollapsed}
              href="/dashboard"
              tabIndex={sidebarCollapsed ? undefined : -1}
              title="FanMind"
            >
              <Image
                alt=""
                className={sidebarStyles.brandAvatar}
                height={48}
                priority
                src="/assets/fanmind-social-avatar.png"
                width={48}
              />
            </a>
          </div>

          <button
            type="button"
            className={sidebarStyles.sidebarToggle}
            onClick={toggleSidebar}
            aria-controls="fanmind-workspace-navigation"
            aria-expanded={!sidebarCollapsed}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <span className={sidebarStyles.sidebarToggleIcon} aria-hidden="true">
              {sidebarCollapsed ? "→" : "←"}
            </span>
            <span className={sidebarStyles.sidebarToggleLabel}>{toggleLabel}</span>
          </button>
        </div>

        <div
          className={sidebarStyles.sidebarScrollArea}
          id="fanmind-workspace-navigation"
        >
          <nav
            className={sidebarStyles.navList}
            aria-label={wt(locale, "Hauptnavigation")}
          >
            <span
              className={sidebarStyles.navSectionLabel}
              aria-hidden={sidebarCollapsed}
            >
              {wt(locale, "Navigation")}
            </span>
            {visibleMainNavigation.map((item) => (
              <SidebarItem
                key={item.label}
                item={item}
                collapsed={sidebarCollapsed}
              />
            ))}
          </nav>

          <nav
            className={sidebarStyles.navList}
            aria-label="Workspace Navigation"
          >
            <span
              className={sidebarStyles.navSectionLabel}
              aria-hidden={sidebarCollapsed}
            >
              {wt(locale, "Workspace")}
            </span>
            {visibleSettingsNavigation.map((item) => (
              <SidebarItem
                key={item.label}
                item={item}
                collapsed={sidebarCollapsed}
              />
            ))}
          </nav>

          <section
            className={`${sidebarStyles.navList} ${sidebarStyles.savedViews}`}
            aria-label={wt(locale, "Gespeicherte Ansichten")}
          >
            <span
              className={sidebarStyles.navSectionLabel}
              aria-hidden={sidebarCollapsed}
            >
              {wt(locale, "Gespeicherte Ansichten")}
            </span>
            {visibleSavedViews.map((item) => (
              <SidebarItem
                key={item.label}
                item={item}
                collapsed={sidebarCollapsed}
              />
            ))}
          </section>
        </div>

        <div className={sidebarStyles.sidebarFooter}>
          <a
            className={`${sidebarStyles.userMiniCard} ${
              sidebarCollapsed ? sidebarStyles.userMiniCardCollapsed : ""
            }`}
            aria-label={wt(locale, "Nutzerprofil öffnen")}
            href={profileHref}
            title={sidebarCollapsed ? `${userLabel} (${workspaceName})` : undefined}
          >
            <div className={sidebarStyles.avatarMark}>{getInitials(userLabel)}</div>
            <div className={sidebarStyles.userMiniCardCopy} aria-hidden={sidebarCollapsed}>
              <span>{wt(locale, "Nutzerkarte")}</span>
              <strong>{userLabel}</strong>
              <p>{workspaceName}</p>
            </div>
          </a>
          <form action={logoutAction} className={sidebarStyles.logoutForm}>
            <button
              type="submit"
              className={`${sidebarStyles.logoutButton} ${
                sidebarCollapsed ? sidebarStyles.logoutButtonCollapsed : ""
              }`}
              aria-label={logoutLabel}
              title={sidebarCollapsed ? logoutLabel : undefined}
            >
              <span className={sidebarStyles.logoutIcon}>
                <LogoutIcon />
              </span>
              <span className={sidebarStyles.logoutLabel}>{logoutLabel}</span>
            </button>
          </form>
        </div>
      </aside>

      <div
        className={`${dashboardStyles.dashboardContent} ${dashboardStyles.dashboardContentStart} ${responsiveStyles.content}`}
      >
        <WorkspaceHeader {...header} locale={locale} />
        <div className={dashboardStyles.dashboardScrollArea}>
          {showStats ? (
            <WorkspaceKpiStrip
              contactCount={contactCount}
              openFollowupCount={openFollowupCount}
              followupCompletionRate={followupCompletionRate}
              locale={locale}
            />
          ) : null}
          {children}
        </div>
      </div>
      {process.env.NEXT_PUBLIC_FANMIND_INAPP_HELP_ENABLED === "true" ? <WorkspaceHelpLauncher /> : null}
    </div>
  );
}
