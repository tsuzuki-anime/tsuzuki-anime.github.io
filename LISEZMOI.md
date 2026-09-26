# tsuzuki — mise en ligne

Site gratuit qui indique où regarder légalement les animés en Belgique, avec le calendrier des sorties.
Tout se met à jour **automatiquement chaque jour** : vous n'avez rien à faire une fois le site en ligne.

## Mettre le site en ligne (une seule fois, environ 15 minutes)

1. Connectez-vous sur **github.com**.
2. En haut à droite, cliquez sur **+** puis **New repository**.
   - Repository name : `tsuzuki`
   - Cochez **Public**
   - Cliquez sur **Create repository**.
3. Sur la page qui s'affiche, cliquez sur le lien **uploading an existing file**.
4. Décompressez le fichier `tsuzuki.zip` sur votre ordinateur, ouvrez le dossier `tsuzuki`,
   sélectionnez **tout son contenu** (y compris le dossier `.github`) et glissez-le dans la page GitHub.
   Cliquez sur **Commit changes**.
   - Sur Mac, le dossier `.github` est caché : appuyez sur `Cmd + Maj + .` dans le Finder pour l'afficher.
   - Sur Windows : dans l'Explorateur, menu **Affichage** › cochez **Éléments masqués**.
5. Ouvrez le fichier `config.json` sur GitHub, cliquez sur le crayon ✏️ et remplacez
   `VOTRE-PSEUDO` par votre nom d'utilisateur GitHub. Cliquez sur **Commit changes**.
6. Allez dans **Settings** › **Pages** (menu de gauche).
   Dans **Source**, choisissez **GitHub Actions**.
7. Allez dans l'onglet **Actions**, cliquez sur **Mise à jour et publication du site**
   puis sur **Run workflow**. Attendez 2 à 3 minutes que la pastille devienne verte ✅.
8. Votre site est en ligne à l'adresse : `https://VOTRE-PSEUDO.github.io/tsuzuki/`

Ensuite, le site se met à jour tout seul chaque matin vers 6 h.

## Plus tard (quand le site a des visiteurs)

- **Google Search Console** (gratuit) : déclarez le site et envoyez `sitemap.xml` pour que Google l'indexe plus vite.
- **Nom de domaine** (~10 €/an) puis **Google AdSense** : collez votre identifiant `ca-pub-…` dans `adsenseClient` de `config.json`. Les emplacements publicitaires s'activent automatiquement.
- **Affiliation** : collez vos liens affiliés dans `affiliates` de `config.json`. Un bouton « S'abonner » apparaît alors sur les fiches.

## Règles de la source des données

Les données viennent d'AniList. Leur API est gratuite tant que le site rapporte moins de 150 $ par mois.
Au-delà, il faut demander une licence commerciale en écrivant à contact@anilist.co.
