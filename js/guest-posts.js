/* Guest post marketplace: table, bucket, 20% content discount, checkout. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'adf_gp_v1';
  var MAXQ = 20;
  var catalog = { sites: [], discountContentProvided: 0.2 };
  var state = { cart: {}, content: false, region: 'INTL', done: false, beaconSig: '', cat: '' };

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ cart: state.cart, content: state.content, name: $('gpName').value, email: $('gpEmail').value, phone: $('gpPhone').value, notes: $('gpNotes').value }));
    } catch (e) {}
  }
  function guessRegion() {
    try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN'; } catch (e) {}
    return 'INTL';
  }
  function currency() {
    var all = catalog.sites.length > 0 && catalog.sites.every(function (s) { return Number(s.priceINR) > 0; });
    return state.region === 'IN' && all ? 'INR' : 'USD';
  }
  function money(minor) {
    var cur = currency();
    return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100);
  }
  function unitMinor(s) { return Math.round(Number(currency() === 'INR' ? s.priceINR : s.priceUSD) * 100); }
  function unitPaid(s) { var u = unitMinor(s); return state.content ? Math.round(u * (1 - (Number(catalog.discountContentProvided) || 0.2))) : u; }
  function site(id) { return catalog.sites.filter(function (s) { return s.id === id; })[0]; }
  function cats(s) { return (s.niches && s.niches.length ? s.niches : [s.niche || 'General']); }
  function linkLabel(l) { return l === 'dofollow' ? 'Dofollow' : l === 'nofollow' ? 'Nofollow' : 'Mixed'; }
  function linkCls(l) { return l === 'dofollow' ? 'do' : l === 'nofollow' ? 'no' : 'mx'; }
  function kfmt(n) { if (n == null) return '—'; n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function totals() {
    var sub = 0, tot = 0, count = 0;
    Object.keys(state.cart).forEach(function (id) {
      var s = site(id), q = state.cart[id]; if (!s) return;
      sub += unitMinor(s) * q; tot += unitPaid(s) * q; count += q;
    });
    return { sub: sub, tot: tot, disc: sub - tot, count: count };
  }

  /* ---------- table ---------- */
  function num(id) { var v = $(id).value; return v === '' ? null : Number(v); }
  function filtered() {
    var q = $('gpSearch').value.trim().toLowerCase(), l = $('gpLink').value;
    var daMin = num('gpDaMin'), daMax = num('gpDaMax'), pMin = num('gpPMin'), pMax = num('gpPMax');
    var rows = catalog.sites.filter(function (s) {
      var price = unitMinor(s) / 100;
      return (!q || (s.name + ' ' + cats(s).join(' ')).toLowerCase().indexOf(q) > -1) &&
        (!state.cat || cats(s).indexOf(state.cat) > -1) && (!l || s.link === l) &&
        (daMin == null || Number(s.da) >= daMin) && (daMax == null || Number(s.da) <= daMax) &&
        (pMin == null || price >= pMin) && (pMax == null || price <= pMax);
    });
    var by = $('gpSort').value;
    rows.sort(function (a, b) {
      if (by === 'price') return unitMinor(a) - unitMinor(b) || b.da - a.da;
      if (by === 'priceDesc') return unitMinor(b) - unitMinor(a) || b.da - a.da;
      if (by === 'traffic') return (b.traffic || 0) - (a.traffic || 0);
      if (by === 'name') return a.name.localeCompare(b.name);
      if (by === 'category') return cats(a)[0].localeCompare(cats(b)[0]) || (b.da || 0) - (a.da || 0);
      return (b.da || 0) - (a.da || 0);
    });
    return rows;
  }
  function renderChips() {
    var box = $('gpChips'); box.textContent = '';
    var counts = {}; catalog.sites.forEach(function (s) { cats(s).forEach(function (c) { counts[c] = (counts[c] || 0) + 1; }); });
    var mk = function (label, val, n) {
      var b = el('button', 'gp-chip' + (state.cat === val ? ' on' : ''), label); b.type = 'button';
      if (n != null) b.appendChild(el('em', null, String(n)));
      b.onclick = function () { state.cat = val; renderChips(); renderTable(); };
      box.appendChild(b);
    };
    mk('All', '', catalog.sites.length);
    Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); }).forEach(function (c) { mk(c, c, counts[c]); });
  }
  function renderTable() {
    var body = $('gpBody'); body.textContent = '';
    var rows = filtered();
    $('gpCountLine').textContent = catalog.sites.length ? 'Showing ' + rows.length + ' of ' + catalog.sites.length + ' websites' : '';
    var empty = $('gpEmpty');
    if (!rows.length) {
      empty.style.display = 'block';
      empty.textContent = catalog.sites.length ? 'No websites match these filters. Try widening the DA or price range.' : 'Our publisher list is being updated. Please check back soon, or contact us and we will send you available sites.';
    } else empty.style.display = 'none';
    var group = $('gpSort').value === 'category', last = null;
    rows.forEach(function (s) {
      if (group && cats(s)[0] !== last) {
        last = cats(s)[0];
        var n = rows.filter(function (x) { return cats(x)[0] === last; }).length;
        var gr = el('tr', 'gp-group'), gt = el('td', null, last); gt.colSpan = 9; gt.appendChild(el('span', null, n + (n === 1 ? ' website' : ' websites')));
        gr.appendChild(gt); body.appendChild(gr);
      }
      var tr = el('tr');
      var tdAdd = el('td', 'c-add'); tdAdd.appendChild(addControl(s)); tr.appendChild(tdAdd);
      var tdN = el('td', 'c-name'); tdN.setAttribute('data-l', 'Website'); tdN.appendChild(el('span', 'gp-name', s.name)); tr.appendChild(tdN);
      [['DA', s.da], ['PA', s.pa], ['DR', s.dr == null ? '—' : s.dr], ['Traffic / mo', kfmt(s.traffic)]].forEach(function (p) { var td = el('td'); td.setAttribute('data-l', p[0]); td.appendChild(el('span', 'gp-num', String(p[1]))); tr.appendChild(td); });
      var tdNi = el('td'); tdNi.setAttribute('data-l', 'Category'); cats(s).forEach(function (c) { tdNi.appendChild(el('span', 'gp-niche', c)); tdNi.appendChild(document.createTextNode(' ')); }); tr.appendChild(tdNi);
      var tdL = el('td'); tdL.setAttribute('data-l', 'Link'); tdL.appendChild(el('span', 'gp-link ' + linkCls(s.link), linkLabel(s.link))); tr.appendChild(tdL);
      var tdP = el('td'); tdP.setAttribute('data-l', 'Price'); tdP.appendChild(el('span', 'gp-price', money(unitMinor(s)))); tr.appendChild(tdP);
      body.appendChild(tr);
    });
  }
  function addControl(s) {
    var q = state.cart[s.id] || 0;
    if (!q) { var b = el('button', 'gp-add', '+'); b.type = 'button'; b.setAttribute('aria-label', 'Add ' + s.name + ' to bucket'); b.onclick = function () { setQty(s.id, 1); }; return b; }
    var w = el('span', 'gp-step');
    var m = el('button', null, '−'); m.type = 'button'; m.setAttribute('aria-label', 'One less'); m.onclick = function () { setQty(s.id, q - 1); };
    var p = el('button', null, '+'); p.type = 'button'; p.setAttribute('aria-label', 'One more'); p.onclick = function () { setQty(s.id, q + 1); };
    w.appendChild(m); w.appendChild(el('span', null, String(q))); w.appendChild(p); return w;
  }
  function setQty(id, q) {
    if (q <= 0) delete state.cart[id]; else state.cart[id] = Math.min(MAXQ, q);
    state.done = false; save(); renderAll();
  }

  /* ---------- bucket ---------- */
  function renderBucket() {
    var t = totals();
    $('gpCount').textContent = String(t.count);
    $('gpFabTotal').textContent = t.count ? '· ' + money(t.tot) : '';
    var box = $('gpItems'); box.textContent = '';
    var ids = Object.keys(state.cart).filter(site);
    if (!ids.length) box.appendChild(el('p', 'gp-note', 'Your bucket is empty. Press + next to a website to add it.'));
    ids.forEach(function (id) {
      var s = site(id), q = state.cart[id], row = el('div', 'gp-item');
      var left = el('div'); left.appendChild(el('div', 'gp-name', s.name));
      left.appendChild(el('small', null, 'DA ' + s.da + ' · PA ' + s.pa + ' · ' + linkLabel(s.link) + ' · ' + money(unitPaid(s)) + ' each'));
      var rm = el('button', 'gp-rm', 'Remove'); rm.type = 'button'; rm.onclick = function () { setQty(id, 0); };
      left.appendChild(document.createElement('br')); left.appendChild(rm);
      var right = el('div'); right.style.textAlign = 'right';
      right.appendChild(addControl(s)); right.appendChild(el('div', 'gp-num', money(unitPaid(s) * q)));
      right.lastChild.style.marginTop = '6px';
      row.appendChild(left); row.appendChild(right); box.appendChild(row);
    });
    var sum = $('gpSum'); sum.textContent = '';
    if (t.count) {
      var line = function (a, b, cls) { var d = el('div', cls); d.appendChild(el('span', null, a)); d.appendChild(el('span', null, b)); sum.appendChild(d); };
      line('Subtotal', money(t.sub));
      if (t.disc) line('Content provided by you (−' + Math.round((Number(catalog.discountContentProvided) || 0.2) * 100) + '%)', '−' + money(t.disc), 'd');
      line('Total', money(t.tot), 't');
    }
    $('gpCheckout').disabled = !t.count;
    $('gpCheckout').style.opacity = t.count ? '1' : '.5';
  }
  function renderAll() { renderTable(); renderBucket(); }
  function openDrawer(open) {
    $('gpDrawer').classList.toggle('open', open); $('gpBackdrop').classList.toggle('open', open);
    $('gpDrawer').setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) $('gpClose').focus();
  }

  /* ---------- checkout ---------- */
  function payload(stage) {
    return {
      stage: stage, name: $('gpName').value.trim(), email: $('gpEmail').value.trim(), phone: $('gpPhone').value.trim(), notes: $('gpNotes').value.trim(),
      contentProvided: state.content, company_website: $('gpHp').value,
      items: Object.keys(state.cart).map(function (id) { return { id: id, qty: state.cart[id] }; })
    };
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function checkout() {
    var err = $('gpErr'); err.textContent = '';
    if (!totals().count) { err.textContent = 'Add at least one website to your bucket.'; return; }
    if (!$('gpName').value.trim()) { err.textContent = 'Please enter your name.'; $('gpName').focus(); return; }
    if (!validEmail($('gpEmail').value.trim())) { err.textContent = 'Please enter a valid email address.'; $('gpEmail').focus(); return; }
    if (!$('gpTerms').checked) { err.textContent = 'Please accept the Terms and Refund Policy.'; return; }
    var btn = $('gpCheckout'); btn.disabled = true; btn.textContent = 'Please wait...';
    fetch('/api/guest-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload('checkout')) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j && res.j.error || 'Something went wrong.');
        state.done = true;
        if (res.j.payUrl) { window.location.href = res.j.payUrl; return; }
        state.cart = {}; save(); renderAll();
        var box = $('gpItems'); box.textContent = '';
        box.appendChild(el('p', 'gp-note', 'Thank you! Your order ' + (res.j.orderId || '') + ' is received. We have emailed you the details and will send a secure payment link shortly.'));
        btn.textContent = 'Checkout';
      })
      .catch(function (e) { err.textContent = e.message || 'Something went wrong. Please try again.'; btn.disabled = false; btn.textContent = 'Checkout'; });
  }
  function maybeBeacon() {
    if (state.done || !totals().count || !validEmail($('gpEmail').value.trim())) return;
    var p = payload('abandoned'), sig = JSON.stringify([p.email, p.items, p.contentProvided]);
    if (sig === state.beaconSig) return;
    state.beaconSig = sig;
    try { navigator.sendBeacon('/api/guest-checkout', new Blob([JSON.stringify(p)], { type: 'application/json' })); } catch (e) {}
  }

  /* ---------- init ---------- */
  function init() {
    var saved = load();
    state.cart = saved.cart || {}; state.content = !!saved.content;
    $('gpName').value = saved.name || ''; $('gpEmail').value = saved.email || ''; $('gpPhone').value = saved.phone || ''; $('gpNotes').value = saved.notes || '';
    $('gpContent').checked = state.content;
    state.region = guessRegion();
    if (/[?&]paid=1/.test(location.search)) {
      var bn = $('gpBanner'); bn.style.display = 'block';
      bn.textContent = 'Thank you! If your payment went through, a confirmation email is on its way and we will start on your guest posts.';
      state.cart = {}; state.done = true; save();
    }
    ['gpSearch', 'gpLink', 'gpDaMin', 'gpDaMax', 'gpPMin', 'gpPMax', 'gpSort'].forEach(function (id) { $(id).addEventListener('input', renderTable); $(id).addEventListener('change', renderTable); });
    $('gpReset').addEventListener('click', function () { ['gpSearch', 'gpLink', 'gpDaMin', 'gpDaMax', 'gpPMin', 'gpPMax'].forEach(function (id) { $(id).value = ''; }); $('gpSort').value = 'category'; state.cat = ''; renderChips(); renderTable(); });
    $('gpContent').addEventListener('change', function () { state.content = this.checked; save(); renderAll(); });
    ['gpName', 'gpEmail', 'gpPhone', 'gpNotes'].forEach(function (id) { $(id).addEventListener('input', save); });
    $('gpFab').addEventListener('click', function () { openDrawer(true); });
    $('gpClose').addEventListener('click', function () { openDrawer(false); });
    $('gpBackdrop').addEventListener('click', function () { openDrawer(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') openDrawer(false); });
    $('gpCheckout').addEventListener('click', checkout);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') maybeBeacon(); });
    window.addEventListener('pagehide', maybeBeacon);

    fetch('/data/guest-sites.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (c) {
      catalog = c; catalog.sites = (c.sites || []).filter(function (s) { return s && s.id && s.name && Number(s.priceUSD) > 0; });
      Object.keys(state.cart).forEach(function (id) { if (!site(id)) delete state.cart[id]; });
      $('gpFab').style.display = catalog.sites.length ? '' : 'none';
      renderChips(); renderAll();
      fetch('/api/geo', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (g) { if (g && g.country) { state.region = g.country === 'IN' ? 'IN' : 'INTL'; renderChips(); renderAll(); } }).catch(function () {});
    }).catch(function () { $('gpEmpty').style.display = 'block'; $('gpEmpty').textContent = 'The website list could not be loaded. Please refresh the page.'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
