# Architecture Vistory OS

Le dépôt est un monorepo npm composé de trois unités :

- `apps/web` : cockpit Next.js, sans secret et sans appel direct privilégié aux connecteurs ;
- `apps/api` : API NestJS, orchestration métier et connecteurs serveur ;
- `packages/contracts` : états et règles partagés, indépendants des frameworks.

## Invariants métier

La machine à états refuse les sauts arbitraires. Un workflow Codex exige une spécification au statut `VALIDATED`, la validation de l’assigné et, pour un ticket sensible ou critique, une validation secondaire par une autre personne. La GitHub Action n’a pas la permission de merger et ouvre toujours une pull request draft.

## Frontières de sécurité

Les jetons GitHub, Confluence, Cockpit worker et OpenAI ne sont utilisés que côté serveur ou dans les secrets GitHub Actions. Le contexte envoyé au runner est produit par un endpoint worker authentifié par jeton de service, filtré et nettoyé. Ce jeton statique devra être remplacé par une identité de workload à durée de vie courte avant la production.

L’audit conserve un hash du contenu et le hash d’intégrité précédent. Une étape ultérieure regroupera les événements en arbre de Merkle ; seule sa racine sera ancrée sur MainChain.

## Décisions à finaliser avant production

1. Fournisseur OIDC interne et politique RBAC.
2. Hébergement et chiffrement des secrets.
3. Modèle d’authentification du runner GitHub vers le cockpit.
4. API exacte et environnement de MainChain.
5. Politique de rétention des données Confluence et GitHub.
