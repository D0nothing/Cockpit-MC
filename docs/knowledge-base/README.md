# Knowledge Base de l'usine logicielle

Cette base centralise les décisions d'une usine logicielle unique capable d'opérer
sur tout projet enregistré. Elle commence par les instructions de code, puis fixe le
socle de performance, cybersécurité, réseau, infrastructure, résilience et sobriété.
État de la consolidation : 4 août 2026.

## Objectif

Produire la plus petite solution **correcte, sûre, lisible et mesurable**. La
concision est un moyen de diminuer les surfaces de panne et de maintenance; elle ne
justifie ni le code cryptique, ni la suppression de contrôles, ni une optimisation
non mesurée.

## Navigation

- [Glossaire et ownership](GLOSSARY.md) : vocabulaire canonique, nom du produit et
  responsabilité unique de chaque composant interne.
- [Instructions de code](CODE_INSTRUCTIONS.md) : règles humaines détaillées.
- [Performance](PERFORMANCE.md) : méthode, métriques et budgets.
- [Cybersécurité et NIS2](SECURITY_NIS2.md) : baseline commune, matrice ReCyF,
  secure SDLC, sécurité des agents, incidents et dossier de preuve.
- [Modèle de menace fournisseurs](THREAT_MODEL.md) : frontières, refus par défaut,
  risques résiduels et critères avant tout effet externe.
- [Réseau et infrastructure](NETWORK_INFRASTRUCTURE.md) : zones Zero Trust, flux,
  durcissement, résilience, performance et sobriété RGESN.
- [Équipe d'agents](AGENT_ROLES.md) : rôles invocables, skills, permissions,
  Connector Gateway et cycle d'évolution issus de la base JARVIS.
- [Spécifications fonctionnelles générales](SFG.md) : acteurs, exigences
  fonctionnelles, règles métier, parcours, acceptation et périmètre MVP/P1/P2.
- [Interface de pilotage](INTERFACE_SPECIFICATIONS.md) : navigation, écrans,
  supervision des runs, commandes et onboarding générique des projets.
- [Architecture cible](TARGET_ARCHITECTURE.md) : traduction du schéma final en
  composants, flux, contrats et invariants.
- [Futures tâches](FUTURE_TASKS.md) : backlog ordonné avec dépendances et preuves de
  fin.
- [Modèle de profil projet](projects/PROJECT_TEMPLATE.md) : contrat d'enregistrement,
  d'isolation et d'exploitation valable pour tout projet.
- [Sources](SOURCES.md) : état de l'art issu en priorité des documentations
  officielles.
- [Préparation du pilote](../PILOT_READINESS.md) : preuves locales, portes validées
  et décisions encore bloquantes avant une connexion externe.
- [`AGENTS.md`](../../AGENTS.md) : version courte et exécutable par les agents de
  code.

## Niveaux de confiance

Chaque information spécifique à un projet doit porter implicitement ou explicitement
l'un de ces statuts :

- **Vérifié** : constaté dans le code, les tests, le schéma ou une mesure
  reproductible.
- **Décidé** : règle adoptée pour les nouveaux changements.
- **Proposé** : amélioration à valider par une mesure ou une décision produit.
- **À confirmer** : information manquante; aucune hypothèse ne doit être présentée
  comme un fait.

En cas de contradiction, l'ordre de vérité est : comportement testé et schéma,
configuration exécutable, profil projet vérifié, décision documentée, puis prose
générale.

L'[architecture cible](TARGET_ARCHITECTURE.md) décrit ce qui doit être construit.
Chaque profil instancié depuis le modèle décrit ce qui existe réellement pour son
projet. Cet écart est volontaire et ne doit jamais être masqué.

Les composants de l'usine n'appartiennent à aucun projet opéré. Toute capacité
partagée est documentée comme plateforme neutre; toute donnée ou règle propre à un
projet porte son `projectId`.

La baseline de sécurité est commune. L'assujettissement NIS2, les risques,
incidents et preuves restent néanmoins rattachés à la personne morale et au service
concernés via `legalEntityId` et `projectId`; la plateforme ne fusionne jamais ces
dossiers.

## Entretien

Une mise à jour de stack, d'architecture, de commande, de SLO ou de budget met à jour
le profil projet dans la même pull request. Une nouvelle règle indique son motif,
son mode de vérification et, si elle vient de la recherche externe, sa source.
