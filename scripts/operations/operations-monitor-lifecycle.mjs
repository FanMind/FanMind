#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import {
  operationsErrorCode,
  runLifecycleAcceptance,
} from "./operations-monitor.mjs";

const VERSION = "fanmind-operations-monitor-lifecycle-1";
const LIFECYCLE_ERROR_PATTERN = /^operations_monitor_lifecycle_(?:contract|email_not_disabled|warning_state|critical_state|recovery_state|email_audit|cleanup_failed)$/u;

function lifecycleErrorCode(error) {
  const value = String(error?.message ?? "");
  if (LIFECYCLE_ERROR_PATTERN.test(value)) return value;
  return operationsErrorCode(error);
}

function lifecycleLog(level, event, meta = {}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    version: VERSION,
    ...meta,
  }));
}

async function main(env = process.env) {
  const result = await runLifecycleAcceptance(env);
  lifecycleLog("info", "lifecycle_completed", {
    component: result.component,
    transitions: result.transitions,
    email_enabled: result.emailEnabled,
  });
  return result;
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  main().catch((error) => {
    lifecycleLog("error", "lifecycle_failed", {
      error_code: lifecycleErrorCode(error),
    });
    process.exitCode = 1;
  });
}

export { lifecycleErrorCode, main };
