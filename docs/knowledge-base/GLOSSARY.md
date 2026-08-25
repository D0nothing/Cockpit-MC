# Glossaire et ownership de Vistory OS

Statut : décidé pour les contrats P0. Date de revue : 4 août 2026.

## Nommage du produit

**Vistory OS** est le nom du produit et du dépôt. « Usine logicielle » décrit sa
fonction. Les noms techniques `@software-factory/*` restent des identifiants de
packages internes et ne constituent pas un second produit.

## Vocabulaire canonique

| Terme | Définition contractuelle |
| --- | --- |
| `ProjectContext` | Configuration versionnée qui borne ressources, politiques, budgets et droits d'un projet. |
| Session | Conversation de travail durable, isolée par `projectId` et `sessionId`. |
| `MacroTask` | Intention structurée et validable produite avant toute exécution. |
| Tâche | Nœud immuable d'un `TaskGraph`; un retry crée une nouvelle tentative et ne réécrit pas le nœud. |
| Run | Exécution durable d'une version de macro-tâche et de graphe. |
| Instance de rôle | Worker éphémère créé pour une tâche depuis un `RoleProfile`; ce n'est ni un service permanent ni un agent autonome. |
| Skill | Capacité versionnée, épinglée et explicitement autorisée par le projet et le rôle. |
| `ToolGrant` | Autorisation bornée portant sur une opération de connecteur et une ressource. |
| Artefact | Résultat immuable, attribuable et adressé par hash produit par une tâche. |
| Feedback | Évaluation structurée rattachée à une session et, si applicable, à un run ou un artefact. |
| Mémoire de session | Contexte temporaire borné par `projectId` et `sessionId`; jamais une Knowledge Base permanente. |
| Knowledge Base | Connaissance permanente publiée uniquement après promotion gouvernée. |

`BM` est un ancien libellé de schéma pour la mémoire de session. Il n'apparaît dans
aucun contrat public. `EB` n'a pas de définition validée : son usage est interdit
dans les contrats et le code jusqu'à une décision documentée.

## Ownership des composants internes

Un composant possède un seul owner responsable. Un reviewer obligatoire peut être
distinct sans partager cet ownership.

| Composant | Owner responsable | Reviewer obligatoire |
| --- | --- | --- |
| Contrats et protocole d'événements | Architecture plateforme | Security/Compliance |
| Registre projets et onboarding | Platform Engineering | Security/Compliance |
| Session Manager et API de commande | Control Plane | Architecture plateforme |
| Human Control et matrice d'approbation | Security/Compliance | Product |
| Bridge, orchestrateur et scheduler | Execution Platform | Platform Engineering |
| Coordinateur et `TaskGraph` | Product Engineering | Execution Platform |
| Registre de rôles et workers | Agent Platform | Security/Compliance |
| Bibliothèque et loader de skills | Agent Platform | Architecture plateforme |
| Connector Gateway | Platform Engineering | Security/Compliance |
| Mémoire de session et Knowledge Base | Knowledge Platform | Security/Compliance |
| Cockpit web et read models | Product Engineering | Security/Compliance |
| Audit, observabilité et reprise | Platform/SRE | Security/Compliance |

Les décisions métier restent humaines : un owner technique ne devient pas
approbateur d'une action par cette seule qualité.
