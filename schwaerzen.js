/* Schwärzen: Erkennung. Läuft im Browser und unter Node. Kein Netzverkehr, keine Speicherung von Text. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Schwaerzen = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var L = "\\p{L}";
  var WORT_RX = /\p{L}[\p{L}'’]*(?:-\p{L}[\p{L}'’]*)*/gu;

  // Wörter, die immer als bekannt gelten (Abkürzungen, Titel, Hausbegriffe)
  var EXTRA_BEKANNT = ("dr prof pat hr fr oa oä ra rain pd priv doz med rer nat phil jur habil dent univ mult dipl psych psych. " +
    "nr az gz st str tel fax abt std min tbl kps amp inj inf supp ggf evtl usw etc ca zzgl inkl exkl vgl bzw bzgl ggü gem lt lfd " +
    "nexus eintrag kmv kis ppb eg ekg eeg ct mrt bz rr hf af spo2 gcs ck got gpt ggt crp bb ba stgb stpo bgb btmg sgb psychkg " +
    "hemmer quick na giga abschn pdfs abs absch nr ebd hrsg aufl bd kap tab abb anm fn empf sog ua vs bspw insb ifd ff mio mrd ca stand tel " +
    "icd dsm amdp panss hamd mmst moca i ii iii iv v vi vii viii ix x xi xii").split(/\s+/);

  var FUNKTION = new Set(("der die das den dem des ein eine einen einem einer eines er sie es wir ihr ihm ihn ihnen ich du und oder aber als wenn dass " +
    "da dort hier dann heute gestern morgen nach vor bei mit von zu zur zum im am in auf an aus um ohne bis seit während wegen laut zudem außerdem " +
    "weiterhin bisher derzeit aktuell wurde war ist hat sind waren haben hatte wird werden kann nicht kein keine noch auch nur schon sehr bereits " +
    "dieser diese dieses jetzt nun so wie was wer wo wann warum weil sowie sowohl weder zunächst später danach davor dabei dazu darauf ").split(/\s+/));

  var TIER1 = new Set(["Herr", "Herrn", "Frau", "Hr", "Fr", "Dr", "Prof", "Pat", "OA", "OÄ", "RA", "RAin", "PD"]);
  var TITEL_SKIP = new Set(["dr", "med", "prof", "habil", "rer", "nat", "phil", "jur", "dent", "univ", "mult", "pd", "priv", "doz", "dipl", "psych", "hc", "h", "c", "oa", "oä", "herr", "frau", "herrn"]);
  var ROLLE2 = new Set(("patient patientin patienten pfleger schwester betreuer betreuerin rechtsanwalt rechtsanwältin richter richterin " +
    "sachverständige sachverständiger gutachter gutachterin oberarzt oberärztin stationsarzt stationsärztin psychologe psychologin " +
    "sozialarbeiter sozialarbeiterin verteidiger verteidigerin staatsanwalt staatsanwältin bezugspfleger bezugspflegerin ergotherapeut ergotherapeutin").split(/\s+/));
  var FAM = new Set("mutter vater bruder schwester sohn tochter ehefrau ehemann freund freundin onkel tante großmutter großvater oma opa".split(/\s+/));
  var PARTIKEL = new Set("von van de zu zur vom der den ten ter".split(/\s+/));
  var NAMENSUFFIX = new Set("mann berg bach feld wald hof dorf burg hagen horst meier meyer brock kamp".split(/\s+/));
  var MEDSUFFIX = /(?:ämie|ämien|itis|iden|ose|osen|pathie|penie|zytose|urie|plegie|algie|ektomie|skopie|graphie|ismus|zepin|zepam|pramin|triptylin|peridol|azol|mycin|cillin|sartan|pril|olol|statin|prazol|oxetin|dipin|tidin|fenac|profen|oxacin|floxacin|ika|ikum)(?:s|n|en|e|er)?$/;
  var STADT_TRIGGER = new Set("in nach aus bei von um raum stadt gemeinde umgebung universität uni landgericht amtsgericht".split(/\s+/));
  var LOCKERUNG = new Set("0a 0b 1a 1b 2a 2b 2c 2d 2e 3a 3b 3c 4a 4b".split(" "));

  function mengeAus(text) {
    var s = new Set();
    var z = text.split("\n");
    for (var i = 0; i < z.length; i++) { var w = z[i].trim(); if (w) s.add(w); }
    return s;
  }

  function laden(d) {
    var woerter = mengeAus(d.woerter);
    var med = mengeAus(d.medizin);
    var nurklein = mengeAus(d.nurklein);
    var teile = new Set(woerter);
    nurklein.forEach(function (w) { teile.add(w); });
    mengeAus(d.teile_extra).forEach(function (w) { teile.add(w); });
    med.forEach(function (w) { teile.add(w); });
    var extra = new Set(EXTRA_BEKANNT);
    EXTRA_BEKANNT.forEach(function (w) { med.add(w); teile.add(w); });
    var vor = mengeAus(d.vornamen), nach = mengeAus(d.nachnamen), ausn = mengeAus(d.ausnahmen);
    var stadt = new Set();
    mengeAus(d.staedte).forEach(function (s) {
      var b = s.split(/\s*[(/]/)[0].trim();
      [s, b].forEach(function (x) { if (x && !/\s/.test(x)) stadt.add(x.toLowerCase()); });
    });
    return neu({ extra: extra, woerter: woerter, nurklein: nurklein, med: med, teile: teile, vor: vor, nach: nach, ausn: ausn, stadt: stadt });
  }

  function neu(D) {
    function bekannt(lw) { return D.woerter.has(lw) || D.nurklein.has(lw) || D.med.has(lw); }
    function imWb(lw) { return D.woerter.has(lw) || D.nurklein.has(lw); }
    var ARTIKEL = new Set("der die das den dem des ein eine einen einem einer eines".split(" "));
    var POSS = /^(?:mein|dein|sein|ihr|unser|euer|eur)(?:e|en|em|er|es)?$/;
    var DEMO = /^(?:dies|dieser|diese|dieses|diesen|diesem|jen(?:er|e|es|en|em)|solch(?:e|er|es|en|em)|manch(?:e|er|es|en|em)|jed(?:e|er|es|en|em)|all(?:e|er|es|en|em)|welch(?:e|er|es|en|em)|derselbe|dieselbe|dasselbe|denselben|demselben|derselben|selbe|selben)$/;
    var ZAHL = /^(?:zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|hundert|tausend|einige|mehrere|viele|wenige|beide|erst|zweit|dritt|viert|fünft)(?:e|en|em|er|es)?$/;
    var VERSCHM = new Set("im am zum zur vom beim ins ans aufs fürs übers ums durchs".split(" "));
    var KEIN = /^kein(?:e|en|em|er|es)?$/;
    var KEIN_ADJ = new Set(("mit von zu bei laut für an durch gegen ohne unter über außer hinter vor nach aus auf in um bis seit während wegen statt trotz zwischen neben entlang " +
      "gegenüber samt nebst und oder sowie wie als dass sodass weil wenn da denn aber doch auch nur noch schon sehr eine einen einem einer eines meine seine ihre").split(" "));
    function ausnahmeVor(ctx) {
      if (!ctx) return false;
      if (ctx.vorZiffer) return true;
      var v = ctx.vorWort;
      if (!v) return false;
      if (ARTIKEL.has(v) || POSS.test(v) || DEMO.test(v) || ZAHL.test(v) || VERSCHM.has(v) || KEIN.test(v)) return true;
      if (ctx.vorKlein && /(?:e|en|er|em|es)$/.test(v) && !KEIN_ADJ.has(v) && imWb(v)) return true;
      return false;
    }
    function istNameListe(lw) {
      if (D.ausn.has(lw)) return false;
      if (D.vor.has(lw) || D.nach.has(lw)) return true;
      if (lw.length > 4 && lw.charAt(lw.length - 1) === "s") {
        var st = lw.slice(0, -1);
        if (!D.ausn.has(st) && (D.vor.has(st) || D.nach.has(st))) return true;
      }
      return false;
    }
    var failMemo = {};
    function zerlegbar(w) {
      if (w.length < 6) return false;
      var n = w.length, fail = new Set();
      function ok(i, cnt) {
        if (i === n) return cnt >= 2;
        if (cnt >= 6 || fail.has(i * 10 + cnt)) return false;
        for (var j = i + 3; j <= n; j++) {
          var seg = w.slice(i, j);
          if (!D.teile.has(seg)) continue;
          if (j === n) { if (cnt >= 1 && !NAMENSUFFIX.has(seg)) return true; continue; }
          if (ok(j, cnt + 1)) return true;
          if (w.charAt(j) === "s" && j + 1 < n && ok(j + 1, cnt + 1)) return true;
        }
        fail.add(i * 10 + cnt);
        return false;
      }
      return ok(0, 0);
    }

    // Prüfung eines einzelnen Wortteils (ohne Bindestrich): "name" | "ort" | null
    function pruefeTeil(p, vorWort, ctx, erstesTeil) {
      var w = p.replace(/['’]s$/, "");
      if (w.length < 2) return null;
      var erster = w.charAt(0);
      if (erster === erster.toLowerCase()) return null;
      var lw = w.toLowerCase();
      if (D.extra.has(lw)) return null;
      var gross = w === w.toUpperCase();
      if (gross && w.length <= 4) return (D.nach.has(lw) || D.vor.has(lw)) && !D.ausn.has(lw) ? "name" : null;
      var istStadt = D.stadt.has(lw);
      if (istStadt && !imWb(lw) && !D.ausn.has(lw)) {
        // Stadtname, der zugleich Familienname ist (Roth, Hagen): ohne Stadtkontext gilt er als Name
        if (istNameListe(lw) && !(vorWort && STADT_TRIGGER.has(vorWort))) return "name";
        return "ort";
      }
      if (istStadt && vorWort && STADT_TRIGGER.has(vorWort)) return "ort";
      if (istNameListe(lw)) {
        if (!imWb(lw)) return "name";
        if (!erstesTeil) return null;
        if (ctx && ctx.satzanfang) return "name";
        return ausnahmeVor(ctx) ? null : "name";
      }
      if (bekannt(lw)) {
        // Regel: großgeschrieben mitten im Satz, Wörterbuchform nur klein (lange, kurz, stark, reich)
        if (erstesTeil && !gross && ctx && !ctx.satzanfang && D.nurklein.has(lw) && !D.woerter.has(lw) && !D.med.has(lw) && !FUNKTION.has(lw) && !ausnahmeVor(ctx)) return "name";
        return null;
      }
      if (zerlegbar(lw)) return null;
      if (lw.length >= 8 && MEDSUFFIX.test(lw) && !/(?:monika|veronika|angelika|erika|mirka)$/.test(lw)) return null;
      return "name";
    }
    function pruefeWort(w, vorWort, ctx) {
      var teile = w.split("-"), res = null;
      for (var i = 0; i < teile.length; i++) {
        var r = pruefeTeil(teile[i], i === 0 ? vorWort : null, ctx, i === 0);
        if (r === "ort") res = "ort";
        else if (r === "name" && res !== "ort") res = "name";
      }
      return res;
    }

    var MONATE = "Januar|Jänner|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
    var DATUM_RX = new RegExp("(?<![\\d.])(?:(?:19|20)\\d{2}-\\d{2}-\\d{2}|\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?(?:\\d{4}|\\d{2})(?!\\d)|\\d{1,2}\\.\\s?(?:" + MONATE + ")(?:\\s+\\d{4})?|(?:" + MONATE + ")\\s+\\d{4}|\\d{1,2}\\.\\d{1,2}\\.(?!\\d)|(?:19|20)\\d{2}(?![\\d.,/]))", "u");
    var DATUM_VOLL_RX = new RegExp("(?<![\\d.])(?:(?:19|20)\\d{2}-\\d{2}-\\d{2}|\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?(?:\\d{4}|\\d{2})(?!\\d)|\\d{1,2}\\.\\s?(?:" + MONATE + ")(?:\\s+\\d{4})?|\\d{1,2}\\.\\d{1,2}\\.(?!\\d))", "u");
    var TRIGGER = [
      { art: "Geburtsdatum", rx: /(?:\bgeb(?:oren(?:e[rn]?)?)?\.?(?![\p{L}])|Geburtsdatum|Geburtstag|\bgeb\.-?\s?Dat\.?)/giu, jahr: true },
      { art: "Aufnahmedatum", rx: /(?:\bAufnahme(?:datum|tag)?\b|\baufgenommen\b|\bAufn\.|\bAufnahmedat\.)/gi, jahr: false },
      { art: "Entlassdatum", rx: /(?:\bEntlass(?:ung|ungsdatum|datum|ene[rn]?|en)?\b|\bentlassen\b|\bEntl\.)/gi, jahr: false }
    ];
    var STERN_RX = /(?<![\w*])\*\s?(?=\d)/g;

    function datenFinden(text, add) {
      var alle = [];
      TRIGGER.forEach(function (t) {
        t.rx.lastIndex = 0;
        var m;
        while ((m = t.rx.exec(text))) alle.push({ pos: m.index, ende: m.index + m[0].length, art: t.art, jahr: t.jahr });
      });
      STERN_RX.lastIndex = 0;
      var ms;
      while ((ms = STERN_RX.exec(text))) alle.push({ pos: ms.index, ende: ms.index + ms[0].length, art: "Geburtsdatum", jahr: true, stern: true });
      alle.sort(function (a, b) { return a.pos - b.pos; });
      var RUECK = /(\d{1,2}\.\s?\d{1,2}\.\s?(?:\d{4}|\d{2}))(\s+(?:\p{L}+\s+){0,2})(aufgenommen|entlassen)\b/giu;
      var mr;
      while ((mr = RUECK.exec(text))) add(mr.index, mr.index + mr[1].length, /^aufgen/i.test(mr[3]) ? "Aufnahmedatum" : "Entlassdatum", "Datum");
      alle.forEach(function (t, idx) {
        var fenster = text.slice(t.ende, t.ende + (t.stern ? 14 : 42));
        var cut = fenster.search(/\n|[!?]|\.(?=\s+\p{Lu}\p{Ll})/u);
        if (cut >= 0) fenster = fenster.slice(0, cut);
        var naechster = alle[idx + 1];
        if (naechster && naechster.pos < t.ende + fenster.length && !naechster.stern) fenster = fenster.slice(0, naechster.pos - t.ende);
        var rx = t.jahr ? DATUM_RX : DATUM_VOLL_RX;
        var m = rx.exec(fenster);
        if (!m || (t.stern && m.index !== 0)) return;
        if (!t.stern && fenster.slice(0, m.index).trim().split(/\s+/).filter(Boolean).length > 5) return;
        add(t.ende + m.index, t.ende + m.index + m[0].length, t.art, "Datum");
      });
    }

    var AZ_CODES = "(?:StVK|KLs|VRs|BRs|BvR|BvL|OWi|Js|Ws|Cs|Ds|Ls|Ns|Qs|Gs|Ks|Ss|AR)";
    var AZ_WERT = "(?=[^\\s]*\\d)[A-Za-zÄÖÜ0-9()/.\\-]*[A-Za-zÄÖÜ0-9)]";
    var NUMMER_RXS = [
      /[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+/g,
      new RegExp("(?<![\\w/])(?:\\d{1,4}\\s?)?" + AZ_CODES + "(?:\\s?\\([^)\\n]{1,12}\\))?\\s?\\d{1,6}\\s?/\\s?\\d{2,4}(?!\\d)", "g"),
      /(?<![\w/.,\-])\d{1,6}\s?\/\s?\d{2}(?!\d)\s*\(\s*\d{1,6}\s?\/\s?\d{2}\s*\)/g,
      /(?<!\w)[A-Z]\d{9}(?!\w)/g,
      /(?<![\w.,])\d{6,}(?![\w])/g,
      /(?<![\w\uE000-])[A-Z]{1,3}[-/ ]?\d{6,}(?!\w)/g,
      /(?<![\w])DE ?\d{2}(?: ?\d){18}(?!\d)/g,
      /(?<![\w.,/+\-])(?:\(0\d+\)[ \t]?\d[\d \t/\-]*\d|(?:\+49|0049|0)[ \t]?\(?\d{1,5}\)?(?:[ \t/\-]?\d{2,}){1,4})(?!\d)/g
    ];
    var WERT_LABELS = [
      new RegExp("(?<!\\w)(?:Aktenzeichen|Geschäftszeichen|Geschaeftszeichen|Unser Zeichen|Ihr Zeichen|Az\\.|Gz\\.)[ \\t]*:?[ \\t]*(" + AZ_WERT + "(?:[ \\t]+" + AZ_WERT + "){0,3})", "g"),
      /(?<!\w)(?:Krankenversichertennummer|Versichertennummer|Patientennummer|Aufnahmenummer|Fallnummer|Fall-Nr\.?|Fallnr\.?|Pat\.-Nr\.?|Pat\.[ \t]?Nr\.?|PID)[ \t]*[:.]?[ \t]*((?=[A-Za-z0-9/\-]*\d)[A-Za-z0-9][A-Za-z0-9/\-]*)/g
    ];
    var STRASSE = "(?:\\p{Lu}[\\p{L}\\-]*?(?:straße|strasse|str\\.|weg|allee|platz|ring|damm|gasse|ufer|chaussee)|\\p{Lu}\\p{Ll}+[ \\t]+(?:Straße|Strasse|Weg|Allee|Platz|Ring|Damm|Gasse|Ufer|Chaussee))";
    var EINHEIT = "(?![ \\t]*(?:Tag|Woche|Monat|Jahr|Stunde|Minute|Mal|mal|x\\b|mg|ml|Uhr|Stück|Tablette|Wochen|Tage|Monate|Jahre|Stunden|Minuten))";
    var HAUSNR = "[ \\t]*\\d{1,4}[ \\t]?[a-zA-Z]?(?:[ \\t]?[-/][ \\t]?\\d{1,4}[a-zA-Z]?)?(?![\\w])";
    var ADRESSE_RX = new RegExp("(?<![\\p{L}\\d])" + STRASSE + HAUSNR + EINHEIT + "(?:[ \\t]*,?[ \\t]*\\d{5}[ \\t]+\\p{Lu}\\p{L}+)?", "gu");
    var ADR_STOP = new Set(("montag dienstag mittwoch donnerstag freitag samstag sonntag januar februar märz april mai juni juli august september oktober november dezember " +
      "tag tage tagen abschnitt seite kapitel punkt absatz verlauf alter jahr jahre jahren monat monate woche wochen zeitpunkt moment gespräch grad stadium stufe fall test " +
      "schritt satz teil anhang ende anfang beginn morgen abend mittag nachmittag vormittag nacht mittel durchschnitt rahmen kontakt verfahren bereich gruppe zimmer raum " +
      "station bett haus gebäude block flur stock zeitraum rang bild befund versuch sitzung termin gesamt ganzen allgemeinen").split(/\s+/));
    var ADR2_RX = new RegExp("(?<![\\p{L}])(?:Am|An der|An dem|Auf dem|Auf der|Im|In der|Zur|Zum|Vor dem|Hinter dem)[ \\t]+(?:\\p{Lu}\\p{Ll}{2,}[ \\t]+)?(\\p{Lu}\\p{Ll}{2,})[ \\t]+\\d{1,3}[a-wyz]?(?![\\w])" + EINHEIT, "gu");
    var PLZORT_RX = /(?<![\d\p{L}-])(?:D-)?\d{5}[ \t]+(\p{Lu}[\p{L}\-]+)/gu;
    var GESPERRT_RX = /\[gesperrt:\s*([^\]]+)\]/gi;

    function gesperrtArt(s) {
      s = s.toLowerCase();
      if (/geburt/.test(s)) return "Geburtsdatum";
      if (/aufnahme/.test(s)) return "Aufnahmedatum";
      if (/entlass/.test(s)) return "Entlassdatum";
      if (/name/.test(s)) return "Name";
      if (/ort|stadt|adresse|anschrift|station/.test(s)) return "Ort";
      return "Nummer";
    }

    // ---- Hausliste
    function parseHausliste(str) {
      var eintraege = [], fehler = [];
      str.split(/\r?\n/).forEach(function (z, i) {
        var o = z.split("#")[0].trim();
        if (!o) return;
        var t = o.split("|").map(function (x) { return x.trim(); });
        var kat = (t[0] || "").toLowerCase(), modus = (t[2] || "").toLowerCase();
        if (t.length !== 3 || !t[1] || ["einrichtung", "ort", "adresse", "stadt", "station"].indexOf(kat) < 0 || ["immer", "kontext"].indexOf(modus) < 0) {
          fehler.push(i + 1); return;
        }
        eintraege.push([kat, t[1].normalize("NFC"), modus]);
      });
      return { eintraege: eintraege, fehler: fehler };
    }
    function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    function hauslisteFinden(text, liste, add) {
      liste.forEach(function (e) {
        var kat = e[0], eintrag = e[1], modus = e[2];
        var kern = eintrag.split(/\s+/).map(esc).join("[ \\t]+");
        var rx;
        if (kat === "station") {
          var stark = "(?:Station|Stationen|Stat\\.)";
          var schwach = LOCKERUNG.has(eintrag.toLowerCase()) ? "" : "|auf[ \\t]+der|auf[ \\t]+die|von[ \\t]+der";
          rx = new RegExp("(?<=(?:" + stark + schwach + ")[ \\t]+)" + kern + "(?![\\p{L}\\d])", "giu");
        } else if (modus === "immer") {
          rx = new RegExp("(?<![\\p{L}\\d])" + kern + "(?:s)?(?![\\p{L}\\d])", "giu");
        } else {
          var erster = esc(eintrag.charAt(0).toUpperCase());
          var rest = kern.slice(esc(eintrag.charAt(0)).length);
          rx = new RegExp("(?:(?<=(?:\\b[Ii]n|\\b[Nn]ach|\\b[Aa]us|\\b[Bb]ei|\\bStandort|\\bKlinikum)[ \\t]+|Berlin-)" + erster + rest + "(?![\\p{L}\\d])|" + erster + rest + "(?=[ \\t]+Klinikum(?![\\p{L}]))(?<![\\p{L}\\d]))", "gu");
        }
        var m;
        while ((m = rx.exec(text))) { if (m[0].length === 0) { rx.lastIndex++; continue; } add(m.index, m.index + m[0].length, "Ort", "Hausliste"); }
      });
    }

    // ---- Hauptfunktion
    function erkenne(text, opt) {
      opt = opt || {};
      var belegt = [];   // [s,e]
      var funde = [];
      function frei(s, e) {
        for (var i = 0; i < belegt.length; i++) if (s < belegt[i][1] && e > belegt[i][0]) return false;
        return true;
      }
      function add(s, e, art, grund) {
        if (e <= s || !frei(s, e)) return false;
        belegt.push([s, e]);
        funde.push({ start: s, end: e, art: art, grund: grund, text: text.slice(s, e) });
        return true;
      }
      var m;
      GESPERRT_RX.lastIndex = 0;
      while ((m = GESPERRT_RX.exec(text))) add(m.index, m.index + m[0].length, gesperrtArt(m[1]), "gesperrt");
      if (opt.hausliste && opt.hausliste.length) hauslisteFinden(text, opt.hausliste, add);
      NUMMER_RXS.forEach(function (rx) {
        rx.lastIndex = 0;
        while ((m = rx.exec(text))) add(m.index, m.index + m[0].length, "Nummer", "Muster");
      });
      WERT_LABELS.forEach(function (rx) {
        rx.lastIndex = 0;
        while ((m = rx.exec(text))) { var s = m.index + m[0].length - m[1].length; add(s, s + m[1].length, "Nummer", "Etikett"); }
      });
      ADRESSE_RX.lastIndex = 0;
      while ((m = ADRESSE_RX.exec(text))) add(m.index, m.index + m[0].length, "Ort", "Adresse");
      ADR2_RX.lastIndex = 0;
      while ((m = ADR2_RX.exec(text))) { if (!ADR_STOP.has(m[1].toLowerCase())) add(m.index, m.index + m[0].length, "Ort", "Adresse"); }
      PLZORT_RX.lastIndex = 0;
      while ((m = PLZORT_RX.exec(text))) {
        var lw = m[1].toLowerCase();
        if (D.woerter.has(lw) && !D.stadt.has(lw)) continue;
        add(m.index, m.index + m[0].length, "Ort", "PLZ");
      }
      datenFinden(text, add);

      // Wörter
      var tok = [];
      WORT_RX.lastIndex = 0;
      while ((m = WORT_RX.exec(text))) {
        var s = m.index, e = s + m[0].length;
        var vz = text.charAt(s - 1), nz = text.charAt(e);
        tok.push({ s: s, e: e, w: m[0], lw: m[0].toLowerCase(), ziffer: /\d/.test(vz) || /\d/.test(nz) });
      }
      function luecke(a, b) { return /^\.?[ \t]+$|^\.?[ \t]*\n[ \t]*$|^[ \t]*$/.test(text.slice(tok[a].e, tok[b].s)); }
      function istInitial(i) { var t = tok[i]; return t.w.length === 1 && t.w !== t.w.toLowerCase() && text.charAt(t.e) === "."; }
      function satzStart(pos) {
        var p = pos - 1;
        while (p >= 0 && /[ \t\u00a0"„“‚‘»«'()\[•*–—]/.test(text.charAt(p))) p--;
        if (p < 0) return true;
        var c = text.charAt(p);
        if (c === "\n" || c === "!" || c === "?" || c === ":" || c === "|") return true;
        if (c === ".") {
          var q = p - 1;
          while (q >= 0 && /\p{L}/u.test(text.charAt(q))) q--;
          var len = p - 1 - q;
          return !(len >= 1 && len <= 3);
        }
        return false;
      }
      var erzwungen = {};
      for (var i = 0; i < tok.length; i++) {
        var t = tok[i];
        if (TIER1.has(t.w) && i + 1 < tok.length) {
          var j = i + 1;
          if (!luecke(i, j)) continue;
          while (j < tok.length && TITEL_SKIP.has(tok[j].lw) && j + 1 < tok.length && luecke(j, j + 1)) j++;
          var x = tok[j];
          if (!x || istInitial(j) || FUNKTION.has(x.lw) || x.ziffer) continue;
          var gross = x.w.charAt(0) !== x.w.charAt(0).toLowerCase();
          if (gross || (!bekannt(x.lw) && !zerlegbar(x.lw) && x.lw.length >= 3)) erzwungen[j] = true;
        } else if (ROLLE2.has(t.lw) && i + 1 < tok.length && luecke(i, i + 1)) {
          var y = tok[i + 1];
          var lower = y.w.charAt(0) === y.w.charAt(0).toLowerCase();
          if (lower && !FUNKTION.has(y.lw) && !bekannt(y.lw) && !zerlegbar(y.lw) && y.lw.length >= 3 && !y.ziffer) erzwungen[i + 1] = true;
        }
        if (/(?:^|-)(?:jva|klinikum|krankenhaus|bahnhof|haltestelle|standort|ambulanz|wohnheim)$/.test(t.lw)) {
          var q = i + 1;
          while (q < tok.length && /^(?:am|an|im|zur|zum|der|dem)$/.test(tok[q].lw) && luecke(q - 1, q)) q++;
          if (q < tok.length && luecke(q - 1, q) && !istInitial(q) && !tok[q].ziffer && !FUNKTION.has(tok[q].lw) && tok[q].w.charAt(0) !== tok[q].w.charAt(0).toLowerCase()) erzwungen[q] = true;
        }
        if (FAM.has(t.lw) && i + 2 < tok.length && tok[i + 1].lw === "von" && luecke(i, i + 1) && luecke(i + 1, i + 2)) {
          var z = tok[i + 2];
          if (z.w.charAt(0) !== z.w.charAt(0).toLowerCase() && !FUNKTION.has(z.lw) && !istInitial(i + 2)) erzwungen[i + 2] = true;
        }
      }
      for (var k = 0; k < tok.length; k++) {
        var tk = tok[k];
        if (tk.ziffer) continue;
        var vorW = null;
        if (k > 0 && luecke(k - 1, k)) vorW = tok[k - 1].lw;
        var ctx = { vorKlein: k > 0 && vorW !== null && tok[k - 1].w.charAt(0) === tok[k - 1].w.charAt(0).toLowerCase(), vorWort: vorW, satzanfang: satzStart(tk.s), vorZiffer: /\d[ \t]*$/.test(text.slice(Math.max(0, tk.s - 4), tk.s)) };
        var art = null;
        if (FAM.has(tk.lw) && k + 1 < tok.length && tok[k + 1].lw === "von" && luecke(k, k + 1)) continue;
        if (erzwungen[k]) {
          art = pruefeWort(tk.w, vorW, ctx) === "ort" ? "Ort" : "Name";
        } else {
          if (istInitial(k) || tk.w.length === 1) continue;
          var r = pruefeWort(tk.w, vorW, ctx);
          if (r) art = r === "ort" ? "Ort" : "Name";
        }
        if (art) add(tk.s, tk.e, art, erzwungen[k] ? "Anrede/Rolle" : "Wörterbuch");
      }
      funde.sort(function (a, b) { return a.start - b.start; });
      return funde;
    }

    // Ersetzen: funde mit aktiv !== false werden ersetzt; gleiche Zeichenfolge, gleiche Nummer
    function beschriftung(funde) {
      var zaehler = {}, nummern = {}, gesamt = {};
      funde.forEach(function (f) {
        if (f.aktiv === false) return;
        if (f.art === "Name" || f.art === "Ort" || f.art === "Nummer") {
          var key = f.art + "|" + f.text.toLowerCase().replace(/\s+/g, " ");
          gesamt[f.art] = gesamt[f.art] || {};
          if (!(key in gesamt[f.art])) gesamt[f.art][key] = Object.keys(gesamt[f.art]).length + 1;
          f.nr = gesamt[f.art][key];
        }
      });
      funde.forEach(function (f) {
        if (f.aktiv === false) { f.label = null; return; }
        var mehr = gesamt[f.art] && Object.keys(gesamt[f.art]).length > 1;
        f.label = "[" + f.art + (mehr && f.nr ? " " + f.nr : "") + "]";
      });
      return funde;
    }
    function ersetze(text, funde) {
      beschriftung(funde);
      var out = "", pos = 0;
      funde.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (f) {
        if (f.aktiv === false || f.start < pos) return;
        out += text.slice(pos, f.start) + f.label;
        pos = f.end;
      });
      return out + text.slice(pos);
    }
    return { erkenne: erkenne, ersetze: ersetze, beschriftung: beschriftung, parseHausliste: parseHausliste,
             _intern: { pruefeWort: pruefeWort, zerlegbar: zerlegbar, bekannt: bekannt } };
  }

  return { laden: laden };
});
