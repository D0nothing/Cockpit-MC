import { apiRequest, choice, object, string } from './data';

export interface GitHubIssueReceipt {
  ticketId: string;
  provider: 'github-issues';
  state: 'succeeded';
  remoteId: string;
  remoteUrl: string;
  outcome: 'created' | 'reconciled' | 'updated' | 'already-linked';
}

export async function publishTicketToGitHub(ticketId: string): Promise<GitHubIssueReceipt> {
  const value = object(await apiRequest(`/tickets/${encodeURIComponent(ticketId)}/github-issue`, { method: 'POST', body: '{}' }), 'GitHub Issue receipt');
  return {
    ticketId: string(value.ticketId, 'GitHub Issue receipt.ticketId'),
    provider: choice(value.provider, 'GitHub Issue receipt.provider', ['github-issues']),
    state: choice(value.state, 'GitHub Issue receipt.state', ['succeeded']),
    remoteId: string(value.remoteId, 'GitHub Issue receipt.remoteId'),
    remoteUrl: githubIssueUrl(value.remoteUrl),
    outcome: choice(value.outcome, 'GitHub Issue receipt.outcome', ['created', 'reconciled', 'updated', 'already-linked']),
  };
}

function githubIssueUrl(value: unknown): string {
  const text = string(value, 'GitHub Issue receipt.remoteUrl');
  const url = new URL(text);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !/^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/issues\/\d+$/.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new Error('GitHub Issue receipt.remoteUrl is invalid');
  }
  return url.toString();
}
