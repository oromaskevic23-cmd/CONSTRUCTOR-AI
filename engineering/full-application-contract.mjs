// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Validation of untrusted model output only. This module never executes generated code.
import {createHash} from 'node:crypto';

export const FULL_APP_SCHEMA = 'constructor_full_application_v1';
export const FULL_APP_FILES = Object.freeze([
  'README.md', 'app.mjs', 'index.html', 'package.json', 'serve.mjs',
  'storage.mjs', 'styles.css', 'test/app.test.mjs', 'validation.mjs'
]);
export const FULL_APP_BASELINE_REQUIREMENTS = Object.freeze([
  'Accessible graphical task interface and keyboard interaction',
  'Create, edit, delete, complete and reopen tasks',
  'Persistent browser storage with input validation and safe text rendering',
  'Search and status filtering',
  'Dependency-free project manifest, local startup instructions and automated tests'
]);
const MAX_RESPONSE_BYTES = 120000;
const MAX_FILE_BYTES = 20000;
const MAX_SOURCE_BYTES = 96000;
const hash = value => createHash('sha256').update(value).digest('hex');

export class FullApplicationContractError extends Error {
  constructor(code) {super(code); this.name = 'FullApplicationContractError'; this.code = code;}
}
function requireCondition(condition, code) {if (!condition) throw new FullApplicationContractError(code);}
export function fullApplicationRequirements({missionId,goalSha256}={}) {
  requireCondition(typeof missionId==='string' && /^[A-Za-z0-9_-]{6,72}$/.test(missionId) &&
    typeof goalSha256==='string' && /^[a-f0-9]{64}$/.test(goalSha256), 'FULL_APP_REQUIREMENT_SCOPE_INVALID');
  const document=Object.freeze({schema:'constructor_full_app_requirements_v1',missionId,goalSha256,
    baseline:FULL_APP_BASELINE_REQUIREMENTS});
  return Object.freeze({document,sha256:hash(JSON.stringify(document)),interpretation:'BASELINE_ONLY_NOT_ACCEPTANCE'});
}
function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}
function boundedText(value, max) {
  return typeof value === 'string' && value.trim().length > 0 &&
    Buffer.byteLength(value, 'utf8') <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

// JSON.parse accepts repeated keys. Different consumers may select different
// values, so reject duplicates (including escaped spelling) at every depth.
// Run this only after JSON.parse has established syntactically valid JSON.
function denyDuplicateKeys(text, code) {
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      const start = i++;
      while (i < text.length) {
        if (text[i] === '\\') {i += 2; continue;}
        if (text[i] === '"') break;
        i++;
      }
      let next = i + 1;
      while (/\s/.test(text[next] ?? '') && next < text.length) next++;
      const frame = stack.at(-1);
      if (text[next] === ':' && frame?.kind === 'object') {
        const key = JSON.parse(text.slice(start, i + 1));
        requireCondition(!frame.keys.has(key), code);
        frame.keys.add(key);
      }
    } else if (char === '{') stack.push({kind:'object',keys:new Set()});
    else if (char === '[') stack.push({kind:'array'});
    else if (char === '}' || char === ']') stack.pop();
  }
}

// A manifest is data. Even these allowed scripts must run only inside a
// separately authorized sandbox; validating their names is not containment.
function validatePackageManifest(source) {
  let value;
  try {value = JSON.parse(source);} catch {throw new FullApplicationContractError('FULL_APP_PACKAGE_JSON_INVALID');}
  denyDuplicateKeys(source, 'FULL_APP_PACKAGE_DUPLICATE_KEY');
  requireCondition(exactKeys(value, ['name', 'version', 'private', 'type', 'scripts', 'engines']), 'FULL_APP_PACKAGE_FIELDS_DENIED');
  requireCondition(typeof value.name === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value.name) &&
    typeof value.version === 'string' && /^\d+\.\d+\.\d+$/.test(value.version) &&
    value.private === true && value.type === 'module', 'FULL_APP_PACKAGE_METADATA_INVALID');
  requireCondition(exactKeys(value.engines, ['node']) && value.engines.node === '>=22', 'FULL_APP_NODE_REQUIREMENT_DENIED');
  requireCondition(exactKeys(value.scripts, ['start', 'test']) && value.scripts.start === 'node serve.mjs' &&
    value.scripts.test === 'node --test test/app.test.mjs', 'FULL_APP_PACKAGE_SCRIPTS_DENIED');
}

export function parseFullApplicationDraft(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0 &&
    Buffer.byteLength(text, 'utf8') <= MAX_RESPONSE_BYTES, 'FULL_APP_RESPONSE_INVALID');
  let raw;
  try {raw = JSON.parse(text);} catch {throw new FullApplicationContractError('FULL_APP_JSON_INVALID');}
  denyDuplicateKeys(text, 'FULL_APP_DUPLICATE_KEY');
  requireCondition(exactKeys(raw, ['schema', 'summary', 'steps', 'files']) &&
    raw.schema === FULL_APP_SCHEMA, 'FULL_APP_SCHEMA_INVALID');
  requireCondition(boundedText(raw.summary, 1500), 'FULL_APP_SUMMARY_INVALID');
  requireCondition(Array.isArray(raw.steps) && raw.steps.length > 0 && raw.steps.length <= 12, 'FULL_APP_STEPS_INVALID');
  const ids = new Set();
  const steps = raw.steps.map(step => {
    requireCondition(exactKeys(step, ['id', 'action', 'acceptance']) &&
      typeof step.id === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(step.id) && !ids.has(step.id) &&
      boundedText(step.action, 900) && boundedText(step.acceptance, 900), 'FULL_APP_STEP_INVALID');
    ids.add(step.id);
    return Object.freeze({id: step.id, action: step.action.trim(), acceptance: step.acceptance.trim()});
  });
  requireCondition(Array.isArray(raw.files) && raw.files.length === FULL_APP_FILES.length, 'FULL_APP_FILE_SET_DENIED');
  const seen = new Map();
  let total = 0;
  for (const file of raw.files) {
    requireCondition(exactKeys(file, ['path', 'content']) && typeof file.path === 'string' &&
      FULL_APP_FILES.includes(file.path) && !seen.has(file.path), 'FULL_APP_FILE_SET_DENIED');
    requireCondition(typeof file.content === 'string' && file.content.trim().length > 0 &&
      !file.content.includes('\u0000') && Buffer.byteLength(file.content, 'utf8') <= MAX_FILE_BYTES,
      'FULL_APP_FILE_CONTENT_INVALID');
    total += Buffer.byteLength(file.content, 'utf8');
    requireCondition(total <= MAX_SOURCE_BYTES, 'FULL_APP_SOURCE_BUDGET_EXCEEDED');
    seen.set(file.path, file.content);
  }
  requireCondition(FULL_APP_FILES.every(path => seen.has(path)), 'FULL_APP_FILE_SET_DENIED');
  validatePackageManifest(seen.get('package.json'));
  const readme=seen.get('README.md');
  requireCondition(/\bnpm\s+start\b/i.test(readme) && /\bnpm\s+test\b/i.test(readme) &&
    /\bnode(?:\.js)?\s+(?:version\s+)?22\b/i.test(readme) && readme.includes('127.0.0.1:4174') &&
    /\bno\s+(?:build|compilation)\b/i.test(readme), 'FULL_APP_INSTRUCTIONS_INCOMPLETE');
  const files = FULL_APP_FILES.map(path => Object.freeze({path, content: seen.get(path)}));
  const draft = Object.freeze({schema: FULL_APP_SCHEMA, summary: raw.summary.trim(),
    steps: Object.freeze(steps), files: Object.freeze(files)});
  return Object.freeze({draft, sha256: hash(JSON.stringify(draft)), sourceBytes: total});
}
