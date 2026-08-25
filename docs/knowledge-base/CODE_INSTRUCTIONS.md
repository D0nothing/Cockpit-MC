# Instructions de code partagées

Les mots **DOIT**, **NE DOIT PAS**, **DEVRAIT** et **PEUT** expriment respectivement
une règle obligatoire, une interdiction, une recommandation et une option.

## 1. Définition de « court »

Le code court minimise, dans cet ordre :

1. les chemins d'exécution et états possibles;
2. les concepts publics, abstractions et dépendances;
3. les entrées/sorties, allocations et travail répété sur les chemins chauds;
4. les lignes nécessaires pour rendre les trois points précédents évidents.

Le nombre de caractères ou de lignes n'est jamais un objectif isolé. Une expression
compacte qui cache plusieurs états, effets de bord ou conversions est plus coûteuse
qu'une version légèrement plus longue et explicite.

## 2. Règles de conception

| Décision     | Règle                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Fonction     | Un verbe et une responsabilité; retours anticipés; flux principal visible.                                         |
| Module       | Une raison cohérente de changer; API publique minimale.                                                            |
| Abstraction  | Seulement pour nommer une règle stable ou retirer une duplication réelle.                                          |
| Dépendance   | Seulement si elle réduit nettement code, risque ou maintenance après prise en compte du poids et des mises à jour. |
| Optimisation | Seulement après une mesure reproductible; garder la version la plus simple si le gain est négligeable.             |
| Commentaire  | Expliquer une contrainte, un invariant ou un compromis, jamais traduire la syntaxe.                                |

Une fonction qui dépasse environ 40 lignes logiques, trois niveaux d'imbrication ou
dix branches mérite une revue de conception. Ce sont des signaux, pas une invitation
à découper artificiellement le flux.

## 3. Contrats et types

- Le compilateur TypeScript **DOIT** rester en mode `strict`.
- Le nouveau code **NE DOIT PAS** employer `any`. Une donnée inconnue entre en
  `unknown`, est validée une fois à la frontière, puis circule avec un type précis.
- Les objets optionnels **DOIVENT** distinguer absence et valeur `undefined` lorsque
  cette différence influence le comportement.
- Les accès par index **DOIVENT** prendre en compte l'absence possible de la clé.
- Les types locaux évidents **DEVRAIENT** être inférés. Les fonctions exportées,
  messages réseau, événements, variables de configuration et données persistées
  **DOIVENT** avoir un contrat explicite.
- Une assertion de type **DOIT** être locale et accompagnée d'une preuve vérifiable
  dans le code. Une assertion ne remplace jamais une validation d'entrée.
- Les états métier mutuellement exclusifs **DEVRAIENT** utiliser une union
  discriminée et un contrôle exhaustif.
- Un contrat partagé **DOIT** avoir une source unique. Dans ce dépôt, cette source est
  `packages/contracts` lorsqu'elle ne dépend ni du navigateur, ni de Prisma.

## 4. Données et effets de bord

- Toutes les données HTTP, de base, de fichier, d'environnement ou d'API externe
  sont non fiables jusqu'à validation.
- Les tailles de payload, délais, nombres de résultats, tentatives et travaux
  concurrents **DOIVENT** être bornés.
- Les effets de bord **DEVRAIENT** rester aux frontières; le cœur métier
  **DEVRAIT** être composé de fonctions déterministes faciles à tester.
- Une opération rejouable ou déclenchée par un service externe **DOIT** définir son
  comportement d'idempotence.
- Les écritures qui doivent réussir ensemble **DOIVENT** partager une transaction.
- Une erreur exposée au client **NE DOIT PAS** révéler secret, requête interne ou
  détail d'infrastructure.

## 5. Sécurité par conception

- Une nouvelle frontière, permission, dépendance, source de données, capacité
  d'agent ou flux réseau **DOIT** mettre à jour le modèle de menace et ses tests de
  refus.
- Authentification et autorisation **DOIVENT** être vérifiées côté serveur pour
  chaque ressource. Un identifiant fourni par le client, notamment `projectId`,
  **NE DOIT PAS** constituer une preuve d'accès.
- Le moindre privilège, le refus par défaut, la séparation des responsabilités et
  les identités courtes **DOIVENT** être les valeurs par défaut.
- Les secrets **NE DOIVENT PAS** entrer dans le code, le frontend, les prompts, les
  logs, traces, artefacts, images ou la Knowledge Base.
- Toute entrée destinée à une commande système, une requête, un chemin, un template,
  une URL ou un outil **DOIT** être validée selon une liste positive et encodée pour
  son interpréteur. Une validation de type ne suffit pas contre une injection.
- Un document, une page, un dépôt, une entrée de KB, un prompt utilisateur et une
  sortie de modèle **DOIVENT** rester des données non fiables. Ils ne peuvent ni
  modifier la politique, ni augmenter les permissions, ni approuver une action.
- Un worker **DOIT** être configuré depuis un
  [`RoleProfile`](AGENT_ROLES.md) versionné. Les échanges entre rôles **DOIVENT**
  passer par événements/artefacts orchestrés, jamais par appels implicites.
- Une opération sensible **DOIT** être idempotente ou protégée contre le rejeu,
  auditée et, si la matrice de risque l'exige, bloquée par une approbation humaine.
- Dépendances, images, actions CI et skills **DOIVENT** être épinglés, inventoriés
  et vérifiés. Les artefacts livrés **DOIVENT** porter digest, SBOM et provenance.
- Une exigence web **DEVRAIT** référencer son identifiant OWASP ASVS avec la version
  du standard, par exemple `v5.0.0-x.y.z`.
- Les détails, exceptions et preuves suivent
  [la baseline cybersécurité et NIS2](SECURITY_NIS2.md).

## 6. Frontend React

- Calculer pendant le rendu ce qui peut être dérivé des props et de l'état; ne pas
  synchroniser un second état avec un effet.
- `useMemo`, `useCallback` et `memo` **NE DOIVENT PAS** être ajoutés par réflexe.
  Ils servent un goulot observé ou une identité nécessaire à un contrat.
- Les composants et hooks **DOIVENT** rester purs. Les effets ne servent qu'à
  synchroniser un système externe.
- Les pages ou fonctions rares et lourdes **DEVRAIENT** être chargées par import
  dynamique si la mesure du bundle ou du démarrage le justifie.
- Les listes **DOIVENT** utiliser une clé stable issue des données.
- Une donnée distante **DOIT** modéliser au minimum chargement, succès vide, succès
  et erreur lorsque ces états sont visibles par l'utilisateur.

## 7. API, Prisma et PostgreSQL

- Une route traduit HTTP vers une commande ou une requête métier; elle ne porte pas
  l'invariant elle-même.
- Une requête **DOIT** sélectionner uniquement les champs et relations consommés,
  fixer une limite et définir un ordre stable.
- Les requêtes dans une boucle **DOIVENT** être remplacées par une opération en lot,
  un `include` ciblé ou une jointure adaptée.
- Une instance Prisma **DOIT** être réutilisée par processus ou gérée par le modèle
  de pooling de la plateforme.
- Un index **NE DOIT PAS** être ajouté « au cas où ». Il est justifié par la forme
  d'une requête, sa sélectivité, son plan réel et le coût d'écriture accepté.
- Les optimisations SQL **DOIVENT** conserver le plan et les mesures
  `EXPLAIN (ANALYZE, BUFFERS)` avant/après sur des volumes représentatifs.

## 8. Tests et livraison

- Tester le comportement observable et les invariants, pas la structure interne.
- Une correction **DOIT** ajouter un test qui échoue avant le correctif.
- Une transition d'état, autorisation, transaction ou transformation de contrat
  **DOIT** avoir au moins un cas nominal et un cas de refus pertinent.
- Une nouvelle capacité d'agent **DOIT** tester au minimum prompt injection,
  exfiltration, escalade d'outil, egress refusé et cloisonnement inter-projets selon
  ce qui lui est applicable.
- Les tests **DOIVENT** être déterministes : horloge, aléatoire, réseau et identités
  sont contrôlés aux frontières.
- Le changement est terminé lorsque lint, tests et build passent, que le code mort
  est retiré, que les contrôles de sécurité applicables passent et que les documents
  touchés restent exacts.

## 9. Exceptions

Une exception à une règle obligatoire est locale, datée et documente :

1. la contrainte qui empêche la règle;
2. le risque accepté;
3. la vérification compensatoire;
4. la condition de suppression de l'exception.
