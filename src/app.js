/* Haushalt: geteilte Einkaufsliste mit Laufweg pro Laden und Dauerartikeln. Gleicher Look wie Vorkoch. */
(function () {
  'use strict';
  const H = window.HC;
  const KEY = 'haushalt.v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);

  /* ---------- Zustand ---------- */
  let S;
  function fresh() {
    const now = Date.now();
    return { items: { iwsack01: { n: 'Wäschesäcke (30°, 40°, Handtücher)', s: 'voll', c: 'sonst', q: '3 Stück', b: 0, d: 0, r: '', m: 1 } }, rec: H.seed(now), lrn: {}, fav: {}, trips: {}, tk: H.seedTasks(now, 4), tkSeed: true, mu: H.seedMuell(), muMig: true, wMig: true, tf: '0', set: { round: 4, names: ['Roman', 'Ayşe'], route: H.defaultRoute(), nkW: 4, nkN: '', nkOk: 0, m: now }, me: 0, tab: 'list', store: 'dis', sync: { url: '', code: '', fresh: false }, open: {} };
  }
  function load() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (r && r.set) {
        const d = H.cleanDoc({ v: 1, items: r.items, rec: r.rec, lrn: r.lrn, fav: r.fav, trips: r.trips, tk: r.tk, mu: r.mu, set: r.set });
        const s = fresh();
        s.items = d.items; s.rec = d.rec; s.lrn = d.lrn; s.fav = d.fav; s.trips = d.trips; s.tk = d.tk; s.set = d.set; s.mu = r.mu ? d.mu : H.seedMuell(); s.muMig = !!r.muMig; s.wMig = !!r.wMig;
        if (!s.wMig) { if (!s.items.iwsack01) s.items.iwsack01 = fresh().items.iwsack01; s.wMig = true; }
        if (!s.muMig) { ['Restmüll rausbringen', 'Biomüll rausbringen', 'Gelben Sack rausbringen', 'Papiertonne rausbringen'].forEach(n => { const id = H.taskId(n); if (s.tk[id] && !s.tk[id].x) s.tk[id] = { x: 1, m: Date.now() }; }); s.muMig = true; } s.tkSeed = !!r.tkSeed; s.tf = ['all', '0', '1'].includes(r.tf) ? r.tf : 'all';
        if (!r.bpMig) { Object.keys(s.rec).forEach(k => { const x = s.rec[k]; if (!x.x && H.KUECHE.includes(x.n.toLowerCase()) && x.s === 'dro') s.rec[k] = Object.assign({}, x, { s: 'dis', m: Date.now() }); }); } s.bpMig = true;
        if (!s.tkSeed) { s.tk = Object.assign(H.seedTasks(Date.now(), s.set.round), s.tk); s.tkSeed = true; }
        s.me = r.me === 1 ? 1 : 0; s.tf = String(s.me); s.tab = ['list', 'rec', 'tasks', 'hist', 'more'].includes(r.tab) ? r.tab : 'list'; s.store = H.SK.includes(r.store) ? r.store : 'dis';
        if (r.sync && normUrl(r.sync.url) && /^[a-z0-9]{8,32}$/.test(r.sync.code || '')) s.sync = { url: normUrl(r.sync.url), code: r.sync.code, fresh: !!r.sync.fresh };
        return s;
      }
    } catch (e) { /* neu starten */ }
    return fresh();
  }
  const URL_RE = /^https:\/\/[a-z0-9-]+(-default-rtdb)?(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)$/;
  function normUrl(u) { u = String(u || '').trim().replace(/\/+$/, '').toLowerCase(); return URL_RE.test(u) ? u : ''; }
  const doc = () => ({ v: 1, items: S.items, rec: S.rec, lrn: S.lrn, fav: S.fav, trips: S.trips, tk: S.tk, mu: S.mu, set: S.set });
  function save(noSync) {
    try { localStorage.setItem(KEY, JSON.stringify({ items: S.items, rec: S.rec, lrn: S.lrn, fav: S.fav, trips: S.trips, tk: S.tk, mu: S.mu, muMig: S.muMig, wMig: S.wMig, bpMig: true, tkSeed: S.tkSeed, tf: S.tf, set: S.set, me: S.me, tab: S.tab, store: S.store, sync: S.sync })); } catch (e) { /* egal */ }
    if (!noSync) schedSync();
  }
  S = load();
  let sheet = null, ss = { state: '', msg: '' }, toastT = null;

  /* ---------- Zugriffe ---------- */
  const names = () => S.set.names;
  const items = () => Object.keys(S.items).filter(k => !S.items[k].x).map(k => Object.assign({ id: k }, S.items[k]));
  const recs = () => Object.keys(S.rec).filter(k => !S.rec[k].x).map(k => Object.assign({ id: k }, S.rec[k]));
  const onList = rid => items().some(i => !i.d && i.r === rid);
  const byName = (a, b) => a.n.localeCompare(b.n, 'de');
  function putItem(id, o) { S.items[id] = Object.assign({}, S.items[id] || {}, o, { m: Date.now() }); }
  function putRec(id, o) { S.rec[id] = Object.assign({}, S.rec[id] || {}, o, { m: Date.now() }); }
  const kill = (map, id) => { map[id] = { x: 1, m: Date.now() }; };
  function killUndo(map, id, msg) {
    const snap = map[id]; kill(map, id); sheet = null; save(); render();
    toast(msg, () => { map[id] = Object.assign({}, snap, { m: Date.now() }); save(); render(); });
  }
  const nkOpen = () => items().filter(i => !i.d && i.r);

  /* ---------- Aktionen ---------- */
  function toast(msg, undo) {
    clearTimeout(toastT);
    const el = $('toast'); if (!el) return;
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" data-act="undo">Rückgängig</button>' : '');
    el.hidden = false; toast.undo = undo || null;
    toastT = setTimeout(() => { el.hidden = true; toast.undo = null; }, undo ? 6000 : 3200);
  }
  function addItem(text, forced) {
    const n = String(text || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!n) return;
    const dup = items().find(i => !i.d && i.n.toLowerCase() === n.toLowerCase());
    if (dup) { toast('„' + dup.n + '“ steht schon auf der Liste (' + H.SNAME[dup.s] + ')'); return; }
    const fv = H.own(S.fav, n.toLowerCase().slice(0, 60));
    const g = forced ? { c: forced.c, s: forced.s } : fv && !fv.x ? { c: fv.c, s: fv.s } : H.guess(n, S.lrn), s = g.s || H.guessStore(g.c, S.store);
    const rc = recs().find(r => r.n.toLowerCase() === n.toLowerCase());
    putItem(H.uid(), { n, s, c: g.c, q: '', b: S.me, d: 0, r: rc ? rc.id : '' });
    if (s !== S.store) toast('„' + n + '“ → ' + H.SNAME[s] + ' · ' + H.CNAME[g.c]);
    save(); render();
  }
  function toggle(id) {
    const it = S.items[id]; if (!it || it.x) return;
    const now = !it.d;
    putItem(id, { d: now ? 1 : 0 });
    favBump(it, now ? 1 : -1);
    if (now && it.r && S.rec[it.r] && !S.rec[it.r].x) {
      const prev = S.rec[it.r].l, rid = it.r, r = S.rec[rid];
      putRec(rid, { l: H.today() });
      toast(r.n + ' gekauft', () => { putItem(id, { d: 0 }); favBump(S.items[id], -1); putRec(rid, { l: prev }); save(); render(); });
    }
    save(); render();
  }
  function closeTrip(st) {
    const done = items().filter(i => i.d && i.s === st); if (!done.length) return;
    const id = H.uid(), ids = done.map(i => i.id), snap = ids.map(k => Object.assign({}, S.items[k]));
    S.trips[id] = { s: st, t: Date.now(), b: S.me, n: done.length, it: done.map(i => i.n).slice(0, 80), m: Date.now() };
    ids.forEach(k => kill(S.items, k));
    const left = items().filter(i => !i.d && i.s === st).length;
    save(); render();
    toast('Einkauf gespeichert · ' + done.length + ' Artikel' + (left ? ', ' + left + ' noch offen' : ''), () => { kill(S.trips, id); ids.forEach((k, j) => { S.items[k] = Object.assign({}, snap[j], { m: Date.now() }); }); save(); render(); });
  }
  /* Vergessenes Abhaken: Erledigtes, das älter als 2 Tage ist, wird als Einkauf verbucht (Zeitpunkt = letztes Abhaken). */
  function autoClose() {
    const lim = Date.now() - 2 * H.DAY, old = items().filter(i => i.d && i.m < lim); if (!old.length) return false;
    H.SK.forEach(st => {
      const g = old.filter(i => i.s === st); if (!g.length) return;
      S.trips[H.uid()] = { s: st, t: Math.max.apply(null, g.map(i => i.m)), b: S.me, n: g.length, it: g.map(i => i.n).slice(0, 80), m: Date.now() };
      g.forEach(i => kill(S.items, i.id));
    });
    return true;
  }
  /* ---------- Aufgaben ---------- */
  const tasks = () => Object.keys(S.tk).filter(k => !S.tk[k].x).map(k => Object.assign({ id: k }, S.tk[k]));
  const putTk = (id, o) => { S.tk[id] = Object.assign({}, S.tk[id] || {}, o, { m: Date.now() }); };
  const whoTask = t => t.w === 2 ? (t.lw === 0 ? 1 : 0) : t.w;
  function withInfo(t) { const nx = H.nextDue(t, S.set.round); return Object.assign(t, { next: nx, left: nx ? H.diffDays(nx, H.today()) : null }); }
  const fmtMin = m => { m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + ' Std ' + (m % 60 ? (m % 60) + ' Min' : '') : m + ' Min'; };
  function doneTask(id) {
    const t = S.tk[id]; if (!t || t.x) return;
    const snap = JSON.parse(JSON.stringify(S.tk)), foll = tasks().filter(x => x.af === id);
    putTk(id, { l: H.today(), lw: S.me, t: '' });
    foll.forEach(x => putTk(x.id, { t: H.today() }));
    save(); render();
    toast(t.n + ' erledigt' + (foll.length ? ' · als Nächstes: ' + foll.map(x => x.n).slice(0, 2).join(', ') : ''), () => { Object.keys(snap).forEach(k => { S.tk[k] = Object.assign({}, snap[k], { m: Date.now() }); }); save(); render(); });
  }
  /* Müll: Tonnen, die heute oder morgen abgeholt werden und noch nicht abgehakt sind */
  const mus = () => Object.keys(S.mu).filter(k => !S.mu[k].x).map(k => Object.assign({ id: k }, S.mu[k])).sort((a, b) => a.n.localeCompare(b.n, 'de'));
  function muPending() {
    const t0 = H.today();
    return mus().filter(r => r.a).map(r => { const d = H.muNext(r, t0); return Object.assign({}, r, { next: d, left: d ? H.diffDays(d, t0) : 99 }); }).filter(r => r.left <= 1 && r.dn !== r.next);
  }
  const muDay = d => H.fmtDay(H.toDate(d).getTime());
  function muRow(r) {
    return '<div class="li"><button type="button" class="chk" data-act="mdone" data-id="' + r.id + '" aria-label="' + esc(r.n) + ' rausgestellt"><span class="box"></span></button><div class="lt"><b>' + esc(r.n) + ' rausstellen</b><small' + (r.left === 0 ? ' class="warnt"' : '') + '>' + (r.left === 0 ? 'Abholung heute früh · ' : 'Abholung morgen früh · ') + muDay(r.next) + '</small></div></div>';
  }
  const taskDue = f => tasks().map(withInfo).filter(t => t.left !== null && t.left <= 0 && (f === 'all' || whoTask(t) === Number(f)));
  const tripsList = () => Object.keys(S.trips).filter(k => !S.trips[k].x).map(k => Object.assign({ id: k }, S.trips[k])).sort((a, b) => b.t - a.t);
  function favBump(it, delta) {
    const key = it.n.toLowerCase().slice(0, 60), old = H.own(S.fav, key);
    S.fav[key] = { n: it.n, c: it.c, s: it.s, k: Math.max(0, ((old && !old.x ? old.k : 0) || 0) + delta), m: Date.now() };
  }
  const openNames = () => new Set(items().filter(i => !i.d).map(i => i.n.toLowerCase().slice(0, 60)));
  function entryFor(key) { return H.known(S.fav).find(e => e.key === key); }
  function toList(rid) {
    const r = S.rec[rid]; if (!r || r.x || onList(rid)) return;
    putItem(H.uid(), { n: r.n, s: r.s, c: r.c, q: '', b: S.me, d: 0, r: rid });
  }
  /* Nachkauf-Tag: alles, was bis zur nächsten Runde nicht reicht, kommt von selbst auf die Liste. */
  function nkTick() {
    if (!S.set.nkOk || typing()) return false;
    const t0 = H.today(), a = H.nkAdvance(S.set.nkN, S.set.nkW, t0); if (!a.run) return false;
    let n = 0;
    H.nkPick(recs(), a.run, S.set.nkW).filter(r => !onList(r.id)).forEach(r => { const id = H.nkId(r.id, a.run); if (S.items[id]) return; const k = H.nkQty(r, S.set.nkW); putItem(id, { n: r.n, s: r.s, c: r.c, q: k > 1 ? k + ' Stück' : '', b: S.me, d: 0, r: r.id }); n++; });
    S.set = Object.assign({}, S.set, { nkN: a.next, m: Date.now() });
    save(); render();
    if (n) toast(n + ' Nachkauf-Artikel auf der Liste');
    return true;
  }
  /* Auswahl: eigene Artikel plus Vorschläge, die noch nicht dabei sind. Empfehlung = Abstand aus dem Vorschlag. */
  function nkRows() {
    const tips = {}, rows = {}, seen = new Set();
    Object.values(H.seed(0)).map(x => [x.n, x.s, x.c, x.e]).concat(H.CAT_REC.map(x => x.slice(0, 4))).forEach(x => { const k = x[0].toLowerCase(); if (!tips[k]) tips[k] = x; });
    recs().forEach(r => { const k = r.n.toLowerCase(); seen.add(k); rows[r.id] = { rid: r.id, n: r.n, s: r.s, c: r.c, e: r.e, e0: r.e, rc: tips[k] ? tips[k][3] : 0, on: true }; });
    Object.keys(tips).forEach((k, i) => { if (seen.has(k)) return; const x = tips[k], g = H.guess(x[0]).s; rows['c' + i] = { rid: '', n: x[0], s: H.KUECHE.includes(k) ? g : x[1], c: x[2], e: x[3], e0: x[3], rc: x[3], on: false }; });
    return rows;
  }
  function purgeDone(st) {
    let n = 0;
    items().forEach(i => { if (i.d && i.s === st) { kill(S.items, i.id); n++; } });
    return n;
  }

  /* ---------- Abgleich (Firebase Realtime Database über REST) ---------- */
  const syncOn = () => !!(S.sync.url && S.sync.code);
  function typing() { try { const a = document.activeElement; return !!a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && /^(text|number|date|search|url)$/.test(a.type || 'text'))); } catch (e) { return false; } }
  function setSs(state, msg) { ss = { state, msg }; const el = $('syncbox'); if (el && !typing()) el.innerHTML = syncBox(); }
  function jfetch(url, opt) {
    const c = typeof AbortController === 'function' ? new AbortController() : null, t = setTimeout(() => { if (c) c.abort(); }, 12000);
    return fetch(url, Object.assign({ signal: c ? c.signal : undefined, cache: 'no-store' }, opt)).then(r => {
      clearTimeout(t);
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Zugriff verweigert. Die Regeln in Firebase brauchen den Eintrag „haushalt“ (siehe oben).' : 'Serverfehler ' + r.status);
      return r.json();
    }, () => { clearTimeout(t); throw new Error('Keine Verbindung.'); });
  }
  let syncing = false, again = false, syncTimer = null;
  function schedSync() { if (!syncOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 1200); }
  async function syncNow() {
    if (!syncOn()) return;
    if (syncing) { again = true; return; }
    syncing = true; setSs('busy', 'Gleiche ab …');
    try {
      const ep = S.sync.url + '/haushalt/' + S.sync.code + '.json';
      const raw = await jfetch(ep);
      const remote = raw === null ? null : H.unpack(raw);
      if (raw !== null && !remote) throw new Error('Unbekanntes Datenformat unter diesem Code.');
      const local = doc();
      const result = !remote ? local : S.sync.fresh ? remote : H.merge(local, remote);
      if (!H.same(result, local)) {
        if (typing()) { again = true; syncing = false; setTimeout(syncNow, 4000); return; }
        S.items = result.items; S.rec = result.rec; S.lrn = result.lrn; S.fav = result.fav; S.trips = result.trips; S.tk = result.tk; S.mu = result.mu; S.set = result.set;
        render();
      }
      S.sync.fresh = false; save(true);
      if (!remote || !H.same(result, remote)) await jfetch(ep, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) });
      setSs('ok', 'Abgeglichen um ' + new Date().toTimeString().slice(0, 5));
      if (autoClose()) { save(); render(); }
    } catch (err) { setSs('err', err && err.message ? err.message : 'Abgleich fehlgeschlagen.'); }
    syncing = false;
    nkTick();
    if (again) { again = false; schedSync(); }
  }
  setInterval(() => { try { if (document.visibilityState !== 'hidden') syncNow(); } catch (e) { /* egal */ } }, 20000);
  document.addEventListener('visibilitychange', () => { try { if (document.visibilityState === 'visible') { syncNow(); if (!syncOn()) nkTick(); render(); } } catch (e) { /* egal */ } });
  const b64e = o => { const s = btoa(unescape(encodeURIComponent(JSON.stringify(o)))); return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const b64d = t => { try { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return JSON.parse(decodeURIComponent(escape(atob(t)))); } catch (e) { return null; } };
  function inviteLink() { return location.href.split('#')[0] + '#j=' + b64e({ u: S.sync.url, c: S.sync.code }); }
  function checkHash() {
    let h = ''; try { h = location.hash; } catch (e) { return; }
    const m = /^#j=([A-Za-z0-9_-]+)$/.exec(h); if (!m) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* egal */ }
    const d = b64d(m[1]);
    if (d && normUrl(d.u) && /^[a-z0-9]{8,32}$/.test(d.c || '')) { sheet = { t: 'join', u: normUrl(d.u), c: d.c }; S.tab = 'more'; }
  }
  function newCode() { const cs = 'abcdefghijkmnpqrstuvwxyz23456789'; let o = ''; try { const a = new Uint8Array(14); crypto.getRandomValues(a); a.forEach(x => { o += cs[x % cs.length]; }); } catch (e) { for (let i = 0; i < 14; i++) o += cs[Math.floor(Math.random() * cs.length)]; } return o; }
  function vorkochUrl() { try { const v = JSON.parse(localStorage.getItem('vorkoch.v1') || 'null'); return v && v.sync && normUrl(v.sync.url) || ''; } catch (e) { return ''; } }

  /* ---------- Ansichten ---------- */
  function storeSeg() {
    const open = items().filter(i => !i.d);
    return '<div class="seg" role="group" aria-label="Laden">' + H.STORES.map(([k, l]) => '<button type="button" data-act="store" data-s="' + k + '" aria-pressed="' + (S.store === k) + '">' + esc(l) + '<i>' + open.filter(i => i.s === k).length + '</i></button>').join('') + '</div>';
  }
  function itemRow(i) {
    const sub = [i.q, i.b !== S.me && !i.r ? 'von ' + names()[i.b] : '', i.r ? 'Nachkauf' : ''].filter(Boolean).join(' · ');
    return '<div class="li' + (i.d ? ' done' : '') + '"><button type="button" class="chk" data-act="tog" data-id="' + i.id + '" aria-label="' + esc(i.n) + (i.d ? ' wieder auf die Liste' : ' abhaken') + '"><span class="box"></span></button>' +
      '<button type="button" class="lt" data-act="edit" data-id="' + i.id + '"><b>' + esc(i.n) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button></div>';
  }
  const subText = (all, open) => open.length ? open.length + ' offen, ' + all.filter(i => i.d).length + ' erledigt' : 'Nichts offen';
  function viewList() {
    const all = items(), open = all.filter(i => !i.d), st = S.store;
    let h = '<h1 class="ltitle">Einkaufsliste</h1><p class="lsub" id="lsub">' + subText(all, open) + '</p>';
    h += '<form class="addf" data-form="add" autocomplete="off"><input type="text" id="addin" placeholder="Was wird gebraucht?" aria-label="Neuer Artikel" enterkeyhint="done" autocapitalize="sentences" autocorrect="off" spellcheck="false"><button class="btn" type="submit" aria-label="Hinzufügen">+</button></form><div id="sugg" class="chips" hidden></div>';
    return h + '<div id="lbody">' + listBody(all, open, st) + '</div>';
  }
  function listBody(all, open, st) {
    let h = storeSeg();
    const mine = open.filter(i => i.s === st);
    if (!mine.length) h += '<div class="empty">Hier ist nichts offen.</div>';
    S.set.route[st].forEach(c => {
      const l = mine.filter(i => i.c === c).sort(byName);
      if (l.length) h += '<p class="cap">' + esc(H.CNAME[c]) + '</p><div class="grp">' + l.map(itemRow).join('') + '</div>';
    });
    const done = all.filter(i => i.d && i.s === st).sort(byName);
    if (done.length) h += '<p class="cap">Erledigt · ' + done.length + '</p><div class="grp">' + done.map(itemRow).join('') + '</div><div class="actions" style="margin-bottom:6px"><button type="button" class="btn" data-act="finish">Einkauf abschließen · ' + done.length + '</button></div><p class="foot" style="margin-top:0"><button type="button" class="lnk" data-act="clear" style="padding:0;min-height:0;font-size:13px">Nur entfernen, ohne Verlauf</button></p>';
    return h;
  }
  const recRow = (r, sub) => '<div class="li padl"><button type="button" class="lt" data-act="redit" data-id="' + r.id + '"><b>' + esc(r.n) + '</b><small>' + esc(sub) + '</small></button></div>';
  const taskWho = t => t.w === 2 ? 'dran: ' + names()[whoTask(t)] : names()[t.w];
  function taskRow(t) {
    const who = S.tf !== 'all' ? '' : taskWho(t);
    const pred = t.af && S.tk[t.af] && !S.tk[t.af].x ? S.tk[t.af].n : '';
    const st = t.left === null ? (t.p ? 'pausiert' : pred ? 'wartet auf „' + pred + '“' : '') : t.left < 0 ? (t.left === -1 ? 'seit gestern fällig' : 'seit ' + (-t.left) + ' Tagen fällig') : pred && t.left === 0 ? 'nach „' + pred + '“' : '';
    const sub = [who, t.min ? t.min + ' Min' : '', st].filter(Boolean).join(' · ');
    return '<div class="li"><button type="button" class="chk" data-act="tdone" data-id="' + t.id + '" aria-label="' + esc(t.n) + ' erledigt"><span class="box"></span></button><button type="button" class="lt" data-act="tedit" data-id="' + t.id + '"><b>' + esc(t.n) + '</b><small' + (t.left !== null && t.left < 0 ? ' class="warnt"' : '') + '>' + esc(sub) + '</small></button></div>';
  }
  function viewTasks() {
    const f = S.tf, all = tasks().map(withInfo), mine = t => f === 'all' || whoTask(t) === Number(f);
    const by = (a, b) => (a.left - b.left) || (H.ordIdx(a.n) - H.ordIdx(b.n)) || a.n.localeCompare(b.n, 'de');
    const heute = all.filter(t => t.left !== null && t.left <= 0 && mine(t)).sort(by);
    const woche = all.filter(t => t.left !== null && t.left > 0 && t.left <= 7 && mine(t)).sort(by);
    const rest = all.filter(t => t.p || t.left === null || t.left > 7).length;
    const sumMin = l => l.reduce((a, t) => a + (t.min || 0), 0);
    let h = '<h1 class="ltitle">Aufgaben</h1><p class="lsub">' + esc(H.fmtDay(Date.now())) + (heute.length ? ' · ' + heute.length + ' fällig, ca. ' + fmtMin(sumMin(heute)) : '') + '</p>';
    h += '<div class="seg" role="group" aria-label="Wessen Aufgaben">' + [['0', names()[0]], ['1', names()[1]], ['all', 'Alle']].map(([v, l]) => '<button type="button" data-act="tf" data-v="' + v + '" aria-pressed="' + (f === v) + '">' + esc(l) + '</button>').join('') + '</div>';
    const mp = muPending();
    if (mp.length) h += '<p class="cap">Müll</p><div class="grp">' + mp.map(muRow).join('') + '</div>';
    const nk = nkOpen().length;
    if (nk) h += '<p class="cap">Einkauf</p><div class="grp"><button type="button" class="row chev" data-act="tab" data-tab="list"><span class="grow"><b>Nachkauf einkaufen</b></span><span class="val">' + nk + ' Artikel</span></button></div>';
    if (all.some(t => t.chk)) h += '<div class="note due" style="margin-top:12px"><b>Müll-Termine prüfen</b><span>Abstand und Wochentag der Müllaufgaben sind Platzhalter. Gleicht sie mit eurem Müllkalender ab (Aufgabe antippen).</span><button type="button" class="btn sm" data-act="chkok">Passt so</button></div>';
    if (heute.length) h += '<p class="cap">Heute</p><div class="grp">' + heute.map(taskRow).join('') + '</div>';
    else h += '<div class="empty">Heute ist nichts fällig.</div>';
    if (woche.length) {
      const op = !!S.open.week;
      h += '<div class="grp" style="margin-top:16px"><button type="button" class="row chev" data-act="ropen" data-s="week" aria-expanded="' + op + '"><span class="grow"><b>Diese Woche</b></span><span class="val">' + woche.length + '</span></button></div>';
      if (op) {
        const days = []; woche.forEach(t => { if (!days.includes(t.next)) days.push(t.next); });
        days.forEach(d => {
          const g = woche.filter(t => t.next === d), rnd = H.toDate(d).getDay() === S.set.round && g.length > 2;
          h += '<p class="cap">' + esc(H.fmtDay(H.toDate(d).getTime())) + (rnd ? ' · Haushaltsrunde' : '') + '</p><div class="grp">' + g.map(taskRow).join('') + '</div>';
        });
      }
    }
    h += '<div class="actions"><button type="button" class="btn gray" data-act="tnew">Neue Aufgabe</button><button type="button" class="btn gray" data-act="tmore">Weitere Aufgaben · ' + rest + '</button></div>';
    return h;
  }
  function viewHist() {
    const ts = tripsList();
    let h = '<button type="button" class="lnk" data-act="tab" data-tab="more">‹ Mehr</button><h1 class="ltitle">Verlauf</h1>';
    if (!ts.length) return h + '<div class="empty">Noch kein Einkauf abgeschlossen.</div>';
    const keys = []; ts.forEach(x => { const m = H.monday(x.t); if (!keys.includes(m)) keys.push(m); });
    keys.slice(0, 12).forEach(m => {
      const g = ts.filter(x => H.monday(x.t) === m);
      h += '<p class="cap">' + H.fmtRange(m) + '</p><div class="grp">' + g.map(x =>
        '<div class="li padl"><button type="button" class="lt" data-act="tview" data-id="' + x.id + '"><b>' + esc(H.fmtDay(x.t)) + ' · ' + esc(H.SNAME[x.s]) + '</b><small>' + x.n + ' Artikel · ' + esc(names()[x.b]) + '</small></button></div>').join('') + '</div>';
    });
    return h;
  }
  function viewRec() {
    const t0 = H.today(), date = S.set.nkN || H.nkFirst(t0), w = S.set.nkW, left = H.diffDays(date, t0);
    const rs = recs().sort((a, b) => a.s.localeCompare(b.s) || byName(a, b)), live = rs.filter(r => !r.p), pause = rs.filter(r => r.p);
    const on = live.filter(r => onList(r.id)), free = live.filter(r => !onList(r.id));
    const now = free.filter(r => H.nkDue(r, date, w)), later = free.filter(r => !H.nkDue(r, date, w)).sort((a, b) => H.nkNext(a, date, w).localeCompare(H.nkNext(b, date, w)) || byName(a, b));
    let h = '<h1 class="ltitle">Nachkauf</h1>';
    h += '<div class="grp" style="margin-top:12px"><div class="frow"><label for="nk_d">Nächster Nachkauf-Tag</label><input type="date" id="nk_d" value="' + esc(date) + '" min="' + t0 + '"></div></div>';
    h += '<p class="foot">' + esc(H.fmtDay(H.toDate(date).getTime())) + ', ' + (left === 0 ? 'heute' : left === 1 ? 'morgen' : 'in ' + left + ' Tagen') + '. Dann steht alles von selbst auf der Liste.</p>';
    if (!S.set.nkOk) h = h.replace('Dann steht alles von selbst auf der Liste.', 'Der Termin zählt, sobald deine Auswahl steht.');
    h += '<div class="seg" role="group" aria-label="Abstand der Nachkauf-Tage">' + H.NK_W.map(v => '<button type="button" data-act="nkw" data-v="' + v + '" aria-pressed="' + (w === v) + '">' + v + ' Wochen</button>').join('') + '</div>';
    const sec = (t, l, f) => l.length ? '<p class="cap">' + t + ' · ' + l.length + '</p><div class="grp">' + l.map(r => recRow(r, f(r))).join('') + '</div>' : '';
    if (!S.set.nkOk) return h + '<div class="empty">Wähle zuerst aus, was du kaufst und wie oft. Bis dahin kommt nichts von selbst auf die Liste.</div><div class="actions"><button type="button" class="btn" data-act="nkpick">Artikel auswählen</button></div>';
    h += sec('Auf der Liste', on, r => H.SNAME[r.s]) + sec('Kommt am Nachkauf-Tag', now, r => H.SNAME[r.s]);
    if (!on.length && !now.length && rs.length) h += '<div class="empty">Beim nächsten Nachkauf-Tag ist nichts dran.</div>';
    const rest = later.length + pause.length;
    if (rest) {
      const op = !!S.open.recmore;
      h += '<div class="grp" style="margin-top:16px"><button type="button" class="row chev" data-act="ropen" data-s="recmore" aria-expanded="' + op + '"><span class="grow"><b>Später</b></span><span class="val">' + rest + '</span></button></div>';
      if (op) h += sec('Spätere Nachkauf-Tage', later, r => esc(H.fmtDay(H.toDate(H.nkNext(r, date, w)).getTime())) + ' · ' + H.SNAME[r.s]) + sec('Pausiert', pause, r => H.SNAME[r.s]);
    }
    if (!rs.length) h += '<div class="empty">Noch keine Artikel.</div>';
    h += '<div class="actions"><button type="button" class="btn gray" data-act="nkpick">Artikel auswählen</button><button type="button" class="btn gray" data-act="rnew">Neuer Artikel</button><button type="button" class="btn gray" data-act="plan">Übersicht</button></div>';
    return h;
  }
  function syncBox() {
    if (!syncOn()) {
      const pre = vorkochUrl();
      return '<ol class="mini"><li>Firebase öffnen (dasselbe Projekt wie bei Vorkoch), Realtime Database, Reiter „Regeln“.</li><li>Dort diese Regeln einfügen und veröffentlichen: <code>{ "rules": { "vorkoch": { "$code": { ".read": true, ".write": true } }, "haushalt": { "$code": { ".read": true, ".write": true } } } }</code></li><li>Die Datenbank-Adresse hier eintragen (dieselbe wie bei Vorkoch).</li></ol>' +
        '<div class="flex" style="margin-top:12px"><input type="url" id="syncurl" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="https://…firebasedatabase.app" aria-label="Datenbank-Adresse" value="' + esc(pre) + '"><button type="button" class="btn sm" data-act="connect">Verbinden</button></div>' +
        (ss.state === 'err' ? '<p class="alert">' + esc(ss.msg) + '</p>' : '');
    }
    return '<p class="' + (ss.state === 'err' ? 'alert' : 'sub') + '" style="margin-bottom:10px">' + esc(ss.msg || 'Verbunden.') + '</p>' +
      '<div class="actions" style="margin:0"><button type="button" class="btn sm soft" data-act="syncnow">Jetzt abgleichen</button><button type="button" class="btn sm gray" data-act="unlink">Trennen</button></div>' +
      '<p class="foot" style="margin:12px 0 6px">Einladungslink für die andere Person. Einmal öffnen genügt.</p><div class="cp"><input type="text" id="invite" readonly value="' + esc(inviteLink()) + '" aria-label="Einladungslink"><button type="button" class="btn sm" data-act="copy">Kopieren</button></div>';
  }
  function viewMore() {
    const t0 = H.today(), ml = mus(), lastA = ml.filter(r => r.a).map(r => r.d[r.d.length - 1] || '').sort().pop() || '';
    const soonOut = !lastA || H.diffDays(lastA, t0) < 45, nx = ml.filter(r => r.a).map(r => Object.assign({}, r, { next: H.muNext(r, t0) })).filter(r => r.next).sort((a, b) => a.next.localeCompare(b.next))[0];
    let h = '<h1 class="ltitle">Mehr</h1>';
    h += '<div class="grp" style="margin-top:12px"><button type="button" class="row chev" data-act="wiki"><span class="grow"><b>Haushalt-Wissen</b><br><span class="sub">Wäsche, Putzen, Routinen</span></span></button>' +
      '<button type="button" class="row chev" data-act="mu"><span class="grow"><b>Müllkalender</b><br><span class="sub' + (soonOut ? ' warnt' : '') + '">' + (soonOut ? 'Läuft bald aus' : nx ? 'Nächste: ' + esc(nx.n) + ', ' + muDay(nx.next) : 'Keine Termine') + '</span></span></button>' +
      '<button type="button" class="row chev" data-act="tab" data-tab="hist"><span class="grow"><b>Verlauf</b><br><span class="sub">Abgeschlossene Einkäufe</span></span></button>' +
      '<a class="row chev" style="text-decoration:none;color:inherit" href="https://aiaccount42.github.io/vorkoch/" target="_blank" rel="noopener"><span class="grow"><b>Vorkoch</b><br><span class="sub">Essensplan und Meal-Prep</span></span></a></div>';
    const op = !!S.open.set;
    h += '<div class="grp" style="margin-top:16px"><button type="button" class="row chev" data-act="ropen" data-s="set" aria-expanded="' + op + '"><span class="grow"><b>Einstellungen</b><br><span class="sub' + (ss.state === 'err' ? ' warnt' : '') + '">' + (!syncOn() ? 'Abgleich nicht eingerichtet' : ss.state === 'err' ? 'Abgleich gestört' : 'Abgleich aktiv') + '</span></span></button></div>';
    if (op) {
      h += '<p class="cap">Wer bist du auf diesem Gerät?</p><div class="grp"><div class="pad"><div class="seg" role="group">' + names().map((n, i) => '<button type="button" data-act="me" data-i="' + i + '" aria-pressed="' + (S.me === i) + '">' + esc(n) + '</button>').join('') + '</div></div>' +
        names().map((n, i) => '<div class="frow"><label for="nm' + i + '">Name ' + (i + 1) + '</label><input type="text" id="nm' + i + '" data-name="' + i + '" value="' + esc(n) + '" maxlength="20" autocapitalize="words"></div>').join('') + '</div>';
      h += '<p class="cap">Haushaltsrunde</p><div class="grp"><div class="frow"><label for="roundsel">Tag der Runde</label><select id="roundsel">' + [1, 2, 3, 4, 5, 6, 0].map(i => '<option value="' + i + '"' + (S.set.round === i ? ' selected' : '') + '>' + H.WDL[i] + '</option>').join('') + '</select></div></div>';
      h += '<p class="cap">Abgleich zwischen den Geräten</p><div class="grp"><div class="pad" id="syncbox">' + syncBox() + '</div></div>';
      h += '<p class="cap">Laufweg im Laden</p>';
      H.STORES.forEach(([k, l, long]) => {
        const rop = !!S.open[k];
        h += '<div class="grp" style="margin-bottom:10px"><button type="button" class="row chev" data-act="ropen" data-s="' + k + '" aria-expanded="' + rop + '"><span class="grow"><b>' + esc(l) + '</b><br><span class="sub">' + esc(long) + '</span></span></button>';
        if (rop) {
          S.set.route[k].forEach((c, i, a) => { h += '<div class="rt"><span>' + (i + 1) + '. ' + esc(H.CNAME[c]) + '</span><button type="button" data-act="rup" data-s="' + k + '" data-i="' + i + '" aria-label="Nach oben"' + (i === 0 ? ' disabled' : '') + '>▲</button><button type="button" data-act="rdn" data-s="' + k + '" data-i="' + i + '" aria-label="Nach unten"' + (i === a.length - 1 ? ' disabled' : '') + '>▼</button></div>'; });
          h += '<div class="pad"><button type="button" class="btn gray sm" data-act="rreset" data-s="' + k + '">Standard wiederherstellen</button></div>';
        }
        h += '</div>';
      });
    }
    h += '<p class="foot" style="margin-top:18px">Haushalt · Version __VERSION__</p>';
    return h;
  }

  /* ---------- Dialoge ---------- */
  const catOpts = cur => H.CATS.map(([k, l]) => '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + esc(l) + '</option>').join('');
  const storeSegH = (cur, act) => '<div class="seg" role="group">' + H.STORES.map(([k, l]) => '<button type="button" data-act="' + act + '" data-s="' + k + '" aria-pressed="' + (cur === k) + '">' + esc(l) + '</button>').join('') + '</div>';
  const shell = (title, body, foot) => '<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="shd"><span class="grab"></span><h3>' + esc(title) + '</h3><button type="button" class="btn sm soft" data-act="done">Fertig</button></div><div class="shb">' + body + (foot || '') + '</div></div>';
  function sheetHtml() {
    if (!sheet) return '';
    if (sheet.t === 'item') {
      const d = sheet.d;
      return shell('Artikel', '<div class="grp"><div class="frow col"><input type="text" id="f_n" value="' + esc(d.n) + '" maxlength="80" aria-label="Name"></div><div class="frow col"><input type="text" id="f_q" value="' + esc(d.q) + '" maxlength="120" placeholder="Menge oder Notiz, zum Beispiel 2 Stück" aria-label="Notiz"></div></div>' +
        '<p class="cap">Laden</p>' + storeSegH(d.s, 'fs') + '<p class="cap">Abteilung</p><div class="grp"><div class="frow"><label for="f_c">Abteilung</label><select id="f_c">' + catOpts(d.c) + '</select></div></div>',
        '<div class="actions">' + (d.r ? '' : '<button type="button" class="btn soft" data-act="mkrec">Zu Nachkauf hinzufügen</button>') + '<button type="button" class="btn danger" data-act="idel">Löschen</button></div>');
    }
    if (sheet.t === 'rec') {
      const d = sheet.d;
      return shell(sheet.id ? 'Nachkauf-Artikel' : 'Neuer Nachkauf-Artikel', '<div class="grp"><div class="frow col"><input type="text" id="r_n" value="' + esc(d.n) + '" maxlength="60" placeholder="Name, zum Beispiel Toilettenpapier" aria-label="Name"></div></div>' +
        '<p class="cap">Laden</p>' + storeSegH(d.s, 'rs') + '<p class="cap">Abteilung und Abstand</p><div class="grp"><div class="frow"><label for="r_c">Abteilung</label><select id="r_c">' + catOpts(d.c) + '</select></div>' +
        '<div class="frow"><span class="lb">Alle</span><span class="two"><input type="number" id="r_k" inputmode="numeric" min="1" max="99" value="' + esc(d.k) + '" aria-label="Anzahl"><select id="r_u" aria-label="Einheit">' + [['1', 'Tage'], ['7', 'Wochen'], ['30', 'Monate']].map(([v, l]) => '<option value="' + v + '"' + (d.u === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></span></div>' +
        '<div class="frow"><label for="r_l">Zuletzt gekauft</label><input type="date" id="r_l" value="' + esc(d.l) + '" max="' + H.today() + '"></div>' +
        '<div class="frow"><span class="lb">Pausiert</span><label class="sw"><input type="checkbox" id="r_p"' + (d.p ? ' checked' : '') + ' aria-label="Pausiert"><i></i></label></div></div>' +
        '<p class="foot">Er kommt am Nachkauf-Tag auf die Liste, wenn er bis zum nächsten nicht mehr reicht. Pausiert heißt: Er kommt nicht von selbst.</p>',
        '<div class="actions">' + (sheet.id ? (onList(sheet.id) ? '' : '<button type="button" class="btn soft" data-act="rlist">Jetzt auf die Liste</button>') + '<button type="button" class="btn soft" data-act="rbought">Gerade gekauft</button><button type="button" class="btn danger" data-act="rdel">Löschen</button>' : '') + '</div>');
    }
    if (sheet.t === 'nkpick') {
      const rows = sheet.d.rows, keys = Object.keys(rows), n = keys.filter(k => rows[k].on).length;
      const opts = r => Array.from(new Set([14, 21, 28, 42, 56, 84, 120, 180].concat(r.e, r.rc || []))).sort((a, b) => a - b).map(v => '<option value="' + v + '"' + (v === r.e ? ' selected' : '') + '>' + (v === r.rc ? '★ ' : '') + esc(H.everyText(v)) + '</option>').join('');
      const row = k => { const r = rows[k]; return '<div class="li nkr' + (r.on ? ' done pk' : '') + '"><button type="button" class="chk" data-act="nktog" data-k="' + esc(k) + '" aria-label="' + esc(r.n) + (r.on ? ' abwählen' : ' auswählen') + '"><span class="box"></span></button><button type="button" class="lt" data-act="nktog" data-k="' + esc(k) + '"><b>' + esc(r.n) + '</b></button>' + (r.on ? '<select data-nke="' + esc(k) + '" aria-label="Wie oft: ' + esc(r.n) + '">' + opts(r) + '</select>' : '') + '</div>'; };
      let b = '<div class="flex" style="justify-content:space-between;align-items:center;margin-bottom:6px"><span class="sub">' + n + ' von ' + keys.length + ' ausgewählt · ★ Empfehlung</span><button type="button" class="lnk" data-act="nkall">Alle abwählen</button></div>';
      H.STORES.forEach(([k, l]) => { const g = keys.filter(x => rows[x].s === k).sort((x, y) => rows[x].n.localeCompare(rows[y].n, 'de')); if (g.length) b += '<p class="cap">' + esc(l) + '</p><div class="grp">' + g.map(row).join('') + '</div>'; });
      return shell('Artikel auswählen', b, '<div class="actions"><button type="button" class="btn" data-act="done">' + (S.set.nkOk ? 'Übernehmen' : 'Übernehmen und starten') + '</button></div>');
    }
    if (sheet.t === 'tcard') {
      const t = S.tk[sheet.id]; if (!t || t.x) return '';
      const meta = [taskWho(t), t.min ? t.min + ' Min' : '', t.e ? H.everyText(t.e) : ''].filter(Boolean).join(' · '), tip = H.TIPS[t.n];
      return shell(t.n, '<p class="sub" style="margin-bottom:6px">' + esc(meta) + '</p>' +
        (t.q ? '<p class="cap">Gut genug, wenn</p><div class="note" style="margin-top:0">' + esc(t.q) + '</div>' : '') +
        (tip ? '<p class="cap">So geht es am schnellsten</p><div class="note" style="margin-top:0">' + esc(tip) + '</div>' : ''),
        '<div class="actions"><button type="button" class="btn" data-act="tcdone">Erledigt</button><button type="button" class="btn gray" data-act="tform">Bearbeiten</button></div>');
    }
    if (sheet.t === 'tmore') {
      const all = tasks().map(withInfo), by = (a, b) => (a.next || '').localeCompare(b.next || '') || a.n.localeCompare(b.n, 'de');
      const later = all.filter(t => !t.p && t.left !== null && t.left > 7).sort(by), wait = all.filter(t => !t.p && t.left === null).sort(by), pause = all.filter(t => t.p).sort(by);
      const row = (t, sub) => '<div class="li padl"><button type="button" class="lt" data-act="tedit" data-id="' + t.id + '"><b>' + esc(t.n) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button></div>';
      const sec = (title, l, f) => l.length ? '<p class="cap">' + title + '</p><div class="grp">' + l.map(t => row(t, f(t))).join('') + '</div>' : '';
      return shell('Weitere Aufgaben', sec('Später', later, t => H.fmtDay(H.toDate(t.next).getTime()) + ' · ' + H.everyText(t.e)) +
        sec('Folgt nach', wait, t => S.tk[t.af] && !S.tk[t.af].x ? S.tk[t.af].n : '') + sec('Pausiert', pause, () => ''),
        '<div class="actions"><button type="button" class="btn gray" data-act="cattk">Aus dem Katalog</button><button type="button" class="btn gray" data-act="plan">Übersicht</button></div>');
    }
    if (sheet.t === 'mu') {
      const t0 = H.today(), l = mus().map(r => Object.assign({}, r, { next: H.muNext(r, t0) })).sort((a, b) => (a.next || '9').localeCompare(b.next || '9'));
      return shell('Müllkalender', '<div class="grp">' + l.map(r => { const n = r.next ? H.diffDays(r.next, t0) : -1; return '<div class="li padl"><div class="lt"><b>' + esc(r.n) + '</b><small>' + (r.next ? muDay(r.next) + ' · ' + (n === 0 ? 'heute' : n === 1 ? 'morgen' : 'in ' + n + ' Tagen') : 'keine Termine') + (r.d.length ? ' · Termine bis ' + esc(r.d[r.d.length - 1].split('-').reverse().join('.')) : '') + '</small></div></div>'; }).join('') + '</div>' +
        '<p class="foot">Am Vorabend der Abholung erscheint die Tonne unter Aufgaben.</p>',
        '<div class="actions"><button type="button" class="btn gray" data-act="muimp">Kalender importieren (.ics)</button><input type="file" id="mufile" accept=".ics,text/calendar" hidden></div>');
    }
    if (sheet.t === 'task') {
      const d = sheet.d, others = tasks().filter(x => x.id !== sheet.id).sort((a, b) => a.n.localeCompare(b.n, 'de'));
      const wdOpts = [['-1', 'Beliebig'], ['-2', 'Haushaltsrunde (' + H.WDL[S.set.round] + ')'], ['1', 'Montag'], ['2', 'Dienstag'], ['3', 'Mittwoch'], ['4', 'Donnerstag'], ['5', 'Freitag'], ['6', 'Samstag'], ['0', 'Sonntag']];
      return shell(sheet.id ? 'Aufgabe' : 'Neue Aufgabe', '<div class="grp"><div class="frow col"><input type="text" id="t_n" value="' + esc(d.n) + '" maxlength="70" placeholder="Name, zum Beispiel Bad putzen" aria-label="Name"></div></div>' +
        '<p class="cap">Zuständig</p><div class="seg" role="group">' + [[0, names()[0]], [1, names()[1]], [2, 'Abwechselnd']].map(([v, l]) => '<button type="button" data-act="tw" data-v="' + v + '" aria-pressed="' + (d.w === v) + '">' + esc(l) + '</button>').join('') + '</div>' +
        '<p class="cap">Wann</p><div class="grp"><div class="frow"><label for="t_af">Kommt nach</label><select id="t_af"><option value="">Eigener Rhythmus</option>' + others.map(x => '<option value="' + x.id + '"' + (d.af === x.id ? ' selected' : '') + '>' + esc(x.n) + '</option>').join('') + '</select></div>' +
        (d.af ? '' : '<div class="frow"><span class="lb">Alle</span><span class="two"><input type="number" id="t_k" inputmode="numeric" min="1" max="99" value="' + esc(d.k) + '" aria-label="Anzahl"><select id="t_u" aria-label="Einheit">' + [['1', 'Tage'], ['7', 'Wochen'], ['30', 'Monate']].map(([v, l]) => '<option value="' + v + '"' + (d.u === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></span></div>' +
          '<div class="frow"><label for="t_d">Am</label><select id="t_d">' + wdOpts.map(([v, l]) => '<option value="' + v + '"' + (d.d === v ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></div>' +
          '<div class="frow"><label for="t_l">Zuletzt erledigt</label><input type="date" id="t_l" value="' + esc(d.l) + '" max="' + H.today() + '"></div>') + '</div>' +
        '<p class="foot">' + (d.af ? 'Wird fällig, sobald die andere Aufgabe erledigt ist.' : 'Feste Wochentage gelten bei Rhythmen in ganzen Wochen.') + '</p>' +
        '<p class="cap">Dauer und Standard</p><div class="grp"><div class="frow"><label for="t_m">Dauer in Minuten</label><input type="number" id="t_m" inputmode="numeric" min="0" max="240" value="' + esc(d.min) + '"></div><div class="frow col"><input type="text" id="t_q" value="' + esc(d.q) + '" maxlength="120" placeholder="Wann ist es gut genug? (Mindeststandard)" aria-label="Mindeststandard"></div>' +
        '<div class="frow"><span class="lb">Pausiert</span><label class="sw"><input type="checkbox" id="t_p"' + (d.p ? ' checked' : '') + ' aria-label="Pausiert"><i></i></label></div></div>',
        '<div class="actions">' + (sheet.id ? '<button type="button" class="btn soft" data-act="tnow">Jetzt erledigt</button><button type="button" class="btn danger" data-act="tdelt">Löschen</button>' : '') + '</div>');
    }
    if (sheet.t === 'cat') {
      const list = H.CAT_TK, have = new Set(tasks().map(x => x.n.toLowerCase()));
      return shell('Aufgaben-Katalog', '<p class="foot" style="margin:0 2px 10px">Richtwerte aus gängigen Empfehlungen. Nach dem Hinzufügen kannst du Rhythmus und Details ändern.</p><div class="grp">' + list.map((x, i) => {
        const n = x[0], e = x[1], why = x[3], has = have.has(n.toLowerCase());
        return '<div class="li padl"><div class="lt"><b>' + esc(n) + '</b><small>' + esc(H.everyText(e)) + (why ? ' · ' + esc(why) : '') + '</small></div>' + (has ? '<span class="sub" style="padding-right:14px">dabei</span>' : '<button type="button" class="btn sm soft" style="margin-right:12px" data-act="catadd" data-i="' + i + '">Hinzufügen</button>') + '</div>';
      }).join('') + '</div>', '');
    }
    if (sheet.t === 'plan') {
      const t0 = H.today(), who = i => i === 0 || i === 1 ? ' (' + names()[i] + ')' : '';
      const ts = tasks().map(withInfo).filter(t => t.e).sort((a, b) => (a.next || '9').localeCompare(b.next || '9') || a.n.localeCompare(b.n, 'de'));
      const rs = recs().filter(r => !r.p).map(r => Object.assign({}, r, { nx: H.nkNext(r, S.set.nkN || t0, S.set.nkW) })).sort((a, b) => a.nx.localeCompare(b.nx) || a.n.localeCompare(b.n, 'de'));
      const row = (n, sub) => '<div class="li padl"><div class="lt"><b>' + esc(n) + '</b><small>' + esc(sub) + '</small></div></div>';
      return shell('Übersicht', '<p class="cap" style="margin-top:0">Aufgaben · wann was dran ist</p><div class="grp">' + ts.map(t => row(t.n, H.everyText(t.e) + ' · zuletzt ' + muDay(t.l) + who(t.lw) + ' · nächstes ' + (t.next ? muDay(t.next) : '–'))).join('') + '</div>' +
        '<p class="cap">Nachkauf · wann was gekauft wird</p><div class="grp">' + rs.map(r => row(r.n, H.everyText(r.e) + ' · zuletzt gekauft ' + muDay(r.l) + ' · nächster Nachkauf ' + muDay(r.nx))).join('') + '</div>' +
        '<p class="foot">Sortiert nach dem nächsten Termin. Die App speichert nur das letzte Mal, keinen Langzeitverlauf.</p>', '');
    }
    if (sheet.t === 'wiki') {
      return shell('Haushalt-Wissen', H.WIKI.map((w, i) => { const op = !!S.open['w' + i]; return '<div class="grp" style="margin-bottom:10px"><button type="button" class="row chev" data-act="wtog" data-i="' + i + '" aria-expanded="' + op + '"><span class="grow"><b>' + esc(w[0]) + '</b></span></button>' + (op ? '<div class="pad"><ul style="margin:0;padding-left:18px;display:grid;gap:6px;font-size:14.5px;line-height:1.4">' + w[1].map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') + '</div>'; }).join(''), '');
    }
    if (sheet.t === 'trip') {
      const x = S.trips[sheet.id]; if (!x || x.x) return '';
      return shell('Einkauf', '<p class="sub" style="margin-bottom:10px">' + esc(H.fmtDay(x.t)) + ', ' + esc(H.fmtTime(x.t)) + ' · ' + esc(H.SNAME[x.s]) + ' · ' + esc(names()[x.b]) + '</p><div class="grp">' + (x.it.length ? x.it.map(n => '<div class="row"><span class="grow">' + esc(n) + '</span></div>').join('') : '<div class="pad sub">Keine Einzelheiten gespeichert.</div>') + '</div>' + (x.n > x.it.length ? '<p class="foot">Und ' + (x.n - x.it.length) + ' weitere.</p>' : ''),
        '<div class="actions"><button type="button" class="btn danger" data-act="tdel">Aus dem Verlauf löschen</button></div>');
    }
    if (sheet.t === 'pick') {
      const on = openNames(), st = S.store, ks = H.known(S.fav).filter(e => e.s === st);
      let b = '<p class="foot" style="margin:0 2px 10px">' + esc(H.STORES.find(x => x[0] === st)[2]) + '. Antippen setzt den Artikel auf die Liste, nochmal antippen nimmt ihn wieder runter.</p>';
      S.set.route[st].forEach(c => {
        const l = ks.filter(e => e.c === c).sort((a, b2) => a.n.localeCompare(b2.n, 'de'));
        if (l.length) b += '<p class="cap">' + esc(H.CNAME[c]) + '</p><div class="grp">' + l.map(e => '<div class="li' + (on.has(e.key) ? ' done pk' : '') + '"><button type="button" class="chk" data-act="ptog" data-k="' + esc(e.key) + '" aria-label="' + esc(e.n) + (on.has(e.key) ? ' von der Liste nehmen' : ' auf die Liste') + '"><span class="box"></span></button><button type="button" class="lt" data-act="ptog" data-k="' + esc(e.key) + '"><b>' + esc(e.n) + '</b></button></div>').join('') + '</div>';
      });
      if (!ks.length) b += '<div class="empty">Für diesen Laden gibt es noch keine Vorschläge. Was ihr hier kauft und abhakt, taucht danach hier auf.</div>';
      return shell('Artikel auswählen', b);
    }
    if (sheet.t === 'join') {
      return shell('Gemeinsame Liste', '<p class="sub" style="margin-bottom:14px">Dieses Gerät mit der gemeinsamen Liste verbinden? Was jetzt hier gespeichert ist, wird durch die gemeinsame Liste ersetzt.</p><div class="actions"><button type="button" class="btn" data-act="joinok">Verbinden</button><button type="button" class="btn gray" data-act="close">Abbrechen</button></div>');
    }
    return '';
  }
  function readSheet() {
    if (!sheet) return;
    const v = id => { const e = $(id); return e ? e.value : null; };
    const d = sheet.d;
    if (sheet.t === 'item') { if (v('f_n') !== null) d.n = v('f_n'); if (v('f_q') !== null) d.q = v('f_q'); if (v('f_c')) d.c = v('f_c'); }
    if (sheet.t === 'task') {
      if (v('t_n') !== null) d.n = v('t_n'); if (v('t_af') !== null) d.af = v('t_af'); if (v('t_k') !== null) d.k = v('t_k'); if (v('t_u')) d.u = v('t_u'); if (v('t_d') !== null) d.d = v('t_d'); if (v('t_l') !== null) d.l = v('t_l');
      if (v('t_m') !== null) d.min = v('t_m'); if (v('t_q') !== null) d.q = v('t_q'); const p = $('t_p'); if (p) d.p = p.checked;
    }
    if (sheet.t === 'rec') {
      if (v('r_n') !== null) d.n = v('r_n'); if (v('r_c')) d.c = v('r_c'); if (v('r_k') !== null) d.k = v('r_k'); if (v('r_u')) d.u = v('r_u'); if (v('r_l') !== null) d.l = v('r_l');
      const p = $('r_p'); if (p) d.p = p.checked;
    }
  }
  function saveSheet() {
    readSheet();
    if (!sheet) return true;
    const d = sheet.d;
    if (sheet.t === 'item') {
      const n = d.n.trim().replace(/\s+/g, ' ');
      if (!n) { toast('Bitte einen Namen eingeben.'); return false; }
      const old = S.items[sheet.id];
      if (old && !old.x) {
        putItem(sheet.id, { n, q: d.q.trim(), s: d.s, c: d.c });
        if (old.c !== d.c || old.s !== d.s) { S.lrn[n.toLowerCase().slice(0, 60)] = { c: d.c, s: d.s, m: Date.now() }; }
        if (S.store !== d.s && old.s !== d.s) S.store = d.s;
      }
    } else if (sheet.t === 'task') {
      const n = d.n.trim().replace(/\s+/g, ' ');
      if (!n) { toast('Bitte einen Namen eingeben.'); return false; }
      const id = sheet.id || H.uid();
      if (d.af) { let x = d.af, k = 0; while (x && k++ < 8) { if (x === id) { toast('Das wäre ein Kreis: Die andere Aufgabe kommt schon nach dieser.'); return false; } x = S.tk[x] && !S.tk[x].x ? S.tk[x].af : ''; } }
      const k = Math.max(1, Math.min(99, Math.round(Number(d.k)) || 1)), e = d.af ? 0 : Math.min(730, k * Number(d.u));
      const l = H.DATE_RE.test(d.l) && d.l <= H.today() ? d.l : H.today();
      const old = S.tk[id] && !S.tk[id].x ? S.tk[id] : null;
      putTk(id, { n, w: d.w, e, d: d.af ? -1 : Number(d.d), min: Math.max(0, Math.min(240, Math.round(Number(d.min)) || 0)), l, lw: old ? old.lw : -1, t: old ? old.t : '', af: d.af || '', q: d.q.trim(), p: d.p ? 1 : 0, chk: 0 });
    } else if (sheet.t === 'nkpick') {
      Object.keys(d.rows).forEach(k => {
        const r = d.rows[k], fresh = H.addDays(H.today(), -r.e);
        if (r.rid && !r.on) kill(S.rec, r.rid);
        else if (r.rid && !S.set.nkOk) putRec(r.rid, { e: r.e, l: fresh });
        else if (r.rid && r.e !== r.e0) putRec(r.rid, { e: r.e });
        else if (!r.rid && r.on) putRec(H.uid(), { n: r.n, s: r.s, c: r.c, e: r.e, l: fresh, p: 0 });
      });
      S.set = Object.assign({}, S.set, { nkOk: 1, nkN: S.set.nkN || H.nkFirst(H.today()), m: Date.now() });
      toast('Auswahl gespeichert');
    } else if (sheet.t === 'rec') {
      const n = d.n.trim().replace(/\s+/g, ' ');
      if (!n) { toast('Bitte einen Namen eingeben.'); return false; }
      const k = Math.max(1, Math.min(99, Math.round(Number(d.k)) || 1)), e = Math.min(730, k * Number(d.u));
      const l = H.DATE_RE.test(d.l) && d.l <= H.today() ? d.l : H.today();
      const rid = sheet.id || H.uid();
      putRec(rid, { n, s: d.s, c: d.c, e, l, p: d.p ? 1 : 0 });
      if (sheet.from && S.items[sheet.from] && !S.items[sheet.from].x) putItem(sheet.from, { r: rid });
    }
    return true;
  }
  /* Dialog verlassen, ohne „Fertig“: Änderungen bleiben erhalten, unberührte Einträge werden nicht neu gestempelt. */
  function leaveSheet() {
    if (!sheet) return true;
    readSheet();
    const edit = ['item', 'rec', 'task', 'nkpick'].includes(sheet.t);
    if (!edit || JSON.stringify(sheet.d) === sheet.o || (!sheet.id && sheet.t !== 'nkpick' && !sheet.d.n.trim())) { sheet = null; return true; }
    if (!saveSheet()) return false;
    sheet = null; save(); nkTick(); return true;
  }
  function taskDraft(id) {
    const t = S.tk[id], e = t.e || 7, u = e % 30 === 0 ? '30' : e % 7 === 0 ? '7' : '1';
    return { n: t.n, w: t.w, k: String(e / Number(u)), u, d: String(t.d), l: t.l, min: String(t.min), af: t.af || '', q: t.q || '', p: !!t.p };
  }
  function recDraft(id) {
    const r = S.rec[id], e = r.e;
    const u = e % 30 === 0 ? '30' : e % 7 === 0 ? '7' : '1';
    return { n: r.n, s: r.s, c: r.c, k: String(e / Number(u)), u, l: r.l, p: !!r.p };
  }

  /* ---------- Darstellung ---------- */
  function render() {
    readSheet();
    if (sheet && sheet.d && sheet.o === undefined) sheet.o = JSON.stringify(sheet.d);
    const main = $('main'), sc = window.scrollY;
    if (S.tab === 'list' && main.dataset.tab === 'list' && $('lbody')) {
      const all = items(), open = all.filter(i => !i.d);
      $('lbody').innerHTML = listBody(all, open, S.store); $('lsub').textContent = subText(all, open);
    } else {
      main.innerHTML = '<div class="view">' + (S.tab === 'list' ? viewList() : S.tab === 'rec' ? viewRec() : S.tab === 'tasks' ? viewTasks() : S.tab === 'hist' ? viewHist() : viewMore()) + '</div>';
      main.dataset.tab = S.tab;
    }
    const oldShb = $('sheetc').querySelector('.shb'), keepTop = oldShb && sheet && ['pick', 'nkpick'].includes(sheet.t) ? oldShb.scrollTop : 0;
    $('sheetc').innerHTML = sheetHtml();
    if (keepTop) { const nb = $('sheetc').querySelector('.shb'); if (nb) nb.scrollTop = keepTop; }
    document.body.classList.toggle('lock', !!sheet);
    updateTabs();
    if (!sheet) window.scrollTo(0, sc);
  }
  function updateTabs() {
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { if (b.dataset.tab === (S.tab === 'hist' ? 'more' : S.tab)) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const tn = taskDue(String(S.me)).length + muPending().length + (nkOpen().length ? 1 : 0), tb = $('tbadge');
    if (tb) { tb.hidden = !tn; tb.textContent = tn; }
  }

  /* ---------- Ereignisse ---------- */
  function act(a, t) {
    const id = t.dataset.id, st = t.dataset.s;
    if (a === 'tab') { if (!leaveSheet()) return; $('toast').hidden = true; S.tab = t.dataset.tab; save(true); render(); window.scrollTo(0, 0); return; }
    if (a === 'store') { S.store = st; save(true); render(); return; }
    if (a === 'tog') { toggle(id); return; }
    if (a === 'tdone') { doneTask(id); return; }
    if (a === 'tf') { S.tf = t.dataset.v; save(true); render(); return; }
    if (a === 'mdone') { const r = S.mu[id]; if (r && !r.x) { const nx = H.muNext(r, H.today()); S.mu[id] = Object.assign({}, r, { dn: nx, m: Date.now() }); save(); render(); toast(r.n + ' rausgestellt'); } return; }
    if (a === 'muimp') { const f = $('mufile'); if (f) f.click(); return; }
    if (a === 'chkok') { tasks().forEach(x => { if (x.chk) putTk(x.id, { chk: 0 }); }); save(); render(); return; }
    if (a === 'tedit') { if (!S.tk[id] || S.tk[id].x) return; sheet = { t: 'tcard', id, d: {} }; render(); return; }
    if (a === 'tform') { const tid = sheet.id; if (!S.tk[tid] || S.tk[tid].x) return; sheet = { t: 'task', id: tid, d: taskDraft(tid) }; render(); return; }
    if (a === 'tcdone') { const tid = sheet.id; sheet = null; doneTask(tid); return; }
    if (a === 'tmore') { sheet = { t: 'tmore', d: {} }; render(); return; }
    if (a === 'mu') { sheet = { t: 'mu', d: {} }; render(); return; }
    if (a === 'cattk') { sheet = { t: 'cat', k: 'tk', d: {} }; render(); return; }
    if (a === 'nkpick') { sheet = { t: 'nkpick', id: 'nk', d: { rows: nkRows() } }; render(); return; }
    if (a === 'nktog') { const r = sheet.d.rows[t.dataset.k]; if (r) { r.on = !r.on; render(); } return; }
    if (a === 'nkall') { Object.values(sheet.d.rows).forEach(r => { r.on = false; }); render(); return; }
    if (a === 'plan') { sheet = { t: 'plan', d: {} }; render(); return; }
    if (a === 'catadd') {
      const i = Number(t.dataset.i), sc = $('sheetc').querySelector('.shb'), top = sc ? sc.scrollTop : 0;
      { const x = H.CAT_TK[i]; if (x) putTk(H.uid(), { n: x[0], w: 2, e: x[1], d: -2, min: x[2], l: H.today(), lw: -1, t: '', af: '', q: '', p: 0, chk: 0 }); }
      save(); render(); const n = $('sheetc').querySelector('.shb'); if (n) n.scrollTop = top; return;
    }
    if (a === 'wiki') { sheet = { t: 'wiki', d: {} }; render(); return; }
    if (a === 'wtog') { const k = 'w' + t.dataset.i; S.open[k] = !S.open[k]; render(); return; }
    if (a === 'tnew') { sheet = { t: 'task', id: '', d: { n: '', w: 2, k: '1', u: '7', d: '-2', l: H.today(), min: '15', af: '', q: '', p: false } }; render(); return; }
    if (a === 'tw') { readSheet(); sheet.d.w = Number(t.dataset.v); render(); return; }
    if (a === 'tnow') { const sid = sheet.id; if (!saveSheet()) return; sheet = null; doneTask(sid); return; }
    if (a === 'tdelt') {
      const tid = sheet.id, snap = S.tk[tid], foll = tasks().filter(x => x.af === tid).map(x => [x.id, S.tk[x.id]]);
      kill(S.tk, tid); foll.forEach(([k]) => putTk(k, { af: '', e: 7, d: -2 })); sheet = null; save(); render();
      toast('Aufgabe gelöscht', () => { S.tk[tid] = Object.assign({}, snap, { m: Date.now() }); foll.forEach(([k, v]) => { S.tk[k] = Object.assign({}, v, { m: Date.now() }); }); save(); render(); });
      return;
    }
    if (a === 'finish') { closeTrip(S.store); return; }
    if (a === 'tview') { sheet = { t: 'trip', id }; render(); return; }
    if (a === 'tdel') { killUndo(S.trips, sheet.id, 'Einkauf gelöscht'); return; }
    if (a === 'pick') { const i = $('addin'); if (i) i.blur(); sheet = { t: 'pick' }; render(); return; }
    if (a === 'qadd' || a === 'sadd') { const e = entryFor(t.dataset.k); if (e) { addItem(e.n, { s: e.s, c: e.c }); if (a === 'sadd') { const i = $('addin'); if (i) { i.value = ''; i.focus(); } updateSugg(); } } return; }
    if (a === 'ptog') {
      const e = entryFor(t.dataset.k); if (!e) return;
      const ex = items().find(i => !i.d && i.n.toLowerCase().slice(0, 60) === e.key);
      if (ex) { kill(S.items, ex.id); save(); render(); } else addItem(e.n, { s: e.s, c: e.c });
      return;
    }
    if (a === 'undo') { if (toast.undo) { toast.undo(); toast.undo = null; $('toast').hidden = true; } return; }
    if (a === 'clear') { const n = purgeDone(S.store); if (n) toast(n + ' erledigte entfernt'); save(); render(); return; }
    if (a === 'rlist') { const rid = sheet.id; sheet = null; toList(rid); save(); render(); toast('Auf der Liste'); return; }
    if (a === 'nkw') { S.set = Object.assign({}, S.set, { nkW: Number(t.dataset.v), m: Date.now() }); save(); render(); return; }
    if (a === 'edit') { const it = S.items[id]; if (!it || it.x) return; sheet = { t: 'item', id, d: { n: it.n, q: it.q || '', s: it.s, c: it.c, r: it.r || '' } }; render(); return; }
    if (a === 'redit') { if (!S.rec[id] || S.rec[id].x) return; sheet = { t: 'rec', id, d: recDraft(id) }; render(); return; }
    if (a === 'rnew') { sheet = { t: 'rec', id: '', d: { n: '', s: S.store, c: 'sonst', k: '4', u: '7', l: H.today(), p: false } }; render(); return; }
    if (a === 'close') { if (leaveSheet()) render(); return; }
    if (a === 'done') { if (saveSheet()) { sheet = null; save(); render(); nkTick(); } return; }
    if (a === 'fs' || a === 'rs') { readSheet(); sheet.d.s = st; render(); return; }
    if (a === 'idel') { killUndo(S.items, sheet.id, 'Gelöscht'); return; }
    if (a === 'mkrec') {
      readSheet(); const d = sheet.d;
      if (!saveSheet()) return;
      sheet = { t: 'rec', id: '', d: { n: d.n.trim(), s: d.s, c: d.c, k: '4', u: '7', l: H.today(), p: false }, from: sheet.id };
      save(); render(); return;
    }
    if (a === 'rbought') { readSheet(); sheet.d.l = H.today(); if (saveSheet()) { sheet = null; save(); render(); toast('Als gekauft notiert'); } return; }
    if (a === 'rdel') { killUndo(S.rec, sheet.id, 'Artikel gelöscht'); return; }
    if (a === 'me') { S.me = Number(t.dataset.i) === 1 ? 1 : 0; S.tf = String(S.me); save(true); render(); return; }
    if (a === 'ropen') { S.open[st] = !S.open[st]; render(); return; }
    if (a === 'rup' || a === 'rdn') {
      const i = Number(t.dataset.i), r = S.set.route[st], j = a === 'rup' ? i - 1 : i + 1;
      if (j < 0 || j >= r.length) return;
      [r[i], r[j]] = [r[j], r[i]]; S.set.m = Date.now(); save(); render(); return;
    }
    if (a === 'rreset') { S.set.route[st] = H.defaultRoute()[st]; S.set.m = Date.now(); save(); render(); return; }
    if (a === 'connect') {
      const u = normUrl(($('syncurl') || {}).value);
      if (!u) { setSs('err', 'Das ist keine Firebase-Adresse. Sie endet auf firebasedatabase.app oder firebaseio.com.'); const el = $('syncbox'); if (el) el.innerHTML = syncBox(); return; }
      S.sync = { url: u, code: newCode(), fresh: false }; ss = { state: '', msg: '' }; save(true); render(); syncNow(); return;
    }
    if (a === 'joinok') { S.sync = { url: sheet.u, code: sheet.c, fresh: true }; sheet = null; ss = { state: '', msg: '' }; save(true); render(); syncNow(); return; }
    if (a === 'syncnow') { syncNow(); return; }
    if (a === 'unlink') { if (!window.confirm('Abgleich auf diesem Gerät trennen?')) return; S.sync = { url: '', code: '', fresh: false }; ss = { state: '', msg: '' }; save(true); render(); return; }
    if (a === 'copy') {
      const el = $('invite'); if (!el) return;
      const sel = () => { el.focus(); el.select(); try { el.setSelectionRange(0, 9999); } catch (e) { /* egal */ } };
      try { navigator.clipboard.writeText(el.value).then(() => toast('Link kopiert'), () => { sel(); toast('Link markiert, bitte kopieren'); }); } catch (e) { sel(); toast('Link markiert, bitte kopieren'); }
    }
  }
  document.addEventListener('click', e => {
    const t = e.target.closest ? e.target.closest('[data-act]') : null, i = $('addin');
    if (i && document.activeElement === i && !(e.target.closest && e.target.closest('.addf,#sugg'))) i.blur();
    if (t) { e.preventDefault(); act(t.dataset.act, t); }
    updateSugg();
  });
  function updateSugg() {
    const el = $('sugg'), i = $('addin'); if (!el) return;
    if (i && !i.value.trim()) {
      const on = openNames(), favs = Object.keys(S.fav).map(k => Object.assign({ key: k }, S.fav[k])).filter(f => !f.x && f.k > 0 && f.s === S.store && !on.has(f.key)).sort((a, b) => b.k - a.k || a.n.localeCompare(b.n, 'de')).slice(0, 8);
      el.hidden = document.activeElement !== i;
      el.innerHTML = favs.map(f => '<button type="button" class="chip q" data-act="sadd" data-k="' + esc(f.key) + '">+ ' + esc(f.n) + '</button>').join('') + '<button type="button" class="chip q alt" data-act="pick">Alle Artikel …</button>';
      return;
    }
    const l = i ? H.suggest(i.value, H.known(S.fav), openNames()) : [];
    el.hidden = !l.length;
    el.innerHTML = l.map(e => '<button type="button" class="chip q" data-act="sadd" data-k="' + esc(e.key) + '">' + esc(e.n) + '<span class="sm"> · ' + esc(H.SNAME[e.s]) + '</span></button>').join('');
  }
  document.addEventListener('input', e => { if (e.target && e.target.id === 'addin') updateSugg(); });
  document.addEventListener('focusin', e => { if (e.target && e.target.id === 'addin') updateSugg(); });
  document.addEventListener('submit', e => {
    const f = e.target;
    if (f && f.dataset && f.dataset.form === 'add') { e.preventDefault(); const i = $('addin'); const v = i ? i.value : ''; if (i) i.value = ''; addItem(v); updateSugg(); const n = $('addin'); if (n) { try { n.focus(); } catch (x) { /* egal */ } } }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t && t.id === 't_af' && sheet && sheet.t === 'task') { readSheet(); render(); return; }
    if (t && t.id === 'mufile') {
      const f = t.files && t.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { const n = H.muImport(S.mu, H.parseIcs(String(rd.result || '')), Date.now()); if (n) { save(); toast(n + ' Termine übernommen'); } else toast('Keine Termine in der Datei gefunden'); render(); };
      rd.onerror = () => toast('Datei konnte nicht gelesen werden');
      rd.readAsText(f); return;
    }
    if (t && t.dataset && t.dataset.nke != null && sheet && sheet.t === 'nkpick') { const r = sheet.d.rows[t.dataset.nke]; if (r) r.e = Number(t.value); return; }
    if (t && t.id === 'nk_d') {
      if (H.DATE_RE.test(t.value) && t.value >= H.today()) { S.set = Object.assign({}, S.set, { nkN: t.value, m: Date.now() }); save(); t.blur(); nkTick(); render(); }
      else render();
      return;
    }
    if (t && t.id === 'roundsel') { S.set.round = Number(t.value); S.set.m = Date.now(); save(); render(); return; }
    if (t && t.dataset && t.dataset.name != null) {
      const i = Number(t.dataset.name), v = String(t.value || '').trim().slice(0, 20);
      if (v && (i === 0 || i === 1)) { S.set.names = S.set.names.slice(); S.set.names[i] = v; S.set.m = Date.now(); save(); }
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet && leaveSheet()) render(); });

  checkHash();
  render();
  if (!syncOn() && autoClose()) { save(true); render(); }
  if (syncOn()) syncNow(); else nkTick();
  window.__HH = { get S() { return S; }, render, addItem, toggle, doc, syncNow };
})();
