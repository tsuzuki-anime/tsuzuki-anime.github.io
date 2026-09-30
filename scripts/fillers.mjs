// Pages « liste des fillers » (épisodes à sauter), en français et en anglais.
// Données : data/fillers.json (classement d'après animefillerlist.com).
import { readFile } from "node:fs/promises";

const FILLERS = JSON.parse(await readFile(new URL("../data/fillers.json", import.meta.url), "utf8"));

// Slug du site, identifiant AniList (pour le lien « où regarder ») et titre français
const META = {
  "naruto": ["naruto", 20],
  "naruto-shippuden": ["naruto-shippuden", 1735],
  "boruto-naruto-next-generations": ["boruto", 97938],
  "one-piece": ["one-piece", 21],
  "bleach": ["bleach", 269],
  "black-clover": ["black-clover", 97940],
  "fairy-tail": ["fairy-tail", 6702],
  "dragon-ball": ["dragon-ball", 223],
  "dragon-ball-z": ["dragon-ball-z", 813],
  "dragon-ball-super": ["dragon-ball-super", 21175],
  "inuyasha": ["inuyasha", 249],
  "hunter-x-hunter": ["hunter-x-hunter-2011", 11061],
  "my-hero-academia": ["my-hero-academia", 21459],
  "jujutsu-kaisen": ["jujutsu-kaisen", 113415],
  "demon-slayer-kimetsu-no-yaiba": ["demon-slayer", 101922],
  "attack-titan": ["attack-on-titan", 16498],
  "fullmetal-alchemist-brotherhood": ["fullmetal-alchemist-brotherhood", 5114],
};
const TITLE_FR = { "Attack on Titan": "L'Attaque des Titans", "Hunter x Hunter 2011": "Hunter x Hunter (2011)", "Hunter x Hunter (2011)": "Hunter x Hunter (2011)" };

const parse = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
  const [a, b] = x.split("-").map((n) => parseInt(n, 10));
  return [a, Number.isFinite(b) ? b : a];
});
const count = (r) => r.reduce((n, [a, b]) => n + b - a + 1, 0);

const slugify = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SHOWS = FILLERS.map((s) => {
  const [slug, id] = META[s.slug] || [slugify(s.title), s.anilistId ?? null];
  const cat = { canon: parse(s.canon), mixed: parse(s.mixed), filler: parse(s.filler), anime: parse(s.animeCanon) };
  // Épisode par épisode ; un épisode absent de la source reste « non classé »
  const type = new Array(s.total + 1).fill("unknown");
  for (const k of ["canon", "anime", "mixed", "filler"]) for (const [a, b] of cat[k]) for (let i = a; i <= b && i <= s.total; i++) type[i] = k;
  const n = { canon: 0, mixed: 0, filler: 0, anime: 0, unknown: 0 };
  for (let i = 1; i <= s.total; i++) n[type[i]]++;
  return { ...s, slug, id, cat, type, n, pct: s.total ? Math.round((n.filler / s.total) * 100) : 0 };
});

const L = {
  fr: {
    indexTitle: "Liste des fillers d'animés : les épisodes à sauter",
    indexDesc: "Naruto, One Piece, Bleach, Black Clover… La liste des épisodes fillers à sauter pour chaque grand animé, avec les épisodes canon à ne pas rater.",
    indexLead: "Les fillers sont des épisodes inventés par le studio, absents du manga, qui ne font pas avancer l'histoire. Voici ceux que tu peux sauter dans les plus grands animés.",
    crumb: "Fillers",
    title: (t) => `Fillers de ${t} : la liste des épisodes à sauter`,
    desc: (t, s) => `${t} : ${s.n.filler} épisodes fillers sur ${s.total} (${s.pct} %). La liste complète des épisodes à sauter et des épisodes canon à regarder.`,
    h1: (t) => `Fillers de ${t} : les épisodes à sauter`,
    lead: (t, s) => s.n.filler
      ? `Sur les ${s.total} épisodes de ${t}, ${s.n.filler} sont des fillers (${s.pct} %). Tu peux les sauter sans rien rater de l'histoire.${s.n.mixed ? ` Les ${s.n.mixed} épisodes mixtes mélangent histoire et filler : regarde-les.` : ""}`
      : `Bonne nouvelle : ${t} n'a aucun épisode filler. Les ${s.total} épisodes suivent l'histoire, tu peux tout regarder.${s.n.mixed ? ` ${s.n.mixed} épisodes sont mixtes (un peu de contenu ajouté), mais ils restent à regarder.` : ""}`,
    kinds: { canon: "Canon (manga)", mixed: "Mixte", filler: "Filler", anime: "Canon anime", unknown: "Non classé" },
    kindsLong: { filler: "Épisodes fillers à sauter", mixed: "Épisodes mixtes (à regarder)", anime: "Canon anime (à regarder)", canon: "Épisodes canon (à regarder)" },
    none: "Aucun 🎉",
    all: "Tous les épisodes en un coup d'œil",
    ep: "Ép.", to: " à ",
    watch: (t) => `Où regarder ${t} légalement →`,
    source: `Classement des épisodes d'après <a href="https://www.animefillerlist.com/" rel="nofollow noopener">Anime Filler List</a>. Les épisodes « canon anime » sont inventés par le studio mais comptent pour l'histoire.`,
    card: (s) => (s.n.filler ? `${s.n.filler} fillers sur ${s.total} épisodes` : `Aucun filler · ${s.total} épisodes`),
    faqQ: (t) => `Combien y a-t-il d'épisodes fillers dans ${t} ?`,
    faqA: (t, s) => (s.n.filler ? `${t} compte ${s.n.filler} épisodes fillers sur ${s.total}, soit ${s.pct} %.` : `${t} n'a aucun épisode filler.`),
    others: "Autres listes de fillers",
    title_: (s) => TITLE_FR[s.title] || s.title,
  },
  en: {
    indexTitle: "Anime filler lists: every episode you can skip",
    indexDesc: "Naruto, One Piece, Bleach, Black Clover… The list of filler episodes to skip for every big anime, plus the canon episodes you shouldn't miss.",
    indexLead: "Fillers are episodes made up by the studio, not in the manga, that don't move the story forward. Here are the ones you can skip in the biggest anime.",
    crumb: "Fillers",
    title: (t) => `${t} filler list: every episode you can skip`,
    desc: (t, s) => `${t}: ${s.n.filler} filler episodes out of ${s.total} (${s.pct}%). The full list of episodes to skip and canon episodes to watch.`,
    h1: (t) => `${t} filler list: episodes to skip`,
    lead: (t, s) => s.n.filler
      ? `Out of ${s.total} episodes of ${t}, ${s.n.filler} are filler (${s.pct}%). You can skip them without missing any of the story.${s.n.mixed ? ` The ${s.n.mixed} mixed episodes blend story and filler: watch them.` : ""}`
      : `Good news: ${t} has no filler episodes. All ${s.total} episodes follow the story, so watch them all.${s.n.mixed ? ` ${s.n.mixed} episodes are mixed (some added content), but they're still worth watching.` : ""}`,
    kinds: { canon: "Canon (manga)", mixed: "Mixed", filler: "Filler", anime: "Anime canon", unknown: "Not classified" },
    kindsLong: { filler: "Filler episodes to skip", mixed: "Mixed episodes (watch)", anime: "Anime canon (watch)", canon: "Canon episodes (watch)" },
    none: "None 🎉",
    all: "Every episode at a glance",
    ep: "Ep.", to: "–",
    watch: (t) => `Where to watch ${t} legally →`,
    source: `Episode classification based on <a href="https://www.animefillerlist.com/" rel="nofollow noopener">Anime Filler List</a>. "Anime canon" episodes are made by the studio but count for the story.`,
    card: (s) => (s.n.filler ? `${s.n.filler} fillers out of ${s.total} episodes` : `No filler · ${s.total} episodes`),
    faqQ: (t) => `How many filler episodes are in ${t}?`,
    faqA: (t, s) => (s.n.filler ? `${t} has ${s.n.filler} filler episodes out of ${s.total} (${s.pct}%).` : `${t} has no filler episodes.`),
    others: "Other filler lists",
    title_: (s) => s.title,
  },
};

export const FILLER_SLUGS = SHOWS.map((s) => s.slug);

// Renvoie les pages [{ path, html }] (chemins relatifs à la racine de la langue)
const key = (x) => String(x || "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, "");
function finder(byId) {
  const idx = new Map();
  for (const m of byId.values()) {
    if (m.format !== "TV") continue;
    for (const t of [m.title?.english, m.title?.romaji, ...(m.synonyms || [])]) {
      const k = key(t); if (!k) continue;
      const cur = idx.get(k); if (!cur || (m.popularity || 0) > (cur.popularity || 0)) idx.set(k, m);
    }
  }
  return (s) => (s.id != null && byId.get(s.id)) || idx.get(key(s.title)) || idx.get(key(s.title.replace(/\s*\(.*\)$/, ""))) || null;
}

export function fillerPages({ lang, page, esc, byId, cover }) {
  const t = L[lang];
  const find = finder(byId);
  const out = [];
  const rng = (r) => r.map(([a, b]) => `<span class="fl-r">${a === b ? a : `${a}${t.to}${b}`}</span>`).join("");
  const bar = (s) => `<span class="fl-bar" aria-hidden="true"><i class="k-canon" style="width:${((s.n.canon + s.n.anime) / s.total) * 100}%"></i><i class="k-mixed" style="width:${(s.n.mixed / s.total) * 100}%"></i><i class="k-filler" style="width:${(s.n.filler / s.total) * 100}%"></i></span>`;
  const legend = `<p class="fl-legend">${["canon", "anime", "mixed", "filler"].map((k) => `<span><i class="k-${k}"></i>${esc(t.kinds[k])}</span>`).join("")}</p>`;

  for (const s of SHOWS) {
    const name = t.title_(s);
    const m = find(s);
    const img = m ? cover(m) : "";
    const grid = s.type.slice(1).map((k, i) => `<i class="k-${k}" title="${t.ep} ${i + 1} · ${esc(t.kinds[k])}"></i>`).join("");
    const block = (k) => (s.cat[k].length || k === "filler") ? `<section class="fl-sec fl-${k}"><h2 class="sec">${esc(t.kindsLong[k])} <small>(${s.n[k]})</small></h2><div class="fl-rs">${s.cat[k].length ? rng(s.cat[k]) : `<span class="fl-r">${t.none}</span>`}</div></section>` : "";
    const others = SHOWS.filter((o) => o !== s).map((o) => `<a class="chip" href="${o.slug}.html">${esc(t.title_(o))}</a>`).join("");
    const body = `<div class="phead"><p class="crumb"><a href="../fillers.html">${t.crumb}</a><span>/</span>${esc(name)}</p><h1>${esc(t.h1(name))}</h1><p class="lead">${esc(t.lead(name, s))}</p>${m ? `<p style="margin-top:18px"><a class="btn" href="../anime/${esc(m.slug)}.html">${esc(t.watch(name))}</a></p>` : ""}</div>
<div class="fl-stats">${["filler", "mixed", "canon", "anime"].filter((k) => k !== "anime" || s.n.anime).map((k) => `<div class="fl-stat k-${k}"><b>${s.n[k]}</b><span>${esc(t.kinds[k])}</span></div>`).join("")}</div>
${block("filler")}${block("mixed")}${block("anime")}${block("canon")}
<section class="fl-sec"><h2 class="sec">${esc(t.all)}</h2>${s.n.unknown ? legend.replace("</p>", `<span><i class="k-unknown"></i>${esc(t.kinds.unknown)}</span></p>`) : legend}<div class="fl-grid">${grid}</div></section>
<p class="fl-src">${t.source}</p>
<section class="fl-sec"><h2 class="sec">${esc(t.others)}</h2><div class="fl-rs">${others}</div></section>`;
    const jsonld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: t.faqQ(name), acceptedAnswer: { "@type": "Answer", text: t.faqA(name, s) } }] };
    const path = `fillers/${s.slug}.html`;
    out.push({ path, html: page({ path, rel: "../", title: t.title(name), desc: t.desc(name, s), body, jsonld, image: img }) });
  }

  const cards = SHOWS.map((s) => {
    const m = find(s);
    const img = m ? cover(m) : "";
    return `<a class="fl-card" href="fillers/${s.slug}.html">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : `<span class="fl-noimg"></span>`}<span class="fl-cb"><b>${esc(t.title_(s))}</b><small>${esc(t.card(s))}</small>${bar(s)}<em>${s.pct}${lang === "fr" ? " %" : "%"}</em></span></a>`;
  }).join("");
  const body = `<div class="phead"><h1>${esc(t.indexTitle)}</h1><p class="lead">${esc(t.indexLead)}</p></div>${legend}<div class="fl-cards">${cards}</div><p class="fl-src">${t.source}</p>`;
  out.push({ path: "fillers.html", html: page({ path: "fillers.html", rel: "", title: t.indexTitle, desc: t.indexDesc, body }) });
  return out;
}

// Encadré pour la page d'accueil (liens vers les listes de fillers les plus recherchées)
export function fillerHome({ lang, esc, rel = "" }) {
  const t = L[lang];
  const top = SHOWS.filter((s) => s.n.filler > 0).slice(0, 12);
  const h = lang === "fr" ? ["Fillers à sauter", "Toutes les listes →"] : ["Filler lists", "All filler lists →"];
  return `<section><div class="sec-h"><h2 class="sec">${h[0]}</h2><a href="${rel}fillers.html">${h[1]}</a></div><nav class="genres">${top.map((s) => `<a href="${rel}fillers/${s.slug}.html">${esc(t.title_(s))}</a>`).join("")}</nav></section>`;
}
