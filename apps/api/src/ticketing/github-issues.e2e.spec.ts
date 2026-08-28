import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildGitHubIssueDraft, publishTicketToGitHubIssue } from './github-issues';

const databaseDescribe = process.env.DATABASE_URL ? describe : describe.skip;
const environment = { ENABLED_PROVIDERS: 'github-issues', GITHUB_ISSUES_TOKEN: 'test-github-issues-token-value' };

databaseDescribe('GitHub Issue synchronization E2E', () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  let projectId = '';

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: {
        name: `GitHub Issues E2E ${suffix}`,
        slug: `github-issues-${suffix}`,
        legalEntityId: `entity-${suffix}`,
        memoryNamespace: `memory-${suffix}`,
        knowledgeNamespace: `knowledge-${suffix}`,
        githubOwner: 'D0nothing',
        githubRepository: 'Cockpit-MC',
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.$disconnect();
  });

  it('creates one remote Issue and returns the durable link on retry', async () => {
    const ticket = await prisma.ticket.create({ data: ticketData(projectId, 1) });
    let calls = 0;
    const fetcher: typeof fetch = async (_input, init) => {
      calls += 1;
      expect(init?.method).toBe('POST');
      expect(JSON.stringify(init?.headers)).toContain(environment.GITHUB_ISSUES_TOKEN);
      return new Response(JSON.stringify({ number: 321, html_url: 'https://attacker.example/ignored' }), { status: 201 });
    };

    const created = await publishTicketToGitHubIssue(prisma, ticket.id, 'D0nothing', environment, fetcher);
    const retried = await publishTicketToGitHubIssue(prisma, ticket.id, 'D0nothing', environment, async () => {
      throw new Error('The provider must not be called twice');
    });

    expect(created).toMatchObject({ outcome: 'created', remoteId: '321', remoteUrl: 'https://github.com/D0nothing/Cockpit-MC/issues/321' });
    expect(retried).toMatchObject({ outcome: 'already-linked', remoteId: '321' });
    expect(calls).toBe(1);
    expect(await prisma.externalTicketSync.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  it('reconciles an uncertain external effect before creating another Issue', async () => {
    const ticket = await prisma.ticket.create({ data: ticketData(projectId, 2) });
    const draft = buildGitHubIssueDraft({ ...ticket, project: { name: `GitHub Issues E2E ${suffix}` } });
    await prisma.externalTicketSync.create({
      data: {
        projectId,
        ticketId: ticket.id,
        provider: 'github-issues',
        payloadHash: draft.payloadHash,
        requestedBy: 'D0nothing',
        updatedAt: new Date(Date.now() - 30_000),
      },
    });
    const methods: string[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      methods.push(init?.method ?? 'GET');
      return new Response(JSON.stringify([{ number: 654, body: `Remote body\n${draft.marker}` }]), { status: 200 });
    };

    const receipt = await publishTicketToGitHubIssue(prisma, ticket.id, 'D0nothing', environment, fetcher);

    expect(receipt).toMatchObject({ outcome: 'reconciled', remoteId: '654' });
    expect(methods).toEqual(['GET']);
  });

  it('updates the linked Issue when the Vistory ticket changes', async () => {
    const ticket = await prisma.ticket.create({ data: ticketData(projectId, 4) });
    await publishTicketToGitHubIssue(prisma, ticket.id, 'D0nothing', environment, async (_input, init) => {
      expect(init?.method).toBe('POST');
      return new Response(JSON.stringify({ number: 777 }), { status: 201 });
    });
    await prisma.ticket.update({ where: { id: ticket.id }, data: { title: 'Ticket GitHub révisé', acceptanceCriteria: ['Le contenu distant est actualisé.'] } });

    const receipt = await publishTicketToGitHubIssue(prisma, ticket.id, 'D0nothing', environment, async (input, init) => {
      expect(String(input)).toContain('/issues/777');
      expect(init?.method).toBe('PATCH');
      expect(String(init?.body)).toContain('Ticket GitHub révisé');
      return new Response(JSON.stringify({ number: 777 }), { status: 200 });
    });

    expect(receipt).toMatchObject({ outcome: 'updated', remoteId: '777' });
  });

  it('refuses the external effect when the provider is not enabled', async () => {
    const ticket = await prisma.ticket.create({ data: ticketData(projectId, 3) });
    await expect(publishTicketToGitHubIssue(prisma, ticket.id, 'D0nothing', { GITHUB_ISSUES_TOKEN: environment.GITHUB_ISSUES_TOKEN }, async () => {
      throw new Error('External call must remain denied');
    })).rejects.toMatchObject({ statusCode: 503 });
    expect(await prisma.externalTicketSync.count({ where: { ticketId: ticket.id } })).toBe(0);
  });
});

function ticketData(projectId: string, sequence: number) {
  return {
    projectId,
    externalId: 90_000 + sequence,
    title: `Ticket GitHub ${sequence}`,
    description: 'Créer une Issue de manière idempotente.',
    labels: ['github'],
    acceptanceCriteria: ['Une seule Issue existe.'],
    definitionOfDone: ['Le reçu est persisté.'],
  };
}
