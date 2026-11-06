"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./fan-detail.module.css";

type FanActionMenuProps = {
  fanName: string;
};

export function FanActionMenu({ fanName }: FanActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handlePreparedAction(label: string) {
    setNotice(`${label} ist im Demo-Modus vorbereitet und sendet nichts automatisch.`);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div className={styles.actionMenuWrap} ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.actionMenuButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="fan-action-menu"
        aria-label={`Aktionen für ${fanName} öffnen`}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open ? (
        <div className={styles.actionMenu} id="fan-action-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.actionMenuItem}
            onClick={() => handlePreparedAction("Fan bearbeiten")}
          >
            Fan bearbeiten
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.actionMenuItem}
            onClick={() => handlePreparedAction("Fans zusammenführen")}
          >
            Fans zusammenführen
          </button>
        </div>
      ) : null}
      {notice ? (
        <p className={styles.actionMenuNotice} role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
