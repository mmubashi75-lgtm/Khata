import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/plan-status
 * Header: Authorization: Bearer <supabase_access_token>
 * Returns { plan } from profiles — server-side read with user JWT.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    res.status(500).json({ error: 'Server missing Supabase config' });
    return;
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: 'Bearer ' + token } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const plan = (data && data.plan) || 'starter';
  res.status(200).json({ plan: plan, userId: userData.user.id });
}
