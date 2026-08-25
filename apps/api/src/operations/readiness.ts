import type { PrismaClient } from '@prisma/client';
import { githubSingleUserAuthReadiness } from '../auth/github-single-user';
import { providerConfiguration } from '../providers/providers';

export async function serviceReadiness(prisma: PrismaClient) {
  const providerPolicy = providerConfiguration();
  let database: 'ready' | 'not_ready' = 'not_ready';
  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'ready';
    } catch {
      database = 'not_ready';
    }
  }
  const singleUserAuth = githubSingleUserAuthReadiness();
  const tokenAccess = Boolean(process.env.COCKPIT_ACCESS_TOKEN && process.env.COCKPIT_ACCESS_TOKEN.length >= 32);
  const cockpitAccess = process.env.NODE_ENV !== 'production' || singleUserAuth.ready || tokenAccess;
  const workerAccess = process.env.NODE_ENV !== 'production' || Boolean(process.env.COCKPIT_WORKER_TOKEN && process.env.COCKPIT_WORKER_TOKEN.length >= 32);
  const ready = database === 'ready' && providerPolicy.valid && cockpitAccess && workerAccess;
  return {
    status: ready ? 'ready' as const : 'not_ready' as const,
    checks: {
      database,
      providerPolicy: providerPolicy.valid ? 'ready' as const : 'not_ready' as const,
      simulator: 'ready' as const,
      cockpitAccess: cockpitAccess ? 'ready' as const : 'not_ready' as const,
      workerAccess: workerAccess ? 'ready' as const : 'not_ready' as const,
    },
    authentication: { mode: singleUserAuth.ready ? singleUserAuth.mode : tokenAccess ? 'server-token' as const : 'unconfigured' as const, issues: singleUserAuth.issues },
    providers: { enabled: providerPolicy.enabled, unknown: providerPolicy.unknown, misconfigured: providerPolicy.misconfigured },
    timestamp: new Date().toISOString(),
  };
}
