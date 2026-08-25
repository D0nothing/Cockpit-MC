# Modèle de menace des frontières fournisseurs

État : **implémenté pour le MVP local, le refus par défaut, l'exécution bornée et la
promotion KB gouvernée**, incomplet pour une exploitation externe. Revue : 25 août
2026.

## Périmètre

La frontière couvre le Connector Gateway de l'API, les configurations par projet,
les variables serveur et les effets vers GitHub Actions, Confluence ou un
fournisseur de modèles. Le navigateur, les tickets, documents, prompts, sorties de
modèle et réponses fournisseur sont non fiables.

## Invariants

- `worker-simulator` est le seul fournisseur activé par défaut et ne produit aucun
  effet externe.
- Un fournisseur externe doit être présent dans `ENABLED_PROVIDERS`, configuré
  côté serveur et autorisé pour la cible persistée du projet.
- Le propriétaire et le dépôt GitHub viennent du `Project` chargé par l'API, jamais
  d'un champ fourni avec la commande ni d'une configuration globale partagée.
- Les secrets ne figurent dans aucun read model, log, message d'erreur ou artefact.
- Une destination, un identifiant de workflow et chaque argument d'effet sont
  validés séparément avant l'appel réseau.
- L'échec d'un fournisseur laisse l'état explicite ; il n'existe aucun fallback
  silencieux vers un autre fournisseur.
- Une sortie brute, un feedback ou un contenu de Knowledge Base reste non fiable et
  ne peut ni accorder une permission ni publier directement une entrée permanente.
- Une entrée KB injectée est active, filtrée par portée, bornée et accompagnée de sa
  citation ; une entrée révoquée n'est plus sélectionnée.
- En production, la connaissance d'un `projectId` ne donne aucun accès aux routes
  métier sans une session GitHub signée pour le login allowlisté ou le jeton serveur
  distinct.

## Menaces et contrôles

| Menace | Contrôle présent | Contrôle restant avant pilote externe |
| --- | --- | --- |
| Activation accidentelle | allowlist vide par défaut, statut `disabled` | approbation versionnée de la politique fournisseur |
| Effet sur le mauvais dépôt | cible issue du projet et segments GitHub validés | autorisation serveur par identité et mandat |
| Fuite de secret | présence seulement signalée par booléen, aucune valeur exposée | coffre de secrets et identité de workload courte |
| SSRF ou redirection | URL GitHub fixe, aucun hôte fourni par le client | proxy d'egress et validation des redirections pour les prochains adaptateurs |
| Rejeu | clés d'idempotence durables sur sessions, runs, commandes, dispatchs et feedbacks ; reçu d'effet | outbox transactionnelle et retry pour GitHub/Confluence |
| Panne ou lenteur | timeout GitHub de 8 s, erreur explicite | retry borné avec jitter, circuit breaker et test d'injection de panne |
| Confusion inter-projets | ressources filtrées par projet, preuve feedback vérifiée, recherche KB projet/commune, jeton cockpit en production | OIDC/RBAC et tests IDOR sur toutes les routes historiques |
| Empoisonnement de la KB | mémoire temporaire, proposition explicite, auto-approbation refusée, quorum 1/2, provenance, version et révocation | classification automatique assistée et revue de contenu sensible commune |
| Connaissance obsolète | statut actif/révoqué, supersession et recherche active uniquement | mesure d'efficacité et dépréciation automatique proposée à un humain |
| Vol ou fixation de session | état OAuth aléatoire, cookie signé `HttpOnly`/`Secure`, expiration huit heures, aucun jeton GitHub conservé | révocation centralisée et step-up avant plusieurs utilisateurs |
| CSRF par cookie | toute mutation authentifiée par session exige une origine exacte de `WEB_ORIGIN` | CSP et tests de navigateur sur le domaine final |
| Mauvais compte GitHub | comparaison insensible à la casse avec `GITHUB_ALLOWED_LOGIN`, refus `403` avant émission de session | revue périodique du propriétaire du compte |
| Fausse identité humaine | accès au cockpit borné à un compte GitHub ; séparation demandeur/approbateur dans le domaine | identité OIDC signée par rôle ; les identités métier saisies restent développement/pilote seulement |
| Cardinalité ou contenu dans la télémétrie | routes normalisées, durées bornées à 200 échantillons | export OTLP protégé et politique de rétention |

## Cas de refus vérifiés

- fournisseur externe absent de l'allowlist ;
- fournisseur activé sans référence de secret ;
- auto-approbation ;
- lecture ou décision d'approbation depuis un autre projet ;
- commande invalide ou rejouée avec une autre intention ;
- clé d'idempotence réutilisée pour une autre ressource.
- feedback sans preuve ou avec une preuve d'un autre projet ;
- publication directe d'un feedback brut ;
- promotion avant quorum, auto-approbation et portée commune non confirmée ;
- recherche d'une entrée projet depuis un autre projet et sélection d'une entrée
  révoquée.

Une connexion réelle reste interdite tant que les contrôles « restant » applicables
au fournisseur ne sont pas fermés et reliés au dossier de preuve du projet.
