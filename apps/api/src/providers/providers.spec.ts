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
    });
  });

  it('allows GitHub only when it is enabled and configured for the project', () => {
    const environment = { ENABLED_PROVIDERS: 'github-actions', GITHUB_TOKEN: 'configured' };
    expect(() => assertProviderReady('github-actions', project, environment)).not.toThrow();
    expect(() => assertProviderReady('openai', project, environment)).toThrow('disabled');
  });
});
