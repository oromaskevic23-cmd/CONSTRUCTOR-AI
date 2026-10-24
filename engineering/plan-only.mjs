// Plan-only mission runner: signed local permit gate; NEVER builds or executes AI output.
import {validateMission} from "./draft-contract.mjs";
import {verifyLocalDraftPermit} from "./local-permit.mjs";
import {generateGroqDraft} from "./groq-gateway.mjs";

export async function runPlanOnlyMission({
  mission, permit, permitSecret, consumedNonces,
  apiKey, model, fetchImpl, timeoutMs = 20000, now = Date.now()
}) {
  const m = validateMission(mission);
  const authorization = verifyLocalDraftPermit({
    token: permit, missionId: m.id, secret: permitSecret, consumedNonces, now
  });
  const result = await generateGroqDraft({mission: m, apiKey, model, fetchImpl, timeoutMs});
  return Object.freeze({
    ...result,
    authorization: {
      stage: "PLAN_ONLY",
      action: authorization.action,
      status: "LOCAL_HMAC_PERMIT_VERIFIED",
      note: "No independent human identity, production approval or sandbox authorization has been verified"
    }
  });
}
