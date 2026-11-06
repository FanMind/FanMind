import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdminEmail } from "@/lib/admin";
import {
  ADMIN_ASSET_BUCKET,
  ADMIN_ASSET_MAX_BYTES,
  getAdminAssetBucketSetupHint,
  getAdminAssetContentType,
  getAdminAssetPublicUrl,
  getAdminAssetServiceToken,
  isAdminAssetCategory,
  sanitizeAdminAssetFileName,
} from "@/lib/adminAssets";
import {
  getSupabaseApiKeyHeaders,
  getSupabasePublicConfig,
} from "@/lib/supabase/config";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
} from "@/lib/httpMutationPolicy.mjs";

const MAX_ADMIN_ASSET_FORM_BYTES = ADMIN_ASSET_MAX_BYTES + 64_000;

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json(
      { error: "Die Upload-Anfrage konnte nicht verifiziert werden.", code: "origin_forbidden" },
      { status: 403 },
    );
  }

  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  if (!isPlatformAdminEmail(data.user.email)) return NextResponse.json({ error: "Nur Platform-Admins dürfen Assets hochladen." }, { status: 403 });

  const config = getSupabasePublicConfig();
  if (!config) return NextResponse.json({ error: "Der Asset-Speicher ist serverseitig nicht vollständig konfiguriert.", code: "asset_storage_unavailable" }, { status: 500 });

  const serviceToken = getAdminAssetServiceToken();
  if (!serviceToken) return NextResponse.json({ error: "Der Asset-Speicher ist serverseitig nicht vollständig konfiguriert.", code: "asset_storage_unavailable" }, { status: 500 });

  const parsedBody = await readBoundedFormDataRequest(
    request,
    MAX_ADMIN_ASSET_FORM_BYTES,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        error: parsedBody.reason === "payload_too_large"
          ? "Die Upload-Anfrage ist zu groß."
          : "Die Upload-Anfrage ist ungültig.",
        code: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request",
      },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const formData = parsedBody.value;
  const file = formData?.get("file");
  const category = String(formData?.get("category") ?? "");

  if (!isAdminAssetCategory(category)) return NextResponse.json({ error: "Bitte eine gültige Kategorie auswählen." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Bitte eine Bilddatei auswählen." }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: "Die Datei ist leer." }, { status: 400 });
  if (file.size > ADMIN_ASSET_MAX_BYTES) return NextResponse.json({ error: "Die Datei ist zu groß. Maximal erlaubt sind 5 MB." }, { status: 413 });

  const contentType = getAdminAssetContentType(file);
  if (!contentType) return NextResponse.json({ error: "Erlaubt sind nur png, jpg, jpeg und webp." }, { status: 415 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = sanitizeAdminAssetFileName(file.name);
  const path = `${category}/${timestamp}-${safeName}`;
  const uploadResponse = await fetch(`${config.url}/storage/v1/object/${ADMIN_ASSET_BUCKET}/${encodeURI(path).replace(/%2F/g, "/")}`, {
    method: "POST",
    headers: {
      ...getSupabaseApiKeyHeaders(serviceToken),
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "false",
    },
    body: await file.arrayBuffer(),
  });

  if (uploadResponse.status === 404) return NextResponse.json({ error: getAdminAssetBucketSetupHint() }, { status: 500 });
  if (!uploadResponse.ok) {
    return NextResponse.json(
      { error: "Upload fehlgeschlagen. Bitte versuche es erneut.", code: "asset_upload_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    asset: {
      name: safeName,
      category,
      path,
      url: getAdminAssetPublicUrl(path),
      size: file.size,
      contentType,
    },
  });
}
