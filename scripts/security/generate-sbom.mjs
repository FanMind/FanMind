#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function parseArgument(name, fallback = null) {
  const exact = process.argv.findIndex((value) => value === name);
  if (exact >= 0) return process.argv[exact + 1] ?? fallback;
  const prefix = `${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : fallback;
}

function validateCycloneDx(payload) {
  if (
    payload?.bomFormat !== "CycloneDX" ||
    typeof payload?.specVersion !== "string" ||
    !Array.isArray(payload?.components)
  ) {
    throw new Error("cyclonedx_sbom_invalid");
  }

  return {
    format: payload.bomFormat,
    specVersion: payload.specVersion,
    componentCount: payload.components.length,
  };
}

function generateCycloneDx(cwd) {
  const result = spawnSync(
    "npm",
    ["sbom", "--sbom-format=cyclonedx"],
    {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );

  if (result.error || result.status !== 0) {
    throw new Error("cyclonedx_sbom_generation_failed");
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error("cyclonedx_sbom_json_invalid");
  }

  return { payload, summary: validateCycloneDx(payload) };
}

async function main() {
  const rootDirectory = process.cwd();
  const outputDirectory = resolve(
    rootDirectory,
    parseArgument("--output-dir", "sbom-artifacts"),
  );
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });

  const root = generateCycloneDx(rootDirectory);
  const mobile = generateCycloneDx(resolve(rootDirectory, "apps/mobile"));
  const rootPath = resolve(outputDirectory, "fanmind-web.cdx.json");
  const mobilePath = resolve(outputDirectory, "fanmind-mobile.cdx.json");
  const summaryPath = resolve(outputDirectory, "sbom-summary.json");

  await Promise.all([
    writeFile(rootPath, `${JSON.stringify(root.payload, null, 2)}\n`, {
      mode: 0o600,
    }),
    writeFile(mobilePath, `${JSON.stringify(mobile.payload, null, 2)}\n`, {
      mode: 0o600,
    }),
    writeFile(
      summaryPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          web: root.summary,
          mobile: mobile.summary,
          environmentValuesRead: false,
          committedToRepository: false,
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    ),
  ]);

  console.log(`SBOM_WEB_FORMAT=${root.summary.format}`);
  console.log(`SBOM_WEB_SPEC_VERSION=${root.summary.specVersion}`);
  console.log(`SBOM_WEB_COMPONENT_COUNT=${root.summary.componentCount}`);
  console.log(`SBOM_MOBILE_FORMAT=${mobile.summary.format}`);
  console.log(`SBOM_MOBILE_SPEC_VERSION=${mobile.summary.specVersion}`);
  console.log(`SBOM_MOBILE_COMPONENT_COUNT=${mobile.summary.componentCount}`);
  console.log("SBOM_RESULT=success");
}

export { generateCycloneDx, validateCycloneDx };

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `SBOM_FATAL=${error instanceof Error ? error.message : "unknown"}`,
    );
    process.exit(1);
  });
}
