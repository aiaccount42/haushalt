const fs = require('fs');
const CACHE_V = 7; /* bei jeder neuen Version erhöhen, sonst zeigt die App den alten Stand */
const d = __dirname + '/';
const css = fs.readFileSync(d + 'style.css', 'utf8') + '\n[hidden] { display: none !important; }\n';
const core = fs.readFileSync(d + 'core.js', 'utf8');
const app = fs.readFileSync(d + 'app.js', 'utf8');
const icons = {
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17"/>',
  rec: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.6L20 16M20 20v-4h-4"/>',
  tasks: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
  hist: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  more: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'
};
const tabs = [['list', 'Liste'], ['rec', 'Nachkauf'], ['tasks', 'Aufgaben'], ['hist', 'Verlauf'], ['more', 'Mehr']];
const nav = '<nav id="tabs" aria-label="Bereiche"><div class="in">' + tabs.map(([k, l]) => '<button type="button" data-act="tab" data-tab="' + k + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + icons[k] + '</svg>' + l + (k === 'rec' ? '<span class="badge" id="rbadge" hidden></span>' : k === 'tasks' ? '<span class="badge" id="tbadge" hidden></span>' : '') + '</button>').join('') + '</div></nav>';
/* Ausgabe: liegt der Code in einem Ordner "src", gehen die fertigen Dateien in den Ordner darüber (Repo-Hauptordner = GitHub Pages). Sonst nach dist/. Mit OUT=pfad überschreibbar. */
const path = require('path');
const dist = (process.env.OUT ? path.resolve(process.env.OUT) : path.basename(path.resolve(d)) === 'src' ? path.resolve(d, '..') : path.resolve(d, 'dist')) + '/';
if (!fs.existsSync(dist)) fs.mkdirSync(dist);
const html = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<title>Haushalt</title>\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Haushalt">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n' +
  '<meta name="theme-color" content="#F2F2F7">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-180.png">\n<link rel="icon" href="icon-192.png">\n' +
  '<style>\n' + css + '</style>\n</head><body>\n<div id="app"><div id="main"></div><div id="sheetc"></div></div>\n<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>\n' + nav + '\n' +
  '<script>\n' + core + '\n' + app + '\n</script>\n<script>if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}</script>\n</body></html>\n';
fs.writeFileSync(dist + 'index.html', html);
fs.writeFileSync(dist + 'manifest.webmanifest', JSON.stringify({
  name: 'Haushalt', short_name: 'Haushalt', description: 'Geteilte Einkaufsliste und Dauerartikel', lang: 'de', start_url: './', scope: './', display: 'standalone',
  background_color: '#F2F2F7', theme_color: '#F2F2F7',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
}, null, 2));
fs.writeFileSync(dist + 'sw.js', "var C='haushalt-v" + CACHE_V + "';var F=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-180.png'];\n" +
  "self.addEventListener('install',function(e){e.waitUntil(caches.open(C).then(function(c){return c.addAll(F);}).then(function(){return self.skipWaiting();}));});\n" +
  "self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(x){return x!==C;}).map(function(x){return caches.delete(x);}));}).then(function(){return self.clients.claim();}));});\n" +
  "self.addEventListener('fetch',function(e){if(e.request.method!=='GET')return;var u=new URL(e.request.url);if(u.origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(function(r){var c=r.clone();caches.open(C).then(function(x){x.put(e.request,c);});return r;}).catch(function(){return caches.match(e.request).then(function(m){return m||caches.match('index.html');});}));});\n");
console.log('gebaut', html.length, 'Bytes');

/* Variante für die Vorschau in Claude (ohne Manifest und Offline-Cache) */
fs.writeFileSync(d + 'haushalt.html', '<title>Haushalt</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>\n' + css + '</style>\n<div id="app"><div id="main"></div><div id="sheetc"></div></div>\n<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>\n' + nav + '\n<script>\n' + core + '\n' + app + '\n</script>\n');
