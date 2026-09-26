(function () {
  // Recherche
  var q = document.getElementById("q"), R = document.getElementById("results"), idx = null;
  function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function run() {
    var v = norm(q.value.trim());
    if (!v || !idx) { R.innerHTML = ""; return; }
    var hits = idx.filter(function (x) { return norm(x.t + " " + x.a).indexOf(v) > -1; }).slice(0, 8);
    R.innerHTML = hits.length ? hits.map(function (x) {
      return '<a class="res" href="' + x.u + '"><b>' + esc(x.t) + '</b><span class="chips">' +
        (x.p.length ? x.p.map(function (p) { return '<span class="chip">' + esc(p) + "</span>"; }).join("") : '<span class="chip muted">Plateforme à confirmer</span>') +
        "</span></a>";
    }).join("") : '<p class="empty">Aucun animé trouvé. Essaie avec le titre japonais ou anglais.</p>';
  }
  if (q) {
    fetch("search.json").then(function (r) { return r.json(); }).then(function (d) { idx = d; run(); }).catch(function () {});
    q.addEventListener("input", run);
  }

  // Calendrier : onglets par jour, aujourd'hui par défaut
  var tabs = document.querySelectorAll(".day[data-day]");
  if (tabs.length) {
    var today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    function show(k) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.day === k ? "true" : "false"); });
      document.querySelectorAll(".dayp").forEach(function (p) { p.hidden = p.dataset.day !== k; });
    }
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
    function draw() {
      var m = moods[cur], it = m.items[n % m.items.length];
      pk.innerHTML = '<span class="k">Envie de ' + esc(m.label) + '</span><a class="t" href="' + it.u + '">' + esc(it.t) + "</a><p>Disponible sur " + esc(it.p) + '</p><button class="btn" type="button" id="again">Autre idée</button>';
      document.getElementById("again").onclick = function () { n++; draw(); };
    }
    moods.forEach(function (m, i) {
      var b = document.createElement("button");
      b.className = "day"; b.type = "button"; b.textContent = m.label.charAt(0).toUpperCase() + m.label.slice(1);
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.onclick = function () { cur = i; n = Math.floor(Math.random() * 5); [].forEach.call(mb.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); draw(); };
      mb.appendChild(b);
    });
    if (moods.length) draw();
  }
})();
