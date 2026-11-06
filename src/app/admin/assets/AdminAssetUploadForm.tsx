"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ADMIN_ASSET_CATEGORIES } from "@/lib/adminAssets";
import styles from "../billing/adminBilling.module.css";

export function AdminAssetUploadForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setUploading(true);

    const form = event.currentTarget;
    const response = await fetch("/api/admin/assets/upload", { method: "POST", body: new FormData(form) });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setUploading(false);
    if (!response.ok) {
      setError(payload.error ?? "Upload fehlgeschlagen.");
      return;
    }

    form.reset();
    setMessage("Asset wurde hochgeladen und ist jetzt in der Liste sichtbar.");
    router.refresh();
  }

  return (
    <form className={styles.formGrid} onSubmit={handleSubmit}>
      <label>
        Kategorie
        <select className={styles.select} name="category" required defaultValue="Logo">
          {ADMIN_ASSET_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label>
        Bilddatei
        <input className={styles.input} name="file" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" required />
      </label>
      <button className={styles.buttonPrimary} type="submit" disabled={uploading}>{uploading ? "Upload läuft ..." : "Asset hochladen"}</button>
      <p className={styles.muted}>Erlaubt: png, jpg, jpeg, webp · maximale Dateigröße: 5 MB · Upload läuft ausschließlich über eine serverseitige Admin-API.</p>
      {message ? <p className={styles.goodText}>{message}</p> : null}
      {error ? <p className={styles.badText}>{error}</p> : null}
    </form>
  );
}
