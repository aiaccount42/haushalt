const H = require('./core.js'); let n = 0, bad = 0;
const eq = (a, b, m) => { n++; if (JSON.stringify(a) !== JSON.stringify(b)) { bad++; console.log('FEHLER', m, JSON.stringify(a), '!=', JSON.stringify(b)); } };
const g = x => H.guess(x).c;
eq(g('Klopapier'), 'papier', 'klopapier'); eq(g('Apfelsaft'), 'getraenke', 'apfelsaft'); eq(g('Milchschokolade'), 'suess', 'milchschokolade');
eq(g('Basmatireis'), 'vorrat', 'basmatireis'); eq(g('Eier'), 'kuehl', 'eier'); eq(g('Gummibärchen'), 'suess', 'gummi'); eq(g('Zahnpasta'), 'pflege', 'zahnpasta');
eq(g('Tomaten'), 'obst', 'tomaten'); eq(g('Tomatenmark'), 'vorrat', 'tomatenmark'); eq(g('Preiselbeeren'), 'obst', 'preisel'); eq(g('Hähnchenbrust'), 'fleisch', 'hähnchen');
eq(g('Spülmaschinentabs'), 'reinigung', 'tabs'); eq(g('Speiseeis'), 'tk', 'speiseeis'); eq(g('Zeug'), 'sonst', 'zeug'); eq(g(''), 'sonst', 'leer');
eq(H.guess('Zeug', { zeug: { c: 'tk', s: 'voll', m: 1 } }), { c: 'tk', s: 'voll' }, 'gelernt');
eq(H.guessStore('pflege', 'dis'), 'dro', 'store pflege'); eq(H.guessStore('papier', 'dis'), 'dro', 'papier');  eq(H.guessStore('obst', 'dro'), 'dis', 'obst in drogerie'); eq(H.guessStore('suess', 'voll'), 'voll', 'bleibt');
eq(H.addDays('2026-10-31', 1), '2026-11-01', 'addDays'); eq(H.diffDays('2026-11-01', '2026-10-22'), 10, 'diff');
eq(H.due({ l: '2026-10-01', e: 14 }, '2026-10-22'), { next: '2026-10-15', left: -7 }, 'due');
eq(H.everyText(28), 'alle 4 Wochen', 'wochen'); eq(H.everyText(60), 'alle 2 Monate', 'monate'); eq(H.everyText(10), 'alle 10 Tage', 'tage');
eq(H.leftText(-3), 'seit 3 Tagen fällig', 'lt'); eq(H.leftText(0), 'heute fällig', 'lt0'); eq(H.leftText(20), 'in 3 Wochen', 'lt20');
const sd = H.seed(Date.parse('2026-10-22T10:00:00')); eq(Object.keys(sd).length, 27, 'seed Anzahl');
const lefts = Object.values(sd).map(r => H.due(r, '2026-10-22').left); eq(lefts.some(x => x <= 0) && lefts.some(x => x > 14), true, 'seed gestreut ' + lefts.sort((a, b) => a - b).join(','));
// Abgleich
const now = 1e12, A = { items: { aaaa: { n: 'Milch', s: 'dis', c: 'kuehl', q: '', b: 0, d: 0, r: '', m: 10 } }, rec: {}, lrn: {}, set: { names: ['R', 'A'], route: H.defaultRoute(), m: 1 } };
const B = JSON.parse(JSON.stringify(A)); B.items.aaaa = Object.assign({}, B.items.aaaa, { d: 1, m: 20 }); B.items.bbbb = { n: 'Brot', s: 'dis', c: 'brot', q: '', b: 1, d: 0, r: '', m: 15 };
const M = H.merge(A, B, now); eq(M.items.aaaa.d, 1, 'neuer gewinnt'); eq(!!M.items.bbbb, true, 'neu dazu'); eq(H.same(M, H.merge(B, A, now)), true, 'kommutativ');
const T = H.merge({ items: { cccc: { x: 1, m: now - 50 * H.DAY } }, rec: {}, lrn: {}, set: A.set }, A, now); eq(!!T.items.cccc, false, 'alte Marke weg');
const T2 = H.merge({ items: { aaaa: { x: 1, m: 30 } }, rec: {}, lrn: {}, set: A.set }, B, 100); eq(T2.items.aaaa.x, 1, 'Löschung gewinnt');
eq(H.same(H.merge(M, M, now), M), true, 'idempotent');
// Prüfung
const C = H.cleanDoc({ v: 1, items: { 'x y': { n: 'a' }, ok12: { n: '<b>' + 'z'.repeat(200), s: 'zz', c: 'qq', m: 'x' } }, rec: { rrrr: { n: 'T', e: 99999, l: 'kaputt' } }, set: { names: [5, 'Ayşe'], route: { dis: ['obst', 'obst', 'zzz'] } } });
eq(Object.keys(C.items), ['ok12'], 'ungültige id raus'); eq(C.items.ok12.n.length, 80, 'kürzen'); eq(C.items.ok12.s, 'dis', 'store fix'); eq(C.rec.rrrr.e, 730, 'e max'); eq(H.DATE_RE.test(C.rec.rrrr.l), true, 'datum fix');
eq(C.set.route.dis.length, 12, 'route komplett'); eq(C.set.names[0], 'Roman', 'name default'); eq(H.cleanDoc({ v: 2 }), null, 'v2 abgelehnt'); eq(H.unpack({ v: 1 }).items, {}, 'leer ok');
const K = H.known({ milch: { n: 'Milch', c: 'kuehl', s: 'voll', k: 5, m: 1 }, zeug: { n: 'Zeugs', c: 'sonst', s: 'dis', k: 2, m: 1 } });
eq(K.find(e => e.key === 'milch').s, 'voll', 'fav hat Vorrang'); eq(K.some(e => e.key === 'zeugs'), false, 'key ist der Schlüssel'); eq(K.some(e => e.key === 'zeug'), true, 'fav sichtbar');
eq(K.filter(e => e.c === 'pflege').every(e => e.s === 'dro'), true, 'pflege in Drogerie');
eq(H.suggest('mil', K).map(e => e.n)[0], 'Milch', 'suggest vorn'); eq(H.suggest('mil', K, new Set(['milch'])).some(e => e.n === 'Milch'), false, 'skip'); eq(H.suggest('', K), [], 'leer');
eq(H.suggest('sch', K).length > 1, true, 'mehrere');
const F = H.merge({ items: {}, rec: {}, lrn: {}, fav: { a: { n: 'A', c: 'obst', s: 'dis', k: 1, m: 5 } }, set: A.set }, { items: {}, rec: {}, lrn: {}, fav: { a: { n: 'A', c: 'obst', s: 'dis', k: 3, m: 9 } }, set: A.set }, 100); eq(F.fav.a.k, 3, 'fav neuer gewinnt');
eq(H.cleanDoc({ v: 1, fav: { x: { n: 'Q', c: 'zz', s: 'zz', k: -4, m: 1 } } }).fav.x, { n: 'Q', c: 'sonst', s: 'dis', k: 0, m: 1 }, 'fav clean');
eq(H.monday(Date.parse('2026-10-22T10:00:00')), '2026-10-19', 'montag'); eq(H.monday(Date.parse('2026-10-25T23:30:00')), '2026-10-19', 'sonntag zählt zur Woche'); eq(H.monday(Date.parse('2026-10-26T00:10:00')), '2026-10-26', 'neuer Montag');
eq(H.kw('2026-10-19'), 43, 'kw43'); eq(H.kw('2026-12-28'), 53, 'kw53 2026'); eq(H.kw('2027-01-04'), 1, 'kw1 2027'); eq(H.kw('2026-01-05'), 2, 'kw2');
eq(H.fmtDay(Date.parse('2026-10-21T17:40:00')), 'Mi 21.10.', 'fmtDay'); eq(H.fmtRange('2026-10-19'), '19.10. bis 25.10.', 'range');
const TR = H.cleanDoc({ v: 1, trips: { tttt: { s: 'zz', t: 5, b: 3, n: 'x', it: ['a', 7, 'b'], m: 1 }, 'bad id': { s: 'dis' } } }).trips; eq(Object.keys(TR), ['tttt'], 'trip id'); eq(TR.tttt.it, ['a', 'b'], 'trip items'); eq(TR.tttt.n, 2, 'trip n'); eq(TR.tttt.s, 'dis', 'trip store');
eq(H.snapWd('2026-10-30', 4), '2026-10-29', 'snap Fr->Do'); eq(H.snapWd('2026-10-26', 4), '2026-10-29', 'snap Mo->Do'); eq(H.snapWd('2026-10-29', 4), '2026-10-29', 'snap gleich'); eq(H.snapWd('2026-11-01', 4), '2026-10-29', 'snap So->Do');
eq(H.nextDue({ e: 7, d: -2, l: '2026-10-23' }, 4), '2026-10-29', 'wöchentlich Runde'); eq(H.nextDue({ e: 1, d: -1, l: '2026-10-22' }, 4), '2026-10-23', 'täglich'); eq(H.nextDue({ e: 10, d: 4, l: '2026-10-01' }, 4), '2026-10-11', 'nicht wöchentlich: kein Snap');
eq(H.nextDue({ af: 'x', t: '', p: 0 }, 4), '', 'Folge nicht ausgelöst'); eq(H.nextDue({ af: 'x', t: '2026-10-22', p: 0 }, 4), '2026-10-22', 'Folge ausgelöst'); eq(H.nextDue({ e: 7, d: -1, l: '2026-10-01', p: 1 }, 4), '', 'pausiert');
const TS = H.seedTasks(Date.parse('2026-10-22T10:00:00'), 4); const tl = Object.keys(TS).map(k => Object.assign({ id: k }, TS[k]));
eq(tl.length, H.TSEED.length, 'Aufgaben-Seed'); eq(tl.filter(x => x.af).every(x => TS[x.af]), true, 'Ketten verweisen auf Aufgaben'); eq(H.cleanDoc({ v: 1, tk: TS }).tk[tl[0].id].n, tl[0].n, 'tk clean');
const wk = H.weekly(tl); eq(wk[0] > 60 && wk[1] > 60, true, 'Wochenminuten ' + wk.map(Math.round)); eq(Math.abs(wk[0] - wk[1]) < wk[0] * 0.25, true, 'Verteilung fair');
eq(H.weekly([{ id: 'a', e: 7, min: 70, w: 0, p: 0 }, { id: 'b', e: 0, min: 14, w: 1, af: 'a', p: 0 }]).map(Math.round), [70, 14], 'Folge im Rhythmus der Wurzel');
eq(H.cleanDoc({ v: 1, set: { round: 9 } }).set.round, 4, 'round default'); eq(H.cleanDoc({ v: 1, set: { round: 2 } }).set.round, 2, 'round ok');

/* ---- Müllkalender ---- */
{
  const fs = require('fs'), ics = fs.readdirSync(__dirname + '/ics').filter(f => f.endsWith('.ics'));
  const parsed = {}; ics.forEach(f => { const p = H.parseIcs(fs.readFileSync(__dirname + '/ics/' + f, 'utf8')); Object.keys(p).forEach(k => { parsed[k] = (parsed[k] || []).concat(p[k]); }); });
  Object.keys(parsed).forEach(k => parsed[k].sort());
  const sd = H.seedMuell();
  eq(Object.keys(parsed).length, 5, 'ICS: 5 Arten'); eq(Object.keys(sd).length, 5, 'Seed: 5 Arten');
  eq(JSON.stringify(sd.restabfall.d), JSON.stringify(parsed['Restabfall']), 'Seed = ICS Restabfall'); eq(sd.restabfall.d.length, 41, 'Restabfall 41'); eq(sd.schadstoffmobil.a, 0, 'Schadstoffmobil nur Info');
  eq(H.cleanDoc({ v: 1, mu: sd }).mu.gelbetonne.d.length, 20, 'cleanDoc mu');
  eq(H.cleanDoc({ v: 1, mu: { 'ab': { n: 'x', d: ['quatsch'] } } }).mu.ab, undefined, 'mu: ungültige ID raus');
  eq(H.muNext(sd.restabfall, '2026-10-20') >= '2026-10-20', true, 'muNext'); eq(H.muNext(sd.restabfall, '2030-01-01'), '', 'muNext leer');
  // Import ersetzt nur den Zeitraum der Datei
  const mu = H.seedMuell(); mu.restabfall.d.push('2025-01-07');
  const txt = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY;LANGUAGE=de:Restabfall\r\nDTSTART:20280104T050000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Sperrmüll\\, groß\r\nDTSTART;VALUE=DATE:20280110\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
  const n = H.muImport(mu, H.parseIcs(txt), 5); eq(n, 2, 'Import zählt'); eq(mu.restabfall.d.includes('2028-01-04') && mu.restabfall.d.includes('2027-12-20') && mu.restabfall.d.includes('2025-01-07'), true, 'Import behält Altes');
  const key = Object.keys(mu).find(k => mu[k].n.startsWith('Sperrm')); eq(!!key && mu[key].a === 0 && mu[key].d[0] === '2028-01-10', true, 'neue Art, Info');
  eq(H.merge({ mu: mu }, { mu: {} }, 10).mu.restabfall.m, 5, 'merge mu');
}
// Härtung
const P = H.cleanDoc(JSON.parse('{"v":1,"fav":{"__proto__":{"n":"x","m":1},"milch":{"n":"Milch","m":1}},"lrn":{"__proto__":{"c":"tk","m":1}}}'));
eq(Object.keys(P.fav), ['milch'], 'proto in fav raus'); eq(Object.getPrototypeOf(P.fav) === Object.prototype && Object.getPrototypeOf(P.lrn) === Object.prototype, true, 'prototyp unverändert');
eq(H.merge({ fav: { constructor: { n: 'K', m: 5 } }, set: {} }, { fav: {}, set: {} }, 10).fav.constructor.n, 'K', 'geerbter schlüssel stört merge nicht');
eq(H.guess('constructor', {}).c, 'sonst', 'geerbter schlüssel stört guess nicht'); eq(H.own({}, 'constructor'), undefined, 'own ignoriert geerbtes'); eq(H.own({ a: 1 }, 'a'), 1, 'own eigenes');
{ const m = {}; H.muImport(m, { 'Müll': ['2028-01-04'] }, 5); const id = Object.keys(m)[0]; eq(/^[a-z0-9]{4,24}$/.test(id), true, 'kurzer Name gibt gültige id'); eq(!!H.cleanDoc({ v: 1, mu: m }).mu[id], true, 'übersteht Prüfung'); }
console.log(n - bad, '/', n, 'ok'); process.exit(bad ? 1 : 0);
