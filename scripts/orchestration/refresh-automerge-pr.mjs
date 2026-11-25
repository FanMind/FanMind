import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repository = "FanMind/FanMind";
const query = `query($number: Int!) {
  repository(owner: "FanMind", name: "FanMind") {
    pullRequest(number: $number) {
      state isDraft baseRefName headRefOid mergeStateStatus
      headRepository { nameWithOwner }
      autoMergeRequest { enabledAt }
    }
  }
}`;

// Caller supplies the authorized PR and its reviewed head. GitHub enforces the
// expected head again during the update; conflicting changes are never rebased.
export function refreshAutomergePr(number, head, gh) {
  if (!/^[1-9]\d*$/u.test(number) || !Number.isSafeInteger(Number(number)) ||
      !/^[a-f0-9]{40}$/u.test(head)) throw new Error("invalid_pr_or_head");

  const response = JSON.parse(gh(["api", "graphql", "-f", `query=${query}`, "-F", `number=${number}`]));
  const pr = response.data?.repository?.pullRequest;
  if (response.errors?.length || !pr || typeof pr.isDraft !== "boolean" ||
      !["CLOSED", "MERGED", "OPEN"].includes(pr.state)) throw new Error("pr_metadata_unavailable");
  if (pr.state !== "OPEN" || pr.isDraft || pr.baseRefName !== "main" ||
      pr.headRepository?.nameWithOwner !== repository || pr.headRefOid !== head ||
      !pr.autoMergeRequest?.enabledAt) return "NO_UPDATE";
  if (pr.mergeStateStatus === "DIRTY") return "CONFLICT";
  if (!pr.mergeStateStatus || pr.mergeStateStatus === "UNKNOWN") return "MERGE_STATE_UNKNOWN";
  if (pr.mergeStateStatus !== "BEHIND") return "NO_UPDATE";

  gh(["api", "--method", "PUT", `repos/${repository}/pulls/${number}/update-branch`,
    "-f", `expected_head_sha=${head}`]);
  return "UPDATE_REQUESTED";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(refreshAutomergePr(process.argv[2], process.argv[3], args =>
      execFileSync("gh", args, { encoding: "utf8", timeout: 30000 })));
  } catch {
    console.error("PR refresh could not be confirmed. Read the current PR before retrying.");
    process.exitCode = 1;
  }
}
