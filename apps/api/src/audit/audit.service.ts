import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service';

export interface AuditInput { actorId: string; action: string; targetType: string; targetId: string; metadata?: Record<string, unknown> }

export function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, Object.keys(value as object).sort())).digest('hex');
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async record(input: AuditInput) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.auditEvent.findFirst({ orderBy: { occurredAt: 'desc' } });
      const occurredAt = new Date();
      const metadata = input.metadata ?? {};
      const contentHash = canonicalHash(metadata);
      const integrityHash = canonicalHash({ ...input, metadata, occurredAt: occurredAt.toISOString(), contentHash, previousHash: previous?.integrityHash ?? null });
      return tx.auditEvent.create({ data: { ...input, metadata: metadata as Prisma.InputJsonValue, occurredAt, contentHash, previousHash: previous?.integrityHash, integrityHash } });
    });
  }
  list() { return this.prisma.auditEvent.findMany({ orderBy: { occurredAt: 'desc' }, take: 100 }); }
}
