# Équipe d'agents invocables

Source historique : `JARVIS_Architecture.docx`, rédigé comme base d'architecture
multi-agents et fourni par le propriétaire le 27 juillet 2026. Statut :
**proposition réconciliée** avec l'architecture cible, la baseline NIS2 et le modèle
multi-projets.

## Décision

L'usine propose une équipe commune de **profils de rôle invocables à la demande**.
Un rôle n'est ni un processus permanent, ni une personne morale, ni un fournisseur
de modèle. Pour une tâche donnée, l'ordonnanceur instancie un worker éphémère avec :

- un `RoleProfile` versionné;
- les skills strictement nécessaires;
- un modèle autorisé par la politique;
- une identité, des outils, des données et un egress bornés;
- des budgets de temps, coût, contexte et ressources;
- les portes humaines et preuves exigées par le risque.

Tous les projets enregistrés utilisent le même catalogue. Chaque `ProjectContext` peut
autoriser, restreindre ou épingler un rôle et ses skills sans créer une seconde
usine.

## Réconciliation de JARVIS

| Base JARVIS                   | Architecture retenue                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| JARVIS, agent principal       | Session Manager + thinking mode + coordinateur + orchestrateur. Ces services planifient et supervisent; ils ne réalisent aucune action métier. |
| Agent Engineering             | Rôle Engineering, décomposable en backend, frontend, design, review, test et documentation selon le graphe.                                    |
| Agent DevOps                  | Rôle Platform/SRE pour livraison, capacité, observabilité, incident, rollback et runbooks.                                                     |
| Agent Support                 | Rôle Support pour triage, recherche KB, reproduction, escalade et brouillons.                                                                  |
| Agent Produit                 | Rôle Product pour discovery, spécifications, critères d'acceptation, roadmap et feedback.                                                      |
| Agent Sales                   | Rôle Sales pour qualification, CRM, proposition et passage de relais, avec sorties externes contrôlées.                                        |
| Agent Sécurité                | Rôle Security/Compliance pour analyser, tester et préparer les preuves. Le moteur de politique, et non le modèle, bloque les actions.          |
| Connecteurs transversaux      | Connector Gateway et adaptateurs versionnés; ce ne sont pas des agents.                                                                        |
| Google Sheets comme journal   | Export de reporting facultatif. L'event store et l'audit protégé restent les sources de vérité.                                                |
| Tokens et clés statiques      | OAuth délégué ou identité de workload courte, secrets référencés et rotation.                                                                  |
| Messages directs inter-agents | Événements et artefacts via l'orchestrateur; aucun réseau social d'agents implicite.                                                           |

Cette séparation évite qu'un modèle soit à la fois planificateur, exécutant, arbitre,
contrôle de sécurité et source de vérité.

## Catalogue initial

### Engineering

**Mission :** produire ou examiner un changement logiciel vérifiable.

Capacités candidates :

- analyser une spécification et le code existant;
- implémenter backend, frontend ou design sans dupliquer les contrats;
- reviewer un diff, ajouter des commentaires et identifier les tests manquants;
- analyser CI, couverture et tests instables;
- créer une PR draft, un ticket ou une mise à jour documentaire;
- mesurer puis réduire dette, complexité ou performance.

Par défaut, Engineering ne merge pas, ne déploie pas en production, ne modifie pas
les permissions et ne supprime aucun dépôt ou ticket. Une création de branche ou PR
reste limitée aux dépôts du projet.

### Platform/SRE

**Mission :** livrer et exploiter les services dans leurs SLO, RTO et RPO.

Capacités candidates :

- vérifier les prérequis et préparer un déploiement progressif;
- surveiller métriques, journaux, traces et budgets d'erreur;
- qualifier un incident, corréler avec les changements et exécuter un runbook;
- déclencher un rollback lorsque sa politique et ses seuils ont été préapprouvés;
- analyser saturation, files, capacité et right-sizing;
- produire chronologie, post-mortem et actions de fiabilisation.

Le déploiement de production exige initialement une approbation humaine. Un rollback
automatique n'est autorisé que s'il est borné, idempotent, testé et couvert par une
politique préapprouvée; il ne doit pas attendre un humain si cette attente aggrave
un incident.

### Security/Compliance

**Mission :** évaluer les risques, vérifier les contrôles et préparer les décisions
ou preuves.

Capacités candidates :

- threat modeling et cas d'abus;
- SAST, SCA, secret, IaC, image, SBOM et provenance;
- triage de vulnérabilité par exploitation, exposition et impact;
- revue des accès, configurations, flux et fournisseurs;
- cartographie ReCyF/NIS2, RGPD et exigences contractuelles applicables;
- assistance à l'incident, conservation des preuves et rapports.

Ce rôle peut produire un résultat `deny` signé et ouvrir un blocage dans le moteur
de politique. Il ne peut pas modifier seul une politique, accepter le risque,
notifier une autorité, s'attribuer un accès ou exécuter une action destructive.

### Product

**Mission :** transformer un besoin en résultat produit testable et priorisé.

Capacités candidates :

- consolider demandes, feedbacks et signaux d'usage;
- produire user stories, non-objectifs et critères d'acceptation;
- identifier dépendances, risques, données et maquettes;
- valider la Definition of Ready avant Engineering;
- proposer roadmap et arbitrage impact/effort.

Une priorité, une roadmap ou une acceptation générée par l'agent reste une
proposition tant que la politique produit exige un propriétaire humain.

### Design

**Mission :** rendre l'usage cohérent, accessible, rapide et sobre.

Capacités candidates :

- traduire un flux et des contraintes en parcours ou interface;
- réutiliser le design system avant de créer un composant;
- vérifier responsive, accessibilité, états d'erreur et budget frontend;
- produire maquette, tokens ou spécification de composant.

Il peut lire les références design approuvées. La modification d'un design system
de production ou d'une source de marque requiert une permission distincte.

### Support

**Mission :** qualifier une demande client et préparer une résolution traçable.

Capacités candidates :

- classifier catégorie, impact, urgence et sentiment sans en déduire seul une
  sévérité réglementaire;
- rechercher dans la KB avec citation et score;
- produire des étapes de reproduction et ouvrir une escalade Engineering;
- détecter un motif récurrent et proposer une investigation Platform/SRE;
- préparer un brouillon de réponse ou une mise à jour de FAQ.

Le défaut est **brouillon uniquement**. Envoi, fermeture définitive, remboursement
ou engagement contractuel suivent une porte définie par le projet.

### Sales

**Mission :** qualifier une opportunité et maintenir un dossier commercial fiable.

Capacités candidates :

- extraire des signaux de qualification et mettre à jour un CRM;
- préparer proposition, compte rendu et prochaine action;
- transmettre une demande produit avec son contexte, sans imposer sa priorité;
- produire un forecast accompagné de ses hypothèses.

Un prix, une remise, une promesse produit, un contrat ou un message externe n'est
jamais engagé automatiquement sans règle et approbation explicites.

## Connector Gateway

Les connecteurs encapsulent authentification, pagination, rate limit, retry,
idempotence, validation, redaction et audit pour un service externe. Les exemples
du document JARVIS — GitHub, Jira/Atlassian, Linear, Notion, Outlook, Intercom,
HubSpot, Figma, CI/CD, monitoring et Google Sheets — sont des adaptateurs possibles,
pas des dépendances obligatoires.

Règles :

- le domaine dépend d'un contrat de capacité, jamais du SDK fournisseur;
- chaque opération possède un identifiant stable, une classification de risque et
  un schéma d'entrée/sortie;
- lecture, brouillon, écriture, envoi, suppression et administration sont des
  permissions distinctes;
- le connecteur réautorise `projectId`, ressource et opération;
- webhook ou abonnement est préféré au polling; un polling de secours utilise
  curseur, déduplication, plafond et backoff;
- les contenus récupérés sont non fiables et ne deviennent pas des instructions;
- le log externe ou tableur est un export, jamais l'audit canonique;
- aucune clé personnelle ou JSON de service n'est distribué à un worker.

## Contrat `RoleProfile`

Un profil minimal contient :

```text
roleId, version, owner, status
mission, acceptedTaskTypes, forbiddenOutcomes
skillRefs[] et modelPolicyRef
toolGrants[]: connector, operation, resources, dataClasses
networkPolicyRef et secretRefs[]
requiredInputs, outputSchemas, evidenceRequirements
approvalPolicyRef et separationOfDuties
time, cost, token, concurrency et resource budgets
retention, telemetry et incident contacts
```

Le profil est signé ou vérifié par digest. Le worker ne peut ni le modifier, ni
charger un skill absent, ni appeler une opération hors `toolGrants`.

## Invocation

1. Le coordinateur produit un nœud `TaskGraph` avec capacité et résultat attendus.
2. Le registre résout le plus petit `RoleProfile` compatible avec le projet.
3. Le moteur de politique intersecte profil, projet, tâche, identité humaine et
   risque. Une intersection vide bloque la tâche.
4. L'ordonnanceur crée un worker éphémère et lui remet un jeton de capacité court.
5. Le worker charge uniquement les skills et le contexte nécessaires.
6. Chaque appel d'outil est revalidé par le Connector Gateway.
7. Le résultat est validé contre son schéma, scanné, puis publié comme artefact.
8. L'orchestrateur décide de la suite depuis le graphe; un agent n'invoque pas
   directement un autre agent.
9. Le worker et ses secrets expirent; métriques, décision et preuves sont conservées
   selon la politique.

Les rôles peuvent travailler en parallèle si le DAG l'autorise. Ils ne partagent
pas de mémoire mutable implicite : seulement événements versionnés et artefacts
attribuables.

## Matrice d'action par défaut

| Action                                      | Défaut                              | Condition d'extension                                     |
| ------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Lire une ressource projet autorisée         | Automatique                         | Minimisation des données et audit.                        |
| Rechercher dans la KB                       | Automatique                         | Filtre projet/droits, citations et budget.                |
| Créer brouillon, rapport ou artefact        | Automatique                         | Schéma, scan et provenance.                               |
| Créer ticket ou PR draft                    | Automatique                         | Scope projet, idempotence et lien vers la source.         |
| Commenter une PR                            | Automatique                         | Identité agent visible et contenu borné.                  |
| Modifier un statut ou une roadmap           | Selon politique projet              | Transition valide et propriétaire connu.                  |
| Déployer en staging                         | Selon politique de release          | Artefact vérifié et rollback disponible.                  |
| Déployer en production                      | Approbation humaine initiale        | Automatisation seulement après risque accepté et preuves. |
| Rollback de production                      | Politique préapprouvée ou humain    | Seuils objectifs, portée bornée et test.                  |
| Envoyer email/message externe               | Brouillon uniquement                | Workflow et identité d'envoi explicitement autorisés.     |
| Bloquer une release                         | Automatique par moteur de politique | Règle déterministe et preuve du contrôle.                 |
| Supprimer ou modifier IAM                   | Interdit aux rôles généraux         | Workflow dédié, double approbation et journal renforcé.   |
| Accepter un risque ou notifier une autorité | Humain habilité uniquement          | Aucune délégation au modèle.                              |

Cette matrice est le défaut commun. Un projet peut la rendre plus restrictive. Une
extension exige une décision de risque versionnée et testée.

## Cycle d'évolution

Un rôle ou skill nouveau naît d'un besoin observé, pas d'une taxonomie théorique :

1. lacune mesurée sur une tâche réelle;
2. définition de mission, sorties et opérations interdites;
3. profil minimal et jeu d'évaluation;
4. tests nominal, refus, injection, exfiltration, coût et interruption;
5. revue humaine et publication versionnée;
6. mesure d'efficacité, incidents, coût et taux de reprise;
7. restriction, dépréciation ou promotion dans le catalogue commun.

Finance, juridique, RH ou tout autre rôle mentionné indirectement restent hors
catalogue tant qu'un workflow réel, un propriétaire et une matrice d'autorisation ne
sont pas définis.
