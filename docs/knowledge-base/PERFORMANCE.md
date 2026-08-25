# Performance : méthode et budgets

## Principe

Une performance non mesurée est une hypothèse. On optimise l'expérience ou le SLO
qui compte, pas une ligne de code isolée.

## Protocole minimal

1. Nommer le scénario utilisateur ou la requête critique et son volume.
2. Définir la métrique et le seuil avant de changer le code.
3. Mesurer le build de production sur un environnement et des données fixes.
4. Faire un échauffement, puis plusieurs échantillons; conserver médiane et p95.
5. Modifier une cause probable à la fois.
6. Comparer résultat, variance, mémoire, taille et correction fonctionnelle.
7. Garder l'optimisation seulement si le gain est utile et reproductible.

Pour Node.js, utiliser `node:perf_hooks` ou un outil de profilage adapté. Pour
PostgreSQL, conserver `EXPLAIN (ANALYZE, BUFFERS)`. Pour React, profiler un build de
production et un appareil représentatif.

## Budgets partagés

### Web

Au 75e percentile mobile et desktop :

- LCP ≤ 2,5 s;
- INP ≤ 200 ms;
- CLS ≤ 0,1.

Les données terrain priment. Le laboratoire sert à diagnostiquer et à bloquer les
régressions avant livraison.

Chaque projet fixe aussi :

- un plafond JavaScript et CSS gzip pour le chargement initial;
- un delta gzip maximal par changement;
- les routes qui doivent être chargées à la demande;
- un scénario de mesure reproductible.

### Cockpit de l'usine

Le profil de charge initial `cockpit-v1`, utilisé tant qu'une mesure réelle ne le
remplace pas, contient :

- 100 projets enregistrés, au plus 20 visibles par utilisateur courant;
- 10 000 runs sur 30 jours, dont 250 actifs et 1 000 en file;
- un run complexe de 200 tâches et 10 000 événements paginés;
- 500 approbations dans l'historique et 100 navigateurs connectés simultanément.

Budgets d'acceptation initiaux :

- p95 serveur ≤ 500 ms pour vue d'ensemble, registre, liste et en-tête d'un run;
- accusé d'une commande ≤ 1 s au p95, indépendamment de son exécution asynchrone;
- événement accepté visible dans le cockpit en ≤ 5 s en régime nominal;
- perte du flux signalée en ≤ 15 s;
- pagination par curseur, 50 éléments par défaut et 100 au maximum;
- graphe et chronologie détaillés chargés à la demande;
- JavaScript initial ≤ 75 kB gzip et CSS initial ≤ 5 kB gzip.

Les scénarios mesurent première visite, navigation chaude, filtres, reconnexion du
flux, conflit de version et état partiel. Ils utilisent une identité réelle et les
contrôles d'autorisation, de redaction et d'audit actifs.

### API

Chaque route critique définit p50, p95, taux d'erreur, volume et taille de réponse.
Une comparaison sans jeu de données, concurrence, échauffement et environnement
identiques n'est pas recevable.

Règles permanentes :

- pagination et taille de réponse bornées;
- timeout explicite pour chaque appel externe;
- concurrence bornée et annulation propagée si possible;
- absence de requête N+1;
- journalisation structurée sans payload sensible;
- mesure séparée du temps application, service externe et base.

### Base de données

- Reproduire la distribution et le volume de production, pas seulement quelques
  lignes de seed.
- Examiner temps total, lignes estimées/réelles, boucles, lectures de buffers,
  tris et lignes éliminées.
- Ajouter un index uniquement si le plan représentatif l'utilise utilement.
- Mesurer aussi le coût sur les écritures et la taille de l'index.

### Usine d'agents

Chaque type de macro-tâche mesure :

- temps jusqu'au premier résultat utile et temps jusqu'au DoD vérifié;
- temps de file, exécution, outils, fournisseur, validation humaine et retry;
- taux de réussite au premier passage, reprises, appels d'outil et erreurs;
- tokens d'entrée/sortie, taille de contexte, coût et artefacts produits;
- CPU, mémoire, stockage et octets réseau par unité fonctionnelle;
- capacité maximale avant backpressure et comportement au-delà du seuil.

Le routeur choisit le plus petit modèle qui atteint le seuil de qualité et de
sécurité mesuré. Un fallback n'est jamais silencieux : changement de modèle,
localisation, politique de données, qualité et coût restent observables.

### Résilience et contrôles

- Les benchmarks conservent authentification, autorisation, chiffrement, audit,
  validation et politiques réseau actifs.
- Disponibilité, latence et débit ne suffisent pas : RTO et RPO sont mesurés par un
  test de restauration.
- Les retries ont un budget global et sont comptés comme du travail; ils ne peuvent
  pas masquer un SLO dégradé.
- L'autoscaling est borné et testé avec montée, stabilisation et retour à zéro.

### Sobriété

La mesure se rapporte à une unité fonctionnelle stable, par exemple « une
macro-tâche acceptée et vérifiée ». Une optimisation compare au minimum temps,
qualité, erreurs, tokens, calcul, mémoire, stockage, réseau et coût.

Ordre de réduction :

1. supprimer un travail, une donnée, un appel ou une conservation inutile;
2. borner, dédupliquer, mettre en lot ou rendre incrémental;
3. réutiliser un résultat déterministe avec une politique de cache sûre;
4. choisir un modèle, une machine ou une rétention plus petits;
5. ajouter de la capacité seulement après mesure de saturation.

Les environnements et workers non utilisés sont éteints ou ramenés à zéro lorsque
le RTO le permet. Les métriques de sobriété et l'autoévaluation RGESN sont précisées
dans [Réseau et infrastructure](NETWORK_INFRASTRUCTURE.md).

## Baseline du dépôt au 24 juillet 2026

Commande : `npm run build`, build Vite de production local.

| Actif              |      Brut |     Gzip |
| ------------------ | --------: | -------: |
| JavaScript initial | 222,13 kB | 69,33 kB |
| CSS initial        |  12,41 kB |  3,40 kB |
| HTML               |   0,46 kB |  0,29 kB |

Garde-fous initiaux **proposés**, à automatiser après validation :

- JavaScript initial ≤ 75 kB gzip;
- CSS initial ≤ 5 kB gzip;
- aucune hausse > 5 kB gzip par changement sans justification mesurée;
- objectifs Core Web Vitals ci-dessus;
- les SLO API seront fixés après une mesure avec PostgreSQL et un volume
  représentatif.

Ces plafonds protègent la baseline actuelle; ils ne prouvent pas à eux seuls que
l'application est rapide.

## Mesure du jalon 5 — découpage des routes

Scénario : build Vite de production local après ajout des pages de run et de
validation. Commande : `npm run build --workspace @software-factory/web`, mêmes
dépendances, données et machine le 4 août 2026.

| Actif | Avant | Après | Décision |
| --- | ---: | ---: | --- |
| JavaScript initial gzip | 77,84 kB | 74,90 kB | conforme au plafond de 75 kB |
| CSS initial gzip | 4,02 kB | 4,02 kB | conforme au plafond de 5 kB |
| Routes différées | aucune nouvelle route différée | validations, détail run et détail ticket | conservé |

La mesure porte sur la taille déterministe d'un build, pas sur un percentile de
latence. Les chunks différés mesurent respectivement 2,00 kB, 2,03 kB et 2,37 kB
gzip ; ils ne sont téléchargés qu'à l'ouverture de leur route.

## Mesure du MVP — cockpit epics, exécution et Knowledge Base

Scénario : build Vite de production après ajout des vues backlog, exécution ticket
par ticket, feedback et Knowledge Base. Commande :
`npm run build --workspace @software-factory/web`, mêmes dépendances et machine, le
19 août 2026.

| Actif | Jalon 5 | MVP | Budget | Décision |
| --- | ---: | ---: | ---: | --- |
| JavaScript initial gzip | 74,90 kB | 74,82 kB | 75 kB | conforme |
| CSS initial gzip | 4,02 kB | 4,83 kB | 5 kB | conforme |
| Backlog différé gzip | absent | 1,57 kB | chargé à la demande | conservé |
| Knowledge Base différée gzip | absent | 3,86 kB | chargé à la demande | conservé |
| Détail run différé gzip | 2,03 kB | 4,29 kB | chargé à la demande | hausse justifiée par dispatch, preuves et feedback |

Le détail run a augmenté de 2,26 kB gzip, sous le seuil de justification de 5 kB et
sans augmenter le JavaScript initial. Les listes API restent bornées à 100 éléments,
la recherche KB à 20, le contexte worker à 8 entrées/8 000 caractères et la
télémétrie à 200 durées par route. Les p95 du profil `cockpit-v1` restent à mesurer
sur son volume représentatif avant un pilote multi-utilisateur.

## Mesure du pilote GitHub mono-utilisateur

Scénario : build Vite de production après ajout de la vérification de session
GitHub et du tableau de bord réel. Commande :
`npm run build --workspace @software-factory/web`, mêmes dépendances et machine, le
25 août 2026.

| Actif | MVP | Pilote GitHub | Budget | Décision |
| --- | ---: | ---: | ---: | --- |
| JavaScript initial gzip | 74,82 kB | 73,46 kB | 75 kB | conforme |
| CSS initial gzip | 4,83 kB | 4,94 kB | 5 kB | conforme |
| Tableau de bord différé gzip | inclus dans l'initial | 2,69 kB | chargé à la demande | conservé |
| Knowledge Base différée gzip | 3,86 kB | 3,90 kB | chargé à la demande | conforme |
| Détail run différé gzip | 4,29 kB | 4,31 kB | chargé à la demande | conforme |

Le contrôle de session ajoute un aller-retour API avant l'affichage du cockpit.
Son impact de latence devra être mesuré sur l'hébergement final ; cette preuve ne
porte que sur la taille déterministe du build. Le chargement différé du tableau de
bord maintient le JavaScript initial sous son plafond.

## Fiche de preuve

Toute optimisation documente :

```text
Scénario et volume :
Environnement / version :
Commande ou profil :
Métrique :
Avant (médiane, p95, mémoire/taille) :
Après (médiane, p95, mémoire/taille) :
Variance / nombre d'échantillons :
Compromis et décision :
```
