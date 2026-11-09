// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Scoped local HMAC permit, NOT a distributed AI Passport or proof of human identity.
import {createHash, createHmac, randomUUID, timingSafeEqual} from "node:crypto";
import {validateMission} from "./draft-contract.mjs";

const VERSION = "constructor_local_draft_permit_v2";
const MISSION_ID = /^[A-Za-z0-9_-]{6,72}$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,119}$/;
const DIGEST = /^[a-f0-9]{64}$/;
export const ROUTE_GROQ_PLAN = "groq-plan";
export const ROUTE_LOCAL_TASK = "velion-local-task";
export const ROUTE_LOCAL_APPLICATION = "velion-local-application-v1";
export const ROUTE_REVIEWED_PROPOSAL = "velion-reviewed-proposal";
const ROUTES = new Set([ROUTE_GROQ_PLAN, ROUTE_LOCAL_TASK, ROUTE_LOCAL_APPLICATION, ROUTE_REVIEWED_PROPOSAL]);
const PERMITTED = "model:generate_draft";
const KEYS = "action,exp,iat,mission,nonce,scope_sha256,v";

export class PermitError extends Error {
  constructor(code) {super(code); this.name = "PermitError"; this.code = code;}
}

function secretBytes(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32 || Buffer.byteLength(secret) > 2048) {
    throw new PermitError("BLOCKED_PERMIT_SECRET_MISSING_OR_WEAK");
  }
  return Buffer.from(secret, "utf8");
}

function signature(text, secret) {
  return createHmac("sha256", secretBytes(secret)).update(text, "utf8").digest("base64url");
}

// Hash only fields actually used by the authorized runner. Goal text is not placed in the token.
function missionScope({mission, route, model}) {
  let m;
  try {m = validateMission(mission);} catch {throw new PermitError("INVALID_MISSION_SCOPE");}
  if (!ROUTES.has(route) || typeof model !== "string" || !MODEL.test(model) ||
      model.includes("..") || model.includes("://")) throw new PermitError("INVALID_MODEL_SCOPE");
  const scope = {mission_id:m.id, goal:m.goal, allow_model:true, route, model};
  return {missionId:m.id, digest:createHash("sha256").update(JSON.stringify(scope)).digest("hex")};
}

export function issueLocalDraftPermit({mission, route, model, secret, now = Date.now(), ttlMs = 300000, nonce = randomUUID()} = {}) {
  secretBytes(secret);
  const scope = missionScope({mission, route, model});
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 300000 ||
      !Number.isSafeInteger(now + ttlMs)) throw new PermitError("INVALID_EXPIRATION");
  if (typeof nonce !== "string" || !/^[A-Za-z0-9_-]{8,72}$/.test(nonce)) throw new PermitError("INVALID_NONCE");
  const payload = {v:VERSION, mission:scope.missionId, scope_sha256:scope.digest,
    action:PERMITTED, iat:now, exp:now + ttlMs, nonce};
  const raw = JSON.stringify(payload);
  return Buffer.from(raw, "utf8").toString("base64url") + "." + signature(raw, secret);
}

export function verifyLocalDraftPermit({token, mission, route, model, secret, now = Date.now(), consumedNonces} = {}) {
  secretBytes(secret);
  if (!(consumedNonces instanceof Set)) throw new PermitError("REPLAY_TRACKER_REQUIRED");
  const scope = missionScope({mission, route, model});
  if (typeof token !== "string" || token.length > 1800 || token.split(".").length !== 2) {
    throw new PermitError("INVALID_PERMIT_FORMAT");
  }
  const [encoded, mac] = token.split(".");
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(mac)) {
    throw new PermitError("INVALID_PERMIT_FORMAT");
  }
  let parsed, raw;
  try {raw = Buffer.from(encoded,"base64url").toString("utf8"); parsed=JSON.parse(raw);}
  catch {throw new PermitError("INVALID_PERMIT_PAYLOAD");}
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new PermitError("INVALID_PERMIT_PAYLOAD");
  const expected = signature(raw, secret);
  const a = Buffer.from(mac,"utf8"), b = Buffer.from(expected,"utf8");
  if (a.length !== b.length || !timingSafeEqual(a,b)) throw new PermitError("BAD_PERMIT_SIGNATURE");
  if (Object.keys(parsed).sort().join(",") !== KEYS ||
      parsed.v !== VERSION || parsed.mission !== scope.missionId || parsed.action !== PERMITTED ||
      !MISSION_ID.test(parsed.mission ?? "") || !DIGEST.test(parsed.scope_sha256 ?? "") ||
      parsed.scope_sha256 !== scope.digest ||
      typeof parsed.nonce !== "string" || !/^[A-Za-z0-9_-]{8,72}$/.test(parsed.nonce) ||
      !Number.isSafeInteger(parsed.iat) || !Number.isSafeInteger(parsed.exp) ||
      !Number.isSafeInteger(now) || parsed.iat > now + 5000 ||
      parsed.exp <= now || parsed.exp <= parsed.iat || parsed.exp - parsed.iat > 300000) {
    throw new PermitError("PERMIT_OUT_OF_SCOPE_OR_EXPIRED");
  }
  if (consumedNonces.has(parsed.nonce)) throw new PermitError("PERMIT_REPLAY_DETECTED");
  consumedNonces.add(parsed.nonce);
  return Object.freeze({mission_id:scope.missionId, action:PERMITTED, route, model,
    scope_sha256:scope.digest, expires_at:parsed.exp});
}
