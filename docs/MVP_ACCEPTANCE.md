# Critères d'acceptation du MVP Vistory OS

État : **validé localement le 25 août 2026**. Cette preuve ne vaut pas autorisation
d'activer un fournisseur externe ou de traiter des données de production.

## Jalon 1 — Demande vers epics et tickets

### Critères

- une demande est isolée par `projectId` et rejouable par clé d'idempotence ;
- le plan contient trois epics ordonnés et des tickets adaptés aux capacités
  détectées dans la demande ;
- chaque ticket possède un epic, des dépendances valides, des critères
  d'acceptation et une définition de fini ;
- une dépendance absente ou un cycle est refusé avant persistance ;
- chaque tâche du run référence le ticket planifié correspondant.

### Preuves

- tests : `planner.spec.ts`, `runs.spec.ts`, contrats et validation de graphe ;
- API : `POST /api/sessions`, `POST /api/sessions/:id/plan`,
  `GET /api/projects/:id/backlog` ;
- cockpit : `/backlog` affiche les epics, tickets, statuts et dépendances réels.

## Jalon 2 — Développement orchestré et preuves

### Critères

- seul un ticket `ready` dont toutes les dépendances sont `completed` est
  dispatchable ;
- chaque dispatch est durable, idempotent et rattaché au run, au ticket et à son
  fournisseur ;
- un succès produit au moins un artefact avec une empreinte SHA-256 ;
- l'échec d'un fournisseur est explicite et ne déclenche aucun fallback ;
- le dernier ticket mène le run et la session à `review`, jamais à un merge ;
- le worker utilise un jeton distinct et un contexte borné, nettoyé et cité.

### Preuves

- tests : `task-execution.spec.ts` et `knowledge.e2e.spec.ts` ;
- API : `POST /api/runs/:id/tasks/:taskId/dispatch`, endpoints worker de contexte
  et de résultat ;
- scénario manuel : refus `409` d'une architecture bloquée, refus `503` du
  fournisseur GitHub désactivé, mauvais jeton worker `401`, huit tickets terminés,
  huit artefacts et états stocké/projeté tous deux `review` ;
- cockpit : un seul bouton **Développer** est actif au départ ; sa réussite crée la
  preuve et débloque le ticket suivant.

## Jalon 3 — Feedback, mémoire et Knowledge Base

### Critères

- un feedback référence un projet, une session, un run, un artefact et un auteur ;
- une preuve d'un autre projet est refusée ;
- la mémoire de session expire après sept jours et accepte au plus 100 éléments ;
- un feedback brut ne crée jamais d'entrée permanente ;
- une promotion projet exige une approbation indépendante, une promotion commune
  en exige deux et une confirmation explicite de portée ;
- l'auteur du feedback et le proposant ne peuvent s'auto-approuver ;
- la promotion conserve provenance, hash, portée, namespace, version et citation ;
- une nouvelle version révoque la précédente sans la supprimer ;
- une révocation retire immédiatement l'entrée des résultats actifs ;
- une recherche ne révèle que les entrées actives du projet courant et les entrées
  communes, au plus 20 résultats ; le contexte worker est limité à 8 entrées et
  8 000 caractères.

### Preuves

- tests : `knowledge.spec.ts` et le scénario E2E PostgreSQL complet ;
- API : `/api/feedback`, `/api/memory`, `/api/knowledge/candidates`, décisions,
  promotion, recherche et révocation ;
- refus manuels : preuve inter-projet `404`, auto-approbation `403`, portée commune
  non confirmée `400`, promotion avant quorum `409` ;
- cockpit : feedback depuis un artefact, candidat, approbation, promotion et citation
  `kb:<entryId>@<version>` visibles sur `/knowledge`.

## Jalon 4 — Cockpit et budgets

### Critères

- les vues backlog, runs, tâches, événements, preuves, feedbacks, candidats et
  connaissances utilisent les read models réels ;
- les pages lourdes sont chargées à la demande ;
- le chargement initial respecte 75 kB JavaScript gzip et 5 kB CSS gzip ;
- les contrôles restent utilisables sur les breakpoints desktop et mobile définis.

### Preuves

- parcours navigateur réel sur `127.0.0.1:3000` : création d'une session, run à
  sept tickets, dispatch du scope, feedback, proposition, approbation et promotion ;
- build Vite du 25 août 2026 : JavaScript initial **73,46 kB gzip**, CSS initial
  **4,94 kB gzip** ; tableau de bord 2,69 kB, backlog 1,58 kB, Knowledge Base
  3,90 kB et détail run 4,31 kB gzip, chargés à la demande.

## Jalon 5 — Livraison locale

### Critères

- les cinq migrations Prisma sont appliquées et la base est à jour ;
- lint, tests unitaires, E2E, build et audit de dépendances réussissent ;
- les actions CI et le CLI Codex du workflow sont épinglés ;
- les fournisseurs restent refusés par défaut ;
- la documentation distingue le MVP local des portes de production restantes.

### Commandes d'acceptation

```bash
npm run lint
npm test
DATABASE_URL=postgresql://factory:factory@localhost:5432/software_factory?schema=public npm run test:e2e
npm run build
npm audit --audit-level=high
npm exec -w @software-factory/api -- prisma migrate status --schema prisma/schema.prisma
```

Le résultat final de ces commandes doit être consigné dans le compte rendu de
livraison. Toute activation GitHub réelle demande en plus un dépôt bac à sable, les
secrets approuvés et une autorisation humaine séparée.

### Résultat final du 25 août 2026

- `npm run lint` : réussi sans avertissement ESLint ;
- `npm test` : 31 tests de contrats et 27 tests API réussis ;
- `npm run test:e2e` sur PostgreSQL 17 : 4 scénarios réussis ;
- `npm run build` : API TypeScript et cockpit Vite compilés ;
- `npm audit --audit-level=high` : 0 vulnérabilité ;
- `prisma migrate status` : 5 migrations trouvées, schéma à jour.

## Jalon 6 — Accès GitHub mono-utilisateur

### Critères

- en production, aucune route métier n'est accessible sans session GitHub valide
  ou jeton serveur explicitement configuré ;
- seule l'identité GitHub définie par `GITHUB_ALLOWED_LOGIN` peut ouvrir une
  session ;
- le jeton OAuth GitHub n'est ni persisté, ni envoyé au navigateur, ni journalisé ;
- la session est signée, limitée à huit heures et stockée dans un cookie
  `HttpOnly`, `Secure` et `SameSite=None` ;
- les mutations par cookie exigent une origine exactement autorisée ;
- l'état OAuth est signé, limité à dix minutes et consommé au callback ;
- les URL de retour sont dérivées de la configuration serveur et non d'une entrée
  du navigateur.

### Preuves

- tests unitaires : session valide, signature altérée, expiration, autre identité
  GitHub refusée et échange OAuth simulé ;
- test d'intégration : lecture autorisée avec cookie, mutation sans `Origin`
  refusée `403`, déconnexion avec origine autorisée `204` ;
- readiness : la production reste non prête si OAuth GitHub et jeton serveur sont
  tous deux absents ;
- procédure : [`GITHUB_SINGLE_USER_DEPLOYMENT.md`](GITHUB_SINGLE_USER_DEPLOYMENT.md).
