# Haushalt – Projektanleitung für Agenten

Haushalt ist eine gemeinsame App für Roman und Ayşe: Einkaufsliste nach Geschäft, Dauerartikel, Aufgaben,
Verlauf, Müllkalender, Tipps/Wiki, Katalog, Übersicht. Eine einzelne HTML-Datei mit Vanilla-JS (kein Framework),
gehostet über GitHub Pages (`https://aiaccount42.github.io/haushalt/`), als PWA installiert
(iPhone: Roman, Android: Ayşe). Daten werden über Firebase Realtime DB zwischen beiden synchronisiert.
Sprache der App und der Kommunikation mit Roman: Deutsch, kurz und direkt.

## Aufbau
- `src/` = Quellcode. **Nur hier ändern.**
  - `core.js` Logik und Daten: Sync/Merge, Müllkalender (ICS-Import), Tipps (`TIPS`), Wiki (`WIKI`), Katalog, Reihenfolge der Runde
  - `app.js` Oberfläche, `style.css` Aussehen
  - `build.js` baut alles zusammen, `test.js` enthält die Tests (108 Prüfungen)
  - `ics/` die Müllkalender-Dateien (2026, 2027), nur für die Tests
- Hauptordner (`index.html`, `sw.js`, `manifest.webmanifest`, Icons) = **generiertes Ergebnis**, das GitHub Pages ausliefert. Nie von Hand bearbeiten.

## Arbeitsablauf
1. `git pull` (vorher, immer – auch die Claude-App und andere Agenten pushen hier hin).
2. Änderung in `src/` machen.
3. In `src/` ausführen: `node build.js` und danach `node test.js`. Erwartet: `108 / 108 ok`.
4. In `src/build.js` die Zahl `CACHE_V` um 1 erhöhen und noch einmal `node build.js`. Sonst zeigt die installierte App den alten Stand. Die Anzeige unter „Mehr“ folgt automatisch.
5. Committen. **Nicht pushen, bevor Roman es ausdrücklich freigibt.**

## Regeln
- Roman will kleine, klare Änderungen und eine kurze Rückmeldung, was sich geändert hat.
- Keine neuen Abhängigkeiten, kein Framework, alles bleibt eine Datei plus Service Worker.
- `build.js` erzeugt die Content-Security-Policy mit Hashes der Skripte. Neue Netzwerkziele müssen dort in `connect-src` ergänzt werden, sonst blockt der Browser sie.
- Sync-Dokument `{v:1, items, rec, lrn, fav, trips, tk, mu, set}`: pro Eintrag gilt „letzte Änderung gewinnt" (Feld `m`), gelöschte Einträge bleiben als Tombstone `{x:1, m}`. Bestehende Felder nie umbenennen, sonst gehen Daten verloren (ältere Geräte verwerfen unbekannte Felder).
- Müllkalender: `mu[id] = {n, a, d[], dn, m}`; der ICS-Import ersetzt Termine nur im Datumsbereich der Datei.
- Offenes Vorhaben: Button „Meal-Prep-Einkauf holen" – holt die Wocheneinkaufsliste, die Vorkoch nach Firebase schreibt. Vorkoch liegt im Nachbarordner `projekte/vorkoch`.
