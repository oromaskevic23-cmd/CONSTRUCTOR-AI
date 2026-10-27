import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyWorkerIdentity, createImperialSupabaseClient } from '../engineering/supabase-auth-client.mjs';

const env = { ...process.env };
process.env.SUPABASE_URL = 'https://flqxwhibxnyujynmopmr.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_only';

test('invalid worker identifiers rejected before network', async () => {
  await assert.rejects(verifyWorkerIdentity('placeholder', 'ASTRA-NCA-11'), /Invalid token or agent ID/);
  await assert.rejects(verifyWorkerIdentity('', 'ASTRA-NCA-01'), /Invalid token or agent ID/);
});
test('publishable client initializes without service role', () => {
  assert.ok(createImperialSupabaseClient());
});
test('invalid URL fails closed', () => {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  assert.throws(() => createImperialSupabaseClient(), /Invalid Supabase project URL/);
  process.env.SUPABASE_URL = env.SUPABASE_URL ?? 'https://flqxwhibxnyujynmopmr.supabase.co';
});
