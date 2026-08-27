import { describe, expect, it } from 'vitest';
import { buildGitHubIssueDraft } from './github-issues';

describe('GitHub Issue draft', () => {
  it('produces bounded traceable Markdown from untrusted ticket content', () => {
    const draft = buildGitHubIssueDraft({
      id: 'ticket-123',
      externalId: 123,
      title: 'Créer\u0000 une Issue',
      description: 'Description\u0007 fournie par le demandeur.',
      labels: ['github', 'ticketing'],
      riskLevel: 'sensitive',
      acceptanceCriteria: ['Une seule Issue est créée.', 'Le lien est audité.'],
      definitionOfDone: ['Les tests passent.'],
      project: { name: 'Vistory OS' },
    });

    expect(draft.title).toBe('Créer  une Issue');
    expect(draft.body).toContain('<!-- vistory-ticket:ticket-123 -->');
    expect(draft.body).toContain('Une seule Issue est créée.');
    expect([...draft.body].filter((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
    })).toEqual([]);
    expect(draft.body.length).toBeLessThanOrEqual(50_000);
    expect(draft.payloadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps the reconciliation marker when ticket lists are oversized', () => {
    const draft = buildGitHubIssueDraft({
      id: 'ticket-large',
      externalId: 999,
      title: 'Ticket borné',
      description: 'x'.repeat(40_000),
      labels: Array.from({ length: 100 }, () => 'label'.repeat(50)),
      riskLevel: 'standard',
      acceptanceCriteria: Array.from({ length: 100 }, () => 'critère'.repeat(200)),
      definitionOfDone: Array.from({ length: 100 }, () => 'preuve'.repeat(200)),
      project: { name: 'Vistory OS' },
    });

    expect(draft.body).toContain('<!-- vistory-ticket:ticket-large -->');
    expect(draft.body.length).toBeLessThanOrEqual(50_000);
  });
});
