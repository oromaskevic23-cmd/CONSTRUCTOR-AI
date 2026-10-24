// CONSTRUCTOR AI | validated AI-generation draft contract. NO execution or filesystem writes.
import {createHash} from "node:crypto";

const ALLOWED_EXTENSIONS = new Set(["js", "mjs", "ts", "tsx", "css", "html", "json", "md"]);
const FORBIDDEN_NAMES = new Set([".env", ".npmrc", ".git", "node_modules", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "credentials", "secrets", "id_rsa"]);
const FILE_PATH = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9_.-]*){0,5}$/;
const ID = /^[a-z][a-z0-9-]{0,39}$/;

export class DraftContractError extends Error {
  constructor(message) { super(message); this.name = "DraftContractError"; }
}

function str(value, field, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new DraftContractError(field + " must be printable text (max " + max + ")");
  }
  return value.trim();
}

export function validateMission(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DraftContractError("Mission object is required");
  }
  const id = str(input.id, "mission.id", 72);
  if (!/^[A-Za-z0-9_-]{6,72}$/.test(id)) throw new DraftContractError("Invalid mission ID");
  const goal = str(input.goal, "mission.goal", 2000);
  if (typeof input.allowModel !== "boolean" || input.allowModel !== true) {
    throw new DraftContractError("Owner must authorize model inference for this mission");
  }
  return Object.freeze({id, goal, allowModel: true});
}

function path(value) {
  if (typeof value !== "string" || value.length > 180 || !FILE_PATH.test(value)) {
    throw new DraftContractError("Unsafe artifact path");
  }
  const segments = value.split("/");
  if (segments.some(s => s === "." || s === ".." || s.startsWith(".") || FORBIDDEN_NAMES.has(s.toLowerCase()))) {
    throw new DraftContractError("Forbidden artifact path");
  }
  const ext = segments.at(-1).split(".").at(-1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new DraftContractError("Disallowed artifact type");
  return value;
}

export function parseModelDraft(text) {
  if (typeof text !== "string" || text.length > 64000 || !text.trim()) {
    throw new DraftContractError("Missing or excessive model response");
  }
  let raw;
  try { raw = JSON.parse(text); }
  catch { throw new DraftContractError("Model must return strict JSON, without fences"); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.schema !== "constructor_draft_v1") {
    throw new DraftContractError("Unexpected model schema");
  }
  if (Object.keys(raw).some(k => !["schema", "summary", "steps", "files"].includes(k))) {
    throw new DraftContractError("Unexpected top-level model fields");
  }
  const summary = str(raw.summary, "summary", 1500);
  if (!Array.isArray(raw.steps) || !raw.steps.length || raw.steps.length > 12) {
    throw new DraftContractError("Plan must contain 1–12 steps");
  }
  const stepIDs = new Set();
  const steps = raw.steps.map((s, i) => {
    if (!s || typeof s !== "object" || Array.isArray(s) ||
        Object.keys(s).some(k => !["id", "action", "acceptance"].includes(k))) {
      throw new DraftContractError("Invalid plan step at " + i);
    }
    const id = str(s.id, "step.id", 40);
    if (!ID.test(id) || stepIDs.has(id)) throw new DraftContractError("Invalid/duplicate step ID");
    stepIDs.add(id);
    return {id, action: str(s.action, "step.action", 900), acceptance: str(s.acceptance, "step.acceptance", 900)};
  });
  if (!Array.isArray(raw.files) || raw.files.length > 8) throw new DraftContractError("At most 8 draft files required");
  const paths = new Set();
  let total = 0;
  const files = raw.files.map((f, i) => {
    if (!f || typeof f !== "object" || Array.isArray(f) ||
        Object.keys(f).some(k => !["path", "content"].includes(k))) {
      throw new DraftContractError("Invalid draft file at " + i);
    }
    const name = path(f.path);
    if (paths.has(name.toLowerCase())) throw new DraftContractError("Duplicate artifact path");
    paths.add(name.toLowerCase());
    if (typeof f.content !== "string" || f.content.length > 20000 || /\u0000/.test(f.content)) {
      throw new DraftContractError("Excessive/invalid artifact content");
    }
    total += Buffer.byteLength(f.content, "utf8");
    if (total > 32768) throw new DraftContractError("Draft file budget exceeded");
    return {path: name, content: f.content};
  });
  const draft = {schema: "constructor_draft_v1", summary, steps, files};
  const hash = createHash("sha256").update(JSON.stringify(draft)).digest("hex");
  return Object.freeze({draft, sha256: hash});
}
