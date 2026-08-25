import { createHash } from 'node:crypto';
import { contractSchemaVersion, parseRequestPlan, type DeliveryTicketPlan, type RequestPlan, type TaskNode } from '@software-factory/contracts';

type RiskLevel = 'standard' | 'sensitive' | 'critical';

interface PlannerInput {
  projectId: string;
  sessionId: string;
  objective: string;
  riskLevel: RiskLevel;
}

export function buildRequestPlan(input: PlannerInput): RequestPlan {
  const normalized = normalize(input.objective);
  const implementation = implementationTickets(normalized, input.objective, input.riskLevel);
  const tickets: DeliveryTicketPlan[] = [
    ticket('scope', 'discovery', 'Cadrer la demande et ses critères', input.objective, 'discovery', 'product', 'small', [], ['Le périmètre, les non-objectifs et les critères mesurables sont explicites'], ['Plan de cadrage versionné'], ['scope-report']),
    ticket('architecture', 'discovery', 'Définir l’architecture et les frontières', input.objective, 'architecture', 'architecture', 'medium', ['scope'], ['Les composants, contrats, données et menaces sont identifiés'], ['Décision d’architecture et modèle de menace mis à jour'], ['architecture-report']),
    ...implementation,
  ];
  const implementationKeys = implementation.map(({ ticketKey }) => ticketKey);
  tickets.push(
    ticket('verification', 'assurance', 'Vérifier le résultat de bout en bout', input.objective, 'verification', 'verification', 'medium', implementationKeys, ['Tous les critères des tickets sont couverts par des preuves reproductibles'], ['Lint, tests et build réussissent', 'Les refus de sécurité applicables sont testés'], ['verification-report']),
    ticket('delivery-review', 'assurance', 'Préparer la livraison et la revue humaine', input.objective, 'delivery', 'product', 'small', ['verification'], ['Les changements, preuves, risques résiduels et rollback sont présentés'], ['Revue humaine demandée sans merge automatique'], ['delivery-report']),
  );
  const epics = [
    {
      epicKey: 'discovery',
      title: 'Cadrage et architecture',
      objective: 'Transformer la demande en contrat de réalisation vérifiable.',
      expectedOutcome: 'Une solution bornée, structurée et prête à développer.',
      acceptanceCriteria: ['Le périmètre et les frontières techniques sont approuvables'],
      ticketKeys: ['scope', 'architecture'],
    },
    {
      epicKey: 'delivery',
      title: 'Réalisation',
      objective: 'Implémenter les capacités nécessaires à la demande.',
      expectedOutcome: 'Une tranche fonctionnelle testable sans effet externe implicite.',
      acceptanceCriteria: ['Chaque capacité produit son artefact et satisfait sa définition de fini'],
      ticketKeys: implementationKeys,
    },
    {
      epicKey: 'assurance',
      title: 'Vérification et livraison',
      objective: 'Prouver la correction et préparer une décision humaine.',
      expectedOutcome: 'Un résultat vérifié, traçable et réversible.',
      acceptanceCriteria: ['Les contrôles automatisés passent et les risques résiduels sont visibles'],
      ticketKeys: ['verification', 'delivery-review'],
    },
  ];
  return parseRequestPlan({
    schemaVersion: contractSchemaVersion,
    projectId: input.projectId,
    sessionId: input.sessionId,
    objectiveHash: createHash('sha256').update(input.objective).digest('hex'),
    epics,
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
    definitionOfReady: planned.dependsOn.length === 0 ? ['Objectif et contexte projet disponibles'] : ['Tickets dépendants terminés'],
    definitionOfDone: planned.definitionOfDone,
    maxAttempts: 2,
    expectedArtifacts: planned.expectedArtifacts,
    humanGate: planned.kind === 'delivery' ? 'delivery-review' : undefined,
  }));
}

function implementationTickets(normalized: string, objective: string, riskLevel: RiskLevel): DeliveryTicketPlan[] {
  const capabilities: Array<{ key: string; title: string; capability: string; matches: string[] }> = [
    { key: 'frontend', title: 'Construire l’expérience utilisateur', capability: 'frontend', matches: ['interface', 'web', 'frontend', 'cockpit', 'dashboard', 'ecran', 'outil', 'application'] },
    { key: 'backend', title: 'Implémenter les règles et l’API', capability: 'backend', matches: ['api', 'backend', 'service', 'workflow', 'outil', 'application', 'plateforme'] },
    { key: 'data', title: 'Modéliser et persister les données', capability: 'data', matches: ['donnee', 'database', 'postgres', 'stockage', 'memoire', 'knowledge', 'ticket', 'epic'] },
    { key: 'integration', title: 'Brancher les intégrations nécessaires', capability: 'integration', matches: ['github', 'slack', 'notion', 'confluence', 'connecteur', 'integration', 'provider', 'fournisseur'] },
    { key: 'security', title: 'Appliquer les contrôles de sécurité', capability: 'security', matches: ['securite', 'secret', 'permission', 'auth', 'oidc', 'nis2', 'critique'] },
  ];
  const selected = capabilities.filter(({ matches }) => matches.some((keyword) => normalized.includes(keyword)));
  if (riskLevel !== 'standard' && !selected.some(({ key }) => key === 'security')) selected.push(capabilities[4]);
  if (selected.length === 0) selected.push({ key: 'implementation', title: 'Implémenter la capacité demandée', capability: 'engineering', matches: [] });
  return selected.map(({ key, title, capability }) => ticket(
    key,
    'delivery',
    title,
    objective,
    'implementation',
    capability,
    capability === 'security' ? 'medium' : 'large',
    ['architecture'],
    [`La capacité ${capability} répond à la demande sans élargir le périmètre`, 'Les erreurs et états limites sont explicites'],
    ['Code relu et typé strictement', 'Tests de comportement ajoutés', 'Aucun contrôle global désactivé'],
    [`${capability}-change`, `${capability}-test-report`],
  ));
}

function ticket(ticketKey: string, epicKey: string, title: string, objective: string, kind: DeliveryTicketPlan['kind'], capability: string, complexity: DeliveryTicketPlan['complexity'], dependsOn: string[], acceptanceCriteria: string[], definitionOfDone: string[], expectedArtifacts: string[]): DeliveryTicketPlan {
  return { ticketKey, epicKey, title, description: `${title}. Demande source : ${objective}`.slice(0, 5_000), kind, capability, complexity, dependsOn, acceptanceCriteria, definitionOfDone, expectedArtifacts };
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
