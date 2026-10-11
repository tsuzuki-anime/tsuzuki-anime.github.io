// Récupère les données animés depuis l'API publique AniList et les enregistre dans data/anime.json.
// Lancé automatiquement chaque jour par GitHub (voir .github/workflows/deploy.yml).
import { writeFile, mkdir, readFile } from "node:fs/promises";

const API = "https://graphql.anilist.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Garde-fou : nombre de titres actuellement en ligne, pour ne jamais publier un site amputé
// si AniList renvoie des données incomplètes (dans ce cas le site de la veille reste en ligne).
const SITE_URL = (process.env.SITE_URL || JSON.parse(await readFile(new URL("../config.json", import.meta.url), "utf8")).siteUrl).replace(/\/$/, "");
async function liveCount(file) {
  try {
    const r = await fetch(`${SITE_URL}/${file}?t=${Date.now()}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) return 0;
    const j = await r.json();
    return Array.isArray(j) ? j.length : 0;
  } catch { return 0; }
}

async function gql(query, variables, tries = 6) {
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
      });
    } catch (e) { console.error("Réseau :", e.message); await sleep(10000); continue; }
    if (res.status === 429) { await sleep(65000); continue; }
    const json = await res.json().catch(() => null);
    if (res.ok && json && !json.errors) { await sleep(2200); return json.data; }
    console.error("Erreur API", res.status, json && JSON.stringify(json.errors));
    await sleep(5000);
  }
  throw new Error("AniList injoignable après plusieurs essais");
}

const MEDIA_FIELDS = `
  id siteUrl format status episodes duration genres averageScore popularity trending isAdult
  season seasonYear countryOfOrigin
  title { romaji english native }
  synonyms
  trailer { id site }
  coverImage { large medium color }
  bannerImage
  startDate { year month day }
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { airingAt episode }
  externalLinks { site url type language }
  relations { edges { relationType node { id type } } }
`;

const SEASON_Q = `query ($season: MediaSeason, $year: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(season: $season, seasonYear: $year, type: ANIME, isAdult: false, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
  }
}`;

const SCHEDULE_Q = `query ($from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      airingAt episode
      media { ${MEDIA_FIELDS} }
    }
  }
}`;

function seasonOf(date) {
  const m = date.getUTCMonth() + 1, y = date.getUTCFullYear();
  const s = m <= 3 ? "WINTER" : m <= 6 ? "SPRING" : m <= 9 ? "SUMMER" : "FALL";
  return { season: s, year: y };
}
function nextSeason({ season, year }) {
  const order = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const i = order.indexOf(season);
  return i === 3 ? { season: "WINTER", year: year + 1 } : { season: order[i + 1], year };
}

async function allPages(query, vars, pick, maxPages = 6) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const d = await gql(query, { ...vars, page });
    out.push(...pick(d.Page));
    if (!d.Page.pageInfo.hasNextPage) break;
  }
  return out;
}

const now = new Date();
const cur = seasonOf(now), nxt = nextSeason(cur);
const media = new Map();
// Liens de franchise (suites, films, OAV…) : on garde seulement les identifiants utiles
const REL_TYPES = new Set(["PREQUEL", "SEQUEL", "PARENT", "SIDE_STORY", "SUMMARY", "ALTERNATIVE", "COMPILATION", "CONTAINS"]);
const add = (m, tag) => {
  if (!m || m.isAdult) return;
  if (m.relations) {
    m.rel = [...new Set((m.relations.edges || []).filter((e) => e.node?.type === "ANIME" && REL_TYPES.has(e.relationType)).map((e) => e.node.id))];
    // Suites et préquelles (pour « Suite annoncée » et la durée de toute la série)
    const ofType = (t) => [...new Set((m.relations.edges || []).filter((e) => e.node?.type === "ANIME" && e.relationType === t).map((e) => e.node.id))];
    m.seq = ofType("SEQUEL"); m.pre = ofType("PREQUEL");
    delete m.relations;
  }
  const prev = media.get(m.id);
  media.set(m.id, { ...(prev || m), ...m, tags: [...new Set([...(prev?.tags || []), tag])] });
};

for (const s of [cur, nxt]) {
  const list = await allPages(SEASON_Q, s, (p) => p.media, 3);
  list.forEach((m) => add(m, `${s.season}-${s.year}`));
  console.log(`Saison ${s.season} ${s.year} : ${list.length} animés`);
}

// Catalogue complet : TOUS les animés d'AniList (séries, films, OAV, ONA, spéciaux, titres niches compris),
// récupérés année par année selon leur date de sortie. Seuls les clips musicaux et les contenus adultes sont exclus.
// Pour ménager AniList, ce gros chargement n'a lieu qu'une fois par semaine (le dimanche). Les autres jours,
// on repart du catalogue déjà publié (anime-data.json) et on ne recharge que les animés en cours et les saisons.
// Si ce catalogue est absent, incomplet ou trop ancien, le chargement complet est fait comme avant.
const RANGE_Q = `query ($from: FuzzyDateInt, $to: FuzzyDateInt, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, isAdult: false, format_not: MUSIC, startDate_greater: $from, startDate_lesser: $to, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
  }
}`;
const STATUS_Q = `query ($status: MediaStatus, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, isAdult: false, format_not: MUSIC, status: $status, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
  }
}`;
const IDS_Q = `query ($ids: [Int], $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, id_in: $ids) { ${MEDIA_FIELDS} }
  }
}`;
async function liveAnimeData() {
  try {
    const r = await fetch(`${SITE_URL}/anime-data.json?t=${Date.now()}`, { signal: AbortSignal.timeout(180000) });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j.media) && j.fullAt ? j : null;
  } catch { return null; }
}
let fullAt = now.toISOString();
const seasonIds = new Set(media.keys()); // déjà rechargés aujourd'hui par les requêtes de saison
let full = now.getUTCDay() === 0 || process.env.FULL_FETCH === "1";
let cache = null;
if (!full) {
  cache = await liveAnimeData();
  const age = cache ? now - new Date(cache.fullAt) : Infinity;
  const live = cache ? await liveCount("search.json") : 0;
  if (!cache) console.log("Catalogue publié introuvable : chargement complet.");
  else if (!(age < 6.5 * 86400000)) console.log("Catalogue publié trop ancien : chargement complet.");
  else if (cache.media.length < Math.max(Math.round(live * 0.95), 15000)) console.log(`Catalogue publié incomplet (${cache.media.length}) : chargement complet.`);
  else {
    // Les étiquettes des saisons actuelle et suivante sont recalculées aujourd'hui
    const fresh = new Set([`${cur.season}-${cur.year}`, `${nxt.season}-${nxt.year}`, "airing"]);
    for (const m of cache.media) {
      const keep = (m.tags || []).filter((t) => !fresh.has(t));
      const c = media.get(m.id);
      // animé déjà rechargé par les saisons ci-dessus : on garde ses données du jour et on ajoute ses anciennes étiquettes
      if (c) c.tags = [...new Set([...(c.tags || []), ...keep])];
      else media.set(m.id, { ...m, tags: keep });
    }
    fullAt = cache.fullAt;
    console.log(`Catalogue repris du site (${cache.media.length} animés, complet du ${cache.fullAt.slice(0, 10)}) : mise à jour légère.`);
  }
  if (!cache || fullAt !== cache.fullAt) full = true;
}
if (full) {
  let catalogCount = 0;
  const ranges = [];
  for (let year = now.getUTCFullYear() + 2; year >= 1960; year--) ranges.push({ from: (year - 1) * 10000 + 1231, to: (year + 1) * 10000, label: String(year) });
  ranges.push({ from: 1, to: 19600000, label: "avant 1960" });
  for (const r of ranges) {
    const list = await allPages(RANGE_Q, { from: r.from, to: r.to }, (p) => p.media, 60);
    list.forEach((m) => add(m, "catalog"));
    catalogCount += list.length;
    console.log(`  ${r.label} : ${list.length}`);
  }
  console.log(`Catalogue : ${catalogCount} animés`);
  // Animés annoncés, y compris ceux sans date de sortie
  const upcoming = await allPages(STATUS_Q, { status: "NOT_YET_RELEASED" }, (p) => p.media, 40);
  upcoming.forEach((m) => add(m, "upcoming"));
  console.log(`À venir : ${upcoming.length} animés`);
} else {
  // Mise à jour légère : tous les animés en cours de diffusion…
  const done = new Set(seasonIds);
  const releasing = await allPages(STATUS_Q, { status: "RELEASING" }, (p) => p.media, 30);
  releasing.forEach((m) => { add(m, "catalog"); done.add(m.id); });
  console.log(`En cours : ${releasing.length} animés`);
  // …puis ceux qui étaient « en cours » ou « à venir » (date passée) et ont peut-être changé d'état
  const today = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  const fd = (d) => (d?.year || 0) * 10000 + (d?.month || 0) * 100 + (d?.day || 0);
  const stale = [...media.values()].filter((m) => !done.has(m.id) && (m.status === "RELEASING" || (m.status === "NOT_YET_RELEASED" && m.startDate?.year && fd(m.startDate) <= today) || (m.nextAiringEpisode && m.nextAiringEpisode.airingAt * 1000 < now.getTime()))).map((m) => m.id);
  let refreshed = 0;
  for (let i = 0; i < stale.length && i < 1500; i += 50) {
    const list = await allPages(IDS_Q, { ids: stale.slice(i, i + 50) }, (p) => p.media, 1);
    list.forEach((m) => { if (m.isAdult) return; add(m, "catalog"); refreshed++; });
  }
  console.log(`Changements d'état vérifiés : ${stale.length} animés, ${refreshed} rechargés`);
}

const from = Math.floor(now.getTime() / 1000) - 86400;
const to = from + 9 * 86400;
const schedule = [];
const sched = await allPages(SCHEDULE_Q, { from, to }, (p) => p.airingSchedules, 8);
for (const a of sched) {
  if (!a.media || a.media.isAdult) continue;
  add(a.media, "airing");
  schedule.push({ id: a.media.id, airingAt: a.airingAt, episode: a.episode });
}
console.log(`Calendrier : ${schedule.length} épisodes`);

// ---------- ADN (absent des données AniList) ----------
// Catalogue public d'ADN, avec une copie de secours dans data/adn-fallback.json
async function adnCatalog() {
  try {
    const out = [];
    for (let offset = 0; offset < 3000; offset += 100) {
      const r = await fetch(`https://gw.api.animationdigitalnetwork.com/show/catalog?offset=${offset}&limit=100&order=alpha`, { headers: { Accept: "application/json", "X-Target-Distribution": "fr" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      out.push(...(j.shows || []).map((s) => ({ t: s.title, o: s.originalTitle, u: s.urlPath })));
      if (!j.shows || out.length >= (j.total || 0) || j.shows.length < 100) break;
      await sleep(500);
    }
    if (out.length < 50) throw new Error("catalogue ADN incomplet");
    return out;
  } catch (e) {
    console.log("ADN en direct indisponible (" + e.message + "), copie de secours utilisée");
    return JSON.parse(await readFile(new URL("../data/adn-fallback.json", import.meta.url), "utf8"));
  }
}
const key = (s) => String(s || "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, "");
const index = new Map();
for (const m of media.values()) {
  for (const t of [m.title.romaji, m.title.english, m.title.native, ...(m.synonyms || [])]) {
    const k = key(t);
    if (k.length >= 3 && !index.has(k)) index.set(k, m);
  }
}
let adnMatched = 0;
try {
  const adn = await adnCatalog();
  for (const s of adn) {
    const m = index.get(key(s.t)) || index.get(key(s.o));
    if (!m) continue;
    // Titre utilisé par ADN (souvent le titre français) : ajouté aux titres alternatifs pour la recherche
    const known = [m.title.romaji, m.title.english, m.title.native, ...(m.synonyms || [])].map(key);
    if (s.t && !known.includes(key(s.t))) { m.synonyms = [...(m.synonyms || []), s.t]; m.titleFr = s.t; }
    m.externalLinks = m.externalLinks || [];
    if (!m.externalLinks.some((l) => l.site === "ADN")) {
      m.externalLinks.push({ site: "ADN", url: "https://animationdigitalnetwork.com" + s.u, type: "STREAMING", language: null });
      adnMatched++;
    }
  }
  console.log(`ADN : ${adn.length} titres, ${adnMatched} associés au catalogue`);
} catch (e) {
  console.log("ADN ignoré : " + e.message);
}

// ---------- Crunchyroll : plan du site public (liste des séries) ----------
let crAdded = 0;
try {
  const crList = [];
  for (const L of ["%23", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]) {
    for (let page = 0; page < 5; page++) {
      const r = await fetch(`https://www.crunchyroll.com/sitemaps/series/${L}.xml?page=${page}`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tsuzuki-bot)" } });
      if (!r.ok) break;
      const t = await r.text();
      const found = [...t.matchAll(/<loc>https:\/\/www\.crunchyroll\.com\/series\/([A-Z0-9]+)\/([^<]+)<\/loc>/g)].map((m) => ({ id: m[1], slug: m[2] }));
      crList.push(...found);
      if (found.length < 90) break;
      await sleep(300);
    }
  }
  for (const c of crList) {
    const m = index.get(key(c.slug));
    if (!m) continue;
    m.externalLinks = m.externalLinks || [];
    if (!m.externalLinks.some((l) => l.site === "Crunchyroll")) {
      m.externalLinks.push({ site: "Crunchyroll", url: `https://www.crunchyroll.com/fr/series/${c.id}/${c.slug}`, type: "STREAMING", language: null });
      crAdded++;
    }
  }
  console.log(`Crunchyroll : ${crList.length} séries, ${crAdded} liens ajoutés`);
} catch (e) {
  console.log("Crunchyroll ignoré : " + e.message);
}

// ---------- Wikidata (données libres CC0) : titres français, liens Crunchyroll et Netflix ----------
// Source complémentaire et indépendante d'AniList. Rien n'est remplacé : on ajoute seulement ce qui manque.
// Si Wikidata ne répond pas, on reprend la copie publiée la veille (wikidata-data.json) pour ne rien perdre.
async function wikidataRows() {
  const q = `SELECT ?al ?fr ?cr ?nf WHERE { ?item wdt:P8729 ?al . OPTIONAL { ?item rdfs:label ?fr FILTER(LANG(?fr) = "fr") } OPTIONAL { ?item wdt:P11330 ?cr } OPTIONAL { ?item wdt:P1874 ?nf } }`;
  try {
    const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": `tsuzuki-bot/1.0 (${SITE_URL})` },
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const rows = (await r.json()).results.bindings.map((b) => ({ id: +b.al.value, fr: b.fr?.value, cr: b.cr?.value, nf: b.nf?.value }));
    if (rows.length < 3000) throw new Error(`réponse incomplète (${rows.length})`);
    return rows;
  } catch (e) {
    console.log("Wikidata en direct indisponible (" + e.message + "), copie de la veille utilisée");
    try {
      const r = await fetch(`${SITE_URL}/wikidata-data.json?t=${Date.now()}`, { signal: AbortSignal.timeout(60000) });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  }
}
{
  const rows = await wikidataRows();
  let wFr = 0, wCr = 0, wNf = 0;
  for (const w of rows) {
    const m = media.get(w.id);
    if (!m || !Number.isInteger(w.id)) continue;
    m.externalLinks = m.externalLinks || [];
    if (w.cr && /^[A-Z0-9]{6,12}$/.test(w.cr) && !m.externalLinks.some((l) => l.site === "Crunchyroll")) {
      m.externalLinks.push({ site: "Crunchyroll", url: `https://www.crunchyroll.com/fr/series/${w.cr}`, type: "STREAMING", language: null });
      wCr++;
    }
    if (w.nf && /^\d{5,10}$/.test(w.nf) && !m.externalLinks.some((l) => l.site === "Netflix")) {
      m.externalLinks.push({ site: "Netflix", url: `https://www.netflix.com/title/${w.nf}`, type: "STREAMING", language: null });
      wNf++;
    }
    if (w.fr && !/^Q\d+$/.test(w.fr)) {
      const known = [m.title.romaji, m.title.english, m.title.native, ...(m.synonyms || [])].map(key);
      if (!known.includes(key(w.fr))) {
        m.synonyms = [...(m.synonyms || []), w.fr];
        if (!m.titleFr) m.titleFr = w.fr;
        wFr++;
      }
    }
  }
  if (rows.length) await writeFile(new URL("../data/wikidata.json", import.meta.url), JSON.stringify(rows)).catch(() => {});
  console.log(`Wikidata : ${rows.length} fiches, ${wFr} titres français, ${wCr} liens Crunchyroll et ${wNf} liens Netflix ajoutés`);
}

// Garde-fou animés : au moins 95 % du catalogue déjà en ligne (et jamais moins de 15 000 titres)
{
  const live = await liveCount("search.json");
  const want = Math.max(Math.round(live * 0.95), 15000);
  if (media.size < want) {
    console.error(`Données incomplètes : ${media.size} animés reçus, au moins ${want} attendus. Publication annulée, le site en ligne est gardé tel quel.`);
    process.exit(1);
  }
}
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/anime.json", import.meta.url),
  JSON.stringify({ fetchedAt: now.toISOString(), fullAt, current: cur, next: nxt, media: [...media.values()], schedule })
);
console.log(`OK : ${media.size} animés enregistrés`);

// ---------- Mangas : où les lire légalement ----------
// Mangas, manhwas, manhuas et light novels les plus populaires d'AniList qui ont au moins un lien de lecture officiel.
// En cas de souci, le site animé est quand même généré (la section mangas est simplement ignorée).
const MANGA_Q = `query ($page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: MANGA, isAdult: false, sort: POPULARITY_DESC) {
      id format status chapters volumes genres averageScore popularity countryOfOrigin isAdult
      title { romaji english native }
      synonyms
      coverImage { large medium color }
      startDate { year }
      externalLinks { site url type language }
      relations { edges { relationType node { id type } } }
    }
  }
}`;
// Mangas : AniList renvoie parfois des pages vides ou une liste coupée, sans erreur.
// 1) chaque page vide est redemandée, puis on passe à la suivante ; 2) jusqu'à 3 passages, en cumulant ce qui arrive ;
// 3) on fusionne avec la liste publiée la veille (manga-data.json) : un manga n'est jamais perdu à cause d'un mauvais jour.
// Si malgré tout la liste reste trop courte, la publication est annulée (le site de la veille reste en ligne).
async function allMangaPages(maxPages = 100) {
  const out = [];
  let empty = 0;
  for (let page = 1; page <= maxPages; page++) {
    let d = await gql(MANGA_Q, { page });
    for (let retry = 0; retry < 2 && d.Page.media.length < 50; retry++) {
      console.log(`Mangas : page ${page} incomplète (${d.Page.media.length} titres), nouvel essai…`);
      await sleep(20000);
      d = await gql(MANGA_Q, { page });
    }
    out.push(...d.Page.media);
    empty = d.Page.media.length ? 0 : empty + 1;
    if (empty >= 3) break;
    await sleep(1500);
  }
  return out;
}
async function liveMangaData() {
  try {
    const r = await fetch(`${SITE_URL}/manga-data.json?t=${Date.now()}`, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.media) ? j.media : [];
  } catch { return []; }
}
{
  const prev = await liveMangaData();
  const liveM = await liveCount("manga-search.json");
  const wantM = Math.max(Math.round(Math.max(liveM, prev.length) * 0.97), 3400);
  const fresh = new Map();
  // Comme pour les animés, la liste complète des mangas n'est rechargée qu'une fois par semaine (le dimanche).
  // Les autres jours, la liste publiée est reprise telle quelle si elle est complète.
  const weekly = !full && prev.length >= wantM;
  if (weekly) console.log(`Mangas : liste publiée reprise (${prev.length} titres), rechargement complet le dimanche.`);
  for (let attempt = 1; attempt <= 3 && !weekly; attempt++) {
    let raw = [];
    try {
      raw = await allMangaPages(100);
    } catch (e) {
      console.log(`Mangas : erreur (${e.message})`);
    }
    for (const m of raw) {
      if (!m || m.isAdult) continue;
      const links = (m.externalLinks || []).filter((l) => l.url && (l.type === "STREAMING" || l.type === "INFO"));
      if (!links.some((l) => l.type === "STREAMING")) continue;
      m.externalLinks = links;
      m.anime = [...new Set((m.relations?.edges || []).filter((e) => e.node?.type === "ANIME" && e.relationType === "ADAPTATION").map((e) => e.node.id))];
      delete m.relations;
      fresh.set(m.id, m);
    }
    console.log(`Mangas (passage ${attempt}) : ${fresh.size} reçus d'AniList avec une plateforme de lecture légale`);
    if (fresh.size >= wantM) break;
    if (attempt < 3) await sleep(90000);
  }
  const merged = new Map(prev.map((m) => [m.id, m]));
  for (const [id, m] of fresh) merged.set(id, m);
  const mangas = [...merged.values()];
  console.log(`Mangas : ${mangas.length} au total (${fresh.size} mis à jour aujourd'hui, ${mangas.length - fresh.size} repris de la veille)`);
  // Liste incomplète : on ne bloque pas le site. Les mangas reçus sont mis à jour, et build.mjs recopie
  // telles quelles les pages mangas déjà en ligne qui manquent (aucune page perdue).
  const partial = mangas.length < wantM;
  if (partial) console.log(`Mangas incomplets : ${mangas.length} sur au moins ${wantM} attendus. Les pages mangas manquantes seront reprises du site en ligne.`);
  await writeFile(new URL("../data/manga.json", import.meta.url), JSON.stringify({ media: mangas, partial }));
}
