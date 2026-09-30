// English version of the site (dist/en/). Called at the end of build.mjs with the shared data and helpers.
import { writeFile, mkdir } from "node:fs/promises";

export async function buildEn(ctx) {
  const { wTag, data, cfg, SITE, BASE, OUT, esc, slugify, nameOf, cover, poster, streaming, others, family, worldLinks, SERVICES, REGIONS, PLATFORM_SLUG, WORLD_SLUG, GENRE_PAGES, genreSlug, POPULAR, byId, altTitles, trailerUrl, adSlot, adsHead, dayList, hreflangs, worldPages, platformPages, genrePages, TZ } = ctx;

  const { fillerPages, fillerHome } = await import("./fillers.mjs");
  const EN = new URL("en/", OUT);
  const R = BASE + "en/"; // absolute root of the English site
  const written = [];
  const write = async (path, html) => { await writeFile(new URL(path, EN), html); written.push("en/" + path); };
  for (const d of ["anime", "catalog", "platform", "genre", "season", "fillers"]) await mkdir(new URL(d + "/", EN), { recursive: true });

  const FORMAT = { TV: "TV series", TV_SHORT: "TV short", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "Web series (ONA)", MUSIC: "Music video" };
  const STATUS = { RELEASING: "Airing", NOT_YET_RELEASED: "Not yet aired", FINISHED: "Finished", HIATUS: "On hiatus", CANCELLED: "Cancelled" };
  const SEASON = { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" };
  const REG = { fr: ["France & French-speaking countries", "France"], us: ["United States & Canada", "USA / Canada"], uk: ["United Kingdom & Ireland", "UK / Ireland"], de: ["Germany, Austria, Switzerland", "Germany"], eu: ["Rest of Europe", "Europe"], latam: ["Latin America & Brazil", "Latin America"], jp: ["Japan", "Japan"], cn: ["China", "China"], asia: ["Asia & Oceania", "Asia / Oceania"] };
  const REGION_IDS = REGIONS.map(([r]) => r);
  const GENRE_EN = (g) => (g === "Mahou Shoujo" ? "Magical Girl" : g);
  const gSlugEn = (g) => slugify(g);
  const seasonPathEn = (s) => `season/${SEASON[s.season].toLowerCase()}-${s.year}.html`;
  const seasonLabel = (s) => `${SEASON[s.season]} ${s.year}`;
  const hhmm = (t) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(t * 1000));
  const longDate = (t) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(new Date(t * 1000));
  const num = (n) => n.toLocaleString("en-US");
  const frPathOf = (enPath) => {
    const fixed = { "index.html": "index.html", "calendar.html": "calendrier.html", "catalog.html": "catalogue.html", "platforms.html": "plateformes.html", "genres.html": "genres.html", "about.html": "a-propos.html", "privacy.html": "confidentialite.html", "legal.html": "mentions-legales.html" };
    if (fixed[enPath]) return fixed[enPath];
    let m;
    if (enPath === "fillers.html") return "fillers.html";
    if ((m = enPath.match(/^fillers\/(.+)$/))) return "fillers/" + m[1];
    if ((m = enPath.match(/^anime\/(.+)$/))) return "anime/" + m[1];
    if ((m = enPath.match(/^catalog\/(.+)$/))) return "catalogue/" + m[1];
    if ((m = enPath.match(/^platform\/(.+)$/))) return "plateforme/" + m[1];
    if ((m = enPath.match(/^season\/([a-z]+)-(\d+)\.html$/))) return `saison/${{ winter: "hiver", spring: "printemps", summer: "ete", fall: "automne" }[m[1]]}-${m[2]}.html`;
    if ((m = enPath.match(/^genre\/(.+)\.html$/))) { const gp = GENRE_PAGES.find((x) => gSlugEn(x.g) === m[1]); return gp ? `genre/${gp.slug}.html` : null; }
    return null;
  };

  // Platforms present in a region; server default region for the English site is the US
  const regional = (m, r = "us") => worldLinks(m).filter((l) => l.regions.includes(r));
  function chips(m, max = 3) {
    const w = worldLinks(m).map(wTag);
    const us = regional(m).slice(0, max);
    const inner = us.length ? us.map((l) => `<span class="chip p-${l.cls}"><i></i>${esc(l.site)}</span>`).join("") : `<span class="chip muted">Not found yet</span>`;
    return `<span class="chipset" data-w="${esc(w.join("|"))}" data-max="${max}">${inner}</span>`;
  }
  const metaLine = (m) => [FORMAT[m.format] || m.format, m.seasonYear || m.startDate?.year].filter(Boolean).join(" · ");
  const card = (m, rel) => `<a class="pcard" href="${rel}anime/${m.slug}.html">
  ${poster(m)}
  <span class="pc-b"><b>${esc(nameOf(m))}</b><small>${esc(metaLine(m))}</small><span class="chips">${chips(m, 2)}</span></span>
</a>`;
  const searchLinks = (m) => {
    const q = encodeURIComponent(m.title.english || m.title.romaji || nameOf(m));
    return [["JustWatch", `https://www.justwatch.com/us/search?q=${q}`], ["Crunchyroll", `https://www.crunchyroll.com/search?q=${q}`], ["Netflix", `https://www.netflix.com/search?q=${q}`], ["Hulu", `https://www.hulu.com/search?q=${q}`], ["Prime Video", `https://www.primevideo.com/search?phrase=${q}`]];
  };

  function page({ path, title, desc, body, rel, jsonld, image }) {
    const canonical = `${SITE}/en/${path}`.replace(/index\.html$/, "");
    const fr = frPathOf(path);
    return `<!doctype html>
<html lang="en" data-idx="${BASE}search.json">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
${fr ? hreflangs(fr, "en/" + path) : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${esc(image)}">` : `<meta name="twitter:card" content="summary">`}
<meta name="theme-color" content="#0B0C16">
<link rel="manifest" href="${BASE}manifest.webmanifest">
<link rel="apple-touch-icon" href="${BASE}icon-192.png">
<link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;700&display=swap">
<link rel="stylesheet" href="${BASE}style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
${adsHead}
</head>
<body>
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="${R}" aria-label="${esc(cfg.siteName)}, home"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#FFC857"/><path d="M12 9.5v13l10.5-6.5z" fill="#101223"/></svg><span>${esc(cfg.siteName)}</span></a>
    <nav aria-label="Main menu">
      <a href="${R}calendar.html">Schedule</a>
      <a href="${R}catalog.html">Catalog</a>
      <a href="${R}platforms.html">Platforms</a>
      <a href="${R}fillers.html">Fillers</a>
      <label class="hreg" title="Your region: platforms shown adapt to it"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/></svg><select data-region aria-label="Your region">${REGION_IDS.map((r) => `<option value="${r}">${esc(REG[r][1])}</option>`).join("")}</select></label>
      <div class="hsearch" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" data-search data-rel="${rel}" placeholder="Search an anime…" aria-label="Search an anime" autocomplete="off"><div class="hres results" hidden></div></div>
      <a class="lang" href="${BASE}${(fr || "index.html").replace(/index\.html$/, "")}" hreflang="fr" lang="fr" title="Version française">FR</a>
    </nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div class="foot-brand">
      <a class="logo" href="${R}"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#FFC857"/><path d="M12 9.5v13l10.5-6.5z" fill="#101223"/></svg><span>${esc(cfg.siteName)}</span></a>
      <p>The free guide to find where to legally stream any anime, anywhere in the world: USA, Canada, UK, Europe, Latin America, Asia… We don't host any video: we only link to official platforms.</p>
    </div>
    <div><h3>Explore</h3><a href="${R}calendar.html">Release schedule</a><a href="${R}catalog.html">All anime</a><a href="${R}platforms.html">By platform</a><a href="${R}genres.html">By genre</a><a href="${R}fillers.html">Filler lists</a><a href="${R}${seasonPathEn(data.current)}">${esc(seasonLabel(data.current))} season</a><a href="${R}${seasonPathEn(data.next)}">${esc(seasonLabel(data.next))} season</a></div>
    <div><h3>Information</h3><a href="${R}about.html">About</a><a href="${R}legal.html">Legal notice</a><a href="${R}privacy.html">Privacy</a><a href="${BASE}">Version française</a></div>
  </div>
  <div class="wrap foot-legal">© ${new Date().getFullYear()} ${esc(cfg.siteName)} · Data and artwork: <a href="https://anilist.co" rel="noopener">AniList</a> (not affiliated) · Times are converted to your time zone automatically · Updated daily · Some links may be affiliate links.</div>
</footer>
<script data-goatcounter="https://tsuzuki.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
<script src="${BASE}world.js" defer></script>
<script src="${BASE}app.js" defer></script>
</body>
</html>`;
  }

  // ---------- Anime pages ----------
  for (const m of data.media) {
    const rel = "../";
    const name = nameOf(m);
    const wl = worldLinks(m);
    const us = regional(m);
    const fam = family(m);
    const studio = m.studios?.nodes?.[0]?.name;
    const next = m.nextAiringEpisode;
    const alts = altTitles(m);
    const trailer = trailerUrl(m);
    const genres = m.genres || [];
    const seasonTxt = m.season && m.seasonYear ? `${SEASON[m.season]} ${m.seasonYear}` : null;
    const eps = m.episodes ? `${m.episodes} episode${m.episodes > 1 ? "s" : ""}` : "";

    const ctas = wl.map((l) => `<a class="cta p-${l.cls}" data-r="${l.regions.join(" ")}"${l.regions.includes("us") ? "" : " hidden"} href="${esc(l.url)}" rel="noopener nofollow" target="_blank"><i></i>Watch on ${esc(l.site)}</a>`).join("");
    const trailerBtn = trailer ? `<a class="cta ghost" href="${esc(trailer)}" rel="noopener nofollow" target="_blank"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Trailer</a>` : "";
    const heroCtas = `<div data-rbox><div class="ctas">${ctas}${trailerBtn}</div><p class="nolink" data-rnone${us.length ? " hidden" : ""}>No legal platform known in your region yet. See the other regions below.</p></div>`;

    const worldHtml = `<section class="box world" id="world"><h2>Where to watch ${esc(name)} around the world</h2><p class="small">Platforms that carry ${esc(name)} and operate in each region. The exact catalog can vary by country: check on the platform from your country.</p><div class="wtable">${REGION_IDS.map((r) => {
      const ls = wl.filter((l) => l.regions.includes(r));
      return `<div class="wrow" data-region="${r}"><span class="wr">${esc(REG[r][0])}</span><span class="wl">${ls.length ? ls.map((l) => `<a class="chip p-${l.cls}" href="${esc(l.url)}" rel="noopener nofollow" target="_blank"><i></i>${esc(l.site)}</a>`).join("") : `<span class="chip muted">No platform known</span>`}</span></div>`;
    }).join("")}</div>
${!wl.length && fam ? `<p>No streaming link is known for ${esc(name)} yet, but <a href="${esc(fam.slug)}.html">${esc(nameOf(fam))}</a>, from the same franchise, is available on ${worldLinks(fam).map((l) => `<strong>${esc(l.site)}</strong>`).join(", ")}. This ${m.format === "MOVIE" ? "movie" : "entry"} is sometimes offered there too: check on the platform.</p>` : ""}
<h3 class="h3">${wl.length ? "Check elsewhere" : "Search where to watch it"}</h3><div class="findl">${searchLinks(m).map(([n, u]) => `<a class="btn ghost" href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(n)}</a>`).join("")}</div></section>`;

    const nextHtml = next
      ? `<div class="next"><span class="k">Next episode</span><span class="t">Episode ${next.episode}</span><span>${esc(longDate(next.airingAt))} at <time data-t="${next.airingAt}">${hhmm(next.airingAt)}</time> (Paris time)</span><span class="countdown" data-at="${next.airingAt}"></span></div>`
      : "";
    const intro = [
      `<strong>${esc(name)}</strong> is ${m.format === "MOVIE" ? "an anime movie" : "an anime"}${studio ? ` produced by studio ${esc(studio)}` : ""}${seasonTxt ? `, from the ${esc(seasonTxt)} season` : ""}.`,
      genres.length ? ` Genres: ${esc(genres.map(GENRE_EN).join(", ").toLowerCase())}.` : "",
      m.episodes ? ` It has ${eps}.` : "",
    ].join("");
    const usNames = us.map((l) => l.site);
    const faq = [
      [`Where can I watch ${name} legally?`, wl.length ? `${name} is available on ${wl.map((l) => l.site).join(", ")}. In the United States and Canada: ${usNames.length ? usNames.join(", ") : "no platform known yet"}. Availability varies by country.` : "No legal streaming platform is known yet. You can check JustWatch, which lists legal offers by country."],
      ...(next ? [[`When does the next episode of ${name} come out?`, `Episode ${next.episode} airs on ${longDate(next.airingAt)} at ${hhmm(next.airingAt)} Paris time.`]] : []),
      ...(m.episodes ? [[`How many episodes does ${name} have?`, `${eps}.`]] : []),
    ];
    const similar = [];
    for (const o of POPULAR) {
      if (o.id !== m.id && (o.genres || []).some((g) => genres.includes(g))) similar.push(o);
      if (similar.length >= 6) break;
    }
    const banner = m.bannerImage || cover(m);
    const body = `
<article class="fiche">
  <div class="fhero" style="--c:${esc(m.coverImage?.color || "#2A2D4A")}">
    ${banner ? `<div class="fhero-bg" style="background-image:url('${esc(banner)}')" aria-hidden="true"></div>` : ""}
    <div class="fhero-in">
      ${poster(m, "large", true)}
      <div class="fhero-txt">
        <p class="crumb"><a href="${R}">Home</a> <span>›</span> <a href="${R}catalog.html">Anime</a> <span>›</span> ${esc(name)}</p>
        <h1>Where to watch ${esc(name)}?</h1>
        ${alts.length ? `<p class="alt">Also known as: ${esc(alts.join(" · "))}</p>` : ""}
        <div class="facts">
          <span class="fact">${esc(FORMAT[m.format] || m.format || "Anime")}</span>
          ${m.status ? `<span class="fact">${esc(STATUS[m.status] || m.status)}</span>` : ""}
          ${eps ? `<span class="fact">${eps}</span>` : ""}
          ${m.averageScore ? `<span class="fact score">★ ${(m.averageScore / 10).toFixed(1)}/10</span>` : ""}
          ${studio ? `<span class="fact">${esc(studio)}</span>` : ""}
        </div>
        ${heroCtas}
      </div>
    </div>
  </div>
  <div class="fbody">
    <div class="fmain">
      ${nextHtml}
      ${worldHtml}
      ${adSlot()}
      <section class="box"><h2>About</h2><p>${intro}</p>${genres.length ? `<div class="tags">${genres.map((g) => genreSlug[g] ? `<a href="${rel}genre/${gSlugEn(g)}.html">${esc(GENRE_EN(g))}</a>` : `<span>${esc(GENRE_EN(g))}</span>`).join("")}</div>` : ""}${alts.length ? `<p class="small">Other titles: ${esc(alts.join(", "))}.</p>` : ""}</section>
      <section class="box"><h2>FAQ</h2><dl class="faq">${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("")}</dl></section>
    </div>
  </div>
  ${similar.length ? `<section><h2 class="sec">More like this</h2><div class="pgrid">${similar.map((o) => card(o, rel)).join("")}</div></section>` : ""}
</article>`;
    await write(`anime/${m.slug}.html`, page({
      path: `anime/${m.slug}.html`, rel, body, image: cover(m),
      title: `Where to watch ${name}: streaming platforms (sub & dub) and next episode`,
      desc: `Where to stream ${name} legally in the US, Canada, UK, Europe, Latin America and Asia: platforms by country, next episode date and episode count.`,
      jsonld: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    }));
  }

  // ---------- Schedule ----------
  const epRow = (e, rel) => `<a class="ep" href="${rel}anime/${e.m.slug}.html"><time data-t="${e.airingAt}">${hhmm(e.airingAt)}</time>${poster(e.m, "medium")}<span class="ep-t"><b>${esc(nameOf(e.m))}</b><small>Episode ${e.episode}${e.m.episodes ? ` of ${e.m.episodes}` : ""}</small></span><span class="chips">${chips(e.m, 2)}</span></a>`;
  const days = dayList.map(([k, d]) => [k, { label: longDate(d.items[0].airingAt), items: d.items }]);
  await write("calendar.html", page({
    path: "calendar.html", rel: "", title: "Anime release schedule this week (simulcasts)", desc: "Every new anime episode this week, day by day, converted to your time zone, with the legal platform to watch it.",
    body: `
<div class="phead"><p class="eyebrow">Schedule</p><h1>This week's anime releases</h1>
<p class="lead">New episodes of the week, with the platform to watch them legally. Times are converted to your time zone automatically. Updated daily.</p></div>
<div class="days" role="tablist" aria-label="Day">${days.map(([k, d], i) => `<button class="day" type="button" role="tab" data-day="${k}" aria-selected="${i === 0}">${esc(d.label)}</button>`).join("")}</div>
${days.map(([k, d], i) => `<section class="dayp" data-day="${k}" ${i === 0 ? "" : "hidden"}><h2 class="sec">${esc(d.label)}</h2><div class="eps">${d.items.map((e) => epRow(e, "")).join("")}</div></section>`).join("")}
${adSlot()}`,
  }));

  // ---------- Seasons ----------
  for (const s of [data.current, data.next]) {
    const list = data.media.filter((m) => m.tags?.includes(`${s.season}-${s.year}`)).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    const lab = seasonLabel(s);
    await write(seasonPathEn(s), page({
      path: seasonPathEn(s), rel: "../", title: `${lab} anime season: full list and where to watch`, desc: `Every anime of the ${lab} season, ranked by popularity, with the legal streaming platforms to watch them.`,
      body: `
<div class="phead"><p class="eyebrow">${esc(lab)} season</p><h1>${esc(lab)} anime</h1>
<p class="lead">${num(list.length)} anime this season, ranked by popularity, with where to stream them legally.</p></div>
<div class="pgrid">${list.map((m) => card(m, "../")).join("")}</div>
${adSlot()}`,
    }));
  }

  // ---------- Platforms ----------
  const INFO = {
    "Crunchyroll": "The world's largest anime platform: Japanese simulcasts just hours after Japan, plus many dubs.",
    "Netflix": "A large anime selection, including many exclusives and dubbed series.",
    "ADN": "Animation Digital Network, the French anime platform, available in France, Belgium, Switzerland and Luxembourg.",
    "Prime Video": "Amazon's streaming service, with a growing anime selection included in Prime.",
    "Disney+": "Disney+ streams a few Japanese anime exclusives on top of its animation catalog.",
  };
  const allPlat = [
    ...platformPages.map((p) => ({ name: p.site, slug: p.slug, cls: { "Crunchyroll": "cr", "Netflix": "nf", "ADN": "adn", "Prime Video": "pv", "Disney+": "dp" }[p.site], regions: Object.values(SERVICES).find(([n]) => n === p.site)?.[2] || [], list: p.list })),
    ...worldPages,
  ];
  for (const pl of allPlat) {
    const where = pl.regions.length >= 7 ? "in most countries" : pl.regions.map((r) => REG[r][0]).join(", ");
    await write(`platform/${pl.slug}.html`, page({
      path: `platform/${pl.slug}.html`, rel: "../", image: cover(pl.list[0]),
      title: `Anime on ${pl.name}: the full list (${num(pl.list.length)} titles)`, desc: `Anime available on ${pl.name} (${where}), ranked by popularity: ${pl.list.slice(0, 5).map(nameOf).join(", ")}…`,
      body: `
<div class="phead"><p class="eyebrow">Platform</p><h1>Anime available on ${esc(pl.name)}</h1>
<p class="lead">${num(pl.list.length)} anime on ${esc(pl.name)}, ranked by popularity. Available: ${esc(where)}. The exact catalog varies by country. ${esc(INFO[pl.name] || "")}</p></div>
<div class="pgrid">${pl.list.slice(0, 400).map((m) => card(m, "../")).join("")}</div>
${adSlot()}`,
    }));
  }
  const bigFirst = [...allPlat].sort((a, b) => b.list.length - a.list.length);
  await write("platforms.html", page({
    path: "platforms.html", rel: "", title: "Legal anime streaming platforms around the world: Crunchyroll, Netflix, Hulu…", desc: "Compare legal anime streaming platforms by country: Crunchyroll, Netflix, Hulu, HIDIVE, Prime Video, Disney+, Bilibili, iQIYI and more.",
    body: `
<div class="phead"><p class="eyebrow">Platforms</p><h1>Where to watch anime legally?</h1>
<p class="lead">${num(allPlat.length)} legal anime streaming platforms around the world, with their catalog. Pick your region at the top of the page to adapt what you see.</p></div>
<div class="pchips">${bigFirst.map((pl) => `<a class="pchip p-${pl.cls}" href="platform/${pl.slug}.html"><i></i>${esc(pl.name)}<small>${num(pl.list.length)}</small></a>`).join("")}</div>
${adSlot()}`,
  }));

  // ---------- Genres ----------
  for (const gp of genrePages) {
    const gn = GENRE_EN(gp.g), sl = gSlugEn(gp.g);
    await write(`genre/${sl}.html`, page({
      path: `genre/${sl}.html`, rel: "../", image: cover(gp.list[0]),
      title: `Best ${gn.toLowerCase()} anime: the list and where to watch`, desc: `The most popular ${gn.toLowerCase()} anime (${gp.list.slice(0, 4).map(nameOf).join(", ")}…) and the legal platforms to stream them.`,
      body: `
<div class="phead"><p class="eyebrow">Genre</p><h1>The best ${esc(gn.toLowerCase())} anime</h1>
<p class="lead">${num(gp.list.length)} ${esc(gn.toLowerCase())} anime, ranked by popularity, with where to watch them legally.</p></div>
<nav class="genres">${genrePages.map((o) => `<a href="${gSlugEn(o.g)}.html"${o.g === gp.g ? ' aria-current="page"' : ""}>${esc(GENRE_EN(o.g))}</a>`).join("")}</nav>
<div class="pgrid">${gp.list.slice(0, 300).map((m) => card(m, "../")).join("")}</div>
${adSlot()}`,
    }));
  }
  await write("genres.html", page({
    path: "genres.html", rel: "", title: "Anime by genre: action, romance, horror, sports…", desc: "Every anime genre with the most popular titles and where to stream them legally.",
    body: `
<div class="phead"><p class="eyebrow">Genres</p><h1>Anime by genre</h1><p class="lead">Action, romance, horror, sports… Find your next anime by what you love.</p></div>
<div class="gtiles">${genrePages.map((gp) => `<a class="gtile" href="genre/${gSlugEn(gp.g)}.html">${poster(gp.list[0], "large")}<span><b>${esc(GENRE_EN(gp.g))}</b><small>${num(gp.list.length)} anime</small></span></a>`).join("")}</div>`,
  }));

  // ---------- Catalog A-Z ----------
  {
    const letterOf = (m) => { const c = nameOf(m).normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toLowerCase(); return /[a-z]/.test(c) ? c : "0-9"; };
    const groups = new Map();
    for (const m of data.media) { const l = letterOf(m); if (!groups.has(l)) groups.set(l, []); groups.get(l).push(m); }
    const letters = [...groups.keys()].sort((a, b) => (a === "0-9" ? -1 : b === "0-9" ? 1 : a.localeCompare(b)));
    const letterNav = (rel, current) => `<nav class="letters" aria-label="Letters">${letters.map((l) => `<a href="${rel}catalog/${l}.html"${l === current ? ' aria-current="page"' : ""}>${l.toUpperCase()}</a>`).join("")}</nav>`;
    const row = (m, rel) => `<a class="row" href="${rel}anime/${m.slug}.html">${poster(m, "medium")}<span class="row-t"><b>${esc(nameOf(m))}</b><small>${esc(metaLine(m))}${m.title.romaji && m.title.romaji !== nameOf(m) ? " · " + esc(m.title.romaji) : ""}</small></span><span class="chips">${chips(m, 3)}</span></a>`;
    const PER = 250;
    for (const l of letters) {
      // same order as the French pages so page numbers match
      const all = groups.get(l).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "fr"));
      const L = l.toUpperCase();
      const nPages = Math.ceil(all.length / PER);
      const pathOf = (n) => `catalog/${l}${n > 1 ? "-" + n : ""}.html`;
      for (let n = 1; n <= nPages; n++) {
        const list = all.slice((n - 1) * PER, n * PER);
        const pager = nPages > 1 ? `<nav class="pager" aria-label="Pages">${n > 1 ? `<a href="../${pathOf(n - 1)}">← Previous</a>` : ""}${Array.from({ length: nPages }, (_, i) => i + 1).map((k) => k === n ? `<span aria-current="page">${k}</span>` : `<a href="../${pathOf(k)}">${k}</a>`).join("")}${n < nPages ? `<a href="../${pathOf(n + 1)}">Next →</a>` : ""}</nav>` : "";
        const suffix = nPages > 1 ? ` (page ${n} of ${nPages})` : "";
        await write(pathOf(n), page({
          path: pathOf(n), rel: "../", title: `Anime A to Z: letter ${L}${suffix} | where to watch`, desc: `Anime starting with ${L}${suffix} and the legal platforms to stream them.`,
          body: `
<div class="phead"><p class="eyebrow">Catalog</p><h1>Anime starting with ${L}${suffix}</h1>
<p class="lead">${num(all.length)} anime, with where to stream them legally.</p></div>
${letterNav("../", l)}
${pager}
<div class="rows">${list.map((m) => row(m, "../")).join("")}</div>
${pager}
${adSlot()}`,
        }));
      }
    }
    const top = POPULAR.slice(0, 100);
    await write("catalog.html", page({
      path: "catalog.html", rel: "", title: "Every anime from A to Z and where to watch it legally", desc: "The complete anime catalog, from classics to new releases, with the legal streaming platforms in every region.",
      body: `
<div class="phead"><p class="eyebrow">Catalog</p><h1>Every anime and where to watch it</h1>
<p class="lead">${num(data.media.length)} anime, from the great classics to this season's releases, with legal streaming platforms around the world.</p></div>
<section class="filters" id="filters" aria-label="Filters">
  <label>Platform<select id="f-p"><option value="">All</option>${[...new Set(Object.values(SERVICES).map(([n]) => n))].map((p) => `<option>${esc(p)}</option>`).join("")}</select></label>
  <label>Genre<select id="f-g"><option value="">All</option>${genrePages.map((g) => `<option value="${g.slug}">${esc(GENRE_EN(g.g))}</option>`).join("")}</select></label>
  <label>Period<select id="f-y"><option value="">All</option><option value="2020">2020 and later</option><option value="2010">2010 – 2019</option><option value="2000">2000 – 2009</option><option value="1990">1990 – 1999</option><option value="1980">Before 1990</option></select></label>
  <label>Status<select id="f-s"><option value="">All</option><option value="R">Airing</option><option value="F">Finished</option><option value="N">Upcoming</option></select></label>
  <label class="chk"><input type="checkbox" id="f-a"> Available in my region only</label>
</section>
<div id="f-out" hidden><p class="sub" id="f-count"></p><div class="pgrid" id="f-grid"></div><button class="btn more" id="f-more" type="button" hidden>Show more</button></div>
${letterNav("", null)}
<h2 class="sec">The 100 most popular anime</h2>
<div class="pgrid">${top.map((m) => card(m, "")).join("")}</div>
${adSlot()}`,
    }));
  }

  // ---------- Home ----------
  {
    const popular = data.media.filter((m) => m.tags?.includes(`${data.current.season}-${data.current.year}`) || m.status === "RELEASING").sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 12);
    const firstDay = days[0];
    const moods = [["Action", "action"], ["Comedy", "laughs"], ["Romance", "romance"], ["Drama", "feels"], ["Horror", "chills"], ["Fantasy", "escape"]];
    const pickData = moods.map(([g, label]) => ({ label, items: POPULAR.filter((m) => (m.genres || []).includes(g) && regional(m).length).slice(0, 12).map((m) => ({ t: nameOf(m), u: `anime/${m.slug}.html`, i: cover(m), p: regional(m).map((l) => l.site).slice(0, 3).join(", ") })) })).filter((x) => x.items.length);
    const heroBg = popular.slice(0, 6).map((m) => cover(m)).filter(Boolean);
    const nPlat = data.media.filter((m) => worldLinks(m).length).length;
    await write("index.html", page({
      path: "index.html", rel: "", image: heroBg[0], title: `${cfg.siteName}: where to watch anime legally, anywhere in the world`,
      desc: "Find which legal platform streams any anime in your country (US, Canada, UK, Europe, Latin America, Asia), the weekly release schedule in your time zone, and ideas for tonight.",
      jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: cfg.siteName, url: SITE + "/en/", inLanguage: "en" },
      body: `
<section class="hero">
  <div class="hero-bg" aria-hidden="true">${heroBg.map((u) => `<img src="${esc(u)}" alt="">`).join("")}</div>
  <div class="hero-in">
    <p class="eyebrow">The legal anime streaming guide</p>
    <h1>Want to watch it? We'll tell you <em>where</em>.</h1>
    <p class="lead">Find in a second which legal platform streams an anime in your country, and when the next episode drops.</p>
    <div class="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="q" type="search" placeholder="Search an anime: One Piece, Frieren, Naruto…" autocomplete="off" aria-label="Search an anime">
    </div>
    <div class="results" id="results" aria-live="polite"></div>
    <ul class="stats"><li><b>${num(data.media.length)}</b> anime</li><li><b>${num(nPlat)}</b> with a legal platform</li><li><b>${num(allPlat.length)}</b> platforms worldwide</li></ul>
  </div>
</section>
${firstDay ? `<section><div class="sec-h"><h2 class="sec">Today's releases</h2><a href="calendar.html">Full week →</a></div><p class="sub">${esc(firstDay[1].label)}, in your time zone.</p><div class="eps">${firstDay[1].items.slice(0, 8).map((e) => epRow(e, "")).join("")}</div></section>` : ""}
${adSlot()}
<section><div class="sec-h"><h2 class="sec">Popular right now</h2><a href="catalog.html">Full catalog →</a></div><div class="pgrid">${popular.map((m) => card(m, "")).join("")}</div></section>
<section><div class="sec-h"><h2 class="sec">By platform</h2><a href="platforms.html">All platforms →</a></div><div class="pchips">${bigFirst.slice(0, 12).map((pl) => `<a class="pchip p-${pl.cls}" href="platform/${pl.slug}.html"><i></i>${esc(pl.name)}<small>${num(pl.list.length)}</small></a>`).join("")}</div></section>
<section><div class="sec-h"><h2 class="sec">By genre</h2><a href="genres.html">All genres →</a></div><nav class="genres">${genrePages.map((g) => `<a href="genre/${gSlugEn(g.g)}.html">${esc(GENRE_EN(g.g))}</a>`).join("")}</nav></section>
${fillerHome({ lang: "en", esc })}
<section class="tonight"><h2 class="sec">What should I watch tonight?</h2><p class="sub">Pick your mood, we'll find you an anime.</p>
<div class="moods" id="moods" role="group" aria-label="Mood"></div><div class="pick" id="pick"></div>
<script type="application/json" id="pickdata">${JSON.stringify(pickData).replace(/</g, "\\u003c")}</script></section>`,
    }));
  }

  // ---------- About, legal, privacy ----------
  const prose = (path, title, h1, html) => write(path, page({ path, rel: "", title, desc: `${title}.`, body: `<div class="phead"><h1>${h1}</h1></div><div class="prose">${html}</div>` }));
  await prose("about.html", `About ${cfg.siteName}`, "About", `<p>${esc(cfg.siteName)} helps anime fans everywhere find where to stream their shows legally, and when new episodes come out.</p><p>The site doesn't host or stream any video. It only links to official platforms. Some links may be affiliate links: if you subscribe through them, the site may earn a commission at no extra cost to you.</p><p>Data comes from AniList and is updated automatically every day. Availability varies by country: always check on the platform.</p>`);
  await prose("legal.html", `Legal notice | ${cfg.siteName}`, "Legal notice", `<p>${esc(cfg.siteName)} is an independent project, not affiliated with the streaming platforms mentioned or with the rights holders of the works shown.</p><p>The site is hosted by GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA).</p><p>Titles, information and artwork come from the AniList database and remain the property of their respective owners. They are used only to identify the works and point to their legal distribution. Rights holders can request removal through the project's GitHub page.</p>`);
  await prose("privacy.html", `Privacy policy | ${cfg.siteName}`, "Privacy policy", `<p>${esc(cfg.siteName)} requires no sign-up and does not directly collect any personal data. Your region choice is stored only in your own browser.</p><p>We use GoatCounter, a cookie-free analytics tool that counts visits anonymously (page views, country, device type) without tracking individuals.</p><p>To display the site, your browser contacts third-party services: Google Fonts (fonts) and AniList (anime artwork). They may receive your IP address, as with any website visit.</p>${cfg.adsenseClient ? `<p>The site shows Google AdSense ads. Google may use cookies to serve relevant ads; you can manage this in Google's Ad Settings.</p>` : ""}`);

  // ---------- Filler lists ----------
  for (const p of fillerPages({ lang: "en", page, esc, byId, cover })) await write(p.path, p.html);

  return written;
}
