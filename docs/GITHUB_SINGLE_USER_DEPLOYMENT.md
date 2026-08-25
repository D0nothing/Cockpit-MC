# Déploiement GitHub mono-utilisateur

Ce profil publie Vistory OS depuis le dépôt GitHub `D0nothing/Cockpit-MC` et
n'autorise qu'un seul login GitHub. Le dépôt et GitHub Actions restent sur GitHub ;
le cockpit et l'API sont deux projets Vercel reliés au même dépôt, et PostgreSQL
est un service managé. GitHub Pages seul ne peut pas exécuter l'API Node.js ni
PostgreSQL.

## 1. Créer l'application OAuth GitHub

Dans **GitHub → Settings → Developer settings → OAuth Apps**, créer une application :

- Homepage URL : l'URL HTTPS du projet web ;
- Authorization callback URL : `https://<api>/api/auth/github/callback`.

Conserver le Client ID et le Client Secret dans le coffre de variables du projet
API. Le secret ne va ni dans GitHub, ni dans le frontend, ni dans le dépôt.

## 2. Relier les deux projets Vercel au dépôt GitHub

Importer deux fois le même dépôt :

| Projet | Root Directory | Configuration |
| --- | --- | --- |
| `vistory-web` | `apps/web` | `apps/web/vercel.json` |
| `vistory-api` | `apps/api` | `apps/api/vercel.json` |

Activer l'accès aux fichiers extérieurs au Root Directory afin que les workspaces
npm puissent construire `packages/contracts`. Chaque push GitHub déclenchera les
deux déploiements liés.

## 3. Variables du projet web

```text
VITE_API_URL=https://<api>/api
```

## 4. Variables du projet API

```text
NODE_ENV=production
DATABASE_URL=<connexion PostgreSQL de production avec pooling>
WEB_ORIGIN=https://<web>
APP_PUBLIC_URL=https://<web>
API_PUBLIC_URL=https://<api>
GITHUB_OAUTH_CLIENT_ID=<client id OAuth>
GITHUB_OAUTH_CLIENT_SECRET=<secret OAuth>
GITHUB_ALLOWED_LOGIN=D0nothing
AUTH_SESSION_SECRET=<secret aléatoire d'au moins 32 caractères>
COCKPIT_WORKER_TOKEN=<secret distinct d'au moins 32 caractères>
METRICS_TOKEN=<secret distinct>
ENABLED_PROVIDERS=
```

`COCKPIT_ACCESS_TOKEN` reste facultatif pour un client serveur d'administration ;
il n'est jamais transmis au navigateur. Les cookies de session sont `HttpOnly`,
`Secure`, limités à huit heures et signés. Toute mutation par cookie exige une
origine présente dans `WEB_ORIGIN`.

## 5. Base de données

Avant d'ouvrir le cockpit :

```bash
npm ci
npm run db:generate
npm exec -w @software-factory/api -- prisma migrate deploy --schema prisma/schema.prisma
npm run db:seed
```

Adapter ensuite le projet seedé au véritable propriétaire et dépôt GitHub. Le seed
de démonstration ne doit pas désigner une cible réelle par erreur.

## 6. Activer le développement GitHub après la recette web

Ajouter côté API :

```text
GITHUB_TOKEN=<jeton serveur borné au dépôt pilote>
GITHUB_WORKFLOW_ID=codex.yml
ENABLED_PROVIDERS=github-actions
```

Ajouter dans les secrets GitHub Actions :

```text
COCKPIT_URL=https://<api>
COCKPIT_WORKER_TOKEN=<même référence que l'API>
OPENAI_API_KEY=<secret du runner>
```

Le premier essai se fait sur une branche `codex/*` d'un dépôt bac à sable. Le
workflow doit seulement ouvrir une pull request brouillon ; fusion et déploiement
restent humains.

## Critères de validation

1. `/api/health` répond `200` et `/api/ready` répond `ready`.
2. Un navigateur sans session voit seulement la page de connexion.
3. `D0nothing` peut se connecter ; tout autre login reçoit `403`.
4. Une mutation sans origine ou avec une autre origine reçoit `403`.
5. Aucun secret n'apparaît dans le bundle, les réponses ou les logs.
6. Les cinq migrations sont appliquées et les données survivent au redéploiement.
7. Le parcours demande → tickets → preuve → feedback → KB réussit en ligne.
8. Après activation GitHub, un ticket produit une PR brouillon et son reçu SHA-256,
   sans merge automatique.

## Retour arrière

- retirer `github-actions` de `ENABLED_PROVIDERS` coupe immédiatement tout nouvel
  effet externe ;
- révoquer le secret OAuth invalide les nouvelles connexions ;
- changer `AUTH_SESSION_SECRET` invalide toutes les sessions existantes ;
- restaurer le dernier déploiement Vercel sain et la sauvegarde PostgreSQL testée.
