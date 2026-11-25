import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readCompleteCheckRuns } from "../operations/production-release-preflight.mjs";

const contract = JSON.parse(readFileSync(new URL("../../project-memory/BRANCH_PROTECTION_CONTRACT.json", import.meta.url)));
const repository = contract.repository;
const pinnedIssuer = name => name === "CodeQL" ? 57789 : 15368;

function requiredContexts(ruleset) {
  const statusRules = ruleset.rules?.filter(rule => rule.type === "required_status_checks") ?? [];
  const config = statusRules[0]?.parameters;
  const contexts = config?.required_status_checks;
  if (ruleset.id !== contract.ruleset_id || ruleset.source !== repository ||
      ruleset.enforcement !== "active" || ruleset.target !== "branch" ||
      !ruleset.conditions?.ref_name?.include?.includes("~DEFAULT_BRANCH") ||
      ruleset.conditions.ref_name.exclude?.length !== 0 ||
      ruleset.bypass_actors?.length !== 0 || statusRules.length !== 1 ||
      config.strict_required_status_checks_policy !== true || !Array.isArray(contexts) ||
      contexts.length !== contract.required_status_checks.length ||
      !contract.required_status_checks.every(name =>
        contexts.some(check => check.context === name && check.integration_id === pinnedIssuer(name)))) {
    throw new Error("required_status_contract_changed");
  }
  return contexts;
}

function checkState(checks, { context, integration_id }, head) {
  const matches = checks.filter(check => check.name === context && check.app?.id === integration_id);
  if (matches.length !== 1) return matches.length ? "ambiguous" : "missing";
  const [check] = matches;
  if (check.head_sha !== head) return "wrong_head";
  if (check.status !== "completed") return "pending";
  return check.conclusion || "unknown";
}

function matchesPr(pr, number, head) {
  return pr?.number === number && pr.state === "open" && pr.draft === false &&
    pr.base?.repo?.full_name === repository && pr.base?.ref === contract.branch &&
    pr.head?.repo?.full_name === repository && pr.head?.sha === head;
}

// Read-only. GitHub remains responsible for current mergeability, reviews,
// check results on a test merge, and all other applicable rulesets.
export async function mergeReadiness(number, head, get) {
  if (!Number.isSafeInteger(number) || number < 1 || !/^[a-f0-9]{40}$/u.test(head))
    throw new Error("invalid_pr_or_head");
  const prPath = `pulls/${number}`;
  const first = await get(prPath);
  if (!matchesPr(first, number, head)) throw new Error("pr_unavailable_or_head_changed");
  const [ruleset, inventory] = await Promise.all([
    get(`rulesets/${contract.ruleset_id}`), readCompleteCheckRuns(get, head),
  ]);
  const checks = requiredContexts(ruleset).map(context => ({
    name: context.context, state: checkState(inventory.check_runs, context, head),
  }));
  const last = await get(prPath);
  if (!matchesPr(last, number, head) || !/^[a-f0-9]{40}$/u.test(last.base.sha) ||
      first.base.sha !== last.base.sha) throw new Error("pull_request_changed");
  return { number, head, base: last.base.sha, checks, mergeable_state: last.mergeable_state,
    ready: checks.every(check => check.state === "success") &&
      last.mergeable === true && last.mergeable_state === "clean" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await mergeReadiness(Number(process.argv[2]), process.argv[3], path =>
      JSON.parse(execFileSync("gh", ["api", `repos/${repository}/${path}`], {
        encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
      })));
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 1;
  } catch (error) {
    console.error("Unable to confirm merge readiness.", error.message.split("\n")[0]);
    process.exitCode = 1;
  }
}
