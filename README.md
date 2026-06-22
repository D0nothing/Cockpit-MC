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

Le cockpit est disponible sur `http://localhost:3000`, l’API sur `http://localhost:4000/api` et sa sonde sur `/api/health`. Si l’API n’est pas lancée, le frontend affiche automatiquement un jeu de démonstration en lecture seule.

## Vérification

```bash
npm test
npm run build
```

## État du périmètre

Cette fondation livre le modèle PostgreSQL, le dashboard, le détail d’un ticket, la machine à états, l’édition/validation des specs, la double validation, le lancement contrôlé de GitHub Actions et l’audit hash-chain. Voir [l’architecture](docs/ARCHITECTURE.md) pour les frontières de sécurité et les décisions requises avant production.

L’authentification OIDC, la synchronisation entrante complète GitHub/Confluence, le callback CI, l’endpoint runner authentifié et l’ancrage MainChain constituent les prochains incréments. Aucun faux connecteur de production n’est simulé.
