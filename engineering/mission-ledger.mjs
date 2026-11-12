// Private per-mission append-only evidence. Local hash chain, NOT external attestation.
import {createHash} from 'node:crypto';
import {open,lstat,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
const digest=x=>createHash('sha256').update(x).digest('hex');
const hex=/^[a-f0-9]{64}$/;
export async function createMissionLedger({root,missionId,missionSha,requestedOutputTokens,model}={}){
 if(typeof root!=='string'||!root||! /^[A-Za-z0-9_-]{6,72}$/.test(missionId??'')||
 !hex.test(missionSha??'')||!Number.isSafeInteger(requestedOutputTokens)||requestedOutputTokens<1||requestedOutputTokens>12288||
 typeof model!=='string'||! /^[A-Za-z0-9][A-Za-z0-9/_.-]{1,119}$/.test(model)||model.startsWith('gsk_'))throw Error('LEDGER_SCOPE_INVALID');
 const dir=resolve(root),info=await lstat(dir);
 if(!info.isDirectory()||info.isSymbolicLink())throw Error('LEDGER_ROOT_UNSAFE');
 const path=join(await realpath(dir),'mission-'+missionId+'.jsonl');
 const fd=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_APPEND|constants.O_NOFOLLOW,0o600);
 let previous=null,sequence=0,closed=false;
 async function append({attempt_index=1,event,permit_scope_hash=null,observation={},outcome_code,terminated_reason=null}){
  if(closed||!['STARTED','TERMINAL'].includes(event)||!Number.isSafeInteger(attempt_index)||attempt_index<1||attempt_index>3||
    (permit_scope_hash!==null&&!hex.test(permit_scope_hash))||! /^[A-Z][A-Z0-9_]{1,80}$/.test(outcome_code??'')||
    (terminated_reason!==null&&! /^[A-Z][A-Z0-9_]{1,80}$/.test(terminated_reason)))throw Error('LEDGER_EVENT_INVALID');
  const m=observation.measured;
  const validCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
  const measured=m&&validCount(m.input_tokens)&&validCount(m.output_tokens)?{input_tokens:m.input_tokens,output_tokens:m.output_tokens}:null;
  const reason=measured?null:observation.measured_null_reason||'NO_PROVIDER_OBSERVATION';
  if(!measured&&!['NO_PROVIDER_OBSERVATION','NO_PROVIDER_USAGE','NO_COMPLETE_PROVIDER_RESPONSE','HTTP_REJECTED_BEFORE_USAGE','INVALID_PROVIDER_USAGE'].includes(reason))throw Error('LEDGER_USAGE_REASON_INVALID');
  const record={schema:'constructor_mission_ledger_v1',sequence:++sequence,previous_sha256:previous,
   mission_id:missionId,mission_sha:missionSha,attempt_index,event,permit_scope_hash,model_id:model,
   requested_output_tokens:requestedOutputTokens,measured,measured_null_reason:reason,
   conservative_output_charge:measured?measured.output_tokens:requestedOutputTokens,
   returned_model:observation.returned_model===model?model:null,
   latency_ms:validCount(observation.latency_ms)?observation.latency_ms:null,
   bytes_read:validCount(observation.bytes_read)?observation.bytes_read:null,
   response_sha256:hex.test(observation.response_sha256??'')?observation.response_sha256:null,
   outcome_code,terminated_reason,release:'DENIED'};
  const record_sha256=digest(JSON.stringify(record));
  await fd.writeFile(JSON.stringify({...record,record_sha256})+'\n');await fd.sync();previous=record_sha256;
  return record_sha256;
 }
 return {path,append,async close(){if(!closed){closed=true;await fd.close();}}};
}
