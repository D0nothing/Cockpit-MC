import type { PrismaClient } from '@prisma/client';
import { HttpError, requireDatabase } from '../http';

export const providerIds = ['worker-simulator', 'github-actions', 'confluence', 'openai'] as const;
export type ProviderId = (typeof providerIds)[number];

interface ProjectProviderConfig {
  id: string;
  githubOwner: string;
  githubRepository: string;
  confluenceSpaceKey: string | null;
}

export interface ProviderReadiness {
  id: ProviderId;
  capability: 'worker' | 'source-control' | 'knowledge' | 'model';
  mode: 'simulator' | 'external';
  enabled: boolean;
  configured: boolean;
  status: 'ready' | 'disabled' | 'misconfigured';
}

type Environment = Readonly<Record<string, string | undefined>>;

export async function listProviderReadiness(prisma: PrismaClient, projectId: string, environment: Environment = process.env): Promise<ProviderReadiness[]> {
  requireDatabase();
  const project = await prisma.project.findFirst({
    where: { id: projectId, status: 'active' },
    select: { id: true, githubOwner: true, githubRepository: true, confluenceSpaceKey: true },
  });
  if (!project) throw new HttpError(404, 'Active project not found');
  return providerReadiness(project, environment);
}

export function providerReadiness(project: ProjectProviderConfig, environment: Environment): ProviderReadiness[] {
  const enabled = enabledProviders(environment.ENABLED_PROVIDERS);
  return [
    readiness('worker-simulator', 'worker', 'simulator', true, true),
    readiness('github-actions', 'source-control', 'external', enabled.has('github-actions'), Boolean(environment.GITHUB_TOKEN && project.githubOwner && project.githubRepository)),
    readiness('confluence', 'knowledge', 'external', enabled.has('confluence'), Boolean(environment.CONFLUENCE_BASE_URL && environment.CONFLUENCE_EMAIL && environment.CONFLUENCE_API_TOKEN && project.confluenceSpaceKey)),
    readiness('openai', 'model', 'external', enabled.has('openai'), Boolean(environment.CODEX_API_KEY)),
  ];
}

export function assertProviderReady(providerId: ProviderId, project: ProjectProviderConfig, environment: Environment = process.env): void {
  const provider = providerReadiness(project, environment).find(({ id }) => id === providerId);
  if (!provider || provider.status === 'disabled') throw new HttpError(503, `${providerId} provider is disabled`);
  if (provider.status !== 'ready') throw new HttpError(503, `${providerId} provider is not configured`);
}

export function providerConfiguration(environment: Environment = process.env) {
  const enabled = enabledProviders(environment.ENABLED_PROVIDERS);
  const unknown = (environment.ENABLED_PROVIDERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value && !providerIds.includes(value as ProviderId));
  const misconfigured = [
    enabled.has('github-actions') && !environment.GITHUB_TOKEN ? 'github-actions' : null,
    enabled.has('confluence') && !(environment.CONFLUENCE_BASE_URL && environment.CONFLUENCE_EMAIL && environment.CONFLUENCE_API_TOKEN) ? 'confluence' : null,
    enabled.has('openai') && !environment.CODEX_API_KEY ? 'openai' : null,
  ].filter((value): value is string => value !== null);
  return { valid: unknown.length === 0 && misconfigured.length === 0, enabled: [...enabled], unknown, misconfigured };
}

function enabledProviders(value: string | undefined): Set<ProviderId> {
  return new Set((value ?? '')
    .split(',')
    .map((provider) => provider.trim())
    .filter((provider): provider is ProviderId => providerIds.includes(provider as ProviderId) && provider !== 'worker-simulator'));
}

function readiness(id: ProviderId, capability: ProviderReadiness['capability'], mode: ProviderReadiness['mode'], enabled: boolean, configured: boolean): ProviderReadiness {
  return { id, capability, mode, enabled, configured, status: !enabled ? 'disabled' : configured ? 'ready' : 'misconfigured' };
}
