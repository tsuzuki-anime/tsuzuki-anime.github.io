// Récupère les données animés depuis l'API publique AniList et les enregistre dans data/anime.json.
// Lancé automatiquement chaque jour par GitHub (voir .github/workflows/deploy.yml).
import { writeFile, mkdir, readFile } from "node:fs/promises";

const API = "https://graphql.anilist.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  id siteUrl format status episodes duration genres averageScore popularity isAdult
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
const add = (m, tag) => {
  if (!m || m.isAdult) return;
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
const RANGE_Q = `query ($from: FuzzyDateInt, $to: FuzzyDateInt, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    media(type: ANIME, isAdult: false, format_not: MUSIC, startDate_greater: $from, startDate_lesser: $to, sort: POPULARITY_DESC) { ${MEDIA_FIELDS} }
  }
}`;
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

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/anime.json", import.meta.url),
  JSON.stringify({ fetchedAt: now.toISOString(), current: cur, next: nxt, media: [...media.values()], schedule })
);
console.log(`OK : ${media.size} animés enregistrés`);
