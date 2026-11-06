import { pathToFileURL } from "node:url";

export const ORCHESTRATOR_RECEIPT_PATH =
  "project-memory/ORCHESTRATOR_RESULT.json";

export function classifyManagerPrFiles({ pages, expectedChangedFiles }) {
  if (
    !Number.isSafeInteger(expectedChangedFiles) ||
    expectedChangedFiles < 0 ||
    !Array.isArray(pages) ||
    pages.some((page) => !Array.isArray(page))
  ) {
    return { receiptOnly: false, classification: "uncertain", observedCount: 0 };
  }

  const files = pages.flat();
  if (
    files.length !== expectedChangedFiles ||
    files.some((file) => typeof file?.filename !== "string")
  ) {
    return {
      receiptOnly: false,
      classification: "uncertain",
      observedCount: files.length,
    };
  }

  const receiptOnly =
    files.length === 1 && files[0].filename === ORCHESTRATOR_RECEIPT_PATH;
  return {
    receiptOnly,
    classification: receiptOnly ? "receipt_only" : "dispatch",
    observedCount: files.length,
  };
}

async function run() {
  const expectedIndex = process.argv.indexOf("--expected");
  const expectedChangedFiles = Number(process.argv[expectedIndex + 1]);
  let input = "";
  for await (const chunk of process.stdin) input += chunk;

  let pages;
  try {
    pages = JSON.parse(input);
  } catch {
    pages = null;
  }

  const result = classifyManagerPrFiles({ pages, expectedChangedFiles });
  process.stdout.write(
    `receipt_only=${result.receiptOnly}\n` +
      `classification=${result.classification}\n` +
      `observed_count=${result.observedCount}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
