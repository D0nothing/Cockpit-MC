# Instructions de contribution

Ces règles s'appliquent à tout le dépôt. Les détails et leurs sources vivent dans
[`docs/knowledge-base`](docs/knowledge-base/README.md).

## Ordre des priorités

1. Préserver la correction, la sécurité et les invariants métier.
2. Atteindre une performance mesurée sur un scénario représentatif.
3. Réduire le nombre de concepts, de branches, de dépendances et de lignes.
4. Respecter le style existant lorsque les trois priorités précédentes sont égales.

Le code le plus court n'est pas le code qui contient le moins de caractères. C'est
la plus petite solution lisible qui satisfait le contrat, les tests et le budget de
performance.

## Avant de modifier

- Lire le fichier concerné, ses appels, ses tests et le profil projet pertinent.
- Rechercher une primitive ou un type existant avant d'en créer un autre.
- Définir le comportement attendu et, pour une optimisation, la mesure de départ.
- Faire le changement complet le plus petit possible. Ne pas élargir le périmètre.

## Écriture du code

- Préférer les fonctions pures, les retours anticipés et une seule responsabilité.
- Garder le flux principal visible; éviter plus de trois niveaux d'imbrication.
- Ne créer une abstraction que si elle nomme une règle métier stable ou supprime une
  duplication réelle. Ne pas préparer des besoins hypothétiques.
- Préférer les API natives et les dépendances déjà présentes. Toute nouvelle
  dépendance doit réduire clairement le code, le risque ou le coût de maintenance.
- Supprimer le code devenu inutile dans le même changement.
- Commenter le pourquoi, une contrainte ou un compromis; ne pas paraphraser le code.

## TypeScript et frontières

- Conserver `strict`. Le nouveau code n'utilise pas `any`, `@ts-ignore` ni
  d'assertion non justifiée; utiliser `unknown`, valider puis réduire le type.
- Laisser TypeScript inférer les types locaux évidents. Taper explicitement les
  frontières exportées et les contrats réseau, stockage ou configuration.
- Modéliser les états exclusifs avec des unions discriminées et rendre les branches
  exhaustives.
- Traiter HTTP, variables d'environnement, base, fichiers et services externes
  comme non fiables. Borner tailles, délais, pagination et concurrence.
- Ne jamais dupliquer un contrat partagé dans `apps`; l'ajouter à
  `packages/contracts` lorsqu'il est réellement commun.

## Sécurité, agents et chaîne de livraison

- Classer données, exposition, privilèges et effets externes avant de modifier une
  frontière. Mettre à jour le modèle de menace pour tout nouveau flux, outil,
  fournisseur, skill ou permission.
- Appliquer refus par défaut, moindre privilège et séparation des projets. Un
  `projectId` fourni par le client ne remplace jamais l'autorisation.
- Traiter prompt, document, page web, dépôt, sortie de modèle et skill comme non
  fiables. Valider séparément chaque argument d'outil et chaque effet.
- Un worker suit son `RoleProfile` et ses `ToolGrant`; il ne contacte pas directement
  un autre agent et ne peut augmenter ses permissions.
- Ne placer aucun secret dans le code, frontend, prompt, log, trace, artefact ou KB.
  Préférer des identités de workload courtes aux jetons statiques.
- Épingler et inventorier dépendances, actions, images et skills. Toute release
  produit digest, SBOM, provenance et résultats de contrôle vérifiables.
- Ne jamais désactiver globalement un contrôle pour gagner des lignes ou du temps.
  Une exception est locale, attribuée, datée, testée et assortie d'un contrôle
  compensatoire.
- Suivre la baseline
  [`SECURITY_NIS2.md`](docs/knowledge-base/SECURITY_NIS2.md) et les règles réseau
  [`NETWORK_INFRASTRUCTURE.md`](docs/knowledge-base/NETWORK_INFRASTRUCTURE.md).

## Performance

- Ne pas optimiser sans profil, métrique ou plan de requête montrant le goulot.
- Comparer avant/après dans le build de production, avec les mêmes données et le
  même environnement; consigner médiane et p95 quand c'est pertinent.
- Frontend: éviter état dérivé et mémorisation manuelle sans mesure; charger
  tardivement les routes ou fonctions non critiques.
- API: éviter les lectures et sérialisations inutiles, les boucles de requêtes et la
  concurrence non bornée.
- PostgreSQL: sélectionner seulement les colonnes utiles; justifier un index par une
  requête réelle et `EXPLAIN (ANALYZE, BUFFERS)`.
- Respecter les budgets de
  [`docs/knowledge-base/PERFORMANCE.md`](docs/knowledge-base/PERFORMANCE.md).

## Validation

- Ajouter ou adapter un test de comportement pour toute correction ou règle métier.
- Exécuter au minimum `npm run lint`, `npm test` et `npm run build`.
- Une modification de performance inclut la commande, les données et les résultats
  avant/après; une affirmation sans mesure reste une hypothèse.
- Une modification sensible inclut au moins un test de refus; réseau, IAM, secrets,
  IaC, dépendances et capacités d'agent exécutent leurs contrôles applicables.
- Mettre à jour l'architecture ou le profil projet si une frontière, une commande,
  une version majeure ou un budget change.
