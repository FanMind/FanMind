"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "../billing/adminBilling.module.css";

export type SystemAsset = {
  name: string;
  type: string;
  url: string;
  description: string;
  badge?: string;
};

export function AssetCard({ asset }: { asset: SystemAsset }) {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(asset.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <article className={`${styles.card} ${styles.assetCard}`}>
      <div className={styles.assetPreview}>
        <Image src={asset.url} alt={`${asset.name} Vorschau`} width={1200} height={630} unoptimized />
      </div>
      <div className={styles.assetBody}>
        <div className={styles.cardHeader}>
          <div>
            <span className={styles.eyebrow}>{asset.type}</span>
            <h2>{asset.name}</h2>
          </div>
          <span className={styles.badge}>{asset.badge ?? "System"}</span>
        </div>
        <p className={styles.muted}>{asset.description}</p>
        <dl className={styles.assetMeta}>
          <dt>URL</dt>
          <dd>{asset.url}</dd>
        </dl>
        <div className={styles.actions}>
          <a className={styles.buttonPrimary} href={asset.url} target="_blank" rel="noreferrer">Öffnen</a>
          <button className={styles.buttonSecondary} type="button" onClick={copyUrl}>{copied ? "Kopiert" : "URL kopieren"}</button>
          <a className={styles.buttonSecondary} href={asset.url} target="_blank" rel="noreferrer" download>Download/Öffnen</a>
        </div>
      </div>
    </article>
  );
}
