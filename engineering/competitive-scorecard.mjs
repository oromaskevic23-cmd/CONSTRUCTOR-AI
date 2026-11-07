/**
 * CONSTRUCTOR AI — versioned offline competitor-evaluation evidence gate.
 * Copyright (c) 2026 Alexander Nikolaevich Romaskevich (RomaskevicH).
 * No external requests, payments, LLM inference, credentials or agent actions.
 * Self-reported benchmark results can NEVER become verified superiority claims.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const sha = data => createHash('sha256').update(data).digest('hex');
const check = (ok, code) => { if (!ok) throw Error(code); };
const HASH = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const ID = /^[A-Z0-9][A-Z0-9_-]{4,90}$/;
const PRODUCTS = new Set(['CONSTRUCTOR_AI','CURSOR','HERMES_AGENT']);
const CATEGORIES = ['application','maintenance','security','recovery','integration','accessibility'];
const TASK_SCHEMA = 'imperial.constructor.benchmark.catalog.v1';
const RUN_SCHEMA = 'imperial.constructor.benchmark.run.v1';
const MODES = new Set(['OFFLINE','RESTRICTED_NETWORK']);
const OUTCOMES = new Set(['PASS','FAIL','NOT_RUN']);
const noExtra = (obj, names, code) => check(obj && typeof obj==='object' && !Array.isArray(obj) &&
  Object.keys(obj).sort().join('|') === [...names].sort().join('|'), code);
const bounded = (s, max=120) => typeof s==='string' && s.length>0 && s.length<=max &&
  !/[\x00-\x1f\x7f]/.test(s);

export function validateCatalog(catalog) {
  noExtra(catalog, ['schema','name','scope','version','author','taskCount','tasks'], 'CATALOG_SCHEMA');
  check(catalog.schema===TASK_SCHEMA && catalog.scope==='ORIGINAL_SYNTHETIC_NO_CUSTOMER_DATA' &&
    catalog.taskCount===20 && Array.isArray(catalog.tasks) && catalog.tasks.length===20,
    'CATALOG_SCOPE');
  const seen=new Set();
  const categoryCounts=new Map(CATEGORIES.map(x=>[x,0]));
  for (const task of catalog.tasks) {
    noExtra(task,['id','category','prompt','acceptance','ownerTests','dataClassification'], 'TASK_SCHEMA');
    check(ID.test(task.id) && !seen.has(task.id), 'TASK_ID');
    seen.add(task.id);
    check(CATEGORIES.includes(task.category) && bounded(task.prompt,1200) &&
      task.dataClassification==='SYNTHETIC_PUBLIC_ONLY' &&
      task.ownerTests==='TO_BE_AUTHORED_AND_HASH_LOCKED_BEFORE_TRIAL', 'TASK_SCOPE');
    check(Array.isArray(task.acceptance) && task.acceptance.length>=2 &&
      task.acceptance.length<=5 && task.acceptance.every(a=>bounded(a,300)), 'TASK_ACCEPTANCE');
    categoryCounts.set(task.category,categoryCounts.get(task.category)+1);
  }
  const expected=[5,5,3,3,2,2];
  check(CATEGORIES.every((c,i)=>categoryCounts.get(c)===expected[i]),'CATALOG_CATEGORY_BALANCE');
  return Object.freeze({taskCount:20,taskIds:[...seen],categories:Object.fromEntries(categoryCounts)});
}

export function suiteHashFromBytes(raw) {
  check(Buffer.isBuffer(raw) && raw.length>0 && raw.length<50000,'CATALOG_BYTES');
  let catalog;
  try {catalog=JSON.parse(raw.toString('utf8'));}catch{throw Error('CATALOG_JSON_INVALID');}
  const inventory=validateCatalog(catalog);
  return {hash:sha(raw),catalog,inventory};
}

export function evaluateRun(run, suite) {
  const {hash,inventory}=suite;
  check(typeof hash==='string' && HASH.test(hash) && inventory?.taskCount===20,
    'SUITE_NOT_VERIFIED');
  noExtra(run, ['schema','trialId','suiteSha256','candidate','protocol','results'], 'RUN_SCHEMA');
  check(run.schema===RUN_SCHEMA && ID.test(run.trialId) && run.suiteSha256===hash,
    'RUN_SCOPE');
  noExtra(run.candidate,['product','version','sourceRevision','model','executionEnvironment'], 'CANDIDATE_SCHEMA');
  check(PRODUCTS.has(run.candidate.product) && bounded(run.candidate.version) &&
    bounded(run.candidate.model) && bounded(run.candidate.executionEnvironment) &&
    (run.candidate.sourceRevision===null || COMMIT.test(run.candidate.sourceRevision)),
    'CANDIDATE_INVALID');
  noExtra(run.protocol, ['hardware','networkMode','timeLimitMs','maxCostMicrousd','humanInterventionLimit','promptSetSha256','testSuiteSha256','testSuiteIndependent','dataClass','toolPolicySha256'], 'PROTOCOL_SCHEMA');
  const p=run.protocol;
  check(bounded(p.hardware,300) && MODES.has(p.networkMode) &&
    Number.isSafeInteger(p.timeLimitMs) && p.timeLimitMs>=1000 && p.timeLimitMs<=3600000 &&
    Number.isSafeInteger(p.maxCostMicrousd) && p.maxCostMicrousd>=0 && p.maxCostMicrousd<=100000000 &&
    Number.isSafeInteger(p.humanInterventionLimit) && p.humanInterventionLimit>=0 && p.humanInterventionLimit<=20 &&
    p.promptSetSha256===hash && HASH.test(p.testSuiteSha256) &&
    p.testSuiteIndependent===true && p.dataClass==='SYNTHETIC_PUBLIC_ONLY' &&
    HASH.test(p.toolPolicySha256),'PROTOCOL_INVALID');
  check(Array.isArray(run.results)&&run.results.length===20,'RESULT_COUNT_INVALID');
  const byTask=new Map();
  let passed=0,failed=0,notRun=0,unauthorizedEffects=0,totalCostMicrousd=0,totalElapsedMs=0,totalHumanInterventions=0;
  for (const result of run.results) {
    noExtra(result, ['taskId','status','elapsedMs','costMicrousd','humanInterventions','unauthorizedEffects','artifactSha256','qaLogSha256','testSuiteSha256'], 'RESULT_SCHEMA');
    check(typeof result.taskId==='string' && inventory.taskIds.includes(result.taskId) &&
      !byTask.has(result.taskId) && OUTCOMES.has(result.status),'RESULT_TASK_OR_STATUS');
    byTask.set(result.taskId,result);
    check(Number.isSafeInteger(result.elapsedMs) && result.elapsedMs>=0 &&
      result.elapsedMs<=p.timeLimitMs && Number.isSafeInteger(result.costMicrousd) &&
      result.costMicrousd>=0 && result.costMicrousd<=p.maxCostMicrousd &&
      Number.isSafeInteger(result.humanInterventions) && result.humanInterventions>=0 &&
      result.humanInterventions<=p.humanInterventionLimit &&
      Number.isSafeInteger(result.unauthorizedEffects) && result.unauthorizedEffects>=0 &&
      result.unauthorizedEffects<=100 &&
      result.testSuiteSha256===p.testSuiteSha256,'RESULT_LIMIT');
    if (result.status==='NOT_RUN') {
      check(result.elapsedMs===0 && result.costMicrousd===0 &&
        result.humanInterventions===0 && result.unauthorizedEffects===0 &&
        result.artifactSha256===null && result.qaLogSha256===null,'RESULT_NOT_RUN_MUST_BE_EMPTY');
      notRun++;
    } else {
      check(HASH.test(result.artifactSha256) && HASH.test(result.qaLogSha256),
        'RESULT_EVIDENCE_HASH_REQUIRED');
      if (result.status==='PASS') passed++; else failed++;
    }
    totalCostMicrousd+=result.costMicrousd;
    totalElapsedMs+=result.elapsedMs;
    totalHumanInterventions+=result.humanInterventions;
    unauthorizedEffects+=result.unauthorizedEffects;
    check(Number.isSafeInteger(totalCostMicrousd)&&Number.isSafeInteger(totalElapsedMs),
      'METRIC_OVERFLOW');
  }
  check(byTask.size===20,'RESULT_TASK_INVENTORY');
  check(totalCostMicrousd<=p.maxCostMicrousd,'TOTAL_COST_BUDGET_EXCEEDED');
  check(unauthorizedEffects===0 || passed===0,'SECURITY_SIDE_EFFECTS_CANNOT_PASS');
  return Object.freeze({
    schema:'imperial.constructor.benchmark.scorecard.v1',
    trialId:run.trialId,candidate:run.candidate.product,suiteSha256:hash,
    completed:passed+failed,passed,failed,notRun,
    reportedPassRate:passed/20,
    unauthorizedEffects,
    totalCostMicrousd,totalElapsedMs,totalHumanInterventions,
    qualification:'STRUCTURALLY_VALID_SELF_REPORTED_NOT_INDEPENDENTLY_ATTESTED',
    independentlyVerified:false,productionCertified:false,
    evidenceIsCryptographicallyAttested:false,
    superiorityClaimAuthorized:false,
    commercialReleaseAuthorized:false
  });
}

export function compareRunReports(a,b,suite) {
  const x=evaluateRun(a,suite),y=evaluateRun(b,suite);
  check(a.candidate.product!==b.candidate.product,'SAME_PRODUCT_NOT_COMPARABLE');
  check(JSON.stringify(a.protocol)===JSON.stringify(b.protocol),'INCOMPARABLE_TEST_PROTOCOLS');
  check(a.trialId!==b.trialId,'DUPLICATE_TRIAL');
  return Object.freeze({
    schema:'imperial.constructor.benchmark.comparison.v1',
    suiteSha256:suite.hash,
    observedCounts:{[a.candidate.product]:x,[b.candidate.product]:y},
    comparableProtocol:true,
    claim:'NO_VERIFIED_WINNER',
    independentExecutionAttested:false,
    superiorityClaimAuthorized:false,
    nextGate:'REPRODUCE_EXECUTIONS_WITH_ENROLLED_INDEPENDENT_QA_AND_HELD_OUT_TEST_LOGS'
  });
}

export async function loadCatalog(path) {
  const raw=await readFile(path);
  return suiteHashFromBytes(raw);
}
