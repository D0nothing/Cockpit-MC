# Préparation du projet pilote Vistory OS

État au 25 août 2026 : **MVP local terminé et démontrable**, **pilote externe non
autorisé sans décision et configuration supplémentaires**.

## Parcours démontré

Un objectif peut aujourd'hui :

1. être créé dans un projet et son namespace PostgreSQL ;
2. être transformé en trois epics, tickets dépendants, spécifications et graphe ;
3. déclencher zéro, une ou deux approbations selon le risque ;
4. refuser l'auto-approbation et les accès inter-projets ;
5. développer les tickets prêts un par un avec dispatch et idempotence durables ;
6. produire un artefact SHA-256 par ticket et atteindre la revue humaine ;
7. rattacher un feedback à une preuve et une mémoire temporaire bornée ;
8. proposer, approuver, versionner, citer et révoquer une connaissance projet ou
   commune sans publication brute ;
9. survivre au redémarrage de l'API et reconstruire son état ;
10. vérifier la chaîne d'audit propre au projet.

Les commandes de preuve sont `npm run lint`, `npm test`, `npm run test:e2e`,
`npm run build`, `npm audit --audit-level=high` et le parcours navigateur documenté
dans [`MVP_ACCEPTANCE.md`](./MVP_ACCEPTANCE.md).

## Portes de validation

| Porte | Critère | État |
| --- | --- | --- |
| P0 — local | web, API, PostgreSQL, migration et seed démarrent sans correction manuelle | validée |
| P1 — domaine | contrats versionnés, graphes valides, états exhaustifs | validée |
| P2 — contrôle humain | matrice 0/1/2, personnes distinctes, expiration et refus | validée localement |
| P3 — isolation | sessions, runs, feedbacks, KB, approbations et audit ne fuient pas entre projets | validée localement et E2E |
| P4 — fournisseur | refus par défaut, cible projet, contexte borné, secret hors read model, reçu explicite | validée hors appel GitHub réel |
| P5 — identité | OAuth GitHub mono-utilisateur, cookie signé/HttpOnly, login allowlisté, expiration et contrôle d'origine | validée en code pour un pilote privé ; OIDC/RBAC reste bloquant avant plusieurs utilisateurs |
| P6 — effets externes | dispatch/reçu idempotents présents ; outbox, egress, retry/circuit breaker et compensation | bloquante avant activation réelle |
| P7 — exploitation | sauvegarde/restauration C0/C1, alertes, rétention et astreinte | bloquante |
| P8 — supply chain | actions et CLI Codex épinglés ; SBOM, provenance, signature et vérification | partielle, bloquante avant release externe |
| P9 — conformité | `ComplianceContext`, propriétaires, risques et revue juridique | bloquante |

## Décisions humaines nécessaires

- choisir le projet pilote, sa personne morale, ses propriétaires et ses données ;
- confirmer `D0nothing` comme compte unique du pilote ; choisir ensuite l'IdP OIDC et la matrice de rôles avant toute ouverture multi-utilisateur ;
- choisir le premier fournisseur externe et son environnement non productif ;
- approuver ses destinations d'egress, scopes, budget, rétention et procédure de
  révocation ;
- fixer RTO/RPO, sauvegarde, restauration et responsables d'alerte ;
- accepter les SLO et le jeu de charge `cockpit-v1` ou les remplacer par des
  mesures réelles.

## Activation progressive

La première activation externe doit se faire sur un dépôt bac à sable sans secret
de production. Elle exige une seule entrée dans `ENABLED_PROVIDERS`, une référence
de secret serveur, un test d'effet nominal, un test de panne, un test inter-projets
et un rollback. Aucun deuxième fournisseur n'est activé avant clôture de cette
preuve.
