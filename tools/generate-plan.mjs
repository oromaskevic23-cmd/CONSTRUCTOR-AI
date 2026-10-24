#!/usr/bin/env node
// Owner-operated CLI. Emits validated draft JSON to stdout; NEVER writes or executes generated files.
import {randomUUID} from "node:crypto";
import {issueLocalDraftPermit} from "../engineering/local-permit.mjs";
import {runPlanOnlyMission} from "../engineering/plan-only.mjs";

function option(name) {
  const pos = process.argv.indexOf(name);
  return pos >= 0 ? process.argv[pos + 1] : undefined;
}
if (process.argv.includes("--help")) {
  process.stdout.write("Usage: npm run plan -- --goal \"Make a small task tracker\" --confirm-inference\n" +
    "Requires GROQ_API_KEY, GROQ_MODEL and PLAN_AUTH_KEY (>=32 characters); plan ONLY, no code execution.\n");
} else {
  const goal = option("--goal");
  const approved = process.argv.includes("--confirm-inference");
  if (!approved) {
    process.stderr.write("BLOCKED: explicit --confirm-inference approval is required for this provider call.\n");
    process.exitCode = 2;
  } else if (!goal || !process.env.GROQ_API_KEY || !process.env.GROQ_MODEL || !process.env.PLAN_AUTH_KEY) {
    process.stderr.write("BLOCKED: goal, GROQ_API_KEY, GROQ_MODEL and PLAN_AUTH_KEY are required; no API call made.\n");
    process.exitCode = 2;
  } else {
    const mission = {id: "plan-" + randomUUID(), goal, allowModel: true};
    const now = Date.now();
    try {
      const permit = issueLocalDraftPermit({missionId: mission.id, secret: process.env.PLAN_AUTH_KEY, now});
      const result = await runPlanOnlyMission({
        mission, permit, permitSecret: process.env.PLAN_AUTH_KEY,
        consumedNonces: new Set(), apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL, now
      });
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } catch (error) {
      // Emit only stable codes; never print provider raw errors, responses or secret values.
      process.stderr.write("BLOCKED: " + (error.code || error.name || "UNKNOWN") + "\n");
      process.exitCode = 1;
    }
  }
}
