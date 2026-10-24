// Heuristic review of UNTRUSTED model-drafted source. Not a sanitizer or sandbox.
import {parseModelDraft} from "./draft-contract.mjs";

const DANGEROUS = Object.freeze([
  {code:"DYNAMIC_CODE_EXECUTION",re:/\b(?:eval\s*\(|new\s+Function\s*\()/},
  {code:"PROCESS_EXECUTION",re:/\b(?:child_process|execSync\s*\(|spawnSync\s*\(|subprocess\b|os\.system\s*\()/},
  {code:"SENSITIVE_ENV_ACCESS",re:/\b(?:process\.env|import\.meta\.env|Deno\.env)\b/},
  {code:"NETWORK_CAPABILITY",re:/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|https?\.request\s*\()/},
  {code:"FILESYSTEM_CAPABILITY",re:/\b(?:node:fs|require\s*\(\s*['"]fs['"]|writeFile\s*\(|readFile\s*\()/}
]);

// Only unmistakable token-like material is hard rejected; not a full secret scanner.
const SECRET_PATTERNS = [
  /gsk_[A-Za-z0-9_-]{20,}/,
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/
];

export function staticDraftReview(draft) {
  const checked = parseModelDraft(JSON.stringify(draft));
  const flags = [];
  const forbidden = [];
  for (const item of checked.draft.files) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(item.content)) {
        // Never echo the detected secret, not even a masked prefix.
        forbidden.push({path:item.path,code:"POTENTIAL_SECRET_MATERIAL"});
        break;
      }
    }
    for (const rule of DANGEROUS) {
      if (rule.re.test(item.content)) flags.push({path:item.path,code:rule.code});
    }
  }
  return Object.freeze({
    status:forbidden.length?"BLOCKED_SUSPECTED_SECRET":flags.length?"NEEDS_INDEPENDENT_REVIEW":"STATIC_HEURISTIC_NO_FLAGS",
    flags,forbidden,
    independent_qa:"NOT_RUN",
    code_execution:"NOT_RUN",
    release:"DENIED"
  });
}
