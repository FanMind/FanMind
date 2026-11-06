"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import styles from "./inbox.module.css";

type InboxSearchFormProps = {
  activeFilter: string;
  initialQuery: string;
  locale: FanMindLanguage;
};

export function InboxSearchForm({ activeFilter, initialQuery, locale }: InboxSearchFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (locale === "en") params.set("lang", "en");
    if (activeFilter && activeFilter !== "all") params.set("filter", activeFilter);
    if (query.trim()) params.set("q", query.trim());
    const nextUrl = params.toString() ? `/inbox?${params.toString()}` : "/inbox";
    router.push(nextUrl);
  }

  return (
    <form className={styles.searchForm} onSubmit={handleSubmit} role="search">
      <label className={styles.searchLabel} htmlFor="inbox-search">
        {locale === "en" ? "Search" : "Suche"}
      </label>
      <input
        id="inbox-search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={locale === "en" ? "Search fan, channel, message, segment …" : "Suche nach Fan, Kanal, Nachricht, Segment …"}
      />
      <button type="submit" className={styles.searchSubmit}>
        {locale === "en" ? "Search" : "Suchen"}
      </button>
    </form>
  );
}
