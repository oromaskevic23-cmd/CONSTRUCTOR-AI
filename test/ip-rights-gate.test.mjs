import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditThirdPartyRights,validateRightsManifest,inspectTrackedPaths} from '../tools/ip-rights-gate.mjs';

const data=JSON.parse(await readFile(new URL('../governance/THIRD_PARTY_RIGHTS.json',import.meta.url),'utf8'));
const mutate=change=>{const m=structuredClone(data);change(m);return m;};
const denied=fn=>assert.throws(fn,/IP_RIGHTS_GATE:/);

test('complete five-part NVIDIA provenance inventory stays non-authoritative and fail-closed',()=>{
 const out=validateRightsManifest(data);
 assert.equal(out.checkedEntries,5);
 assert.equal(out.integrationApproved,false);
 assert.equal(out.commercialReleaseApproved,false);
 assert.equal(out.legalReviewComplete,false);
});
test('deny unsupported runtime or brand permission claim',()=>{
 for(const id of ['nvidia-nim-runtime','nvidia-model-weights','nvidia-trademarks']){
  const m=mutate(d=>{d.entries.find(x=>x.id===id).status='REFERENCE_ONLY';});
  denied(()=>validateRightsManifest(m));
 }
});
test('deny any assumed commercial, model training, redistribution or branding grant',()=>{
 for(const flag of ['copied_into_repository','redistribution_authorized','commercial_use_approved','training_velion_approved','brand_assets_approved']){
  const m=mutate(d=>{d.entries[0][flag]=true;});
  denied(()=>validateRightsManifest(m));
 }
});
test('deny incorrect source-code and skill-documentation licenses',()=>{
 denied(()=>validateRightsManifest(mutate(d=>{d.entries[0].license='MIT';})));
 denied(()=>validateRightsManifest(mutate(d=>{d.entries[1].license='Public domain';})));
});
test('deny duplicate, missing, unknown or reclassified entries',()=>{
 denied(()=>validateRightsManifest(mutate(d=>d.entries.pop())));
 denied(()=>validateRightsManifest(mutate(d=>{d.entries[1].id=d.entries[0].id;})));
 denied(()=>validateRightsManifest(mutate(d=>{d.entries[3].category='TRADEMARK';})));
});
test('upstream evidence and attribution checklist are mandatory',()=>{
 denied(()=>validateRightsManifest(mutate(d=>{d.entries[0].license_url='';})));
 denied(()=>validateRightsManifest(mutate(d=>{d.entries[1].required_before_integration=[];})));
 denied(()=>validateRightsManifest(mutate(d=>{d.entries[2].upstream_notice_url='http://insecure';})));
});
test('blocked binary model weights, vendor copies and NVIDIA trademarks',()=>{
 for(const path of [
  'vendor/nvidia/LICENSE','third_party/bionemo/agent.py','nim-skills/evo2/SKILL.md',
  'model_weights/evo2.bin','assets/nvidia-partner-logo.svg','weights/velion.gguf',
  'nvidia-logos/mark.png','bionemo-agent-toolkit/NOTICE',
 ]){
  denied(()=>inspectTrackedPaths(['README.md',path]));
 }
});
test('descriptive compatibility documentation and own CONSTRUCTOR banner stay allowed',()=>{
 const r=inspectTrackedPaths(['README.md','docs/BIONEMO_IP_POLICY.md',
  'assets/constructor-ai-enterprise-banner.jpg','tools/ip-rights-gate.mjs']);
 assert.equal(r.prohibitedMediaFound,0);
});
test('end-to-end check on actual repository reports DENIED commercial release',async()=>{
 const result=await auditThirdPartyRights();
 assert.equal(result.checkedEntries,5);
 assert.equal(result.customerCommercialRelease,'DENIED');
 assert.equal(result.noCopyrightInfringementCertified,false);
 assert.equal(result.nvidiaTrademarkPermissionVerified,false);
 assert.equal(result.velionModelTrainingFromNvidiaOutputsApproved,false);
 assert.ok(result.trackedFiles>20);
});
