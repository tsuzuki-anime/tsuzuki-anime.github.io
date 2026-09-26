// Récupère les données animés depuis l'API publique AniList et les enregistre dans data/anime.json.
// Lancé automatiquement chaque jour par GitHub (voir .github/workflows/deploy.yml).
import { writeFile, mkdir } from "node:fs/promises";

const API = "https://graphql.anilist.co";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gql(query, variables, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
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
  coverImage { color }
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

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/anime.json", import.meta.url),
  JSON.stringify({ fetchedAt: now.toISOString(), current: cur, next: nxt, media: [...media.values()], schedule }, null, 1)
);
console.log(`OK : ${media.size} animés enregistrés`);
