import {
  getSupabaseApiKeyHeaders,
  getSupabasePublicConfig,
} from "@/lib/supabase/config";

export const ADMIN_ASSET_BUCKET = "fanmind-assets";
export const ADMIN_ASSET_MAX_BYTES = 5 * 1024 * 1024;

export const ADMIN_ASSET_CATEGORIES = [
  "Logo",
  "Icon",
  "OpenGraph",
  "Screenshot",
  "Sales",
  "Sonstiges",
] as const;

export type AdminAssetCategory = (typeof ADMIN_ASSET_CATEGORIES)[number];

export type UploadedAdminAsset = {
  name: string;
  category: AdminAssetCategory;
  url: string;
  path: string;
  size: number | null;
  contentType: string | null;
  uploadedAt: string | null;
};

type StorageObject = {
  name?: string;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  last_accessed_at?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
    cacheControl?: string;
    [key: string]: unknown;
  } | null;
};

export function getAdminAssetServiceToken(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

export function isAdminAssetCategory(value: string): value is AdminAssetCategory {
  return ADMIN_ASSET_CATEGORIES.includes(value as AdminAssetCategory);
}

export function getAdminAssetBucketSetupHint(): string {
  return `Supabase Storage Bucket "${ADMIN_ASSET_BUCKET}" fehlt oder ist nicht erreichbar. Bitte den Bucket im Supabase Dashboard anlegen und Server-ENV SUPABASE_SERVICE_ROLE_KEY konfigurieren.`;
}

export function getAllowedAdminAssetExtensions(): string[] {
  return ["png", "jpg", "jpeg", "webp"];
}

export function getAdminAssetContentType(file: File): string | null {
  const allowedTypes = new Map([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
  ]);
  const lowerName = file.name.toLowerCase();
  const extension = lowerName.includes(".") ? lowerName.split(".").pop() : "";

  if (file.type && allowedTypes.has(file.type)) return file.type;
  if (extension && getAllowedAdminAssetExtensions().includes(extension)) {
    if (extension === "png") return "image/png";
    if (extension === "webp") return "image/webp";
    return "image/jpeg";
  }

  return null;
}

export function sanitizeAdminAssetFileName(fileName: string): string {
  const fallback = "asset";
  const trimmed = fileName.trim().toLowerCase();
  const parts = trimmed.split(".");
  const extension = parts.length > 1 ? parts.pop() : "";
  const base = (parts.join(".") || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
  const safeExtension = extension && getAllowedAdminAssetExtensions().includes(extension) ? extension : "png";

  return `${base}.${safeExtension}`;
}

export function getAdminAssetPublicUrl(path: string): string | null {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return `${config.url}/storage/v1/object/public/${ADMIN_ASSET_BUCKET}/${encodeURI(path).replace(/%2F/g, "/")}`;
}

function getStorageHeaders(serviceToken: string, contentType = "application/json"): HeadersInit {
  return {
    ...getSupabaseApiKeyHeaders(serviceToken),
    "Content-Type": contentType,
  };
}

export async function listUploadedAdminAssets(): Promise<{ assets: UploadedAdminAsset[]; error: string | null }> {
  const config = getSupabasePublicConfig();
  if (!config) return { assets: [], error: "Supabase ist noch nicht konfiguriert." };

  const serviceToken = getAdminAssetServiceToken();
  if (!serviceToken) return { assets: [], error: "SUPABASE_SERVICE_ROLE_KEY ist serverseitig nicht konfiguriert." };

  const assets: UploadedAdminAsset[] = [];

  for (const category of ADMIN_ASSET_CATEGORIES) {
    const response = await fetch(`${config.url}/storage/v1/object/list/${ADMIN_ASSET_BUCKET}`, {
      method: "POST",
      headers: getStorageHeaders(serviceToken),
      body: JSON.stringify({ prefix: `${category}/`, limit: 100, offset: 0, sortBy: { column: "created_at", order: "desc" } }),
      cache: "no-store",
    });

    if (response.status === 404) return { assets: [], error: getAdminAssetBucketSetupHint() };
    if (!response.ok) {
      const message = await response.text().catch(() => "");
      return { assets: [], error: `Assets konnten nicht aus Supabase Storage geladen werden. ${message || response.statusText}` };
    }

    const objects = (await response.json().catch(() => [])) as StorageObject[];
    for (const object of objects) {
      if (!object.name || object.name === ".emptyFolderPlaceholder") continue;
      const path = `${category}/${object.name}`;
      const url = getAdminAssetPublicUrl(path);
      if (!url) continue;
      assets.push({
        name: object.name,
        category,
        url,
        path,
        size: typeof object.metadata?.size === "number" ? object.metadata.size : null,
        contentType: typeof object.metadata?.mimetype === "string" ? object.metadata.mimetype : null,
        uploadedAt: object.created_at ?? object.updated_at ?? null,
      });
    }
  }

  return { assets, error: null };
}
