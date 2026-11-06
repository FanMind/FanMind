import type { ReactNode } from "react";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { wt } from "@/lib/workspaceCopy";
import styles from "../app/dashboard/dashboard.module.css";

export type WorkspaceHeaderProps = {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  locale?: FanMindLanguage;
  searchAction?: string;
  searchName?: string;
  searchValue?: string;
  hiddenSearchParams?: Record<string, string>;
  operationsWidget?: ReactNode;
};

export function WorkspaceHeader({
  title,
  subtitle,
  searchPlaceholder,
  primaryActionLabel,
  primaryActionHref,
  locale = "de",
  searchAction,
  searchName = "q",
  searchValue = "",
  hiddenSearchParams,
  operationsWidget,
}: WorkspaceHeaderProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.titleCluster}>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className={styles.topbarActions}>
        {operationsWidget}
        <form className={styles.searchBox} action={searchAction} method="get">
          <label htmlFor={`${title}-workspace-search`}>{wt(locale, "Suche")}</label>
          <input
            id={`${title}-workspace-search`}
            type="search"
            name={searchName}
            defaultValue={searchValue}
            placeholder={searchPlaceholder}
          />
          {hiddenSearchParams
            ? Object.entries(hiddenSearchParams).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))
            : null}
        </form>
        <button
          type="button"
          className={styles.filterChip}
          disabled
          title="Zeitraumfilter ist vorbereitet und wird in Kürze aktiviert."
        >
          {wt(locale, "Letzte 30 Tage · bald")}
        </button>
        <button
          type="button"
          className={styles.filterChip}
          disabled
          title="Erweiterte Filter sind vorbereitet und werden in Kürze aktiviert."
        >
          {wt(locale, "Filter · bald")}
        </button>
        {primaryActionLabel && primaryActionHref ? (
          <a className={styles.primaryButton} href={primaryActionHref}>
            {primaryActionLabel}
          </a>
        ) : null}
      </div>
    </header>
  );
}
