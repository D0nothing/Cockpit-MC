import { createHash } from "node:crypto";
import {
  contractSchemaVersion,
  parseRequestPlan,
  type DeliveryTicketPlan,
  type RequestPlan,
  type TaskNode,
} from "@software-factory/contracts";

type RiskLevel = "standard" | "sensitive" | "critical";

interface PlannerInput {
  projectId: string;
  sessionId: string;
  objective: string;
  riskLevel: RiskLevel;
}

export function buildRequestPlan(input: PlannerInput): RequestPlan {
  const normalized = normalize(input.objective);
  if (isPrintMyMindRequest(normalized)) return buildPrintMyMindPlan(input);
  const implementation = implementationTickets(
    normalized,
    input.objective,
    input.riskLevel,
  );
  const tickets: DeliveryTicketPlan[] = [
    ticket(
      "scope",
      "discovery",
      "Cadrer la demande et ses critères",
      input.objective,
      "discovery",
      "product",
      "small",
      [],
      [
        "Le périmètre, les non-objectifs et les critères mesurables sont explicites",
      ],
      ["Plan de cadrage versionné"],
      ["scope-report"],
    ),
    ticket(
      "architecture",
      "discovery",
      "Définir l’architecture et les frontières",
      input.objective,
      "architecture",
      "architecture",
      "medium",
      ["scope"],
      ["Les composants, contrats, données et menaces sont identifiés"],
      ["Décision d’architecture et modèle de menace mis à jour"],
      ["architecture-report"],
    ),
    ...implementation,
  ];
  const implementationKeys = implementation.map(({ ticketKey }) => ticketKey);
  tickets.push(
    ticket(
      "verification",
      "assurance",
      "Vérifier le résultat de bout en bout",
      input.objective,
      "verification",
      "verification",
      "medium",
      implementationKeys,
      [
        "Tous les critères des tickets sont couverts par des preuves reproductibles",
      ],
      [
        "Lint, tests et build réussissent",
        "Les refus de sécurité applicables sont testés",
      ],
      ["verification-report"],
    ),
    ticket(
      "delivery-review",
      "assurance",
      "Préparer la livraison et la revue humaine",
      input.objective,
      "delivery",
      "product",
      "small",
      ["verification"],
      [
        "Les changements, preuves, risques résiduels et rollback sont présentés",
      ],
      ["Revue humaine demandée sans merge automatique"],
      ["delivery-report"],
    ),
  );
  const epics = [
    {
      epicKey: "discovery",
      title: "Cadrage et architecture",
      objective: "Transformer la demande en contrat de réalisation vérifiable.",
      expectedOutcome: "Une solution bornée, structurée et prête à développer.",
      acceptanceCriteria: [
        "Le périmètre et les frontières techniques sont approuvables",
      ],
      ticketKeys: ["scope", "architecture"],
    },
    {
      epicKey: "delivery",
      title: "Réalisation",
      objective: "Implémenter les capacités nécessaires à la demande.",
      expectedOutcome:
        "Une tranche fonctionnelle testable sans effet externe implicite.",
      acceptanceCriteria: [
        "Chaque capacité produit son artefact et satisfait sa définition de fini",
      ],
      ticketKeys: implementationKeys,
    },
    {
      epicKey: "assurance",
      title: "Vérification et livraison",
      objective: "Prouver la correction et préparer une décision humaine.",
      expectedOutcome: "Un résultat vérifié, traçable et réversible.",
      acceptanceCriteria: [
        "Les contrôles automatisés passent et les risques résiduels sont visibles",
      ],
      ticketKeys: ["verification", "delivery-review"],
    },
  ];
  return parseRequestPlan({
    schemaVersion: contractSchemaVersion,
    projectId: input.projectId,
    sessionId: input.sessionId,
    objectiveHash: createHash("sha256").update(input.objective).digest("hex"),
    epics,
    tickets,
  });
}

function buildPrintMyMindPlan(input: PlannerInput): RequestPlan {
  const tickets: DeliveryTicketPlan[] = [
    ticket(
      "scope",
      "saas-foundation",
      "Borner le MVP et les décisions produit",
      input.objective,
      "discovery",
      "product",
      "small",
      [],
      [
        "Le parcours principal permet le téléchargement STL ou 3MF et un transfert optionnel vers un service d’impression sans commande ni paiement automatique",
        "Les décisions de prix, quota, conservation et authentification sont explicites",
        "L’interface affiche uniquement Imprimer mon objet sur un modèle READY et ne révèle jamais le courtier ou le prestataire",
        "Le socle est borné à React/TypeScript, une API et un worker Node.js/TypeScript, MariaDB utf8mb4, Redis et un stockage objet S3-compatible",
        "La distribution Docker et Kubernetes k3s sur Ubuntu, le load balancing et le point unique de panne mono-nœud sont explicités",
        "Les locales MVP sont fr, en, es, de, it, pt, zh-Hans, ar, hi et he avec fallback anglais et prise en charge RTL arabe et hébraïque",
        "Toute génération réussie apparaît automatiquement dans la bibliothèque du compte après ingestion privée, sans réimport manuel",
        "La direction 2 révisée a été choisie humainement et son image versionnée devient la source de vérité React",
      ],
      [
        "Périmètre et non-objectifs relus",
        "Décisions produit, architecture, distribution et langues versionnées",
        "Décisions ouvertes consignées sans bloquer le socle",
      ],
      ["scope-report"],
    ),
    ticket(
      "architecture",
      "saas-foundation",
      "Définir l’architecture SaaS et les frontières",
      input.objective,
      "architecture",
      "architecture",
      "medium",
      ["scope"],
      [
        "Les frontières microservices web React, API Node.js et generation-worker Node.js sont explicites sans extraction prématurée de billing",
        "Chaque service possède ses données et contrats versionnés sans partage direct de tables MariaDB",
        "Redis/BullMQ, stockage S3-compatible, images Docker non-root et ressources Kubernetes k3s sont décrits",
        "Ingress TLS, Services ClusterIP, NetworkPolicies, probes et limites de ressources couvrent le load balancing sans promettre de haute disponibilité mono-nœud",
        "Les secrets et données privées ne traversent aucune frontière cliente",
        "Le modèle de données relie chaque création, asset, ingestion, analyse, export et transfert d’impression au propriétaire authentifié",
        "L’adaptateur interne printBroker est isolé et versionné ; aucune marque, URL ou schéma fournisseur n’est exposé ou inventé sans documentation vérifiée",
      ],
      [
        "Décision d’architecture versionnée",
        "Modèle de menace, flux réseau et point unique de panne Ubuntu documentés",
        "Stratégie de sauvegarde hors serveur et restauration testable définie",
      ],
      ["architecture-report"],
    ),
    ticket(
      "saas-core",
      "saas-foundation",
      "Initialiser le socle applicatif et les données",
      input.objective,
      "implementation",
      "backend",
      "medium",
      ["architecture"],
      [
        "Les services web, api et generation-worker démarrent avec configuration validée et contrats versionnés",
        "MariaDB utilise utf8mb4 et des identifiants séparés par service lorsque pertinent",
        "Les entités utilisateur, abonnement, génération, modèle, asset, ingestion, analyse, export, transfert d’impression et webhook sont persistées",
        "Clés fournisseur, checksums et contraintes uniques empêchent doublons de modèle, d’asset, de quota et de transfert",
      ],
      [
        "Types stricts et migrations testées",
        "Images Docker multi-stage non-root, healthchecks et socle k3s reproductible",
        "Aucun secret ni environnement réel dans le dépôt",
      ],
      ["saas-core-change", "migration-report"],
    ),
    ticket(
      "auth-account",
      "saas-foundation",
      "Implémenter l’authentification et le compte",
      input.objective,
      "implementation",
      "security",
      "medium",
      ["saas-core"],
      [
        "Inscription, vérification e-mail, connexion, déconnexion et réinitialisation fonctionnent",
        "Les accès horizontaux et sessions invalides sont refusés",
      ],
      [
        "Tests de parcours et tests de refus ajoutés",
        "Cookies et mots de passe respectent les contrôles de sécurité",
      ],
      ["auth-change", "auth-test-report"],
    ),
    ticket(
      "stripe-subscription",
      "saas-foundation",
      "Brancher Stripe Checkout et Customer Portal",
      input.objective,
      "implementation",
      "integration",
      "medium",
      ["auth-account"],
      [
        "Seul un webhook Stripe signé active ou modifie les droits",
        "Les événements rejoués ne dupliquent ni abonnement ni effet",
        "Le portail de facturation est accessible à son seul propriétaire",
      ],
      [
        "Webhooks testés avec signatures valides et invalides",
        "Clés Stripe exclusivement côté serveur",
      ],
      ["stripe-change", "stripe-webhook-report"],
    ),
    ticket(
      "quota-ledger",
      "saas-foundation",
      "Construire le quota et le registre d’usage",
      input.objective,
      "implementation",
      "backend",
      "medium",
      ["stripe-subscription"],
      [
        "Les unités sont réservées avant un appel payant",
        "Consommation et restitution sont idempotentes et réconciliables",
        "Une seule génération payante simultanée est autorisée par défaut",
      ],
      [
        "Registre immuable couvert par des tests concurrents",
        "Aucun double débit ou double remboursement",
      ],
      ["quota-change", "quota-test-report"],
    ),

    ticket(
      "meshy-adapter",
      "meshy-generation",
      "Créer l’interface fournisseur et l’adaptateur Meshy",
      input.objective,
      "implementation",
      "integration",
      "medium",
      ["architecture"],
      [
        "Le domaine dépend d’une interface interne et non directement de Meshy",
        "La soumission et la lecture d’état sont bornées, temporisées et validées",
        "Le prompt respecte la longueur et la modération avant appel payant",
      ],
      [
        "Adaptateur simulable sans réseau",
        "Erreurs fournisseur traduites en erreurs métier sûres",
      ],
      ["meshy-adapter-change", "meshy-contract-report"],
    ),
    ticket(
      "generation-jobs",
      "meshy-generation",
      "Orchestrer la génération asynchrone",
      input.objective,
      "implementation",
      "backend",
      "medium",
      ["meshy-adapter", "quota-ledger"],
      [
        "Le cycle QUEUED vers un état terminal est monotone et journalisé",
        "Les retries sont bornés et ne repayent jamais une génération réussie",
        "La reprise fonctionne après fermeture de l’onglet ou redémarrage worker",
      ],
      [
        "Tests d’idempotence, reprise et panne ajoutés",
        "Les jobs bloqués expirent avec une erreur explicite",
      ],
      ["generation-jobs-change", "generation-state-report"],
    ),
    ticket(
      "private-assets",
      "meshy-generation",
      "Copier les assets dans un stockage privé",
      input.objective,
      "implementation",
      "data",
      "medium",
      ["meshy-adapter", "saas-core"],
      [
        "Les URLs Meshy temporaires sont ingérées côté serveur",
        "Les assets sont copiés immédiatement vers le stockage objet privé et restent disponibles après expiration de l’URL Meshy",
        "GLB, STL, 3MF, miniatures et originaux possèdent checksum, clé de stockage et propriétaire dérivé de l’authentification",
        "Une copie partielle reprend l’ingestion sans relancer la génération payante et les retries ne créent aucun doublon",
        "MariaDB conserve uniquement métadonnées, ownership, statuts et checksums, jamais les fichiers 3D en BLOB",
        "Les téléchargements utilisent des URLs signées courtes",
      ],
      [
        "Tests d’ownership, reprise, idempotence, expiration fournisseur et isolation entre utilisateurs ajoutés",
        "Taille, type, checksum et quota de stockage sont validés",
        "Suppression différée et traçable implémentée",
      ],
      ["private-assets-change", "storage-security-report"],
    ),
    ticket(
      "generation-api",
      "meshy-generation",
      "Exposer l’API des générations",
      input.objective,
      "implementation",
      "backend",
      "medium",
      ["generation-jobs", "private-assets"],
      [
        "POST /api/v1/generations répond 202 avec une ressource persistée liée au compte authentifié",
        "GET /api/v1/library liste uniquement les modèles du compte et GET /api/v1/models/{id} expose le modèle et ses assets autorisés",
        "Les doubles requêtes partagent la même clé d’idempotence",
        "Les routes de lecture, annulation, retry et suppression vérifient le propriétaire",
        "Les routes internes d’ingestion fournisseur sont idempotentes et ne sont jamais exposées au navigateur",
        "Le contrat préserve un futur dépôt direct externe en deux temps via upload présigné puis finalisation asynchrone",
        "Les locales sont normalisées et les erreurs utilisent des codes stables traduits côté React",
      ],
      [
        "Contrats réseau validés et bornés",
        "Tests API heureux, erreurs et accès croisés réussissent",
      ],
      ["generation-api-change", "generation-api-report"],
    ),

    ticket(
      "creation-dashboard",
      "viewer-history",
      "Construire le tableau de bord de création",
      input.objective,
      "implementation",
      "frontend",
      "medium",
      ["auth-account", "quota-ledger"],
      [
        "Le prompt de 10 à 600 caractères et le quota restant sont visibles",
        "Un double clic ne déclenche pas deux générations",
        "Les états de blocage abonnement et quota sont compréhensibles",
        "Le sélecteur accessible couvre fr, en, es, de, it, pt, zh-Hans, ar, hi et he avec détection navigateur, préférence persistée et fallback anglais",
        "L’arabe et l’hébreu appliquent dir=rtl, des propriétés CSS logiques, un ordre de composants et des icônes directionnelles vérifiés",
        "L’interface prolonge l’identité autorisée de printmymind.ai avec le champ d’idée et une seule action forte",
        "Le rendu suit la direction 2 révisée sans nom de courtier visible et réserve Imprimer mon objet à l’état READY",
      ],
      [
        "La direction 2 révisée 1440 × 1024 est la source visuelle de vérité validée avant l’implémentation React",
        "Parcours clavier et responsive testés",
        "Dates, nombres, prix et pluriels utilisent Intl sans texte métier codé en dur",
        "Chaque locale, le RTL arabe et hébreu, la navigation clavier, les nombres et ponctuations mixtes, les débordements et le changement de langue sans perte d’état sont testés",
        "Aucun prompt n’est envoyé aux outils analytiques",
      ],
      ["dashboard-change", "dashboard-test-report"],
    ),
    ticket(
      "generation-progress",
      "viewer-history",
      "Afficher le suivi asynchrone d’une génération",
      input.objective,
      "implementation",
      "frontend",
      "small",
      ["generation-api", "creation-dashboard"],
      [
        "Les étapes en file, génération, ingestion, analyse, réparation et export sont lisibles",
        "Après réussite Meshy, le modèle apparaît automatiquement dans la bibliothèque avec statuts ingestion puis analyse",
        "La reconnexion retrouve l’état persistant",
        "L’annulation n’est proposée que lorsqu’elle est encore sûre",
      ],
      [
        "États terminaux et dégradés testés",
        "Aucune boucle de polling non bornée",
      ],
      ["progress-change", "progress-test-report"],
    ),
    ticket(
      "glb-viewer",
      "viewer-history",
      "Ajouter la visionneuse GLB accessible",
      input.objective,
      "implementation",
      "frontend",
      "medium",
      ["generation-api", "private-assets"],
      [
        "La miniature charge avant le GLB",
        "Rotation, zoom, recentrage et dimensions fonctionnent",
        "Le statut et les dimensions restent compréhensibles sans la 3D",
      ],
      [
        "Chargement tardif et budget de performance vérifiés",
        "Clavier, focus et mouvement réduit testés",
      ],
      ["viewer-change", "viewer-performance-report"],
    ),
    ticket(
      "creation-history",
      "viewer-history",
      "Créer l’historique et la fiche d’une création",
      input.objective,
      "implementation",
      "frontend",
      "medium",
      ["generation-api", "auth-account"],
      [
        "La liste est paginée et filtrable par état",
        "La fiche affiche prompt, date, assets, dimensions et imprimabilité",
        "Le modèle ingéré automatiquement est visible sans téléchargement-réimport manuel",
        "Renommage et suppression vérifient le propriétaire",
      ],
      [
        "États vide, chargement, échec et suppression testés",
        "Aucun chargement global de tous les modèles",
      ],
      ["history-change", "history-test-report"],
    ),

    ticket(
      "printability-analysis",
      "printability-export",
      "Analyser automatiquement l’imprimabilité",
      input.objective,
      "implementation",
      "integration",
      "medium",
      ["generation-api"],
      [
        "Une analyse démarre après ingestion réussie",
        "PASS, WARNING, FAIL_REPAIRABLE et FAIL_UNRECOVERABLE sont persistés",
        "Le rapport expose des métriques compréhensibles sans garantir l’impression physique",
      ],
      [
        "Contrat fournisseur simulé et tests des quatre résultats",
        "Rapport relié à l’asset exact par identifiant et checksum",
      ],
      ["printability-change", "printability-report"],
    ),
    ticket(
      "printability-repair",
      "printability-export",
      "Réparer les modèles récupérables",
      input.objective,
      "implementation",
      "integration",
      "medium",
      ["printability-analysis"],
      [
        "Seul FAIL_REPAIRABLE propose une réparation",
        "Une réparation rejouée ne consomme pas deux fois le quota",
        "L’asset réparé reste relié à l’original sans l’écraser",
      ],
      [
        "Succès, échec permanent et reprise testés",
        "Le résultat réparé devient la source recommandée",
      ],
      ["repair-change", "repair-test-report"],
    ),
    ticket(
      "export-stl-3mf",
      "printability-export",
      "Préparer les exports STL et 3MF à la taille choisie",
      input.objective,
      "implementation",
      "backend",
      "medium",
      ["printability-analysis", "private-assets"],
      [
        "La taille est exprimée et validée en millimètres",
        "STL et 3MF sont produits depuis la bonne source brute ou réparée",
        "WARNING exige une confirmation et FAIL_UNRECOVERABLE reste bloqué par défaut",
      ],
      [
        "Dimensions et checksums vérifiés automatiquement",
        "Les limites de taille sont configurables et testées",
      ],
      ["export-change", "export-format-report"],
    ),
    ticket(
      "secure-download",
      "printability-export",
      "Sécuriser le téléchargement et le transfert d’impression",
      input.objective,
      "implementation",
      "security",
      "medium",
      ["export-stl-3mf", "auth-account"],
      [
        "Une URL signée courte est créée uniquement pour le propriétaire",
        "Modifier un identifiant ou réutiliser une URL expirée est refusé",
        "Un modèle READY propose Télécharger et l’action secondaire neutre Imprimer mon objet, sans marque prestataire visible",
        "Le transfert serveur-à-serveur utilise l’adaptateur Node.js versionné printBroker et le secret attendu PRINT_BROKER_API_KEY, jamais React ni une URL cliente",
        "Fichier, format, checksum, dimensions, unité, rapport d’imprimabilité et référence utilisateur autorisée sont transmis avec une clé d’idempotence",
        "Les états NOT_SENT, UPLOADING, TRANSFERRED, FAILED et CANCELED sont persistés avec timeout, retry borné, circuit breaker et reprise",
        "Aucune commande payante, impression ou facturation ne part automatiquement ; aucun appel live n’a lieu sans nouvelle clé sûre, documentation et URL vérifiées",
      ],
      [
        "Tests IDOR, expiration, contrat mocké, idempotence et échec réseau réussissent",
        "Webhook signé ou polling est choisi seulement selon le contrat fournisseur réel",
        "Aucun chemin de stockage permanent n’est public",
      ],
      ["download-change", "download-security-report"],
    ),

    ticket(
      "admin-observability",
      "hardening-launch",
      "Ajouter administration, métriques et alertes",
      input.objective,
      "implementation",
      "operations",
      "medium",
      ["generation-api", "stripe-subscription", "quota-ledger"],
      [
        "Un administrateur retrouve une génération et son étape d’échec sans secret",
        "Les ajustements de quota ont un motif et une trace d’audit",
        "Durées et taux d’échec essentiels sont mesurables",
      ],
      [
        "Permissions administrateur et refus utilisateur testés",
        "Alertes et runbook minimal documentés",
      ],
      ["admin-change", "operations-report"],
    ),
    ticket(
      "security-hardening",
      "hardening-launch",
      "Durcir les frontières et les fournisseurs",
      input.objective,
      "implementation",
      "security",
      "medium",
      [
        "auth-account",
        "stripe-subscription",
        "generation-jobs",
        "private-assets",
        "secure-download",
      ],
      [
        "CSRF, XSS, injection, rate limiting et accès horizontaux sont couverts",
        "Webhooks, secrets et egress appliquent refus par défaut et moindre privilège",
        "Secrets Kubernetes, ConfigMaps, NetworkPolicies et stockage externe aux pods appliquent la séparation des privilèges",
        "Les images Docker sont scannées, non-root et référencées par tags immuables avant tout déploiement contrôlé",
        "La clé du courtier d’impression n’existe que dans le gestionnaire de secrets et les logs ne contiennent que des identifiants non sensibles",
        "La conservation et la suppression RGPD sont documentées",
      ],
      [
        "Tests de refus sensibles réussissent",
        "Audit de dépendances sans vulnérabilité haute",
        "Modèle de menace mis à jour",
      ],
      ["security-change", "security-test-report"],
    ),
    ticket(
      "e2e-launch-readiness",
      "hardening-launch",
      "Vérifier le MVP de bout en bout et les pannes",
      input.objective,
      "verification",
      "verification",
      "large",
      [
        "generation-progress",
        "glb-viewer",
        "creation-history",
        "printability-repair",
        "secure-download",
        "admin-observability",
        "security-hardening",
      ],
      [
        "Le parcours inscription vers bibliothèque automatique puis téléchargement STL et 3MF réussit",
        "Ownership, retry sans doublon, reprise d’ingestion, accès croisé refusé et conservation après expiration Meshy sont prouvés",
        "Le transfert d’impression est testé uniquement contre un mock et reste sans effet d’impression ou de facturation",
        "Avant tout paiement ou impression, prix, modèle, dimensions, matériau, adresse et conditions applicables exigent une confirmation explicite",
        "Les pannes Stripe, Meshy, worker et stockage ne créent ni fuite ni double débit",
        "Les budgets performance, responsive et accessibilité sont mesurés",
        "Les dix locales et les rendus RTL arabe et hébreu passent leurs scénarios visuels et fonctionnels sans perte d’état",
        "Le déploiement k3s valide probes, Services, Ingress TLS, volumes, sauvegarde et restauration sans revendiquer de haute disponibilité mono-nœud",
      ],
      [
        "Lint, tests unitaires, intégration, E2E et build réussissent",
        "Sauvegarde et restauration sont testées",
        "Les traductions juridiques et transactionnelles non validées sont signalées comme démonstration",
        "Preuves reproductibles liées à chaque critère",
      ],
      ["e2e-report", "launch-readiness-report"],
    ),
    ticket(
      "delivery-review",
      "hardening-launch",
      "Préparer la revue humaine du MVP",
      input.objective,
      "delivery",
      "product",
      "small",
      ["e2e-launch-readiness"],
      [
        "Les changements, preuves, coûts et risques résiduels sont présentés",
        "Les décisions produit ouvertes sont visibles avant lancement",
        "Aucun merge, déploiement, transfert d’impression ou commande d’impression n’est automatique",
        "CGU, CGA/CGV et politique de confidentialité expliquent rôle de courtier, prestataires, transferts de fichiers et données, responsabilités et conditions financières",
      ],
      [
        "Pull request maintenue en brouillon",
        "Plan de rollback et décision humaine demandés",
      ],
      ["delivery-report"],
    ),
  ];

  const epic = (
    epicKey: string,
    title: string,
    objective: string,
    expectedOutcome: string,
    acceptanceCriteria: string[],
  ) => ({
    epicKey,
    title,
    objective,
    expectedOutcome,
    acceptanceCriteria,
    ticketKeys: tickets
      .filter((item) => item.epicKey === epicKey)
      .map((item) => item.ticketKey),
  });

  return parseRequestPlan({
    schemaVersion: contractSchemaVersion,
    projectId: input.projectId,
    sessionId: input.sessionId,
    objectiveHash: createHash("sha256").update(input.objective).digest("hex"),
    epics: [
      epic(
        "saas-foundation",
        "Socle SaaS, identité et revenus",
        "Établir le compte, l’abonnement Stripe et le quota avant toute dépense fournisseur.",
        "Un utilisateur autorisé dispose de droits et d’un registre d’usage cohérents.",
        [
          "Les webhooks signés sont la source de vérité",
          "Aucune génération payante sans droit ni réservation",
        ],
      ),
      epic(
        "meshy-generation",
        "Génération Meshy asynchrone et stockage privé",
        "Isoler Meshy derrière un adaptateur et rendre la génération reprise, idempotente et durable.",
        "Les modèles et leur progression survivent aux interruptions et aux URLs fournisseur.",
        [
          "Une réussite Meshy ne peut être payée deux fois",
          "Tous les assets utiles sont copiés dans le stockage privé",
          "Le modèle ingéré apparaît automatiquement dans la bibliothèque de son propriétaire",
        ],
      ),
      epic(
        "viewer-history",
        "Visionneuse, suivi et historique",
        "Rendre chaque création compréhensible et retrouvable sur tous les écrans du MVP.",
        "L’utilisateur suit, prévisualise, retrouve et supprime ses propres modèles.",
        [
          "Le GLB est chargé à la demande",
          "L’historique reste paginé et isolé par utilisateur",
        ],
      ),
      epic(
        "printability-export",
        "Imprimabilité, réparation et export STL/3MF",
        "Transformer un modèle généré en fichier dimensionné, téléchargeable et transférable de façon optionnelle avec un risque explicite.",
        "Un résultat analysé ou réparé peut être exporté en STL ou 3MF via un lien privé ou préparé pour un service d’impression.",
        [
          "Les quatre résultats d’analyse entraînent les bonnes actions",
          "La source, la taille et le format de chaque export sont traçables",
          "Le transfert d’impression est idempotent, sans marque exposée et n’engage aucune commande automatique",
        ],
      ),
      epic(
        "hardening-launch",
        "Durcissement et lancement",
        "Prouver sécurité, résilience, exploitabilité, accessibilité et performance avant décision humaine.",
        "Le MVP est démontrable avec preuves, risques résiduels et rollback.",
        [
          "Le parcours complet et les pannes sont testés",
          "Aucun merge ou déploiement n’est automatique",
        ],
      ),
    ],
    tickets,
  });
}

export function requestPlanToTaskNodes(plan: RequestPlan): TaskNode[] {
  return plan.tickets.map((planned) => ({
    taskId: planned.ticketKey,
    type: planned.kind,
    capability: planned.capability,
    roleCapability: planned.capability,
    complexity: planned.complexity,
    dependsOn: planned.dependsOn,
    definitionOfReady:
      planned.dependsOn.length === 0
        ? ["Objectif et contexte projet disponibles"]
        : ["Tickets dépendants terminés"],
    definitionOfDone: planned.definitionOfDone,
    maxAttempts: 2,
    expectedArtifacts: planned.expectedArtifacts,
    humanGate: planned.kind === "delivery" ? "delivery-review" : undefined,
  }));
}

function implementationTickets(
  normalized: string,
  objective: string,
  riskLevel: RiskLevel,
): DeliveryTicketPlan[] {
  const capabilities: Array<{
    key: string;
    title: string;
    capability: string;
    matches: string[];
  }> = [
    {
      key: "frontend",
      title: "Construire l’expérience utilisateur",
      capability: "frontend",
      matches: [
        "interface",
        "web",
        "frontend",
        "cockpit",
        "dashboard",
        "ecran",
        "outil",
        "application",
      ],
    },
    {
      key: "backend",
      title: "Implémenter les règles et l’API",
      capability: "backend",
      matches: [
        "api",
        "backend",
        "service",
        "workflow",
        "outil",
        "application",
        "plateforme",
      ],
    },
    {
      key: "data",
      title: "Modéliser et persister les données",
      capability: "data",
      matches: [
        "donnee",
        "database",
        "postgres",
        "stockage",
        "memoire",
        "knowledge",
        "ticket",
        "epic",
      ],
    },
    {
      key: "integration",
      title: "Brancher les intégrations nécessaires",
      capability: "integration",
      matches: [
        "github",
        "slack",
        "notion",
        "confluence",
        "connecteur",
        "integration",
        "provider",
        "fournisseur",
      ],
    },
    {
      key: "security",
      title: "Appliquer les contrôles de sécurité",
      capability: "security",
      matches: [
        "securite",
        "secret",
        "permission",
        "auth",
        "oidc",
        "nis2",
        "critique",
      ],
    },
  ];
  const selected = capabilities.filter(({ matches }) =>
    matches.some((keyword) => normalized.includes(keyword)),
  );
  if (
    riskLevel !== "standard" &&
    !selected.some(({ key }) => key === "security")
  )
    selected.push(capabilities[4]);
  if (selected.length === 0)
    selected.push({
      key: "implementation",
      title: "Implémenter la capacité demandée",
      capability: "engineering",
      matches: [],
    });
  return selected.map(({ key, title, capability }) =>
    ticket(
      key,
      "delivery",
      title,
      objective,
      "implementation",
      capability,
      capability === "security" ? "medium" : "large",
      ["architecture"],
      [
        `La capacité ${capability} répond à la demande sans élargir le périmètre`,
        "Les erreurs et états limites sont explicites",
      ],
      [
        "Code relu et typé strictement",
        "Tests de comportement ajoutés",
        "Aucun contrôle global désactivé",
      ],
      [`${capability}-change`, `${capability}-test-report`],
    ),
  );
}

function ticket(
  ticketKey: string,
  epicKey: string,
  title: string,
  objective: string,
  kind: DeliveryTicketPlan["kind"],
  capability: string,
  complexity: DeliveryTicketPlan["complexity"],
  dependsOn: string[],
  acceptanceCriteria: string[],
  definitionOfDone: string[],
  expectedArtifacts: string[],
): DeliveryTicketPlan {
  return {
    ticketKey,
    epicKey,
    title,
    description: `${title}. Demande source : ${objective}`.slice(0, 5_000),
    kind,
    capability,
    complexity,
    dependsOn,
    acceptanceCriteria,
    definitionOfDone,
    expectedArtifacts,
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isPrintMyMindRequest(normalized: string): boolean {
  return (
    normalized.includes("print my mind") ||
    (normalized.includes("meshy") &&
      normalized.includes("stripe") &&
      normalized.includes("stl") &&
      normalized.includes("3mf"))
  );
}
