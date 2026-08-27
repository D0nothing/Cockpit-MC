# Vistory OS

Vistory OS est un cockpit local de fabrication logicielle gouvernée. Une demande
est transformée en epics et tickets dépendants, chaque ticket est développé par un
adaptateur borné avec des preuves persistées, puis le feedback peut enrichir une
Knowledge Base uniquement après une revue humaine explicite.

## Parcours livré

1. créer une session à partir d'un objectif et d'un niveau de risque ;
2. produire trois epics, des tickets spécifiques à la demande, leurs dépendances,
   critères d'acceptation et définitions de fini ;
3. appliquer la matrice d'approbation humaine `0/1/2` selon le risque ;
4. exécuter uniquement les tickets prêts, avec idempotence, événements et artefacts
   SHA-256 ;
5. utiliser le simulateur local sans effet externe, ou l'adaptateur GitHub Actions
   explicitement activé pour proposer une branche et une pull request brouillon ;
6. publier explicitement un ticket vers GitHub Issues avec reçu durable,
   déduplication et cible issue du projet ;
7. rattacher un feedback à un run et un artefact réels ;
8. conserver ce feedback dans une mémoire de session temporaire et bornée ;
9. proposer une connaissance projet ou commune, obtenir respectivement une ou deux
   approbations distinctes, la promouvoir avec provenance/version/citation, puis la
   révoquer sans effacer son historique.

Le cockpit expose les routes `/backlog`, `/workflows`, `/runs/:id` et `/knowledge`
pour piloter ce parcours avec l'état PostgreSQL réel.

## Démarrage local

Prérequis : Node.js 22+, npm 10+ et Docker Desktop.

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:generate
npm exec -w @software-factory/api -- prisma migrate deploy --schema prisma/schema.prisma
npm run db:seed
npm run dev
```

- cockpit : `http://localhost:3000` ;
- API : `http://localhost:4000/api` ;
- liveness : `/api/health` ;
- readiness PostgreSQL, accès et fournisseurs : `/api/ready`.

Le développement accepte `localhost:3000` et `127.0.0.1:3000`. En production, les
routes métier acceptent une session GitHub signée pour le seul login déclaré dans
`GITHUB_ALLOWED_LOGIN`, ou un `COCKPIT_ACCESS_TOKEN` réservé aux clients serveur.
Les routes worker utilisent un `COCKPIT_WORKER_TOKEN` distinct et les métriques
leur propre `METRICS_TOKEN`. Le secret cockpit n'est jamais placé dans le navigateur.
Ce profil mono-utilisateur ne remplace pas l'OIDC/RBAC requis avant une ouverture
multi-utilisateur.

Le déploiement depuis GitHub est décrit dans
[`docs/GITHUB_SINGLE_USER_DEPLOYMENT.md`](./docs/GITHUB_SINGLE_USER_DEPLOYMENT.md).

## Fournisseurs

`worker-simulator` est toujours local, déterministe et sans effet externe. Tous les
fournisseurs externes sont refusés par défaut. `ENABLED_PROVIDERS` accepte une liste
explicite parmi `github-actions`, `github-issues`, `confluence` et `openai`; une
entrée activée sans configuration serveur rend `/api/ready` négatif.

L'adaptateur GitHub Actions reçoit un contexte borné et nettoyé, exécute lint/tests/
build, pousse une branche `codex/*`, ouvre une PR brouillon et renvoie un reçu avec
empreinte. Il ne merge et ne déploie jamais. Aucune connexion externe n'est activée
par la configuration d'exemple.

L'adaptateur `github-issues` utilise un `GITHUB_ISSUES_TOKEN` distinct et borné au
dépôt pilote. Un clic humain crée l'Issue, ou retrouve celle déjà créée après une
interruption, puis conserve le reçu et le lien dans PostgreSQL.

## Validation

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm audit --audit-level=high
```

Le test E2E PostgreSQL couvre demande → plan → run → refus d'une dépendance →
dispatch avec preuve → feedback → refus inter-projet et auto-approbation → promotion
→ recherche citée → révocation. Les critères par jalon et leurs preuves sont dans
[`docs/MVP_ACCEPTANCE.md`](./docs/MVP_ACCEPTANCE.md).

## Périmètre de livraison

Le MVP local est terminé et démontrable. Une activation externe reste une décision
de pilote séparée : choix de l'IdP OIDC, rôles, dépôt bac à sable, secrets, egress,
sauvegarde/restauration, SBOM/provenance et responsables de risque. Ces portes sont
suivies dans [`docs/PILOT_READINESS.md`](./docs/PILOT_READINESS.md); elles ne sont
pas simulées ni présentées comme validées.

Les règles complètes vivent dans [`docs/knowledge-base`](./docs/knowledge-base/README.md),
avec les [SFG](./docs/knowledge-base/SFG.md), le
[modèle de menace](./docs/knowledge-base/THREAT_MODEL.md) et les
[budgets de performance](./docs/knowledge-base/PERFORMANCE.md).
