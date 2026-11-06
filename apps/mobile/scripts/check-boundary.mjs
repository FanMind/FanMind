#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoots = [join(mobileRoot, "app"), join(mobileRoot, "src")];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"]);
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (allowedExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function report(file, rule, line, value) {
  violations.push({
    file: relative(mobileRoot, file),
    rule,
    line,
    value: value.trim().slice(0, 180),
  });
}

function checkSource(file, source) {
  const lines = source.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (/\.module\.css\b/.test(line)) {
      report(file, "website_css", lineNumber, line);
    }
    if (/from\s+["']next\/(?:headers|navigation|server)["']/.test(line)) {
      report(file, "next_runtime_import", lineNumber, line);
    }
    if (/(?:from\s+["']|require\(["'])react-native-webview(?:["']|["']\))/.test(line)) {
      report(file, "webview_dependency", lineNumber, line);
    }
    if (/from\s+["'](?:\.\.\/){3,}src\/(?:app|components)(?:\/|["'])/.test(line)) {
      report(file, "website_source_import", lineNumber, line);
    }
    if (/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_live_|sk_test_/.test(line)) {
      report(file, "server_secret_identifier", lineNumber, line);
    }
  }
}

const files = (await Promise.all(sourceRoots.map(walk))).flat();
for (const file of files) {
  checkSource(file, await readFile(file, "utf8"));
}

if (violations.length) {
  for (const violation of violations) {
    console.error(
      `MOBILE_BOUNDARY_ERROR ${violation.file}:${violation.line} ${violation.rule} ${violation.value}`,
    );
  }
  console.error(`MOBILE_BOUNDARY=FAILED (${violations.length})`);
  process.exit(1);
}

console.log(`MOBILE_BOUNDARY=OK (${files.length} runtime files checked)`);
