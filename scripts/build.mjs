// Génère le site statique (dossier dist/) à partir de data/anime.json et config.json.
import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const cfg = JSON.parse(await readFile(new URL("config.json", root), "utf8"));
const data = JSON.parse(await readFile(new URL("data/anime.json", root), "utf8"));
const SITE = (process.env.SITE_URL || cfg.siteUrl).replace(/\/$/, "");
const OUT = new URL("dist/", root);
const BASE = new URL(SITE + "/").pathname;

const TZ = "Europe/Brussels";
const SEASON_FR = { WINTER: "hiver", SPRING: "printemps", SUMMER: "été", FALL: "automne" };
const SEASON_SLUG = { WINTER: "hiver", SPRING: "printemps", SUMMER: "ete", FALL: "automne" };
const FORMAT_FR = { TV: "Série TV", TV_SHORT: "Série courte", MOVIE: "Film", SPECIAL: "Épisode spécial", OVA: "OVA", ONA: "Série web", MUSIC: "Clip" };
const STATUS_FR = { RELEASING: "En cours de diffusion", NOT_YET_RELEASED: "Pas encore sorti", FINISHED: "Terminé", HIATUS: "En pause", CANCELLED: "Annulé" };
const GENRE_FR = { Action: "Action", Adventure: "Aventure", Comedy: "Comédie", Drama: "Drame", Ecchi: "Ecchi", Fantasy: "Fantasy", Horror: "Horreur", "Mahou Shoujo": "Magical girl", Mecha: "Mecha", Music: "Musique", Mystery: "Mystère", Psychological: "Psychologique", Romance: "Romance", "Sci-Fi": "Science-fiction", "Slice of Life": "Tranche de vie", Sports: "Sport", Supernatural: "Surnaturel", Thriller: "Thriller" };
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const slugify = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "anime";
const nameOf = (m) => m.title.english || m.title.romaji || m.title.native;
const hhmm = (t) => new Intl.DateTimeFormat("fr-BE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(t * 1000));
const dayKey = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t * 1000));
const weekdayIdx = (t) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date(t * 1000)));
const longDate = (t) => new Intl.DateTimeFormat("fr-BE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(t * 1000));
const seasonLabel = (s) => `${SEASON_FR[s.season]} ${s.year}`;
const seasonPath = (s) => `saison/${SEASON_SLUG[s.season]}-${s.year}.html`;

// Slugs uniques
const used = new Set();
for (const m of data.media) {
  let s = slugify(nameOf(m));
  if (used.has(s)) s = `${s}-${m.id}`;
  used.add(s);
  m.slug = s;
}
const byId = new Map(data.media.map((m) => [m.id, m]));
// Plateformes disponibles en Belgique (les données AniList sont mondiales)
const BE_PLATFORMS = {
  "Crunchyroll": "Crunchyroll",
  "Netflix": "Netflix",
  "ADN": "ADN",
  "Animation Digital Network": "ADN",
  "Amazon Prime Video": "Prime Video",
  "Prime Video": "Prime Video",
  "Disney Plus": "Disney+",
  "Disney+": "Disney+",
};
const streaming = (m) => {
  const seen = new Set();
  return (m.externalLinks || [])
    .filter((l) => l.type === "STREAMING" && BE_PLATFORMS[l.site])
    .map((l) => ({ ...l, raw: l.site, site: BE_PLATFORMS[l.site] }))
    .filter((l) => !seen.has(l.site) && seen.add(l.site));
};
const affiliate = (site) => cfg.affiliates?.[site] || Object.entries(BE_PLATFORMS).filter(([, v]) => v === site).map(([k]) => cfg.affiliates?.[k]).find(Boolean) || "";

// ---------- Mise en page commune ----------
const adsHead = cfg.adsenseClient
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>`
  : "";
const adSlot = () => (cfg.adsenseClient
  ? `<div class="ad"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(cfg.adsenseClient)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
  : "");

function page({ path, title, desc, body, rel, jsonld }) {
  const canonical = `${SITE}/${path}`.replace(/index\.html$/, "");
  return `<!doctype html>
<html lang="fr-BE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;700&display=swap">
<link rel="stylesheet" href="${rel}style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
${adsHead}
</head>
<body>
<div class="wrap">
<header class="top">
  <a class="logo" href="${rel}index.html">${esc(cfg.siteName)}<span>.</span></a>
  <nav aria-label="Menu principal">
    <a href="${rel}calendrier.html">Calendrier</a>
    <a href="${rel}${seasonPath(data.current)}">Saison en cours</a>
    <a href="${rel}${seasonPath(data.next)}">Prochaine saison</a>
  </nav>
</header>
<main>
${body}
</main>
<footer class="foot">
  <p>${esc(cfg.siteName)} ne diffuse aucune vidéo : le site renvoie uniquement vers les plateformes officielles. Certains liens peuvent être affiliés.</p>
  <p>Données : <a href="https://anilist.co" rel="noopener">AniList</a>. Site non affilié à AniList. Horaires à l'heure belge, mis à jour chaque jour. <a href="${rel}a-propos.html">À propos</a></p>
</footer>
</div>
<script src="${rel}app.js" defer></script>
</body>
</html>`;
}

function chips(m, max = 4) {
  const links = streaming(m).slice(0, max);
  if (!links.length) return `<span class="chip muted">Plateforme à confirmer</span>`;
  return links.map((l) => `<span class="chip">${esc(l.site)}</span>`).join("");
}

function card(m, rel) {
  const color = m.coverImage?.color || "#2D3052";
  const genres = (m.genres || []).slice(0, 2).map((g) => GENRE_FR[g] || g).join(" · ");
  return `<a class="card" href="${rel}anime/${m.slug}.html" style="--c:${esc(color)}">
  <span class="swatch" aria-hidden="true">${esc(nameOf(m).slice(0, 1))}</span>
  <span class="ct"><b>${esc(nameOf(m))}</b><small>${esc(FORMAT_FR[m.format] || m.format || "")}${genres ? " · " + esc(genres) : ""}</small></span>
  <span class="chips">${chips(m, 2)}</span>
</a>`;
}

// ---------- Fiches animé ----------
const pages = [];
function animePage(m) {
  const rel = "../";
  const name = nameOf(m);
  const links = streaming(m);
  const studio = m.studios?.nodes?.[0]?.name;
  const next = m.nextAiringEpisode;
  const genres = (m.genres || []).map((g) => GENRE_FR[g] || g);
  const seasonTxt = m.season && m.seasonYear ? `${SEASON_FR[m.season]} ${m.seasonYear}` : null;
  const alt = [m.title.romaji, m.title.native].filter((t) => t && t !== name);

  const intro = [
    `<strong>${esc(name)}</strong> est ${m.format === "MOVIE" ? "un film d'animation" : "un animé"}${studio ? ` produit par le studio ${esc(studio)}` : ""}${seasonTxt ? `, de la saison ${esc(seasonTxt)}` : ""}.`,
    genres.length ? ` Genres : ${esc(genres.join(", ").toLowerCase())}.` : "",
    m.episodes ? ` Il compte ${m.episodes} épisode${m.episodes > 1 ? "s" : ""}.` : "",
  ].join("");

  const where = links.length
    ? `<p>En ce moment, <strong>${esc(name)}</strong> est proposé légalement sur ${links.map((l) => `<strong>${esc(l.site)}</strong>`).join(", ").replace(/, ([^,]*)$/, " et $1")}. La disponibilité peut varier selon le pays : vérifiez sur la plateforme depuis la Belgique.</p>
<div class="plats">${links.map((l) => {
        const aff = affiliate(l.site);
        return `<div class="plat"><span><b>${esc(l.site)}</b>${l.language ? `<small>${esc(l.language)}</small>` : ""}</span><span class="acts"><a class="btn" href="${esc(l.url)}" rel="noopener nofollow" target="_blank">Regarder</a>${aff ? `<a class="btn ghost" href="${esc(aff)}" rel="sponsored noopener" target="_blank">S'abonner</a>` : ""}</span></div>`;
      }).join("")}</div>`
    : `<p>Aucune plateforme légale n'est encore annoncée pour <strong>${esc(name)}</strong>. Cette page se met à jour automatiquement dès qu'une plateforme est confirmée.</p>`;

  const nextHtml = next
    ? `<div class="next"><span class="k">Prochain épisode</span><span class="t">Épisode ${next.episode}</span><span>${esc(longDate(next.airingAt))} à ${hhmm(next.airingAt)} (heure belge)</span><span class="countdown" data-at="${next.airingAt}"></span></div>`
    : "";

  const faq = [
    [`Où regarder ${name} légalement en Belgique ?`, links.length ? `Sur ${links.map((l) => l.site).join(", ")}, sous réserve de disponibilité dans votre pays.` : "Aucune plateforme n'est encore annoncée."],
    ...(next ? [[`Quand sort le prochain épisode de ${name} ?`, `L'épisode ${next.episode} sort le ${longDate(next.airingAt)} à ${hhmm(next.airingAt)}, heure belge.`]] : []),
    ...(m.episodes ? [[`Combien d'épisodes compte ${name} ?`, `${m.episodes} épisode${m.episodes > 1 ? "s" : ""}.`]] : []),
  ];

  const similar = data.media
    .filter((o) => o.id !== m.id && (o.genres || []).some((g) => (m.genres || []).includes(g)))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 6);

  const body = `
<article class="fiche" style="--c:${esc(m.coverImage?.color || "#7C95FF")}">
  <p class="crumb"><a href="${rel}index.html">Accueil</a> › Animés › ${esc(name)}</p>
  <h1>Où regarder ${esc(name)}&nbsp;?</h1>
  ${alt.length ? `<p class="alt">${esc(alt.join(" · "))}</p>` : ""}
  <div class="facts">
    <span class="chip">${esc(FORMAT_FR[m.format] || m.format || "Animé")}</span>
    ${m.status ? `<span class="chip">${esc(STATUS_FR[m.status] || m.status)}</span>` : ""}
    ${m.averageScore ? `<span class="chip">Note ${m.averageScore}/100</span>` : ""}
    ${studio ? `<span class="chip">${esc(studio)}</span>` : ""}
  </div>
  ${nextHtml}
  <h2>Plateformes légales</h2>
  ${where}
  ${adSlot()}
  <h2>À propos</h2>
  <p>${intro}</p>
  <h2>Questions fréquentes</h2>
  <dl class="faq">${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("")}</dl>
  ${similar.length ? `<h2>Dans le même genre</h2><div class="grid">${similar.map((o) => card(o, rel)).join("")}</div>` : ""}
</article>`;

  pages.push({
    path: `anime/${m.slug}.html`,
    html: page({
      path: `anime/${m.slug}.html`, rel,
      title: `Où regarder ${name} en Belgique ? Plateformes et prochain épisode`,
      desc: `${name} : sur quelles plateformes légales le regarder en Belgique, date et heure du prochain épisode, nombre d'épisodes.`,
      body,
      jsonld: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    }),
  });
}
data.media.forEach(animePage);

// ---------- Calendrier ----------
const byDay = new Map();
for (const s of data.schedule) {
  const m = byId.get(s.id); if (!m) continue;
  const k = dayKey(s.airingAt);
  if (!byDay.has(k)) byDay.set(k, { label: longDate(s.airingAt), w: weekdayIdx(s.airingAt), items: [] });
  byDay.get(k).items.push({ ...s, m });
}
const todayKey = dayKey(Math.floor(Date.now() / 1000));
const dayList = [...byDay.entries()].filter(([k]) => k >= todayKey).sort(([a], [b]) => a.localeCompare(b)).slice(0, 8);
function epRow(e, rel) {
  return `<a class="ep" href="${rel}anime/${e.m.slug}.html"><time>${hhmm(e.airingAt)}</time><span><b>${esc(nameOf(e.m))}</b><small>Épisode ${e.episode}${e.m.episodes ? ` / ${e.m.episodes}` : ""}</small></span><span class="chips">${chips(e.m, 1)}</span></a>`;
}
{
  const rel = "";
  const body = `
<h1>Calendrier des sorties animés</h1>
<p class="lead">Les nouveaux épisodes de la semaine à l'heure belge, avec la plateforme légale pour les regarder. Mis à jour chaque jour.</p>
<div class="days" role="tablist" aria-label="Jour">${dayList.map(([k, d], i) => `<button class="day" type="button" role="tab" data-day="${k}" aria-selected="${i === 0}">${esc(d.label)}</button>`).join("")}</div>
${dayList.map(([k, d], i) => `<section class="dayp" data-day="${k}" ${i === 0 ? "" : "hidden"}><h2>${esc(d.label[0].toUpperCase() + d.label.slice(1))}</h2>${d.items.map((e) => epRow(e, rel)).join("")}</section>`).join("")}
${adSlot()}`;
  pages.push({ path: "calendrier.html", html: page({ path: "calendrier.html", rel, title: "Calendrier des sorties animés de la semaine (heure belge)", desc: "Tous les nouveaux épisodes d'animés de la semaine, jour par jour, à l'heure belge, avec les plateformes légales pour les regarder.", body }) });
}

// ---------- Saisons ----------
for (const s of [data.current, data.next]) {
  const rel = "../";
  const list = data.media.filter((m) => m.tags?.includes(`${s.season}-${s.year}`)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  const lab = seasonLabel(s);
  const body = `
<h1>Les animés ${s.season === "SPRING" ? "du " : "de l'"}${esc(lab)}</h1>
<p class="lead">${list.length} animés de la saison ${esc(lab)}, classés par popularité, avec les plateformes légales où les regarder en Belgique.</p>
<div class="grid">${list.map((m) => card(m, rel)).join("")}</div>
${adSlot()}`;
  pages.push({ path: seasonPath(s), html: page({ path: seasonPath(s), rel, title: `Animés ${lab} : la liste complète et où les regarder`, desc: `Tous les animés de la saison ${lab}, classés par popularité, avec les plateformes légales pour les regarder en Belgique.`, body }) });
}

// ---------- Accueil ----------
{
  const rel = "";
  const popular = data.media.filter((m) => m.tags?.includes(`${data.current.season}-${data.current.year}`) || m.status === "RELEASING").sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 12);
  const firstDay = dayList[0];
  const moods = [["Action", "action"], ["Comedy", "rire"], ["Romance", "romance"], ["Drama", "émotion"], ["Horror", "frisson"], ["Fantasy", "évasion"]];
  const pickData = moods.map(([g, label]) => ({ label, items: data.media.filter((m) => (m.genres || []).includes(g) && streaming(m).length).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 12).map((m) => ({ t: nameOf(m), u: `anime/${m.slug}.html`, p: streaming(m).map((l) => l.site).slice(0, 3).join(", ") })) })).filter((x) => x.items.length);
  const body = `
<section class="hero">
  <h1>Tu veux le voir&nbsp;? On te dit <em>où</em>.</h1>
  <p class="lead">Trouve sur quelle plateforme légale regarder un animé en Belgique, et quand sort le prochain épisode.</p>
  <div class="search">
    <input id="q" type="search" placeholder="Un titre d'animé…" autocomplete="off" aria-label="Rechercher un animé">
  </div>
  <div class="results" id="results" aria-live="polite"></div>
</section>
${firstDay ? `<section><h2>Les sorties du jour</h2><p class="sub">${esc(firstDay[1].label)}, à l'heure belge. <a href="calendrier.html">Toute la semaine →</a></p>${firstDay[1].items.slice(0, 8).map((e) => epRow(e, rel)).join("")}</section>` : ""}
${adSlot()}
<section><h2>Populaires en ce moment</h2><div class="grid">${popular.map((m) => card(m, rel)).join("")}</div></section>
<section><h2>Qu'est-ce qu'on regarde ce soir ?</h2><p class="sub">Choisis ton humeur, on te trouve un animé.</p>
<div class="moods" id="moods" role="group" aria-label="Humeur"></div><div class="pick" id="pick"></div>
<script type="application/json" id="pickdata">${JSON.stringify(pickData).replace(/</g, "\\u003c")}</script></section>`;
  pages.push({ path: "index.html", html: page({ path: "index.html", rel, title: `${cfg.siteName} : où regarder tes animés légalement en Belgique`, desc: "Trouve sur quelle plateforme légale regarder un animé en Belgique, le calendrier des sorties à l'heure belge et des idées pour ce soir.", body, jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, url: SITE + "/" } }) });
}

// ---------- À propos & 404 ----------
pages.push({ path: "a-propos.html", html: page({ path: "a-propos.html", rel: "", title: `À propos de ${cfg.siteName}`, desc: `${cfg.siteName} aide à trouver où regarder légalement ses animés en Belgique.`, body: `<h1>À propos</h1><div class="prose"><p>${esc(cfg.siteName)} aide les fans d'animés en Belgique à trouver où regarder leurs séries légalement, et à savoir quand sortent les nouveaux épisodes.</p><p>Le site ne diffuse et n'héberge aucune vidéo. Il renvoie uniquement vers les plateformes officielles. Certains liens peuvent être affiliés : si vous vous abonnez via ces liens, le site peut toucher une commission, sans surcoût pour vous.</p><p>Les informations proviennent d'AniList et sont mises à jour automatiquement chaque jour. La disponibilité d'un titre peut varier selon le pays : vérifiez toujours sur la plateforme.</p></div>` }) });
pages.push({ path: "404.html", html: page({ path: "404.html", rel: BASE, title: "Page introuvable", desc: "Cette page n'existe pas.", body: `<h1>Page introuvable</h1><p class="lead">Cette page n'existe pas ou plus. <a href="${BASE}index.html">Retour à l'accueil</a></p>` }) });

// ---------- Écriture ----------
await rm(OUT, { recursive: true, force: true });
await mkdir(new URL("anime/", OUT), { recursive: true });
await mkdir(new URL("saison/", OUT), { recursive: true });
for (const p of pages) await writeFile(new URL(p.path, OUT), p.html);
await cp(new URL("static/", root), OUT, { recursive: true });
const search = data.media.map((m) => ({ t: nameOf(m), a: [m.title.romaji, m.title.native].filter(Boolean).join(" "), u: `anime/${m.slug}.html`, p: streaming(m).map((l) => l.site).slice(0, 3) }));
await writeFile(new URL("search.json", OUT), JSON.stringify(search));
const today = new Date().toISOString().slice(0, 10);
await writeFile(new URL("sitemap.xml", OUT), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => p.path !== "404.html").map((p) => `<url><loc>${esc(`${SITE}/${p.path}`.replace(/index\.html$/, ""))}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
await writeFile(new URL("robots.txt", OUT), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Site généré : ${pages.length} pages dans dist/`);
