import { describe, expect, it } from 'vitest';
import { assertProviderReady, providerConfiguration, providerReadiness } from './providers';

const project = { id: 'project-alpha', githubOwner: 'acme', githubRepository: 'factory', confluenceSpaceKey: 'FACTORY' };

describe('provider policy', () => {
  it('keeps every external provider disabled by default without exposing secrets', () => {
    const providers = providerReadiness(project, { GITHUB_TOKEN: 'secret-that-must-not-leak' });
    expect(providers.find(({ id }) => id === 'worker-simulator')?.status).toBe('ready');
    expect(providers.filter(({ mode }) => mode === 'external').every(({ status }) => status === 'disabled')).toBe(true);
    expect(JSON.stringify(providers)).not.toContain('secret-that-must-not-leak');
  });

  it('reports an explicitly enabled provider without credentials as misconfigured', () => {
    expect(providerReadiness(project, { ENABLED_PROVIDERS: 'github-actions' }).find(({ id }) => id === 'github-actions')?.status).toBe('misconfigured');
    expect(providerConfiguration({ ENABLED_PROVIDERS: 'github-actions,unknown' })).toEqual({
      valid: false,
      enabled: ['github-actions'],
      unknown: ['unknown'],
      misconfigured: ['github-actions'],
      productionGateIssues: [],
    });
  });

  it('allows GitHub only when it is enabled and configured for the project', () => {
    const environment = {
      ENABLED_PROVIDERS: 'github-actions,github-issues',
      GITHUB_TOKEN: 'configured-github-token-value',
      GITHUB_ISSUES_TOKEN: 'configured-issues-token-value',
    };
    expect(() => assertProviderReady('github-actions', project, environment)).not.toThrow();
    expect(() => assertProviderReady('github-issues', project, environment)).not.toThrow();
    expect(() => assertProviderReady('openai', project, environment)).toThrow('disabled');
  });

  it('keeps GitHub Issues disabled without an explicit provider grant and separate token', () => {
    expect(() => assertProviderReady('github-issues', project, { GITHUB_ISSUES_TOKEN: 'configured-issues-token-value' })).toThrow('disabled');
    expect(() => assertProviderReady('github-issues', project, { ENABLED_PROVIDERS: 'github-issues' })).toThrow('not configured');
  });

  it('blocks external providers in production until the security gate is complete', () => {
    const unsafeProduction = { NODE_ENV: 'production', ENABLED_PROVIDERS: 'github-actions', GITHUB_TOKEN: 'configured-github-token-value' };
    expect(providerReadiness(project, unsafeProduction).find(({ id }) => id === 'github-actions')?.status).toBe('misconfigured');
    expect(() => assertProviderReady('github-actions', project, unsafeProduction)).toThrow('not configured');

    const safeProduction = {
      NODE_ENV: 'production',
      ENABLED_PROVIDERS: 'github-actions',
      GITHUB_TOKEN: 'configured-github-token-value',
      WEB_ORIGIN: 'https://app.example',
      APP_PUBLIC_URL: 'https://app.example',
      API_PUBLIC_URL: 'https://api.example',
      GITHUB_ALLOWED_LOGIN: 'D0nothing',
      AUTH_SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
      COCKPIT_WORKER_TOKEN: 'test-worker-token-with-at-least-32-characters',
    };
    expect(providerConfiguration(safeProduction)).toMatchObject({ valid: true, productionGateIssues: [] });
    expect(() => assertProviderReady('github-actions', project, safeProduction)).not.toThrow();
  });
});
