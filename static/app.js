(function () {
  var PC = { "Crunchyroll": "cr", "Netflix": "nf", "ADN": "adn", "Prime Video": "pv", "Disney+": "dp" };
  function pcl(p) { return PC[p] || "other"; }
  // Normalisation valable pour toutes les écritures (latin, japonais, chinois, coréen…)
  function norm(s) { return (s || "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim(); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function chip(p) { return '<span class="chip p-' + pcl(p) + '"><i></i>' + esc(p) + "</span>"; }
  // ---------- Région du visiteur ----------
  var W = window.TZW || { s: {}, r: [] };
  function detectRegion() {
    var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    if (/^Asia\/Tokyo/.test(tz)) return "jp";
    if (/^Asia\/(Shanghai|Chongqing|Urumqi|Harbin)/.test(tz)) return "cn";
    if (/^Europe\/(London|Dublin)/.test(tz)) return "uk";
    if (/^Europe\/(Berlin|Vienna)/.test(tz)) return "de";
    if (/^Europe\/(Paris|Brussels|Luxembourg|Zurich|Monaco)|^Africa\/|^Indian\/(Reunion|Mayotte)|^America\/(Guadeloupe|Martinique|Cayenne)|^Pacific\/(Noumea|Tahiti)/.test(tz)) return "fr";
    if (/^Europe\//.test(tz)) return "eu";
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Detroit|Indiana|Kentucky|Boise)|^Pacific\/Honolulu/.test(tz)) return "us";
    if (/^America\/Montreal/.test(tz)) return "fr";
    if (/^America\//.test(tz)) return "latam";
    if (/^(Asia|Australia|Pacific)\//.test(tz)) return "asia";
    return "fr";
  }
  var REGION = "fr";
  try { REGION = localStorage.getItem("tz-region") || detectRegion(); } catch (e) { REGION = detectRegion(); }
  function inRegion(name) { var d = W.s[name]; return !!d && d[1].indexOf(REGION) > -1; }
  function regional(list) { return (list || []).filter(inRegion); }
  function chipW(n) { var d = W.s[n]; return '<span class="chip p-' + (d ? d[0] : "other") + '"><i></i>' + esc(n) + "</span>"; }
  function applyRegion() {
    document.querySelectorAll("select[data-region]").forEach(function (s) { s.value = REGION; });
    document.querySelectorAll(".chipset[data-w]").forEach(function (el) {
      if (el._fr === undefined) el._fr = el.innerHTML;
      if (REGION === "fr") { el.innerHTML = el._fr; return; }
      var list = regional(el.dataset.w ? el.dataset.w.split("|") : []).slice(0, +el.dataset.max || 3);
      el.innerHTML = list.length ? list.map(chipW).join("") : '<span class="chip muted">À chercher</span>';
    });
    var wt = document.querySelector(".wtable");
    if (wt) {
      wt.querySelectorAll(".wrow").forEach(function (r) { r.classList.toggle("me", r.dataset.region === REGION); });
      var me = wt.querySelector('.wrow[data-region="' + REGION + '"]');
      if (me) wt.insertBefore(me, wt.firstChild);
      // Hors de France, la section « dans le monde » passe en premier
      var world = wt.closest(".world"), frBox = world && world.parentNode.querySelector(".frbox");
      if (world && frBox && frBox.parentNode === world.parentNode) {
        if (REGION !== "fr") world.parentNode.insertBefore(world, frBox);
        else if (world.compareDocumentPosition(frBox) & 2) world.parentNode.insertBefore(frBox, world);
      }
    }
  }
  document.querySelectorAll("select[data-region]").forEach(function (s) {
    s.addEventListener("change", function () {
      REGION = s.value;
      try { localStorage.setItem("tz-region", REGION); } catch (e) {}
      applyRegion();
    });
  });
  applyRegion();
  function chips(x) {
    if (REGION !== "fr") { var l = regional(x.w).slice(0, 3); return l.length ? l.map(chipW).join("") : '<span class="chip muted">À chercher</span>'; }
    return x.p.length ? x.p.map(chip).join("") : x.f ? '<span class="chip muted">Franchise : ' + esc(x.f.join(", ")) + "</span>" : '<span class="chip muted">À chercher</span>'; }

  var IMG = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/";
  // Index de recherche, chargé une seule fois et seulement quand on en a besoin
  var idxPromise = null;
  function loadIdx(rel) {
    if (!idxPromise) idxPromise = fetch(rel + "search.json").then(function (r) { return r.json(); }).then(function (d) {
      d.forEach(function (x) { x._n = norm(x.t); x._a = norm(x.a); if (x.i && x.i.indexOf("http") !== 0) x.i = IMG + x.i; });
      return d;
    });
    return idxPromise;
  }
  function find(idx, q, max) {
    var v = norm(q); if (!v) return [];
    var starts = [], inName = [], inAlt = [];
    for (var i = 0; i < idx.length; i++) {
      var x = idx[i];
      if (x._n.indexOf(v) === 0) starts.push(x);
      else if (x._n.indexOf(v) > -1) inName.push(x);
      else if (x._a.indexOf(v) > -1) inAlt.push(x);
      if (starts.length >= max) break;
    }
    return starts.concat(inName, inAlt).slice(0, max);
  }
  function renderRes(list, rel) {
    return list.length ? list.map(function (x) {
      return '<a class="res" href="' + rel + x.u + '">' + (x.i ? '<img src="' + esc(x.i) + '" alt="" loading="lazy">' : '<span class="ph"></span>') +
        "<span><b>" + esc(x.t) + "</b>" + (x.y ? "<small>" + esc(x.y) + "</small>" : "") + '</span><span class="chips">' + chips(x) + "</span></a>";
    }).join("") : '<p class="empty">Aucun animé trouvé. Essaie avec un autre titre : français, anglais, romaji, japonais ou chinois.</p>';
  }
  function bindSearch(input, out, rel, max) {
    var run = function () {
      if (!input.value.trim()) { out.innerHTML = ""; out.hidden = true; return; }
      loadIdx(rel).then(function (idx) { out.innerHTML = renderRes(find(idx, input.value, max), rel); out.hidden = false; });
    };
    input.addEventListener("input", run);
    input.addEventListener("focus", function () { loadIdx(rel); if (input.value.trim()) run(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var a = out.querySelector("a.res"); if (a) location.href = a.href; }
      if (e.key === "Escape") { out.hidden = true; input.blur(); }
    });
    document.addEventListener("click", function (e) { if (!out.contains(e.target) && e.target !== input) out.hidden = true; });
  }
  // Recherche de l'en-tête (toutes les pages)
  document.querySelectorAll("input[data-search]").forEach(function (inp) {
    bindSearch(inp, inp.parentNode.querySelector(".hres"), inp.dataset.rel || "", 8);
  });
  // Grande recherche de l'accueil
  var q = document.getElementById("q"), R = document.getElementById("results");
  if (q && R) {
    bindSearch(q, R, "", 8);
    if (location.hash === "#q") q.focus();
  }

  // Filtres du catalogue
  var fOut = document.getElementById("f-out");
  if (fOut) {
    var els = ["f-p", "f-g", "f-y", "f-s", "f-a"].map(function (id) { return document.getElementById(id); });
    var grid = document.getElementById("f-grid"), count = document.getElementById("f-count"), more = document.getElementById("f-more"), shown = 48, last = [];
    var card = function (x) {
      return '<a class="pcard" href="' + x.u + '"><span class="poster">' + (x.i ? '<img src="' + esc(x.i) + '" alt="" loading="lazy">' : "<b>" + esc(x.t.charAt(0)) + "</b>") + '</span><span class="pc-b"><b>' + esc(x.t) + "</b><small>" + esc(x.y || "") + '</small><span class="chips">' + chips(x) + "</span></span></a>";
    };
    var draw = function () { grid.innerHTML = last.slice(0, shown).map(card).join(""); more.hidden = last.length <= shown; };
    var apply = function () {
      var p = els[0].value, g = els[1].value, y = els[2].value, s = els[3].value, a = els[4].checked;
      if (!p && !g && !y && !s && !a) { fOut.hidden = true; return; }
      loadIdx("").then(function (idx) {
        var y0 = y ? +y : 0, y1 = y === "2020" ? 9999 : y === "1980" ? 1989 : y0 + 9;
        if (y === "1980") y0 = 0;
        last = idx.filter(function (x) {
          if (p && (x.w || []).indexOf(p) < 0 && x.p.indexOf(p) < 0) return false;
          if (g && (x.g || []).indexOf(g) < 0) return false;
          if (y && !(x.y >= y0 && x.y <= y1)) return false;
          if (s && x.s !== s) return false;
          if (a && !(REGION === "fr" ? x.p.length : regional(x.w).length)) return false;
          return true;
        });
        shown = 48; count.textContent = last.length.toLocaleString("fr-FR") + " animé" + (last.length > 1 ? "s" : "") + " trouvé" + (last.length > 1 ? "s" : "");
        fOut.hidden = false; draw();
      });
    };
    els.forEach(function (e) { e.addEventListener("change", apply); });
    more.addEventListener("click", function () { shown += 48; draw(); });
  }

  // Calendrier : onglets par jour, aujourd'hui par défaut
  var tabs = document.querySelectorAll(".day[data-day]");
  if (tabs.length) {
    var today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    var show = function (k) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.day === k ? "true" : "false"); });
      document.querySelectorAll(".dayp").forEach(function (p) { p.hidden = p.dataset.day !== k; });
    };
    tabs.forEach(function (t) { t.addEventListener("click", function () { show(t.dataset.day); }); });
    if (document.querySelector('.day[data-day="' + today + '"]')) show(today);
  }

  // Compte à rebours du prochain épisode
  var cd = document.querySelector(".countdown[data-at]");
  if (cd) {
    var at = +cd.dataset.at * 1000;
    (function tick() {
      var s = Math.floor((at - Date.now()) / 1000);
      if (s <= 0) { cd.textContent = "Disponible maintenant"; return; }
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
      cd.textContent = "Dans " + (d ? d + " j " : "") + h + " h " + m + " min";
      setTimeout(tick, 30000);
    })();
  }

  // Qu'est-ce qu'on regarde ce soir ?
  var pd = document.getElementById("pickdata"), mb = document.getElementById("moods"), pk = document.getElementById("pick");
  if (pd && mb && pk) {
    var moods = JSON.parse(pd.textContent), cur = 0, n = 0;
    var drawPick = function () {
      var m = moods[cur], it = m.items[n % m.items.length];
      pk.innerHTML = (it.i ? '<img src="' + esc(it.i) + '" alt="">' : "<span></span>") + '<div><span class="k">Envie de ' + esc(m.label) + '</span><a class="t" href="' + it.u + '">' + esc(it.t) + "</a><p>Disponible sur " + esc(it.p) + '</p><button class="btn" type="button" id="again">Autre idée</button></div>';
      document.getElementById("again").onclick = function () { n++; drawPick(); };
    };
    moods.forEach(function (m, i) {
      var b = document.createElement("button");
      b.className = "day"; b.type = "button"; b.textContent = m.label.charAt(0).toUpperCase() + m.label.slice(1);
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.onclick = function () { cur = i; n = Math.floor(Math.random() * 5); [].forEach.call(mb.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); drawPick(); };
      mb.appendChild(b);
    });
    if (moods.length) drawPick();
  }
})();
// Heures converties dans le fuseau horaire du visiteur (Canada, Afrique, etc.)
(function () {
  var tz; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return; }
  var f = function (z) { return new Intl.DateTimeFormat("fr-FR", { timeZone: z, hour: "2-digit", minute: "2-digit" }); };
  var paris = f("Europe/Paris"), local = f(tz), now = new Date();
  if (paris.format(now) === local.format(now)) return;
  document.querySelectorAll("time[data-t]").forEach(function (t) {
    var d = new Date(+t.dataset.t * 1000);
    t.textContent = local.format(d);
    t.title = "Heure locale (" + paris.format(d) + " à Paris)";
  });
})();
