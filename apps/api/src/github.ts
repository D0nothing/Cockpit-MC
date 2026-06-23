import { HttpError } from './http';

export async function dispatchCodex(ref: string, ticketId: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPOSITORY;
  const workflow = process.env.GITHUB_WORKFLOW_ID ?? 'codex.yml';

  if (!token || !owner || !repo) throw new HttpError(503, 'GitHub connector is not configured');

  const path = [owner, repo, 'actions', 'workflows', workflow, 'dispatches'].map(encodeURIComponent).join('/');
  const response = await fetch(`https://api.github.com/repos/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs: { ticket_id: ticketId, branch_name: ref } }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new HttpError(503, `GitHub dispatch failed (${response.status})`);
}
