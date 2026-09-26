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
for (const m of [...data.media].sort((a, b) => a.id - b.id)) {
  let s = slugify(nameOf(m));
  if (used.has(s)) s = `${s}-${m.id}`;
  used.add(s);
  m.slug = s;
}
const byId = new Map(data.media.map((m) => [m.id, m]));
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
<html lang="fr">

<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
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
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="${rel}index.html" aria-label="${esc(cfg.siteName)}, accueil"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#FFC857"/><path d="M12 9.5v13l10.5-6.5z" fill="#101223"/></svg><span>${esc(cfg.siteName)}</span></a>
    <nav aria-label="Menu principal">
      <a href="${rel}calendrier.html">Calendrier</a>
      <a href="${rel}catalogue.html">Catalogue</a>
      <a href="${rel}${seasonPath(data.next)}">Saison ${esc(SEASON_FR[data.next.season])}</a>
      <a class="nav-search" href="${rel}index.html#q" aria-label="Rechercher"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span>Rechercher</span></a>
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
      <p>Le guide gratuit pour savoir où regarder tes animés légalement, en France, en Belgique, en Suisse et au Canada. Nous ne diffusons aucune vidéo : nous renvoyons uniquement vers les plateformes officielles.</p>
    </div>
    <div><h3>Explorer</h3><a href="${rel}calendrier.html">Calendrier des sorties</a><a href="${rel}catalogue.html">Tous les animés</a><a href="${rel}${seasonPath(data.current)}">Saison ${esc(seasonLabel(data.current))}</a><a href="${rel}${seasonPath(data.next)}">Saison ${esc(seasonLabel(data.next))}</a></div>
    <div><h3>Informations</h3><a href="${rel}a-propos.html">À propos</a><a href="${rel}mentions-legales.html">Mentions légales</a><a href="${rel}confidentialite.html">Confidentialité</a></div>
  </div>
  <div class="wrap foot-legal">© ${new Date().getFullYear()} ${esc(cfg.siteName)} · Données et visuels : <a href="https://anilist.co" rel="noopener">AniList</a> (site non affilié) · Horaires à l'heure de Paris et Bruxelles (convertis automatiquement si vous êtes ailleurs), mis à jour chaque jour · Certains liens peuvent être affiliés.</div>
</footer>
<script src="${rel}app.js" defer></script>
</body>
</html>`;
}

const PCLASS = { "Crunchyroll": "cr", "Netflix": "nf", "ADN": "adn", "Prime Video": "pv", "Disney+": "dp" };
function chips(m, max = 4) {
  const links = streaming(m).slice(0, max);
  if (!links.length) return `<span class="chip muted">À confirmer</span>`;
  return links.map((l) => `<span class="chip p-${PCLASS[l.site]}"><i></i>${esc(l.site)}</span>`).join("");
}
const cover = (m, size = "large") => m.coverImage?.[size] || m.coverImage?.large || m.coverImage?.medium || "";
function poster(m, size = "large", eager = false) {
  const src = cover(m, size);
  return `<span class="poster" style="--c:${esc(m.coverImage?.color || "#2A2D4A")}">${src ? `<img src="${esc(src)}" alt="" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : `<b>${esc(nameOf(m).slice(0, 1))}</b>`}</span>`;
}
const metaLine = (m) => [FORMAT_FR[m.format] || m.format, m.seasonYear].filter(Boolean).join(" · ");
function card(m, rel) {
  return `<a class="pcard" href="${rel}anime/${m.slug}.html">
  ${poster(m)}
  <span class="pc-b"><b>${esc(nameOf(m))}</b><small>${esc(metaLine(m))}</small><span class="chips">${chips(m, 2)}</span></span>
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
    ? `<p>En ce moment, <strong>${esc(name)}</strong> est proposé légalement sur ${links.map((l) => `<strong>${esc(l.site)}</strong>`).join(", ").replace(/, ([^,]*)$/, " et $1")}. La disponibilité peut varier selon le pays : vérifiez sur la plateforme depuis votre pays.</p>
<div class="plats">${links.map((l) => {
        const aff = affiliate(l.site);
        return `<div class="plat"><span><b>${esc(l.site)}</b>${l.language ? `<small>${esc(l.language)}</small>` : ""}</span><span class="acts"><a class="btn" href="${esc(l.url)}" rel="noopener nofollow" target="_blank">Regarder</a>${aff ? `<a class="btn ghost" href="${esc(aff)}" rel="sponsored noopener" target="_blank">S'abonner</a>` : ""}</span></div>`;
      }).join("")}</div>`
    : `<p>Aucune plateforme légale n'est encore annoncée pour <strong>${esc(name)}</strong>. Cette page se met à jour automatiquement dès qu'une plateforme est confirmée.</p>`;

  const nextHtml = next
    ? `<div class="next"><span class="k">Prochain épisode</span><span class="t">Épisode ${next.episode}</span><span>${esc(longDate(next.airingAt))} à ${hhmm(next.airingAt)} (heure de Paris)</span><span class="countdown" data-at="${next.airingAt}"></span></div>`
    : "";

  const faq = [
    [`Où regarder ${name} légalement en France et en Belgique ?`, links.length ? `Sur ${links.map((l) => l.site).join(", ")}, sous réserve de disponibilité dans votre pays.` : "Aucune plateforme n'est encore annoncée."],
    ...(next ? [[`Quand sort le prochain épisode de ${name} ?`, `L'épisode ${next.episode} sort le ${longDate(next.airingAt)} à ${hhmm(next.airingAt)}, heure de Paris.`]] : []),
    ...(m.episodes ? [[`Combien d'épisodes compte ${name} ?`, `${m.episodes} épisode${m.episodes > 1 ? "s" : ""}.`]] : []),
  ];

  const similar = data.media
    .filter((o) => o.id !== m.id && (o.genres || []).some((g) => (m.genres || []).includes(g)))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 6);

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
        ${alt.length ? `<p class="alt">${esc(alt.join(" · "))}</p>` : ""}
        <div class="facts">
          <span class="fact">${esc(FORMAT_FR[m.format] || m.format || "Animé")}</span>
          ${m.status ? `<span class="fact">${esc(STATUS_FR[m.status] || m.status)}</span>` : ""}
          ${m.episodes ? `<span class="fact">${m.episodes} épisode${m.episodes > 1 ? "s" : ""}</span>` : ""}
          ${m.averageScore ? `<span class="fact score">★ ${(m.averageScore / 10).toFixed(1).replace(".", ",")}/10</span>` : ""}
          ${studio ? `<span class="fact">${esc(studio)}</span>` : ""}
        </div>
        ${links.length ? `<div class="ctas">${links.map((l) => `<a class="cta p-${PCLASS[l.site]}" href="${esc(l.url)}" rel="noopener nofollow" target="_blank"><i></i>Regarder sur ${esc(l.site)}</a>`).join("")}</div>` : `<p class="nolink">Aucune plateforme légale annoncée en France et en Belgique pour l'instant.</p>`}
      </div>
    </div>
  </div>
  <div class="fbody">
    <div class="fmain">
      ${nextHtml}
      <section class="box"><h2>Plateformes légales</h2>${where}</section>
      ${adSlot()}
      <section class="box"><h2>À propos</h2><p>${intro}</p>${genres.length ? `<div class="tags">${genres.map((g) => `<span>${esc(g)}</span>`).join("")}</div>` : ""}</section>
      <section class="box"><h2>Questions fréquentes</h2><dl class="faq">${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("")}</dl></section>
    </div>
  </div>
  ${similar.length ? `<section><h2 class="sec">Dans le même genre</h2><div class="pgrid">${similar.map((o) => card(o, rel)).join("")}</div></section>` : ""}
</article>`;

  pages.push({
    path: `anime/${m.slug}.html`,
    html: page({
      path: `anime/${m.slug}.html`, rel,
      title: `Où regarder ${name} en streaming légal (VOSTFR, VF) ? Plateformes et prochain épisode`,
      desc: `${name} : sur quelles plateformes légales le regarder en France et en Belgique, date et heure du prochain épisode, nombre d'épisodes.`,
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
  return `<a class="ep" href="${rel}anime/${e.m.slug}.html"><time data-t="${e.airingAt}">${hhmm(e.airingAt)}</time>${poster(e.m, "medium")}<span class="ep-t"><b>${esc(nameOf(e.m))}</b><small>Épisode ${e.episode}${e.m.episodes ? ` sur ${e.m.episodes}` : ""}</small></span><span class="chips">${chips(e.m, 2)}</span></a>`;
}
{
  const rel = "";
  const body = `
<div class="phead"><p class="eyebrow">Calendrier</p><h1>Les sorties animés de la semaine</h1>
<p class="lead">Les nouveaux épisodes de la semaine à l'heure de Paris et Bruxelles, avec la plateforme légale pour les regarder. Mis à jour chaque jour.</p></div>
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
  const row = (m, rel) => `<a class="row" href="${rel}anime/${m.slug}.html">${poster(m, "medium")}<span class="row-t"><b>${esc(nameOf(m))}</b><small>${esc(FORMAT_FR[m.format] || m.format || "")}${m.seasonYear ? " · " + m.seasonYear : ""}${m.title.romaji && m.title.romaji !== nameOf(m) ? " · " + esc(m.title.romaji) : ""}</small></span><span class="chips">${chips(m, 3)}</span></a>`;
  for (const l of letters) {
    const rel = "../";
    const list = groups.get(l).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "fr"));
    const L = l.toUpperCase();
    const body = `
<div class="phead"><p class="eyebrow">Catalogue</p><h1>Animés commençant par ${L}</h1>
<p class="lead">${list.length} animés, avec les plateformes légales où les regarder en France et en Belgique.</p></div>
${letterNav(rel, l)}
<div class="rows">${list.map((m) => row(m, rel)).join("")}</div>
${adSlot()}`;
    pages.push({ path: `catalogue/${l}.html`, html: page({ path: `catalogue/${l}.html`, rel, title: `Animés de A à Z : lettre ${L} | où les regarder en France et en Belgique`, desc: `Liste des animés commençant par ${L} et les plateformes légales pour les regarder en France et en Belgique.`, body }) });
  }
  const rel = "";
  const top = [...data.media].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 100);
  const body = `
<div class="phead"><p class="eyebrow">Catalogue</p><h1>Tous les animés et où les regarder</h1>
<p class="lead">${data.media.length.toLocaleString("fr-BE")} animés, des grands classiques aux sorties de la saison, avec les plateformes légales disponibles en France et en Belgique.</p></div>
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
  </div>
</section>
${firstDay ? `<section><div class="sec-h"><h2 class="sec">Les sorties du jour</h2><a href="calendrier.html">Toute la semaine →</a></div><p class="sub">${esc(firstDay[1].label[0].toUpperCase() + firstDay[1].label.slice(1))}, à l'heure de Paris et Bruxelles.</p><div class="eps">${firstDay[1].items.slice(0, 8).map((e) => epRow(e, rel)).join("")}</div></section>` : ""}
${adSlot()}
<section><div class="sec-h"><h2 class="sec">Populaires en ce moment</h2><a href="catalogue.html">Tout le catalogue →</a></div><div class="pgrid">${popular.map((m) => card(m, rel)).join("")}</div></section>
<section class="tonight"><h2 class="sec">Qu'est-ce qu'on regarde ce soir&nbsp;?</h2><p class="sub">Choisis ton humeur, on te trouve un animé.</p>
<div class="moods" id="moods" role="group" aria-label="Humeur"></div><div class="pick" id="pick"></div>
<script type="application/json" id="pickdata">${JSON.stringify(pickData).replace(/</g, "\\u003c")}</script></section>`;
  pages.push({ path: "index.html", html: page({ path: "index.html", rel, title: `${cfg.siteName} : où regarder tes animés en streaming légal`, desc: "Trouve sur quelle plateforme légale regarder un animé en France et en Belgique, le calendrier des sorties à l'heure de Paris et Bruxelles et des idées pour ce soir.", body, jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, url: SITE + "/" } }) });
}

// ---------- À propos & 404 ----------
const prosePage = (path, title, desc, h1, html) => pages.push({ path, html: page({ path, rel: "", title, desc, body: `<div class="phead"><h1>${h1}</h1></div><div class="prose">${html}</div>` }) });
prosePage("mentions-legales.html", `Mentions légales | ${cfg.siteName}`, `Mentions légales du site ${cfg.siteName}.`, "Mentions légales", `
<h2>Éditeur</h2><p>${esc(cfg.siteName)} est un projet indépendant, sans lien avec les plateformes de streaming citées ni avec les ayants droit des œuvres présentées.</p>
<h2>Hébergement</h2><p>Le site est hébergé par GitHub Pages, un service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.</p>
<h2>Contenus</h2><p>${esc(cfg.siteName)} ne diffuse et n'héberge aucune vidéo. Les titres, informations et visuels (affiches, bannières) proviennent de la base de données AniList et restent la propriété de leurs ayants droit respectifs. Ils sont utilisés uniquement pour identifier les œuvres et orienter vers leur diffusion légale.</p>
<p>Si vous êtes ayant droit et souhaitez le retrait d'un visuel ou d'une information, signalez-le via la page GitHub du projet : la demande sera traitée rapidement.</p>
<h2>Liens affiliés</h2><p>Certains liens vers des plateformes peuvent être affiliés. Si vous vous abonnez via ces liens, le site peut percevoir une commission, sans aucun surcoût pour vous.</p>
<h2>Exactitude</h2><p>Les disponibilités et horaires sont mis à jour automatiquement chaque jour mais peuvent changer sans préavis. Vérifiez toujours sur la plateforme concernée.</p>`);
prosePage("confidentialite.html", `Politique de confidentialité | ${cfg.siteName}`, `Politique de confidentialité du site ${cfg.siteName}.`, "Politique de confidentialité", `
<p>${esc(cfg.siteName)} ne demande aucune inscription et ne collecte directement aucune donnée personnelle.</p>
<h2>Services tiers</h2><p>Pour afficher le site, votre navigateur contacte des services tiers : Google Fonts (polices d'écriture) et AniList (affiches des animés). Ces services peuvent recevoir votre adresse IP, comme pour toute visite d'un site web.</p>
${cfg.adsenseClient ? `<h2>Publicité</h2><p>Le site affiche des annonces Google AdSense. Google peut utiliser des cookies pour diffuser des annonces adaptées. Vous pouvez gérer vos préférences sur la page « Paramètres des annonces » de Google.</p>` : ""}
<h2>Vos droits</h2><p>Conformément au RGPD, vous pouvez exercer vos droits auprès des services tiers concernés. Pour toute question, utilisez la page GitHub du projet.</p>`);
pages.push({ path: "a-propos.html", html: page({ path: "a-propos.html", rel: "", title: `À propos de ${cfg.siteName}`, desc: `${cfg.siteName} aide à trouver où regarder légalement ses animés en France et en Belgique.`, body: `<div class="phead"><h1>À propos</h1></div><div class="prose"><p>${esc(cfg.siteName)} aide les fans d'animés francophones à trouver où regarder leurs séries légalement, et à savoir quand sortent les nouveaux épisodes.</p><p>Le site ne diffuse et n'héberge aucune vidéo. Il renvoie uniquement vers les plateformes officielles. Certains liens peuvent être affiliés : si vous vous abonnez via ces liens, le site peut toucher une commission, sans surcoût pour vous.</p><p>Les informations proviennent d'AniList et sont mises à jour automatiquement chaque jour. La disponibilité d'un titre peut varier selon le pays : vérifiez toujours sur la plateforme.</p></div>` }) });
pages.push({ path: "404.html", html: page({ path: "404.html", rel: BASE, title: "Page introuvable", desc: "Cette page n'existe pas.", body: `<div class="phead"><h1>Page introuvable</h1></div><p class="lead">Cette page n'existe pas ou plus. <a href="${BASE}index.html">Retour à l'accueil</a></p>` }) });

// ---------- Écriture ----------
await rm(OUT, { recursive: true, force: true });
await mkdir(new URL("anime/", OUT), { recursive: true });
await mkdir(new URL("saison/", OUT), { recursive: true });
await mkdir(new URL("catalogue/", OUT), { recursive: true });
for (const p of pages) await writeFile(new URL(p.path, OUT), p.html);
await cp(new URL("static/", root), OUT, { recursive: true });
const search = data.media.map((m) => ({ t: nameOf(m), a: [m.title.romaji, m.title.native].filter(Boolean).join(" "), u: `anime/${m.slug}.html`, i: m.coverImage?.medium || "", y: m.seasonYear || "", p: streaming(m).map((l) => l.site).slice(0, 3) }));
await writeFile(new URL("search.json", OUT), JSON.stringify(search));
const today = new Date().toISOString().slice(0, 10);
await writeFile(new URL("sitemap.xml", OUT), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.filter((p) => p.path !== "404.html").map((p) => `<url><loc>${esc(`${SITE}/${p.path}`.replace(/index\.html$/, ""))}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
await writeFile(new URL("robots.txt", OUT), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`Site généré : ${pages.length} pages dans dist/`);
