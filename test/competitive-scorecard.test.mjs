import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {suiteHashFromBytes,evaluateRun,compareRunReports} from '../engineering/competitive-scorecard.mjs';
const data=await readFile(new URL('../benchmarks/locked-tasks-v1.json',import.meta.url));
const suite=suiteHashFromBytes(data);
const sha='a'.repeat(64);
function trial(product='CONSTRUCTOR_AI',status='NOT_RUN') {
 return {schema:'imperial.constructor.benchmark.run.v1',trialId:'TRIAL-ORIGINAL-2026-'+product,
   suiteSha256:suite.hash,
   candidate:{product,version:'0.0.1',sourceRevision:'b'.repeat(40),model:'synthetic-model-1',executionEnvironment:'offline-fixture'},
   protocol:{hardware:'CI synthetic fixture',networkMode:'OFFLINE',timeLimitMs:60000,maxCostMicrousd:0,
     humanInterventionLimit:0,promptSetSha256:suite.hash,testSuiteSha256:sha,
     testSuiteIndependent:true,dataClass:'SYNTHETIC_PUBLIC_ONLY',toolPolicySha256:sha},
   results:suite.catalog.tasks.map(t=>({taskId:t.id,status,
     elapsedMs:status==='NOT_RUN'?0:1000,costMicrousd:0,humanInterventions:0,
     unauthorizedEffects:0,artifactSha256:status==='NOT_RUN'?null:sha,
     qaLogSha256:status==='NOT_RUN'?null:sha,testSuiteSha256:sha}))};
}
test('20 original synthetic benchmark tasks are category-balanced and hash pinned',()=>{
 assert.equal(suite.inventory.taskCount,20);
 assert.deepEqual(suite.inventory.categories,{application:5,maintenance:5,security:3,recovery:3,integration:2,accessibility:2});
 assert.match(suite.hash,/^[a-f0-9]{64}$/);
 assert.equal(suite.catalog.tasks.some(x=>/shpaizman/i.test(x.prompt)),false);
});
test('cannot claim PASS or a winner when no product ran',()=>{
 const result=evaluateRun(trial(),suite);
 assert.equal(result.schema,'imperial.constructor.benchmark.scorecard.v2');
 assert.equal(result.completed,0);
 assert.equal(result.reportedPassRate,null);
 assert.equal(result.completionRate,0);
 assert.equal(result.superiorityClaimAuthorized,false);
 assert.equal(result.independentlyVerified,false);
});
test('even 20 claimed PASS results do not equal verified superiority',()=>{
 const result=evaluateRun(trial('CONSTRUCTOR_AI','PASS'),suite);
 assert.equal(result.reportedPassRate,1);
 assert.equal(result.qualification,'STRUCTURALLY_VALID_SELF_REPORTED_NOT_INDEPENDENTLY_ATTESTED');
 assert.equal(result.independentlyVerified,false);
 assert.equal(result.superiorityClaimAuthorized,false);
});
test('refuses missing, repeated, and foreign task identities',()=>{
 const a=trial();a.results.pop();
 assert.throws(()=>evaluateRun(a,suite),/RESULT_COUNT_INVALID/);
 const b=trial();b.results[1].taskId=b.results[0].taskId;
 assert.throws(()=>evaluateRun(b,suite),/RESULT_TASK_OR_STATUS/);
 const c=trial();c.results[1].taskId='FOREIGN-TASK-0000';
 assert.throws(()=>evaluateRun(c,suite),/RESULT_TASK_OR_STATUS/);
});
test('refuses evidence-free PASS, cost exceedance and human intervention',()=>{
 const a=trial('CONSTRUCTOR_AI','PASS');a.results[0].artifactSha256=null;
 assert.throws(()=>evaluateRun(a,suite),/RESULT_EVIDENCE_HASH_REQUIRED/);
 const b=trial();b.results[0].costMicrousd=1;
 assert.throws(()=>evaluateRun(b,suite),/RESULT_LIMIT/);
 const c=trial();c.results[0].humanInterventions=1;
 assert.throws(()=>evaluateRun(c,suite),/RESULT_LIMIT/);
});
test('denies claims of success alongside unauthorized effects',()=>{
 const a=trial('CONSTRUCTOR_AI','PASS');a.results[2].unauthorizedEffects=1;
 assert.throws(()=>evaluateRun(a,suite),/SECURITY_SIDE_EFFECTS_CANNOT_PASS/);
});
test('rejects tampered suites and no-independent-tests protocols',()=>{
 const a=trial();a.suiteSha256='f'.repeat(64);
 assert.throws(()=>evaluateRun(a,suite),/RUN_SCOPE/);
 const b=trial();b.protocol.testSuiteIndependent=false;
 assert.throws(()=>evaluateRun(b,suite),/PROTOCOL_INVALID/);
 const c=JSON.parse(data.toString());c.tasks[0].acceptance=[];
 assert.throws(()=>suiteHashFromBytes(Buffer.from(JSON.stringify(c))),/TASK_ACCEPTANCE/);
});
test('compares protocol-matched reports but never produces winner claim',()=>{
 const a=trial('CONSTRUCTOR_AI','PASS');
 const b=trial('CURSOR','FAIL');
 const r=compareRunReports(a,b,suite);
 assert.equal(r.schema,'imperial.constructor.benchmark.comparison.v2');
 assert.equal(r.comparableProtocol,true);
 assert.equal(r.comparisonQualification,'DECLARED_PROTOCOL_ONLY_NOT_INDEPENDENTLY_VERIFIED');
 assert.equal(r.claim,'NO_VERIFIED_WINNER');
 assert.equal(r.superiorityClaimAuthorized,false);
 const mismatch=trial('HERMES_AGENT','FAIL');mismatch.protocol.hardware='different host';
 assert.throws(()=>compareRunReports(a,mismatch,suite),/INCOMPARABLE_TEST_PROTOCOLS/);
});
test('never admits paid or credential-access effects',()=>{
 const a=trial();a.candidate.product='SHPAIZMAN';
 assert.throws(()=>evaluateRun(a,suite),/CANDIDATE_INVALID/);
 const b=trial();b.results[0].status='PASS';b.results[0].artifactSha256=sha;b.results[0].qaLogSha256=sha;
 b.results[0].unauthorizedEffects=1;
 assert.throws(()=>evaluateRun(b,suite),/SECURITY_SIDE_EFFECTS_CANNOT_PASS/);
});
test('aggregate spend cannot evade total-budget gate across many tasks',()=>{
 const a=trial('CONSTRUCTOR_AI','PASS');
 a.protocol.maxCostMicrousd=10;
 for(const item of a.results) item.costMicrousd=1;
 assert.throws(()=>evaluateRun(a,suite),/TOTAL_COST_BUDGET_EXCEEDED/);
});

test('partial execution reports pass rate among completed tasks separately from coverage',()=>{
 const a=trial();
 a.results[0]=trial('CONSTRUCTOR_AI','PASS').results[0];
 a.results[1]=trial('CONSTRUCTOR_AI','FAIL').results[1];
 const result=evaluateRun(a,suite);
 assert.equal(result.completed,2);
 assert.equal(result.reportedPassRate,0.5);
 assert.equal(result.completionRate,0.1);
 assert.equal(result.candidateVersion,'0.0.1');
 assert.equal(result.sourceRevision,'b'.repeat(40));
 assert.equal(result.model,'synthetic-model-1');
 assert.equal(result.protocol.maxCostMicrousd,0);
 assert.equal(result.reportedResults[0].qaLogSha256,sha);
 assert.equal(result.reportedResults[1].status,'FAIL');
 assert.equal(result.reportedResults[2].status,'NOT_RUN');
 assert.equal(Object.isFrozen(result.reportedResults[0]),true);
 assert.equal(result.superiorityClaimAuthorized,false);
});

test('incomplete runs cannot be compared as completed benchmark trials',()=>{
 const a=trial('CONSTRUCTOR_AI','PASS');
 const b=trial('CURSOR','FAIL');
 b.results[0]=trial('CURSOR').results[0];
 assert.throws(()=>compareRunReports(a,b,suite),/INCOMPLETE_TRIALS_NOT_COMPARABLE/);
 assert.throws(()=>compareRunReports(trial(),trial('CURSOR'),suite),/INCOMPLETE_TRIALS_NOT_COMPARABLE/);
});

test('comparison rejects different execution environments despite matching resource protocols',()=>{
 const a=trial('CONSTRUCTOR_AI','PASS'),b=trial('CURSOR','FAIL');
 b.candidate.executionEnvironment='different operating environment';
 assert.throws(()=>compareRunReports(a,b,suite),/INCOMPARABLE_EXECUTION_ENVIRONMENTS/);
});

test('comparison matches equivalent protocol values independently of JSON key order',()=>{
 const a=trial('CONSTRUCTOR_AI','PASS'),b=trial('CURSOR','FAIL');
 b.protocol=Object.fromEntries(Object.entries(b.protocol).reverse());
 const result=compareRunReports(a,b,suite);
 assert.equal(result.comparableProtocol,true);
 assert.equal(result.claim,'NO_VERIFIED_WINNER');
});

test('floating versions, unidentified models and unpinned Constructor builds are rejected',()=>{
 const a=trial();a.candidate.version='latest';
 assert.throws(()=>evaluateRun(a,suite),/CANDIDATE_INVALID/);
 const b=trial();b.candidate.version='stable';
 assert.throws(()=>evaluateRun(b,suite),/CANDIDATE_INVALID/);
 const c=trial();c.candidate.sourceRevision=null;
 assert.throws(()=>evaluateRun(c,suite),/CANDIDATE_INVALID/);
 const d=trial();d.candidate.model='unknown';
 assert.throws(()=>evaluateRun(d,suite),/CANDIDATE_INVALID/);
 const floating=trial();floating.candidate.model='example-model:latest';
 assert.throws(()=>evaluateRun(floating,suite),/CANDIDATE_INVALID/);
 const whitespace=trial();whitespace.candidate.model=' unknown ';
 assert.throws(()=>evaluateRun(whitespace,suite),/CANDIDATE_INVALID/);
 const environment=trial();environment.candidate.executionEnvironment='unknown';
 assert.throws(()=>evaluateRun(environment,suite),/CANDIDATE_INVALID/);
 const hardware=trial();hardware.protocol.hardware=' ';
 assert.throws(()=>evaluateRun(hardware,suite),/PROTOCOL_INVALID/);
 const e=trial('CURSOR');e.candidate.sourceRevision=null;e.candidate.version='2.1.0';
 assert.doesNotThrow(()=>evaluateRun(e,suite));
 e.candidate.version='v2.1.0-rc.1+build.8';
 assert.doesNotThrow(()=>evaluateRun(e,suite));
 e.candidate.version='c'.repeat(40);
 assert.doesNotThrow(()=>evaluateRun(e,suite));
});

test('offline CLI preserves synthetic run metadata and rejects incomplete comparisons',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'constructor-scorecard-fixture-'));
 const cli=fileURLToPath(new URL('../tools/score-competitors.mjs',import.meta.url));
 const catalog=fileURLToPath(new URL('../benchmarks/locked-tasks-v1.json',import.meta.url));
 const a=join(dir,'a.json'),b=join(dir,'b.json');
 try{
  await writeFile(a,JSON.stringify(trial('CONSTRUCTOR_AI','PASS')));
  await writeFile(b,JSON.stringify(trial('CURSOR')));
  const incomplete=spawnSync(process.execPath,[cli,catalog,a,b],{encoding:'utf8',timeout:5000});
  assert.equal(incomplete.status,1);
  assert.match(incomplete.stderr,/INCOMPLETE_TRIALS_NOT_COMPARABLE/);
  await writeFile(b,JSON.stringify(trial('CURSOR','FAIL')));
  const complete=spawnSync(process.execPath,[cli,catalog,a,b],{encoding:'utf8',timeout:5000});
  assert.equal(complete.status,0,complete.stderr);
  const report=JSON.parse(complete.stdout);
  assert.equal(report.schema,'imperial.constructor.benchmark.comparison.v2');
  assert.equal(report.observedCounts.CONSTRUCTOR_AI.candidateVersion,'0.0.1');
  assert.equal(report.observedCounts.CURSOR.reportedResults[0].status,'FAIL');
  assert.equal(report.claim,'NO_VERIFIED_WINNER');
  assert.equal(report.independentExecutionAttested,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
