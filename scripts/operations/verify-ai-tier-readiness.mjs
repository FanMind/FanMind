import {
  AI_TIER_IDS,
  evaluateAiTierReadiness,
  getAiTierRuntimeReadinessFromEnvironment,
} from "../../src/config/aiTiers.mjs";

function expectedReady(publicStatus) {
  return publicStatus === "Aktiv";
}

let contractPasses = true;

for (const tierId of AI_TIER_IDS) {
  const readiness = evaluateAiTierReadiness(
    tierId,
    getAiTierRuntimeReadinessFromEnvironment(tierId),
  );
  const status = readiness.ready ? "READY" : "BLOCKED";
  const blockers =
    readiness.blockers.length === 0
      ? "none"
      : readiness.blockers.join(",");

  console.log(
    `AI_TIER_${tierId.toUpperCase()}=${status} blockers=${blockers}`,
  );

  if (readiness.ready !== expectedReady(readiness.publicStatus)) {
    contractPasses = false;
  }
}

if (!contractPasses) {
  console.error("AI_TIER_READINESS=FAIL");
  process.exitCode = 1;
} else {
  console.log("AI_TIER_READINESS=PASS");
}
