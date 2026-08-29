import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPullRequestEvidence } from './workflow-reconciliation';

describe('GitHub workflow reconciliation evidence', () => {
  const previousToken = process.env.GITHUB_TOKEN;

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
  });

  it('accepts only an open draft codex/* pull request with completed checks', async () => {
    process.env.GITHUB_TOKEN = 'bounded-test-token-value';
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ state: 'open', draft: true, head: { ref: 'codex/ticket-1000', sha: 'a'.repeat(40), repo: { full_name: 'D0nothing/print-my-mind' } } }))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [{ name: 'validate', status: 'completed', conclusion: 'success' }] }));

    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/D0nothing/print-my-mind/pull/23', fetcher)).resolves.toMatchObject({
      number: 23,
      branchName: 'codex/ticket-1000',
      headCommitSha: 'a'.repeat(40),
    });
  });

  it('refuses a ready-for-review PR, a foreign repository, or failed checks', async () => {
    process.env.GITHUB_TOKEN = 'bounded-test-token-value';
    const readyFetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ state: 'open', draft: false, head: { ref: 'codex/ticket-1000', sha: 'a'.repeat(40), repo: { full_name: 'D0nothing/print-my-mind' } } }));
    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/D0nothing/print-my-mind/pull/23', readyFetcher)).rejects.toThrow('open draft');
    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/other/repo/pull/23', readyFetcher)).rejects.toThrow('configured GitHub repository');

    const failedFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ state: 'open', draft: true, head: { ref: 'codex/ticket-1000', sha: 'a'.repeat(40), repo: { full_name: 'D0nothing/print-my-mind' } } }))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [{ name: 'validate', status: 'completed', conclusion: 'failure' }] }));
    await expect(fetchPullRequestEvidence('D0nothing', 'print-my-mind', 'https://github.com/D0nothing/print-my-mind/pull/23', failedFetcher)).rejects.toThrow('completed successfully');
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
