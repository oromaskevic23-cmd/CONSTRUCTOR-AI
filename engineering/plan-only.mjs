// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Plan-only mission runner: signed local permit gate; NEVER builds or executes AI output.
import {validateMission} from "./draft-contract.mjs";
import {verifyLocalDraftPermit, ROUTE_GROQ_PLAN} from "./local-permit.mjs";
import {generateGroqDraft} from "./groq-gateway.mjs";

export async function runPlanOnlyMission({
  mission, permit, permitSecret, consumedNonces,
  apiKey, model, fetchImpl, timeoutMs = 20000, now = Date.now(),onObservation,onAuthorization=()=>{}
}) {
  const m = validateMission(mission);
  const authorization = verifyLocalDraftPermit({
    token: permit, mission: m, route: ROUTE_GROQ_PLAN, model,
    secret: permitSecret, consumedNonces, now
  });
  onAuthorization(authorization);
  const result = await generateGroqDraft({mission: m, apiKey, model, fetchImpl, timeoutMs,onObservation});
  return Object.freeze({
    ...result,
    authorization: {
      stage: "PLAN_ONLY",
      action: authorization.action,
      scope_sha256:authorization.scope_sha256,
      status: "LOCAL_HMAC_PERMIT_VERIFIED",
      note: "No independent human identity, production approval or sandbox authorization has been verified"
    }
  });
}
