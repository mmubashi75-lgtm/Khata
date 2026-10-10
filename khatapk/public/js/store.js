(function () {
  function storageKey(userId) {
    return 'khatapk_v1_' + (userId || 'guest');
  }

  function empty(meta) {
    meta = meta || {};
    return {
      profile: {
        business: meta.business || 'My Business',
        owner: meta.name || meta.email || 'Owner',
        phone: '',
        city: '',
        locale: 'en',
        plan: 'starter',
        pin: '',
        jazzcash: '',
        easypaisa: '',
        raast: '',
        created: new Date().toISOString()
      },
      staff: [],
      parties: [],
      txns: [],
      cash: [],
      activity: [
        { t: new Date().toISOString(), action: 'Account created', meta: meta.email || '' }
      ]
    };
  }

  function load(userId, meta) {
    var KEY = storageKey(userId);
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) {
        var blank = empty(meta);
        localStorage.setItem(KEY, JSON.stringify(blank));
        return blank;
      }
      var db = JSON.parse(raw);
      if (!db.profile) db.profile = empty(meta).profile;
      db.staff = db.staff || [];
      db.parties = db.parties || [];
      db.txns = db.txns || [];
      db.cash = db.cash || [];
      db.activity = db.activity || [];
      return db;
    } catch (e) {
      return empty(meta);
    }
  }

  function save(db, userId) {
    localStorage.setItem(storageKey(userId), JSON.stringify(db));
  }

  function uid() {
    return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function log(db, action, meta) {
    db.activity = db.activity || [];
    db.activity.unshift({ t: new Date().toISOString(), action: action, meta: meta || '' });
    db.activity = db.activity.slice(0, 200);
  }

  function partyBalance(db, partyId) {
    return (db.txns || []).filter(function (t) {
      return t.partyId === partyId;
    }).reduce(function (s, t) {
      if (t.type === 'credit' || t.type === 'purchase') return s + Number(t.amount);
      if (t.type === 'payment' || t.type === 'paid') return s - Number(t.amount);
      return s + Number(t.amount);
    }, 0);
  }

  function totals(db) {
    var rec = 0;
    var pay = 0;
    (db.parties || []).forEach(function (p) {
      var b = partyBalance(db, p.id);
      if (p.kind === 'customer') rec += Math.max(0, b);
      else pay += Math.max(0, b);
    });
    var collected = (db.txns || []).filter(function (t) {
      return t.type === 'payment';
    }).reduce(function (s, t) {
      return s + Number(t.amount);
    }, 0);
    var given = (db.txns || []).filter(function (t) {
      return t.type === 'credit';
    }).reduce(function (s, t) {
      return s + Number(t.amount);
    }, 0);
    var rate = given ? Math.round((collected / given) * 100) : 0;
    return { rec: rec, pay: pay, rate: rate, collected: collected, given: given };
  }

  window.Store = {
    load: load,
    save: save,
    uid: uid,
    log: log,
    partyBalance: partyBalance,
    totals: totals,
    empty: empty,
    storageKey: storageKey
  };
})();
