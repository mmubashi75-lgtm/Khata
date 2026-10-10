window.KPK = window.KPK || {};
(function () {
  var e = window.__KPK_ENV || {};
  function pick(lsKey, envVal) {
    return localStorage.getItem(lsKey) || envVal || '';
  }
  KPK.config = {
    supabaseUrl: pick('kpk_supabase_url', e.supabaseUrl),
    supabaseAnon: pick('kpk_supabase_anon', e.supabaseAnon),
    paddleToken: pick('kpk_paddle_token', e.paddleToken),
    paddleEnv: pick('kpk_paddle_env', e.paddleEnv || 'production'),
    prices: {
      starter: pick('kpk_price_starter', (e.prices && e.prices.starter) || ''),
      growth: pick('kpk_price_growth', (e.prices && e.prices.growth) || ''),
      business: pick('kpk_price_business', (e.prices && e.prices.business) || '')
    }
  };
})();
