"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "../billing/adminBilling.module.css";

export type AdminBellNotification = {
  id: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  read_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

type AdminNotificationsBellProps = {
  initialItems?: AdminBellNotification[];
  initialUnread?: number;
};

function tone(items: AdminBellNotification[]) {
  if (
    items.some(
      (notification) =>
        notification.severity === "critical" && !notification.acknowledged_at,
    )
  ) {
    return styles.badgeBad;
  }
  if (
    items.some(
      (notification) =>
        notification.severity === "warning" && !notification.acknowledged_at,
    )
  ) {
    return styles.badgeWarn;
  }
  return styles.badgeOk;
}

export function AdminNotificationsBell({
  initialItems = [],
  initialUnread = 0,
}: AdminNotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminBellNotification[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/notifications", {
      cache: "no-store",
    });
    if (!response.ok) return;

    const data = (await response.json()) as {
      notifications?: AdminBellNotification[];
      unreadCount?: number;
    };
    setItems(data.notifications ?? []);
    setUnread(data.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  }

  async function update(id: string, acknowledge = false) {
    const response = await fetch(`/api/admin/notifications/${id}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledge }),
    });
    if (response.ok) await refresh();
  }

  return (
    <div className={styles.notificationBell}>
      <button
        type="button"
        className={tone(items)}
        onClick={toggleOpen}
        aria-label={`Admin-Benachrichtigungen öffnen${unread ? `, ${unread} ungelesen` : ""}`}
        aria-expanded={open}
      >
        ● Betrieb {unread ? <strong>{unread}</strong> : null}
      </button>

      {open ? (
        <div className={styles.notificationMenu}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>Operations</span>
              <h2>Admin-Meldungen</h2>
            </div>
            <Link className={styles.textLink} href="/admin/operations">
              Center öffnen
            </Link>
          </div>

          {items.length ? (
            items.map((item) => (
              <article key={item.id} className={styles.notificationItem}>
                <strong>{item.title}</strong>
                <span>
                  {item.category} · {new Date(item.created_at).toLocaleString("de-DE")}
                </span>
                <p>{item.message}</p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => update(item.id)}
                    disabled={Boolean(item.read_at)}
                  >
                    {item.read_at ? "Gelesen" : "Als gelesen markieren"}
                  </button>
                  <button
                    type="button"
                    className={styles.buttonPrimary}
                    onClick={() => update(item.id, true)}
                    disabled={Boolean(item.acknowledged_at)}
                  >
                    {item.acknowledged_at ? "Quittiert" : "Quittieren"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className={styles.muted}>
              Keine Meldungen vorhanden oder Migration noch nicht angewendet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
