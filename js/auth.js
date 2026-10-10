(function () {
  var AUTH_KEY = 'kpk_session';

  async function initSupabase() {
    var cfg = KPK.config || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnon || !window.supabase) return null;
    return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnon);
  }

  function localSession() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function setLocalSession(user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  }

  async function signUp(email, password, meta) {
    meta = meta || {};
    var sb = await initSupabase();
    if (sb) {
      var res = await sb.auth.signUp({
        email: email,
        password: password,
        options: { data: meta }
      });
      if (res.error) throw res.error;
      var u = res.data.user;
      setLocalSession({
        email: email,
        name: meta.name || email.split('@')[0],
        business: meta.business || 'My Business',
        source: 'supabase',
        id: u && u.id
      });
      return res.data;
    }
    var id = 'local_' + Date.now();
    setLocalSession({
      email: email,
      name: meta.name || email.split('@')[0],
      business: meta.business || 'My Business',
      source: 'local',
      id: id
    });
    return { user: localSession() };
  }

  async function signIn(email, password) {
    var sb = await initSupabase();
    if (sb) {
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      var u = res.data.user;
      setLocalSession({
        email: email,
        name: (u && u.user_metadata && u.user_metadata.name) || email.split('@')[0],
        business: (u && u.user_metadata && u.user_metadata.business) || 'My Business',
        source: 'supabase',
        id: u && u.id
      });
      return res.data;
    }
    var id = 'local_' + Date.now();
    setLocalSession({
      email: email,
      name: email.split('@')[0],
      business: 'My Business',
      source: 'local',
      id: id
    });
    return { user: localSession() };
  }

  async function signOut() {
    var sb = await initSupabase();
    if (sb) await sb.auth.signOut();
    localStorage.removeItem(AUTH_KEY);
  }

  function requireAuth() {
    var s = localSession();
    if (!s) {
      location.href = 'login.html';
      return null;
    }
    return s;
  }

  window.Auth = {
    initSupabase: initSupabase,
    localSession: localSession,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    requireAuth: requireAuth,
    setLocalSession: setLocalSession
  };
})();
