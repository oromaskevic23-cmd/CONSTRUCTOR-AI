// Independent pre-authored acceptance suite. Never sent in the model prompt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceTotalCents} from './solution.mjs';

test('empty synthetic invoice returns integer zero',()=>{
 assert.equal(invoiceTotalCents([]),0);
});
test('two invoice line items sum in exact integer cents',()=>{
 assert.equal(invoiceTotalCents([{qty:2,unitCents:125},{qty:3,unitCents:10}]),280);
});
test('zero price accepted, quantity stays positive',()=>{
 assert.equal(invoiceTotalCents([{qty:4,unitCents:0}]),0);
});
test('large safe integer preserved without floating currency',()=>{
 assert.equal(invoiceTotalCents([{qty:3,unitCents:1234567}]),3703701);
});
test('input state remains unchanged, including nested line object',()=>{
 const lines=Object.freeze([Object.freeze({qty:2,unitCents:123})]);
 assert.equal(invoiceTotalCents(lines),246);
 assert.deepEqual(lines,[{qty:2,unitCents:123}]);
});
test('reject non-array input with TypeError',()=>{
 for(const invalid of [null,undefined,{},'str',42]){
  assert.throws(()=>invoiceTotalCents(invalid),TypeError);
 }
});
test('reject malformed objects and invalid numeric types with TypeError',()=>{
 for(const value of [null,'text',{},[],{qty:1}, {unitCents:2},
  {qty:1.5,unitCents:3},{qty:1,unitCents:2.5},
  {qty:'1',unitCents:2},{qty:1,unitCents:NaN},
  {qty:Infinity,unitCents:2}]){
  assert.throws(()=>invoiceTotalCents([value]),TypeError);
 }
});
test('reject invalid quantity and negative price with RangeError',()=>{
 for(const value of [{qty:0,unitCents:1},{qty:-1,unitCents:1},
  {qty:1,unitCents:-1}]){
  assert.throws(()=>invoiceTotalCents([value]),RangeError);
 }
});
test('reject unsafe single product arithmetic with RangeError',()=>{
 assert.throws(()=>invoiceTotalCents([{qty:2,unitCents:Number.MAX_SAFE_INTEGER}]),RangeError);
});
test('reject unsafe aggregate totals even if products individually safe',()=>{
 assert.throws(()=>invoiceTotalCents([
  {qty:1,unitCents:Number.MAX_SAFE_INTEGER},
  {qty:1,unitCents:1},
 ]),RangeError);
});
