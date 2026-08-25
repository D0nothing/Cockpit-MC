# Spécifications fonctionnelles générales — Usine logicielle autonome

| Métadonnée     | Valeur                                                    |
| -------------- | --------------------------------------------------------- |
| Version        | 0.3                                                       |
| Date           | 4 août 2026                                               |
| Statut         | Proposition structurée à valider                          |
| Produit        | Usine logicielle autonome partagée                        |
| Projets servis | Tout projet enregistré et autorisé                        |
| Périmètre      | Fonctionnel, indépendant des fournisseurs et technologies |

## 1. Objet

L'usine transforme un objectif exprimé par un utilisateur en résultats logiciels ou
opérationnels vérifiables. Elle planifie, mobilise des rôles d'agents à la demande,
contrôle leurs permissions, supervise l'exécution, exige les validations adaptées
au risque et conserve les preuves.

La plateforme accepte un nombre quelconque de projets. Elle mutualise orchestration,
rôles, skills et connecteurs, mais isole strictement les données, secrets, mémoires,
artefacts, politiques et historiques de chaque `ProjectContext`.

Ces SFG définissent **ce que le produit doit faire**. Les choix d'implémentation
vivent dans :

- [Architecture cible](TARGET_ARCHITECTURE.md);
- [Interface de pilotage](INTERFACE_SPECIFICATIONS.md);
- [Équipe d'agents invocables](AGENT_ROLES.md);
- [Cybersécurité et NIS2](SECURITY_NIS2.md);
- [Réseau et infrastructure](NETWORK_INFRASTRUCTURE.md);
- [Performance](PERFORMANCE.md).

Les mots **DOIT**, **NE DOIT PAS**, **DEVRAIT** et **PEUT** expriment une obligation,
une interdiction, une recommandation et une option.

## 2. Objectifs produit

1. Réduire le délai entre une intention et un résultat testé.
2. Mobiliser le plus petit ensemble de rôles, skills, modèles et outils nécessaire.
3. Rendre chaque décision, action, coût et preuve compréhensible.
4. Automatiser les travaux réversibles et encadrer les effets sensibles.
5. Apprendre des résultats sans contaminer la Knowledge Base.
6. Garantir isolation, sécurité, résilience, performance et sobriété.
7. Permettre l'évolution du catalogue sans reconstruire l'usine.

## 3. Hors périmètre

L'usine n'a pas pour fonction de :

- fusionner les projets opérés ou leurs responsabilités juridiques;
- remplacer la direction, le Product Owner, le RSSI ou un approbateur habilité;
- permettre à un modèle d'accepter un risque ou d'augmenter ses permissions;
- garantir qu'une sortie probabiliste est correcte sans test ni preuve;
- construire immédiatement tous les rôles ou connecteurs imaginables;
- imposer un fournisseur de modèle, de cloud, de ticketing ou de Knowledge Base;
- transformer un tableur ou un outil externe en source canonique des runs;
- déclarer une conformité NIS2, RGPD ou RGESN sans qualification et audit.

## 4. Acteurs

| Acteur               | Responsabilités fonctionnelles                                                               |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Demandeur            | Choisit le projet, formule l'objectif, répond aux clarifications et consulte le résultat.    |
| Product Owner        | Valide valeur, périmètre, priorité, critères d'acceptation et arbitrages produit.            |
| Approbateur          | Autorise, refuse ou demande la modification d'une action selon son mandat.                   |
| Opérateur plateforme | Supervise capacités, incidents, configurations, reprise et fonctionnement de l'usine.        |
| Security/Compliance  | Qualifie risques et obligations, examine les preuves et prépare les décisions de conformité. |
| Curateur KB/skills   | Examine, publie, déprécie ou révoque connaissances et skills.                                |
| Auditeur             | Consulte les contrôles et preuves de son périmètre sans modifier l'historique.               |
| Worker de rôle       | Exécute une tâche bornée avec un profil, des skills et permissions éphémères.                |
| Système externe      | Fournit ou reçoit une opération via un connecteur contrôlé.                                  |

Une personne peut cumuler plusieurs rôles humains si la séparation des
responsabilités n'est pas requise pour l'action concernée.

## 5. Vocabulaire et priorités

| Concept           | Définition fonctionnelle                                                    |
| ----------------- | --------------------------------------------------------------------------- |
| `ProjectContext`  | Périmètre, politiques, budgets et ressources autorisées d'un projet.        |
| Onboarding projet | Workflow versionné qui valide, approuve, prépare et active un projet.       |
| Session           | Conversation de travail isolée appartenant à un projet.                     |
| `MacroTask`       | Intention structurée, validable avant toute exécution.                      |
| `TaskGraph`       | Graphe acyclique décrivant tâches, dépendances et preuves attendues.        |
| Run               | Exécution durable d'une version de macro-tâche et de graphe.                |
| Tâche / tentative | Travail atomique et chacune de ses exécutions successives.                  |
| `RoleProfile`     | Mission, skills, permissions, interdictions et budgets d'un rôle invocable. |
| Skill             | Capacité versionnée, testée et chargeable par un rôle autorisé.             |
| `ToolGrant`       | Autorisation bornée d'utiliser une opération de connecteur.                 |
| Artefact          | Résultat versionné et attribuable produit par une tâche.                    |
| Porte humaine     | Décision obligatoire avant la poursuite d'une action sensible.              |
| DoR               | Conditions nécessaires pour commencer un travail.                           |
| DoD               | Conditions et preuves nécessaires pour déclarer le travail terminé.         |
| Knowledge Base    | Connaissances permanentes publiées par un workflow gouverné.                |

### Priorités

- **P0** : nécessaire à la première tranche fonctionnelle de bout en bout.
- **P1** : nécessaire avant une utilisation réelle avec modèles et connecteurs.
- **P2** : extension après preuve d'un besoin, d'une qualité et d'un coût acceptables.

## 6. Exigences fonctionnelles

### 6.1 Projets et périmètres

| ID          | Priorité | Exigence                                                                                                         | Critère fonctionnel                                                   |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| SFG-PRJ-001 | P0       | Toute session **DOIT** appartenir à un projet choisi explicitement.                                              | Une session sans projet est refusée.                                  |
| SFG-PRJ-002 | P0       | L'usine **DOIT** disposer d'un registre des projets et de leur statut.                                           | Deux fixtures arbitraires peuvent être enregistrées séparément.       |
| SFG-PRJ-003 | P0       | Toute tâche, run, décision, mémoire, artefact et preuve **DOIT** conserver son `projectId`.                      | Une recherche sans filtre projet ne retourne aucun contenu privé.     |
| SFG-PRJ-004 | P0       | L'accès inter-projets **DOIT** être refusé par défaut.                                                           | Les tests croisés échouent dans les deux sens.                        |
| SFG-PRJ-005 | P1       | Chaque projet **DOIT** définir rôles, skills, connecteurs, fournisseurs, budgets et portes autorisés.            | La politique effective est consultable et versionnée.                 |
| SFG-PRJ-006 | P1       | Chaque projet **DOIT** référencer son contexte juridique et de conformité sans le partager avec un autre projet. | Les exports d'audit sont séparés par `legalEntityId`.                 |
| SFG-PRJ-007 | P1       | Un projet **PEUT** restreindre la plateforme commune sans modifier son cœur.                                     | La restriction d'un projet n'affecte aucun autre projet.              |
| SFG-PRJ-008 | P1       | Un projet **DOIT** pouvoir être enregistré par configuration, sans fork ni modification du cœur de l'usine.      | Une nouvelle fixture devient opérable après validation de son profil. |

### 6.2 Identités et autorisations

| ID          | Priorité | Exigence                                                                             | Critère fonctionnel                                 |
| ----------- | -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| SFG-IAM-001 | P0       | Un acteur humain **DOIT** être identifié avant toute lecture ou action non publique. | Toute décision possède un acteur attribuable.       |
| SFG-IAM-002 | P0       | L'autorisation **DOIT** prendre en compte acteur, projet, ressource et opération.    | Un rôle valide sur un autre projet reste refusé.    |
| SFG-IAM-003 | P0       | Le demandeur d'une approbation **NE DOIT PAS** l'auto-approuver.                     | Le système bloque la même identité des deux côtés.  |
| SFG-IAM-004 | P1       | Les accès sensibles **DOIVENT** être bornés et révocables.                           | Une identité expirée ou révoquée ne peut plus agir. |
| SFG-IAM-005 | P1       | Les droits **DOIVENT** pouvoir être revus par projet, rôle et connecteur.            | Un export présente droits effectifs et écarts.      |
| SFG-IAM-006 | P1       | Les actions critiques **PEUVENT** exiger deux approbateurs distincts.                | Une seule décision ne débloque pas l'action.        |

### 6.3 Entrées et sessions

| ID          | Priorité | Exigence                                                                                                                  | Critère fonctionnel                                                    |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| SFG-SES-001 | P0       | Le demandeur **DOIT** pouvoir créer une session et formuler un objectif en langage naturel.                               | La session et l'objectif sont enregistrés.                             |
| SFG-SES-002 | P0       | L'usine **DOIT** conserver le contexte utile de la session dans son périmètre.                                            | Une reprise retrouve décisions et travaux en cours.                    |
| SFG-SES-003 | P0       | Le demandeur **DOIT** pouvoir reprendre, mettre en pause ou annuler une session.                                          | Chaque commande mène à un état explicite.                              |
| SFG-SES-004 | P0       | Une ambiguïté bloquante **DOIT** produire une clarification, pas une exécution spéculative.                               | Aucun worker n'est lancé avant résolution ou acceptation du risque.    |
| SFG-SES-005 | P0       | Le statut de la session **DOIT** être visible et compréhensible.                                                          | L'interface distingue planification, attente, exécution, revue et fin. |
| SFG-SES-006 | P1       | L'usine **DOIT** pouvoir normaliser des entrées conversation, API, webhook, CLI ou message via des adaptateurs autorisés. | Origine, identifiant externe et contenu sont traçables.                |
| SFG-SES-007 | P1       | Une entrée rejouée **NE DOIT PAS** créer deux traitements identiques.                                                     | Le même identifiant externe produit une seule macro-tâche.             |

### 6.4 Compréhension et macro-tâche

| ID          | Priorité | Exigence                                                                                                  | Critère fonctionnel                                            |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| SFG-MAC-001 | P0       | Le thinking mode **DOIT** transformer l'objectif en `MacroTask` sans effet externe.                       | Aucune action métier n'est constatée pendant l'analyse.        |
| SFG-MAC-002 | P0       | La macro-tâche **DOIT** décrire objectif, résultat, contraintes, non-objectifs, livrables et acceptation. | Une donnée obligatoire absente bloque la préparation.          |
| SFG-MAC-003 | P0       | La macro-tâche **DOIT** classer risque, données, effets externes et validations nécessaires.              | Le niveau et la justification sont consultables.               |
| SFG-MAC-004 | P0       | La macro-tâche **DOIT** définir des budgets de temps, coût et contexte.                                   | Un budget absent utilise une limite projet explicite.          |
| SFG-MAC-005 | P0       | Le demandeur ou Product Owner **DOIT** pouvoir corriger ou refuser la proposition.                        | Une révision crée une nouvelle version liée à l'ancienne.      |
| SFG-MAC-006 | P1       | L'estimation **DEVRAIT** indiquer hypothèses, incertitudes et capacités requises.                         | Une estimation ne se présente pas comme un engagement certain. |

### 6.5 Planification et graphe de tâches

| ID          | Priorité | Exigence                                                                                             | Critère fonctionnel                                        |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| SFG-PLN-001 | P0       | Le coordinateur **DOIT** produire un graphe acyclique de tâches.                                     | Un cycle est refusé avant dispatch.                        |
| SFG-PLN-002 | P0       | Chaque tâche **DOIT** définir capacité, dépendances, DoR, DoD, budget, retry et artefacts attendus.  | Un nœud incomplet ne peut devenir `ready`.                 |
| SFG-PLN-003 | P0       | Les tâches indépendantes **DOIVENT** pouvoir être exécutées en parallèle dans la limite de capacité. | Le test montre concurrence sans violation des dépendances. |
| SFG-PLN-004 | P0       | L'orchestrateur **DOIT** posséder l'état durable du run.                                             | Un redémarrage ne perd ni état ni décision.                |
| SFG-PLN-005 | P0       | Le coordinateur **NE DOIT PAS** marquer une tâche complète.                                          | Seule la validation du DoD permet `completed`.             |
| SFG-PLN-006 | P1       | Le plan **DOIT** pouvoir être amendé après refus, échec ou découverte, avec provenance.              | Les versions et raisons restent consultables.              |
| SFG-PLN-007 | P1       | Le plan **DEVRAIT** minimiser rôles, tâches, dépendances et appels externes.                         | Une alternative plus complexe exige une justification.     |

### 6.6 Rôles et workers

| ID          | Priorité | Exigence                                                                                                   | Critère fonctionnel                                                        |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| SFG-ROL-001 | P0       | L'usine **DOIT** résoudre le plus petit profil de rôle compatible avec la tâche.                           | Un rôle plus permissif n'est pas choisi sans besoin.                       |
| SFG-ROL-002 | P0       | Un worker **DOIT** être créé à la demande et expirer après sa tâche.                                       | Il ne peut plus agir après expiration.                                     |
| SFG-ROL-003 | P0       | Les permissions effectives **DOIVENT** être l'intersection rôle, projet, tâche et risque.                  | Une permission absente d'un niveau reste refusée.                          |
| SFG-ROL-004 | P0       | Un worker **NE DOIT PAS** contacter directement un autre worker.                                           | Toute transmission possède événement ou artefact orchestré.                |
| SFG-ROL-005 | P0       | Toute sortie **DOIT** respecter un schéma et fournir les preuves définies au DoD.                          | Une sortie invalide passe en échec ou revue.                               |
| SFG-ROL-006 | P1       | Le catalogue **DOIT** versionner mission, skills, outils, interdictions, budgets et portes de chaque rôle. | Deux versions restent distinguables et reproductibles.                     |
| SFG-ROL-007 | P1       | Le modèle utilisé **DOIT** être sélectionné par politique sans fallback silencieux.                        | Le changement de modèle est visible et autorisé.                           |
| SFG-ROL-008 | P1       | Un rôle nouveau **DOIT** être évalué avant publication.                                                    | Tests nominal, refus, sécurité, interruption, qualité et coût disponibles. |

### 6.7 Capacités des rôles

| ID          | Priorité | Exigence                                                                                                                                   | Critère fonctionnel                                                                |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| SFG-CAP-001 | P1       | Engineering **DOIT** pouvoir analyser, modifier, tester, reviewer et documenter un changement autorisé.                                    | Le résultat est une PR draft ou un artefact vérifiable, jamais un merge implicite. |
| SFG-CAP-002 | P1       | Design **DOIT** pouvoir produire ou vérifier parcours, composants, accessibilité et budgets frontend.                                      | La référence au design system et les états sont présents.                          |
| SFG-CAP-003 | P1       | Product **DOIT** pouvoir préparer spécifications, non-objectifs, acceptation et arbitrages proposés.                                       | Engineering ne reçoit pas une feature sans DoR.                                    |
| SFG-CAP-004 | P1       | Platform/SRE **DOIT** pouvoir préparer livraison, diagnostiquer incident, exécuter runbook et proposer ou déclencher un rollback autorisé. | Production reste soumise à sa politique d'approbation.                             |
| SFG-CAP-005 | P1       | Security/Compliance **DOIT** pouvoir analyser risques, contrôles, vulnérabilités et preuves.                                               | Un blocage est appliqué par une règle déterministe traçable.                       |
| SFG-CAP-006 | P2       | Support **DOIT** pouvoir classifier, rechercher la KB, reproduire, escalader et préparer un brouillon.                                     | Aucun envoi ou engagement non autorisé.                                            |
| SFG-CAP-007 | P2       | Sales **DOIT** pouvoir qualifier, mettre à jour le CRM et préparer proposition ou passage de relais.                                       | Prix, remise, promesse et message restent contrôlés.                               |

### 6.8 Skills

| ID          | Priorité | Exigence                                                                                          | Critère fonctionnel                               |
| ----------- | -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| SFG-SKL-001 | P1       | Un skill **DOIT** posséder identité, version, propriétaire, provenance, intégrité et permissions. | Un manifeste incomplet est refusé.                |
| SFG-SKL-002 | P1       | Le worker **DOIT** recevoir uniquement les skills requis par sa tâche.                            | Un skill supplémentaire n'est pas accessible.     |
| SFG-SKL-003 | P1       | Un skill altéré, révoqué ou non approuvé **NE DOIT PAS** être chargé.                             | Le chargement échoue et produit une alerte.       |
| SFG-SKL-004 | P1       | Deux versions **DOIVENT** pouvoir être rejouées sans ambiguïté.                                   | La version et le digest figurent dans le run.     |
| SFG-SKL-005 | P1       | Une lacune observée **PEUT** produire une proposition de skill.                                   | La proposition n'est pas publiée automatiquement. |
| SFG-SKL-006 | P1       | Un skill projet **NE DOIT PAS** devenir commun sans promotion explicite.                          | Aucun autre projet ne le voit avant décision.     |
| SFG-SKL-007 | P2       | L'efficacité d'un skill **DEVRAIT** être suivie par qualité, coût, délai, reprises et incidents.  | Une version dégradée peut être dépréciée.         |

### 6.9 Connecteurs et effets externes

| ID          | Priorité | Exigence                                                                                                                      | Critère fonctionnel                                             |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| SFG-CON-001 | P1       | Toute intégration externe **DOIT** passer par le Connector Gateway.                                                           | Aucun worker ne possède un accès direct non déclaré.            |
| SFG-CON-002 | P1       | Lecture, brouillon, création, modification, envoi, suppression et administration **DOIVENT** être des permissions distinctes. | Autoriser `draft` n'autorise pas `send`.                        |
| SFG-CON-003 | P1       | Chaque opération **DOIT** vérifier projet, ressource, identité et `ToolGrant`.                                                | Un appel hors portée est refusé et audité.                      |
| SFG-CON-004 | P1       | Un effet rejouable **DOIT** être idempotent ou dédupliqué.                                                                    | Un retry ne crée pas deux tickets, messages ou déploiements.    |
| SFG-CON-005 | P1       | Une action externe **DOIT** produire un reçu ou un état explicite.                                                            | Le run distingue succès confirmé, inconnu, refus et échec.      |
| SFG-CON-006 | P1       | Une indisponibilité externe **NE DOIT PAS** déclencher de fallback non autorisé.                                              | Le run passe en attente, mode dégradé ou échec explicable.      |
| SFG-CON-007 | P1       | Les messages externes **DOIVENT** être des brouillons par défaut.                                                             | L'envoi nécessite la politique ou l'approbation attendue.       |
| SFG-CON-008 | P2       | Un projet **PEUT** activer GitHub, ticketing, KB, email, CRM, design, CI/CD ou monitoring sans modifier le domaine.           | Deux adaptateurs d'une même capacité passent une suite commune. |

### 6.10 Exécution et contrôle

| ID          | Priorité | Exigence                                                                                 | Critère fonctionnel                                      |
| ----------- | -------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| SFG-EXE-001 | P0       | L'ordonnanceur **DOIT** distribuer seulement une tâche `ready` sous capacité disponible. | Aucun dépassement de capacité pendant le test.           |
| SFG-EXE-002 | P0       | Un run **DOIT** pouvoir être mis en pause, repris ou annulé.                             | L'état et les effets déjà réalisés restent explicites.   |
| SFG-EXE-003 | P0       | Un retry **DOIT** créer une tentative liée sans réécrire l'historique.                   | Les tentatives sont distinguables.                       |
| SFG-EXE-004 | P0       | La perte d'un worker **DOIT** être détectée.                                             | Le lease expire et mène à reprise, retry ou échec.       |
| SFG-EXE-005 | P0       | Les budgets **DOIVENT** arrêter ou suspendre le travail selon la politique.              | Aucun dépassement silencieux de coût, temps ou contexte. |
| SFG-EXE-006 | P0       | Une tâche **NE DOIT PAS** être déclarée complète sans DoD vérifié.                       | Les preuves manquantes maintiennent la revue.            |
| SFG-EXE-007 | P1       | Une action sensible **DOIT** s'arrêter sur sa porte humaine.                             | Aucun appel externe n'a lieu avant décision.             |
| SFG-EXE-008 | P1       | Le système **DOIT** appliquer backpressure plutôt que lancer un travail non borné.       | Une surcharge augmente la file sans cascade incontrôlée. |

### 6.11 Contrôle humain

| ID          | Priorité | Exigence                                                                                                      | Critère fonctionnel                                                         |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| SFG-HUM-001 | P0       | L'approbateur **DOIT** disposer de l'objectif, du risque, des changements, preuves, coûts et effets attendus. | Une demande incomplète ne peut être approuvée.                              |
| SFG-HUM-002 | P0       | Il **DOIT** pouvoir approuver, refuser, demander modification ou laisser expirer.                             | Les quatre sorties produisent un état explicite.                            |
| SFG-HUM-003 | P0       | La décision **DOIT** être attribuée, horodatée, motivée et immuable.                                          | L'historique montre décision et version examinée.                           |
| SFG-HUM-004 | P0       | Un refus **DOIT** empêcher l'effet et permettre une révision.                                                 | Aucun contournement par retry ou autre rôle.                                |
| SFG-HUM-005 | P1       | La matrice de risque **DOIT** déterminer les portes sans être codée dans l'interface.                         | Une mise à jour de politique modifie le comportement sans nouveau frontend. |
| SFG-HUM-006 | P1       | Une urgence **PEUT** utiliser une politique préapprouvée, notamment pour un rollback borné.                   | Les seuils, portée et décision préalable sont prouvés.                      |

### 6.12 Artefacts et revue

| ID          | Priorité | Exigence                                                                                    | Critère fonctionnel                                        |
| ----------- | -------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| SFG-ART-001 | P0       | Toute tâche **DOIT** publier ses résultats comme artefacts attribuables.                    | Projet, run, tâche, rôle, version et digest sont connus.   |
| SFG-ART-002 | P0       | Un artefact **DOIT** conserver ses versions sans écraser une preuve antérieure.             | L'historique reste consultable.                            |
| SFG-ART-003 | P0       | La revue **DOIT** agréger tests, contrôles, avis agents et décisions humaines.              | Le résultat explique acceptation ou refus.                 |
| SFG-ART-004 | P1       | Un artefact livrable **DOIT** présenter provenance, SBOM et contrôles applicables.          | Un artefact incomplet ne peut être promu.                  |
| SFG-ART-005 | P1       | Le demandeur **DOIT** pouvoir consulter résultat, écarts, limites et actions non réalisées. | Le rapport ne confond pas proposition et action exécutée.  |
| SFG-ART-006 | P1       | Une release **DOIT** relier code, tests, approbation, artefact et configuration.            | Le dossier peut être exporté sans reconstruction manuelle. |

### 6.13 Suivi et audit

| ID          | Priorité | Exigence                                                                                        | Critère fonctionnel                            |
| ----------- | -------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| SFG-MON-001 | P0       | Le cockpit **DOIT** afficher sessions, runs, tâches, files, capacités, coûts et alertes.        | Les données proviennent de l'état réel.        |
| SFG-MON-002 | P0       | L'utilisateur **DOIT** pouvoir filtrer par projet, statut, rôle et période.                     | Aucun filtre ne révèle un projet non autorisé. |
| SFG-MON-003 | P0       | Une chronologie **DOIT** relier objectif, décisions, tentatives, appels, artefacts et résultat. | Un `correlationId` reconstruit le run.         |
| SFG-MON-004 | P1       | Le système **DOIT** distinguer temps de file, modèle, outil, humain et stockage.                | Les principales causes de délai sont visibles. |
| SFG-MON-005 | P1       | Une alerte **DOIT** avoir sévérité, propriétaire, état et runbook.                              | Une alerte orpheline est signalée.             |
| SFG-MON-006 | P1       | L'auditeur **DOIT** pouvoir exporter les preuves de son périmètre.                              | L'export est filtré, daté et vérifiable.       |
| SFG-MON-007 | P1       | Un tableur ou dashboard externe **PEUT** recevoir un export, jamais devenir canonique.          | Sa perte n'efface pas l'audit.                 |

### 6.14 Mémoire, Knowledge Base et feedback

| ID         | Priorité | Exigence                                                                                                 | Critère fonctionnel                                  |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| SFG-KB-001 | P1       | La mémoire de session **DOIT** être temporaire, bornée et isolée.                                        | TTL, quota et suppression sont testés.               |
| SFG-KB-002 | P1       | Une sortie brute d'agent **NE DOIT PAS** enrichir directement la KB permanente.                          | Seul le workflow de promotion peut publier.          |
| SFG-KB-003 | P1       | Un feedback **DOIT** référencer résultat, auteur, type et preuve.                                        | Un feedback orphelin est refusé.                     |
| SFG-KB-004 | P1       | Une promotion **DOIT** définir portée projet ou commune, provenance, version, approbation et révocation. | L'entrée peut être retirée sans perdre l'historique. |
| SFG-KB-005 | P1       | Une promotion commune **DOIT** être plus stricte qu'une promotion projet.                                | Aucun contenu privé n'est partagé implicitement.     |
| SFG-KB-006 | P1       | La recherche **DOIT** respecter projet, droits, fraîcheur et budget de contexte.                         | Chaque élément injecté possède une citation.         |
| SFG-KB-007 | P1       | Une connaissance obsolète ou contredite **DOIT** pouvoir être dépréciée.                                 | Le moteur ne la présente plus comme active.          |
| SFG-KB-008 | P2       | L'usine **DEVRAIT** mesurer l'effet d'une connaissance promue sur qualité et reprises.                   | Une entrée nuisible peut être identifiée.            |

### 6.15 Sécurité, conformité et continuité

| ID          | Priorité | Exigence                                                                                               | Critère fonctionnel                                           |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| SFG-RSK-001 | P1       | L'usine **DOIT** inventorier actifs, flux, dépendances, données et propriétaires de son périmètre.     | L'inventaire et ses écarts sont exportables.                  |
| SFG-RSK-002 | P1       | Chaque contrôle applicable **DOIT** relier exigence, implémentation, test, preuve, exception et revue. | La matrice ReCyF est navigable.                               |
| SFG-RSK-003 | P1       | Le système **DOIT** gérer vulnérabilités, priorités, échéances et exceptions expirables.               | Un résultat élevé sans propriétaire est signalé.              |
| SFG-RSK-004 | P1       | Un incident **DOIT** conserver `T0`, faits, impact, décisions, preuves et communications.              | La chronologie est exportable.                                |
| SFG-RSK-005 | P1       | Si NIS2 s'applique, le workflow **DOIT** surveiller 24 h, 72 h et un mois sans notifier seul.          | Les échéances et validations sont visibles.                   |
| SFG-RSK-006 | P1       | Chaque service critique **DOIT** posséder criticité, mode dégradé, RTO, RPO et restauration testée.    | La dernière restauration et ses résultats sont consultables.  |
| SFG-RSK-007 | P1       | Une crise **DOIT** pouvoir activer rôles, contacts et canaux hors bande.                               | Un exercice produit chronologie et actions.                   |
| SFG-RSK-008 | P1       | Le rôle Security/Compliance **NE DOIT PAS** être la frontière de sécurité unique.                      | Les refus restent effectifs si aucun modèle n'est disponible. |

### 6.16 Performance, coût et sobriété

| ID          | Priorité | Exigence                                                                                     | Critère fonctionnel                                                   |
| ----------- | -------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| SFG-NFR-001 | P1       | Chaque type de macro-tâche **DOIT** posséder des budgets mesurables.                         | Latence, coût, tokens et ressources sont comparables.                 |
| SFG-NFR-002 | P1       | Le routeur **DEVRAIT** choisir le plus petit modèle atteignant qualité et sécurité requises. | Une montée en gamme possède une raison observable.                    |
| SFG-NFR-003 | P1       | Le système **DOIT** borner contexte, payload, résultats, concurrence et retries.             | Le dépassement est refusé ou suspendu explicitement.                  |
| SFG-NFR-004 | P1       | L'unité fonctionnelle **DOIT** permettre une comparaison avant/après.                        | Calcul, mémoire, stockage, réseau, tokens et résultat sont consignés. |
| SFG-NFR-005 | P1       | Une optimisation **NE DOIT PAS** désactiver silencieusement sécurité ou preuve.              | Les benchmarks conservent les contrôles actifs.                       |
| SFG-NFR-006 | P2       | L'usine **DEVRAIT** réutiliser un résultat déterministe sûr avant un nouvel appel coûteux.   | Cache, fraîcheur, isolation et invalidation sont explicites.          |

### 6.17 Interface de pilotage

| ID         | Priorité | Exigence                                                                                                          | Critère fonctionnel                                                     |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| SFG-UI-001 | P0       | Le cockpit **DOIT** présenter uniquement les vues, projets et commandes autorisés à l'identité courante.          | Une navigation ou URL forgée ne révèle aucune ressource interdite.      |
| SFG-UI-002 | P0       | Le demandeur **DOIT** pouvoir choisir un projet actif, créer une session et soumettre un objectif.                | Le brouillon n'exécute aucun worker; l'analyse produit une macro-tâche. |
| SFG-UI-003 | P0       | Chaque vue métier **DOIT** rendre visibles portée projet, état réel, fraîcheur et prochaine action.               | Une donnée inconnue ou périmée n'est jamais présentée comme saine.      |
| SFG-UI-004 | P0       | Le détail d'un run **DOIT** relier graphe, chronologie, budgets, artefacts, preuves et commandes permises.        | La version serveur et le `correlationId` permettent de vérifier la vue. |
| SFG-UI-005 | P0       | Pause, reprise, annulation et retry **DOIVENT** être des commandes idempotentes suivies après reconnexion.        | Un double clic ou rechargement ne double pas l'effet.                   |
| SFG-UI-006 | P0       | Toute vue asynchrone **DOIT** couvrir chargement, vide, partiel, erreur, interdit, périmé et déconnecté.          | Les tests couvrent chaque état sans faux succès.                        |
| SFG-UI-007 | P1       | Les mises à jour d'un run **DOIVENT** être reprises après perte du flux sans doublon ni trou silencieux.          | Le client reprend depuis un événement ou recharge le read model.        |
| SFG-UI-008 | P1       | Le cockpit **DOIT** respecter WCAG 2.2 AA et rester utilisable au clavier, lecteur d'écran et zoom à 200 %.       | Les parcours critiques passent tests automatiques et revue manuelle.    |
| SFG-UI-009 | P1       | Listes, recherche, filtres et chronologies **DOIVENT** être bornés, paginés et partageables par URL.              | Aucun écran ne charge un historique illimité.                           |
| SFG-UI-010 | P1       | Une action sensible **DOIT** présenter cible, diff, risque, effets, réversibilité, coût et approbations requises. | La confirmation porte sur une version figée et revalidée côté serveur.  |

### 6.18 Onboarding des projets

| ID          | Priorité | Exigence                                                                                                             | Critère fonctionnel                                                           |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| SFG-ONB-001 | P0       | Un opérateur autorisé **DOIT** pouvoir créer un brouillon de projet sans effet externe.                              | Le brouillon possède un `projectId` candidat, une version et un propriétaire. |
| SFG-ONB-002 | P0       | Le brouillon **DOIT** être sauvegardé, repris et modifié avec contrôle de concurrence.                               | Un conflit de version exige une résolution explicite.                         |
| SFG-ONB-003 | P0       | La validation **DOIT** être déterministe et couvrir identité, ressources, droits, conformité, budgets et résilience. | Le rapport sépare erreurs bloquantes, avertissements et informations.         |
| SFG-ONB-004 | P0       | Une activation **DOIT** figer la version examinée et obtenir les approbations imposées par le risque.                | Modifier le brouillon invalide les approbations précédentes.                  |
| SFG-ONB-005 | P0       | Le provisioning **DOIT** être idempotent, borné et compensable lorsque possible.                                     | Un retry ne duplique aucune ressource et signale les effets non compensés.    |
| SFG-ONB-006 | P0       | Le projet **NE DOIT PAS** devenir actif avant les tests de droits, isolation, egress, portes et scénario nominal.    | Un seul contrôle bloquant en échec empêche `active`.                          |
| SFG-ONB-007 | P0       | L'échec **DOIT** produire un rapport attribuable et permettre correction puis reprise.                               | Ressources créées, compensées et restantes sont identifiées.                  |
| SFG-ONB-008 | P1       | L'assistant **DOIT** couvrir le profil générique sans créer de code ou service propre au projet.                     | Un nouveau projet est onboardé par configuration uniquement.                  |
| SFG-ONB-009 | P1       | Toute modification d'un projet actif **DOIT** créer une version, un diff et les validations applicables.             | Les runs passés conservent leur configuration d'origine.                      |
| SFG-ONB-010 | P1       | Suspension, réactivation et archivage **DOIVENT** être autorisés, auditables et sans réécriture d'historique.        | Un projet archivé ne peut lancer un nouveau run.                              |

## 7. Règles métier transverses

| ID     | Règle                                                                              |
| ------ | ---------------------------------------------------------------------------------- |
| RG-001 | Le comportement testé et l'état exécutable priment sur toute description.          |
| RG-002 | `projectId` est obligatoire mais ne constitue jamais à lui seul une autorisation.  |
| RG-003 | Toute donnée ou instruction externe est non fiable jusqu'à validation.             |
| RG-004 | Une tâche n'est complète que si son DoD et ses preuves sont satisfaits.            |
| RG-005 | Un rôle ou skill ne peut augmenter aucune permission.                              |
| RG-006 | Un agent ne peut ni s'auto-approuver, ni accepter un risque.                       |
| RG-007 | Les rôles communiquent par événements et artefacts orchestrés.                     |
| RG-008 | Toute opération externe sensible est idempotente, auditée et soumise à sa porte.   |
| RG-009 | Un refus, une expiration, une annulation ou un blocage sont des résultats normaux. |
| RG-010 | La KB permanente et le catalogue de skills évoluent uniquement par promotion.      |
| RG-011 | Un connecteur ou fournisseur externe ne possède jamais l'état canonique du run.    |
| RG-012 | L'autonomie augmente seulement après mesure, test et décision de risque.           |
| RG-013 | Le cockpit présente l'état canonique mais ne le possède pas.                       |

## 8. États fonctionnels

### Session

```text
created → planning → awaiting_approval → ready → running → review → completed
```

Sorties transverses : `blocked`, `failed`, `cancelled`.

### Tâche

```text
draft → blocked | ready → dispatched → running → review → completed
```

Sorties transverses : `failed`, `cancelled`. Un retry crée une nouvelle tentative.

### Approbation

```text
requested → approved | rejected | changes_requested | expired
```

### Entrée KB ou skill

```text
proposed → under_review → published → deprecated | revoked
```

### Onboarding projet

```text
draft → validating → awaiting_approval → provisioning → verifying → active
```

Sorties contrôlées : `failed`, `suspended`, `archived`. `archived` est terminal.

Chaque transition invalide est refusée et auditée.

## 9. Parcours fonctionnels de référence

### PF-01 — Construire une fonctionnalité

**Préconditions :** projet actif, demandeur autorisé, budgets disponibles.

1. Le demandeur choisit le projet et formule l'objectif.
2. L'usine clarifie puis produit la macro-tâche.
3. Le Product Owner valide valeur, périmètre et acceptation si requis.
4. Le coordinateur produit le graphe.
5. Engineering et Design travaillent selon les dépendances.
6. Security/Compliance exécute les contrôles applicables.
7. Les tests et preuves alimentent la revue.
8. Une PR draft ou un artefact est soumis; aucun merge implicite.
9. Le demandeur reçoit résultat, écarts, coût et limites.

**Postcondition :** résultat attribuable, testable et sans effet externe non
autorisé.

### PF-02 — Livrer avec contrôle

1. Engineering publie un artefact vérifié.
2. Platform/SRE prépare la stratégie et le rollback.
3. Security/Compliance produit un résultat déterministe de contrôle.
4. L'approbateur examine preuves, impact et changement.
5. Le Connector Gateway exécute seulement après autorisation.
6. Le déploiement est surveillé et arrêté ou rollbacké selon la politique.
7. Le run conserve configuration, résultat et décision.

### PF-03 — Traiter un incident

1. Une alerte ou un signal Support ouvre l'incident et fixe `T0`.
2. Platform/SRE qualifie impact et mode dégradé.
3. Security/Compliance préserve les preuves et évalue la menace.
4. L'orchestrateur mobilise les rôles requis et active les portes de crise.
5. Les échéances réglementaires applicables sont surveillées.
6. La restauration est vérifiée contre RTO/RPO.
7. Un post-mortem sans blâme produit des actions suivies.

### PF-04 — Promouvoir une connaissance

1. Un feedback ou résultat propose une entrée.
2. Le système attache source, preuve, projet et version.
3. Le curateur vérifie exactitude, sensibilité et duplication.
4. La portée projet ou commune est décidée.
5. L'entrée publiée devient recherchable avec citation.
6. Une contradiction future peut la déprécier ou la révoquer.

### PF-05 — Faire évoluer un skill

1. Une lacune mesurée crée une proposition.
2. Le propriétaire définit mission, permissions et interdictions.
3. Les tests évaluent qualité, sécurité, coût et interruption.
4. Le curateur publie une version immuable.
5. Un projet l'autorise explicitement.
6. Les métriques peuvent conduire à promotion, restriction ou dépréciation.

### PF-06 — Exécuter deux projets simultanément

1. Deux sessions rattachées à deux projets distincts sont créées.
2. Elles utilisent le même orchestrateur, catalogue et workers disponibles.
3. Les politiques résolvent des permissions distinctes.
4. Les runs s'exécutent en concurrence sous capacité.
5. Aucun cache, mémoire, secret, artefact, log ou recherche ne traverse le projet.
6. Un skill commun peut être utilisé avec des contextes séparés.

### PF-07 — Onboarder un projet

1. Un opérateur crée et sauvegarde un brouillon depuis le modèle générique.
2. L'assistant collecte responsabilités, ressources, données, capacités, contrôles et
   budgets.
3. La validation déterministe produit erreurs, avertissements, diff et plan de
   provisioning sans effet externe.
4. La version est figée puis transmise aux approbateurs requis.
5. Le provisioning idempotent prépare uniquement les ressources autorisées.
6. Les tests de refus, d'isolation, d'egress, de portes et le scénario nominal sont
   exécutés.
7. Le projet devient `active` ou passe en `failed` avec un rapport et un chemin de
   reprise.

### PF-08 — Superviser et contrôler un run

1. L'utilisateur ouvre un run depuis une liste filtrée à son périmètre.
2. Le cockpit charge le read model puis reprend le flux d'événements.
3. Graphe, chronologie, capacité, coûts, artefacts et preuves expliquent l'état.
4. Une coupure rend la fraîcheur visible et déclenche reprise ou rechargement.
5. L'utilisateur émet une commande permise avec confirmation proportionnée au
   risque.
6. Le serveur revalide droits, état et version, puis renvoie un `commandId`.
7. Le cockpit suit la commande jusqu'à son état terminal sans fabriquer de succès.

## 10. Critères d'acceptation majeurs

```gherkin
Scénario: isolation entre projets
  Étant donné une session du projet alpha et une session du projet bêta
  Quand le worker du projet alpha recherche une ressource du projet bêta
  Alors l'accès est refusé et audité
  Et aucune métadonnée privée du projet bêta n'est révélée
```

```gherkin
Scénario: porte humaine bloquante
  Étant donné un déploiement de production en attente
  Quand aucun approbateur habilité n'a approuvé la version courante
  Alors aucun appel de déploiement n'est effectué
  Et le run reste awaiting_approval
```

```gherkin
Scénario: permission de brouillon
  Étant donné un rôle Support autorisé à créer un brouillon
  Quand il demande l'envoi du message
  Alors le Connector Gateway refuse send
  Et conserve le brouillon et la tentative dans l'audit
```

```gherkin
Scénario: reprise après perte d'un worker
  Étant donné une tâche en cours avec une clé d'idempotence
  Quand le heartbeat expire
  Alors l'orchestrateur crée une nouvelle tentative autorisée
  Et aucun effet externe déjà confirmé n'est dupliqué
```

```gherkin
Scénario: promotion contrôlée
  Étant donné une sortie brute d'agent
  Quand aucune décision de promotion n'existe
  Alors la sortie reste dans les artefacts de session
  Et n'apparaît pas dans la Knowledge Base permanente
```

```gherkin
Scénario: contrôle de sécurité indépendant du modèle
  Étant donné une release qui échoue sur un contrôle bloquant
  Quand le rôle Security/Compliance est indisponible
  Alors le moteur de politique bloque toujours la release
  Et expose la preuve du contrôle en échec
```

## 11. Périmètre des versions

### MVP fonctionnel P0

- registre avec deux projets de test isolés;
- création/reprise/annulation de session;
- objectif → clarification → macro-tâche;
- approbation humaine et refus;
- graphe validé, ordonnanceur borné et worker simulé;
- états durables, retry, idempotence et reprise;
- monitoring et chronologie;
- cockpit minimal : sélection du projet, nouvelle session, liste et détail d'un run;
- brouillon et validation sans effet externe d'un profil projet;
- artefacts et DoD vérifiables;
- scénario de bout en bout sans fournisseur réel.

### Version exploitable P1

- premier fournisseur réel et rôle Engineering;
- registre des rôles, skills et Connector Gateway;
- rôles Product, Design, Platform/SRE et Security/Compliance;
- mémoire temporaire, feedback et promotion KB;
- identités, réseau, observabilité, supply chain et preuves;
- continuité, incident, vulnérabilités et sobriété;
- onboarding d'un projet réel par le contrat générique.
- assistant complet d'onboarding, activation et supervision temps réel;

### Extensions P2

- Support et Sales connectés à des workflows réels;
- fournisseurs supplémentaires justifiés par mesure;
- routage avancé coût/qualité;
- automatisation accrue après historique de preuves;
- nouveaux rôles seulement depuis un besoin observé.

## 12. Traçabilité vers le backlog

| Domaine SFG                  | Tâches principales                                     |
| ---------------------------- | ------------------------------------------------------ |
| Projets et isolation         | ARCH-002, ARCH-003, PRJ-001, PRJ-501, PRJ-502, E2E-503 |
| Interface et supervision     | UI-106, UI-107, UI-506, UI-507, E2E-508                |
| Onboarding                   | PRJ-501, PRJ-502, UI-506, E2E-508                      |
| Sessions et contrôle humain  | CTL-101, CTL-102, SEC-001                              |
| Macro-tâche et planification | EXE-101, EXE-102, EXE-103, EXE-205                     |
| Dispatch et reprise          | EXE-104, EXE-105, CTL-103, E2E-101                     |
| Modèles, rôles et skills     | EXE-201 à EXE-204, ROL-207, SKL-305                    |
| Connecteurs                  | CON-208                                                |
| Mémoire et KB                | MEM-301, MEM-302, KB-303, KB-304                       |
| Sécurité et conformité       | SEC-002, GOV-401, SEC-402, SEC-404, VUL-405, CMP-408   |
| Réseau et exploitation       | NET-403, OPS-401, PERF-402, REL-403, IR-406, ECO-407   |
| Cas d'usage cible            | E2E-504, E2E-505                                       |

Une exigence fonctionnelle ne peut être déclarée couverte que si la tâche associée
produit une preuve consultable.

## 13. Points à valider

1. Risques et actions exigeant une ou deux approbations.
2. Premier rôle réel après Engineering.
3. Premier connecteur réel et opérations autorisées.
4. Politique initiale de déploiement et rollback.
5. Fournisseur de modèle initial et seuils de fallback.
6. Source canonique de la KB et moteur de recherche.
7. RTO, RPO, rétention et budgets par projet/service.
8. Qualification NIS2 séparée pour chaque service et personne morale concernés.
9. Canaux d'entrée à ouvrir après la conversation.
10. Niveau d'autonomie autorisé pour messages et mises à jour métier.

Ces décisions modifient la configuration ou les priorités, pas les invariants de
l'usine commune.
