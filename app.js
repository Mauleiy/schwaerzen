(function () {
  "use strict";
  var DATEIEN = ["woerter", "nurklein", "teile_extra", "medizin", "vornamen", "nachnamen", "staedte", "ausnahmen"];
  var $ = function (id) { return document.getElementById(id); };
  var S = null, text = "", funde = [], korrekturen = [], hausliste = null;

  function status(t) { $("status").textContent = t; }

  // Nur eigene Dateien laden (same-origin). Eingegebener Text wird nirgends gespeichert.
  function datenLaden() {
    return Promise.all(DATEIEN.map(function (n) {
      return fetch("daten/" + n + ".txt").then(function (r) { if (!r.ok) throw new Error(n); return r.text(); });
    })).then(function (t) {
      var d = {};
      DATEIEN.forEach(function (n, i) { d[n] = t[i]; });
      S = self.Schwaerzen.laden(d);
      status("Bereit. Alles bleibt auf diesem Gerät.");
      $("btn-schwaerzen").disabled = false;
    }).catch(function (e) { status("Wörterbuch konnte nicht geladen werden: " + e.message); });
  }

  function hauslisteAnzeigen() {
    if (hausliste) {
      $("haus-anzeige").textContent = "Hausliste: " + hausliste.n + " Einträge, geladen am " + hausliste.geladen;
      $("btn-haus-weg").hidden = false;
    } else {
      $("haus-anzeige").textContent = "Hausliste: keine";
      $("btn-haus-weg").hidden = true;
    }
  }
  function hauslisteLesen() {
    try { var j = localStorage.getItem("hausliste_v1"); hausliste = j ? JSON.parse(j) : null; } catch (e) { hausliste = null; }
    hauslisteAnzeigen();
  }

  function schwaerzen() {
    if (!S) return;
    // Fehlende Umlaute aus dem Scan ergänzen (gleiche Länge, Positionen bleiben), dann schwärzen
    var k = S.korrigiere($("eingabe").value.normalize("NFC"));
    text = k.text;
    korrekturen = k.korrekturen;
    funde = S.erkenne(text, { hausliste: hausliste ? hausliste.eintraege : [] });
    funde.forEach(function (f) { f.aktiv = true; });
    zeigen();
  }

  function zeigen() {
    funde.sort(function (a, b) { return a.start - b.start; });
    S.beschriftung(funde);
    var box = $("ergebnis");
    box.textContent = "";
    var pos = 0;
    funde.forEach(function (f, idx) {
      if (f.start < pos) return;
      worte(box, pos, f.start);
      var sp = document.createElement("span");
      sp.className = "fund" + (f.aktiv ? "" : " aus");
      sp.textContent = f.aktiv ? f.label : text.slice(f.start, f.end);
      sp.setAttribute("data-f", String(idx));
      box.appendChild(sp);
      pos = f.end;
    });
    worte(box, pos, text.length);
    $("ergebnis-bereich").hidden = false;
    $("kopiert").textContent = "";
  }

  // Normalen Text in antippbare Wörter zerlegen
  function worte(box, von, bis) {
    var teil = text.slice(von, bis), rx = /\p{L}[\p{L}'’]*(?:-\p{L}[\p{L}'’]*)*/gu, m, p = 0;
    while ((m = rx.exec(teil))) {
      if (m.index > p) box.appendChild(document.createTextNode(teil.slice(p, m.index)));
      var sp = document.createElement("span"), a = von + m.index, e = a + m[0].length, ki = [];
      korrekturen.forEach(function (kk, i) { if (!kk.zurueck && kk.start >= a && kk.end <= e) ki.push(i); });
      sp.className = ki.length ? "w korr" : "w";
      sp.textContent = m[0];
      sp.setAttribute("data-s", String(a));
      sp.setAttribute("data-e", String(e));
      if (ki.length) sp.setAttribute("data-k", ki.join(","));
      box.appendChild(sp);
      p = m.index + m[0].length;
    }
    if (p < teil.length) box.appendChild(document.createTextNode(teil.slice(p)));
  }

  $("ergebnis").addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.getAttribute) return;
    var fi = t.getAttribute("data-f");
    if (fi !== null) {
      var f = funde[Number(fi)];
      if (f.manuell && f.aktiv) funde.splice(Number(fi), 1); else f.aktiv = !f.aktiv;
      zeigen();
      return;
    }
    // Ergänzten Umlaut zurücknehmen: gescannte Schreibweise wiederherstellen
    var ks = t.getAttribute("data-k");
    if (ks !== null) {
      ks.split(",").forEach(function (i) {
        var kk = korrekturen[Number(i)];
        text = text.slice(0, kk.start) + kk.alt + text.slice(kk.end);
        kk.zurueck = true;
      });
      zeigen();
      return;
    }
    var s = t.getAttribute("data-s");
    if (s !== null) {
      var a = Number(s), e = Number(t.getAttribute("data-e"));
      funde.push({ start: a, end: e, art: "Name", grund: "manuell", text: text.slice(a, e), aktiv: true, manuell: true });
      zeigen();
    }
  });

  function kopieren() {
    var out = S.ersetze(text, funde);
    function fertig(ok) { $("kopiert").textContent = ok ? "Kopiert (" + out.length + " Zeichen)." : "Kopieren nicht möglich."; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out).then(function () { fertig(true); }, function () { fallback(out, fertig); });
    } else fallback(out, fertig);
  }
  function fallback(out, fertig) {
    var ta = document.createElement("textarea");
    ta.value = out; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    fertig(ok);
  }

  function leeren() {
    $("eingabe").value = "";
    $("ergebnis").textContent = "";
    $("ergebnis-bereich").hidden = true;
    text = ""; funde = []; korrekturen = [];
    $("kopiert").textContent = "";
  }

  $("btn-schwaerzen").addEventListener("click", schwaerzen);
  $("btn-kopieren").addEventListener("click", kopieren);
  $("btn-leeren").addEventListener("click", leeren);
  $("btn-haus-laden").addEventListener("click", function () { $("haus-datei").click(); });
  $("btn-haus-weg").addEventListener("click", function () {
    try { localStorage.removeItem("hausliste_v1"); } catch (e) { /* ignorieren */ }
    hausliste = null; hauslisteAnzeigen();
    if (text) schwaerzen();
  });
  $("haus-datei").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var p = S.parseHausliste(String(r.result));
      if (p.fehler.length) { $("haus-anzeige").textContent = "Hausliste ungültig (Zeile " + p.fehler.slice(0, 5).join(", ") + ")."; return; }
      hausliste = { eintraege: p.eintraege, n: p.eintraege.length, geladen: new Date().toLocaleString("de-DE") };
      try { localStorage.setItem("hausliste_v1", JSON.stringify(hausliste)); } catch (e) { /* ignorieren */ }
      hauslisteAnzeigen();
      if (text) schwaerzen();
    };
    r.readAsText(f, "utf-8");
    this.value = "";
  });

  hauslisteLesen();
  datenLaden();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () { /* ohne Offline-Cache weiter */ });
})();
