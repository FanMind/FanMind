import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath = new URL("../src/app/fans/import/csv.ts", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    strict: true,
  },
  fileName: sourcePath.pathname,
}).outputText;
const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "fanmind-csv-import-parser-"),
);
const modulePath = join(temporaryDirectory, "csv.mjs");
await writeFile(modulePath, transpiled, "utf8");

after(() => rm(temporaryDirectory, { recursive: true, force: true }));

const {
  CSV_IMPORT_LIMITS,
  csvHasPlatformColumn,
  parseCsvContacts,
  withDefaultSourcePlatform,
} = await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`);

test("CSV parser accepts quoted fields, aliases, and normalized allowed values", () => {
  const result = parseCsvContacts(
    [
      "display_name;handle;platform;language;status;summary",
      '"Ada; Lovelace";@ada;IG;EN;VIP;"Sagt ""Hallo"""',
    ].join("\n"),
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.contacts, [
    {
      displayName: "Ada; Lovelace",
      handle: "@ada",
      sourcePlatform: "instagram",
      language: "en",
      status: "vip",
      tags: [],
      summary: 'Sagt "Hallo"',
    },
  ]);
});

test("CSV parser rejects unknown platform, language, and status without coercion", () => {
  const result = parseCsvContacts(
    [
      "display_name,platform,language,status",
      "Unknown Platform,my-social,de,new",
      "Unknown Language,manual,es,new",
      "Unknown Status,manual,de,prospect",
      "Valid Default,,fr,follow_up",
    ].join("\n"),
    "telegram",
  );

  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].displayName, "Valid Default");
  assert.equal(result.contacts[0].sourcePlatform, "telegram");
  assert.equal(result.errors.length, 3);
  assert.match(result.errors[0], /Plattform "my-social" wird nicht unterstützt/u);
  assert.match(result.errors[1], /Sprache "es" wird nicht unterstützt/u);
  assert.match(result.errors[2], /Status "prospect" wird nicht unterstützt/u);
});

test("CSV parser rejects an unknown default platform only when the column is absent", () => {
  const withoutColumn = parseCsvContacts("display_name\nAda", "not-a-platform");
  assert.deepEqual(withoutColumn.contacts, []);
  assert.match(withoutColumn.errors[0], /Standardplattform wird nicht unterstützt/u);

  const withColumn = parseCsvContacts(
    "display_name,platform\nAda,manual",
    "not-a-platform",
  );
  assert.equal(withColumn.contacts.length, 1);
  assert.deepEqual(withColumn.errors, []);
});

test("CSV parser rejects malformed quoting and default-platform injection leaves it untouched", () => {
  for (const csvText of [
    'display_name,summary\nAda,"nicht geschlossen',
    'display_name,summary\nAd"a,text',
    'display_name,summary\n"Ada"x,text',
  ]) {
    const result = parseCsvContacts(csvText);
    assert.deepEqual(result.contacts, []);
    assert.match(result.errors[0], /Anführungszeichen|unerwartete Zeichen/u);
    assert.equal(withDefaultSourcePlatform(csvText, "manual"), csvText);
  }
});

test("CSV parser enforces the UTF-8 byte limit before parsing", () => {
  const oversized = `display_name\n${"a".repeat(CSV_IMPORT_LIMITS.maxBytes)}`;
  const result = parseCsvContacts(oversized);

  assert.deepEqual(result.contacts, []);
  assert.match(result.errors[0], /maximale Größe/u);
});

test("CSV parser enforces record, column, and field limits", () => {
  const maximumRows = [
    "display_name",
    ...Array.from(
      { length: CSV_IMPORT_LIMITS.maxDataRows },
      (_, index) => `Kontakt ${index + 1}`,
    ),
  ].join("\n");
  assert.equal(
    parseCsvContacts(maximumRows).contacts.length,
    CSV_IMPORT_LIMITS.maxDataRows,
  );

  const tooManyRows = `${maximumRows}\nEin Kontakt zu viel`;
  assert.match(parseCsvContacts(tooManyRows).errors[0], /Kontaktzeilen/u);

  const tooManyColumns = `${Array.from(
    { length: CSV_IMPORT_LIMITS.maxColumns + 1 },
    (_, index) => (index === 0 ? "display_name" : `extra_${index}`),
  ).join(",")}\nAda`;
  assert.match(parseCsvContacts(tooManyColumns).errors[0], /Spalten/u);

  const oversizedField = `display_name\n${"a".repeat(
    CSV_IMPORT_LIMITS.maxFieldCharacters + 1,
  )}`;
  assert.match(parseCsvContacts(oversizedField).errors[0], /CSV-Feld/u);
});

test("platform header detection remains strict on malformed input", () => {
  assert.equal(csvHasPlatformColumn("display_name,platform\nAda,manual"), true);
  assert.equal(csvHasPlatformColumn('display_name,platform\n"Ada,manual'), false);
});
