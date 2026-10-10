(function () {
  // Langue de la page (fr par défaut, en pour la version anglaise)
  var EN = document.documentElement.lang === "en";
  var T = EN ? {
    search: "Not found yet", none: "Not found yet", fr: "Franchise: ", empty: "No anime found. Try another title: English, romaji, Japanese or Chinese.",
    found: function (n) { return n.toLocaleString("en-US") + " anime found"; }, now: "Available now", inT: "In ", d: " d ", h: " h ", mn: " min",
    mood: "In the mood for ", on: "Available on ", again: "Another idea", local: function (p) { return "Your local time (" + p + " in Paris)"; }
  } : {
    search: "À chercher", none: "À chercher", fr: "Franchise : ", empty: "Aucun animé trouvé. Essaie avec un autre titre : français, anglais, romaji, japonais ou chinois.",
    found: function (n) { return n.toLocaleString("fr-FR") + " animé" + (n > 1 ? "s" : "") + " trouvé" + (n > 1 ? "s" : ""); }, now: "Disponible maintenant", inT: "Dans ", d: " j ", h: " h ", mn: " min",
    mood: "Envie de ", on: "Disponible sur ", again: "Autre idée", local: function (p) { return "Heure locale (" + p + " à Paris)"; }
  };
  var IDX = document.documentElement.getAttribute("data-idx") || "";
  var BASE_REGION = EN ? "us" : "fr";
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
  // Pays du visiteur (fuseau horaire puis langue du navigateur), affiché dans le choix de région
  var TZ_CC = { "Europe/Brussels": "BE", "Europe/Paris": "FR", "Europe/Luxembourg": "LU", "Europe/Zurich": "CH", "Europe/Monaco": "MC", "Europe/Berlin": "DE", "Europe/Vienna": "AT", "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Lisbon": "PT", "Europe/Warsaw": "PL", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Prague": "CZ", "Europe/Athens": "GR", "Europe/Bucharest": "RO", "Europe/Budapest": "HU", "Europe/Istanbul": "TR", "Asia/Tokyo": "JP", "Asia/Shanghai": "CN", "Asia/Seoul": "KR", "Asia/Manila": "PH", "Asia/Jakarta": "ID", "Asia/Kuala_Lumpur": "MY", "Asia/Singapore": "SG", "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Taipei": "TW", "Asia/Hong_Kong": "HK", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Pacific/Auckland": "NZ", "America/Sao_Paulo": "BR", "America/Mexico_City": "MX", "America/Argentina/Buenos_Aires": "AR", "America/Buenos_Aires": "AR", "America/Santiago": "CL", "America/Bogota": "CO", "America/Lima": "PE", "America/Toronto": "CA", "America/Vancouver": "CA", "America/Montreal": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA", "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US", "Africa/Dakar": "SN", "Africa/Abidjan": "CI", "Africa/Casablanca": "MA", "Africa/Algiers": "DZ", "Africa/Tunis": "TN", "Africa/Accra": "GH", "Africa/Lagos": "NG", "Africa/Douala": "CM", "Africa/Kinshasa": "CD" };
  function detectCountry() {
    var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    if (TZ_CC[tz]) return TZ_CC[tz];
    var m = /-([A-Z]{2})\b/.exec((navigator.languages && navigator.languages[0]) || navigator.language || "");
    return m ? m[1] : "";
  }
  function countryName(cc) {
    if (!cc) return "";
    try { return new Intl.DisplayNames([EN ? "en" : "fr"], { type: "region" }).of(cc) || cc; } catch (e) { return cc; }
  }
  var AUTO = detectRegion(), MANUAL = false, REGION = AUTO;
  try { var saved = localStorage.getItem("tz-region"); if (saved) { REGION = saved; MANUAL = true; } } catch (e) {}
  var COUNTRY = countryName(detectCountry());
  // Ajoute « 📍 Ton pays » en tête de chaque sélecteur de région
  document.querySelectorAll("select[data-region]").forEach(function (s) {
    if (!COUNTRY || s.querySelector('option[value="auto"]')) return;
    var o = document.createElement("option");
    o.value = "auto";
    o.textContent = "📍 " + COUNTRY;
    s.insertBefore(o, s.firstChild);
    var lab = s.closest("label");
    if (lab) lab.title = (EN ? "Detected: " : "Pays détecté : ") + COUNTRY + (EN ? " (you can change it)" : " (tu peux le changer)");
  });
  function inRegion(tag) { var p = String(tag).split("~"), d = W.s[p[0]]; return !!d && d[1].indexOf(REGION) > -1 && !(p[1] && p[1].split(",").indexOf(REGION) > -1); }
  function regional(list) { return (list || []).filter(inRegion).map(function (t) { return String(t).split("~")[0]; }); }
  window.TZR = regional;
  function chipW(n) { var d = W.s[n]; return '<span class="chip p-' + (d ? d[0] : "other") + '"><i></i>' + esc(n) + "</span>"; }
  function applyRegion() {
    document.querySelectorAll("select[data-region]").forEach(function (s) { s.value = (!MANUAL && s.querySelector('option[value="auto"]')) ? "auto" : REGION; });
    document.querySelectorAll(".chipset[data-w]").forEach(function (el) {
      if (el._fr === undefined) el._fr = el.innerHTML;
      if (REGION === BASE_REGION) { el.innerHTML = el._fr; return; }
      var list = regional(el.dataset.w ? el.dataset.w.split("|") : []).slice(0, +el.dataset.max || 3);
      el.innerHTML = list.length ? list.map(chipW).join("") : '<span class="chip muted">' + T.search + "</span>";
    });
    // Boutons « regarder » propres à une région (version anglaise)
    document.querySelectorAll("[data-rbox]").forEach(function (box) {
      var any = false;
      box.querySelectorAll("[data-r]").forEach(function (a) { var ok = a.dataset.r.split(" ").indexOf(REGION) > -1; a.hidden = !ok; any = any || ok; });
      var none = box.querySelector("[data-rnone]"); if (none) none.hidden = any;
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
      if (s.value === "auto") {
        REGION = AUTO; MANUAL = false;
        try { localStorage.removeItem("tz-region"); } catch (e) {}
      } else {
        REGION = s.value; MANUAL = true;
        try { localStorage.setItem("tz-region", REGION); } catch (e) {}
      }
      applyRegion();
    });
  });
  applyRegion();
  function chips(x) {
    if (REGION !== "fr") { var l = regional(x.w).slice(0, 3); return l.length ? l.map(chipW).join("") : '<span class="chip muted">' + T.search + "</span>"; }
    return x.p.length ? x.p.map(chip).join("") : x.f ? '<span class="chip muted">' + T.fr + esc(x.f.join(", ")) + "</span>" : '<span class="chip muted">' + T.search + "</span>"; }

  var IMG = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/";
  // Index de recherche, chargé une seule fois et seulement quand on en a besoin
  var idxPromise = null;
  function loadIdx(rel) {
    if (!idxPromise) idxPromise = fetch(IDX || rel + "search.json").then(function (r) { return r.json(); }).then(function (d) {
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
    }).join("") : '<p class="empty">' + T.empty + "</p>";
  }
  function bindSearch(input, out, rel, max, keep) {
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
    if (!keep) document.addEventListener("click", function (e) { if (!out.contains(e.target) && e.target !== input) out.hidden = true; });
  }
  // Recherche de l'en-tête (toutes les pages)
  document.querySelectorAll("input[data-search]").forEach(function (inp) {
    bindSearch(inp, inp.parentNode.querySelector(".hres"), inp.dataset.rel || "", 8);
  });
  // Grande recherche de l'accueil
  var q = document.getElementById("q"), R = document.getElementById("results");
  if (q && R) {
    bindSearch(q, R, "", 8, true);
    if (location.hash === "#q") q.focus();
  }
  // « Surprends-moi » : un animé au hasard, avec une plateforme légale dans la région du visiteur
  var rnd = document.getElementById("rnd");
  if (rnd) rnd.addEventListener("click", function () {
    loadIdx("").then(function (idx) {
      var top = idx.slice(0, 3000);
      var pool = top.filter(function (x) { return regional(x.w).length; });
      if (!pool.length) pool = top.filter(function (x) { return x.p && x.p.length; });
      var x = pool[Math.floor(Math.random() * pool.length)];
      if (x) location.href = x.u;
    });
  });

  // Filtres du catalogue
  var fOut = document.getElementById("f-out");
  if (fOut) {
    var els = ["f-p", "f-g", "f-y", "f-s", "f-a"].map(function (id) { return document.getElementById(id); });
    var grid = document.getElementById("f-grid"), count = document.getElementById("f-count"), more = document.getElementById("f-more"), shown = 48, last = [];
    var card = function (x) {
      return '<a class="pcard" href="' + x.u + '"><span class="poster">' + (x.i ? '<img src="' + esc(x.i.replace(/\/cover\/(small|medium)\//, "/cover/large/")) + '" alt="" loading="lazy">' : "<b>" + esc(x.t.charAt(0)) + "</b>") + '</span><span class="pc-b"><b>' + esc(x.t) + "</b><small>" + esc(x.y || "") + '</small><span class="chips">' + chips(x) + "</span></span></a>";
    };
    var draw = function () { grid.innerHTML = last.slice(0, shown).map(card).join(""); more.hidden = last.length <= shown; };
    var apply = function () {
      var p = els[0].value, g = els[1].value, y = els[2].value, s = els[3].value, a = els[4].checked;
      if (!p && !g && !y && !s && !a) { fOut.hidden = true; return; }
      loadIdx("").then(function (idx) {
        var y0 = y ? +y : 0, y1 = y === "2020" ? 9999 : y === "1980" ? 1989 : y0 + 9;
        if (y === "1980") y0 = 0;
        last = idx.filter(function (x) {
          if (p && (x.w || []).map(function (t) { return String(t).split("~")[0]; }).indexOf(p) < 0 && x.p.indexOf(p) < 0) return false;
          if (g && (x.g || []).indexOf(g) < 0) return false;
          if (y && !(x.y >= y0 && x.y <= y1)) return false;
          if (s && x.s !== s) return false;
          if (a && !(REGION === "fr" ? x.p.length : regional(x.w).length)) return false;
          return true;
        });
        shown = 48; count.textContent = T.found(last.length);
        fOut.hidden = false; draw();
      });
    };
    els.forEach(function (e) { e.addEventListener("change", apply); });
    more.addEventListener("click", function () { shown += 48; draw(); });
  }

  // Calendrier : jours recalculés dans le fuseau horaire du visiteur (hors Paris/Bruxelles)
  (function () {
    var bar = document.querySelector(".days"), secs = document.querySelectorAll(".dayp");
    if (!bar || !secs.length) return;
    var tz; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return; }
    if (!tz || tz === "Europe/Brussels" || tz === "Europe/Paris") return;
    var EN = document.documentElement.lang === "en";
    var key = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    var lab = new Intl.DateTimeFormat(EN ? "en-US" : "fr-FR", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
    var todayK = key.format(new Date()), groups = {}, order = [];
    secs.forEach(function (s) {
      s.querySelectorAll(".ep").forEach(function (r) {
        var t = r.querySelector("time[data-t]"); if (!t) return;
        var d = new Date(+t.dataset.t * 1000), k = key.format(d);
        if (k < todayK) return;
        if (!groups[k]) { groups[k] = { l: lab.format(d), r: [] }; order.push(k); }
        groups[k].r.push(r);
      });
    });
    if (!order.length) return;
    order.sort();
    var cap = function (x) { return x.charAt(0).toUpperCase() + x.slice(1); };
    var parent = secs[0].parentNode, anchor = secs[secs.length - 1].nextSibling;
    bar.innerHTML = "";
    secs.forEach(function (s) { s.remove(); });
    order.forEach(function (k, i) {
      var b = document.createElement("button");
      b.className = "day"; b.type = "button"; b.setAttribute("role", "tab"); b.dataset.day = k;
      b.setAttribute("aria-selected", i === 0 ? "true" : "false"); b.textContent = groups[k].l;
      bar.appendChild(b);
      var s = document.createElement("section"), h = document.createElement("h2"), e = document.createElement("div");
      s.className = "dayp"; s.dataset.day = k; s.hidden = i !== 0;
      h.className = "sec"; h.textContent = cap(groups[k].l); e.className = "eps";
      groups[k].r.forEach(function (r) { e.appendChild(r); });
      s.appendChild(h); s.appendChild(e); parent.insertBefore(s, anchor);
    });
  })();

  // Calendrier : onglets par jour, aujourd'hui par défaut
  var tabs = document.querySelectorAll(".day[data-day]");
  if (tabs.length) {
    var today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    var show = function (k) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.day === k ? "true" : "false"); });
      document.querySelectorAll(".dayp").forEach(function (p) { p.hidden = p.dataset.day !== k; });
    };
    var cur = tabs[0].dataset.day;
    tabs.forEach(function (t) { t.addEventListener("click", function () { cur = t.dataset.day; show(cur); }); });
    if (document.querySelector('.day[data-day="' + today + '"]')) { cur = today; show(today); }
    // Recherche dans les sorties de la semaine
    var calq = document.getElementById("calq");
    if (calq) {
      var daysBar = document.querySelector(".days");
      var none = document.getElementById("calnone");
      var rows = document.querySelectorAll(".dayp .ep");
      rows.forEach(function (r) { r._n = norm(r.dataset.n || r.textContent); });
      var filter = function () {
        var v = norm(calq.value);
        if (!v) {
          rows.forEach(function (r) { r.hidden = false; });
          if (daysBar) daysBar.hidden = false;
          none.hidden = true;
          show(cur);
          return;
        }
        var total = 0;
        if (daysBar) daysBar.hidden = true;
        document.querySelectorAll(".dayp").forEach(function (p) {
          var n = 0;
          p.querySelectorAll(".ep").forEach(function (r) { var ok = r._n.indexOf(v) !== -1; r.hidden = !ok; if (ok) n++; });
          p.hidden = n === 0; total += n;
        });
        none.hidden = total > 0;
      };
      calq.addEventListener("input", filter);
    }
  }

  // Mangas : recherche dans la liste (fichier manga-search.json chargé à la première frappe)
  var mq = document.getElementById("mq");
  if (mq) {
    var mres = document.getElementById("mres"), mtop = document.getElementById("mtop"), mdata = null, mload = null;
    var mget = function () {
      if (mdata) return Promise.resolve(mdata);
      if (!mload) mload = fetch(mq.dataset.idx).then(function (r) { return r.json(); }).then(function (d) {
        d.forEach(function (x) { x._n = norm(x.t); x._a = norm(x.a); });
        mdata = d; return d;
      });
      return mload;
    };
    var mcard = function (x) {
      return '<a class="pcard" href="' + esc(x.u) + '"><span class="poster">' + (x.i ? '<img src="' + esc(x.i) + '" alt="" loading="lazy" decoding="async">' : "<b>" + esc(x.t.slice(0, 1)) + "</b>") + '</span><span class="pc-b"><b>' + esc(x.t) + "</b><small>" + esc(x.k) + '</small><span class="chips">' + x.p.map(function (p) { return '<span class="chip p-other"><i></i>' + esc(p) + "</span>"; }).join("") + "</span></span></a>";
    };
    mq.addEventListener("input", function () {
      var v = norm(mq.value);
      if (!v) { mres.hidden = true; mres.innerHTML = ""; if (mtop) mtop.hidden = false; return; }
      mget().then(function (d) {
        if (norm(mq.value) !== v) return;
        var hit = d.filter(function (x) { return x._n.indexOf(v) !== -1 || x._a.indexOf(v) !== -1; }).slice(0, 48);
        mres.hidden = false; if (mtop) mtop.hidden = true;
        mres.innerHTML = hit.length ? hit.map(mcard).join("") : '<p class="small">' + (EN ? "No manga found. Try another title (English, romaji or Japanese)." : "Aucun manga trouvé. Essaie un autre titre (anglais, romaji ou japonais).") + "</p>";
      }).catch(function () {});
    });
  }

  // Compte à rebours du prochain épisode
  var cd = document.querySelector(".countdown[data-at]");
  if (cd) {
    var at = +cd.dataset.at * 1000;
    (function tick() {
      var s = Math.floor((at - Date.now()) / 1000);
      if (s <= 0) { cd.textContent = T.now; return; }
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
      cd.textContent = T.inT + (d ? d + T.d : "") + h + T.h + m + T.mn;
      setTimeout(tick, 30000);
    })();
  }

  // Qu'est-ce qu'on regarde ce soir ?
  var pd = document.getElementById("pickdata"), mb = document.getElementById("moods"), pk = document.getElementById("pick");
  if (pd && mb && pk) {
    var moods = JSON.parse(pd.textContent), cur = 0, n = 0;
    var drawPick = function () {
      var m = moods[cur], it = m.items[n % m.items.length];
      pk.innerHTML = (it.i ? '<img src="' + esc(it.i) + '" alt="">' : "<span></span>") + '<div><span class="k">' + T.mood + esc(m.label) + '</span><a class="t" href="' + it.u + '">' + esc(it.t) + "</a><p>" + T.on + esc(it.p) + '</p><button class="btn" type="button" id="again">' + T.again + "</button></div>";
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
  var EN = document.documentElement.lang === "en";
  var f = function (z) { return new Intl.DateTimeFormat(EN ? "en-GB" : "fr-FR", { timeZone: z, hour: "2-digit", minute: "2-digit" }); };
  var paris = f("Europe/Paris"), local = f(tz), now = new Date();
  if (paris.format(now) === local.format(now)) return;
  document.querySelectorAll("time[data-t]").forEach(function (t) {
    var d = new Date(+t.dataset.t * 1000);
    t.textContent = local.format(d);
    t.title = EN ? "Your local time (" + paris.format(d) + " in Paris)" : "Heure locale (" + paris.format(d) + " à Paris)";
  });
  var day = new Intl.DateTimeFormat(EN ? "en-US" : "fr-FR", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
  document.querySelectorAll("time[data-d]").forEach(function (t) { t.textContent = day.format(new Date(+t.dataset.d * 1000)); });
  var city = tz.split("/").pop().replace(/_/g, " ");
  document.querySelectorAll("[data-tzl]").forEach(function (s) { s.textContent = EN ? "(" + city + " time)" : "(heure de " + city + ")"; });
  // Accueil : « Les sorties du jour » selon le jour du visiteur
  var box = document.querySelector("[data-today]");
  if (box) {
    var key = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    var todayK = key.format(now), mine = [];
    box.querySelectorAll(".ep").forEach(function (r) {
      var t = r.querySelector("time[data-t]");
      if (t && mine.length < 8 && key.format(new Date(+t.dataset.t * 1000)) === todayK) mine.push(r);
    });
    var lbl = document.querySelector("[data-tdl]"), dl = day.format(now);
    if (mine.length) box.querySelectorAll(".ep").forEach(function (r) { r.hidden = mine.indexOf(r) < 0; });
    if (lbl && mine.length) lbl.textContent = dl.charAt(0).toUpperCase() + dl.slice(1) + (EN ? ", " + city + " time." : ", heure de " + city + ".");
  }
})();
// « Ma liste » (favoris sans compte, gardés dans ce navigateur) et bouton « Partager »
(function () {
  var EN = document.documentElement.lang === "en";
  var L = EN ? { add: "Add to my list", on: "In my list", share: "Share", copied: "Link copied!", rm: "Remove", shareList: "Share my list", cal: "Add to calendar", subs: function (p, n, t) { return "With " + p + ", you can watch " + n + " of the " + t + " anime in your list."; }, added: function (n) { return n + " anime added to your list."; } }
             : { add: "Ajouter à ma liste", on: "Dans ma liste", share: "Partager", copied: "Lien copié !", rm: "Retirer", shareList: "Partager ma liste", cal: "Ajouter à l'agenda", subs: function (p, n, t) { return "Avec " + p + ", tu peux regarder " + n + " animé" + (n > 1 ? "s" : "") + " sur " + t + " de ta liste."; }, added: function (n) { return n + " animé" + (n > 1 ? "s ajoutés" : " ajouté") + " à ta liste."; } };
  var KEY = "tz-list";
  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function has(a, s) { for (var i = 0; i < a.length; i++) if (a[i].s === s) return i; return -1; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function count() {
    var n = load().length;
    document.querySelectorAll("[data-favc]").forEach(function (c) { c.textContent = n > 99 ? "99+" : String(n); c.hidden = !n; });
  }
  // Bouton sur les fiches animé
  document.querySelectorAll("[data-fav]").forEach(function (b) {
    var s = b.getAttribute("data-fav"), lab = b.querySelector("span");
    function draw() { var on = has(load(), s) >= 0; b.setAttribute("aria-pressed", on ? "true" : "false"); lab.textContent = on ? L.on : L.add; }
    b.addEventListener("click", function () {
      var a = load(), i = has(a, s);
      if (i >= 0) a.splice(i, 1); else a.unshift({ s: s, t: b.getAttribute("data-t") || s, i: b.getAttribute("data-i") || "" });
      save(a); draw(); count();
    });
    draw();
  });
  // Bouton « Partager » : menu de partage du téléphone, sinon copie du lien
  document.querySelectorAll("[data-share]").forEach(function (b) {
    var lab = b.querySelector("span"); lab.textContent = L.share;
    b.addEventListener("click", function () {
      var url = location.href.split("#")[0], t = b.getAttribute("data-t") || document.title;
      var done = function () { lab.textContent = L.copied; setTimeout(function () { lab.textContent = L.share; }, 2000); };
      var fallback = function () {
        var ta = document.createElement("textarea"); ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); done();
      };
      if (navigator.share) { navigator.share({ title: t, url: url }).catch(function () {}); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
    });
  });
  // « Ajouter à l'agenda » : fichier .ics avec les prochains épisodes (un par semaine)
  document.querySelectorAll("[data-ics]").forEach(function (b) {
    b.querySelector("span").textContent = L.cal;
    b.addEventListener("click", function () {
      var t = +b.dataset.ics, ep = +b.dataset.ep, tot = +b.dataset.tot || 0, dur = +b.dataset.dur || 24, title = b.dataset.t || document.title;
      var cnt = tot ? Math.max(1, tot - ep + 1) : 12, url = location.href.split("#")[0];
      var f = function (d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
      var x = function (s) { return String(s).replace(/([\\,;])/g, "\\$1"); };
      var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//tsuzuki//anime//EN", "BEGIN:VEVENT", "UID:" + b.dataset.s + "-" + t + "@tsuzuki", "DTSTAMP:" + f(new Date()),
        "DTSTART:" + f(new Date(t * 1000)), "DTEND:" + f(new Date((t + dur * 60) * 1000)), "RRULE:FREQ=WEEKLY;COUNT=" + cnt,
        "SUMMARY:" + x(title + (EN ? " - new episode" : " - nouvel épisode")), "URL:" + url, "DESCRIPTION:" + x(url),
        "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:" + x(title), "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
      a.download = (b.dataset.s || "anime") + ".ics";
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
  });
  // Page « Ma liste »
  var AIR = null, NXF = new Intl.DateTimeFormat(EN ? "en-US" : "fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  var g = document.getElementById("mylist"), empty = document.getElementById("mylist-empty"), sb = document.getElementById("mylist-share"), msg = document.getElementById("mylist-msg");
  function render() {
    if (!g) return;
    var a = load(), rel = g.getAttribute("data-rel") || "";
    g.innerHTML = a.map(function (x) {
      var nx = AIR && AIR[x.s], nt = nx ? '<small style="color:var(--sun);font-weight:600">' + (EN ? "Ep " : "Épisode ") + nx[0] + " · " + esc(NXF.format(new Date(nx[1] * 1000))) + "</small>" : "";
      return '<div class="mli"><a class="pcard" href="' + rel + "anime/" + encodeURIComponent(x.s) + '.html"><span class="poster">' + (x.i ? '<img src="' + esc(x.i) + '" alt="" loading="lazy" decoding="async">' : "<b>" + esc((x.t || "?").slice(0, 1)) + "</b>") + '</span><span class="pc-b"><b>' + esc(x.t) + "</b>" + nt + '</span></a><button type="button" class="mlx" data-rm="' + esc(x.s) + '" aria-label="' + L.rm + '" title="' + L.rm + '">×</button></div>';
    }).join("");
    if (empty) empty.hidden = a.length > 0;
    if (sb) sb.hidden = !a.length;
  }
  // Copie un lien dans le presse-papiers (avec repli pour les vieux navigateurs)
  function copyLink(url, lab, txt) {
    var done = function () { lab.textContent = L.copied; setTimeout(function () { lab.textContent = txt; }, 2000); };
    var fallback = function () {
      var ta = document.createElement("textarea"); ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
  }
  if (g) {
    g.addEventListener("click", function (e) {
      var b = e.target.closest("[data-rm]"); if (!b) return;
      var a = load(), i = has(a, b.getAttribute("data-rm")); if (i >= 0) { a.splice(i, 1); save(a); }
      render(); count();
    });
    render();
    // « Quel abonnement pour ma liste ? » : plateforme qui couvre le plus d'animés de la liste dans la région du visiteur
    var subsBox = document.createElement("p"); subsBox.className = "small"; subsBox.hidden = true; subsBox.style.cssText = "margin:0 0 14px;font-weight:600";
    g.parentNode.insertBefore(subsBox, g);
    var SIDX = null;
    var subs = function () {
      var a = load();
      if (!SIDX || !window.TZR || a.length < 2) { subsBox.hidden = true; return; }
      var c = {};
      a.forEach(function (x) { var e = SIDX[x.s]; if (!e) return; window.TZR(e.w).forEach(function (p) { c[p] = (c[p] || 0) + 1; }); });
      var top = Object.keys(c).sort(function (p, q) { return c[q] - c[p]; });
      if (!top.length) { subsBox.hidden = true; return; }
      subsBox.textContent = "📺 " + L.subs(top[0], c[top[0]], a.length) + (top[1] ? " · " + top.slice(1, 3).map(function (p) { return p + " " + c[p] + "/" + a.length; }).join(" · ") : "");
      subsBox.hidden = false;
    };
    fetch(document.documentElement.getAttribute("data-idx") || "search.json").then(function (r) { return r.json(); }).then(function (d) {
      SIDX = {}; d.forEach(function (x) { SIDX[x.u.replace(/^anime\//, "").replace(/\.html$/, "")] = x; }); subs();
    }).catch(function () {});
    g.addEventListener("click", function () { setTimeout(subs, 0); });
    window.addEventListener("storage", function () { setTimeout(subs, 0); });
    // Prochain épisode de chaque animé en cours de diffusion
    fetch((document.documentElement.getAttribute("data-idx") || "search.json").replace("search.json", "airing.json")).then(function (r) { return r.json(); }).then(function (d) { AIR = d; render(); }).catch(function () {});
    // « Partager ma liste » : un lien qui contient les animés de la liste (#l=slug1,slug2…)
    if (sb) {
      var sl = sb.querySelector("span"); sl.textContent = L.shareList;
      sb.addEventListener("click", function () {
        var url = location.href.split("#")[0] + "#l=" + load().map(function (x) { return encodeURIComponent(x.s); }).join(",");
        if (navigator.share) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
        copyLink(url, sl, L.shareList);
      });
    }
    // Ouverture d'un lien partagé : on ajoute les animés manquants à la liste
    var m = location.hash.match(/^#l=(.+)$/);
    if (m) {
      var want = m[1].split(",").map(function (x) { try { return decodeURIComponent(x); } catch (e) { return ""; } }).filter(Boolean).slice(0, 500);
      var IMGP = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/";
      fetch(document.documentElement.getAttribute("data-idx") || "search.json").then(function (r) { return r.json(); }).then(function (idx) {
        var by = {}; idx.forEach(function (x) { by[x.u.replace(/^anime\//, "").replace(/\.html$/, "")] = x; });
        var a = load(), n = 0;
        want.forEach(function (s) {
          var x = by[s]; if (!x || has(a, s) >= 0) return;
          a.push({ s: s, t: x.t, i: x.i ? (x.i.indexOf("http") === 0 ? x.i : IMGP + x.i) : "" }); n++;
        });
        save(a); render(); count();
        if (msg) { msg.textContent = L.added(n); msg.hidden = false; }
        try { history.replaceState(null, "", location.pathname); } catch (e) {}
      }).catch(function () {});
    }
  }
  count();
  window.addEventListener("storage", function (e) { if (e.key === KEY) { count(); render(); } });
})();
