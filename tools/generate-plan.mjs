#!/usr/bin/env node
// Owner-operated CLI. No model-generated code is executed or deployed.
import {randomUUID} from "node:crypto";
import {issueLocalDraftPermit} from "../engineering/local-permit.mjs";
import {runPlanOnlyMission} from "../engineering/plan-only.mjs";
import {quarantineDraft} from "../engineering/proof-bundle.mjs";

function option(name) {
  const pos = process.argv.indexOf(name);
  return pos >= 0 ? process.argv[pos + 1] : undefined;
}
if (process.argv.includes("--help")) {
  process.stdout.write(
    'Usage: npm run plan -- --goal "Make a task tracker" --confirm-inference [--quarantine-root ./approved-output --confirm-quarantine]\n' +
    "Requires GROQ_API_KEY, GROQ_MODEL and PLAN_AUTH_KEY (>=32 characters).\n" +
    "Without --quarantine-root, only prints a validated plan; with both quarantine flags, writes files without running them.\n" +
    "plan ONLY, no code execution, no deployment.\n"
  );
} else {
  const goal = option("--goal");
  const approved = process.argv.includes("--confirm-inference");
  const root = option("--quarantine-root");
  const quarantineApproved = process.argv.includes("--confirm-quarantine");
  if (!approved) {
    process.stderr.write("BLOCKED: explicit --confirm-inference approval is required for this provider call.\n");
    process.exitCode = 2;
  } else if ((root && !quarantineApproved) || (quarantineApproved && !root)) {
    process.stderr.write("BLOCKED: --quarantine-root also requires --confirm-quarantine, and vice versa.\n");
    process.exitCode = 2;
  } else if (!goal || !process.env.GROQ_API_KEY || !process.env.GROQ_MODEL || !process.env.PLAN_AUTH_KEY) {
    process.stderr.write("BLOCKED: goal, GROQ_API_KEY, GROQ_MODEL and PLAN_AUTH_KEY are required; no API call made.\n");
    process.exitCode = 2;
  } else {
    const mission = {id: "plan-" + randomUUID(),goal,allowModel:true};
    const now=Date.now();
    try {
      const permit=issueLocalDraftPermit({missionId:mission.id,secret:process.env.PLAN_AUTH_KEY,now});
      const result=await runPlanOnlyMission({
        mission,permit,permitSecret:process.env.PLAN_AUTH_KEY,
        consumedNonces:new Set(),apiKey:process.env.GROQ_API_KEY,
        model:process.env.GROQ_MODEL,now
      });
      if (root) {
        const receipt=await quarantineDraft({result,outputRoot:root});
        process.stdout.write(JSON.stringify(receipt,null,2)+"\n");
      } else {
        process.stdout.write(JSON.stringify(result,null,2)+"\n");
      }
    } catch(error) {
      // Never print provider raw errors, credentials, prompts, generated source or filesystem traces.
      const safe = typeof error.code === "string" && /^[A-Z][A-Z_]{2,60}$/.test(error.code)
        ? error.code : "PLAN_FAILED";
      process.stderr.write("BLOCKED: "+safe+"\n");
      process.exitCode=1;
    }
  }
}
