# Vistory OS

Cockpit interne pour piloter des tickets GitHub, rendre la spécification technique obligatoire et déclencher une proposition Codex uniquement après validation humaine.

## Démarrage local

Prérequis : Node.js 22+, npm 10+ et Docker.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

Le cockpit est disponible sur `http://localhost:3000`. L'API est disponible sur `http://localhost:4000/api` et sa sonde sur `/api/health`. Si l'API n'est pas lancée, le frontend affiche automatiquement un jeu de démonstration en lecture seule.

## Vérification

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm audit
```

## Déploiement Vercel

Le cockpit web est une application Vite statique. Le fichier [vercel.json](./vercel.json) à la racine permet à Vercel de construire automatiquement `apps/web` même si le projet Vercel pointe sur la racine du repository.

Configuration recommandée du projet web Vercel :

- Root Directory vide, ou `apps/web` si vous voulez cibler explicitement le workspace web ;
- Framework Preset : Vite ;
- Build Command : `npm run build -w @vistory/web` depuis la racine, ou `npm run build` si Root Directory vaut `apps/web` ;
- Output Directory : `apps/web/dist` depuis la racine, ou `dist` si Root Directory vaut `apps/web` ;
- variable d'environnement `VITE_API_URL` avec l'URL publique de l'API, suffixée par `/api` ;
- désactiver Deployment Protection pour les previews qui doivent être publiques.

Sans `VITE_API_URL`, le cockpit n'essaie pas d'appeler `localhost` en production et reste utilisable avec ses données de démonstration. Une réponse HTTP 401 sur l'URL de preview provient de la protection Vercel, pas de l'application.

L'API peut être déployée dans un second projet Vercel avec Root Directory réglé sur `apps/api`. Elle nécessite `DATABASE_URL` pour les routes métier et accepte `WEB_ORIGIN` pour autoriser le domaine du cockpit via CORS. Sa sonde est disponible sur `/api/health` même lorsque PostgreSQL n'est pas encore configuré.

## État du périmètre

Cette fondation livre le modèle PostgreSQL, le dashboard, le détail d'un ticket, la machine à états, l'édition/validation des specs, la double validation, le lancement contrôlé de GitHub Actions et l'audit hash-chain.

L'authentification OIDC, la synchronisation entrante complète GitHub/Confluence, le callback CI, l'endpoint runner authentifié et l'ancrage MainChain constituent les prochains incréments. Aucun faux connecteur de production n'est simulé.
