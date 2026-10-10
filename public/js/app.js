(function () {
  const session = Auth.requireAuth();
  if (!session) return;
  if (!session.id) session.id = session.email || ('local_' + Date.now());

  let db = Store.load(session.id, session);
  if (!db || !db.profile) db = Store.empty(session);
  let view = 'home';
  let selected = null;
  let pinBuf = '';

  const $ = (s) => document.querySelector(s);
  const money = (n) => '$' + Number(n || 0).toLocaleString('en-US');
  const toast = (m) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = m;
    el.style.display = 'block';
    setTimeout(() => (el.style.display = 'none'), 2200);
  };

  function persist() {
    Store.save(db, session.id);
  }

  function t(key) {
    const loc = db.profile.locale === 'ur' ? 'ur' : 'en';
    return (window.I18N && I18N[loc] && I18N[loc][key]) || (I18N && I18N.en[key]) || key;
  }
  function applyLang() {
    document.documentElement.lang = db.profile.locale === 'ur' ? 'ur' : 'en';
    document.body.classList.toggle('lang-ur', db.profile.locale === 'ur');
    const navMap = { home: t('home'), customers: t('customers'), suppliers: t('suppliers'), cash: t('cash'), reminders: t('remind'), reports: t('reports'), settings: t('settings') };
    document.querySelectorAll('.nav button').forEach((b) => {
      if (navMap[b.dataset.view]) b.textContent = navMap[b.dataset.view];
    });
  }
  function hourGreet() {
    const h = new Date().getHours();
    if (h < 12) return t('goodMorning');
    if (h < 17) return t('goodAfternoon');
    return t('goodEvening');
  }

  function waLink(phone, text) {
    const p = String(phone || '').replace(/\D/g, '');
    const num = p.startsWith('92') ? p : p.startsWith('0') ? '92' + p.slice(1) : '92' + p;
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
  }

  function statement(p) {
    const tx = db.txns.filter((t) => t.partyId === p.id).sort((a, b) => a.date.localeCompare(b.date));
    const bal = Store.partyBalance(db, p.id);
    let lines = [db.profile.business, p.name, '', 'Khata statement', ''];
    tx.forEach((t) => {
      const sign = t.type === 'payment' || t.type === 'paid' ? '-' : '+';
      lines.push(`${t.date}  ${sign}${t.amount}  ${t.desc || t.type}`);
    });
    lines.push('────────────');
    lines.push('Balance: ' + money(bal));
    lines.push('');
    lines.push(bal >= 0 && p.kind === 'customer' ? 'Aap se lena: ' + money(bal) : 'Balance: ' + money(bal));
    return lines.join('\n');
  }

  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').classList.add('open');
  }
  function closeModal() {
    $('#modal').classList.remove('open');
  }

  function partyForm(existing) {
    const p = existing || { kind: 'customer', rem: true, interval: 7 };
    openModal(`
      <h3>${existing ? 'Edit party' : 'New party'}</h3>
      <label>Type</label>
      <select id="fKind">
        <option value="customer" ${p.kind === 'customer' ? 'selected' : ''}>Customer (lena)</option>
        <option value="supplier" ${p.kind === 'supplier' ? 'selected' : ''}>Supplier (dena)</option>
      </select>
      <label>Name</label><input id="fName" value="${p.name || ''}" placeholder="Ahmed Traders">
      <label>Phone</label><input id="fPhone" value="${p.phone || ''}" placeholder="03xx">
      <label>Address</label><input id="fAddr" value="${p.address || ''}">
      <label>Notes</label><textarea id="fNotes">${p.notes || ''}</textarea>
      <div class="grid2">
        <div><label>Due date</label><input type="date" id="fDue" value="${p.due || ''}"></div>
        <div><label>Reminder every (days)</label><input type="number" id="fInt" value="${p.interval || 7}"></div>
      </div>
      <label><input type="checkbox" id="fRem" ${p.rem !== false ? 'checked' : ''}> Automatic reminders</label>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-p" id="saveParty">Save</button>
        <button class="btn btn-s" onclick="document.getElementById('modal').classList.remove('open')">Cancel</button>
      </div>
    `);
    $('#saveParty').onclick = () => {
      const rec = {
        id: p.id || Store.uid(),
        kind: $('#fKind').value,
        name: $('#fName').value.trim(),
        phone: $('#fPhone').value.trim(),
        address: $('#fAddr').value.trim(),
        notes: $('#fNotes').value.trim(),
        due: $('#fDue').value,
        interval: Number($('#fInt').value || 7),
        rem: $('#fRem').checked
      };
      if (!rec.name) return toast('Name required');
      if (existing) {
        const i = db.parties.findIndex((x) => x.id === p.id);
        db.parties[i] = rec;
        Store.log(db, 'Party updated', rec.name);
      } else {
        db.parties.unshift(rec);
        Store.log(db, 'Party added', rec.name);
      }
      persist();
      closeModal();
      render();
      toast('Saved');
    };
  }

  function txnForm(party, preset) {
    const typeDefault = preset || (party.kind === 'supplier' ? 'purchase' : 'credit');
    openModal(`
      <h3>${party.name}</h3>
      <p class="muted">Current balance ${money(Store.partyBalance(db, party.id))}</p>
      <label>Type</label>
      <select id="tType">
        <option value="credit">Give credit / Goods (udhaar diya)</option>
        <option value="payment">Receive payment (wasooli)</option>
        <option value="purchase">Purchase from supplier</option>
        <option value="paid">Pay supplier</option>
        <option value="adjustment">Adjustment (+/-)</option>
      </select>
      <label>Amount (Rs)</label><input id="tAmt" type="number" inputmode="decimal" placeholder="10000">
      <label>Date</label><input id="tDate" type="date" value="${new Date().toISOString().slice(0,10)}">
      <label>Description</label><input id="tDesc" placeholder="Goods / JazzCash / Cash">
      <div class="row" style="margin-top:14px">
        <button class="btn btn-p" id="saveTxn">Save entry</button>
        <button class="btn btn-s" onclick="document.getElementById('modal').classList.remove('open')">Cancel</button>
      </div>
    `);
    $('#tType').value = typeDefault;
    $('#saveTxn').onclick = () => {
      const amount = Number($('#tAmt').value);
      if (!amount) return toast('Enter amount');
      db.txns.unshift({
        id: Store.uid(),
        partyId: party.id,
        type: $('#tType').value,
        amount: $('#tType').value === 'adjustment' ? amount : Math.abs(amount),
        desc: $('#tDesc').value.trim(),
        date: $('#tDate').value
      });
      Store.log(db, 'Transaction', party.name + ' ' + amount);
      persist();
      closeModal();
      render();
      toast('Entry saved');
    };
  }

  function collectForm(party) {
    const bal = Store.partyBalance(db, party.id);
    const jc = db.profile.jazzcash || db.profile.phone || '';
    const ep = db.profile.easypaisa || jc;
    const ra = db.profile.raast || '';
    const msg = (method) =>
      `Assalam o Alaikum ${party.name},\n${db.profile.business}\nPending: ${money(bal)}\nPlease send via ${method}.\nJazzCash: ${jc}\nEasypaisa: ${ep}\nRaast: ${ra}\nShukriya.`;
    openModal(`
      <h3>${t('collect')} · ${party.name}</h3>
      <p class="muted">${t('youReceive')} ${money(bal)}</p>
      <div class="pay-row">
        <button class="btn btn-p" id="payJazz">${t('jazz')} ${jc}</button>
        <button class="btn btn-s" id="payEasy">${t('easy')} ${ep}</button>
        <button class="btn btn-s" id="payRaast">${t('raast')} ${ra || '—'}</button>
      </div>
      <p class="muted">Opens WhatsApp with your shop wallet numbers. Record the payment after it lands.</p>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-w" id="payWA">${t('sendPayLink')}</button>
        <button class="btn btn-p" id="payRecord">${t('recvPay')}</button>
      </div>
    `);
    $('#payJazz').onclick = () => window.open(waLink(party.phone, msg('JazzCash')), '_blank');
    $('#payEasy').onclick = () => window.open(waLink(party.phone, msg('Easypaisa')), '_blank');
    $('#payRaast').onclick = () => window.open(waLink(party.phone, msg('Raast / bank')), '_blank');
    $('#payWA').onclick = () => window.open(waLink(party.phone, msg('JazzCash / Easypaisa / Raast')), '_blank');
    $('#payRecord').onclick = () => {
      closeModal();
      txnForm(party, 'payment');
    };
  }

  function cashForm() {
    openModal(`
      <h3>Cash book entry</h3>
      <label>Direction</label>
      <select id="cDir"><option value="in">Cash in</option><option value="out">Cash out</option></select>
      <label>Amount</label><input id="cAmt" type="number">
      <label>Category</label>
      <select id="cCat">
        <option>Sales cash</option><option>Expense</option><option>Rent</option>
        <option>Salary</option><option>Utility</option><option>Personal</option><option>Other</option>
      </select>
      <label>Note</label><input id="cNote">
      <label>Date</label><input id="cDate" type="date" value="${new Date().toISOString().slice(0,10)}">
      <div class="row" style="margin-top:14px">
        <button class="btn btn-p" id="saveCash">Save</button>
        <button class="btn btn-s" onclick="document.getElementById('modal').classList.remove('open')">Cancel</button>
      </div>
    `);
    $('#saveCash').onclick = () => {
      const amount = Number($('#cAmt').value);
      if (!amount) return toast('Amount required');
      db.cash.unshift({
        id: Store.uid(),
        dir: $('#cDir').value,
        amount,
        cat: $('#cCat').value,
        note: $('#cNote').value,
        date: $('#cDate').value
      });
      Store.log(db, 'Cash entry', amount);
      persist();
      closeModal();
      render();
    };
  }

  function renderHome() {
    const tot = Store.totals(db);
    const list = db.parties
      .filter((p) => p.kind === 'customer')
      .map((p) => ({ p, b: Store.partyBalance(db, p.id) }))
      .sort((a, b) => b.b - a.b);
    return `
      <div class="hero">
        <div class="hero-kicker">${hourGreet()} 👋</div>
        <h1>${db.profile.business}</h1>
        <p class="sub">${db.profile.city || 'Pakistan'} · ${session.email || db.profile.owner}</p>
        <div class="stats">
          <div class="stat"><div class="l">${t('receivable')}</div><div class="v pos">${money(tot.rec)}</div></div>
          <div class="stat"><div class="l">${t('payable')}</div><div class="v neg">${money(tot.pay)}</div></div>
          <div class="stat"><div class="l">${t('collection')}</div><div class="v">${tot.rate}%</div></div>
        </div>
        <div class="row">
          <button class="btn btn-p" id="giveCredit">${t('giveCredit')}</button>
          <button class="btn btn-s" id="recvPay">${t('recvPay')}</button>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3>${t('customers')}</h3>
          <button class="btn btn-s" id="addParty">${t('add')}</button>
        </div>
        <div class="list" style="margin-top:10px">
          ${list.length ? list.map(({ p, b }) => `
            <div class="item" data-open="${p.id}">
              <div><strong>${p.name}</strong><div class="muted">${p.phone || 'No phone'} · due ${p.due || '—'}</div></div>
              <div class="${b >= 0 ? 'pos' : 'neg'}" style="font-weight:700">${money(b)}</div>
            </div>`).join('') : '<p class="muted">No customers yet. Tap Add to create your first khata.</p>'}
        </div>
      </div>
    `;
  }

  function renderParty() {
    const p = db.parties.find((x) => x.id === selected);
    if (!p) return renderHome();
    const bal = Store.partyBalance(db, p.id);
    const tx = db.txns.filter((t) => t.partyId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const youReceive = p.kind === 'customer';
    return `
      <button class="btn btn-s" id="backHome">← Back</button>
      <div class="hero" style="margin-top:12px">
        <div class="hero-kicker">${p.kind === 'customer' ? 'Customer khata' : 'Supplier khata'}</div>
        <h1>${p.name}</h1>
        <p class="muted">${p.phone || ''} ${p.address ? '· ' + p.address : ''}</p>
        <div class="stat" style="margin-top:12px">
          <div class="l">${youReceive ? t('youReceive') : t('youPay')}</div>
          <div class="v ${youReceive ? 'pos' : 'neg'}">${money(Math.abs(bal))}</div>
        </div>
        <div class="row">
          <button class="btn btn-w" id="waBal">${t('waBal')}</button>
          <button class="btn btn-p" id="waRem">${t('reminder')}</button>
          <button class="btn btn-s" id="waStmt">${t('statement')}</button>
          <button class="btn btn-s" id="addTxn">${t('entry')}</button>
          ${youReceive ? `<button class="btn btn-p" id="collectPay">${t('collect')}</button>` : ''}
          <button class="btn btn-s" id="editP">${t('edit')}</button>
        </div>
      </div>
      <div class="card">
        <h3>${t('txns')}</h3>
        ${tx.map((t) => {
          const plus = t.type === 'credit' || t.type === 'purchase' || (t.type === 'adjustment' && t.amount > 0);
          return `<div class="txn"><div class="muted">${t.date.slice(5)}</div><div>${t.desc || t.type}</div><div class="${plus ? 'pos' : 'neg'}">${plus ? '+' : '-'} ${money(Math.abs(t.amount)).replace('$','')}</div></div>`;
        }).join('') || '<p class="muted">No entries yet</p>'}
        <div style="margin-top:12px;font-weight:700">${t('balance')}: ${money(bal)}</div>
      </div>
    `;
  }

  function renderParties(kind) {
    const q = ($('#q') && $('#q').value || '').toLowerCase();
    const rows = db.parties.filter((p) => p.kind === kind && (!q || p.name.toLowerCase().includes(q) || (p.phone || '').includes(q)));
    return `
      <input class="search" id="q" placeholder="Search name or phone" value="${q || ''}">
      <div class="row" style="margin-bottom:10px">
        <button class="btn btn-p" id="addParty">Add ${kind}</button>
      </div>
      <div class="list">
        ${rows.map((p) => `<div class="item" data-open="${p.id}"><div><strong>${p.name}</strong><div class="muted">${p.phone || ''}</div></div><div>${money(Store.partyBalance(db, p.id))}</div></div>`).join('') || '<p class="muted">Empty list</p>'}
      </div>
    `;
  }

  function renderReminders() {
    const due = db.parties.filter((p) => p.kind === 'customer' && p.rem && Store.partyBalance(db, p.id) > 0);
    return `
      <div class="hero"><h1>Reminders</h1><p class="sub">Automatic, due-date and recurring follow-ups. WhatsApp opens with a ready message — attach your WhatsApp Business later if you want official templates.</p></div>
      <div class="list">
        ${due.map((p) => {
          const b = Store.partyBalance(db, p.id);
          const overdue = p.due && p.due < new Date().toISOString().slice(0,10);
          return `<div class="item">
            <div><strong>${p.name}</strong><div class="muted">${overdue ? 'OVERDUE · ' : ''}due ${p.due || 'not set'} · every ${p.interval}d</div></div>
            <div>
              <div class="pos">${money(b)}</div>
              <button class="btn btn-w" data-remind="${p.id}">Send</button>
            </div>
          </div>`;
        }).join('') || '<p class="muted">No open receivables with reminders on.</p>'}
      </div>
    `;
  }

  function renderReports() {
    const tot = Store.totals(db);
    const cashIn = db.cash.filter((c) => c.dir === 'in').reduce((s, c) => s + c.amount, 0);
    const cashOut = db.cash.filter((c) => c.dir === 'out').reduce((s, c) => s + c.amount, 0);
    return `
      <div class="hero"><h1>Reports</h1><p class="sub">Numbers a dukandaar actually uses — not accountant theatre.</p></div>
      <div class="stats">
        <div class="stat"><div class="l">Receivable</div><div class="v pos">${money(tot.rec)}</div></div>
        <div class="stat"><div class="l">Payable</div><div class="v neg">${money(tot.pay)}</div></div>
        <div class="stat"><div class="l">Collection rate</div><div class="v">${tot.rate}%</div></div>
        <div class="stat"><div class="l">Credit given</div><div class="v">${money(tot.given)}</div></div>
        <div class="stat"><div class="l">Payments in</div><div class="v">${money(tot.collected)}</div></div>
        <div class="stat"><div class="l">Cash in hand (book)</div><div class="v">${money(cashIn - cashOut)}</div></div>
      </div>
      <div class="card">
        <h3>Customer balances</h3>
        ${db.parties.filter(p=>p.kind==='customer').map(p=>`<div class="txn"><div></div><div>${p.name}</div><div>${money(Store.partyBalance(db,p.id))}</div></div>`).join('')}
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-s" id="exportJson">Backup JSON</button>
        <button class="btn btn-s" id="printRep">Print / PDF</button>
      </div>
    `;
  }

  function renderCash() {
    const inAmt = db.cash.filter((c) => c.dir === 'in').reduce((s, c) => s + c.amount, 0);
    const outAmt = db.cash.filter((c) => c.dir === 'out').reduce((s, c) => s + c.amount, 0);
    return `
      <div class="hero">
        <h1>Cash book</h1>
        <div class="stats">
          <div class="stat"><div class="l">In</div><div class="v pos">${money(inAmt)}</div></div>
          <div class="stat"><div class="l">Out</div><div class="v neg">${money(outAmt)}</div></div>
          <div class="stat"><div class="l">Net</div><div class="v">${money(inAmt-outAmt)}</div></div>
        </div>
        <button class="btn btn-p" id="addCash">+ Cash entry</button>
      </div>
      <div class="card">
        ${db.cash.map(c=>`<div class="txn"><div class="muted">${c.date.slice(5)}</div><div>${c.cat} · ${c.note||''}</div><div class="${c.dir==='in'?'pos':'neg'}">${c.dir==='in'?'+':'-'} ${c.amount.toLocaleString()}</div></div>`).join('')||'<p class="muted">No cash entries</p>'}
      </div>
    `;
  }

  function renderSettings() {
    const p = db.profile;
    return `
      <div class="hero"><h1>Settings</h1><p class="sub">Business profile, security, plan, backup.</p></div>
      <div class="card">
        <h3>Business</h3>
        <label>Shop name</label><input id="sBiz" value="${p.business}">
        <label>Owner</label><input id="sOwn" value="${p.owner}">
        <label>Phone</label><input id="sPh" value="${p.phone||''}">
        <label>City</label><input id="sCity" value="${p.city||''}">
        <label>JazzCash number</label><input id="sJazz" value="${p.jazzcash||''}">
        <label>Easypaisa number</label><input id="sEasy" value="${p.easypaisa||''}">
        <label>Raast / IBAN / account</label><input id="sRaast" value="${p.raast||''}">
        <button class="btn btn-p" id="saveProf" style="margin-top:10px">Save profile</button>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>${t('staff')}</h3>
        <p class="muted">Owner / manager / munshi. Supabase RLS treats invited emails as shop members (see sql/schema.sql).</p>
        ${(db.staff||[]).map(s=>`<div class="item"><div><strong>${s.name}</strong><div class="muted">${s.email} · ${s.role}</div></div><div class="muted">${s.canDelete?'delete':'no delete'}</div></div>`).join('')}
        <div class="grid2" style="margin-top:10px">
          <input id="stName" placeholder="Name">
          <input id="stEmail" placeholder="email@shop.pk">
        </div>
        <select id="stRole" style="margin-top:8px"><option value="munshi">Munshi</option><option value="manager">Manager</option><option value="owner">Owner</option></select>
        <button class="btn btn-s" id="addStaff" style="margin-top:8px">Invite staff</button>
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Security</h3>
        <p class="muted">4-digit PIN lock on this device. Activity history is kept locally and can sync via Supabase.</p>
        <label>Set / change PIN</label><input id="sPin" type="password" maxlength="4" placeholder="••••" value="${p.pin||''}">
        <button class="btn btn-s" id="savePin" style="margin-top:8px">Save PIN</button>
        <h3 style="margin-top:16px">Activity</h3>
        ${db.activity.slice(0,12).map(a=>`<div class="muted">${a.t.slice(0,16).replace('T',' ')} — ${a.action} ${a.meta||''}</div>`).join('')}
      </div>
      <div class="card" style="margin-top:12px">
        <h3>Plan · ${p.plan}</h3>
        <p class="muted">Starter $3 · Growth $6 · Business $15 per month. 7-day trial via Paddle.</p>
        <div class="row">
          <button class="btn btn-s" data-plan="starter">Starter $3/mo</button>
          <button class="btn btn-p" data-plan="growth">Growth $6/mo</button>
          <button class="btn btn-s" data-plan="business">Business $15/mo</button>
        </div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-s" id="exportJson">Download backup</button>
        <button class="btn btn-s" id="impBtn">Import backup</button>
        <input type="file" id="impFile" accept="application/json" class="hidden">
        <button class="btn btn-d" id="logout">Sign out</button>
      </div>
    `;
  }

  function render() {
    try {
    if (!db) db = Store.empty(session);
    if (!db.profile) db.profile = Store.empty(session).profile;
    if (db.profile.pin && sessionStorage.getItem('kpk_unlocked') !== '1') {
      $('#appRoot').innerHTML = `
        <div class="pin-wrap"><div class="pin-box">
          <div class="logo" style="margin:0 auto 10px">ک</div>
          <h2>Enter PIN</h2>
          <div class="dots">${[0,1,2,3].map(i=>`<div class="dot ${pinBuf.length>i?'f':''}"></div>`).join('')}</div>
          <div class="keys">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>`<button data-k="${k}">${k}</button>`).join('')}</div>
        </div></div>`;
      return;
    }
    let html = '';
    if (view === 'home') html = renderHome();
    else if (view === 'party') html = renderParty();
    else if (view === 'customers') html = renderParties('customer');
    else if (view === 'suppliers') html = renderParties('supplier');
    else if (view === 'reminders') html = renderReminders();
    else if (view === 'reports') html = renderReports();
    else if (view === 'cash') html = renderCash();
    else if (view === 'settings') html = renderSettings();
    $('#appRoot').innerHTML = html;
    document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === (view === 'party' ? 'home' : view)));
    applyLang();
    const lb = document.getElementById('langBtn');
    if (lb) lb.textContent = t('lang');
    bind();
    } catch (err) {
      console.error('Render error', err);
      const root = document.getElementById('appRoot');
      if (root) root.innerHTML = '<div class="hero"><h1>Something went wrong</h1><p class="muted">' + (err.message || err) + '</p><button class="btn btn-p" onclick="location.reload()">Reload</button></div>';
    }
  }

  function bind() {
    $('#addParty') && ($('#addParty').onclick = () => partyForm());
    $('#giveCredit') && ($('#giveCredit').onclick = () => {
      view = 'customers';
      render();
      toast('Open a customer, then add credit');
    });
    $('#recvPay') && ($('#recvPay').onclick = () => {
      view = 'customers';
      render();
    });
    document.querySelectorAll('[data-open]').forEach((el) => {
      el.onclick = () => {
        selected = el.getAttribute('data-open');
        view = 'party';
        render();
      };
    });
    $('#backHome') && ($('#backHome').onclick = () => {
      view = 'home';
      render();
    });
    $('#addTxn') && ($('#addTxn').onclick = () => txnForm(db.parties.find((p) => p.id === selected)));
    $('#editP') && ($('#editP').onclick = () => partyForm(db.parties.find((p) => p.id === selected)));
    $('#waBal') && ($('#waBal').onclick = () => {
      const p = db.parties.find((x) => x.id === selected);
      const msg = `${db.profile.business}\n${p.name}\n\nAap ka khata balance: ${money(Store.partyBalance(db, p.id))}\nShukriya.`;
      window.open(waLink(p.phone, msg), '_blank');
    });
    $('#waRem') && ($('#waRem').onclick = () => {
      const p = db.parties.find((x) => x.id === selected);
      const msg = `Assalam o Alaikum ${p.name},\n${db.profile.business} se reminder.\nPending udhaar: ${money(Store.partyBalance(db, p.id))}\nMeharbani farma kar jald adaigi kar dein.`;
      window.open(waLink(p.phone, msg), '_blank');
      Store.log(db, 'Reminder sent', p.name);
      persist();
    });
    $('#waStmt') && ($('#waStmt').onclick = () => {
      const p = db.parties.find((x) => x.id === selected);
      window.open(waLink(p.phone, statement(p)), '_blank');
    });
    document.querySelectorAll('[data-remind]').forEach((b) => {
      b.onclick = () => {
        const p = db.parties.find((x) => x.id === b.getAttribute('data-remind'));
        selected = p.id;
        view = 'party';
        render();
        setTimeout(() => $('#waRem') && $('#waRem').click(), 50);
      };
    });
    $('#addCash') && ($('#addCash').onclick = cashForm);
    $('#q') && ($('#q').oninput = () => {
      const v = $('#q').value;
      render();
      const nq = $('#q');
      if (nq) {
        nq.value = v;
        nq.focus();
        nq.setSelectionRange(v.length, v.length);
      }
    });
    $('#saveProf') && ($('#saveProf').onclick = () => {
      db.profile.business = $('#sBiz').value;
      db.profile.owner = $('#sOwn').value;
      db.profile.phone = $('#sPh').value;
      db.profile.city = $('#sCity').value;
      db.profile.jazzcash = $('#sJazz').value;
      db.profile.easypaisa = $('#sEasy').value;
      db.profile.raast = $('#sRaast').value;
      persist();
      toast('Profile saved');
    });
    $('#addStaff') && ($('#addStaff').onclick = () => {
      const name = $('#stName').value.trim();
      const email = $('#stEmail').value.trim();
      if (!name || !email) return toast('Name and email required');
      db.staff = db.staff || [];
      db.staff.push({ id: Store.uid(), name, email, role: $('#stRole').value, canEdit: true, canDelete: false, canReports: $('#stRole').value !== 'munshi' });
      Store.log(db, 'Staff invited', email);
      persist();
      render();
      toast('Staff added');
    });
    $('#collectPay') && ($('#collectPay').onclick = () => collectForm(db.parties.find((p) => p.id === selected)));
    $('#langBtn') && ($('#langBtn').onclick = () => {
      db.profile.locale = db.profile.locale === 'ur' ? 'en' : 'ur';
      persist();
      render();
    });
    $('#savePin') && ($('#savePin').onclick = () => {
      db.profile.pin = $('#sPin').value;
      persist();
      toast(db.profile.pin ? 'PIN saved' : 'PIN cleared');
    });
    $('#saveInt') && ($('#saveInt').onclick = () => {
      localStorage.setItem('kpk_supabase_url', $('#sbUrl').value.trim());
      localStorage.setItem('kpk_supabase_anon', $('#sbKey').value.trim());
      localStorage.setItem('kpk_paddle_token', $('#pdTok').value.trim());
      localStorage.setItem('kpk_paddle_env', $('#pdEnv').value);
      KPK.config.supabaseUrl = $('#sbUrl').value.trim();
      KPK.config.supabaseAnon = $('#sbKey').value.trim();
      KPK.config.paddleToken = $('#pdTok').value.trim();
      KPK.config.paddleEnv = $('#pdEnv').value;
      toast('Keys stored on this device');
    });
    document.querySelectorAll('[data-plan]').forEach((b) => {
      b.onclick = () => {
        const plan = b.getAttribute('data-plan');
        const price = KPK.config.prices[plan];
        Billing.checkout(price, session.email, session.id);
        toast('Opening checkout for ' + plan + '…');
        render();
      };
    });
    $('#exportJson') && ($('#exportJson').onclick = () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'khatapk-backup.json';
      a.click();
    });
    $('#printRep') && ($('#printRep').onclick = () => window.print());
    $('#impBtn') && ($('#impBtn').onclick = () => $('#impFile').click());
    $('#impFile') && ($('#impFile').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        db = JSON.parse(r.result);
        persist();
        toast('Backup restored');
        render();
      };
      r.readAsText(f);
    });
    $('#logout') && ($('#logout').onclick = async () => {
      await Auth.signOut();
      location.href = 'login.html';
    });
    document.querySelectorAll('[data-k]').forEach((b) => {
      b.onclick = () => {
        const k = b.getAttribute('data-k');
        if (k === '⌫') pinBuf = pinBuf.slice(0, -1);
        else if (k && pinBuf.length < 4) pinBuf += k;
        if (pinBuf.length === 4) {
          if (pinBuf === db.profile.pin) {
            sessionStorage.setItem('kpk_unlocked', '1');
            pinBuf = '';
            render();
          } else {
            pinBuf = '';
            toast('Wrong PIN');
            render();
          }
        } else render();
      };
    });
  }

  document.querySelectorAll('.nav button').forEach((b) => {
    b.onclick = () => {
      view = b.dataset.view;
      selected = null;
      render();
    };
  });
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });

  Billing.boot();
  function bootUI() {
    view = 'home';
    render();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootUI);
  } else {
    requestAnimationFrame(bootUI);
  }
})();
