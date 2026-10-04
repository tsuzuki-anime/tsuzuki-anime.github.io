// Pages « où lire ce manga légalement », en français et en anglais.
// Données : data/manga.json (AniList : liens de lecture officiels), créé par scripts/fetch.mjs.
// Aucun lien affilié : uniquement des liens directs vers les plateformes et éditeurs officiels.
import { readFile } from "node:fs/promises";

let RAW = [];
try { RAW = JSON.parse(await readFile(new URL("../data/manga.json", import.meta.url), "utf8")).media || []; } catch { RAW = []; }

const LANG_FR = { French: "français", English: "anglais", Spanish: "espagnol", Portuguese: "portugais", German: "allemand", Italian: "italien", Japanese: "japonais", Korean: "coréen", Chinese: "chinois", Thai: "thaï", Indonesian: "indonésien", Vietnamese: "vietnamien", Arabic: "arabe", Polish: "polonais", Russian: "russe", Turkish: "turc" };
const kindOf = (m) => (m.format === "NOVEL" ? "Light novel" : m.format === "ONE_SHOT" ? "One-shot" : m.countryOfOrigin === "KR" ? "Manhwa" : m.countryOfOrigin === "CN" || m.countryOfOrigin === "TW" ? "Manhua" : "Manga");
const nameOf = (m) => m.title.english || m.title.romaji || m.title.native;

const L = {
  fr: {
    first: ["French", "English"],
    langName: (l) => (l ? LANG_FR[l] || l : "langue non précisée"),
    group: (l) => (l === "French" ? "En français" : l === "English" ? "En anglais" : null),
    others: "Autres langues",
    crumbHome: "Accueil", crumb: "Mangas",
    h1: (n) => `Où lire ${n} légalement ?`,
    title: (n, k) => `Où lire ${n} légalement en ligne ? (${k}, plateformes officielles)`,
    desc: (n, k, ls) => `${n} (${k.toLowerCase()}) : sur quelles plateformes officielles le lire légalement en ligne${ls.length ? ` : ${ls.slice(0, 4).join(", ")}` : ""}.`,
    alt: "Aussi connu sous : ",
    status: { RELEASING: "En cours", FINISHED: "Terminé", NOT_YET_RELEASED: "Pas encore sorti", HIATUS: "En pause", CANCELLED: "Arrêté" },
    chapters: (n) => `${n} chapitre${n > 1 ? "s" : ""}`, volumes: (n) => `${n} tome${n > 1 ? "s" : ""}`,
    read: "Lire", readOn: (s) => `Lire sur ${s}`,
    whereH: "Où le lire en ligne légalement",
    whereP: (n) => `Plateformes officielles qui proposent ${n}. Certaines sont gratuites (souvent les derniers chapitres), d'autres payantes. Le catalogue peut varier selon ton pays.`,
    infoH: "Éditeurs et sites officiels",
    animeH: "Adapté en animé",
    animeP: (n) => `${n} a été adapté en animé. Clique pour savoir où le regarder légalement :`,
    note: "tsuzuki ne propose aucun scan ni aucune lecture : nous renvoyons uniquement vers les plateformes et éditeurs officiels.",
    faqH: "Questions fréquentes",
    faqQ: (n) => `Où lire ${n} légalement ?`,
    faqA: (n, ls) => `${n} est disponible légalement sur ${ls.join(", ")} (selon les pays et les langues).`,
    indexTitle: "Où lire tes mangas légalement en ligne ? Mangas, manhwas et webtoons",
    indexDesc: "Trouve sur quelles plateformes officielles lire un manga, un manhwa, un webtoon ou un light novel légalement : MANGA Plus, Mangas.io, WEBTOON, VIZ, K MANGA…",
    indexH1: "Où lire tes mangas légalement",
    indexLead: (n) => `${n} mangas, manhwas, webtoons et light novels, avec les plateformes officielles pour les lire en ligne. Mis à jour chaque jour.`,
    search: "Rechercher un manga : One Piece, Solo Leveling, Berserk…",
    popular: "Les plus populaires",
    homeH: ["Où lire les mangas", "Tous les mangas →"],
    box: (a, k, mn) => `L'histoire de ${a} vient du ${k.toLowerCase()} ${mn}. Tu peux le lire légalement sur :`, // a et mn : HTML déjà échappé
    boxH: (k) => `Lire le ${k.toLowerCase()}`,
    boxBtn: (k) => `Où lire le ${k.toLowerCase()} →`,
  },
  en: {
    first: ["English"],
    langName: (l) => l || "language not specified",
    group: (l) => (l === "English" ? "In English" : null),
    others: "Other languages",
    crumbHome: "Home", crumb: "Manga",
    h1: (n) => `Where to read ${n} legally?`,
    title: (n, k) => `Where to read ${n} legally online (${k}, official platforms)`,
    desc: (n, k, ls) => `${n} (${k.toLowerCase()}): the official platforms where you can read it legally online${ls.length ? `: ${ls.slice(0, 4).join(", ")}` : ""}.`,
    alt: "Also known as: ",
    status: { RELEASING: "Ongoing", FINISHED: "Finished", NOT_YET_RELEASED: "Not yet released", HIATUS: "On hiatus", CANCELLED: "Cancelled" },
    chapters: (n) => `${n} chapter${n > 1 ? "s" : ""}`, volumes: (n) => `${n} volume${n > 1 ? "s" : ""}`,
    read: "Read", readOn: (s) => `Read on ${s}`,
    whereH: "Where to read it online legally",
    whereP: (n) => `Official platforms that carry ${n}. Some are free (often the latest chapters), others are paid. The catalog can vary by country.`,
    infoH: "Publishers and official sites",
    animeH: "Anime adaptation",
    animeP: (n) => `${n} got an anime adaptation. Click to see where to watch it legally:`,
    note: "tsuzuki does not host any scans or chapters: we only link to official platforms and publishers.",
    faqH: "FAQ",
    faqQ: (n) => `Where can I read ${n} legally?`,
    faqA: (n, ls) => `${n} is available legally on ${ls.join(", ")} (depending on country and language).`,
    indexTitle: "Where to read manga legally online: manga, manhwa and webtoons",
    indexDesc: "Find the official platforms to read any manga, manhwa, webtoon or light novel legally: MANGA Plus, VIZ, K MANGA, WEBTOON, Tapas…",
    indexH1: "Where to read manga legally",
    indexLead: (n) => `${n} manga, manhwa, webtoons and light novels, with the official platforms to read them online. Updated daily.`,
    search: "Search a manga: One Piece, Solo Leveling, Berserk…",
    popular: "Most popular",
    homeH: ["Where to read manga", "All manga →"],
    box: (a, k, mn) => `${a} is based on the ${k.toLowerCase()} ${mn}. You can read it legally on:`,
    boxH: (k) => `Read the ${k.toLowerCase()}`,
    boxBtn: (k) => `Where to read the ${k.toLowerCase()} →`,
  },
};

// Prépare les mangas une seule fois : slugs uniques, liens dédoublonnés, lien animé -> manga
let READY = null;
export function prepMangas(slugify) {
  if (READY) return READY;
  const used = new Set();
  const list = [];
  for (const m of [...RAW].sort((a, b) => a.id - b.id)) {
    let s = slugify(nameOf(m)) || "manga";
    if (used.has(s)) s = `${s}-${m.id}`;
    used.add(s);
    const seen = new Set();
    const links = (m.externalLinks || []).filter((l) => { const k = l.url.replace(/\/+$/, ""); if (seen.has(k)) return false; seen.add(k); return /^https?:\/\//.test(l.url); });
    list.push({ ...m, slug: s, kind: kindOf(m), read: links.filter((l) => l.type === "STREAMING"), info: links.filter((l) => l.type === "INFO") });
  }
  list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  const byAnime = new Map();
  for (const m of list) for (const id of m.anime || []) if (!byAnime.has(id)) byAnime.set(id, m); // liste triée : le plus populaire gagne
  READY = { list, byAnime };
  return READY;
}

// Liens de lecture, langue de la page en premier
function ordered(m, lang) {
  const first = L[lang].first;
  const rank = (l) => { const i = first.indexOf(l.language); return i === -1 ? first.length : i; };
  return [...m.read].sort((a, b) => rank(a) - rank(b));
}
const siteList = (m, lang, max = 4) => [...new Set(ordered(m, lang).map((l) => l.site))].slice(0, max);

export function mangaSearchData() {
  if (!READY) return [];
  return READY.list.map((m) => ({
    t: nameOf(m),
    a: [...new Set([m.title.romaji, m.title.english, m.title.native, ...(m.synonyms || []).slice(0, 3)].filter((x) => x && x !== nameOf(m)))].join(" | "),
    u: `manga/${m.slug}.html`,
    i: m.coverImage?.medium || m.coverImage?.large || "",
    k: [m.kind, m.startDate?.year].filter(Boolean).join(" · "),
    p: [...new Set(m.read.map((l) => l.site))].slice(0, 3),
  }));
}

function mcard(m, rel, esc, poster, lang) {
  const ps = siteList(m, lang, 2);
  return `<a class="pcard" href="${rel}manga/${m.slug}.html">${poster(m)}<span class="pc-b"><b>${esc(nameOf(m))}</b><small>${esc([m.kind, m.startDate?.year].filter(Boolean).join(" · "))}</small><span class="chips">${ps.map((p) => `<span class="chip p-other"><i></i>${esc(p)}</span>`).join("")}</span></span></a>`;
}

// Renvoie [{ path, html }] (chemins relatifs à la racine de la langue)
export function mangaPages({ lang, page, esc, slugify, poster, cover, animeById, animeCard, base }) {
  const t = L[lang];
  const { list } = prepMangas(slugify);
  if (!list.length) return [];
  const out = [];
  const linkRow = (l) => `<div class="plat"><span><b>${esc(l.site)}</b><small>${esc(t.langName(l.language))}</small></span><span class="acts"><a class="btn" href="${esc(l.url)}" rel="noopener nofollow" target="_blank">${t.read}</a></span></div>`;

  for (const m of list) {
    const rel = "../";
    const name = nameOf(m);
    const reads = ordered(m, lang);
    const groups = new Map();
    for (const l of reads) { const g = t.group(l.language) || t.others; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(l); }
    const sites = siteList(m, lang, 6);
    const alts = [...new Set([m.title.romaji, m.title.english, m.title.native, ...(m.synonyms || [])].filter((x) => x && x !== name))].slice(0, 6);
    const animes = (m.anime || []).map((id) => animeById.get(id)).filter((a) => a && a.slug).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 6);
    const ctas = [...new Map(reads.map((l) => [l.site, l])).values()].slice(0, 3);
    const faq = [[t.faqQ(name), t.faqA(name, sites)]];
    const body = `
<article class="fiche">
  <div class="fhero" style="--c:${esc(m.coverImage?.color || "#2A2D4A")}">
    <div class="fhero-in">
      ${poster(m, "large", true)}
      <div class="fhero-txt">
        <p class="crumb"><a href="${rel}index.html">${t.crumbHome}</a> <span>›</span> <a href="${rel}mangas.html">${t.crumb}</a> <span>›</span> ${esc(name)}</p>
        <h1>${esc(t.h1(name))}</h1>
        ${alts.length ? `<p class="alt">${t.alt}${esc(alts.join(" · "))}</p>` : ""}
        <div class="facts">
          <span class="fact">${esc(m.kind)}</span>
          ${m.status ? `<span class="fact">${esc(t.status[m.status] || m.status)}</span>` : ""}
          ${m.chapters ? `<span class="fact">${esc(t.chapters(m.chapters))}</span>` : ""}
          ${m.volumes ? `<span class="fact">${esc(t.volumes(m.volumes))}</span>` : ""}
          ${m.averageScore ? `<span class="fact score">★ ${lang === "fr" ? (m.averageScore / 10).toFixed(1).replace(".", ",") : (m.averageScore / 10).toFixed(1)}/10</span>` : ""}
        </div>
        <div class="ctas">${ctas.map((l) => `<a class="cta p-other" href="${esc(l.url)}" rel="noopener nofollow" target="_blank"><i></i>${esc(t.readOn(l.site))}</a>`).join("")}</div>
      </div>
    </div>
  </div>
  <div class="fbody">
    <div class="fmain">
      <section class="box"><h2>${esc(t.whereH)}</h2><p class="small">${esc(t.whereP(name))}</p>${[...groups.entries()].map(([g, ls]) => `<h3 class="h3">${esc(g)}</h3><div class="plats">${ls.map(linkRow).join("")}</div>`).join("")}</section>
      ${m.info.length ? `<section class="box"><h2>${esc(t.infoH)}</h2><div class="plats">${m.info.slice(0, 12).map((l) => `<div class="plat"><span><b>${esc(l.site)}</b><small>${esc(t.langName(l.language))}</small></span><span class="acts"><a class="btn ghost" href="${esc(l.url)}" rel="noopener nofollow" target="_blank">${lang === "fr" ? "Voir" : "Visit"}</a></span></div>`).join("")}</div></section>` : ""}
      ${animes.length ? `<section class="box"><h2>${esc(t.animeH)}</h2><p class="small">${esc(t.animeP(name))}</p><div class="pgrid">${animes.map((a) => animeCard(a, rel)).join("")}</div></section>` : ""}
      <section class="box"><h2>${esc(t.faqH)}</h2><dl class="faq">${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("")}</dl><p class="small">${esc(t.note)}</p></section>
    </div>
  </div>
</article>`;
    const path = `manga/${m.slug}.html`;
    out.push({
      path,
      html: page({
        path, rel, body, image: cover(m),
        title: t.title(name, m.kind), desc: t.desc(name, m.kind, sites),
        jsonld: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      }),
    });
  }

  const body = `<div class="phead"><h1>${esc(t.indexH1)}</h1><p class="lead">${esc(t.indexLead(list.length.toLocaleString(lang === "fr" ? "fr-FR" : "en-US")))}</p></div>
<div class="search cal-search">
  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
  <input id="mq" type="search" data-idx="${base}manga-search.json" placeholder="${esc(t.search)}" autocomplete="off" aria-label="${esc(t.search)}">
</div>
<div class="pgrid" id="mres" hidden></div>
<section id="mtop"><h2 class="sec">${esc(t.popular)}</h2><div class="pgrid">${list.slice(0, 60).map((m) => mcard(m, "", esc, poster, lang)).join("")}</div></section>
<p class="small" style="margin-top:28px">${esc(t.note)}</p>`;
  out.push({ path: "mangas.html", html: page({ path: "mangas.html", rel: "", title: t.indexTitle, desc: t.indexDesc, body }) });
  return out;
}

// Encadré « lire le manga » sur la fiche d'un animé (rel = "../")
export function mangaBox({ lang, esc, anime, rel, slugify }) {
  const { byAnime } = prepMangas(slugify);
  const m = byAnime.get(anime.id);
  if (!m) return "";
  const t = L[lang];
  const sites = siteList(m, lang, 4);
  return `<section class="box"><h2>${esc(t.boxH(m.kind))}</h2><p>${t.box(`<strong>${esc(nameOf(anime))}</strong>`, esc(m.kind), `<a href="${rel}manga/${m.slug}.html"><strong>${esc(nameOf(m))}</strong></a>`)}</p><div class="chips" style="margin:10px 0 14px">${sites.map((p) => `<span class="chip p-other"><i></i>${esc(p)}</span>`).join("")}</div><a class="btn" href="${rel}manga/${m.slug}.html">${esc(t.boxBtn(m.kind))}</a></section>`;
}

// Liens vers les mangas les plus populaires, pour la page d'accueil
export function mangaHome({ lang, esc, slugify, rel = "" }) {
  const { list } = prepMangas(slugify);
  if (!list.length) return "";
  const t = L[lang];
  return `<section><div class="sec-h"><h2 class="sec">${t.homeH[0]}</h2><a href="${rel}mangas.html">${t.homeH[1]}</a></div><nav class="genres">${list.slice(0, 12).map((m) => `<a href="${rel}manga/${m.slug}.html">${esc(nameOf(m))}</a>`).join("")}</nav></section>`;
}
