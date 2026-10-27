// Node 22+ ESM. Install @supabase/supabase-js before importing this module.
// Only publishable credentials are used; this module has no admin privileges.
import { createClient } from '@supabase/supabase-js';

export function createImperialSupabaseClient({ accessToken } = {}) {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL or publishable key');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) throw new Error('Invalid Supabase project URL');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
  });
}

export async function verifyWorkerIdentity(accessToken, agentId) {
  if (!accessToken || !/^ASTRA-NCA-(0[1-9]|10)$/.test(agentId)) throw new Error('Invalid token or agent ID');
  const supabase = createImperialSupabaseClient({ accessToken });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) return { authorized: false, reason: 'identity_unverified' };
  const metadata = data.user.app_metadata ?? {};
  const authorized = metadata.imperial_role === 'ASTRA_NCA_WORKER' &&
    Array.isArray(metadata.allowed_nca_agents) && metadata.allowed_nca_agents.includes(agentId);
  return { authorized, reason: authorized ? 'verified' : 'capability_denied', userId: data.user.id };
}
