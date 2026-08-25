import { HttpError } from './http';
import { assertProviderReady } from './providers/providers';

interface GitHubTarget {
  id: string;
  githubOwner: string;
  githubRepository: string;
  confluenceSpaceKey: string | null;
}

export async function dispatchCodex(ref: string, ticketId: string, target: GitHubTarget): Promise<void> {
  await dispatchWorkflow(target, { ticket_id: ticketId, branch_name: ref });
}

export async function dispatchCodexTask(branchName: string, dispatchId: string, target: GitHubTarget): Promise<void> {
  await dispatchWorkflow(target, { dispatch_id: dispatchId, branch_name: branchName });
}

async function dispatchWorkflow(target: GitHubTarget, inputs: Record<string, string>): Promise<void> {
  assertProviderReady('github-actions', target);
  const token = process.env.GITHUB_TOKEN;
  const workflow = process.env.GITHUB_WORKFLOW_ID ?? 'codex.yml';

  if (!token) throw new HttpError(503, 'GitHub connector is not configured');
  const owner = githubSegment(target.githubOwner, 'owner');
  const repo = githubSegment(target.githubRepository, 'repository');
  const workflowId = githubSegment(workflow, 'workflow');

  const path = [owner, repo, 'actions', 'workflows', workflowId, 'dispatches'].map(encodeURIComponent).join('/');
  const response = await fetch(`https://api.github.com/repos/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main', inputs }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new HttpError(503, `GitHub dispatch failed (${response.status})`);
}

function githubSegment(value: string, name: string): string {
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(value)) throw new HttpError(503, `GitHub ${name} is invalid`);
  return value;
}
