// Fail-closed verification of ZIP byte hashes and expected product inventory.
import {readFile, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
const arg = process.argv[2];
if (!arg) throw Error('Usage: node tools/verify-acceptance.mjs OUTPUT_DIRECTORY');
const dir = resolve(arg);
const manifest = JSON.parse(await readFile(join(dir,'acceptance-manifest.json'),'utf8'));
if (!manifest || manifest.schema!=='constructor-flagship-acceptance-v1' ||
    !Array.isArray(manifest.artifacts) || manifest.artifacts.length!==3) {
  throw Error('INVALID_ACCEPTANCE_MANIFEST');
}
if (process.env.GITHUB_SHA && manifest.sourceCommit!==process.env.GITHUB_SHA) {
  throw Error('SOURCE_COMMIT_MISMATCH');
}
for (const kind of ['tasks','crm','dashboard']) {
  const artifacts = manifest.artifacts.filter(a => a.template===kind);
  if (artifacts.length!==1) throw Error('MISSING_OR_DUPLICATE_TEMPLATE');
  const artifact = artifacts[0], filename = kind+'-local-app.zip';
  if (artifact.filename!==filename || !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes<1 || artifact.bytes>6*1024*1024 ||
      typeof artifact.sha256!=='string' || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw Error('INVALID_ARTIFACT_METADATA');
  }
  const path=join(dir,filename), info=await stat(path);
  if (!info.isFile() || info.size!==artifact.bytes) throw Error('ARTIFACT_SIZE_MISMATCH');
  const actual=createHash('sha256').update(await readFile(path)).digest('hex');
  if (actual!==artifact.sha256) throw Error('ARTIFACT_HASH_MISMATCH:'+kind);
}
console.log('PASS: all three acceptance ZIP hashes and schema match; not a security certification.');
