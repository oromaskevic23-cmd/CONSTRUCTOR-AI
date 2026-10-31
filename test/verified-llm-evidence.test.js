import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('archived real-LLM source remains byte-identical to the verified CI artifact', async () => {
  const bytes = await readFile(new URL('../evidence/llm_generated/20261031_invoice_total_qwen7b.mjs', import.meta.url));
  assert.equal(sha(bytes), '32d62071a4407cfd71692a2b6a8d25908adc128d96ce9856b19ad96e7111fd29');
});

test('ten pre-authored independent acceptance tests retain their verified exact bytes', async () => {
  const bytes = await readFile(new URL('../live_qa/invoice-acceptance.mjs', import.meta.url));
  assert.equal(sha(bytes), 'dcb585f8c66d732cb3243a65c7a286169239e167ef5368c9d26e17b43c94540f');
});

test('archived milestone keeps production and commercial denial explicit', async () => {
  const doc = await readFile(new URL('../docs/VERIFIED_REAL_LLM_MICROCOMPONENT_20261031.md',import.meta.url),'utf8');
  assert.ok(doc.includes('Release is DENIED'));
  assert.ok(doc.includes('NOT a full application release'));
  assert.ok(doc.includes('inherited-property check'));
});
