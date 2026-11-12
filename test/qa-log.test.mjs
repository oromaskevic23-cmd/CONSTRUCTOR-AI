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
