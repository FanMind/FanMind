#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const mobileRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const brandingRoot = resolve(mobileRoot, "assets/branding");
const storeRoot = resolve(mobileRoot, "assets/store");

await mkdir(storeRoot, { recursive: true });

await Promise.all([
  sharp(resolve(brandingRoot, "fanmind-app-icon.png"))
    .resize(512, 512, { fit: "fill" })
    .toColourspace("srgb")
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false })
    .toFile(resolve(storeRoot, "google-play-icon.png")),
  sharp(resolve(storeRoot, "google-play-feature-graphic-source.svg"), {
    density: 192,
  })
    .resize(1024, 500, { fit: "fill" })
    .flatten({ background: "#02040a" })
    .toColourspace("srgb")
    .removeAlpha()
    .png({ compressionLevel: 9, palette: false })
    .toFile(resolve(storeRoot, "google-play-feature-graphic.png")),
]);

console.log("MOBILE_STORE_ASSETS=rendered");
