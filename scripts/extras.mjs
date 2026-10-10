// Pages en plus : studios, ordres de visionnage des franchises, nouveautés sur les plateformes, tendances.
// Utilisé par build.mjs (français) et build-en.mjs (anglais).
import { readFile } from "node:fs/promises";

const T = {
  fr: {
    loc: "fr-BE",
    studiosPath: "studios.html", studioDir: "studio/", orderPath: "ordre-de-visionnage.html", orderDir: "ordre/", newPath: "nouveautes.html",
    fmt: { TV: "Série TV", TV_SHORT: "Série courte", MOVIE: "Film", SPECIAL: "Spécial", OVA: "OVA", ONA: "Série web" },
    kinds: { ess: "Indispensable", opt: "Bonus, optionnel", rec: "Récap, tu peux sauter", up: "À venir" },
    ep: (n) => `${n} épisode${n > 1 ? "s" : ""}`,
    trendH: "Tendances de la semaine", trendMore: "Nouveautés sur les plateformes →",
    // Studios
    studioEyebrow: "Studio d'animation",
    studioH1: (s) => `Les animés du studio ${s}`,
    studioLead: (s, n, y1, y2, top) => `${n} animés produits par ${s}${y1 ? (y1 === y2 ? ` en ${y1}` : `, de ${y1} à ${y2}`) : ""}, classés par popularité, avec les plateformes légales où les regarder. Ses plus connus : ${top}.`,
    studioNow: "En cours et à venir", studioAll: "Tous ses animés",
    studioTitle: (s, n) => `Animés du studio ${s} : la liste complète (${n} titres) et où les regarder`,
    studioDesc: (s, top) => `Tous les animés du studio ${s} (${top}…), classés par popularité, et les plateformes légales pour les regarder.`,
    studiosH1: "Les studios d'animation", studiosLead: (n) => `${n} studios japonais et du monde entier, avec tous leurs animés et où les regarder légalement.`,
    studiosTitle: "Studios d'animation : MAPPA, Ufotable, Kyoto Animation… et leurs animés", studiosDesc: "Les studios d'animation et tous leurs animés : MAPPA, Ufotable, Wit Studio, Kyoto Animation, Bones, Madhouse… et où les regarder légalement.",
    studiosMore: "Tous les autres studios", animes: (n) => `${n} animés`,
    // Ordres de visionnage
    orderEyebrow: "Ordre de visionnage",
    orderH1: (f) => `Dans quel ordre regarder ${f} ?`,
    orderLead: (f, n, h) => `Les ${n} œuvres de la franchise ${f} dans l'ordre de sortie, l'ordre conseillé pour une première fois. Les étapes « indispensables » forment l'histoire principale${h ? ` (environ ${h} h)` : ""}, les bonus (films, OVA, spéciaux) peuvent se voir à côté.`,
    orderTitle: (f) => `${f} : dans quel ordre regarder la franchise ? (saisons, films, OVA)`,
    orderDesc: (f, n) => `L'ordre de visionnage de ${f} : les ${n} saisons, films et OVA dans l'ordre, ce qui est indispensable ou optionnel, et où les regarder légalement.`,
    orderNote: "Ordre basé sur les dates de sortie et les liens suite / préquelle entre les œuvres. Mis à jour automatiquement chaque jour.",
    ordersH1: "Ordres de visionnage", ordersLead: (n) => `${n} franchises expliquées : dans quel ordre regarder les saisons, films et OVA, et ce que tu peux sauter.`,
    ordersTitle: "Ordre de visionnage des animés : saisons, films et OVA dans le bon ordre", ordersDesc: "Dans quel ordre regarder les grandes franchises d'animés : saisons, films, OVA, ce qui est indispensable et ce qui est optionnel.",
    works: (n) => `${n} œuvres`,
    guideLine: (f, n) => `📺 <a href="{href}">Dans quel ordre regarder ${f} ?</a> (${n} œuvres)`,
    // Nouveautés
    newEyebrow: "Nouveautés", newH1: "Les nouveautés sur les plateformes",
    newLead: "Les animés qui viennent d'arriver sur Crunchyroll, Netflix, ADN, Prime Video, Disney+ et les autres plateformes légales, jour après jour. La disponibilité peut varier selon le pays.",
    newTitle: "Nouveautés animés sur Crunchyroll, Netflix, ADN… : les dernières arrivées", newDesc: "Les animés arrivés ces derniers jours sur les plateformes légales : Crunchyroll, Netflix, ADN, Prime Video, Disney+…",
    newNone: "On suit les arrivées sur les plateformes à partir de maintenant : la liste se remplit jour après jour, reviens dans quelques jours.",
    newArrived: "Arrivé sur", newSeason: (s) => `Les simulcasts de la saison ${s}`,
    newSeasonSub: "Les animés de la saison en cours déjà disponibles sur une plateforme légale.",
    season: { WINTER: "hiver", SPRING: "printemps", SUMMER: "été", FALL: "automne" },
  },
  en: {
    loc: "en-US",
    studiosPath: "studios.html", studioDir: "studio/", orderPath: "watch-order.html", orderDir: "watch-order/", newPath: "new-on-streaming.html",
    fmt: { TV: "TV series", TV_SHORT: "TV short", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "Web series" },
    kinds: { ess: "Essential", opt: "Optional extra", rec: "Recap, skippable", up: "Upcoming" },
    ep: (n) => `${n} episode${n > 1 ? "s" : ""}`,
    trendH: "Trending this week", trendMore: "New on streaming →",
    studioEyebrow: "Animation studio",
    studioH1: (s) => `Anime by ${s}`,
    studioLead: (s, n, y1, y2, top) => `${n} anime produced by ${s}${y1 ? (y1 === y2 ? ` in ${y1}` : `, from ${y1} to ${y2}`) : ""}, sorted by popularity, with the legal platforms to watch them. Best known for: ${top}.`,
    studioNow: "Airing and upcoming", studioAll: "All their anime",
    studioTitle: (s, n) => `${s} anime: the full list (${n} titles) and where to watch them`,
    studioDesc: (s, top) => `Every anime by studio ${s} (${top}…), sorted by popularity, and the legal platforms to stream them.`,
    studiosH1: "Animation studios", studiosLead: (n) => `${n} animation studios from Japan and around the world, with all their anime and where to watch them legally.`,
    studiosTitle: "Anime studios: MAPPA, Ufotable, Kyoto Animation… and their anime", studiosDesc: "Animation studios and all their anime: MAPPA, Ufotable, Wit Studio, Kyoto Animation, Bones, Madhouse… and where to stream them legally.",
    studiosMore: "All other studios", animes: (n) => `${n} anime`,
    orderEyebrow: "Watch order",
    orderH1: (f) => `${f} watch order`,
    orderLead: (f, n, h) => `All ${n} entries of the ${f} franchise in release order, the recommended order for a first watch. The “essential” steps make up the main story${h ? ` (about ${h} h)` : ""}, while extras (movies, OVAs, specials) can be watched on the side.`,
    orderTitle: (f) => `${f} watch order: seasons, movies and OVAs in the right order`,
    orderDesc: (f, n) => `How to watch ${f} in order: all ${n} seasons, movies and OVAs, what's essential or optional, and where to stream them legally.`,
    orderNote: "Order based on release dates and sequel / prequel links between entries. Updated automatically every day.",
    ordersH1: "Anime watch orders", ordersLead: (n) => `${n} franchises explained: which order to watch the seasons, movies and OVAs, and what you can skip.`,
    ordersTitle: "Anime watch orders: seasons, movies and OVAs in the right order", ordersDesc: "How to watch the big anime franchises in order: seasons, movies, OVAs, what's essential and what's optional.",
    works: (n) => `${n} entries`,
    guideLine: (f, n) => `📺 <a href="{href}">${f} watch order</a> (${n} entries)`,
    newEyebrow: "New arrivals", newH1: "New on streaming",
    newLead: "Anime that just arrived on Crunchyroll, Netflix, Hulu, Prime Video, Disney+ and other legal platforms, day by day. Availability can vary by country.",
    newTitle: "New anime on Crunchyroll, Netflix, Hulu…: the latest arrivals", newDesc: "Anime that arrived in the last few days on legal streaming platforms: Crunchyroll, Netflix, Hulu, Prime Video, Disney+…",
    newNone: "We're tracking new arrivals on streaming platforms from now on: this list fills up day by day, check back in a few days.",
    newArrived: "Now on", newSeason: (s) => `${s} simulcasts`,
    newSeasonSub: "This season's anime already available on a legal platform.",
    season: { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall" },
  },
};

const dateKey = (d) => (d?.year ? d.year * 10000 + (d.month || 12) * 100 + (d.day || 28) : 99999999);
const RECAP = /\b(recaps?|summary|compilation|digest)\b|総集編|特別編集/i;

// ---------- Données (calculées une seule fois) ----------
export function extrasData({ data, byId, nameOf, slugify }) {
  const pop = (m) => m.popularity || 0;
  const byPop = (a, b) => pop(b) - pop(a);

  // Studios (studios principaux uniquement)
  const st = new Map();
  for (const m of data.media) for (const n of m.studios?.nodes || []) {
    if (!n?.name) continue;
    if (!st.has(n.name)) st.set(n.name, []);
    st.get(n.name).push(m);
  }
  const usedS = new Set();
  const studios = [...st].filter(([, l]) => l.length >= 5)
    .map(([name, list]) => ({ name, list: list.sort(byPop), score: list.reduce((a, m) => a + pop(m), 0) }))
    .sort((a, b) => b.score - a.score).slice(0, 450);
  for (const s of studios) { let sl = slugify(s.name); while (usedS.has(sl)) sl += "-2"; usedS.add(sl); s.slug = sl; }
  const studioByName = new Map(studios.map((s) => [s.name, s]));

  // Franchises : groupes d'œuvres liées (suites, préquelles, films, OVA…)
  const adj = new Map(), sadj = new Map();
  const link = (g, a, b) => { if (!g.has(a)) g.set(a, new Set()); if (!g.has(b)) g.set(b, new Set()); g.get(a).add(b); g.get(b).add(a); };
  for (const m of data.media) {
    for (const id of [...(m.rel || []), ...(m.seq || []), ...(m.pre || [])]) if (byId.has(id)) link(adj, m.id, id);
    for (const id of [...(m.seq || []), ...(m.pre || [])]) if (byId.has(id)) link(sadj, m.id, id);
  }
  const comp = (g, start, max) => {
    const seen = new Set([start]), todo = [start];
    while (todo.length && seen.size <= max) for (const y of g.get(todo.pop()) || []) if (!seen.has(y)) { seen.add(y); todo.push(y); }
    return seen;
  };
  const done = new Set(), guides = [], usedG = new Set();
  for (const m of [...data.media].sort(byPop)) {
    if (done.has(m.id) || !adj.has(m.id)) continue;
    const ids = comp(adj, m.id, 61);
    ids.forEach((id) => done.add(id));
    const all = [...ids].map((id) => byId.get(id)).filter((x) => x && x.format !== "MUSIC");
    if (all.length < 4 || all.length > 60) continue;
    const dated = (x) => dateKey(x.startDate);
    const series = all.filter((x) => ["TV", "TV_SHORT", "ONA"].includes(x.format) && x.status !== "NOT_YET_RELEASED").sort((a, b) => dated(a) - dated(b));
    const root = series[0] || [...all].sort((a, b) => dated(a) - dated(b))[0];
    const main = comp(sadj, root.id, 200);
    const items = all.sort((a, b) => dated(a) - dated(b) || a.id - b.id).map((x) => ({
      m: x,
      kind: x.status === "NOT_YET_RELEASED" ? "up" : RECAP.test([x.title?.romaji, x.title?.english].join(" ")) ? "rec" : main.has(x.id) && ["TV", "TV_SHORT", "ONA", "MOVIE"].includes(x.format) ? "ess" : "opt",
    }));
    if (items.filter((i) => i.kind !== "rec" && i.kind !== "up").length < 3) continue;
    const name = nameOf(root).replace(/\s*(:\s*)?(Season 1|1st Season|Part 1)$/i, "").trim();
    let sl = slugify(name); while (usedG.has(sl)) sl += "-2"; usedG.add(sl);
    guides.push({ name, slug: sl, root, items, pop: Math.max(...all.map(pop)), mins: items.filter((i) => i.kind === "ess").reduce((a, i) => a + ((i.m.episodes || (i.m.nextAiringEpisode ? i.m.nextAiringEpisode.episode - 1 : 0)) * (i.m.duration || 0)), 0) });
  }
  guides.sort((a, b) => b.pop - a.pop);
  guides.length = Math.min(guides.length, 220);
  const guideOf = new Map();
  for (const g of guides) for (const i of g.items) guideOf.set(i.m.id, g);

  // Tendances (activité AniList des derniers jours)
  const trending = data.media.filter((m) => m.trending > 0 && m.status !== "NOT_YET_RELEASED").sort((a, b) => b.trending - a.trending || byPop(a, b)).slice(0, 10);

  return { studios, studioByName, guides, guideOf, trending };
}

// ---------- Nouveautés : on compare les plateformes d'aujourd'hui avec celles de la veille ----------
export async function loadNew({ data, worldLinks, SITE, TZ }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const get = async (n) => {
    if (process.env.PREV_DIR) return JSON.parse(await readFile(`${process.env.PREV_DIR}/${n}`, "utf8"));
    const r = await fetch(`${SITE}/${n}?t=${Date.now()}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  };
  let prev = null, log = [];
  try { prev = await get("streaming-state.json"); } catch (e) { console.log("Nouveautés : pas d'état précédent", e.message); }
  try { log = await get("new-log.json"); if (!Array.isArray(log)) log = []; } catch {}
  const state = {}, fresh = [];
  for (const m of data.media) {
    const sites = [...new Set(worldLinks(m).map((l) => l.site))];
    const old = prev?.[m.id] ? prev[m.id].split("|") : [];
    const all = [...new Set([...old, ...sites])];
    if (all.length) state[m.id] = all.join("|");
    if (prev) for (const s of sites) if (!old.includes(s)) fresh.push({ d: today, id: m.id, s });
  }
  if (prev) for (const id in prev) if (!(id in state)) state[id] = prev[id];
  // Trop d'arrivées d'un coup = données incomplètes la veille : on ne les compte pas
  if (fresh.length > 400) console.log(`Nouveautés : ${fresh.length} ignorées (anomalie probable)`);
  else log.push(...fresh);
  const limit = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const seen = new Set();
  log = log.filter((e) => e.d >= limit && !seen.has(`${e.id}|${e.s}`) && seen.add(`${e.id}|${e.s}`));
  console.log(`Nouveautés : ${fresh.length} aujourd'hui, ${log.length} sur 30 jours`);
  return { state, log };
}

// ---------- Petits morceaux pour les autres pages ----------
export function studioHref(X, name, lang, rel) {
  const s = X.studioByName.get(name);
  return s ? `${rel}${T[lang].studioDir}${s.slug}.html` : "";
}
export function guideLine(X, m, lang, rel, esc) {
  const g = X.guideOf.get(m.id);
  if (!g) return "";
  return `<p class="small">${T[lang].guideLine(esc(g.name), g.items.length).replace("{href}", `${rel}${T[lang].orderDir}${g.slug}.html`)}</p>`;
}
export function trendStrip(X, lang, rel, { esc, nameOf, poster }) {
  if (X.trending.length < 5) return "";
  const t = T[lang];
  return `<section><div class="sec-h"><h2 class="sec">${t.trendH}</h2><a href="${rel}${t.newPath}">${t.trendMore}</a></div><ol class="trend">${X.trending.map((m, i) => `<li><a href="${rel}anime/${m.slug}.html"><span class="tn">${i + 1}</span>${poster(m, "medium")}<b>${esc(nameOf(m))}</b></a></li>`).join("")}</ol></section>`;
}

// ---------- Pages ----------
export function extrasPages({ lang, X, news, data, page, esc, card, poster, cover, nameOf, chipFor, TZ }) {
  const t = T[lang];
  const num = (n) => n.toLocaleString(t.loc);
  const out = [];
  const list = (arr) => arr.length > 1 ? `${arr.slice(0, -1).join(", ")}${lang === "fr" ? " et " : " and "}${arr[arr.length - 1]}` : arr.join("");
  const yearOf = (m) => m.seasonYear || m.startDate?.year;

  // Studios
  for (const s of X.studios) {
    const rel = "../";
    const years = s.list.map(yearOf).filter(Boolean);
    const y1 = years.length ? Math.min(...years) : 0, y2 = years.length ? Math.max(...years) : 0;
    const top = s.list.slice(0, 3).map(nameOf);
    const now = s.list.filter((m) => m.status === "RELEASING" || m.status === "NOT_YET_RELEASED").slice(0, 12);
    const body = `
<div class="phead"><p class="eyebrow">${t.studioEyebrow}</p><h1>${esc(t.studioH1(s.name))}</h1>
<p class="lead">${esc(t.studioLead(s.name, num(s.list.length), y1, y2, list(top)))}</p></div>
${now.length ? `<section><h2 class="sec">${t.studioNow}</h2><div class="pgrid">${now.map((m) => card(m, rel)).join("")}</div></section>` : ""}
<section><h2 class="sec">${t.studioAll}</h2><div class="pgrid">${s.list.slice(0, 300).map((m) => card(m, rel)).join("")}</div></section>`;
    out.push({ path: `${t.studioDir}${s.slug}.html`, html: page({ path: `${t.studioDir}${s.slug}.html`, rel, title: t.studioTitle(s.name, s.list.length), desc: t.studioDesc(s.name, top.join(", ")), body, image: cover(s.list[0]) }) });
  }
  {
    const tiles = X.studios.slice(0, 24), rest = X.studios.slice(24).sort((a, b) => a.name.localeCompare(b.name));
    const body = `
<div class="phead"><p class="eyebrow">Studios</p><h1>${t.studiosH1}</h1><p class="lead">${esc(t.studiosLead(num(X.studios.length)))}</p></div>
<div class="gtiles">${tiles.map((s) => `<a class="gtile" href="${t.studioDir}${s.slug}.html">${poster(s.list[0], "large")}<span><b>${esc(s.name)}</b><small>${t.animes(num(s.list.length))}</small></span></a>`).join("")}</div>
${rest.length ? `<h2 class="sec" style="margin-top:32px">${t.studiosMore}</h2><nav class="genres">${rest.map((s) => `<a href="${t.studioDir}${s.slug}.html">${esc(s.name)}</a>`).join("")}</nav>` : ""}`;
    out.push({ path: t.studiosPath, html: page({ path: t.studiosPath, rel: "", title: t.studiosTitle, desc: t.studiosDesc, body }) });
  }

  // Ordres de visionnage
  for (const g of X.guides) {
    const rel = "../";
    const h = Math.round(g.mins / 60);
    const rows = g.items.map((it, i) => {
      const m = it.m, meta = [t.fmt[m.format] || m.format, m.startDate?.year || yearOf(m), m.episodes > 1 ? t.ep(m.episodes) : ""].filter(Boolean).join(" · ");
      return `<a class="row wo" href="${rel}anime/${m.slug}.html"><span class="won">${i + 1}</span>${poster(m, "medium")}<span class="row-t"><b>${esc(nameOf(m))}</b><small>${esc(meta)}</small><span class="wob k-${it.kind}">${t.kinds[it.kind]}</span></span><span class="chips">${chipFor(m)}</span></a>`;
    }).join("");
    const body = `
<div class="phead"><p class="eyebrow">${t.orderEyebrow}</p><h1>${esc(t.orderH1(g.name))}</h1>
<p class="lead">${esc(t.orderLead(g.name, g.items.length, h >= 2 ? num(h) : 0))}</p></div>
<div class="rows">${rows}</div>
<p class="small" style="margin-top:14px">${t.orderNote}</p>`;
    out.push({ path: `${t.orderDir}${g.slug}.html`, html: page({ path: `${t.orderDir}${g.slug}.html`, rel, title: t.orderTitle(g.name), desc: t.orderDesc(g.name, g.items.length), body, image: cover(g.root) }) });
  }
  {
    const body = `
<div class="phead"><p class="eyebrow">${t.orderEyebrow}</p><h1>${t.ordersH1}</h1><p class="lead">${esc(t.ordersLead(num(X.guides.length)))}</p></div>
<div class="gtiles">${X.guides.map((g) => `<a class="gtile" href="${t.orderDir}${g.slug}.html">${poster(g.root, "large")}<span><b>${esc(g.name)}</b><small>${t.works(g.items.length)}</small></span></a>`).join("")}</div>`;
    out.push({ path: t.orderPath, html: page({ path: t.orderPath, rel: "", title: t.ordersTitle, desc: t.ordersDesc, body }) });
  }

  // Nouveautés
  {
    const fmtDay = new Intl.DateTimeFormat(t.loc, { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
    const byId = new Map(data.media.map((m) => [m.id, m]));
    const days = new Map();
    for (const e of [...news.log].sort((a, b) => (a.d < b.d ? 1 : -1))) {
      const m = byId.get(e.id);
      if (!m) continue;
      if (!days.has(e.d)) days.set(e.d, new Map());
      const d = days.get(e.d);
      if (!d.has(m.id)) d.set(m.id, { m, s: [] });
      d.get(m.id).s.push(e.s);
    }
    const shown = [...days].slice(0, 14);
    const daysHtml = shown.map(([d, items]) => {
      const lab = fmtDay.format(new Date(`${d}T12:00:00Z`));
      const rows = [...items.values()].sort((a, b) => (b.m.popularity || 0) - (a.m.popularity || 0)).slice(0, 60)
        .map(({ m, s }) => `<a class="row" href="anime/${m.slug}.html">${poster(m, "medium")}<span class="row-t"><b>${esc(nameOf(m))}</b><small>${esc(t.newArrived)} ${esc(s.join(", "))}</small></span><span class="chips">${chipFor(m)}</span></a>`).join("");
      return `<section><h2 class="sec" style="margin-top:28px">${esc(lab[0].toUpperCase() + lab.slice(1))}</h2><div class="rows">${rows}</div></section>`;
    }).join("");
    const cur = data.current;
    const seasonal = data.media.filter((m) => m.tags?.includes(`${cur.season}-${cur.year}`) && chipFor(m).indexOf("muted") < 0).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 24);
    const body = `
<div class="phead"><p class="eyebrow">${t.newEyebrow}</p><h1>${t.newH1}</h1><p class="lead">${t.newLead}</p></div>
${daysHtml || `<p class="box">${t.newNone}</p>`}
${seasonal.length ? `<section><h2 class="sec" style="margin-top:32px">${esc(t.newSeason(`${t.season[cur.season]} ${cur.year}`))}</h2><p class="sub">${t.newSeasonSub}</p><div class="pgrid">${seasonal.map((m) => card(m, "")).join("")}</div></section>` : ""}`;
    out.push({ path: t.newPath, html: page({ path: t.newPath, rel: "", title: t.newTitle, desc: t.newDesc, body }) });
  }
  return out;
}
