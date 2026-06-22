import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class GithubService {
  private get config() { return { token: process.env.GITHUB_TOKEN, owner: process.env.GITHUB_OWNER, repo: process.env.GITHUB_REPOSITORY, workflow: process.env.GITHUB_WORKFLOW_ID ?? 'codex.yml' }; }
  async dispatchCodex(ref: string, ticketId: string): Promise<void> {
    const c = this.config;
    if (!c.token || !c.owner || !c.repo) throw new ServiceUnavailableException('GitHub connector is not configured');
    const response = await fetch(`https://api.github.com/repos/${c.owner}/${c.repo}/actions/workflows/${c.workflow}/dispatches`, {
      method: 'POST', headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs: { ticket_id: ticketId, branch_name: ref } }),
    });
    if (!response.ok) throw new ServiceUnavailableException(`GitHub dispatch failed (${response.status})`);
  }
}
