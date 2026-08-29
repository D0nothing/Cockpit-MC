import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPullRequestEvidence } from './workflow-reconciliation';

describe('GitHub workflow reconciliation evidence', () => {
  const previousToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
  });

  it('accepts only an open draft codex/* pull request with successful pull request workflows', async () => {
    process.env.GITHUB_TOKEN = 'bounded-test-token-value';
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ state: 'open', draft: true, head: { ref: 'codex/ticket-1000', sha: 'a'.repeat(40), repo: { full_name: 'D0nothing/print-my-mind' } } }))
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [{ name: 'validate', event: 'pull_request', head_sha: 'a'.repeat(40), status: 'completed', conclusion: 'success' }] }));

    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/D0nothing/print-my-mind/pull/23', fetcher)).resolves.toMatchObject({
      number: 23,
      branchName: 'codex/ticket-1000',
      headCommitSha: 'a'.repeat(40),
      workflowRuns: [{ name: 'validate', conclusion: 'success' }],
    });
    expect(fetcher.mock.calls[1]?.[0]).toContain('/actions/runs?event=pull_request&head_sha=');
  });

  it('refuses a ready-for-review PR, a foreign repository, or failed workflows', async () => {
    process.env.GITHUB_TOKEN = 'bounded-test-token-value';
    const readyFetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ state: 'open', draft: false, head: { ref: 'codex/ticket-1000', sha: 'a'.repeat(40), repo: { full_name: 'D0nothing/print-my-mind' } } }));
    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/D0nothing/print-my-mind/pull/23', readyFetcher)).rejects.toThrow('open draft');
    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/other/repo/pull/23', readyFetcher)).rejects.toThrow('configured GitHub repository');

    const failedFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ state: 'open', draft: true, head: { ref: 'codex/ticket-1000', sha: 'a'.repeat(40), repo: { full_name: 'D0nothing/print-my-mind' } } }))
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [{ name: 'validate', event: 'pull_request', head_sha: 'a'.repeat(40), status: 'completed', conclusion: 'failure' }] }));
    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/D0nothing/print-my-mind/pull/23', failedFetcher)).rejects.toThrow('completed successfully');

    const foreignEvidenceFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ state: 'open', draft: true, head: { ref: 'codex/ticket-1000', sha: 'a'.repeat(40), repo: { full_name: 'D0nothing/print-my-mind' } } }))
      .mockResolvedValueOnce(jsonResponse({ workflow_runs: [{ name: 'validate', event: 'push', head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'success' }] }));
    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/D0nothing/print-my-mind/pull/23', foreignEvidenceFetcher)).rejects.toThrow('completed successfully');
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
