import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createMissionLedger} from '../engineering/mission-ledger.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
test('private durable ledger records a failure and charges missing usage conservatively',async t=>{
 const root=await mkdtemp(join(tmpdir(),'mission-ledger-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const args={root,missionId:'plan-test-001',missionSha:hash('goal'),requestedOutputTokens:4000,model:'test-model'};
 const l=await createMissionLedger(args);
 const first=await l.append({event:'STARTED',permit_scope_hash:hash('permit'),outcome_code:'REQUEST_STARTED'});
 await l.append({event:'TERMINAL',permit_scope_hash:hash('permit'),outcome_code:'PROVIDER_RATE_LIMITED',terminated_reason:'PROVIDER_RATE_LIMITED',observation:{measured:null,measured_null_reason:'HTTP_REJECTED_BEFORE_USAGE',raw:'must not appear'}});
 await l.close();
 const raw=await readFile(l.path,'utf8'),rows=raw.trim().split('\n').map(JSON.parse);
 assert.equal(rows.length,2);assert.equal(rows[1].previous_sha256,first);assert.equal(rows[1].conservative_output_charge,4000);assert.equal(rows[1].measured,null);assert.equal(rows[1].release,'DENIED');assert.equal(raw.includes('must not appear'),false);
 for(const row of rows){const {record_sha256,...body}=row;assert.equal(hash(JSON.stringify(body)),record_sha256);}
 assert.equal((await stat(l.path)).mode&0o777,0o600);
 await assert.rejects(createMissionLedger(args),/EEXIST/);
});
