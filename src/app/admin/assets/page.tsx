import { requirePlatformAdmin } from "@/lib/admin";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";
import styles from "../billing/adminBilling.module.css";
import { listUploadedAdminAssets } from "@/lib/adminAssets";
import { AdminAssetUploadForm } from "./AdminAssetUploadForm";
import { AssetCard, type SystemAsset } from "./AssetCard";

const SYSTEM_ASSETS: SystemAsset[] = [
  {
    name: "Open Graph Image",
    type: "Social Preview",
    url: "https://fanmind.ch/opengraph-image",
    description: "Vorschau-Bild für Link-Sharing in Meta, LinkedIn und weiteren Open-Graph-Clients.",
  },
  {
    name: "Twitter Image",
    type: "Social Preview",
    url: "https://fanmind.ch/twitter-image",
    description: "X/Twitter-Card-Bild für geteilte FanMind-Links.",
  },
  {
    name: "Icon",
    type: "App Icon",
    url: "https://fanmind.ch/icon",
    description: "System-Icon der Web-App für Browser, PWA-Kontexte und Favicons.",
  },
  {
    name: "Apple Icon",
    type: "Touch Icon",
    url: "https://fanmind.ch/apple-icon",
    description: "Apple-Touch-Icon für iOS-Startbildschirm und Safari-Kontexte.",
  },
];

export default async function AdminAssetsPage() {
  const user = await requirePlatformAdmin();
  const uploadedAssets = await listUploadedAdminAssets();
  const customAssets: SystemAsset[] = uploadedAssets.assets.map((asset) => ({
    name: asset.name,
    type: asset.category,
    url: asset.url,
    description: `${asset.category} · ${asset.contentType ?? "Bild"}${asset.size ? ` · ${(asset.size / 1024 / 1024).toFixed(2)} MB` : ""}${asset.uploadedAt ? ` · Upload ${new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(asset.uploadedAt))}` : ""}`,
    badge: "Upload",
  }));

  return (
    <AdminBillingShell user={user} title="Bilder & Assets" subtitle="Admin-only Übersicht und Upload öffentlicher FanMind Assets.">
      <div className={styles.adminStack}>
        <AdminTabs activeTab="assets" />
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Admin · Assets</span>
            <h1>Bilder &amp; Assets</h1>
            <p>Öffentliche System- und Upload-Assets zentral hochladen, prüfen, öffnen und kopieren. WhatsApp-, Meta- und LinkedIn-Caches können verzögert aktualisieren.</p>
          </div>
          <span className={styles.badgeOk}>Nur Admins</span>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <span className={styles.eyebrow}>Upload</span>
              <h2>Neues Asset hochladen</h2>
            </div>
            <span className={styles.badgeOk}>Platform-Admins</span>
          </div>
          <AdminAssetUploadForm />
        </section>

        {uploadedAssets.error ? (
          <section className={styles.emptyState} aria-live="polite">{uploadedAssets.error}</section>
        ) : null}

        <section className={styles.assetGrid} aria-label="Hochgeladene Assets">
          {customAssets.map((asset) => <AssetCard asset={asset} key={asset.url} />)}
          {!uploadedAssets.error && customAssets.length === 0 ? <div className={styles.emptyState}>Noch keine eigenen Assets im Supabase Storage Bucket <strong>fanmind-assets</strong> gefunden.</div> : null}
        </section>

        <section className={styles.assetGrid} aria-label="System-Assets">
          {SYSTEM_ASSETS.map((asset) => <AssetCard asset={asset} key={asset.url} />)}
        </section>
      </div>
    </AdminBillingShell>
  );
}
