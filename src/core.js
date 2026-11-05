/* Haushalt: Logik ohne Oberfläche (Daten, Abgleich, Fälligkeit, Kategorie-Vorschlag). */
(function (root) {
  'use strict';
  const CATS = [['obst', 'Obst & Gemüse'], ['brot', 'Brot & Backwaren'], ['kuehl', 'Milch, Käse & Kühlregal'], ['fleisch', 'Fleisch, Fisch & Wurst'], ['tk', 'Tiefkühl'],
    ['vorrat', 'Konserven & Trockenwaren'], ['suess', 'Süßes & Snacks'], ['getraenke', 'Getränke'], ['reinigung', 'Putzen & Waschen'], ['papier', 'Papier, Folien & Beutel'],
    ['pflege', 'Körper- & Zahnpflege'], ['sonst', 'Sonstiges']];
  const STORES = [['dis', 'Aldi/Lidl', 'Aldi oder Lidl'], ['voll', 'Marktkauf', 'Marktkauf oder Kaufland'], ['dro', 'Drogerie', 'dm oder Rossmann']];
  const CK = CATS.map(c => c[0]), SK = STORES.map(s => s[0]);
  const CNAME = {}; CATS.forEach(c => { CNAME[c[0]] = c[1]; });
  const SNAME = {}; STORES.forEach(s => { SNAME[s[0]] = s[1]; });

  /* Übliche Laufwege: Eingang zuerst, Kasse zuletzt. Jede Filiale ist anders, deshalb in der App änderbar. */
  const ROUTE = {
    dis: ['obst', 'brot', 'kuehl', 'fleisch', 'tk', 'vorrat', 'suess', 'getraenke', 'reinigung', 'papier', 'pflege', 'sonst'],
    voll: ['obst', 'brot', 'fleisch', 'kuehl', 'tk', 'vorrat', 'suess', 'getraenke', 'reinigung', 'papier', 'pflege', 'sonst'],
    dro: ['pflege', 'reinigung', 'papier', 'sonst', 'vorrat', 'suess', 'getraenke', 'kuehl', 'obst', 'brot', 'fleisch', 'tk']
  };
  const defaultRoute = () => ({ dis: ROUTE.dis.slice(), voll: ROUTE.voll.slice(), dro: ROUTE.dro.slice() });

  /* Stichworte für den Kategorie-Vorschlag. Im Deutschen steht das Grundwort am Ende (Apfelsaft -> Saft), das zählt am meisten. */
  const KW = {
    obst: 'apfel äpfel birne birnen banane bananen orange orangen mandarine clementine zitrone zitronen limette trauben beeren erdbeere erdbeeren himbeere himbeeren blaubeeren kiwi mango ananas melone avocado avocados tomate tomaten gurke gurken paprika zucchini karotte karotten möhre möhren kartoffel kartoffeln zwiebel zwiebeln knoblauch lauch porree salat spinat brokkoli blumenkohl kürbis pilze champignons ingwer petersilie basilikum koriander radieschen kohl rotkohl weißkohl pfirsich nektarine aubergine fenchel sellerie süßkartoffel süßkartoffeln kräuter gemüse obst rucola mais paprikas pflaume pflaumen kirschen schnittlauch dill minze rosenkohl spargel rhabarber feldsalat eisbergsalat kohlrabi chicoree',
    brot: 'brot brötchen toast baguette croissant brezel laugenbrezel kuchen laugen wrap wraps fladenbrot ciabatta knäckebrot semmel vollkornbrot toastbrot torte muffin',
    kuehl: 'milch joghurt skyr quark käse mozzarella feta halloumi parmesan butter margarine sahne schmand frischkäse eier ei hüttenkäse kefir pudding tofu hummus aufstrich gouda emmentaler camembert mascarpone ricotta kondensmilch buttermilch pesto teig nudelteig pizzateig blätterteig',
    fleisch: 'fleisch hähnchen hühnchen hack hackfleisch rind rindfleisch schwein schweinefleisch pute putenbrust lachs thunfisch fisch garnelen wurst schinken salami speck bacon aufschnitt bratwurst würstchen filet steak gulasch cabanossi leberwurst forelle',
    tk: 'tiefkühl tk eis speiseeis pizza pommes fischstäbchen rahmspinat eiswürfel beerenmischung',
    vorrat: 'nudeln spaghetti penne fusilli reis basmatireis linsen bohnen kichererbsen dose dosen mehl zucker salz pfeffer öl olivenöl rapsöl essig haferflocken müsli cornflakes couscous bulgur quinoa brühe gemüsebrühe tomatenmark passata sauce soße ketchup senf mayonnaise marmelade honig nutella erdnussbutter nüsse mandeln walnüsse rosinen backpulver hefe gewürz gewürze curry paprikapulver zimt vanille kaffee tee kakao kokosmilch sojasauce erbsen mais thunfischdose polenta maisstärke speisestärke semmelbrösel panko',
    suess: 'schokolade gummibärchen gummibären chips kekse keks riegel bonbons süßigkeiten salzstangen erdnüsse nüsschen lakritz kaugummi popcorn waffeln müsliriegel snack knabberzeug haribo schoko',
    getraenke: 'wasser mineralwasser sprudel saft apfelsaft orangensaft cola limo limonade bier wein sekt schorle tonic eistee energy getränk spezi fanta sprite apfelschorle',
    reinigung: 'spülmittel spülmaschinentabs tabs waschmittel weichspüler reiniger allzweckreiniger wc-reiniger toilettenreiniger putzmittel schwamm schwämme spültuch spültücher lappen geschirrspülsalz klarspüler entkalker glasreiniger scheuermilch waschpulver fleckentferner badreiniger bürste wischtuch',
    papier: 'toilettenpapier klopapier küchenrolle küchenrollen taschentücher alufolie backpapier frischhaltefolie gefrierbeutel müllbeutel müllsack mülltüten tüten servietten gefrierbeutel butterbrotpapier kerzen streichhölzer batterien glühbirne',
    pflege: 'zahnpasta zahnbürste zahnseide mundspülung duschgel shampoo seife handseife deo deodorant creme bodylotion lotion rasierer rasierschaum wattepads wattestäbchen haargel haarspray conditioner spülung sonnencreme tampons binden slipeinlagen pflaster tabletten vitamine feuchttücher gesichtscreme lippenpflege parfum nagellack'
  };
  const KWL = [];
  Object.keys(KW).forEach(c => KW[c].split(/\s+/).forEach(w => { if (w) KWL.push([w, c]); }));
  const SHORT = new Set(['ei', 'öl', 'tk', 'eis']);

  /* Vorschlag für die Kategorie. Gelerntes (frühere Korrekturen) hat Vorrang. */
  function guess(name, learn) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return { c: 'sonst', s: '' };
    if (learn && learn[n] && !learn[n].x) return { c: learn[n].c, s: learn[n].s || '' };
    const toks = n.split(/[^a-zäöüß-]+/).filter(Boolean);
    let best = null, bs = 0;
    toks.forEach(t => {
      KWL.forEach(([w, c]) => {
        let sc = 0;
        if (t === w) sc = 200 + w.length;
        else if (SHORT.has(w)) sc = 0;
        else if (t.endsWith(w) && w.length >= 4) sc = 100 + w.length;
        else if (t.startsWith(w) && w.length >= 5) sc = 10 + w.length;
        if (sc > bs) { bs = sc; best = c; }
      });
    });
    return { c: best || 'sonst', s: '' };
  }
  /* Ohne eigene Vorgabe landen Drogerie-Dinge in der Drogerie, sonst im gerade offenen Laden. */
  function guessStore(cat, cur) {
    if (cat === 'pflege' || cat === 'papier' || cat === 'reinigung') return 'dro';
    if (cur === 'dro' && ['obst', 'brot', 'kuehl', 'fleisch', 'tk'].includes(cat)) return 'dis';
    return cur;
  }

  /* ---- Datum ---- */
  const pad = n => (n < 10 ? '0' : '') + n;
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => iso(new Date());
  const DAY = 86400000;
  const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
  const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * DAY));
  const diffDays = (a, b) => Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY);
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  /* Wochen laufen Montag bis Sonntag (deutsche Kalenderwoche). */
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  function monday(ts) { const d = new Date(ts); d.setHours(12, 0, 0, 0); const k = (d.getDay() + 6) % 7; return iso(new Date(d.getTime() - k * DAY)); }
  function kw(mon) { const d = toDate(mon); d.setDate(d.getDate() + 3); const y = d.getFullYear(), j = new Date(y, 0, 4, 12); const m1 = new Date(j.getTime() - ((j.getDay() + 6) % 7) * DAY); return 1 + Math.round((d.getTime() - m1.getTime() - 3 * DAY) / (7 * DAY)); }
  const fmtDay = ts => { const d = new Date(ts); return WD[d.getDay()] + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.'; };
  const fmtTime = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const fmtRange = mon => { const a = toDate(mon), b = new Date(a.getTime() + 6 * DAY); return pad(a.getDate()) + '.' + pad(a.getMonth() + 1) + '. bis ' + pad(b.getDate()) + '.' + pad(b.getMonth() + 1) + '.'; };

  /* Fälligkeit eines Dauerartikels: left <= 0 heißt fällig. */
  function due(rec, t) {
    const next = addDays(rec.l, rec.e);
    return { next, left: diffDays(next, t || today()) };
  }
  function everyText(e) {
    if (e % 30 === 0 && e >= 30) { const m = e / 30; return m === 1 ? 'jeden Monat' : 'alle ' + m + ' Monate'; }
    if (e % 7 === 0) { const w = e / 7; return w === 1 ? 'jede Woche' : 'alle ' + w + ' Wochen'; }
    return e === 1 ? 'jeden Tag' : 'alle ' + e + ' Tage';
  }
  function leftText(l) {
    if (l < 0) return (l === -1 ? 'seit gestern' : 'seit ' + (-l) + ' Tagen') + ' fällig';
    if (l === 0) return 'heute fällig';
    if (l === 1) return 'morgen fällig';
    if (l < 14) return 'in ' + l + ' Tagen';
    if (l < 60) return 'in ' + Math.round(l / 7) + ' Wochen';
    return 'in ' + Math.round(l / 30) + ' Monaten';
  }

  /* ---- Startbestand: gängige Dauerartikel [Name, Laden, Kategorie, Tage] ---- */
  const SEED = [
    ['Toilettenpapier', 'dro', 'papier', 28], ['Küchenrollen', 'dro', 'papier', 28], ['Taschentücher', 'dro', 'papier', 42], ['Müllbeutel', 'dro', 'papier', 42],
    ['Alufolie', 'dro', 'papier', 90], ['Backpapier', 'dro', 'papier', 90], ['Frischhaltefolie', 'dro', 'papier', 120], ['Gefrierbeutel', 'dro', 'papier', 120],
    ['Spülmittel', 'dro', 'reinigung', 42], ['Spülmaschinentabs', 'dro', 'reinigung', 35], ['Geschirrspülsalz', 'dro', 'reinigung', 120], ['Waschmittel', 'dro', 'reinigung', 56],
    ['Weichspüler', 'dro', 'reinigung', 84], ['Allzweckreiniger', 'dro', 'reinigung', 90], ['WC-Reiniger', 'dro', 'reinigung', 60], ['Spülschwämme', 'dro', 'reinigung', 60],
    ['Spültücher', 'dro', 'reinigung', 90], ['Duschgel', 'dro', 'pflege', 42], ['Shampoo', 'dro', 'pflege', 56], ['Handseife', 'dro', 'pflege', 42],
    ['Zahnpasta', 'dro', 'pflege', 56], ['Deo', 'dro', 'pflege', 60], ['Wattepads', 'dro', 'pflege', 90],
    ['Kaffee', 'dis', 'vorrat', 21], ['Olivenöl', 'dis', 'vorrat', 60], ['Salz', 'dis', 'vorrat', 180], ['Gemüsebrühe', 'dis', 'vorrat', 90]
  ];

  /* Vorrat an gängigen Artikeln zum Antippen (Name, Abteilung). Der Laden ergibt sich aus der Abteilung. */
  const CATALOG = [
    ['Äpfel', 'obst'], ['Bananen', 'obst'], ['Birnen', 'obst'], ['Trauben', 'obst'], ['Zitronen', 'obst'], ['Orangen', 'obst'], ['Beeren', 'obst'], ['Tomaten', 'obst'], ['Gurke', 'obst'], ['Paprika', 'obst'],
    ['Zucchini', 'obst'], ['Karotten', 'obst'], ['Kartoffeln', 'obst'], ['Zwiebeln', 'obst'], ['Knoblauch', 'obst'], ['Salat', 'obst'], ['Brokkoli', 'obst'], ['Champignons', 'obst'], ['Avocado', 'obst'], ['Ingwer', 'obst'], ['Petersilie', 'obst'],
    ['Brot', 'brot'], ['Brötchen', 'brot'], ['Toast', 'brot'], ['Wraps', 'brot'],
    ['Milch', 'kuehl'], ['Joghurt', 'kuehl'], ['Skyr', 'kuehl'], ['Quark', 'kuehl'], ['Butter', 'kuehl'], ['Eier', 'kuehl'], ['Käse', 'kuehl'], ['Mozzarella', 'kuehl'], ['Feta', 'kuehl'], ['Frischkäse', 'kuehl'], ['Sahne', 'kuehl'], ['Hummus', 'kuehl'], ['Tofu', 'kuehl'], ['Hüttenkäse', 'kuehl'],
    ['Hähnchenbrust', 'fleisch'], ['Hackfleisch', 'fleisch'], ['Lachs', 'fleisch'], ['Schinken', 'fleisch'], ['Aufschnitt', 'fleisch'], ['Garnelen', 'fleisch'],
    ['TK-Spinat', 'tk'], ['TK-Gemüse', 'tk'], ['TK-Pizza', 'tk'], ['TK-Beeren', 'tk'], ['Pommes', 'tk'], ['Eis', 'tk'],
    ['Nudeln', 'vorrat'], ['Reis', 'vorrat'], ['Haferflocken', 'vorrat'], ['Müsli', 'vorrat'], ['Linsen', 'vorrat'], ['Kichererbsen (Dose)', 'vorrat'], ['Tomaten (Dose)', 'vorrat'], ['Passata', 'vorrat'], ['Olivenöl', 'vorrat'], ['Mehl', 'vorrat'], ['Zucker', 'vorrat'],
    ['Kaffee', 'vorrat'], ['Tee', 'vorrat'], ['Nüsse', 'vorrat'], ['Erdnussbutter', 'vorrat'], ['Honig', 'vorrat'], ['Marmelade', 'vorrat'], ['Kokosmilch', 'vorrat'], ['Sojasauce', 'vorrat'], ['Gemüsebrühe', 'vorrat'], ['Couscous', 'vorrat'], ['Bulgur', 'vorrat'], ['Mais (Dose)', 'vorrat'], ['Kidneybohnen (Dose)', 'vorrat'], ['Thunfisch (Dose)', 'vorrat'],
    ['Schokolade', 'suess'], ['Gummibärchen', 'suess'], ['Chips', 'suess'], ['Kekse', 'suess'], ['Müsliriegel', 'suess'],
    ['Wasser', 'getraenke'], ['Apfelsaft', 'getraenke'], ['Cola', 'getraenke'], ['Bier', 'getraenke'],
    ['Spülmittel', 'reinigung'], ['Waschmittel', 'reinigung'], ['Spülmaschinentabs', 'reinigung'], ['Allzweckreiniger', 'reinigung'], ['Spülschwämme', 'reinigung'],
    ['Toilettenpapier', 'papier'], ['Küchenrolle', 'papier'], ['Taschentücher', 'papier'], ['Müllbeutel', 'papier'], ['Alufolie', 'papier'], ['Backpapier', 'papier'], ['Gefrierbeutel', 'papier'],
    ['Zahnpasta', 'pflege'], ['Duschgel', 'pflege'], ['Shampoo', 'pflege'], ['Deo', 'pflege'], ['Handseife', 'pflege'], ['Wattepads', 'pflege'], ['Rasierer', 'pflege']
  ];
  /* Alle bekannten Artikel: Vorrat plus das, was ihr schon gekauft habt (fav). Gekauftes hat Vorrang. */
  function known(fav) {
    const out = {};
    CATALOG.forEach(([n, c]) => { out[n.toLowerCase()] = { key: n.toLowerCase(), n, c, s: guessStore(c, 'dis'), k: 0 }; });
    Object.keys(fav || {}).forEach(key => { const f = fav[key]; if (f && !f.x) out[key] = { key, n: f.n, c: f.c, s: f.s, k: f.k || 0 }; });
    return Object.keys(out).map(k => out[k]);
  }
  function suggest(q, list, skip) {
    q = String(q || '').trim().toLowerCase(); if (!q) return [];
    const sw = e => e.n.toLowerCase().startsWith(q) ? 0 : 1;
    return list.filter(e => e.n.toLowerCase().includes(q) && !(skip && skip.has(e.key))).sort((a, b) => sw(a) - sw(b) || b.k - a.k || a.n.localeCompare(b.n, 'de')).slice(0, 6);
  }

  /* ---------- Aufgaben im Haushalt ----------
     e = Rhythmus in Tagen, d = Wochentag (-1 beliebig, -2 Tag der Haushaltsrunde, 0..6 So..Sa), w = zuständig (0, 1, 2 = abwechselnd),
     af = Folgeaufgabe von (wird ausgelöst, wenn die andere erledigt ist), t = Auslösedatum, l = zuletzt erledigt, lw = von wem zuletzt. */
  const TSEED = [
    // Name, Rhythmus (Tage), Wochentag, Minuten, zuständig, folgt auf, Mindeststandard, prüfen
    ['Spülmaschine ausräumen', 1, -1, 5, 2, '', 'Alles an seinem Platz, Maschine leer', 0],
    ['Spülmaschine einräumen', 1, -1, 5, 2, '', 'Geschirr aus Spüle und von der Arbeitsplatte drin, Tab rein', 0],
    ['Wäsche waschen', 7, -2, 10, 2, '', 'Abends mit Timer starten, morgens direkt aufhängen', 0],
    ['Wäsche aufhängen', 0, -1, 10, 2, 'Wäsche waschen', 'Gleich nach dem Waschen, nicht liegen lassen', 0],
    ['Wäsche abhängen', 0, -1, 10, 2, 'Wäsche aufhängen', 'Sofort falten, nicht auf dem Ständer lagern', 0],
    ['Wäsche einsortieren', 0, -1, 10, 2, 'Wäsche abhängen', 'Jeder räumt seine eigenen Sachen ein', 0],
    ['Hemden bügeln', 0, -1, 30, 0, 'Wäsche abhängen', 'Nur was diese Woche gebraucht wird', 0],
    ['Staubsaugerroboter leeren und Bürste reinigen', 7, -2, 10, 2, '', 'Behälter leer, Haare aus der Bürste', 0],
    ['Böden nachsaugen (Ecken, Treppe)', 14, -2, 15, 2, '', 'Was der Roboter nicht erreicht', 0],
    ['Böden wischen', 14, -2, 25, 2, '', '', 0],
    ['Bad putzen', 7, -2, 25, 2, '', 'WC, Waschbecken, Dusche, Spiegel, Boden', 0],
    ['Küche gründlich putzen', 7, -2, 25, 2, '', 'Herd, Arbeitsflächen, Fronten, Spüle', 0],
    ['Staub wischen', 14, -2, 15, 2, '', '', 0],
    ['Bettwäsche wechseln', 14, -2, 15, 2, '', '', 0],
    ['Handtücher wechseln', 7, -2, 5, 2, '', '', 0],
    ['Kühlschrank aufräumen', 7, -2, 10, 2, '', 'Abgelaufenes raus, Liste prüfen', 0],
    ['Fenster putzen', 42, -2, 45, 2, '', '', 0],
    ['Backofen reinigen', 90, -2, 30, 2, '', '', 0],
    ['Kühlschrank reinigen', 60, -2, 20, 2, '', '', 0],
    ['Spülmaschine reinigen (Sieb, Dichtung)', 30, -2, 10, 2, '', '', 0],
    ['Waschmaschine reinigen (Flusensieb, Gummi)', 60, -2, 10, 2, '', '', 0]
  ];

  /* ---------- Müllkalender ----------
     mu[id] = { n: Name, a: 1 = Tonne rausstellen (Erinnerung am Vorabend), d: [Abholtage], dn: Abholtag, der als „rausgestellt“ abgehakt ist, m } */
  const MU_SEED = {"restabfall":{"n":"Restabfall","a":1,"d":["2026-06-09","2026-06-23","2026-07-07","2026-07-21","2026-08-04","2026-08-18","2026-09-01","2026-09-15","2026-09-29","2026-10-13","2026-10-27","2026-11-10","2026-11-24","2026-12-08","2026-12-21","2027-01-05","2027-01-19","2027-02-02","2027-02-16","2027-03-02","2027-03-16","2027-03-31","2027-04-13","2027-04-27","2027-05-11","2027-05-25","2027-06-08","2027-06-22","2027-07-06","2027-07-20","2027-08-03","2027-08-17","2027-08-31","2027-09-14","2027-09-28","2027-10-12","2027-10-26","2027-11-09","2027-11-23","2027-12-07","2027-12-20"]},"papiertonne":{"n":"Papiertonne","a":1,"d":["2026-06-09","2026-07-07","2026-08-04","2026-09-01","2026-09-29","2026-10-27","2026-11-24","2026-12-21","2027-01-19","2027-02-16","2027-03-16","2027-04-13","2027-05-11","2027-06-08","2027-07-06","2027-08-03","2027-08-31","2027-09-28","2027-10-26","2027-11-23","2027-12-21"]},"gelbetonne":{"n":"Gelbe Tonne","a":1,"d":["2026-06-12","2026-07-10","2026-08-07","2026-09-04","2026-10-02","2026-11-06","2026-12-04","2027-01-28","2027-02-25","2027-03-24","2027-04-22","2027-05-21","2027-06-17","2027-07-15","2027-08-12","2027-09-09","2027-10-07","2027-11-05","2027-12-02","2027-12-30"]},"komposttonne":{"n":"Komposttonne","a":1,"d":["2026-06-02","2026-06-16","2026-06-30","2026-07-14","2026-07-28","2026-08-11","2026-08-25","2026-09-08","2026-09-22","2026-10-06","2026-10-20","2026-11-03","2026-11-17","2026-12-01","2026-12-15","2026-12-29","2027-01-12","2027-01-26","2027-02-09","2027-02-23","2027-03-09","2027-03-22","2027-04-06","2027-04-20","2027-05-04","2027-05-19","2027-06-01","2027-06-15","2027-06-29","2027-07-13","2027-07-27","2027-08-10","2027-08-24","2027-09-07","2027-09-21","2027-10-05","2027-10-19","2027-11-03","2027-11-16","2027-11-30","2027-12-14","2027-12-28"]},"schadstoffmobil":{"n":"Schadstoffmobil","a":0,"d":["2026-06-12","2026-07-03","2026-08-07","2026-08-18","2026-08-19","2026-09-04","2026-10-02","2026-11-06","2026-12-04","2027-01-09","2027-02-05","2027-03-05","2027-04-02","2027-04-12","2027-04-13","2027-05-14","2027-06-04","2027-07-02","2027-08-06","2027-08-17","2027-08-18","2027-09-03","2027-10-01","2027-11-05","2027-12-03"]}};
  const MU_IDS = { restabfall: 'restabfall', rest: 'restabfall', papier: 'papiertonne', gelb: 'gelbetonne', kompost: 'komposttonne', bio: 'komposttonne', schadstoff: 'schadstoffmobil' };
  function seedMuell() { const o = {}; Object.keys(MU_SEED).forEach(k => { o[k] = { n: MU_SEED[k].n, a: MU_SEED[k].a, d: MU_SEED[k].d.slice(), dn: '', m: 1 }; }); return o; }
  /* ICS lesen: Zeilen zusammenfügen, VEVENTs auslesen. Rückgabe: { Name: [Tage] }. UTC-Zeiten (Z) werden in die Ortszeit umgerechnet. */
  function parseIcs(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n'), out = {};
    let cur = null;
    lines.forEach(l => {
      if (l === 'BEGIN:VEVENT') { cur = {}; return; }
      if (l === 'END:VEVENT') {
        if (cur && cur.n && cur.d) { (out[cur.n] = out[cur.n] || []); if (!out[cur.n].includes(cur.d)) out[cur.n].push(cur.d); }
        cur = null; return;
      }
      if (!cur || l.startsWith('BEGIN:VALARM')) return;
      const i = l.indexOf(':'); if (i < 1) return;
      const key = l.slice(0, i).split(';')[0].toUpperCase(), val = l.slice(i + 1).trim();
      if (key === 'SUMMARY' && !cur.n) cur.n = val.replace(/\\([,;])/g, '$1').slice(0, 30);
      if (key === 'DTSTART' && !cur.d) {
        const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(val);
        if (m) cur.d = m[7] ? iso(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))) : m[1] + '-' + m[2] + '-' + m[3];
      }
    });
    Object.keys(out).forEach(k => out[k].sort());
    return out;
  }
  function muId(name) {
    const low = name.toLowerCase();
    for (const k of Object.keys(MU_IDS)) if (low.includes(k)) return MU_IDS[k];
    return (low.replace(/[^a-z0-9]/g, '') || 'muell').slice(0, 20);
  }
  /* Import: Termine im Zeitraum der Datei ersetzen, alles außerhalb bleibt. Neue Arten werden angelegt. Rückgabe: Anzahl Termine. */
  function muImport(mu, parsed, now) {
    let n = 0;
    Object.keys(parsed).forEach(name => {
      const id = muId(name), dates = parsed[name], old = mu[id] && !mu[id].x ? mu[id] : null;
      const lo = dates[0], hi = dates[dates.length - 1];
      const keep = old ? old.d.filter(d => d < lo || d > hi) : [];
      const all = Array.from(new Set(keep.concat(dates))).sort().slice(-400);
      mu[id] = { n: old ? old.n : name, a: old ? old.a : (/schadstoff|sperr|elektro/i.test(name) ? 0 : 1), d: all, dn: old ? old.dn : '', m: now };
      n += dates.length;
    });
    return n;
  }
  /* Nächster Abholtag ab t0 (heute zählt mit) oder ''. */
  const muNext = (r, t0) => (r.d.find(d => d >= t0) || '');

  /* ---------- Wissen: Tipps je Aufgabe, Reihenfolge der Haushaltsrunde, kleines Wiki ---------- */
  const TIPS = {
    'Spülmaschine ausräumen': 'Morgens beim Kaffee. Erst unten, dann oben, damit nichts tropft.',
    'Spülmaschine einräumen': 'Alles gleich rein, nichts in der Spüle stehen lassen. Dann spülst du nie von Hand.',
    'Wäsche waschen': 'Ein Sack voll heißt: Maschine an. Abends mit Timer starten, morgens direkt aufhängen.',
    'Wäsche aufhängen': 'Glatt ziehen und Hemden auf den Bügel hängen. Das spart oft das Bügeln.',
    'Wäsche abhängen': 'Sofort falten oder auf den Bügel, nicht auf dem Ständer lagern.',
    'Wäsche einsortieren': 'Jeder räumt seine Sachen selbst ein. Fester Platz für alles, dann geht es in Sekunden.',
    'Hemden bügeln': 'Ein Block, nebenbei Podcast. Erst Kragen und Manschetten, dann der Rest. Nur, was diese Woche gebraucht wird.',
    'Staubsaugerroboter leeren und Bürste reinigen': 'Haare aus der Bürste schneiden, Behälter ausklopfen. Der Roboter fährt dann besser.',
    'Böden nachsaugen (Ecken, Treppe)': 'Erst Staub wischen, dann saugen. So fällt nichts mehr auf den sauberen Boden.',
    'Böden wischen': 'Immer als Letztes. Von hinten zur Tür, mit Wechselbezug statt Eimer.',
    'Bad putzen': 'Erst Reiniger in Dusche und WC einsprühen und 5 bis 10 Minuten einwirken lassen. Dann Waschbecken, Spiegel, zuletzt Boden. In der Wartezeit etwas anderes machen.',
    'Küche gründlich putzen': 'Reiniger auf Herd und Fettstellen sprühen, einwirken lassen. Von oben nach unten, Boden zuletzt.',
    'Staub wischen': 'Mikrofasertuch, von oben nach unten, vor dem Saugen.',
    'Bettwäsche wechseln': 'Zweites Set haben: Frisches sofort aufziehen, das benutzte in den Sack. Dann gibt es keine Wartezeit.',
    'Handtücher wechseln': 'Alle auf einmal, in den Handtuchsack. Handtücher mit 60 °C waschen.',
    'Kühlschrank aufräumen': 'Direkt vor dem Einkauf. Dann siehst du, was fehlt, und kaufst nichts doppelt.',
    'Fenster putzen': 'Bei bedecktem Himmel, sonst gibt es Streifen. Erst Rahmen, dann Scheibe, mit Abzieher.',
    'Backofen reinigen': 'Reiniger einsprühen, über Nacht wirken lassen, morgens abwischen.',
    'Kühlschrank reinigen': 'Wenn er vor dem Einkauf fast leer ist. Fächer raus, mit warmem Wasser und etwas Spülmittel auswischen.',
    'Spülmaschine reinigen (Sieb, Dichtung)': 'Sieb ausspülen, Dichtung abwischen, ab und zu Leerlauf mit Maschinenreiniger.',
    'Waschmaschine reinigen (Flusensieb, Gummi)': 'Flusensieb leeren, Gummi trocknen, Tür offen lassen. Ab und zu ein heißer Leerlauf.'
  };
  /* Beste Reihenfolge an einem Tag: Wäsche zuerst (läuft im Hintergrund), Reiniger früh einwirken lassen, Boden zuletzt. */

  /* ---------- Katalog mit Richtwerten (Rhythmus + Begründung) ---------- */
  // Verbrauchsartikel: Name, Laden, Abteilung, Tage, Begründung
  const CAT_REC = [
    ['Zahnbürste / Aufsteckbürste', 'dro', 'pflege', 90, 'Alle 3 Monate wechseln, früher bei ausgefransten Borsten.'],
    ['Zahnseide / Interdentalbürsten', 'dro', 'pflege', 60, 'Eine Packung reicht bei täglicher Nutzung etwa 2 Monate.'],
    ['Rasierklingen', 'dro', 'pflege', 42, 'Je nach Bart 2 bis 6 Wochen. Stumpfe Klingen reizen die Haut.'],
    ['Wattestäbchen', 'dro', 'pflege', 120, ''],
    ['Staubsaugerbeutel', 'dro', 'reinigung', 60, 'Wechseln, wenn der Beutel zu etwa zwei Dritteln voll ist.'],
    ['Staubsaugerfilter / Roboter-Bürste', 'dro', 'reinigung', 90, 'Filter und Seitenbürste des Roboters alle 2 bis 3 Monate tauschen.'],
    ['Wasserfilter-Kartusche', 'dro', 'reinigung', 28, 'Meist alle 4 Wochen, sonst Keim- und Kalkgefahr.'],
    ['Entkalker', 'dro', 'reinigung', 90, 'Für Kaffeemaschine, Wasserkocher und Duschkopf.'],
    ['Maschinenreiniger (Spül- und Waschmaschine)', 'dro', 'reinigung', 90, 'Für den regelmäßigen heißen Leerlauf.'],
    ['Spülbürste', 'dro', 'reinigung', 90, ''],
    ['Toilettenbürste (Ersatz)', 'dro', 'reinigung', 365, 'Einmal im Jahr ersetzen.'],
    ['Biomüllbeutel', 'dro', 'papier', 42, ''],
    ['Batterien (AA / AAA)', 'dro', 'sonst', 180, ''],
    ['Feuchttücher', 'dro', 'pflege', 90, '']
  ];
  // Aufgaben: Name, Tage, Minuten, Begründung
  const CAT_TK = [
    ['Putztücher und Mikrofasertücher waschen', 14, 5, 'Mit 60 °C waschen, ohne Weichspüler, sonst nehmen sie nichts mehr auf.'],
    ['Mülleimer reinigen', 30, 5, 'Innen auswischen und trocknen lassen, gegen Geruch.'],
    ['Toilettenbürste und Halter reinigen', 30, 5, 'Mit heißem Wasser und WC-Reiniger durchspülen.'],
    ['Wasserkocher entkalken', 30, 5, 'Bei hartem Wasser alle 2 bis 4 Wochen.'],
    ['Kaffeemaschine entkalken', 60, 15, 'Alle 2 bis 3 Monate, sonst steigt der Verbrauch und der Geschmack leidet.'],
    ['Duschkopf und Armaturen entkalken', 60, 10, 'In Entkalker einlegen, dann abspülen. Währenddessen etwas anderes erledigen.'],
    ['Fettfilter der Dunstabzugshaube reinigen', 60, 15, 'In die Spülmaschine oder in heißes Spülwasser legen.'],
    ['Matratze lüften und wenden', 90, 10, 'Alle 3 Monate wenden (falls möglich), Bett offen lüften.'],
    ['Kopfkissen und Bettdecke waschen', 120, 20, 'Alle 3 bis 6 Monate, nach Pflegeetikett.'],
    ['Vorhänge waschen', 180, 15, 'Zweimal im Jahr, nach Pflegeetikett.'],
    ['Rauchmelder testen', 365, 5, 'Mindestens einmal im Jahr den Testknopf drücken.']
  ];
  CAT_TK.forEach(x => { if (x[3]) TIPS[x[0]] = x[3]; });
  const RUNDE_ORDER = ['Wäsche waschen', 'Bettwäsche wechseln', 'Handtücher wechseln', 'Bad putzen', 'Küche gründlich putzen', 'Backofen reinigen', 'Staub wischen', 'Kühlschrank aufräumen', 'Kühlschrank reinigen', 'Fenster putzen', 'Spülmaschine reinigen (Sieb, Dichtung)', 'Waschmaschine reinigen (Flusensieb, Gummi)', 'Staubsaugerroboter leeren und Bürste reinigen', 'Böden nachsaugen (Ecken, Treppe)', 'Böden wischen'];
  const ordIdx = n => { const i = RUNDE_ORDER.indexOf(n); return i < 0 ? 99 : i; };
  const WIKI = [
    ['Das Grundprinzip', ['Zeit sparst du durch weniger Handgriffe, nicht durch schnelleres Putzen.', 'Kleine Mengen Schmutz sind leicht, alter Schmutz ist mühsam. Wer kurz und regelmäßig putzt, braucht insgesamt am wenigsten.', 'Weniger Besitz heißt weniger Wäsche, weniger Staub, weniger Aufräumen.']],
    ['Vermeiden statt putzen', ['Schuhe an der Tür ausziehen, Fußmatte davor. Das spart viel Boden und Staub.', 'Jedes Ding hat einen festen Platz. Aufräumen kostet oft mehr Zeit als Putzen.', 'Freie Flächen in Bad und Küche sind in Sekunden sauber.', 'Unter 2 Minuten: sofort machen (Tasse in die Maschine, Spiegel abziehen).']],
    ['Haushaltsrunde bündeln', ['Ein fester Tag pro Woche für alles Größere. Jedes Mal Putzzeug holen und wegräumen kostet Zeit.', 'Reihenfolge: Wäsche anwerfen, Reiniger in Bad und Küche einsprühen, Staub wischen, Bad und Küche fertig putzen, saugen, zuletzt wischen.', 'Immer von oben nach unten und von hinten nach vorn, nie zweimal über dieselbe Fläche.', 'Putzmittel dort lagern, wo sie gebraucht werden.']],
    ['Einwirken lassen', ['Reiniger aufsprühen, 5 bis 10 Minuten warten, dann nur abwischen. Das ist der größte Hebel beim Putzen.', 'Backofen: abends einsprühen, morgens abwischen.', 'In der Wartezeit etwas anderes erledigen.']],
    ['Wäsche-System', ['Drei Säcke: 30 °C (Dunkles, Empfindliches, Sport), 40 °C (Alltag, Buntes, Hemden) und Handtücher mit Bettwäsche (60 °C). Das Pflegeetikett geht vor. So entfällt das Sortieren.', 'Ein Sack voll heißt: Maschine an. Abends mit Timer starten, morgens direkt aufhängen.', 'Gleich nach dem Trocknen falten und wegräumen.', 'Handtücher und Bettwäsche reichen alle 14 Tage, Handtücher bei viel Nutzung wöchentlich.']],
    ['Bügeln minimieren', ['Bügelfreie oder pflegeleichte Hemden kaufen. Das spart am meisten.', 'Glatt ziehen und feucht auf den Bügel hängen.', 'Nur bügeln, was diese Woche gebraucht wird, in einem Block.', 'Ein Dampfglätter ist für Hemden oft schneller als das Bügeleisen.']],
    ['Technik für das Langweilige', ['Saugroboter täglich oder jeden zweiten Tag, du saugst nur noch Ecken und Treppe nach.', 'Spülmaschine so nutzen, dass nichts von Hand gespült wird.', 'Mikrofasertücher und ein Wischsystem mit Wechselbezug statt Eimer und Lappen.']],
    ['Routinen verankern', ['Koppel Aufgaben an etwas, das du sowieso tust (Kaffee kochen, ins Bett gehen). Dann brauchst du keine Disziplin.', 'Zwei bis drei Mini-Routinen täglich und ein langer Block pro Woche sind effizienter als jeden Tag eine Stunde.', 'Seltenes (Backofen, Fenster, Maschinen reinigen) bekommt einen festen Rhythmus in der App.']]
  ];
  function snapWd(day, wd) { const w = toDate(day).getDay(); let diff = (wd - w + 7) % 7; if (diff > 3) diff -= 7; return addDays(day, diff); }
  /* Nächster Termin einer Aufgabe oder '' (pausiert, oder Folgeaufgabe, die noch nicht ausgelöst ist). */
  function nextDue(t, round) {
    if (t.p) return '';
    if (t.af) return t.t || '';
    if (!t.e) return '';
    const target = addDays(t.l, t.e), wd = t.d === -2 ? round : t.d;
    return wd >= 0 && t.e % 7 === 0 ? snapWd(target, wd) : target;
  }
  function seedTasks(now, round) {
    const t0 = iso(new Date(now)), out = {}, idOf = {};
    TSEED.forEach(([n]) => { idOf[n] = 't' + hash(n).toString(36); });
    TSEED.forEach(([n, e, d, min, w, af, q, chk], i) => {
      const back = e ? Math.round(e * (0.3 + (hash(n + 'y') % 60) / 100)) : 0;
      out[idOf[n]] = { n, e, d, min, w, l: e ? addDays(t0, -(e === 1 ? 1 : back)) : t0, lw: w === 2 ? (i % 2) : -1, t: '', af: af ? idOf[af] : '', q, p: 0, chk, m: 1 };
    });
    return out;
  }
  /* Durchschnittliche Minuten pro Woche je Person. Folgeaufgaben laufen im Rhythmus ihrer Ausgangsaufgabe. */
  function weekly(tasks) {
    const by = {}; tasks.forEach(t => { by[t.id] = t; });
    const sum = [0, 0];
    tasks.forEach(t => {
      if (t.p) return;
      let r = t, k = 0; while (r && r.af && k++ < 6) r = by[r.af];
      if (!r || r.p || !r.e) return;
      const pw = t.min * 7 / r.e;
      if (t.w === 2) { sum[0] += pw / 2; sum[1] += pw / 2; } else sum[t.w === 1 ? 1 : 0] += pw;
    });
    return sum;
  }

  const uid = () => { let s = ''; const cs = 'abcdefghijklmnopqrstuvwxyz0123456789'; for (let i = 0; i < 10; i++) s += cs[Math.floor(Math.random() * cs.length)]; return s; };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

  /* Startwerte „zuletzt gekauft“ verteilen, damit nicht alles am selben Tag fällig wird. */
  function seed(now) {
    const t = iso(new Date(now)), rec = {};
    SEED.forEach(([n, s, c, e]) => {
      const id = 's' + hash(n).toString(36);
      const back = Math.round(e * (0.35 + (hash(n + "x") % 85) / 100));
      rec[id] = { n, s, c, e, l: addDays(t, -back), p: 0, m: 1 };
    });
    return rec;
  }

  /* ---- Abgleich: je Eintrag gewinnt der neuere Zeitstempel; Löschungen bleiben als Marke (x) ---- */
  const TOMB = 45 * DAY;
  function pick(a, b) {
    if (!a) return b; if (!b) return a;
    if (a.m !== b.m) return a.m > b.m ? a : b;
    return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
  }
  function mergeMap(a, b, now) {
    const out = {}, keys = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
    keys.forEach(k => { const v = pick((a || {})[k], (b || {})[k]); if (v.x && v.m < now - TOMB) return; out[k] = v; });
    return out;
  }
  function merge(a, b, now) {
    now = now || Date.now();
    const set = pick(a.set, b.set);
    return { v: 1, items: mergeMap(a.items, b.items, now), rec: mergeMap(a.rec, b.rec, now), lrn: mergeMap(a.lrn, b.lrn, now), tk: mergeMap(a.tk, b.tk, now), trips: mergeMap(a.trips, b.trips, now), mu: mergeMap(a.mu, b.mu, now), fav: mergeMap(a.fav, b.fav, now), set };
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* ---- Fremde Daten prüfen ---- */
  const ID_RE = /^[a-z0-9]{4,24}$/;
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const num = v => typeof v === 'number' && isFinite(v) ? v : 0;
  function cleanRoute(r) {
    const out = {};
    SK.forEach(s => {
      const src = r && Array.isArray(r[s]) ? r[s].filter((c, i, a) => CK.includes(c) && a.indexOf(c) === i) : [];
      ROUTE[s].forEach(c => { if (!src.includes(c)) src.push(c); });
      out[s] = src;
    });
    return out;
  }
  function cleanDoc(d) {
    if (!d || typeof d !== 'object' || d.v !== 1) return null;
    const out = { v: 1, items: {}, rec: {}, lrn: {}, fav: {}, trips: {}, tk: {}, mu: {}, set: null };
    Object.keys(d.items || {}).slice(0, 2000).forEach(k => {
      const x = d.items[k]; if (!ID_RE.test(k) || !x || typeof x !== 'object') return;
      if (x.x) { out.items[k] = { x: 1, m: num(x.m) }; return; }
      out.items[k] = { n: str(x.n, 80), s: SK.includes(x.s) ? x.s : 'dis', c: CK.includes(x.c) ? x.c : 'sonst', q: str(x.q, 120), b: x.b === 1 ? 1 : 0, d: x.d ? 1 : 0, r: ID_RE.test(x.r || '') ? x.r : '', m: num(x.m) };
    });
    Object.keys(d.rec || {}).slice(0, 500).forEach(k => {
      const x = d.rec[k]; if (!ID_RE.test(k) || !x || typeof x !== 'object') return;
      if (x.x) { out.rec[k] = { x: 1, m: num(x.m) }; return; }
      const e = Math.round(num(x.e));
      out.rec[k] = { n: str(x.n, 60), s: SK.includes(x.s) ? x.s : 'dis', c: CK.includes(x.c) ? x.c : 'sonst', e: Math.min(730, Math.max(1, e || 30)), l: DATE_RE.test(x.l || '') ? x.l : today(), p: x.p ? 1 : 0, m: num(x.m) };
    });
    Object.keys(d.lrn || {}).slice(0, 500).forEach(k => {
      const x = d.lrn[k]; if (!x || typeof x !== 'object' || k.length > 60) return;
      if (x.x) { out.lrn[k] = { x: 1, m: num(x.m) }; return; }
      out.lrn[k] = { c: CK.includes(x.c) ? x.c : 'sonst', s: SK.includes(x.s) ? x.s : '', m: num(x.m) };
    });
    Object.keys(d.fav || {}).slice(0, 1000).forEach(k => {
      const x = d.fav[k]; if (!x || typeof x !== 'object' || k.length > 60) return;
      if (x.x) { out.fav[k] = { x: 1, m: num(x.m) }; return; }
      out.fav[k] = { n: str(x.n, 80), c: CK.includes(x.c) ? x.c : 'sonst', s: SK.includes(x.s) ? x.s : 'dis', k: Math.min(9999, Math.max(0, Math.round(num(x.k)))), m: num(x.m) };
    });
    Object.keys(d.trips || {}).slice(0, 3000).forEach(k => {
      const x = d.trips[k]; if (!ID_RE.test(k) || !x || typeof x !== 'object') return;
      if (x.x) { out.trips[k] = { x: 1, m: num(x.m) }; return; }
      const it = Array.isArray(x.it) ? x.it.slice(0, 80).map(v => str(v, 60)).filter(Boolean) : [];
      out.trips[k] = { s: SK.includes(x.s) ? x.s : 'dis', t: num(x.t), b: x.b === 1 ? 1 : 0, n: Math.min(999, Math.max(it.length, Math.round(num(x.n)))), it, m: num(x.m) };
    });
    Object.keys(d.tk || {}).slice(0, 500).forEach(k => {
      const x = d.tk[k]; if (!ID_RE.test(k) || !x || typeof x !== 'object') return;
      if (x.x) { out.tk[k] = { x: 1, m: num(x.m) }; return; }
      const dd = Math.round(num(x.d));
      out.tk[k] = { n: str(x.n, 70), e: Math.min(730, Math.max(0, Math.round(num(x.e)))), d: dd >= -2 && dd <= 6 ? dd : -1, min: Math.min(240, Math.max(0, Math.round(num(x.min)))), w: x.w === 0 || x.w === 1 ? x.w : 2,
        l: DATE_RE.test(x.l || '') ? x.l : today(), lw: x.lw === 0 || x.lw === 1 ? x.lw : -1, t: DATE_RE.test(x.t || '') ? x.t : '', af: ID_RE.test(x.af || '') ? x.af : '', q: str(x.q, 120), p: x.p ? 1 : 0, chk: x.chk ? 1 : 0, m: num(x.m) };
    });
    Object.keys(d.mu || {}).slice(0, 40).forEach(k => {
      const x = d.mu[k]; if (!ID_RE.test(k) || !x || typeof x !== 'object') return;
      if (x.x) { out.mu[k] = { x: 1, m: num(x.m) }; return; }
      const ds = Array.isArray(x.d) ? Array.from(new Set(x.d.filter(v => typeof v === 'string' && DATE_RE.test(v)))).sort().slice(-400) : [];
      out.mu[k] = { n: str(x.n, 30) || k, a: x.a ? 1 : 0, d: ds, dn: DATE_RE.test(x.dn || '') ? x.dn : '', m: num(x.m) };
    });
    const st = d.set && typeof d.set === 'object' ? d.set : {};
    out.set = { round: (st.round >= 0 && st.round <= 6 && Number.isInteger(st.round)) ? st.round : 4, names: [str(st.names && st.names[0], 20) || 'Roman', str(st.names && st.names[1], 20) || 'Ayşe'], route: cleanRoute(st.route), m: num(st.m) };
    return out;
  }
  /* Firebase lässt leere Objekte weg; beim Lesen auffüllen. */
  const unpack = raw => (raw && typeof raw === 'object') ? cleanDoc({ v: raw.v, items: raw.items || {}, rec: raw.rec || {}, lrn: raw.lrn || {}, fav: raw.fav || {}, trips: raw.trips || {}, tk: raw.tk || {}, mu: raw.mu || {}, set: raw.set }) : null;

  root.HC = { CATS, STORES, CK, SK, CNAME, SNAME, defaultRoute, cleanRoute, guess, guessStore, today, addDays, diffDays, iso, DATE_RE, due, everyText, leftText, seed, toDate, TSEED, snapWd, nextDue, seedTasks, weekly, WD, WDL, monday, kw, fmtDay, fmtTime, fmtRange, uid, CATALOG, known, suggest, merge, same, cleanDoc, unpack, DAY, TOMB, TIPS, CAT_REC, CAT_TK, RUNDE_ORDER, ordIdx, WIKI, seedMuell, taskId: n => 't' + hash(n).toString(36), parseIcs, muImport, muNext };
  if (typeof module !== 'undefined') module.exports = root.HC;
})(typeof window !== 'undefined' ? window : globalThis);
