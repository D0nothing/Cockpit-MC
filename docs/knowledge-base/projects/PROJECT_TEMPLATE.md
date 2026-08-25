# Modèle de profil projet

Ce modèle instancie un `ProjectContext` sans créer une variante de l'usine. Copier
ce fichier sous un identifiant neutre et immuable, puis remplacer chaque valeur
`À confirmer`. Un profil incomplet reste en statut `draft` et ne peut déclencher
aucun effet externe.

## 1. Identité et gouvernance

| Champ                                               | Valeur      |
| --------------------------------------------------- | ----------- |
| `projectId` immuable                                | À confirmer |
| `profileVersion`                                    | `1`         |
| `onboardingId`                                      | Généré      |
| Nom d'affichage                                     | À confirmer |
| Statut (`draft`, `active`, `suspended`, `archived`) | `draft`     |
| `legalEntityId`                                     | À confirmer |
| Product Owner                                       | À confirmer |
| Responsable technique                               | À confirmer |
| Responsable sécurité/risque                         | À confirmer |
| Date et approbateur de l'activation                 | À confirmer |

Le nom d'affichage peut changer; `projectId` ne change jamais et figure sur chaque
session, run, tâche, décision, artefact, preuve et entrée de mémoire.

## 2. Objectifs et limites

- objectif produit : À confirmer;
- utilisateurs et valeur attendue : À confirmer;
- livrables autorisés : À confirmer;
- hors périmètre : À confirmer;
- critères d'arrêt ou d'archivage : À confirmer.

## 3. Ressources autorisées

| Ressource        | Identifiant | Environnement | Opérations permises | Propriétaire |
| ---------------- | ----------- | ------------- | ------------------- | ------------ |
| Dépôt SCM        | À confirmer | À confirmer   | `read` par défaut   | À confirmer  |
| CI/CD            | À confirmer | À confirmer   | À confirmer         | À confirmer  |
| Ticketing        | À confirmer | À confirmer   | À confirmer         | À confirmer  |
| Knowledge Base   | À confirmer | À confirmer   | À confirmer         | À confirmer  |
| Autre connecteur | À confirmer | À confirmer   | À confirmer         | À confirmer  |

Aucun connecteur, dépôt, compte, secret ou environnement n'est hérité implicitement
d'un autre projet. Les opérations `draft`, `send`, `delete`, `deploy` et `admin`
restent des permissions distinctes.

## 4. Données, sécurité et conformité

- classes de données et localisation autorisée : À confirmer;
- durées de conservation et règles de suppression : À confirmer;
- secrets et identités de workload, référencés sans valeur en clair : À confirmer;
- statut NIS2 (`pending_review`, `in_scope`, `out_of_scope`) et date de revue :
  `pending_review`;
- services et systèmes concernés : À confirmer;
- autorités, CSIRT et contacts de crise applicables : À confirmer;
- fournisseurs critiques et sous-traitants : À confirmer;
- matrice ReCyF, risques, exceptions et dossier de preuve : À confirmer.

Le profil adopte les baselines [cybersécurité/NIS2](../SECURITY_NIS2.md) et
[réseau/infrastructure](../NETWORK_INFRASTRUCTURE.md). Il peut les renforcer, jamais
les affaiblir sans exception locale, attribuée, datée, testée et compensée.

## 5. Capacités de l'usine

| Élément                    | Valeur autorisée |
| -------------------------- | ---------------- |
| `RoleProfile`              | À confirmer      |
| Skills et versions/digests | À confirmer      |
| Fournisseurs et modèles    | À confirmer      |
| Portes humaines            | À confirmer      |
| Classes de risque          | À confirmer      |
| Mode dégradé               | À confirmer      |

Le profil effectif d'un worker est l'intersection des droits du rôle, du projet, de
la tâche et de la politique de risque. Un projet ne peut ajouter une permission que
la plateforme n'accorde pas.

## 6. Budgets et objectifs de service

| Budget                         | Valeur      | Mesure et alerte |
| ------------------------------ | ----------- | ---------------- |
| Latence médiane/p95            | À confirmer | À confirmer      |
| Coût par unité fonctionnelle   | À confirmer | À confirmer      |
| Tokens et taille de contexte   | À confirmer | À confirmer      |
| Concurrence et taille de file  | À confirmer | À confirmer      |
| CPU, mémoire, stockage, réseau | À confirmer | À confirmer      |
| RTO / RPO                      | À confirmer | À confirmer      |
| Disponibilité et taux d'erreur | À confirmer | À confirmer      |

Les mesures suivent [PERFORMANCE.md](../PERFORMANCE.md) avec les contrôles de
sécurité actifs.

## 7. Commandes et preuves vérifiées

Documenter uniquement des faits reproductibles :

- commande d'installation : À confirmer;
- commandes lint, test, build et analyse sécurité : À confirmer;
- scénario représentatif et données de benchmark : À confirmer;
- dernière exécution, versions et résultats : À confirmer;
- écarts, dettes et propriétaires : À confirmer.

## 8. Checklist d'activation

- [ ] identité, propriétaires et `legalEntityId` validés;
- [ ] dépôts, environnements, données et flux inventoriés;
- [ ] autorisations minimales et tests de refus croisés réussis;
- [ ] secrets, identités de workload et egress configurés;
- [ ] rôles, skills, connecteurs et modèles épinglés et approuvés;
- [ ] portes humaines et séparation des responsabilités testées;
- [ ] qualification NIS2 et matrice de contrôles reliées aux preuves;
- [ ] budgets, SLO, RTO, RPO, sauvegarde et restauration définis;
- [ ] SBOM, provenance, signature et politique de déploiement actives;
- [ ] run nominal, annulation, retry, incident et mode dégradé vérifiés;
- [ ] approbation d'activation attribuable enregistrée.

Une fois activé, le projet est une entrée du registre. Aucun service, agent,
orchestrateur ou catalogue de skills propre au projet n'est créé.
