#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dbUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.SUPABASE_DB_URL ??
  "";

const hasRestConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

console.log(`DB-URL vorhanden: ${dbUrl ? "ja" : "nein"}`);

if (!dbUrl) {
  console.error(
    "Keine Datenbank-URL gefunden. Migration nicht ausgefuehrt. Erwartet: DATABASE_URL oder POSTGRES_URL oder SUPABASE_DB_URL.",
  );
  if (hasRestConfig) {
    console.error(
      "Hinweis: REST-Konfiguration allein reicht fuer CREATE TABLE nicht aus.",
    );
  }
  process.exit(1);
}

const psqlCheck = spawnSync("psql", ["--version"], {
  stdio: ["ignore", "ignore", "ignore"],
});
console.log(
  `psql vorhanden: ${!psqlCheck.error && (psqlCheck.status ?? 1) === 0 ? "ja" : "nein"}`,
);
if (psqlCheck.error || (psqlCheck.status ?? 1) !== 0) {
  console.error("psql ist nicht installiert.");
  process.exit(1);
}

const sqlFile = resolve(
  process.cwd(),
  "supabase/migrations/20260618100000_create_contact_reply_targets.sql",
);

if (!existsSync(sqlFile)) {
  console.error(`SQL-Datei nicht gefunden: ${sqlFile}`);
  process.exit(1);
}

const sql = readFileSync(sqlFile, "utf8");
const run = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1"], {
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
});

if (run.error) {
  if (run.error.code === "ENOENT") {
    console.error("psql ist nicht installiert.");
  } else {
    console.error(`Migration konnte nicht gestartet werden: ${run.error.message}`);
  }
  process.exit(1);
}

if ((run.status ?? 1) !== 0) {
  process.exit(run.status ?? 1);
}

console.log("Migration erfolgreich angewendet: contact_reply_targets");
