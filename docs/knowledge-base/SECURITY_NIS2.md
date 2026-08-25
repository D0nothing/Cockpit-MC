# Baseline cybersécurité et NIS2

État de la baseline : **décidée pour l'usine**, à implémenter et à auditer.
Référentiels vérifiés le 24 juillet 2026.

## Portée et prudence juridique

L'usine logicielle applique une baseline unique à tous les projets enregistrés. Elle
produit cependant des preuves, des registres de risques et des dossiers d'incident
séparés par `projectId` et `legalEntityId`. L'assujettissement NIS2 et la
qualification d'entité essentielle ou importante s'évaluent pour chaque personne
morale, secteur et service; ils ne se déduisent ni du dépôt ni de la plateforme
commune.

Au 24 juillet 2026, l'ANSSI présente toujours la transposition française comme en
cours. Elle recommande aux futures entités concernées de commencer leur
sécurisation et publie ReCyF v2.5 comme document de travail. Cette page est donc une
baseline d'ingénierie et de préparation à la conformité, pas une attestation ni un
avis juridique.

Chaque `ProjectContext` **DOIT** référencer un `ComplianceContext` contenant au
minimum :

- `legalEntityId`, pays, secteur, taille et services fournis;
- statut NIS2 `unknown | out_of_scope | important | essential | pending_review`;
- systèmes et services inclus dans le périmètre, propriétaires et dépendances;
- autorités/CSIRT et contacts de crise à confirmer;
- classification des données, durées de conservation et localisation;
- fournisseurs critiques, niveaux de service, RTO, RPO et tolérance au risque;
- dates de la dernière revue juridique, de risque et de direction.

`unknown` ou `pending_review` interdit toute affirmation de conformité, mais
n'autorise pas à réduire la baseline technique.

## Référentiels retenus

| Besoin                 | Référentiel de travail | Usage dans l'usine                                             |
| ---------------------- | ---------------------- | -------------------------------------------------------------- |
| France / NIS2          | ANSSI ReCyF v2.5       | Structure principale des 20 objectifs et des preuves.          |
| Gouvernance du risque  | NIST CSF 2.0           | Organiser Govern, Identify, Protect, Detect, Respond, Recover. |
| Développement sécurisé | NIST SSDF 1.1          | Intégrer la sécurité à tout le cycle de développement.         |
| Systèmes d'IA          | NIST SP 800-218A       | Compléter SSDF pour modèles, données et systèmes d'IA.         |
| Sécurité applicative   | OWASP ASVS 5.0.0       | Exigences testables, référencées avec leur version.            |
| Chaîne de livraison    | SLSA 1.2               | Provenance et garanties croissantes des builds.                |
| Réseau et identités    | NIST SP 800-207        | Zero Trust centré sur ressources, identités et politiques.     |
| Cyber-résilience       | NIST SP 800-160 v2 r1  | Anticiper, résister, récupérer et s'adapter.                   |
| Vulnérabilités actives | CISA KEV               | Prioriser les failles dont l'exploitation est avérée.          |

Le règlement d'exécution (UE) 2024/2690 et le guide technique ENISA associé sont
ajoutés au profil seulement si le service ou l'entité appartient à leur champ
d'application. Ils ne sont pas imposés aveuglément à toute l'usine.

## Principes non négociables

1. La direction approuve le cadre de risque, les responsables et les risques
   résiduels; les agents ne peuvent pas accepter un risque à sa place.
2. Toute ressource, identité, dépendance, donnée, flux et preuve possède un
   propriétaire, une classification et un cycle de vie.
3. Aucun accès n'est accordé par confiance dans le réseau. Chaque requête est
   authentifiée, autorisée au moindre privilège et limitée dans le temps.
4. Les plans de contrôle, d'exécution, de données, d'administration et
   d'observabilité sont segmentés; l'accès inter-projets est refusé par défaut.
5. Une entrée externe, un document récupéré et une sortie de modèle sont des
   données non fiables, jamais des instructions privilégiées.
6. Les secrets ne vivent ni dans le code, ni dans les prompts, logs, artefacts,
   images, variables frontend ou Knowledge Base.
7. Les composants et dépendances sont minimaux, épinglés, inventoriés, vérifiés et
   supprimés dès qu'ils ne sont plus nécessaires.
8. Les builds sont reproductibles, traçables et séparés des déploiements; un
   artefact est identifié par son digest, pas par un tag mutable.
9. Les journaux de sécurité sont corrélés, horodatés, protégés contre l'altération
   et expurgés des données inutiles ou sensibles.
10. Chaque service critique a un mode dégradé, des sauvegardes restaurables, un RTO,
    un RPO et un exercice de reprise.
11. Une mesure de sécurité ne peut être retirée pour raccourcir le code ou gagner
    de la latence sans décision de risque, mesure avant/après et contrôle
    compensatoire daté.
12. Toute exception est attribuée, justifiée, bornée dans le temps et révocable.

## Matrice ReCyF de l'usine

La colonne « preuve minimale » décrit ce que l'usine doit pouvoir produire sans
reconstruction manuelle après coup.

| Objectif ReCyF                              | Baseline commune                                                                                                                   | Preuve minimale                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Inventorier les SI                       | Inventaire continu des services, dépôts, domaines, données, logiciels, équipements, identités, flux, dépendances et propriétaires. | Export daté, couverture, écarts et historique.                 |
| 2. Cadre de gouvernance                     | Politique approuvée par la direction, rôles RACI, tolérance au risque, revues et dérogations.                                      | Décisions signées, comptes rendus et registre des risques.     |
| 3. Maîtriser l'écosystème                   | Qualification des fournisseurs, clauses de sécurité, accès limités, réversibilité et notification d'incident.                      | Registre tiers, évaluations, contrats et tests de sortie.      |
| 4. Sécurité des RH                          | Vérification proportionnée, engagement de confidentialité, onboarding/offboarding et formation régulière.                          | Traces de formation et révocation des accès à la sortie.       |
| 5. Maîtriser les SI                         | Propriétaire, classification, maintenance, vulnérabilités et fin de vie pour chaque actif.                                         | Fiche actif, versions, risques et date de retrait.             |
| 6. Accès physique                           | Centres de données et postes d'administration soumis à des contrôles proportionnés, délégués contractuellement si hébergés.        | Attestations fournisseur, règles locaux/postes et revues.      |
| 7. Architecture sécurisée                   | Segmentation, chiffrement, réduction de surface, flux autorisés explicites et analyse de menace.                                   | Diagrammes, matrice de flux, tests de cloisonnement.           |
| 8. Accès à distance                         | ZTNA/VPN approuvé, MFA résistant au phishing pour accès sensibles, terminaux conformes et sessions bornées.                        | Politique, configuration et journal des accès.                 |
| 9. Protection contre les codes malveillants | Contrôles adaptés aux postes, serveurs, artefacts, pièces jointes et contenus récupérés par les agents.                            | Couverture des contrôles et alertes traitées.                  |
| 10. Identités et accès                      | SSO humain, MFA, RBAC/ABAC, identités de workload courtes, revues et révocation.                                                   | Matrice des droits, campagnes de revue et tests de révocation. |
| 11. Maîtriser l'administration              | Comptes nominatifs, élévation juste-à-temps, séparation des rôles, aucune administration depuis un poste banal.                    | Sessions d'administration et approbations corrélées.           |
| 12. Incidents                               | Procédure de qualification, confinement, preuve, communication et notification réglementaire.                                      | Chronologie, décisions, artefacts forensiques et rapport.      |
| 13. Continuité et reprise                   | Services classés, modes dégradés, sauvegardes isolées et restaurations testées.                                                    | Résultats de restauration, RTO/RPO observés et écarts.         |
| 14. Crise cyber                             | Cellule, suppléants, canaux hors bande, critères d'activation et communications préparées.                                         | Annuaire scellé, playbooks et comptes rendus d'exercice.       |
| 15. Exercices et formation                  | Exercices techniques et de direction, simulations d'incident et tests de récupération.                                             | Scénarios, participants, enseignements et actions fermées.     |
| 16. Approche par les risques                | Menaces, vraisemblance, impacts, dépendances et traitement revus à chaque changement significatif.                                 | Registre versionné et acceptations par le bon niveau.          |
| 17. Auditer la sécurité                     | Autoévaluations, contrôles indépendants proportionnés et suivi des écarts.                                                         | Plan d'audit, constats, responsables et échéances.             |
| 18. Durcissement                            | Baselines de configuration en code, services minimaux, patching, dérive détectée et exception explicite.                           | Résultat de conformité, diff de configuration et dérogations.  |
| 19. Ressources d'administration dédiées     | Plan d'administration séparé, postes ou environnements dédiés et secrets distincts.                                                | Inventaire, règles réseau et tests d'accès négatifs.           |
| 20. Supervision de sécurité                 | Télémétrie utile, détections testées, alertes attribuées, synchronisation temporelle et rétention.                                 | Couverture, temps de détection/traitement et tests d'alertes.  |

## Chaîne de développement et de livraison

### Avant le code

- Classer le changement, les données, les effets externes et l'exposition réseau.
- Mettre à jour le modèle de menace pour une nouvelle frontière, permission,
  dépendance, capacité d'agent ou donnée sensible.
- Définir les cas d'abus, le rollback, les preuves attendues et le budget de
  performance.
- Choisir la solution la plus petite qui conserve ces garanties.

### Pull request

Le pipeline **DOIT** refuser une contribution qui échoue sur un contrôle applicable :

- format, lint, types, tests unitaires, intégration et tests de refus;
- détection de secret et recherche de dépendances vulnérables;
- analyse statique ciblée, contrôle IaC et image lorsque ces artefacts changent;
- exigences OWASP ASVS 5.0.0 versionnées pour une frontière web;
- test de séparation `projectId`, de permissions et d'egress pour un composant de
  l'usine;
- test prompt injection/exfiltration pour une capacité d'agent concernée.

Un faux positif est supprimé par règle ciblée et justifiée, jamais par désactivation
globale.

### Build et artefacts

- Dépendances et actions CI sont épinglées; les runners sont éphémères et sans
  secret persistant.
- Le build produit un SBOM machine-readable, une provenance, les résultats de
  contrôle et le digest de chaque artefact.
- Les artefacts sont signés par une identité de workload; la vérification précède
  tout déploiement.
- La cible initiale est SLSA Build L2; L3 devient obligatoire pour les artefacts
  critiques lorsque la plateforme de build le permet. Une cible n'est déclarée
  atteinte qu'après évaluation des exigences SLSA 1.2.
- Les images d'exécution sont minimales, non privilégiées, en lecture seule lorsque
  possible et sans outil d'administration inutile.

### Déploiement

- Séparation entre auteur, approbateur et identité de déploiement.
- Infrastructure et politiques sont versionnées; aucune correction durable n'est
  faite seulement à la main en production.
- Déploiement progressif, sonde fonctionnelle et de sécurité, arrêt automatique sur
  dépassement du budget d'erreur, puis rollback testé.
- La release conserve commit, SBOM, provenance, résultats, approbation, artefact et
  configuration effective dans un même dossier de preuve.

## Sécurité propre aux agents et aux skills

- Le plan de contrôle décide des permissions; un modèle ou un skill ne peut jamais
  les augmenter.
- Le [profil de rôle](AGENT_ROLES.md) est intersecté avec le projet, la tâche et le
  risque; une permission absente de cette intersection reste interdite.
- Chaque run utilise un sandbox éphémère, un système de fichiers borné, des quotas
  CPU/mémoire/temps/tokens et un egress explicitement autorisé.
- Les outils mutateurs, la production, les secrets, les paiements, l'envoi de
  messages et les suppressions exigent une politique explicite et, selon le risque,
  une approbation humaine.
- Instructions système, politique, contenu récupéré et sortie du modèle restent
  séparés. Une page, un ticket, un dépôt ou une entrée de KB ne devient jamais une
  instruction privilégiée.
- Les arguments d'outil sont validés indépendamment du modèle. Les chemins,
  domaines, identités et cibles destructrices sont résolus avant l'action.
- Un skill est immuable par version, signé ou vérifié par digest, associé à une
  provenance, des permissions, un propriétaire, des tests et une date de revue.
- La mémoire persistante n'accepte qu'une promotion contrôlée; données sensibles,
  secrets et instructions non fiables sont filtrés.
- Les modèles, prompts, jeux d'évaluation et politiques sont versionnés pour rendre
  une décision reproductible.
- Un rôle Security/Compliance analyse et produit des preuves; les refus, blocages et
  portes sont appliqués par un moteur déterministe. Le modèle ne constitue jamais
  à lui seul une frontière de sécurité.

## Sécurité du cockpit et de l'onboarding

Le cockpit et l'assistant d'onboarding sont des frontières sensibles : ils créent
des commandes et préparent des permissions, sans jamais devenir eux-mêmes une
source d'autorité.

| Menace                            | Contrôles minimaux                                                                                             | Preuve attendue                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Accès direct à un autre projet    | Autorisation serveur par identité, mandat, ressource et opération; réponse sans métadonnée privée.             | Tests IDOR dans les deux sens et événements `policy_deny`.     |
| Élévation par champ de formulaire | Schéma fermé, rejet des champs inconnus, intersection avec la politique plateforme.                            | Tests de mass assignment et profil sur-privilégié refusé.      |
| Rejeu ou double commande          | `Idempotency-Key`, version attendue, machine à états et reçu durable.                                          | Double clic ou retry produit un seul effet.                    |
| Décision sur un état périmé       | Version ou `ETag`, revalidation au serveur et expiration des approbations.                                     | Une modification invalide la décision précédente.              |
| XSS ou contenu actif              | Encodage de sortie, sanitation bornée, CSP stricte, pièces jointes isolées et aucun HTML arbitraire.           | Tests XSS, CSP et rendu de contenu hostile.                    |
| CSRF ou vol de session            | Cookies sécurisés si utilisés, protection CSRF, MFA/step-up selon risque, rotation et révocation.              | Tests origine, session expirée et révocation.                  |
| SSRF via connecteur               | Destinations autorisées, résolution et egress contrôlés, aucune URL arbitraire depuis le navigateur.           | Tests IP privée, redirection, DNS rebinding et domaine refusé. |
| Exposition de secret              | Références opaques uniquement, saisie via canal dédié, redaction et interdiction des secrets dans read models. | Scan navigateur, logs, traces, erreurs et exports.             |
| Provisioning partiel              | Plan figé, étapes idempotentes, compensation, inventaire des effets restants.                                  | Injection de panne à chaque étape et rapport de reprise.       |
| Déni de service                   | Limites de taille, pagination, rate limit, quotas, timeout, backpressure et flux reprenable.                   | Tests de charge et dépassements refusés proprement.            |

Une activation de projet produit un dossier de preuve reliant profil, version,
approbations, plan, identités, tests négatifs, ressources créées, exceptions et
résultat final. La qualification NIS2 reste attachée au service et à la personne
morale; l'interface ne déclare jamais seule la conformité.

## Vulnérabilités

Le score seul ne décide pas de la priorité. L'usine combine exploitabilité connue
(dont CISA KEV), exposition, privilèges, données, impact métier et présence d'une
mesure compensatoire.

Objectifs internes initiaux, plus stricts si un texte, un contrat ou la menace
l'exige :

| Situation                                          | Confinement ou mitigation | Correction cible |
| -------------------------------------------------- | ------------------------: | ---------------: |
| Exploitation avérée ou critique exposée à Internet |                      24 h |             72 h |
| Critique non exposée                               |                      72 h |          7 jours |
| Haute                                              |                   7 jours |         30 jours |
| Moyenne                                            |                  30 jours |         90 jours |

Une échéance dépassée crée un risque accepté par un propriétaire humain, avec
contrôle compensatoire et date d'expiration. La politique couvre code, dépendances,
images, systèmes, IaC, modèles et skills. Un canal de divulgation coordonnée et un
processus de triage doivent être publiés avant ouverture externe.

## Incidents et délais NIS2

L'horloge part du moment où l'entité prend connaissance d'un incident significatif.
Si NIS2 est applicable, l'article 23 prévoit, sans retard injustifié :

1. une alerte précoce au plus tard sous 24 heures;
2. une notification d'incident au plus tard sous 72 heures;
3. un rapport intermédiaire si l'autorité ou le CSIRT le demande;
4. un rapport final au plus tard un mois après la notification, ou après la fin du
   traitement si l'incident dure encore.

Le canal, le destinataire, le seuil d'incident significatif et les éventuelles
exigences sectorielles sont résolus depuis le `ComplianceContext` au moment de
l'incident. Le système conserve le `T0`, les faits connus, les incertitudes, les
indicateurs de compromission, l'impact, les décisions et chaque version envoyée.

La notification réglementaire ne remplace ni la protection des personnes ni les
autres obligations, notamment une éventuelle notification de violation de données
personnelles. Aucun agent ne notifie seul une autorité : il prépare le dossier,
surveille les échéances et requiert l'approbation du rôle habilité.

## Dossier de preuve

Chaque contrôle possède :

```text
controlId, version, référentiel et exigence
scope: plateforme | projectId | legalEntityId | serviceId
owner et approbateur
mode: prevent | detect | respond | recover
implémentation et configuration effective
test, résultat, date et environnement
artefacts et digest
exceptions, risque résiduel et expiration
prochaine revue
```

Une preuve est générée au fil du travail, non reconstituée avant audit. La présence
d'un document ne prouve pas l'efficacité : les contrôles techniques, restaurations,
alertes et révocations sont testés.

## Revue de la baseline

Revue au minimum trimestrielle et immédiatement après :

- nouvelle version de ReCyF, transposition française ou texte sectoriel;
- changement majeur d'architecture, fournisseur ou modèle;
- incident significatif, vulnérabilité exploitée ou échec de restauration;
- modification du périmètre d'un projet, d'un service ou d'une personne morale.

Toute revue produit un diff, une analyse d'impact, un propriétaire et des échéances.
