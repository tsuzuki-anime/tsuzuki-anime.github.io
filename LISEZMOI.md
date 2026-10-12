# tsuzuki

**Où regarder tes animés en streaming légal** → https://tsuzuki-anime.github.io

tsuzuki indique sur quelles plateformes officielles regarder chaque animé (Crunchyroll, ADN, Netflix, Prime Video, Disney+…), avec le calendrier des sorties, l'ordre de visionnage des franchises, les studios et les nouveautés. Le site existe en français et en anglais.

- **Gratuit**, sans publicité, sans lien affilié et sans inscription.
- **Aucune vidéo** n'est hébergée ni diffusée : le site renvoie uniquement vers les plateformes officielles.
- **Mis à jour automatiquement** chaque jour.

## Sources des données

- [AniList](https://anilist.co) : fiches des animés et des mangas, affiches (site non affilié).
- [Wikidata](https://www.wikidata.org) : titres français et liens complémentaires (données libres CC0).
- Catalogues publics d'ADN et de Crunchyroll.

Les titres, informations et visuels restent la propriété de leurs ayants droit respectifs.

## Fonctionnement

Le site est généré par GitHub Actions (`scripts/fetch.mjs` puis `scripts/build.mjs`) et publié sur GitHub Pages.
