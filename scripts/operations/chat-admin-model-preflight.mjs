import { verifyChatAdminModelProvider } from "../../src/lib/chatAdminModelPolicy.mjs";

// One bounded synthetic provider request before switching a reviewed release.
// No Character/Fan/database writes, provider contents or credentials in logs.
try {
  await verifyChatAdminModelProvider({ apiKey: process.env.OPENAI_API_KEY });
  process.stdout.write("CHAT_ADMIN_MODEL_PREFLIGHT=PASS\n");
} catch (error) {
  process.stderr.write("CHAT_ADMIN_MODEL_PREFLIGHT=BLOCK\n");
  const reasons = ["KEY_MISSING", "ACCESS_DENIED", "MODEL_UNAVAILABLE", "RATE_LIMITED", "PROVIDER_ERROR", "RESPONSE_BINDING"];
  const reason = reasons.includes(error?.code) ? error.code : "PROBE_FAILED";
  process.stderr.write(`CHAT_ADMIN_MODEL_REASON=${reason}\n`);
  process.exitCode = 1;
}
