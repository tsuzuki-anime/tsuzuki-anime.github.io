// Page 404 intelligente : retrouve la bonne fiche quand une ancienne adresse d'animé (ou une adresse inventée) est ouverte.
(function () {
  var box = document.getElementById("nf-sug");
  if (!box) return;
  var base = box.getAttribute("data-base") || "/";
  var path = location.pathname.slice(base.length - 1);
  var m = path.match(/^\/(en\/)?(?:anime|ordre|watch-order|fillers)\/([^\/]+?)(?:\.html)?$/);
  if (!m) return;
  var en = !!m[1], old = m[2].replace(/-\d+$/, "");
  function sl(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  fetch(base + "search.json").then(function (r) { return r.json(); }).then(function (d) {
    var href = function (x) { return base + (en ? "en/" : "") + x.u; };
    for (var i = 0; i < d.length; i++) {
      var names = [d[i].t].concat(d[i].a ? d[i].a.split(" | ") : []);
      for (var j = 0; j < names.length; j++) if (sl(names[j]) === old) { location.replace(href(d[i])); return; }
    }
    var words = old.split("-").filter(function (w) { return w.length > 2; });
    if (!words.length) return;
    var hits = [];
    d.forEach(function (x) {
      var hay = "-" + sl(x.t + " " + (x.a || "")) + "-", s = 0;
      words.forEach(function (w) { if (hay.indexOf("-" + w + "-") > -1) s++; });
      if (s >= Math.ceil(words.length / 2)) hits.push({ x: x, s: s });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    if (!hits.length) return;
    box.innerHTML = "<p>" + (en ? "Were you looking for:" : "Tu cherchais peut-être :") + "</p><ul>" + hits.slice(0, 6).map(function (h) { return '<li><a href="' + href(h.x) + '">' + esc(h.x.t) + "</a></li>"; }).join("") + "</ul>";
  }).catch(function () {});
})();
