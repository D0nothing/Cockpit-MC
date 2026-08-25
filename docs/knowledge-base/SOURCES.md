# Sources et décisions issues de la recherche

Recherche vérifiée le 24 juillet 2026. Les sources primaires et documentations
officielles sont privilégiées.

## Source d'architecture interne

- `JARVIS_Architecture.docx`, version 1.0, fourni le 27 juillet 2026 et marqué
  « Confidentiel — usage interne » : première définition de l'orchestrateur, des
  rôles Engineering, DevOps, Support, Product, Sales, Security, des connecteurs, des
  skills, événements, permissions et garde-fous.\
  **Décision :** conserver le catalogue de responsabilités, le moindre privilège,
  les brouillons, l'approbation des effets sensibles et les connecteurs
  transversaux; remplacer agents permanents, échanges directs, audit Google Sheets
  et clés statiques par les profils invocables et contrôles décrits dans
  [Équipe d'agents](AGENT_ROLES.md). En cas de conflit,
  l'[architecture cible](TARGET_ARCHITECTURE.md) est canonique.

## Simplicité et TypeScript

- [TypeScript `strict`](https://www.typescriptlang.org/tsconfig/strict) : active une
  famille de contrôles donnant des garanties de correction plus fortes.\
  **Décision :** conserver `strict`.
- [TypeScript `noUncheckedIndexedAccess`](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html) :
  ajoute `undefined` aux clés non déclarées.\
  **Décision :** adoption progressive après migration.
- [TypeScript `exactOptionalPropertyTypes`](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html) :
  distingue l'absence d'une propriété de sa présence avec `undefined`.\
  **Décision :** adoption progressive après migration.
- [typescript-eslint `no-explicit-any`](https://typescript-eslint.io/rules/no-explicit-any/) :
  `any` désactive des contrôles; `unknown` est l'alternative sûre quand le type
  n'est pas encore connu.\
  **Décision :** aucun nouvel `any`, puis activation de la règle après suppression
  de la dette existante.
- [typescript-eslint `consistent-type-imports`](https://typescript-eslint.io/rules/consistent-type-imports/) :
  sépare explicitement les imports de types éliminables au runtime.\
  **Décision :** convention recommandée, à automatiser avec la migration lint.
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) :
  recommande la construction de type la plus simple et note qu'un peu de répétition
  coûte souvent moins que des types conditionnels complexes.\
  **Décision :** optimiser la charge cognitive, pas le nombre de caractères.
- [ESLint `max-lines-per-function`](https://eslint.org/docs/latest/rules/max-lines-per-function) :
  les grandes fonctions signalent un risque de maintenance, mais les lignes et la
  complexité ne capturent pas les mêmes problèmes.\
  **Décision :** seuil de revue humain, pas découpage automatique pour satisfaire
  une métrique.

## Frontend et expérience utilisateur

- [React Compiler](https://react.dev/learn/react-compiler/introduction) : stable,
  compatible Vite et capable d'automatiser une grande part de la mémorisation; la
  documentation recommande néanmoins de profiler avant de complexifier le code.\
  **Décision :** expérimentation incrémentale mesurée, sans ajout systématique de
  `useMemo` ou `useCallback`.
- [React `useMemo`](https://react.dev/reference/react/useMemo) : optimisation et non
  garantie sémantique; la mesure doit utiliser un build de production.\
  **Décision :** mémorisation manuelle uniquement avec preuve ou besoin d'identité.
- [Core Web Vitals](https://web.dev/articles/vitals) : LCP 2,5 s, INP 200 ms et CLS
  0,1 au 75e percentile.\
  **Décision :** budgets web partagés et mesure terrain prioritaire.
- [Vite, build de production](https://vite.dev/guide/build) et
  [guide de performance](https://vite.dev/guide/performance) : mesurer le bundle de
  production, auditer les plugins et charger dynamiquement les dépendances lourdes
  non systématiques.\
  **Décision :** budget gzip et imports dynamiques guidés par la mesure.

## API et données

- [Node.js `perf_hooks`](https://nodejs.org/api/perf_hooks.html) : API stable de
  mesure haute résolution et de timeline.\
  **Décision :** outil natif par défaut pour instrumenter un chemin Node ciblé.
- [Cycle de versions Node.js](https://nodejs.org/en/about/previous-releases) :
  les applications de production doivent utiliser une version Active LTS ou
  Maintenance LTS; au jour de la recherche, 24 et 22 sont LTS, 26 est Current.\
  **Décision :** rester sur une LTS et évaluer Node 24 dans un changement dédié.
- [Optimisation des requêtes Prisma](https://www.prisma.io/docs/orm/prisma-client/queries/advanced/query-optimization-performance) :
  éviter sur-sélection, index manquants et N+1; utiliser opérations en lot et
  réutiliser `PrismaClient`/le pooling.\
  **Décision :** règles API/DB correspondantes.
- [PostgreSQL `EXPLAIN`](https://www.postgresql.org/docs/current/using-explain.html) :
  le plan réel expose scans, estimations, boucles, lignes filtrées et buffers.\
  **Décision :** preuve obligatoire pour une optimisation SQL.
- [PostgreSQL, index](https://www.postgresql.org/docs/current/indexes.html) : les
  index accélèrent certaines lectures mais ajoutent un coût global.\
  **Décision :** aucun index spéculatif; mesurer lectures et écritures.

## NIS2 et gouvernance cyber

- [Directive (UE) 2022/2555, article 20](https://eur-lex.europa.eu/eli/dir/2022/2555/art_20/oj) :
  les organes de direction approuvent et supervisent les mesures de gestion des
  risques; leurs membres suivent une formation.\
  **Décision :** risques, exceptions et cadre cyber ont un propriétaire humain et
  une approbation de direction.
- [Directive (UE) 2022/2555, article 21](https://eur-lex.europa.eu/eli/dir/2022/2555/art_21/oj) :
  mesures proportionnées couvrant notamment risques, incidents, continuité,
  fournisseurs, développement/maintenance, vulnérabilités, efficacité, hygiène,
  cryptographie, accès et authentification forte.\
  **Décision :** traiter ces thèmes comme baseline commune même avant confirmation
  de l'assujettissement.
- [Directive (UE) 2022/2555, article 23](https://eur-lex.europa.eu/eli/dir/2022/2555/art_23/oj) :
  pour un incident significatif, alerte précoce sous 24 h, notification sous 72 h,
  puis rapport final au plus tard un mois après la notification, sous réserve des
  cas précisés par le texte.\
  **Décision :** horloge, dossier de preuve et workflow d'approbation intégrés au
  système d'incident.
- [ANSSI, directive NIS2](https://cyber.gouv.fr/reglementation/cybersecurite-systemes-dinformation/directives-nis-nis2-et-dispositif-saiv/directive-nis-2/) :
  au 24 juillet 2026, l'ANSSI décrit la transposition française comme en cours,
  invite les futures entités à agir et publie ReCyF comme document de travail.\
  **Décision :** ne pas revendiquer une conformité; préparer les contrôles et
  réévaluer à chaque évolution du texte français.
- [ANSSI, ReCyF v2.5](https://messervices.cyber.gouv.fr/documents-ressources/20260317_NIS_V2_ReCyF_v2.5.pdf) :
  vingt objectifs regroupant gouvernance, protection, défense et résilience, avec
  des attentes différenciées pour entités essentielles et importantes.\
  **Décision :** matrice opérationnelle principale de
  [la baseline](SECURITY_NIS2.md).
- [Règlement d'exécution (UE) 2024/2690](https://eur-lex.europa.eu/eli/reg_impl/2024/2690/oj)
  et [guide technique ENISA](https://www.enisa.europa.eu/publications/nis2-technical-implementation-guidance) :
  exigences et conseils détaillés pour certaines catégories d'entités numériques
  visées par le règlement.\
  **Décision :** profil conditionnel, activé seulement après confirmation du champ
  d'application.
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework) :
  organise la gestion du risque en Govern, Identify, Protect, Detect, Respond et
  Recover, avec une place explicite pour la gouvernance et les fournisseurs.\
  **Décision :** cycle de pilotage et de reporting complémentaire à ReCyF.

## Interface et accessibilité

- [W3C, WCAG 2.2](https://www.w3.org/TR/WCAG22/) : recommandation composée de
  critères de succès testables et indépendants des technologies pour rendre le
  contenu web perceptible, utilisable, compréhensible et robuste.\
  **Décision :** niveau AA pour les parcours complets du cockpit, avec tests
  automatiques et revue manuelle clavier, lecteur d'écran, focus et zoom.

## Développement, agents et supply chain

- [NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final) : pratiques de
  développement sécurisé intégrables dans tout SDLC afin de réduire les
  vulnérabilités, leur impact et leurs causes racines.\
  **Décision :** sécurité intégrée de la conception à la réponse aux
  vulnérabilités.
- [NIST SP 800-218A](https://csrc.nist.gov/pubs/sp/800/218/a/final) : profil SSDF
  final pour les modèles et systèmes d'IA générative.\
  **Décision :** versionner modèles, données, évaluations et risques spécifiques aux
  agents; l'utiliser avec SSDF 1.1, pas à sa place.
- [OWASP ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) :
  base testable des contrôles de sécurité web; OWASP recommande des identifiants
  qualifiés par la version.\
  **Décision :** exigences applicatives versionnées `v5.0.0-*`.
- [SLSA 1.2](https://slsa.dev/spec/v1.2/) : spécification approuvée de niveaux
  croissants pour la sécurité de la source, du build et de la provenance.\
  **Décision :** Build L2 comme cible initiale et L3 pour les artefacts critiques
  lorsque la plateforme le permet, après évaluation réelle.
- [CISA Known Exploited Vulnerabilities](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) :
  catalogue vivant de vulnérabilités dont l'exploitation est connue et entrée
  recommandée pour la priorisation.\
  **Décision :** exploitabilité, exposition et impact priment sur le score isolé.

## Réseau et cyber-résilience

- [NIST SP 800-207, Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) :
  aucune confiance implicite liée à la localisation réseau ou à la propriété de
  l'actif; authentification et autorisation précèdent l'accès à une ressource.\
  **Décision :** identités courtes, autorisation par ressource, segmentation et
  egress contrôlé.
- [NIST SP 800-160 v2 r1](https://csrc.nist.gov/pubs/sp/800/160/v2/r1/final) :
  ingénierie de systèmes capables d'anticiper, résister, récupérer et s'adapter aux
  conditions adverses ou compromissions.\
  **Décision :** modes dégradés, limitation du blast radius, restauration et
  exercices.
- [IETF BCP 195 / RFC 9325](https://www.rfc-editor.org/info/rfc9325/) et
  [RFC 9852](https://www.rfc-editor.org/info/rfc9852/) : recommandations TLS/DTLS;
  la mise à jour de juillet 2026 exige que les nouveaux protocoles utilisant TLS
  prennent TLS 1.3 comme défaut.\
  **Décision :** TLS 1.3 par défaut; TLS 1.2 uniquement pour compatibilité
  documentée, jamais de version antérieure.

## Sobriété

- [RGESN 2024, Arcep](https://www.arcep.fr/mes-demarches-et-services/entreprises/fiches-pratiques/referentiel-general-ecoconception-services-numeriques.html) :
  78 critères couvrant stratégie, spécifications, architecture, UX, contenu,
  frontend, backend, hébergement et algorithmie. Il vise la durée de vie, la
  sobriété, la limitation des ressources et la transparence.\
  **Décision :** mesurer par unité fonctionnelle, dimensionner au besoin, éteindre
  les environnements inutiles, limiter données/tokens/rétention et produire une
  autoévaluation vérifiable avant toute déclaration.
