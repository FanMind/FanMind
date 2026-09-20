import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  extractText,
  initNodeDecompression_parser as initNodeDecompression,
  isArray,
  isStream,
  openPdf,
} from "pdfnative";
import ts from "typescript";

const routePath = "src/app/settings/profile/data-export/route.ts";
const pdfPath = "src/lib/dataDisclosurePdf.ts";
const paginationPath = "src/lib/dataDisclosurePagination.ts";
const sectionPath = "src/app/settings/AccountSections.tsx";

async function loadTypeScriptModule(path, prefix) {
  const source = await readFile(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      strict: true,
    },
    fileName: path,
  }).outputText;
  const directory = await mkdtemp(join(process.cwd(), `.${prefix}-`));
  const modulePath = join(directory, `${prefix}.mjs`);
  await writeFile(modulePath, output, "utf8");
  const loadedModule = await import(
    `${pathToFileURL(modulePath).href}?t=${Date.now()}`
  );
  return {
    loadedModule,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

function extractedText(pdf) {
  return extractText(pdf)
    .map((page) => page.text)
    .join("\n");
}

function decodedPageContent(pdf) {
  const reader = openPdf(pdf);
  const decoded = [];

  for (let pageIndex = 0; pageIndex < reader.pageCount; pageIndex += 1) {
    const page = reader.getPage(pageIndex);
    const contents = reader.resolveValue(page.get("Contents") ?? null);
    const streams = [];

    if (contents !== null && isStream(contents)) {
      streams.push(contents);
    } else if (isArray(contents)) {
      for (const candidate of contents) {
        const stream = reader.resolveValue(candidate);
        if (stream !== null && isStream(stream)) streams.push(stream);
      }
    }

    for (const stream of streams) {
      decoded.push(new TextDecoder().decode(reader.decodeStream(stream)));
    }
  }

  return decoded.join("\n");
}

function pdfUtf16HexPayload(value) {
  let hex = "";
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    if (codePoint > 0xffff) {
      const high = 0xd800 + ((codePoint - 0x10000) >> 10);
      const low = 0xdc00 + ((codePoint - 0x10000) & 0x3ff);
      hex += high.toString(16).padStart(4, "0").toUpperCase();
      hex += low.toString(16).padStart(4, "0").toUpperCase();
      index += 1;
    } else {
      hex += codePoint.toString(16).padStart(4, "0").toUpperCase();
    }
  }
  return hex;
}

function disclosureContact(index, workspaceId = "workspace-1") {
  return {
    id: `contact-${index}`,
    workspace_id: workspaceId,
    display_name: `Kontakt ${index}`,
    handle: `@kontakt_${index}`,
    source_platform: "manual",
    language: index % 2 ? "en" : "de",
    status: "active",
    tags: ["vip"],
    summary: `Zusammenfassung ${index}`,
    internal_notes: `Notiz ${index}`,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-20T12:00:00.000Z",
  };
}

test("profile offers one localized protected PDF download without legacy mail or logout actions", async () => {
  const [route, section] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(sectionPath, "utf8"),
  ]);

  assert.match(section, /\/settings\/profile\/data-export\?lang=\$\{locale\}/u);
  assert.match(section, /PDF-Datenauskunft herunterladen/u);
  assert.match(section, /Download PDF data disclosure/u);
  assert.doesNotMatch(section, /DSGVO-Datenauskunft anfordern/u);
  assert.doesNotMatch(
    section,
    /mailto:kontakt@fanmind\.ch\?subject=DSGVO-Datenauskunft/u,
  );
  assert.doesNotMatch(section, /<form action=\{logoutAction\}>/u);
  assert.doesNotMatch(section, /logoutAction:\s*\(\) => Promise<void>/u);

  assert.match(route, /getSupabaseServerUser\(\)/u);
  assert.match(route, /getUserWorkspaceDashboard\(data\.user\)/u);
  assert.match(route, /getAllWorkspaceContactsForDisclosure\(workspace\.id\)/u);
  assert.match(route, /getWorkspaceMetaDataForDisclosure\(workspace\.id, data\.user\.id\)/u);
  assert.match(route, /buildStoredDataSections\(\[\.\.\.storedData, \.\.\.privateData\], locale\)/u);
  assert.match(route, /await createDataDisclosurePdf\(/u);
  assert.match(route, /Content-Type": "application\/pdf"/u);
  assert.match(route, /Cache-Control": "private, no-store"/u);
  assert.match(route, /X-Content-Type-Options": "nosniff"/u);
  assert.match(route, /fanmind-data-disclosure\.pdf/u);
  assert.doesNotMatch(
    route,
    /stripe_customer_id|stripe_subscription_id|stripe_checkout_session_id|test_access_flags|billing_admin_note|SUPABASE_SERVICE_ROLE_KEY|page_access_token_encrypted|token_last_four/u,
  );
});

test("PDF generator emits all contacts across multiple PDF/A-2u pages without silent truncation", async () => {
  await initNodeDecompression();
  const { loadedModule: pdfModule, cleanup } = await loadTypeScriptModule(
    pdfPath,
    "fanmind-pdf-test",
  );
  try {
    const contacts = Array.from({ length: 140 }, (_, index) => ({
      displayName: `Kontakt ${index + 1}`,
      handle: `@kontakt_${index + 1}`,
      sourcePlatform: "manual",
      language: index % 2 ? "en" : "de",
      status: "active",
      tags: ["vip", `gruppe-${index + 1}`],
      summary: `Vollständige Zusammenfassung für Kontakt ${index + 1} mit genügend Text für einen sicheren Seitenumbruch ohne Abschneiden.`,
      internalNotes: `Interne Notiz ${index + 1}`,
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-20T12:00:00.000Z",
    }));

    const pdf = await pdfModule.createDataDisclosurePdf({
      generatedAt: new Date("2026-07-22T12:00:00.000Z"),
      locale: "de",
      user: {
        id: "user-1",
        email: "owner@example.com",
        displayName: "Test Owner",
      },
      workspace: {
        id: "workspace-1",
        name: "Test Workspace",
        planId: "starter",
        commercialOption: "Starter Flex",
        billingStatus: "active",
        setupFeeCents: 99000,
        monthlyFeeCents: 31200,
        commitmentMonths: 0,
        organizationName: "Test Organisation",
      },
      contacts,
    });

    const pages = extractText(pdf);
    const text = pages.map((page) => page.text).join("\n");
    assert.equal(Buffer.from(pdf).subarray(0, 8).toString("ascii"), "%PDF-1.7");
    assert.match(text, /FanMind PDF-Datenauskunft/u);
    assert.match(text, /CRM-Kontakte/u);
    assert.match(text, /Kontakt 140/u);
    assert.match(text, /Seite 1 \/ /u);
    assert.ok(pages.length > 2, "large disclosure must span multiple PDF pages");
    assert.doesNotMatch(text, /Weitere Kontakte|nicht im kompakten PDF gelistet/u);
  } finally {
    await cleanup();
  }
});

test("PDF Unicode output keeps the exact original personal data in tagged ActualText", async () => {
  await initNodeDecompression();
  const { loadedModule: pdfModule, cleanup } = await loadTypeScriptModule(
    pdfPath,
    "fanmind-pdf-unicode",
  );
  try {
    const unicodeValues = [
      "Мария Иванова",
      "Αθηνά Παπαδοπούλου",
      "李小龍",
      "Łukasz Żółć",
      "مرحبا بالعالم",
      "Fan 🎉",
    ];
    const pdf = await pdfModule.createDataDisclosurePdf({
      generatedAt: new Date("2026-07-22T12:00:00.000Z"),
      locale: "en",
      user: { id: "unicode-user", displayName: unicodeValues[0] },
      workspace: { id: "unicode-workspace", name: unicodeValues[1] },
      contacts: unicodeValues.slice(2).map((value, index) => ({
        displayName: value,
        handle: `@unicode_${index}`,
        summary: `Stored value: ${value}`,
      })),
    });

    const markedContent = decodedPageContent(pdf);
    assert.match(markedContent, /\/ActualText <FEFF/u);
    for (const value of unicodeValues) {
      assert.ok(
        markedContent.includes(pdfUtf16HexPayload(value.normalize("NFC"))),
        `tagged PDF must preserve exact ActualText for ${value}`,
      );
    }

    const text = extractedText(pdf).normalize("NFC");
    for (const value of [unicodeValues[0], unicodeValues[1], unicodeValues[3]]) {
      assert.match(
        text,
        new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"),
      );
    }
  } finally {
    await cleanup();
  }
});

test("empty exports stay honest and English output uses English section labels", async () => {
  await initNodeDecompression();
  const { loadedModule: pdfModule, cleanup } = await loadTypeScriptModule(
    pdfPath,
    "fanmind-pdf-empty",
  );
  try {
    const pdf = await pdfModule.createDataDisclosurePdf({
      generatedAt: new Date("2026-07-22T12:00:00.000Z"),
      locale: "en",
      user: { id: "user-empty" },
      workspace: { id: "workspace-empty", name: "Empty Workspace" },
      contacts: [],
    });
    const pages = extractText(pdf);
    const text = pages.map((page) => page.text).join("\n");
    assert.match(text, /FanMind PDF data disclosure/u);
    assert.match(text, /No contacts are stored in this workspace\./u);
    assert.match(text, new RegExp(`Page 1 / ${pages.length}`, "u"));
    assert.ok(pages.length >= 1);
  } finally {
    await cleanup();
  }
});

test("PDF includes stored chat, post-cache, metric and profile sections without tokens", async () => {
  await initNodeDecompression();
  const { loadedModule: pdfModule, cleanup } = await loadTypeScriptModule(
    pdfPath,
    "fanmind-pdf-meta-sections",
  );
  try {
    const pdf = await pdfModule.createDataDisclosurePdf({
      generatedAt: new Date("2026-08-03T12:00:00.000Z"),
      locale: "de",
      user: { id: "user-meta" },
      workspace: { id: "workspace-meta", name: "Meta Workspace" },
      contacts: [],
      storedDataSections: [
        {
          title: "Gespeicherte Meta-Chats und Kommentare",
          countLabel: "Gespeicherte Datensätze",
          emptyMessage: "Keine Daten",
          entries: [
            {
              title: "Nachricht 1",
              fields: ["content: Danke für deine Nachricht", "source_platform: facebook"],
            },
          ],
        },
        {
          title: "Eigener Post-/Medien-Cache",
          countLabel: "Gespeicherte Datensätze",
          emptyMessage: "Keine Daten",
          entries: [],
        },
        {
          title: "Reichweiten- und Metrik-Snapshots",
          countLabel: "Gespeicherte Datensätze",
          emptyMessage: "Keine Daten",
          entries: [],
        },
        {
          title: "Fan-Analyseberichte",
          countLabel: "Gespeicherte Datensätze",
          emptyMessage: "Keine Daten",
          entries: [],
        },
      ],
    });
    const text = extractedText(pdf);
    assert.match(text, /Gespeicherte Meta-Chats und Kommentare/u);
    assert.match(text, /Danke für deine Nachricht/u);
    assert.match(text, /Eigener Post-\/Medien-Cache/u);
    assert.match(text, /Reichweiten- und Metrik-Snapshots/u);
    assert.match(text, /Fan-Analyseberichte/u);
    assert.doesNotMatch(text, /page_access_token_encrypted|token_last_four/u);
  } finally {
    await cleanup();
  }
});

test("contact pagination exports more than the PostgREST row cap in stable order", async () => {
  const { loadedModule: paginationModule, cleanup } =
    await loadTypeScriptModule(
      paginationPath,
      "fanmind-disclosure-pagination",
    );
  try {
    const rows = Array.from({ length: 1_201 }, (_, index) =>
      disclosureContact(index + 1),
    );
    const requests = [];
    const contacts = await paginationModule.collectAllDisclosureContacts({
      workspaceId: "workspace-1",
      pageSize: 500,
      maxRows: 2_000,
      fetchPage: async ({ offset, limit }) => {
        requests.push({ offset, limit });
        return rows.slice(offset, offset + limit);
      },
    });

    assert.equal(contacts.length, 1_201);
    assert.equal(contacts.at(-1).id, "contact-1201");
    assert.deepEqual(requests, [
      { offset: 0, limit: 500 },
      { offset: 500, limit: 500 },
      { offset: 1_000, limit: 500 },
    ]);
  } finally {
    await cleanup();
  }
});

test("contact pagination fails closed instead of truncating or crossing workspace boundaries", async () => {
  const { loadedModule: paginationModule, cleanup } =
    await loadTypeScriptModule(
      paginationPath,
      "fanmind-disclosure-pagination-guard",
    );
  try {
    const fourRows = Array.from({ length: 4 }, (_, index) =>
      disclosureContact(index + 1),
    );
    await assert.rejects(
      () =>
        paginationModule.collectAllDisclosureContacts({
          workspaceId: "workspace-1",
          pageSize: 2,
          maxRows: 3,
          fetchPage: async ({ offset, limit }) =>
            fourRows.slice(offset, offset + limit),
        }),
      /mehr als 3 Kontakte.*ohne Datenabschneidung/u,
    );

    await assert.rejects(
      () =>
        paginationModule.collectAllDisclosureContacts({
          workspaceId: "workspace-1",
          fetchPage: async () => [disclosureContact(1, "foreign-workspace")],
        }),
      /nicht zum autorisierten Workspace/u,
    );
  } finally {
    await cleanup();
  }
});
