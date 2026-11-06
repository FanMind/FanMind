"use client";

import { useState } from "react";
import dashboardStyles from "../dashboard/dashboard.module.css";

type ReferralCopyButtonProps = {
  value: string | null | undefined;
  label: string;
};

export function ReferralCopyButton({ value, label }: ReferralCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(value?.trim());

  async function copyValue() {
    if (!canCopy || !value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className={dashboardStyles.referralCopyButton} type="button" onClick={copyValue} disabled={!canCopy}>
      {copied ? "Kopiert" : label}
    </button>
  );
}
