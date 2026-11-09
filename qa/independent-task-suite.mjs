// Preauthored assertions run on the trusted host, never in the candidate
// process. The candidate runs only in a separate offline, read-only container.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {probeTaskCandidate} from './task-probe-client.mjs';

const suffix=randomBytes(8).toString('hex');
const challenge={idA:'a-'+suffix,titleA:'First '+suffix,idB:'b_'+suffix,titleB:'Second '+suffix};
const result=await probeTaskCandidate({stage:process.env.CONSTRUCTOR_TASK_STAGE,
  qaRoot:resolve('qa'),image:process.env.CONSTRUCTOR_SANDBOX_IMAGE,
  uid:Number(process.env.CONSTRUCTOR_TASK_UID),gid:Number(process.env.CONSTRUCTOR_TASK_GID),challenge});
const first={id:challenge.idA,title:challenge.titleA,done:false};
const second={id:challenge.idB,title:challenge.titleB,done:false};

test('model generated real task creation contract',()=>{
  assert.deepEqual(result.first,first);
  assert.deepEqual(result.second,second);
  assert.equal(result.invalidId,'TypeError');
  assert.equal(result.invalidTitle,'TypeError');
});
test('completion is immutable and independently observable',()=>{
  assert.deepEqual(result.before,first);
  assert.deepEqual(result.originalAfter,first);
  assert.deepEqual(result.completed,{...first,done:true});
  assert.equal(result.sameTask,false);
  assert.equal(result.invalidTask,'TypeError');
});
test('filterOpen is nonmutating with realistic case variation',()=>{
  assert.deepEqual(result.filtered,[first]);
  assert.equal(result.sameArray,false);
  assert.equal(result.sourceLength,2);
});
