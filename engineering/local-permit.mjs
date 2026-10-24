// Minimal, scoped HMAC permit for local plan-only stage. NOT a distributed AI Passport.
import {createHmac, randomUUID, timingSafeEqual} from "node:crypto";

const VERSION = "constructor_local_draft_permit_v1";
const MISSION_ID = /^[A-Za-z0-9_-]{6,72}$/;
const PERMITTED = "model:generate_draft";

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

export function issueLocalDraftPermit({missionId, secret, now = Date.now(), ttlMs = 300000, nonce = randomUUID()}) {
  secretBytes(secret);
  if (!MISSION_ID.test(missionId ?? "")) throw new PermitError("INVALID_MISSION_ID");
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 300000) {
    throw new PermitError("INVALID_EXPIRATION");
  }
  if (!/^[A-Za-z0-9_-]{8,72}$/.test(nonce)) throw new PermitError("INVALID_NONCE");
  const payload = {
    v: VERSION, mission: missionId, action: PERMITTED,
    iat: now, exp: now + ttlMs, nonce
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url") + "." +
    signature(JSON.stringify(payload), secret);
}

export function verifyLocalDraftPermit({token, missionId, secret, now = Date.now(), consumedNonces}) {
  secretBytes(secret);
  if (!consumedNonces || !(consumedNonces instanceof Set)) throw new PermitError("REPLAY_TRACKER_REQUIRED");
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
  if (parsed.v !== VERSION || parsed.mission !== missionId || parsed.action !== PERMITTED ||
      !MISSION_ID.test(parsed.mission ?? "") || typeof parsed.nonce !== "string" ||
      !Number.isSafeInteger(parsed.iat) || !Number.isSafeInteger(parsed.exp) ||
      !Number.isSafeInteger(now) || parsed.iat > now + 5000 ||
      parsed.exp <= now || parsed.exp <= parsed.iat || parsed.exp - parsed.iat > 300000) {
    throw new PermitError("PERMIT_OUT_OF_SCOPE_OR_EXPIRED");
  }
  if (consumedNonces.has(parsed.nonce)) throw new PermitError("PERMIT_REPLAY_DETECTED");
  consumedNonces.add(parsed.nonce);
  return Object.freeze({mission_id: missionId, action: PERMITTED, expires_at: parsed.exp});
}
