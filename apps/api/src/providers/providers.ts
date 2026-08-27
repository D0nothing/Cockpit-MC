import type { PrismaClient } from '@prisma/client';
import { HttpError, requireDatabase } from '../http';

export const providerIds = ['worker-simulator', 'github-actions', 'github-issues', 'confluence', 'openai'] as const;
export type ProviderId = (typeof providerIds)[number];

interface ProjectProviderConfig {
  id: string;
  githubOwner: string;
  githubRepository: string;
  confluenceSpaceKey: string | null;
}

export interface ProviderReadiness {
  id: ProviderId;
  capability: 'worker' | 'source-control' | 'ticketing' | 'knowledge' | 'model';
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
  const productionGateOpen = productionProviderGateIssues(environment, enabled).length === 0;
  return [
    readiness('worker-simulator', 'worker', 'simulator', true, true),
    readiness('github-actions', 'source-control', 'external', enabled.has('github-actions'), productionGateOpen && bounded(environment.GITHUB_TOKEN, 2_000, 20) && Boolean(project.githubOwner && project.githubRepository)),
    readiness('github-issues', 'ticketing', 'external', enabled.has('github-issues'), productionGateOpen && bounded(environment.GITHUB_ISSUES_TOKEN, 2_000, 20) && Boolean(project.githubOwner && project.githubRepository)),
    readiness('confluence', 'knowledge', 'external', enabled.has('confluence'), productionGateOpen && httpsOrigin(environment.CONFLUENCE_BASE_URL) && bounded(environment.CONFLUENCE_EMAIL, 320, 3) && bounded(environment.CONFLUENCE_API_TOKEN, 2_000, 20) && Boolean(project.confluenceSpaceKey)),
    readiness('openai', 'model', 'external', enabled.has('openai'), productionGateOpen && bounded(environment.CODEX_API_KEY, 2_000, 20)),
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
    enabled.has('github-issues') && !environment.GITHUB_ISSUES_TOKEN ? 'github-issues' : null,
    enabled.has('confluence') && !(environment.CONFLUENCE_BASE_URL && environment.CONFLUENCE_EMAIL && environment.CONFLUENCE_API_TOKEN) ? 'confluence' : null,
    enabled.has('openai') && !environment.CODEX_API_KEY ? 'openai' : null,
  ].filter((value): value is string => value !== null);
  const productionGateIssues = productionProviderGateIssues(environment, enabled);
  const gatedProviders = productionGateIssues.length === 0 ? [] : [...enabled].filter((provider) => provider !== 'worker-simulator');
  return {
    valid: unknown.length === 0 && misconfigured.length === 0 && productionGateIssues.length === 0,
    enabled: [...enabled],
    unknown,
    misconfigured: [...new Set([...misconfigured, ...gatedProviders])],
    productionGateIssues,
  };
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

function productionProviderGateIssues(environment: Environment, enabled: Set<ProviderId>): string[] {
  if (environment.NODE_ENV !== 'production' || [...enabled].every((provider) => provider === 'worker-simulator')) return [];
  return [
    httpsOrigin(environment.WEB_ORIGIN) ? null : 'WEB_ORIGIN',
    httpsOrigin(environment.APP_PUBLIC_URL) ? null : 'APP_PUBLIC_URL',
    httpsOrigin(environment.API_PUBLIC_URL) ? null : 'API_PUBLIC_URL',
    validGitHubLogin(environment.GITHUB_ALLOWED_LOGIN) ? null : 'GITHUB_ALLOWED_LOGIN',
    bounded(environment.AUTH_SESSION_SECRET, 500, 32) ? null : 'AUTH_SESSION_SECRET',
    bounded(environment.COCKPIT_WORKER_TOKEN, 500, 32) ? null : 'COCKPIT_WORKER_TOKEN',
  ].filter((value): value is string => value !== null);
}

function httpsOrigin(value: string | undefined): boolean {
  if (!bounded(value, 2_048)) return false;
  return value.split(',').every((part) => {
    try {
      const url = new URL(part.trim());
      return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
    } catch {
      return false;
    }
  });
}

function validGitHubLogin(value: string | undefined): boolean {
  return Boolean(value && /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value));
}

function bounded(value: string | undefined, max: number, min = 1): value is string {
  return Boolean(value && value.length >= min && value.length <= max);
}
