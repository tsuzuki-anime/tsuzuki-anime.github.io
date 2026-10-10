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

const { fillerPages, fillerHome } = await import("./fillers.mjs");
const { mangaPages, mangaBox, mangaHome, mangaSearchData } = await import("./mangas.mjs");
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
for (const m of [...data.media].sort((a, b) => a.id - b.id)) {
  let s = slugify(nameOf(m));
  if (used.has(s)) s = `${s}-${m.id}`;
  used.add(s);
  m.slug = s;
}
const byId = new Map(data.media.map((m) => [m.id, m]));
// Corrections manuelles (overrides.json) : plateformes signalées comme absentes dans certaines régions
{
  let ov = { notIn: [] };
  try { ov = JSON.parse(await readFile(new URL("overrides.json", root), "utf8")); } catch {}
  for (const o of ov.notIn || []) {
    const m = byId.get(o.id);
    if (!m) continue;
    for (const l of m.externalLinks || []) if (l.site === o.site || (o.site === "Prime Video" && l.site === "Amazon Prime Video") || (o.site === "Disney+" && l.site === "Disney Plus")) l.notIn = [...new Set([...(l.notIn || []), ...o.regions])];
  }
}
const POPULAR = [...data.media].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
// Plateformes disponibles en France et en Belgique (les données AniList sont mondiales)
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
    .filter((l) => l.type === "STREAMING" && BE_PLATFORMS[l.site] && !(l.notIn || []).includes("fr"))
    .map((l) => ({ ...l, raw: l.site, site: BE_PLATFORMS[l.site] }))
    .filter((l) => !seen.has(l.site) && seen.add(l.site));
};
// Autres plateformes officielles (souvent gratuites, disponibilité variable selon le pays)
const OTHER_PLATFORMS = { "YouTube": "YouTube", "Bilibili TV": "Bilibili", "iQIYI": "iQIYI", "iQ.com": "iQIYI", "WeTV": "WeTV", "HIDIVE": "HIDIVE", "OceanVeil": "OceanVeil", "Viki": "Viki", "Rakuten Viki": "Viki", "Pluto TV": "Pluto TV" };
const others = (m) => {
  const seen = new Set();
  return (m.externalLinks || [])
    .filter((l) => l.type === "STREAMING" && OTHER_PLATFORMS[l.site])
    .map((l) => ({ ...l, site: OTHER_PLATFORMS[l.site] }))
    .filter((l) => !seen.has(l.site) && seen.add(l.site));
};
// Franchise : pour un animé sans plateforme, cherche une suite / saison / série liée qui en a une
const famCache = new Map();
function family(m) {
  if (famCache.has(m.id)) return famCache.get(m.id);
  let res = null;
  if (!streaming(m).length) {
    const seen = new Set([m.id]);
    let frontier = [m];
    for (let depth = 0; depth < 4 && !res && frontier.length; depth++) {
      const next = [];
      for (const x of frontier) for (const id of x.rel || []) {
        if (seen.has(id)) continue;
        seen.add(id);
        const o = byId.get(id);
        if (!o) continue;
        if (streaming(o).length && (!res || (o.popularity || 0) > (res.popularity || 0))) res = o;
        next.push(o);
      }
      frontier = next;
    }
  }
  famCache.set(m.id, res);
  return res;
}
// Liens de recherche pour vérifier soi-même où regarder un animé en France
const searchLinks = (m) => {
  const q = encodeURIComponent(m.title.english || m.title.romaji || nameOf(m));
  return [
    ["JustWatch France", `https://www.justwatch.com/fr/recherche?q=${q}`],
    ["Crunchyroll", `https://www.crunchyroll.com/fr/search?q=${q}`],
    ["Netflix", `https://www.netflix.com/search?q=${q}`],
    ["Prime Video", `https://www.primevideo.com/search?phrase=${q}`],
  ];
};
const PLATFORM_SLUG = { "Crunchyroll": "crunchyroll", "Netflix": "netflix", "ADN": "adn", "Prime Video": "prime-video", "Disney+": "disney-plus" };

// ---------- Le monde : régions et plateformes ----------
// Les liens AniList ne disent pas dans quels pays un titre est disponible : on indique donc les plateformes
// qui ont l'animé ET qui sont présentes dans la région choisie (le catalogue exact peut varier selon le pays).
const REGIONS = [
  ["fr", "France et pays francophones", "France"],
  ["us", "États-Unis et Canada", "USA / Canada"],
  ["uk", "Royaume-Uni et Irlande", "Royaume-Uni"],
  ["de", "Allemagne, Autriche, Suisse", "Allemagne"],
  ["eu", "Reste de l'Europe", "Europe"],
  ["latam", "Amérique latine et Brésil", "Amérique latine"],
  ["jp", "Japon", "Japon"],
  ["cn", "Chine", "Chine"],
  ["asia", "Asie et Océanie", "Asie / Océanie"],
];
const R_ALL = REGIONS.map(([r]) => r);
const noCN = R_ALL.filter((r) => r !== "cn");
const noJPCN = R_ALL.filter((r) => r !== "cn" && r !== "jp");
// nom affiché, classe de couleur, régions où le service est présent
const SERVICES = {
  "Crunchyroll": ["Crunchyroll", "cr", noJPCN],
  "Netflix": ["Netflix", "nf", noCN],
  "ADN": ["ADN", "adn", ["fr"]],
  "Animation Digital Network": ["ADN", "adn", ["fr"]],
  "Amazon Prime Video": ["Prime Video", "pv", noCN],
  "Prime Video": ["Prime Video", "pv", noCN],
  "Disney Plus": ["Disney+", "dp", noCN],
  "Disney+": ["Disney+", "dp", noCN],
  "Hulu": ["Hulu", "hu", ["us"]],
  "HIDIVE": ["HIDIVE", "hd", ["us", "uk"]],
  "Adult Swim": ["Adult Swim", "other", ["us"]],
  "Max": ["Max", "mx", ["us", "latam", "eu"]],
  "Tubi TV": ["Tubi", "other", ["us", "uk", "latam"]],
  "Hoopla": ["Hoopla", "other", ["us"]],
  "RetroCrush": ["RetroCrush", "other", ["us"]],
  "Crackle": ["Crackle", "other", ["us"]],
  "Criterion Channel": ["Criterion Channel", "other", ["us"]],
  "Cineverse": ["Cineverse", "other", ["us"]],
  "Midnight Pulp": ["Midnight Pulp", "other", ["us"]],
  "AsianCrush": ["AsianCrush", "other", ["us"]],
  "Apple TV+": ["Apple TV+", "other", noCN],
  "Star+": ["Star+", "other", ["latam"]],
  "OceanVeil": ["OceanVeil", "other", ["us", "uk", "fr", "de", "eu"]],
  "Viki": ["Viki", "other", noCN],
  "Vimeo": ["Vimeo", "other", noCN],
  "YouTube": ["YouTube", "yt", noCN],
  "Coolmic": ["Coolmic", "other", noCN],
  "Japanese Film Archives": ["Japanese Film Archives", "other", noCN],
  "Bilibili TV": ["Bilibili TV", "bb", ["asia", "latam", "us", "eu", "fr", "uk", "de"]],
  "Bilibili": ["Bilibili (Chine)", "bb", ["cn"]],
  "iQ": ["iQIYI", "iq", ["asia", "latam", "us"]],
  "iQ.com": ["iQIYI", "iq", ["asia", "latam", "us"]],
  "iQIYI": ["iQIYI (Chine)", "iq", ["cn"]],
  "WeTV": ["WeTV", "other", ["asia"]],
  "Tencent Video": ["Tencent Video", "other", ["cn"]],
  "Youku": ["Youku", "other", ["cn"]],
  "Youku TV": ["Youku", "other", ["cn"]],
  "Laftel": ["Laftel", "other", ["asia"]],
  "Niconico Video": ["Niconico", "other", ["jp"]],
  "Bandai Channel": ["Bandai Channel", "other", ["jp"]],
};
const worldLinks = (m) => {
  const seen = new Set();
  return (m.externalLinks || [])
    .filter((l) => l.type === "STREAMING" && SERVICES[l.site])
    .map((l) => ({ url: l.url, site: SERVICES[l.site][0], cls: SERVICES[l.site][1], regions: SERVICES[l.site][2].filter((r) => !(l.notIn || []).includes(r)) }))
    .filter((l) => l.regions.length)
    .filter((l) => !seen.has(l.site) && seen.add(l.site));
};
// Nom de plateforme pour le navigateur, avec les régions exclues pour cet animé (ex. "Crunchyroll~fr")
const wTag = (l) => { const all = Object.values(SERVICES).find(([n]) => n === l.site)?.[2] || []; const ex = all.filter((r) => !l.regions.includes(r)); return ex.length ? `${l.site}~${ex.join(",")}` : l.site; };
const WORLD_SLUG = (name) => slugify(name.replace("+", " plus"));
const GENRE_PAGES = Object.entries(GENRE_FR).filter(([g]) => g !== "Ecchi").map(([g, fr]) => ({ g, fr, slug: slugify(fr) }));
const genreSlug = Object.fromEntries(GENRE_PAGES.map((x) => [x.g, x.slug]));
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{S}]+$/u;
// Autres titres : français (ADN), anglais, romaji, puis japonais / chinois / coréen
const altTitles = (m) => [...new Set([m.titleFr, m.title.english, m.title.romaji, ...(m.synonyms || []).filter((t) => LATIN.test(t)), m.title.native, ...(m.synonyms || []).filter((t) => !LATIN.test(t))].filter((t) => t && t !== nameOf(m)))].slice(0, 8);
const trailerUrl = (m) => (m.trailer?.site === "youtube" && m.trailer.id ? `https://www.youtube.com/watch?v=${encodeURIComponent(m.trailer.id)}` : "");
const affiliate = (site) => cfg.affiliates?.[site] || Object.entries(BE_PLATFORMS).filter(([, v]) => v === site).map(([k]) => cfg.affiliates?.[k]).find(Boolean) || "";

// ---------- Correspondance avec la version anglaise (/en/) ----------
const SEASON_EN_SLUG = { hiver: "winter", printemps: "spring", ete: "summer", automne: "fall" };
function enPathOf(p) {
  const fixed = { "index.html": "en/index.html", "calendrier.html": "en/calendar.html", "catalogue.html": "en/catalog.html", "plateformes.html": "en/platforms.html", "genres.html": "en/genres.html", "a-propos.html": "en/about.html", "confidentialite.html": "en/privacy.html", "mentions-legales.html": "en/legal.html", "ma-liste.html": "en/my-list.html" };
  if (fixed[p]) return fixed[p];
  let m;
  if (p === "fillers.html") return "en/fillers.html";
  if (p === "mangas.html") return "en/mangas.html";
  if ((m = p.match(/^manga\/(.+)$/))) return "en/manga/" + m[1];
  if ((m = p.match(/^fillers\/(.+)$/))) return "en/fillers/" + m[1];
  if ((m = p.match(/^anime\/(.+)$/))) return "en/anime/" + m[1];
  if ((m = p.match(/^catalogue\/(.+)$/))) return "en/catalog/" + m[1];
  if ((m = p.match(/^plateforme\/(.+)$/))) return "en/platform/" + m[1];
  if ((m = p.match(/^saison\/([a-z]+)-(\d+)\.html$/))) return `en/season/${SEASON_EN_SLUG[m[1]]}-${m[2]}.html`;
  if ((m = p.match(/^genre\/(.+)\.html$/))) { const gp = GENRE_PAGES.find((x) => x.slug === m[1]); return gp ? `en/genre/${slugify(gp.g)}.html` : null; }
  return null;
}
const hreflangs = (frPath, enPath) => {
  const fr = `${SITE}/${frPath}`.replace(/index\.html$/, ""), en = `${SITE}/${enPath}`.replace(/index\.html$/, "");
  return `<link rel="alternate" hreflang="fr" href="${esc(fr)}">\n<link rel="alternate" hreflang="en" href="${esc(en)}">\n<link rel="alternate" hreflang="x-default" href="${esc(en)}">`;
};

// ---------- Mise en page commune ----------
const adsHead = cfg.adsenseClient
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>`
  : "";
const adSlot = () => (cfg.adsenseClient
  ? `<div class="ad"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(cfg.adsenseClient)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`
  : "");

function page({ path, title, desc, body, rel, jsonld, image }) {
  const canonical = `${SITE}/${path}`.replace(/index\.html$/, "");
  const enPath = enPathOf(path);
  return `<!doctype html>
<html lang="fr" data-idx="${BASE}search.json">

<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
${enPath ? hreflangs(path, enPath) : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${esc(image)}">` : `<meta name="twitter:card" content="summary">`}
<meta name="theme-color" content="#0B0C16">
<link rel="manifest" href="${rel}manifest.webmanifest">
<link rel="apple-touch-icon" href="${rel}icon-192.png">
<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;700&display=swap">
<link rel="stylesheet" href="${rel}style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
${adsHead}
</head>
<body>
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="${rel}index.html" aria-label="${esc(cfg.siteName)}, accueil"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#FFC857"/><path d="M12 9.5v13l10.5-6.5z" fill="#101223"/></svg><span>${esc(cfg.siteName)}</span></a>
    <nav aria-label="Menu principal">
      <a href="${rel}calendrier.html">Calendrier</a>
      <a href="${rel}catalogue.html">Catalogue</a>
      <a href="${rel}plateformes.html">Plateformes</a>
      <a href="${rel}fillers.html">Fillers</a>
      <a href="${rel}mangas.html">Mangas</a>
      <a class="mylist" href="${rel}ma-liste.html" title="Ma liste" aria-label="Ma liste"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.8 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg><span class="favc" data-favc hidden></span></a>
      <label class="hreg" title="Région de streaming : les catalogues changent selon le pays, les plateformes affichées s'adaptent"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/></svg><select data-region aria-label="Ta région">${REGIONS.map(([r, , sh]) => `<option value="${r}">${esc(sh)}</option>`).join("")}</select></label>
      <div class="hsearch" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" data-search data-rel="${rel}" placeholder="Rechercher un animé…" aria-label="Rechercher un animé" autocomplete="off"><div class="hres results" hidden></div></div>
      <a class="lang" href="${BASE}${(enPath || "en/index.html").replace(/index\.html$/, "")}" hreflang="en" lang="en" title="English version">EN</a>
    </nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div class="foot-brand">
      <a class="logo" href="${rel}index.html"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#FFC857"/><path d="M12 9.5v13l10.5-6.5z" fill="#101223"/></svg><span>${esc(cfg.siteName)}</span></a>
      <p>Le guide gratuit pour savoir où regarder tes animés légalement, en France, dans les pays francophones et dans le monde entier (USA, Japon, Asie, Amérique latine…). Nous ne diffusons aucune vidéo : nous renvoyons uniquement vers les plateformes officielles.</p>
    </div>
    <div><h3>Explorer</h3><a href="${rel}calendrier.html">Calendrier des sorties</a><a href="${rel}catalogue.html">Tous les animés</a><a href="${rel}plateformes.html">Par plateforme</a><a href="${rel}genres.html">Par genre</a><a href="${rel}fillers.html">Fillers à sauter</a><a href="${rel}mangas.html">Où lire les mangas</a><a href="${rel}ma-liste.html">Ma liste</a><a href="${rel}${seasonPath(data.current)}">Saison ${esc(seasonLabel(data.current))}</a><a href="${rel}${seasonPath(data.next)}">Saison ${esc(seasonLabel(data.next))}</a></div>
    <div><h3>Informations</h3><a href="${rel}a-propos.html">À propos</a><a href="${rel}mentions-legales.html">Mentions légales</a><a href="${rel}confidentialite.html">Confidentialité</a></div>
  </div>
  <div class="wrap foot-legal">© ${new Date().getFullYear()} ${esc(cfg.siteName)} · Données et visuels : <a href="https://anilist.co" rel="noopener">AniList</a> (site non affilié) · Horaires à l'heure de Paris et Bruxelles (convertis automatiquement si vous êtes ailleurs), mis à jour chaque jour.</div>
</footer>
<script data-goatcounter="https://tsuzuki.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
<script src="${rel}world.js" defer></script>
<script src="${rel}app.js" defer></script>
</body>
</html>`;
}

const PCLASS = { "Crunchyroll": "cr", "Netflix": "nf", "ADN": "adn", "Prime Video": "pv", "Disney+": "dp" };
function chips(m, max = 4) {
  const w = worldLinks(m).map(wTag);
  return `<span class="chipset" data-w="${esc(w.join("|"))}" data-max="${max}">${chipsFr(m, max)}</span>`;
}
function chipsFr(m, max) {
  const links = streaming(m).slice(0, max);
  if (!links.length) {
    const o = others(m).slice(0, max);
    if (o.length) return o.map((l) => `<span class="chip p-other"><i></i>${esc(l.site)}</span>`).join("");
    const f = family(m);
    return f ? `<span class="chip muted" title="Une autre partie de la franchise est disponible">Franchise : ${esc(streaming(f).map((l) => l.site).slice(0, 2).join(", "))}</span>` : `<span class="chip muted">À chercher</span>`;
  }
  return links.map((l) => `<span class="chip p-${PCLASS[l.site]}"><i></i>${esc(l.site)}</span>`).join("");
}
const cover = (m, size = "large") => [m.coverImage?.[size], m.coverImage?.large, m.coverImage?.medium].find((u) => u && !/\/default\.(jpg|png)$/.test(u)) || "";
function poster(m, size = "large", eager = false) {
  const src = cover(m, size);
  return `<span class="poster" style="--c:${esc(m.coverImage?.color || "#2A2D4A")}">${src ? `<img src="${esc(src)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : `<b>${esc(nameOf(m).slice(0, 1))}</b>`}</span>`;
}
const metaLine = (m) => [FORMAT_FR[m.format] || m.format, m.seasonYear || m.startDate?.year].filter(Boolean).join(" · ");
function card(m, rel) {
  return `<a class="pcard" href="${rel}anime/${m.slug}.html">
  ${poster(m)}
  <span class="pc-b"><b>${esc(nameOf(m))}</b><small>${esc(metaLine(m))}</small><span class="chips">${chips(m, 2)}</span></span>
</a>`;
}

// ---------- Animés similaires (genres en commun, hors même franchise) ----------
const simKey = (m) => (m.title?.romaji || nameOf(m)).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).slice(0, 2).join(" ");
const SIM_POOL = POPULAR.slice(0, 4000).map((o, i) => ({ o, i, g: o.genres || [], key: simKey(o), ok: streaming(o).length + others(o).length > 0 }));
const SIM_CACHE = new Map();
// Suite annoncée (pas encore sortie) et temps pour tout regarder
function sequelOf(m) {
  for (const e of m.relations?.edges || []) {
    if (e.relationType !== "SEQUEL") continue;
    const s = byId.get(e.node?.id);
    if (s && s.status === "NOT_YET_RELEASED") return s;
  }
  return null;
}
function watchHours(m) {
  const n = m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : 0);
  return n > 0 && m.duration ? Math.round((n * m.duration) / 60) : 0;
}
function similarOf(m, n = 6) {
  if (SIM_CACHE.has(m.id)) return SIM_CACHE.get(m.id);
  const g = new Set(m.genres || []);
  const out = [];
  if (g.size) {
    const fam = family(m);
    const skip = new Set([m.id, ...(m.rel || []), ...(fam ? [fam.id] : [])]);
    const scored = [];
    for (const c of SIM_POOL) {
      if (skip.has(c.o.id) || (c.o.rel || []).includes(m.id)) continue;
      let shared = 0;
      for (const x of c.g) if (g.has(x)) shared++;
      if (!shared) continue;
      const score = shared / (g.size + c.g.length - shared) + (c.o.format === m.format ? 0.08 : 0) + (c.ok ? 0.12 : 0) - (c.i / SIM_POOL.length) * 0.35;
      scored.push([score, c]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const keys = new Set([simKey(m)]), ids = new Set();
    for (const [, c] of scored) {
      if (keys.has(c.key) || (c.o.rel || []).some((id) => ids.has(id))) continue;
      out.push(c.o); keys.add(c.key); ids.add(c.o.id);
      if (out.length >= n) break;
    }
  }
  SIM_CACHE.set(m.id, out);
  return out;
}
// Date de mise à jour des infos (affichée sur les fiches)
const UPD = { fr: new Intl.DateTimeFormat("fr-BE", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(new Date()), en: new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(new Date()) };
const updNote = (lang) => `<p class="upd"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>${lang === "en" ? `Info updated automatically on ${UPD.en}.` : `Infos mises à jour automatiquement le ${UPD.fr}.`}</p>`;
// Boutons « Ma liste » et « Partager » des fiches (le texte est géré par app.js selon la langue)
const tools = (m, name) => `<div class="tools"><button type="button" class="tbtn" data-fav="${esc(m.slug)}" data-t="${esc(name)}" data-i="${esc(cover(m, "large"))}" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.8 3.5 4.5 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg><span></span></button><button type="button" class="tbtn" data-share data-t="${esc(name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3"/></svg><span></span></button>${m.nextAiringEpisode ? `<button type="button" class="tbtn" data-ics="${m.nextAiringEpisode.airingAt}" data-ep="${m.nextAiringEpisode.episode}" data-tot="${m.episodes || ""}" data-dur="${m.duration || 24}" data-s="${esc(m.slug)}" data-t="${esc(name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><span></span></button>` : ""}</div>`;

// ---------- Fiches animé ----------
const pages = [];
function animePage(m) {
  const rel = "../";
  const name = nameOf(m);
  const links = streaming(m);
  const oth = others(m);
  const fam = family(m);
  const wl = worldLinks(m);
  const worldHtml = `<section class="box world" id="monde"><h2>Où le regarder dans le monde</h2><p class="small">Plateformes qui proposent ${esc(name)} et qui sont présentes dans chaque région. Le catalogue exact peut varier d'un pays à l'autre : vérifiez sur la plateforme depuis votre pays.</p><div class="wtable">${REGIONS.map(([r, label]) => {
    const ls = wl.filter((l) => l.regions.includes(r));
    return `<div class="wrow" data-region="${r}"><span class="wr">${esc(label)}</span><span class="wl">${ls.length ? ls.map((l) => `<a class="chip p-${l.cls}" href="${esc(l.url)}" rel="noopener nofollow" target="_blank"><i></i>${esc(l.site)}</a>`).join("") : `<span class="chip muted">Aucune plateforme connue</span>`}</span></div>`;
  }).join("")}</div></section>`;
  const studio = m.studios?.nodes?.[0]?.name;
  const next = m.nextAiringEpisode;
  const genres = (m.genres || []).map((g) => GENRE_FR[g] || g);
  const seasonTxt = m.season && m.seasonYear ? `${SEASON_FR[m.season]} ${m.seasonYear}` : null;
  const alts = altTitles(m);
  const trailer = trailerUrl(m);

  const intro = [
    `<strong>${esc(name)}</strong> est ${m.format === "MOVIE" ? "un film d'animation" : "un animé"}${studio ? ` produit par le studio ${esc(studio)}` : ""}${seasonTxt ? `, de la saison ${esc(seasonTxt)}` : ""}.`,
    genres.length ? ` Genres : ${esc(genres.join(", ").toLowerCase())}.` : "",
    m.episodes ? ` Il compte ${m.episodes} épisode${m.episodes > 1 ? "s" : ""}.` : "",
  ].join("");

  const where = links.length
    ? `<p>En ce moment, <strong>${esc(name)}</strong> est proposé légalement sur ${links.map((l) => `<strong>${esc(l.site)}</strong>`).join(", ").replace(/, ([^,]*)$/, " et $1")}. La disponibilité peut varier selon le pays : vérifiez sur la plateforme depuis votre pays.</p>
<div class="plats">${links.map((l) => {
        const aff = affiliate(l.site);
        return `<div class="plat"><span><b><a href="${rel}plateforme/${PLATFORM_SLUG[l.site]}.html">${esc(l.site)}</a></b>${l.language ? `<small>${esc(l.language)}</small>` : ""}</span><span class="acts"><a class="btn" href="${esc(l.url)}" rel="noopener nofollow" target="_blank">Regarder</a>${aff ? `<a class="btn ghost" href="${esc(aff)}" rel="sponsored noopener" target="_blank">S'abonner</a>` : ""}</span></div>`;
      }).join("")}</div>`
    : `<p>Aucune grande plateforme française (Crunchyroll, ADN, Netflix, Prime Video, Disney+) n'est encore connue pour <strong>${esc(name)}</strong>. ${oth.length ? "Il existe toutefois d'autres liens officiels ci-dessous. " : ""}${fam ? `En revanche, <a href="${esc(fam.slug)}.html">${esc(nameOf(fam))}</a>, de la même franchise, est disponible sur ${streaming(fam).map((l) => `<strong>${esc(l.site)}</strong>`).join(", ")} : ${m.format === "MOVIE" ? "ce film" : "cette partie"} y est parfois proposé${m.format === "MOVIE" ? "" : "e"} aussi, vérifiez sur la plateforme. ` : ""}Vous pouvez aussi vérifier en un clic avec les recherches ci-dessous. Cette page se met à jour automatiquement chaque jour.</p>`;
  const othHtml = oth.length ? `<h3 class="h3">Autres liens officiels</h3><p class="small">Disponibilité variable selon le pays.</p><div class="plats">${oth.map((l) => `<div class="plat"><span><b>${esc(l.site)}</b>${l.language ? `<small>${esc(l.language)}</small>` : ""}</span><span class="acts"><a class="btn" href="${esc(l.url)}" rel="noopener nofollow" target="_blank">Voir</a></span></div>`).join("")}</div>` : "";
  const findHtml = `<h3 class="h3">${links.length ? "Vérifier ailleurs" : "Chercher où le regarder"}</h3><div class="findl">${searchLinks(m).map(([n, u]) => `<a class="btn ghost" href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(n)}</a>`).join("")}</div>`;

  const nextHtml = next
    ? `<div class="next"><span class="k">Prochain épisode</span><span class="t">Épisode ${next.episode}</span><span><time data-d="${next.airingAt}">${esc(longDate(next.airingAt))}</time> à <time data-t="${next.airingAt}">${hhmm(next.airingAt)}</time> <span data-tzl>(heure de Paris)</span></span><span class="countdown" data-at="${next.airingAt}"></span></div>`
    : "";

  const faq = [
    [`Où regarder ${name} légalement en France et en Belgique ?`, links.length ? `Sur ${links.map((l) => l.site).join(", ")}, sous réserve de disponibilité dans votre pays.` : oth.length ? `Aucune grande plateforme française n'est connue. Liens officiels existants : ${oth.map((l) => l.site).join(", ")} (selon le pays). Vous pouvez aussi vérifier sur JustWatch.` : "Aucune plateforme légale française n'est encore connue. Vous pouvez vérifier sur JustWatch, qui recense les offres disponibles en France."],
    ...(next ? [[`Quand sort le prochain épisode de ${name} ?`, `L'épisode ${next.episode} sort le ${longDate(next.airingAt)} à ${hhmm(next.airingAt)}, heure de Paris.`]] : []),
    ...(m.episodes ? [[`Combien d'épisodes compte ${name} ?`, `${m.episodes} épisode${m.episodes > 1 ? "s" : ""}.`]] : []),
  ];

  const similar = similarOf(m);

  const banner = m.bannerImage || cover(m);
  const body = `
<article class="fiche">
  <div class="fhero" style="--c:${esc(m.coverImage?.color || "#2A2D4A")}">
    ${banner ? `<div class="fhero-bg" style="background-image:url('${esc(banner)}')" aria-hidden="true"></div>` : ""}
    <div class="fhero-in">
      ${poster(m, "large", true)}
      <div class="fhero-txt">
        <p class="crumb"><a href="${rel}index.html">Accueil</a> <span>›</span> <a href="${rel}catalogue.html">Animés</a> <span>›</span> ${esc(name)}</p>
        <h1>Où regarder ${esc(name)}&nbsp;?</h1>
        ${alts.length ? `<p class="alt">Aussi connu sous : ${esc(alts.join(" · "))}</p>` : ""}
        <div class="facts">
          <span class="fact">${esc(FORMAT_FR[m.format] || m.format || "Animé")}</span>
          ${m.status ? `<span class="fact">${esc(STATUS_FR[m.status] || m.status)}</span>` : ""}
          ${m.episodes ? `<span class="fact">${m.episodes} épisode${m.episodes > 1 ? "s" : ""}</span>` : ""}
          ${m.averageScore ? `<span class="fact score">★ ${(m.averageScore / 10).toFixed(1).replace(".", ",")}/10</span>` : ""}
          ${studio ? `<span class="fact">${esc(studio)}</span>` : ""}
          ${watchHours(m) >= 2 ? `<span class="fact" title="Durée totale de visionnage">⏱ ${watchHours(m).toLocaleString("fr-BE")} h pour tout voir</span>` : ""}
        </div>
        ${(() => { const s = sequelOf(m); if (!s) return ""; const when = s.season && s.seasonYear ? `${SEASON_FR[s.season]} ${s.seasonYear}` : s.startDate?.year ? String(s.startDate.year) : ""; return `<p class="small">📢 Suite annoncée : <a href="${esc(s.slug)}.html">${esc(nameOf(s))}</a>${when ? `, prévue pour ${esc(when)}` : ", date à venir"}.</p>`; })()}
        ${links.length ? `<div class="ctas">${links.map((l) => `<a class="cta p-${PCLASS[l.site]}" href="${esc(l.url)}" rel="noopener nofollow" target="_blank"><i></i>Regarder sur ${esc(l.site)}</a>`).join("")}${trailer ? `<a class="cta ghost" href="${esc(trailer)}" rel="noopener nofollow" target="_blank"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Bande-annonce</a>` : ""}</div>` : `<p class="nolink">Aucune plateforme légale annoncée pour l'instant.</p>${trailer ? `<div class="ctas"><a class="cta ghost" href="${esc(trailer)}" rel="noopener nofollow" target="_blank"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Bande-annonce</a></div>` : ""}`}
        ${tools(m, name)}
      </div>
    </div>
  </div>
  <div class="fbody">
    <div class="fmain">
      ${nextHtml}
      <section class="box frbox"><h2>Plateformes légales en France</h2>${where}${othHtml}${findHtml}${updNote("fr")}</section>
      ${mangaBox({ lang: "fr", esc, anime: m, rel, slugify })}
      ${worldHtml}
      ${adSlot()}
      <section class="box"><h2>À propos</h2><p>${intro}</p>${(m.genres || []).length ? `<div class="tags">${(m.genres || []).map((g) => genreSlug[g] ? `<a href="${rel}genre/${genreSlug[g]}.html">${esc(GENRE_FR[g] || g)}</a>` : `<span>${esc(GENRE_FR[g] || g)}</span>`).join("")}</div>` : ""}${alts.length ? `<p class="small">Autres titres : ${esc(alts.join(", "))}.</p>` : ""}</section>
      <section class="box"><h2>Questions fréquentes</h2><dl class="faq">${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("")}</dl></section>
    </div>
  </div>
  ${similar.length ? `<section><h2 class="sec">Animés similaires</h2><div class="pgrid">${similar.map((o) => card(o, rel)).join("")}</div></section>` : ""}
</article>`;

  pages.push({
    path: `anime/${m.slug}.html`,
    html: page({
      path: `anime/${m.slug}.html`, rel,
      title: `Où regarder ${name} en streaming légal (VOSTFR, VF) ? Plateformes et prochain épisode`,
      desc: `${name} : sur quelles plateformes légales le regarder en France et en Belgique, date et heure du prochain épisode, nombre d'épisodes.`,
      body, image: cover(m),
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
  return `<a class="ep" href="${rel}anime/${e.m.slug}.html" data-n="${esc([nameOf(e.m), ...altTitles(e.m)].join(" | "))}"><time data-t="${e.airingAt}">${hhmm(e.airingAt)}</time>${poster(e.m, "medium")}<span class="ep-t"><b>${esc(nameOf(e.m))}</b><small>Épisode ${e.episode}${e.m.episodes ? ` sur ${e.m.episodes}` : ""}</small></span><span class="chips">${chips(e.m, 2)}</span></a>`;
}
{
  const rel = "";
  const body = `
<div class="phead"><p class="eyebrow">Calendrier</p><h1>Les sorties animés de la semaine</h1>
<p class="lead">Les nouveaux épisodes de la semaine à l'heure de Paris et Bruxelles, avec la plateforme légale pour les regarder. Mis à jour chaque jour.</p></div>
<div class="search cal-search">
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  <input id="calq" type="search" placeholder="Chercher un animé dans les sorties de la semaine…" autocomplete="off" aria-label="Chercher un animé dans le calendrier">
</div>
<p class="cal-none" id="calnone" hidden>Aucun épisode de cet animé n'est prévu cette semaine. S'il sort plus tard, il apparaîtra ici quelques jours avant sa sortie.</p>
<div class="days" role="tablist" aria-label="Jour">${dayList.map(([k, d], i) => `<button class="day" type="button" role="tab" data-day="${k}" aria-selected="${i === 0}">${esc(d.label)}</button>`).join("")}</div>
${dayList.map(([k, d], i) => `<section class="dayp" data-day="${k}" ${i === 0 ? "" : "hidden"}><h2 class="sec">${esc(d.label[0].toUpperCase() + d.label.slice(1))}</h2><div class="eps">${d.items.map((e) => epRow(e, rel)).join("")}</div></section>`).join("")}
${adSlot()}`;
  pages.push({ path: "calendrier.html", html: page({ path: "calendrier.html", rel, title: "Calendrier des sorties animés de la semaine (heure de Paris)", desc: "Tous les nouveaux épisodes d'animés de la semaine, jour par jour, à l'heure de Paris et Bruxelles, avec les plateformes légales pour les regarder.", body }) });
}

// ---------- Saisons ----------
for (const s of [data.current, data.next]) {
  const rel = "../";
  const list = data.media.filter((m) => m.tags?.includes(`${s.season}-${s.year}`)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  const lab = seasonLabel(s);
  const body = `
<div class="phead"><p class="eyebrow">Saison ${esc(lab)}</p><h1>Les animés ${s.season === "SPRING" ? "du " : "de l'"}${esc(lab)}</h1>
<p class="lead">${list.length} animés de la saison, classés par popularité, avec les plateformes légales où les regarder en France et en Belgique.</p></div>
<div class="pgrid">${list.map((m) => card(m, rel)).join("")}</div>
${adSlot()}`;
  pages.push({ path: seasonPath(s), html: page({ path: seasonPath(s), rel, title: `Animés ${lab} : la liste complète et où les regarder`, desc: `Tous les animés de la saison ${lab}, classés par popularité, avec les plateformes légales pour les regarder en France et en Belgique.`, body }) });
}

// ---------- Pages plateformes et genres ----------
const byPop = (a, b) => (b.popularity || 0) - (a.popularity || 0);
const PLATFORM_INFO = {
  "Crunchyroll": "La plus grande plateforme d'animés au monde : simulcasts japonais en VOSTFR quelques heures après le Japon, et de nombreuses VF.",
  "Netflix": "Netflix propose un large choix d'animés, dont de nombreuses exclusivités et des séries doublées en français.",
  "ADN": "Animation Digital Network, la plateforme française spécialisée dans l'animation japonaise, disponible en France, en Belgique, en Suisse et au Luxembourg.",
  "Prime Video": "Amazon Prime Video propose une sélection d'animés en VOSTFR et en VF, incluse dans l'abonnement Prime.",
  "Disney+": "Disney+ diffuse quelques animés japonais en exclusivité, en plus de son catalogue d'animation.",
};
const platformPages = Object.keys(PLATFORM_SLUG).map((site) => ({ site, slug: PLATFORM_SLUG[site], list: data.media.filter((m) => streaming(m).some((l) => l.site === site)).sort(byPop) })).filter((p) => p.list.length);
for (const pl of platformPages) {
  const rel = "../";
  const shown = pl.list.slice(0, 400);
  const body = `
<div class="phead"><p class="eyebrow">Plateforme</p><h1>Les animés disponibles sur ${esc(pl.site)}</h1>
<p class="lead">${pl.list.length.toLocaleString("fr-FR")} animés à regarder légalement sur ${esc(pl.site)}, classés par popularité. ${esc(PLATFORM_INFO[pl.site] || "")}</p></div>
<div class="pgrid">${shown.map((m) => card(m, rel)).join("")}</div>
${adSlot()}`;
  pages.push({ path: `plateforme/${pl.slug}.html`, html: page({ path: `plateforme/${pl.slug}.html`, rel, title: `Animés sur ${pl.site} : la liste complète (${pl.list.length} titres)`, desc: `Tous les animés disponibles sur ${pl.site} en France et en Belgique, classés par popularité : ${pl.list.slice(0, 5).map(nameOf).join(", ")}…`, body, image: cover(pl.list[0]) }) });
}
// Plateformes du reste du monde
const regionLabel = Object.fromEntries(REGIONS.map(([r, l]) => [r, l]));
const worldPages = [];
{
  const seenN = new Set(Object.keys(PLATFORM_SLUG));
  for (const [name, cls, regions] of Object.values(SERVICES)) {
    if (seenN.has(name)) continue;
    seenN.add(name);
    const list = data.media.filter((m) => worldLinks(m).some((l) => l.site === name)).sort(byPop);
    if (list.length < 3) continue;
    worldPages.push({ name, cls, regions, slug: WORLD_SLUG(name), list });
  }
}
for (const pl of worldPages) {
  const rel = "../";
  const where = pl.regions.length >= 7 ? "dans la plupart des pays" : pl.regions.map((r) => regionLabel[r]).join(", ");
  const body = `
<div class="phead"><p class="eyebrow">Plateforme · monde</p><h1>Les animés disponibles sur ${esc(pl.name)}</h1>
<p class="lead">${pl.list.length.toLocaleString("fr-FR")} animés proposés sur ${esc(pl.name)}, classés par popularité. Service présent : ${esc(where)}. Le catalogue exact varie selon les pays.</p></div>
<div class="pgrid">${pl.list.slice(0, 400).map((m) => card(m, rel)).join("")}</div>
${adSlot()}`;
  pages.push({ path: `plateforme/${pl.slug}.html`, html: page({ path: `plateforme/${pl.slug}.html`, rel, title: `Animés sur ${pl.name} : la liste (${pl.list.length} titres)`, desc: `Les animés disponibles sur ${pl.name} (${where}) : ${pl.list.slice(0, 5).map(nameOf).join(", ")}…`, body, image: cover(pl.list[0]) }) });
}
{
  const rel = "";
  const body = `
<div class="phead"><p class="eyebrow">Plateformes</p><h1>Où regarder des animés légalement&nbsp;?</h1>
<p class="lead">Les plateformes de streaming légal d'animés en France, en Belgique et dans les pays francophones, avec leur catalogue.</p></div>
<div class="ptiles">${platformPages.map((pl) => `<a class="ptile p-${PCLASS[pl.site]}" href="plateforme/${pl.slug}.html"><span class="ptile-posters">${pl.list.slice(0, 4).map((m) => poster(m, "medium")).join("")}</span><span class="ptile-b"><b><i></i>${esc(pl.site)}</b><small>${pl.list.length.toLocaleString("fr-FR")} animés</small><span>${esc(PLATFORM_INFO[pl.site] || "")}</span></span></a>`).join("")}</div>
<h2 class="sec">Dans le reste du monde</h2>
<p class="sub">Les plateformes légales d'autres pays : États-Unis, Japon, Chine, Asie, Amérique latine… Choisis ta région en haut de la page pour adapter l'affichage.</p>
<div class="pchips">${worldPages.map((pl) => `<a class="pchip p-${pl.cls}" href="plateforme/${pl.slug}.html"><i></i>${esc(pl.name)}<small>${pl.list.length.toLocaleString("fr-FR")}</small></a>`).join("")}</div>`;
  pages.push({ path: "plateformes.html", html: page({ path: "plateformes.html", rel, title: "Plateformes de streaming d'animés légales : Crunchyroll, ADN, Netflix…", desc: "Comparez les plateformes légales pour regarder des animés en France et en Belgique : Crunchyroll, ADN, Netflix, Prime Video, Disney+.", body }) });
}
const genrePages = GENRE_PAGES.map((x) => ({ ...x, list: data.media.filter((m) => (m.genres || []).includes(x.g)).sort(byPop) })).filter((x) => x.list.length >= 5);
for (const gp of genrePages) {
  const rel = "../";
  const body = `
<div class="phead"><p class="eyebrow">Genre</p><h1>Les meilleurs animés ${esc(gp.fr.toLowerCase())}</h1>
<p class="lead">${gp.list.length.toLocaleString("fr-FR")} animés du genre ${esc(gp.fr.toLowerCase())}, classés par popularité, avec les plateformes légales où les regarder.</p></div>
<nav class="genres">${genrePages.map((o) => `<a href="${rel}genre/${o.slug}.html"${o.slug === gp.slug ? ' aria-current="page"' : ""}>${esc(o.fr)}</a>`).join("")}</nav>
<div class="pgrid">${gp.list.slice(0, 300).map((m) => card(m, rel)).join("")}</div>
${adSlot()}`;
  pages.push({ path: `genre/${gp.slug}.html`, html: page({ path: `genre/${gp.slug}.html`, rel, title: `Meilleurs animés ${gp.fr.toLowerCase()} : la liste et où les regarder`, desc: `Les animés ${gp.fr.toLowerCase()} les plus populaires (${gp.list.slice(0, 4).map(nameOf).join(", ")}…) et les plateformes légales pour les regarder.`, body, image: cover(gp.list[0]) }) });
}
{
  const rel = "";
  const body = `
<div class="phead"><p class="eyebrow">Genres</p><h1>Les animés par genre</h1><p class="lead">Action, romance, horreur, sport… Trouve ton prochain animé selon ce que tu aimes.</p></div>
<div class="gtiles">${genrePages.map((gp) => `<a class="gtile" href="genre/${gp.slug}.html">${poster(gp.list[0], "large")}<span><b>${esc(gp.fr)}</b><small>${gp.list.length.toLocaleString("fr-FR")} animés</small></span></a>`).join("")}</div>`;
  pages.push({ path: "genres.html", html: page({ path: "genres.html", rel, title: "Animés par genre : action, romance, horreur, sport…", desc: "Tous les genres d'animés avec les titres les plus populaires et où les regarder légalement.", body }) });
}

// ---------- Catalogue A-Z ----------
{
  const letterOf = (m) => {
    const c = nameOf(m).normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toLowerCase();
    return /[a-z]/.test(c) ? c : "0-9";
  };
  const groups = new Map();
  for (const m of data.media) {
    const l = letterOf(m);
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(m);
  }
  const letters = [...groups.keys()].sort((a, b) => (a === "0-9" ? -1 : b === "0-9" ? 1 : a.localeCompare(b)));
  const letterNav = (rel, current) => `<nav class="letters" aria-label="Lettres">${letters.map((l) => `<a href="${rel}catalogue/${l}.html"${l === current ? ' aria-current="page"' : ""}>${l.toUpperCase()}</a>`).join("")}</nav>`;
  const row = (m, rel) => `<a class="row" href="${rel}anime/${m.slug}.html">${poster(m, "medium")}<span class="row-t"><b>${esc(nameOf(m))}</b><small>${esc(FORMAT_FR[m.format] || m.format || "")}${(m.seasonYear || m.startDate?.year) ? " · " + (m.seasonYear || m.startDate?.year) : ""}${m.title.romaji && m.title.romaji !== nameOf(m) ? " · " + esc(m.title.romaji) : ""}</small></span><span class="chips">${chips(m, 3)}</span></a>`;
  const PER = 250; // animés par page, pour garder des pages légères
  for (const l of letters) {
    const rel = "../";
    const all = groups.get(l).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "fr"));
    const L = l.toUpperCase();
    const nPages = Math.ceil(all.length / PER);
    const pathOf = (n) => `catalogue/${l}${n > 1 ? "-" + n : ""}.html`;
    for (let n = 1; n <= nPages; n++) {
      const list = all.slice((n - 1) * PER, n * PER);
      const pager = nPages > 1 ? `<nav class="pager" aria-label="Pages">${n > 1 ? `<a href="${rel}${pathOf(n - 1)}">← Précédent</a>` : ""}${Array.from({ length: nPages }, (_, i) => i + 1).map((k) => k === n ? `<span aria-current="page">${k}</span>` : `<a href="${rel}${pathOf(k)}">${k}</a>`).join("")}${n < nPages ? `<a href="${rel}${pathOf(n + 1)}">Suivant →</a>` : ""}</nav>` : "";
      const suffix = nPages > 1 ? ` (page ${n} sur ${nPages})` : "";
      const body = `
<div class="phead"><p class="eyebrow">Catalogue</p><h1>Animés commençant par ${L}${suffix}</h1>
<p class="lead">${all.length.toLocaleString("fr-FR")} animés, avec les plateformes légales où les regarder en France et en Belgique.</p></div>
${letterNav(rel, l)}
${pager}
<div class="rows">${list.map((m) => row(m, rel)).join("")}</div>
${pager}
${adSlot()}`;
      pages.push({ path: pathOf(n), html: page({ path: pathOf(n), rel, title: `Animés de A à Z : lettre ${L}${suffix} | où les regarder en France et en Belgique`, desc: `Liste des animés commençant par ${L}${suffix} et les plateformes légales pour les regarder en France et en Belgique.`, body }) });
    }
  }
  const rel = "";
  const top = [...data.media].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 100);
  const body = `
<div class="phead"><p class="eyebrow">Catalogue</p><h1>Tous les animés et où les regarder</h1>
<p class="lead">${data.media.length.toLocaleString("fr-BE")} animés, des grands classiques aux sorties de la saison, avec les plateformes légales disponibles en France et en Belgique.</p></div>
<section class="filters" id="filters" aria-label="Filtres">
  <label>Plateforme<select id="f-p"><option value="">Toutes</option>${[...new Set(Object.values(SERVICES).map(([n]) => n))].map((p) => `<option>${esc(p)}</option>`).join("")}</select></label>
  <label>Genre<select id="f-g"><option value="">Tous</option>${genrePages.map((g) => `<option value="${g.slug}">${esc(g.fr)}</option>`).join("")}</select></label>
  <label>Période<select id="f-y"><option value="">Toutes</option><option value="2020">2020 et après</option><option value="2010">2010 – 2019</option><option value="2000">2000 – 2009</option><option value="1990">1990 – 1999</option><option value="1980">Avant 1990</option></select></label>
  <label>Statut<select id="f-s"><option value="">Tous</option><option value="R">En cours de diffusion</option><option value="F">Terminé</option><option value="N">À venir</option></select></label>
  <label class="chk"><input type="checkbox" id="f-a"> Avec plateforme uniquement</label>
</section>
<div id="f-out" hidden><p class="sub" id="f-count"></p><div class="pgrid" id="f-grid"></div><button class="btn more" id="f-more" type="button" hidden>Afficher plus</button></div>
${letterNav(rel, null)}
<h2 class="sec">Les 100 animés les plus populaires</h2>
<div class="pgrid">${top.map((m) => card(m, rel)).join("")}</div>
${adSlot()}`;
  pages.push({ path: "catalogue.html", html: page({ path: "catalogue.html", rel, title: "Tous les animés de A à Z et où les regarder légalement en France et en Belgique", desc: "Le catalogue complet des animés, des classiques aux nouveautés, avec les plateformes légales pour les regarder en France et en Belgique.", body }) });
}

// ---------- Accueil ----------
{
  const rel = "";
  const popular = data.media.filter((m) => m.tags?.includes(`${data.current.season}-${data.current.year}`) || m.status === "RELEASING").sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 12);
  const firstDay = dayList[0];
  const moods = [["Action", "action"], ["Comedy", "rire"], ["Romance", "romance"], ["Drama", "émotion"], ["Horror", "frisson"], ["Fantasy", "évasion"]];
  const pickData = moods.map(([g, label]) => ({ label, items: data.media.filter((m) => (m.genres || []).includes(g) && streaming(m).length).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 12).map((m) => ({ t: nameOf(m), u: `anime/${m.slug}.html`, i: cover(m), p: streaming(m).map((l) => l.site).slice(0, 3).join(", ") })) })).filter((x) => x.items.length);
  const heroBg = popular.slice(0, 6).map((m) => cover(m)).filter(Boolean);
  const nPlat = data.media.filter((m) => streaming(m).length).length;
  const body = `
<section class="hero">
  <div class="hero-bg" aria-hidden="true">${heroBg.map((u) => `<img src="${esc(u)}" alt="">`).join("")}</div>
  <div class="hero-in">
    <p class="eyebrow">Le guide des animés en streaming légal</p>
    <h1>Tu veux le voir&nbsp;? On te dit <em>où</em>.</h1>
    <p class="lead">Trouve en un instant sur quelle plateforme légale regarder un animé, et quand sort le prochain épisode.</p>
    <div class="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Rechercher un animé : One Piece, Frieren, Naruto…" autocomplete="off" aria-label="Rechercher un animé">
    </div>
    <div class="results" id="results" aria-live="polite"></div>
    <ul class="stats"><li><b>${data.media.length.toLocaleString("fr-BE")}</b> animés</li><li><b>${nPlat.toLocaleString("fr-BE")}</b> avec une plateforme légale</li><li><b>Chaque jour</b> mis à jour</li></ul>
    <p style="margin:16px 0 0"><button class="btn" type="button" id="rnd">🎲 Surprends-moi</button></p>
  </div>
</section>
${firstDay ? `<section><div class="sec-h"><h2 class="sec">Les sorties du jour</h2><a href="calendrier.html">Toute la semaine →</a></div><p class="sub" data-tdl>${esc(firstDay[1].label[0].toUpperCase() + firstDay[1].label.slice(1))}, à l'heure de Paris et Bruxelles.</p><div class="eps" data-today>${[...firstDay[1].items.map((e, i) => [e, i < 8]), ...(dayList[1] ? dayList[1][1].items.map((e) => [e, false]) : [])].map(([e, v]) => v ? epRow(e, rel) : epRow(e, rel).replace('<a class="ep"', '<a hidden class="ep"')).join("")}</div></section>` : ""}
${adSlot()}
<section><div class="sec-h"><h2 class="sec">Populaires en ce moment</h2><a href="catalogue.html">Tout le catalogue →</a></div><div class="pgrid">${popular.map((m) => card(m, rel)).join("")}</div></section>
<section><div class="sec-h"><h2 class="sec">Par plateforme</h2><a href="plateformes.html">Comparer les plateformes →</a></div><div class="pchips">${platformPages.map((pl) => `<a class="pchip p-${PCLASS[pl.site]}" href="plateforme/${pl.slug}.html"><i></i>${esc(pl.site)}<small>${pl.list.length.toLocaleString("fr-FR")}</small></a>`).join("")}</div></section>
<section><div class="sec-h"><h2 class="sec">Par genre</h2><a href="genres.html">Tous les genres →</a></div><nav class="genres">${genrePages.map((g) => `<a href="genre/${g.slug}.html">${esc(g.fr)}</a>`).join("")}</nav></section>
${fillerHome({ lang: "fr", esc })}
${mangaHome({ lang: "fr", esc, slugify })}
<section class="tonight"><h2 class="sec">Qu'est-ce qu'on regarde ce soir&nbsp;?</h2><p class="sub">Choisis ton humeur, on te trouve un animé.</p>
<div class="moods" id="moods" role="group" aria-label="Humeur"></div><div class="pick" id="pick"></div>
<script type="application/json" id="pickdata">${JSON.stringify(pickData).replace(/</g, "\\u003c")}</script></section>`;
  pages.push({ path: "index.html", html: page({ path: "index.html", rel, title: `${cfg.siteName} : où regarder tes animés en streaming légal`, desc: "Trouve sur quelle plateforme légale regarder un animé en France et en Belgique, le calendrier des sorties à l'heure de Paris et Bruxelles et des idées pour ce soir.", body, image: heroBg[0], jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, url: SITE + "/" } }) });
}

// ---------- À propos & 404 ----------
const prosePage = (path, title, desc, h1, html) => pages.push({ path, html: page({ path, rel: "", title, desc, body: `<div class="phead"><h1>${h1}</h1></div><div class="prose">${html}</div>` }) });
prosePage("mentions-legales.html", `Mentions légales | ${cfg.siteName}`, `Mentions légales du site ${cfg.siteName}.`, "Mentions légales", `
<h2>Éditeur</h2><p>${esc(cfg.siteName)} est un projet indépendant, sans lien avec les plateformes de streaming citées ni avec les ayants droit des œuvres présentées.</p>
<h2>Hébergement</h2><p>Le site est hébergé par GitHub Pages, un service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</p>
<h2>Contenus</h2><p>${esc(cfg.siteName)} ne diffuse et n'héberge aucune vidéo. Les titres, informations et visuels (affiches, bannières) proviennent de la base de données AniList et restent la propriété de leurs ayants droit respectifs. Ils sont utilisés uniquement pour identifier les œuvres et orienter vers leur diffusion légale.</p>
<p>Si vous êtes ayant droit et souhaitez le retrait d'un visuel ou d'une information, signalez-le via la page GitHub du projet : la demande sera traitée rapidement.</p>
<h2>Exactitude</h2><p>Les disponibilités et horaires sont mis à jour automatiquement chaque jour mais peuvent changer sans préavis. Vérifiez toujours sur la plateforme concernée.</p>`);
prosePage("confidentialite.html", `Politique de confidentialité | ${cfg.siteName}`, `Politique de confidentialité du site ${cfg.siteName}.`, "Politique de confidentialité", `
<p>${esc(cfg.siteName)} ne demande aucune inscription et ne collecte directement aucune donnée personnelle. Ta région et « Ma liste » sont enregistrées uniquement dans ton propre navigateur : elles ne sont envoyées nulle part.</p>
<h2>Mesure d'audience</h2><p>Le site utilise GoatCounter, un outil de statistiques sans cookies qui compte les visites de façon anonyme (pages vues, pays, type d'appareil), sans suivi individuel.</p>
<h2>Services tiers</h2><p>Pour afficher le site, votre navigateur contacte des services tiers : Google Fonts (polices d'écriture) et AniList (affiches des animés). Ces services peuvent recevoir votre adresse IP, comme pour toute visite d'un site web.</p>
${cfg.adsenseClient ? `<h2>Publicité</h2><p>Le site affiche des annonces Google AdSense. Google peut utiliser des cookies pour diffuser des annonces adaptées. Vous pouvez gérer vos préférences sur la page « Paramètres des annonces » de Google.</p>` : ""}
<h2>Vos droits</h2><p>Conformément au RGPD, vous pouvez exercer vos droits auprès des services tiers concernés. Pour toute question, utilisez la page GitHub du projet.</p>`);
pages.push({ path: "a-propos.html", html: page({ path: "a-propos.html", rel: "", title: `À propos de ${cfg.siteName}`, desc: `${cfg.siteName} aide à trouver où regarder légalement ses animés, en France, en Belgique et partout dans le monde.`, body: `<div class="phead"><h1>À propos</h1></div><div class="prose"><p>${esc(cfg.siteName)} aide les fans d'animés du monde entier à trouver où regarder leurs séries légalement dans leur pays, et à savoir quand sortent les nouveaux épisodes.</p><p>Le site ne diffuse et n'héberge aucune vidéo. Il renvoie uniquement vers les plateformes officielles. Le site est gratuit, sans publicité et sans lien affilié.</p><p>Les informations proviennent d'AniList et sont mises à jour automatiquement chaque jour. La disponibilité d'un titre peut varier selon le pays : vérifiez toujours sur la plateforme.</p></div>` }) });
pages.push({ path: "ma-liste.html", html: page({ path: "ma-liste.html", rel: "", title: `Ma liste d'animés | ${cfg.siteName}`, desc: "Les animés que tu as ajoutés à ta liste, pour retrouver vite où les regarder.", body: `<div class="phead"><p class="eyebrow">Ma liste</p><h1>Ma liste d'animés</h1><p class="lead">Ajoute des animés avec le bouton ♡ sur leur fiche pour les retrouver ici. Ta liste reste uniquement dans ce navigateur, sans compte. Pour la retrouver sur un autre appareil ou l'envoyer à un ami, utilise « Partager ma liste ».</p><div class="tools"><button type="button" class="tbtn" id="mylist-share" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3"/></svg><span></span></button></div><p class="small" id="mylist-msg" hidden></p></div><div class="pgrid mylistg" id="mylist" data-rel=""></div><p class="lead" id="mylist-empty" hidden>Ta liste est vide pour l'instant. <a href="catalogue.html">Parcours le catalogue</a> et clique sur « Ajouter à ma liste » sur les animés qui te plaisent.</p>` }) });
pages.push({ path: "404.html", html: page({ path: "404.html", rel: BASE, title: "Page introuvable", desc: "Cette page n'existe pas.", body: `<div class="phead"><h1>Page introuvable</h1></div><p class="lead">Cette page n'existe pas ou plus. <a href="${BASE}index.html">Retour à l'accueil</a></p>` }) });

// ---------- Fillers (épisodes à sauter) ----------
pages.push(...fillerPages({ lang: "fr", page, esc, byId, cover }));

// ---------- Mangas (où les lire légalement) ----------
pages.push(...mangaPages({ lang: "fr", page, esc, slugify, poster, cover, animeById: byId, animeCard: card, base: BASE }));

// ---------- Écriture ----------
await rm(OUT, { recursive: true, force: true });
await mkdir(new URL("anime/", OUT), { recursive: true });
await mkdir(new URL("saison/", OUT), { recursive: true });
await mkdir(new URL("catalogue/", OUT), { recursive: true });
await mkdir(new URL("plateforme/", OUT), { recursive: true });
await mkdir(new URL("genre/", OUT), { recursive: true });
await mkdir(new URL("fillers/", OUT), { recursive: true });
await mkdir(new URL("manga/", OUT), { recursive: true });
for (const p of pages) await writeFile(new URL(p.path, OUT), p.html);
await cp(new URL("static/", root), OUT, { recursive: true });
const IMG_PREFIX = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/";
const ST = { RELEASING: "R", FINISHED: "F", NOT_YET_RELEASED: "N" };
const search = [...data.media].sort(byPop).map((m) => ({ t: nameOf(m), a: [...new Set([m.title.romaji, m.title.english, m.title.native, ...(m.synonyms || []).slice(0, 8)].filter((t) => t && t !== nameOf(m)))].join(" | "), g: (m.genres || []).map((g) => genreSlug[g]).filter(Boolean), s: ST[m.status] || "", u: `anime/${m.slug}.html`, i: cover(m, "large").replace(IMG_PREFIX, ""), y: m.seasonYear || m.startDate?.year || "", p: [...streaming(m), ...others(m)].map((l) => l.site).slice(0, 3), w: worldLinks(m).map(wTag), ...(family(m) && !others(m).length ? { f: streaming(family(m)).map((l) => l.site).slice(0, 2) } : {}) }));
await writeFile(new URL("search.json", OUT), JSON.stringify(search));
await writeFile(new URL("manga-search.json", OUT), JSON.stringify(mangaSearchData()));
// Prochains épisodes (pour « Ma liste ») : { slug: [épisode, date] }
await writeFile(new URL("airing.json", OUT), JSON.stringify(Object.fromEntries(data.media.filter((m) => m.nextAiringEpisode?.airingAt > Date.now() / 1000).map((m) => [m.slug, [m.nextAiringEpisode.episode, m.nextAiringEpisode.airingAt]]))));
{
  const svc = {};
  for (const [name, cls, regions] of Object.values(SERVICES)) svc[name] = [cls, regions];
  await writeFile(new URL("world.js", OUT), `window.TZW=${JSON.stringify({ s: svc, r: REGIONS.map(([r, l]) => [r, l]) })};`);
}
// ---------- Version anglaise ----------
const { buildEn } = await import("./build-en.mjs");
const enPaths = await buildEn({ sequelOf, watchHours, similarOf, tools, updNote, wTag, data, cfg, SITE, BASE, OUT, esc, slugify, nameOf, cover, poster, streaming, others, family, worldLinks, SERVICES, REGIONS, PLATFORM_SLUG, WORLD_SLUG, GENRE_PAGES, genreSlug, POPULAR, byId, altTitles, trailerUrl, adSlot, adsHead, dayList, hreflangs, worldPages, platformPages, genrePages, TZ });
const today = new Date().toISOString().slice(0, 10);
const allPaths = [...pages.filter((p) => p.path !== "404.html" && p.path !== "ma-liste.html").map((p) => p.path), ...enPaths.filter((p) => p !== "en/my-list.html")];
{
  // Sitemap découpé en morceaux de 5 000 URL + un index (Google lit mieux les petits fichiers)
  const urls = allPaths.map((p) => `<url><loc>${esc(`${SITE}/${p}`.replace(/index\.html$/, ""))}</loc><lastmod>${today}</lastmod></url>`);
  const CHUNK = 5000;
  const parts = [];
  for (let i = 0; i < urls.length; i += CHUNK) {
    const name = `sitemap-${parts.length + 1}.xml`;
    await writeFile(new URL(name, OUT), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.slice(i, i + CHUNK).join("\n")}\n</urlset>\n`);
    parts.push(name);
  }
  await writeFile(new URL("sitemap.xml", OUT), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.map((n) => `<sitemap><loc>${SITE}/${n}</loc><lastmod>${today}</lastmod></sitemap>`).join("\n")}\n</sitemapindex>\n`);
}
await writeFile(new URL("manifest.webmanifest", OUT), JSON.stringify({ name: `${cfg.siteName} : où regarder tes animés`, short_name: cfg.siteName, start_url: BASE, scope: BASE, display: "standalone", background_color: "#0B0C16", theme_color: "#0B0C16", lang: "fr", icons: [{ src: `${BASE}icon-192.png`, sizes: "192x192", type: "image/png" }, { src: `${BASE}icon-512.png`, sizes: "512x512", type: "image/png" }, { src: `${BASE}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" }] }));
await writeFile(new URL("robots.txt", OUT), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
{
  // IndexNow : prévient Bing (et d'autres moteurs) chaque jour des pages mises à jour
  const KEY = "8ede6006e0e78610b58513934ad018ef";
  await writeFile(new URL(`${KEY}.txt`, OUT), KEY);
  const known = new Set(allPaths);
  const hubs = ["index.html", "calendrier.html", "catalogue.html", "fillers.html", "plateformes.html", "en/index.html", "en/calendar.html", "en/catalog.html", "en/fillers.html", "en/platforms.html"];
  const airing = [...new Set(data.schedule.map((s) => byId.get(s.id)?.slug).filter(Boolean))].flatMap((s) => [`anime/${s}.html`, `en/anime/${s}.html`]);
  const urlList = [...new Set([...hubs, ...airing])].filter((p) => known.has(p)).slice(0, 10000).map((p) => `${SITE}/${p}`.replace(/index\.html$/, ""));
  await writeFile(new URL("indexnow.json", OUT), JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }));
}
console.log(`Site généré : ${pages.length} pages en français + ${enPaths.length} en anglais dans dist/`);
