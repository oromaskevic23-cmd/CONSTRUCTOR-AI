// Proof-carrying QUARANTINE, not an AI sandbox or independent release attestation.
import {createHash} from "node:crypto";
import {constants} from "node:fs";
import {lstat, mkdtemp, mkdir, open, readdir, readFile, realpath, rm} from "node:fs/promises";
import {dirname, join, resolve, relative, sep} from "node:path";
import {parseModelDraft} from "./draft-contract.mjs";
import {staticDraftReview} from "./static-review.mjs";

const MANIFEST = "proof-manifest.json";
const FORMAT = "constructor_quarantine_manifest_v1";
const SHA256 = /^[a-f0-9]{64}$/;
const MISSION = /^[A-Za-z0-9_-]{6,72}$/;
const META_KEYS = ["schema", "created_at", "mission_id", "provider", "model",
  "source_input_sha256", "source_output_sha256", "draft_sha256", "summary",
  "steps", "files", "static_review", "independent_qa", "execution",
  "release_decision", "manifest_sha256"];

export class ProofError extends Error {
  constructor(code) {super(code);this.name="ProofError";this.code=code;}
}
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function validateReceipt(result) {
  if (!result || typeof result !== "object" || Array.isArray(result) ||
      result.status !== "DRAFT_VALIDATED_NOT_EXECUTED" ||
      result.sandbox_execution !== "NOT_RUN" ||
      result.independent_qa !== "NOT_RUN" || result.release !== "DENIED" ||
      !result.authorization || result.authorization.stage !== "PLAN_ONLY" ||
      result.authorization.action !== "model:generate_draft" ||
      result.authorization.status !== "LOCAL_HMAC_PERMIT_VERIFIED" ||
      !["groq","freellmapi-proxy"].includes(result.model_provider) ||
      typeof result.model !== "string" || result.model.length > 120 ||
      !MISSION.test(result.mission_id ?? "") ||
      !SHA256.test(result.input_sha256 ?? "") ||
      !SHA256.test(result.model_output_sha256 ?? "")) {
    throw new ProofError("UNTRUSTED_OR_INCOMPLETE_PLANNING_RECEIPT");
  }
  const parsed = parseModelDraft(JSON.stringify(result.draft));
  if (parsed.sha256 !== result.validated_draft_sha256) {
    throw new ProofError("DRAFT_DIGEST_MISMATCH");
  }
  if (!parsed.draft.files.length) throw new ProofError("DRAFT_HAS_NO_FILES");
  const review = staticDraftReview(parsed.draft);
  if (review.forbidden.length) throw new ProofError("POTENTIAL_SECRET_MATERIAL");
  return {parsed,review};
}

function canonicalManifest(fields) {
  const withoutChecksum = {...fields};
  delete withoutChecksum.manifest_sha256;
  return JSON.stringify(withoutChecksum);
}

async function newFile(path, bytes) {
  const fd = await open(path, constants.O_WRONLY | constants.O_CREAT |
    constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {await fd.writeFile(bytes);await fd.sync();}
  finally {await fd.close();}
}

function assertInside(root, target) {
  const rel = relative(root,target);
  if (!rel || rel === ".." || rel.startsWith(".." + sep) || rel.startsWith(sep)) {
    throw new ProofError("ARTIFACT_OUTSIDE_QUARANTINE");
  }
}

// The result object must come from runPlanOnlyMission in the same trusted process;
// this function cannot authenticate a JSON receipt received from an attacker.
export async function quarantineDraft({result, outputRoot, now = new Date()} = {}) {
  const {parsed,review} = validateReceipt(result);
  const time = now instanceof Date ? now.toISOString() : null;
  if (!time || Number.isNaN(Date.parse(time))) throw new ProofError("INVALID_TIMESTAMP");
  if (typeof outputRoot !== "string" || !outputRoot.trim()) throw new ProofError("OUTPUT_ROOT_REQUIRED");
  const root = resolve(outputRoot);
  const st = await lstat(root);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new ProofError("OUTPUT_ROOT_UNSAFE");
  const real = await realpath(root);
  const staging = await mkdtemp(join(real, "constructor-quarantine-"));
  try {
    await (await lstat(staging)).isDirectory();
    const manifestFiles=[];
    for (const file of parsed.draft.files) {
      const destination = join(staging,file.path);
      assertInside(staging,destination);
      await mkdir(dirname(destination),{recursive:true,mode:0o700});
      const bytes=Buffer.from(file.content,"utf8");
      await newFile(destination,bytes);
      manifestFiles.push({path:file.path,bytes:bytes.length,sha256:sha256(bytes)});
    }
    const metadata={
      schema:FORMAT,
      created_at:time,
      mission_id:result.mission_id,
      provider:result.model_provider,
      model:result.model,
      source_input_sha256:result.input_sha256,
      source_output_sha256:result.model_output_sha256,
      draft_sha256:parsed.sha256,
      summary:parsed.draft.summary,
      steps:parsed.draft.steps,
      files:manifestFiles,
      static_review:{status:review.status,flags:review.flags},
      independent_qa:"NOT_RUN",
      execution:"NOT_RUN",
      release_decision:"DENIED"
    };
    const manifest={...metadata,manifest_sha256:sha256(canonicalManifest(metadata))};
    await newFile(join(staging,MANIFEST),Buffer.from(JSON.stringify(manifest,null,2)+"\n","utf8"));
    const verified=await verifyProofBundle(staging);
    return Object.freeze({status:"QUARANTINED_NOT_EXECUTED",bundle_path:staging,
      manifest_sha256:manifest.manifest_sha256,files:verified.files,
      static_review:review.status,release:"DENIED"});
  } catch(error) {
    await rm(staging,{recursive:true,force:true});
    throw error;
  }
}

async function listFiles(root, directory, relativeNames=[]) {
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const current=join(directory,entry.name);
    assertInside(root,current);
    if(entry.isSymbolicLink())throw new ProofError("SYMLINK_IN_BUNDLE");
    if(entry.isDirectory()) await listFiles(root,current,relativeNames);
    else if(entry.isFile()) relativeNames.push(relative(root,current).split(sep).join("/"));
    else throw new ProofError("UNEXPECTED_FILESYSTEM_OBJECT");
  }
  return relativeNames;
}

// Check byte-for-byte completeness and SHA-256 equality. Unsigned hashes do not prove origin.
export async function verifyProofBundle(bundlePath) {
  if(typeof bundlePath !== "string" || !bundlePath.trim()) throw new ProofError("BUNDLE_PATH_REQUIRED");
  const root=resolve(bundlePath);
  const stat=await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ProofError("UNSAFE_BUNDLE_ROOT");
  const manifestFile=join(root,MANIFEST);
  const manifestStat=await lstat(manifestFile);
  if(!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size>65536)
    throw new ProofError("INVALID_MANIFEST_FILE");
  let manifest;
  try{manifest=JSON.parse(await readFile(manifestFile,"utf8"));}
  catch{throw new ProofError("MALFORMED_MANIFEST");}
  if(!manifest || typeof manifest!=="object" || Array.isArray(manifest) ||
      Object.keys(manifest).length!==META_KEYS.length ||
      META_KEYS.some(key=>!Object.hasOwn(manifest,key)) ||
      manifest.schema!==FORMAT || !SHA256.test(manifest.manifest_sha256??"") ||
      sha256(canonicalManifest(manifest))!==manifest.manifest_sha256 ||
      manifest.release_decision!=="DENIED" || manifest.execution!=="NOT_RUN" ||
      manifest.independent_qa!=="NOT_RUN" ||
      !SHA256.test(manifest.draft_sha256??"")) {
    throw new ProofError("INVALID_OR_TAMPERED_MANIFEST");
  }
  if(!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length>8)
    throw new ProofError("INVALID_FILE_INVENTORY");
  const actualFiles = await listFiles(root,root);
  const claimedFiles = [...manifest.files.map(f=>f.path),MANIFEST];
  if(actualFiles.length!==claimedFiles.length ||
      actualFiles.some(f=>!claimedFiles.includes(f)))
    throw new ProofError("UNEXPECTED_OR_MISSING_ARTIFACT");
  const draftFiles=[];
  for (const item of manifest.files) {
    if (typeof item.path!=="string" || !Number.isSafeInteger(item.bytes) ||
        item.bytes<0 || item.bytes>32768 || !SHA256.test(item.sha256??"")) {
      throw new ProofError("INVALID_FILE_INVENTORY");
    }
    const filePath=join(root,item.path);
    assertInside(root,filePath);
    const stat=await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size!==item.bytes)
      throw new ProofError("ARTIFACT_TYPE_OR_SIZE_MISMATCH");
    const bytes=await readFile(filePath);
    if (sha256(bytes)!==item.sha256) throw new ProofError("ARTIFACT_DIGEST_MISMATCH");
    draftFiles.push({path:item.path,content:bytes.toString("utf8")});
  }
  const source=parseModelDraft(JSON.stringify({schema:"constructor_draft_v1",
    summary:manifest.summary,steps:manifest.steps,files:draftFiles}));
  if(source.sha256!==manifest.draft_sha256) throw new ProofError("DRAFT_DIGEST_MISMATCH");
  const review=staticDraftReview(source.draft);
  if(review.forbidden.length)throw new ProofError("BUNDLE_CONTAINS_POTENTIAL_SECRET");
  if(JSON.stringify(review.flags)!==JSON.stringify(manifest.static_review?.flags) ||
     review.status!==manifest.static_review?.status)
     throw new ProofError("INCONSISTENT_STATIC_REVIEW");
  return Object.freeze({status:"INTEGRITY_CHECKED_NOT_ATTESTED",
    files:manifest.files.length,manifest_sha256:manifest.manifest_sha256,
    release:"DENIED",execution:"NOT_RUN",independent_qa:"NOT_RUN"});
}
