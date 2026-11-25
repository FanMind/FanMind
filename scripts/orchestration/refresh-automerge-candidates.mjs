import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { refreshAutomergePr } from "./refresh-automerge-pr.mjs";

const repo = "FanMind/FanMind";

// A main push may make several PRs stale. Paginate once and re-read each
// candidate in the existing exact-head updater immediately before a write.
export function refreshCandidates(gh, number) {
  const single = number !== undefined && number !== "";
  if (single && !/^[1-9]\d*$/u.test(number)) throw new Error("invalid_pr_number");
  const path = single ? `repos/${repo}/pulls/${number}` :
    `repos/${repo}/pulls?state=open&base=main&per_page=100`;
  const data = JSON.parse(gh(single ? ["api", path] : ["api", "--paginate", "--slurp", path]));
  const candidates = single ? [data] : data.flat();
  const results = [];
  for (const pr of candidates) {
    if (pr.state !== "open" || pr.draft !== false || !pr.auto_merge ||
        pr.base?.repo?.full_name !== repo || pr.base?.ref !== "main" ||
        pr.head?.repo?.full_name !== repo) continue;
    try {
      const status = refreshAutomergePr(String(pr.number), pr.head.sha, gh);
      results.push({ number: pr.number, status });
    } catch {
      results.push({ number: pr.number, status: "REFRESH_FAILED" });
    }
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const results = refreshCandidates(args => execFileSync("gh", args, {
      encoding: "utf8", timeout: 60000, maxBuffer: 32 * 1024 * 1024,
    }), process.argv[2]);
    console.log(JSON.stringify(results));
    if (results.some(result => ["CONFLICT", "REFRESH_FAILED", "MERGE_STATE_UNKNOWN"].includes(result.status))) process.exitCode = 1;
  } catch {
    console.error("Cannot read the auto-merge candidates.");
    process.exitCode = 1;
  }
}
