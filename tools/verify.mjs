// Project author and founding architect: Alexander Nikolaevich Romaskevich (RomaskevicH).
// Non-authoritative local source inventory; independent QA and production gates remain separate.
import {readFile, stat} from "node:fs/promises";
import {createHash} from "node:crypto";
const required=[
  "engineering/velion-task-generator.mjs","engineering/task-build-quarantine.mjs",
  "engineering/task-approval-gateway.mjs","engineering/task-qa-attestation.mjs","engineering/task-review-export.mjs",
  "tools/prepare-synthetic-task-build.mjs","tools/local-velion-task-build.mjs",
  "tools/verify-task-sandbox-qa.mjs","tools/run-isolated-task-qa.sh","tools/export-approved-task-review.mjs","qa/independent-task-suite.mjs",
  "test/velion-task-build.test.mjs","test/task-review-export.test.mjs","docs/VELION_PROMPT_SANDBOX_MILESTONE.md",
  ".github/workflows/prompt-sandbox-qa.yml",
  "package-lock.json","studio.html","studio.css","src/project-domain.mjs","src/project-runtime.mjs","src/project-backup.mjs","src/project-export.mjs","src/project.css","src/zip.mjs","src/studio.mjs","test/project-domain.test.mjs","test/project-export.test.mjs","test/project-backup.test.mjs",
  "package.json","index.html","styles.css","src/tasks.js","src/app.js",
  "test/tasks.test.js","test/server.test.js","tools/serve.mjs",
  "SECURITY.md","docs/VERIFIED_ENGINEERING_STANDARD.md",
  "engineering/draft-contract.mjs","engineering/groq-gateway.mjs",
  "engineering/local-permit.mjs","engineering/plan-only.mjs",
  "tools/generate-plan.mjs","tools/build-acceptance.mjs","tools/verify-acceptance.mjs","tools/verify-public-studio.mjs","docs/FLAGSHIP_ACCEPTANCE.md","test/plan-contract.test.js","test/groq-gateway.test.js",
  "test/local-permit.test.js","test/cli.test.js",
  "docs/AI_MODEL_GATEWAY.md",
  "engineering/static-review.mjs","engineering/proof-bundle.mjs",
  "tools/verify-proof.mjs","test/proof-bundle.test.js",
  "test/offline-integration.test.js","docs/PROOF_QUARANTINE.md",
  "engineering/context-shield.mjs","test/context-shield.test.mjs",
  "docs/CONTEXT_SHIELD_SPRINT_20261031.md",
  "docs/MISSION_SCOPED_LOCAL_PERMITS_20261105.md","docs/ENTERPRISE_PRODUCT_BLUEPRINT_20261105.md","docs/QA_ATTESTATION_TRUST_20261105.md",
  "governance/THIRD_PARTY_RIGHTS.json","governance/LICENSE_INVENTORY.md",
  "docs/BIONEMO_IP_POLICY.md","tools/ip-rights-gate.mjs",
  "test/ip-rights-gate.test.mjs",".github/workflows/ip-rights.yml",
  ".github/workflows/ci.yml"
];
const records=[];
for (const path of required) {
  const statInfo=await stat(new URL("../"+path,import.meta.url));
  if(!statInfo.isFile())throw new Error("Not a file: "+path);
  const bytes=await readFile(new URL("../"+path,import.meta.url));
  records.push({path,sha256:createHash("sha256").update(bytes).digest("hex"),size:bytes.length});
}
const app=await readFile(new URL("../src/app.js",import.meta.url),"utf8");
if(/\.innerHTML\s*=|\beval\s*\(|new\s+Function\s*\(/.test(app))throw new Error("Unsafe dynamic DOM/code execution");
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
if(!html.includes("Content-Security-Policy")||!html.includes('type="module"'))throw new Error("Expected security headers/assets missing");
process.stdout.write(JSON.stringify({kind:"constructor-ai-reference-source-inventory",status:"SOURCE_ONLY_NOT_PRODUCTION",count:records.length,files:records},null,2)+"\n");
