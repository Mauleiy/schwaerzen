// Service Worker: lädt alle eigenen Dateien vor und liefert sie offline aus. Kein Netzverkehr mit Inhalten.
var VERSION = "schwaerzen-v2";
var DATEIEN = ["./", "index.html", "style.css", "app.js", "schwaerzen.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png",
  "daten/woerter.txt", "daten/nurklein.txt", "daten/teile_extra.txt", "daten/medizin.txt", "daten/vornamen.txt", "daten/nachnamen.txt", "daten/staedte.txt", "daten/ausnahmen.txt"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(DATEIEN); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || fetch(e.request); }));
});
