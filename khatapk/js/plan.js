/**
 * Subscription plans — server is source of truth (Supabase profiles.plan).
 * Webhook updates plan; trigger blocks clients from changing plan.
 */
(function () {
  var RANK = { starter: 1, growth: 2, business: 3 };
  var cache = { plan: null, at: 0 };
  var CACHE_MS = 30 * 1000; // re-check at least every 30s for gated actions

  var FEATURES = {
    starter: {
      customers: true, suppliers: true, transactions: true, whatsapp: true, pin: true, backup: true,
      reminders: false, reports: false, cash: false, staff: false
    },
    growth: {
      customers: true, suppliers: true, transactions: true, whatsapp: true, pin: true, backup: true,
      reminders: true, reports: true, cash: true, staff: true
    },
    business: {
      customers: true, suppliers: true, transactions: true, whatsapp: true, pin: true, backup: true,
      reminders: true, reports: true, cash: true, staff: true
    }
  };

  function normalize(plan) {
    plan = String(plan || 'starter').toLowerCase();
    if (plan === 'pro' || plan === 'paid') return 'growth';
    if (RANK[plan]) return plan;
    return 'starter';
  }

  function can(plan, feature) {
    plan = normalize(plan);
    var f = FEATURES[plan] || FEATURES.starter;
    return !!f[feature];
  }

  function atLeast(plan, minPlan) {
    return (RANK[normalize(plan)] || 1) >= (RANK[normalize(minPlan)] || 1);
  }

  function label(plan) {
    plan = normalize(plan);
    if (plan === 'business') return 'Business';
    if (plan === 'growth') return 'Growth';
    return 'Starter';
  }

  /** Always hits Supabase (or uses short cache). Cannot be faked by localStorage alone for long. */
  async function fetchPlan(userId, force) {
    if (!userId) return 'starter';
    var now = Date.now();
    if (!force && cache.plan && (now - cache.at) < CACHE_MS) {
      return cache.plan;
    }
    try {
      var sb = await Auth.initSupabase();
      if (!sb) {
        cache = { plan: 'starter', at: now };
        return 'starter';
      }
      var res = await sb.from('profiles').select('plan').eq('id', userId).maybeSingle();
      if (res.error) {
        console.warn('fetchPlan', res.error.message);
        return cache.plan || 'starter';
      }
      var plan = normalize(res.data && res.data.plan);
      cache = { plan: plan, at: now };
      return plan;
    } catch (e) {
      console.warn('fetchPlan failed', e);
      return cache.plan || 'starter';
    }
  }

  function clearCache() {
    cache = { plan: null, at: 0 };
  }

  /**
   * Server check before a paid feature.
   * Returns { ok, plan }. ok=false if plan too low.
   */
  async function requireFeature(userId, feature, minPlan) {
    var plan = await fetchPlan(userId, true);
    var ok = can(plan, feature);
    return { ok: ok, plan: plan, minPlan: minPlan || 'growth' };
  }

  window.Plan = {
    FEATURES: FEATURES,
    normalize: normalize,
    can: can,
    atLeast: atLeast,
    label: label,
    fetchPlan: fetchPlan,
    clearCache: clearCache,
    requireFeature: requireFeature
  };
})();
