#!/usr/bin/env node
// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Owner-operated CLI. No model-generated code is executed or deployed.
import {randomUUID,createHash} from "node:crypto";
import {createMissionLedger} from "../engineering/mission-ledger.mjs";
import {issueLocalDraftPermit, ROUTE_GROQ_PLAN} from "../engineering/local-permit.mjs";
import {runPlanOnlyMission} from "../engineering/plan-only.mjs";
import {quarantineDraft} from "../engineering/proof-bundle.mjs";

function option(name) {
  const pos = process.argv.indexOf(name);
  return pos >= 0 ? process.argv[pos + 1] : undefined;
}
if (process.argv.includes("--help")) {
  process.stdout.write(
    'Usage: npm run plan -- --goal "Make a task tracker" --confirm-inference [--ledger-root ./private-evidence] [--quarantine-root ./approved-output --confirm-quarantine]\n' +
    "Requires GROQ_API_KEY, GROQ_MODEL and PLAN_AUTH_KEY (>=32 characters).\n" +
    "An existing private --ledger-root or --quarantine-root is mandatory for a real request.\n" +
    "With both quarantine flags, writes files without running them.\n" +
    "plan ONLY, no code execution, no deployment.\n"
  );
} else {
  const goal = option("--goal");
  const approved = process.argv.includes("--confirm-inference");
  const root = option("--quarantine-root");
  const ledgerRoot=option("--ledger-root")||root;
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
  } else if(!ledgerRoot){
    process.stderr.write("BLOCKED: existing private ledger root required; no API call made.\n");process.exitCode=2;
  } else {
    const mission = {id: "plan-" + randomUUID(),goal:goal.trim(),allowModel:true};
    const now=Date.now();
    let ledger,observation={},scope=null,outcome="PLAN_FAILED";
    try {
      ledger=await createMissionLedger({root:ledgerRoot,missionId:mission.id,missionSha:createHash("sha256").update(mission.goal).digest("hex"),requestedOutputTokens:4000,model:process.env.GROQ_MODEL});
      const permit=issueLocalDraftPermit({mission,route:ROUTE_GROQ_PLAN,
        model:process.env.GROQ_MODEL,secret:process.env.PLAN_AUTH_KEY,now});
      scope=JSON.parse(Buffer.from(permit.split(".")[0],"base64url").toString("utf8")).scope_sha256;
      await ledger.append({event:"STARTED",permit_scope_hash:scope,outcome_code:"REQUEST_AUTHORIZED_NOT_YET_OBSERVED"});
      const result=await runPlanOnlyMission({
        mission,permit,permitSecret:process.env.PLAN_AUTH_KEY,
        consumedNonces:new Set(),apiKey:process.env.GROQ_API_KEY,
        model:process.env.GROQ_MODEL,now,onObservation:o=>{observation=o;},onAuthorization:a=>{if(a.scope_sha256!==scope)throw Error("PERMIT_SCOPE_MISMATCH");}
      });
      if (root) {
        const receipt=await quarantineDraft({result,outputRoot:root});
        outcome="QUARANTINED_NOT_EXECUTED";
        process.stdout.write(JSON.stringify(receipt,null,2)+"\n");
      } else {
        outcome="DRAFT_VALIDATED_NOT_EXECUTED";
        process.stdout.write(JSON.stringify(result,null,2)+"\n");
      }
    } catch(error) {
      // Never print provider raw errors, credentials, prompts, generated source or filesystem traces.
      const safe = typeof error.code === "string" && /^[A-Z][A-Z_]{2,60}$/.test(error.code)
        ? error.code : "PLAN_FAILED";
      outcome=safe;
      process.stderr.write("BLOCKED: "+safe+"\n");
      process.exitCode=1;
    }finally{
      if(ledger){try{await ledger.append({event:"TERMINAL",permit_scope_hash:scope,observation,outcome_code:outcome,terminated_reason:process.exitCode?outcome:null});}catch{process.stderr.write("BLOCKED: LEDGER_WRITE_FAILED\n");process.exitCode=1;}finally{await ledger.close();}}
    }
  }
}
