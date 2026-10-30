import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAndroidQaPlan,ARTEMIS_PIN} from '../engineering/artemis-qa-gate.mjs';

test('approved set of mobile QA steps yields a blocked, offline plan only',()=>{
 const plan=prepareAndroidQaPlan({projectId:'JEM-MOBILE-DEMO',
   checks:['LAUNCH','NAVIGATE','ACCESSIBILITY','SCREENSHOT']});
 assert.equal(plan.upstreamSha,ARTEMIS_PIN);
 assert.equal(plan.tasks.length,4);
 assert.equal(plan.deviceTestsExecuted,0);
 assert.equal(plan.deviceTestsPassed,0);
 assert.equal(plan.androidDeviceConnected,false);
 assert.equal(plan.mcpToolsUsed,0);
 assert.equal(plan.productionAuthority,false);
 assert.equal(plan.status,'AWAITING_AUTHORIZED_ANDROID_SANDBOX');
 assert.deepEqual(plan.tasks.map(x=>x.status),Array(4).fill('BLOCKED_DEVICE_REQUIRED'));
});
test('no live or paid mode can be enabled by project instruction',()=>{
 for(const bad of [
   {mode:'LIVE_DEVICE'},
   {mode:'PRODUCTION'},
   {budgetUsd:0.01},
   {upstreamSha:'a'.repeat(40)}
 ]){
  assert.throws(()=>prepareAndroidQaPlan({projectId:'MOBILE-1',checks:['LAUNCH'],...bad}));
 }
});
test('unknown device controls and duplicates are rejected',()=>{
 for(const checks of [[],['SHELL'],['LAUNCH','LAUNCH'],['OPEN_WALLET'],['LAUNCH',4]]){
  assert.throws(()=>prepareAndroidQaPlan({projectId:'MOBILE-1',checks}),/CHECKS_NOT_ALLOWED/);
 }
});
test('malformed project IDs are rejected',()=>{
 for(const projectId of ['../secrets','.env','', 'ok there',true]){
  assert.throws(()=>prepareAndroidQaPlan({projectId,checks:['LAUNCH']}),/PROJECT_ID_INVALID/);
 }
});
test('plan digest is deterministic for controlled inputs',()=>{
 const arg={projectId:'APP-QA',checks:['LAUNCH','PERFORMANCE']};
 const first=prepareAndroidQaPlan(arg);
 assert.equal(first.planSha256,prepareAndroidQaPlan(arg).planSha256);
 assert.notEqual(first.planSha256,prepareAndroidQaPlan({...arg,checks:['LAUNCH']}).planSha256);
});
