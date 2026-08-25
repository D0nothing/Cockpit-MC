import { apiRequest, array, integer, object, string } from './data';

export type KnowledgeScope = 'project' | 'common';

export interface FeedbackItem {
  id: string;
  sessionId: string;
  runId: string;
  artifactId: string;
  authorId: string;
  kind: string;
  rating: number;
  comment: string;
  createdAt: string;
  candidateId: string | null;
}

export interface KnowledgeEntryItem {
  id: string;
  key: string;
  version: number;
  scope: KnowledgeScope;
  status: string;
  content: string;
  citation: string;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface KnowledgeCandidateItem {
  id: string;
  feedbackId: string;
  proposedBy: string;
  scope: KnowledgeScope;
  key: string;
  title: string;
  content: string;
  status: string;
  requiredApprovals: number;
  decisions: Array<{ approverId: string; result: string; reason: string }>;
  entry: KnowledgeEntryItem | null;
}

export async function getFeedback(projectId: string): Promise<FeedbackItem[]> {
  return array(await apiRequest(`/feedback?projectId=${encodeURIComponent(projectId)}`), 'Feedback').map(feedbackItem);
}

export async function getKnowledgeCandidates(projectId: string): Promise<KnowledgeCandidateItem[]> {
  return array(await apiRequest(`/knowledge/candidates?projectId=${encodeURIComponent(projectId)}`), 'Knowledge candidates').map(candidateItem);
}

export async function getKnowledgeEntries(projectId: string): Promise<KnowledgeEntryItem[]> {
  return array(await apiRequest(`/knowledge?projectId=${encodeURIComponent(projectId)}`), 'Knowledge entries').map(entryItem);
}

export async function proposeKnowledge(input: { projectId: string; feedbackId: string; scope: KnowledgeScope; key: string; title: string; content: string }): Promise<void> {
  await apiRequest('/knowledge/candidates', {
    method: 'POST',
    body: JSON.stringify({ ...input, proposedBy: 'user-alice', confirmCommonScope: input.scope === 'common' }),
  });
}

export async function decideKnowledge(projectId: string, candidateId: string, approverId: string): Promise<void> {
  await apiRequest(`/knowledge/candidates/${encodeURIComponent(candidateId)}/decisions`, {
    method: 'POST',
    body: JSON.stringify({ projectId, approverId, result: 'approved', reason: 'Validation indépendante depuis le cockpit Vistory OS.' }),
  });
}

export async function promoteKnowledge(projectId: string, candidateId: string): Promise<void> {
  await apiRequest(`/knowledge/candidates/${encodeURIComponent(candidateId)}/promote`, {
    method: 'POST',
    body: JSON.stringify({ projectId, actorId: 'knowledge-curator' }),
  });
}

export async function revokeKnowledge(projectId: string, entryId: string, reason: string): Promise<void> {
  await apiRequest(`/knowledge/${encodeURIComponent(entryId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ projectId, actorId: 'knowledge-curator', reason }),
  });
}

function feedbackItem(value: unknown): FeedbackItem {
  const input = object(value, 'Feedback item');
  const candidate = nullableObject(input.candidate, 'Feedback candidate');
  return {
    id: string(input.id, 'Feedback.id'),
    sessionId: string(input.sessionId, 'Feedback.sessionId'),
    runId: string(input.runId, 'Feedback.runId'),
    artifactId: string(input.artifactId, 'Feedback.artifactId'),
    authorId: string(input.authorId, 'Feedback.authorId'),
    kind: string(input.kind, 'Feedback.kind'),
    rating: integer(input.rating, 'Feedback.rating'),
    comment: string(input.comment, 'Feedback.comment'),
    createdAt: string(input.createdAt, 'Feedback.createdAt'),
    candidateId: candidate ? string(candidate.id, 'Feedback.candidate.id') : null,
  };
}

function candidateItem(value: unknown): KnowledgeCandidateItem {
  const input = object(value, 'Knowledge candidate');
  const entry = nullableObject(input.entry, 'Knowledge candidate.entry');
  return {
    id: string(input.id, 'Knowledge candidate.id'),
    feedbackId: string(input.feedbackId, 'Knowledge candidate.feedbackId'),
    proposedBy: string(input.proposedBy, 'Knowledge candidate.proposedBy'),
    scope: scope(input.scope, 'Knowledge candidate.scope'),
    key: string(input.key, 'Knowledge candidate.key'),
    title: string(input.title, 'Knowledge candidate.title'),
    content: string(input.content, 'Knowledge candidate.content'),
    status: string(input.status, 'Knowledge candidate.status'),
    requiredApprovals: integer(input.requiredApprovals, 'Knowledge candidate.requiredApprovals'),
    decisions: array(input.decisions, 'Knowledge candidate.decisions').map((decisionValue) => {
      const decision = object(decisionValue, 'Knowledge decision');
      return { approverId: string(decision.approverId, 'Knowledge decision.approverId'), result: string(decision.result, 'Knowledge decision.result'), reason: string(decision.reason, 'Knowledge decision.reason') };
    }),
    entry: entry ? entryItem(entry) : null,
  };
}

function entryItem(value: unknown): KnowledgeEntryItem {
  const input = object(value, 'Knowledge entry');
  const id = string(input.id, 'Knowledge entry.id');
  const version = integer(input.version, 'Knowledge entry.version');
  return {
    id,
    key: string(input.key, 'Knowledge entry.key'),
    version,
    scope: scope(input.scope, 'Knowledge entry.scope'),
    status: string(input.status, 'Knowledge entry.status'),
    content: string(input.content, 'Knowledge entry.content'),
    citation: typeof input.citation === 'string' ? input.citation : `kb:${id}@${version}`,
    revokedAt: nullableString(input.revokedAt, 'Knowledge entry.revokedAt'),
    revocationReason: nullableString(input.revocationReason, 'Knowledge entry.revocationReason'),
  };
}

function scope(value: unknown, path: string): KnowledgeScope {
  if (value !== 'project' && value !== 'common') throw new Error(`${path} is invalid`);
  return value;
}

function nullableObject(value: unknown, path: string): Record<string, unknown> | null {
  return value === null || value === undefined ? null : object(value, path);
}

function nullableString(value: unknown, path: string): string | null {
  return value === null || value === undefined ? null : string(value, path);
}
