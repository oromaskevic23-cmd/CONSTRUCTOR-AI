import test from 'node:test';
import assert from 'node:assert/strict';
import {assertIndependentQaLog} from '../tools/qa-log.mjs';
const valid=`TAP version 13
ok 1 - model generated real task creation contract
ok 2 - completion is immutable and independently observable
ok 3 - filterOpen is nonmutating with realistic case variation
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;
test('accepts only the fixed independent suite summary',()=>assert.doesNotThrow(()=>assertIndependentQaLog(valid)));
test('rejects aggregate candidate counts and failed or skipped QA',()=>{
 for(const log of [valid.replace('# pass 3','# pass 4'),valid.replace('# fail 0','# fail 1'),valid.replace('# skipped 0','# skipped 1'),valid.replace('# cancelled 0','# cancelled 1'),valid.replace('# todo 0','# todo 1'),valid.replace('# tests 3','# tests 4')])assert.throws(()=>assertIndependentQaLog(log),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
});
test('rejects missing names, conflicting summaries and arbitrary prose',()=>{
 for(const log of [valid.replace('ok 2 - completion is immutable and independently observable','ok 2 - unrelated'),valid+'# pass 3\n','pass 3 fail 0 completion is immutable',valid.replace('ok 3','not ok 3'),'x'.repeat(80001)])assert.throws(()=>assertIndependentQaLog(log),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
});

test('rejects extra, reordered, missing-plan and failed top-level TAP entries',()=>{
 for(const log of [
   valid.replace('1..3','1..4').replace('# tests 3','# tests 3'),
   valid.replace('ok 1 -','not ok 1 -'),
   valid.replace('ok 1 - model generated real task creation contract','ok 4 - model generated real task creation contract'),
   valid.replace('ok 2 - completion is immutable and independently observable','ok 1 - completion is immutable and independently observable'),
   valid.replace('1..3',''),
   valid.replace('1..3','1..3\n1..3'),
   valid.replace('1..3','ok 4 - forged extra test\n1..3'),
   valid.replace('ok 3 - filterOpen is nonmutating with realistic case variation','ok 3 - filterOpen is nonmutating with realistic case variation # SKIP'),
 ])assert.throws(()=>assertIndependentQaLog(log),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
});

test('rejects bailout and embedded error diagnostics despite passing counters',()=>{
 for(const injected of [
   'Bail out! suite aborted',
   '# error: uncaught exception',
   '# failure: hidden error',
   'TAP version 12',
 ])assert.throws(()=>assertIndependentQaLog(valid.replace('1..3',injected+'\n1..3')),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
});

test('rejects missing, duplicate or displaced TAP headers',()=>{
 for(const log of [
   valid.replace('TAP version 13\n',''),
   'unexpected preamble\n'+valid,
   valid.replace('1..3','TAP version 13\n1..3'),
   valid.replace('TAP version 13','TAP version 14'),
 ])assert.throws(()=>assertIndependentQaLog(log),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
});

test('rejects missing, duplicated or nonzero suite summaries',()=>{
 for(const log of [
   valid.replace('# suites 0','# suites 1'),
   valid.replace('# suites 0',''),
   valid.replace('# suites 0','# suites 0\n# suites 0'),
 ])assert.throws(()=>assertIndependentQaLog(log),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
});

test('rejects embedded terminal control bytes even with passing counters',()=>{
  for(const code of [0, 7, 8, 11, 12, 27, 127, 128, 155, 159]){
    const injected=valid.replace('1..3',String.fromCharCode(code)+'1..3');
    assert.throws(()=>assertIndependentQaLog(injected),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
  }
});

test('rejects Unicode bidirectional formatting controls in QA output',()=>{
  for(const code of [0x202a,0x202b,0x202c,0x202d,0x202e,0x2066,0x2067,0x2068,0x2069]){
    const injected=valid.replace('1..3',String.fromCodePoint(code)+'1..3');
    assert.throws(()=>assertIndependentQaLog(injected),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
  }
});

test('rejects invisible directional marks in QA output',()=>{
  for(const code of [0x061c,0x200e,0x200f]){
    const injected=valid.replace('1..3',String.fromCodePoint(code)+'1..3');
    assert.throws(()=>assertIndependentQaLog(injected),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
  }
});

test('rejects indented failed TAP subtests despite passing top-level counters',()=>{
  for(const failure of ['    not ok 1 - hidden failure','\t not ok 2 - nested failure']){
    assert.throws(()=>assertIndependentQaLog(valid.replace('1..3',failure+'\n1..3')),/INDEPENDENT_QA_LOG_NOT_ACCEPTABLE/);
  }
});
