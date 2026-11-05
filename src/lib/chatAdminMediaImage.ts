import sharp from "sharp";
import { ChatAdminMediaError, MEDIA_MAX_BYTES } from "./chatAdminMediaPolicy.mjs";

export async function normalizeMediaImage(bytes:Uint8Array):Promise<Buffer> {
  if (!bytes.length || bytes.length > MEDIA_MAX_BYTES) throw new ChatAdminMediaError("invalid_image_size");
  try {
    const image = sharp(bytes,{limitInputPixels:16_000_000,failOn:"warning",animated:false});
    const metadata = await image.metadata();
    if (!["jpeg","png","webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height) throw new Error("unsupported_image");
    // Decode and re-encode: no original filename, EXIF, hidden payload or animation.
    const normalized = await image.rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
    if (normalized.length > MEDIA_MAX_BYTES) throw new Error("image_too_large");
    return normalized;
  } catch { throw new ChatAdminMediaError("invalid_image"); }
}
