import { describe, expect, it } from 'vitest';
import { buildRequestPlan, requestPlanToTaskNodes } from './planner';

describe('request planner', () => {
  it('decomposes a product request into epics and input-specific tickets', () => {
    const plan = buildRequestPlan({
      projectId: 'project-alpha',
      sessionId: 'session-1',
      objective: 'Créer un outil web avec API, tickets, Knowledge Base et connexion GitHub.',
      riskLevel: 'standard',
    });
    expect(plan.epics.map(({ epicKey }) => epicKey)).toEqual(['discovery', 'delivery', 'assurance']);
    expect(plan.tickets.map(({ ticketKey }) => ticketKey)).toEqual(['scope', 'architecture', 'frontend', 'backend', 'data', 'integration', 'verification', 'delivery-review']);
    expect(plan.tickets.find(({ ticketKey }) => ticketKey === 'verification')?.dependsOn).toEqual(['frontend', 'backend', 'data', 'integration']);
    expect(requestPlanToTaskNodes(plan).at(-1)?.humanGate).toBe('delivery-review');
  });

  it('adds a security ticket for non-standard risk without duplicating it', () => {
    const plan = buildRequestPlan({ projectId: 'project-alpha', sessionId: 'session-2', objective: 'Modifier une API critique avec authentification.', riskLevel: 'critical' });
    expect(plan.tickets.filter(({ capability }) => capability === 'security')).toHaveLength(1);
  });

  it('falls back to a generic engineering ticket for an unknown domain', () => {
    const plan = buildRequestPlan({ projectId: 'project-alpha', sessionId: 'session-3', objective: 'Calculer un résultat spécialisé.', riskLevel: 'standard' });
    expect(plan.tickets.some(({ ticketKey }) => ticketKey === 'implementation')).toBe(true);
  });
});
