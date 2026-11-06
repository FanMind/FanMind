import Link from "next/link";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import styles from "./AccountTabs.module.css";

export type SettingsAccountPage = "profile" | "package" | "invoices" | "aiUsage" | "referral";

export type SettingsAccountTab = {
  key: SettingsAccountPage;
  href: string;
  label: string;
  labelEn: string;
  meta: string;
  metaEn: string;
};

export const SETTINGS_ACCOUNT_TABS: SettingsAccountTab[] = [
  {
    key: "profile",
    href: "/settings/profile",
    label: "Profil",
    labelEn: "Profile",
    meta: "Profil & Workspace",
    metaEn: "Profile & workspace",
  },
  {
    key: "package",
    href: "/settings/package",
    label: "Paket",
    labelEn: "Package",
    meta: "Status & Optionen",
    metaEn: "Status & options",
  },
  {
    key: "invoices",
    href: "/settings/invoices",
    label: "Rechnungen",
    labelEn: "Invoices",
    meta: "Archiv & PDF",
    metaEn: "Archive & PDF",
  },
  {
    key: "aiUsage",
    href: "/settings/ai-usage",
    label: "KI-Nutzung",
    labelEn: "AI usage",
    meta: "Aktionen & Schätzwerte",
    metaEn: "Actions & estimates",
  },
  {
    key: "referral",
    href: "/settings/referral",
    label: "Empfehlungen",
    labelEn: "Recommendations",
    meta: "Link & Rabatt",
    metaEn: "Link & discount",
  },
];

export function AccountTabs({
  activePage,
  locale = "de",
}: {
  activePage: SettingsAccountPage;
  locale?: FanMindLanguage;
}) {
  return (
    <nav
      className={styles.accountTabs}
      aria-label={locale === "en" ? "Account areas" : "Kontobereiche"}
      data-account-tabs="settings"
    >
      {SETTINGS_ACCOUNT_TABS.map((tab) => {
        const active = activePage === tab.key;
        return (
          <Link
            key={tab.key}
            className={`${styles.accountTab} ${active ? styles.accountTabActive : ""}`}
            href={tab.href}
            aria-current={active ? "page" : undefined}
          >
            <span>{locale === "en" ? tab.labelEn : tab.label}</span>
            <small>{locale === "en" ? tab.metaEn : tab.meta}</small>
          </Link>
        );
      })}
    </nav>
  );
}
