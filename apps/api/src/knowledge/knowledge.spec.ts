import { describe, expect, it } from 'vitest';
import { candidateDecisionRefusal, requiredKnowledgeApprovals } from './knowledge';

describe('governed Knowledge Base promotion', () => {
  const openCandidate = {
    proposedBy: 'proposer',
    feedbackAuthorId: 'feedback-author',
    status: 'proposed',
    expiresAt: new Date('2030-01-02T00:00:00.000Z'),
  };

  it('requires a stricter quorum for common knowledge', () => {
    expect(requiredKnowledgeApprovals('project')).toBe(1);
    expect(requiredKnowledgeApprovals('common')).toBe(2);
  });

  it('refuses self-approval by the proposer or feedback author', () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    expect(candidateDecisionRefusal(openCandidate, 'proposer', now)).toBe('self');
    expect(candidateDecisionRefusal(openCandidate, 'feedback-author', now)).toBe('self');
    expect(candidateDecisionRefusal(openCandidate, 'independent-reviewer', now)).toBeNull();
  });

  it('refuses expired and already decided candidates', () => {
    expect(candidateDecisionRefusal(openCandidate, 'reviewer', new Date('2030-01-03T00:00:00.000Z'))).toBe('expired');
    expect(candidateDecisionRefusal({ ...openCandidate, status: 'approved' }, 'reviewer', new Date('2030-01-01T00:00:00.000Z'))).toBe('state');
  });
});
