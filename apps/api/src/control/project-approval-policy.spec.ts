import { ProjectApprovalMode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  assertSoloDevelopmentBoundary,
  assertSoloSelfApproval,
  boundedSoloDevelopmentExecution,
  effectiveApprovalMode,
} from './project-approval-policy';

describe('project approval policy', () => {
  const fourEyes = { approvalMode: ProjectApprovalMode.FOUR_EYES, approvalPolicyVersion: 1, soloDevExpiresAt: null };
  const solo = { approvalMode: ProjectApprovalMode.SOLO_DEV, approvalPolicyVersion: 2, soloDevExpiresAt: new Date('2030-01-02T00:00:00.000Z') };
  const now = new Date('2030-01-01T00:00:00.000Z');

  it('keeps FOUR_EYES strict by default and after SOLO_DEV expiry', () => {
    expect(effectiveApprovalMode(fourEyes, now)).toBe(ProjectApprovalMode.FOUR_EYES);
    expect(effectiveApprovalMode({ ...solo, soloDevExpiresAt: new Date('2029-12-31T23:59:59.000Z') }, now)).toBe(ProjectApprovalMode.FOUR_EYES);
    expect(() => assertSoloSelfApproval(fourEyes, 1, true, now)).toThrow('cannot decide');
  });

  it('allows one explicitly confirmed self-approval only on the solo project', () => {
    expect(() => assertSoloSelfApproval(solo, 1, true, now)).not.toThrow();
    expect(() => assertSoloSelfApproval(solo, 1, false, now)).toThrow('explicit confirmation');
    expect(() => assertSoloSelfApproval(solo, 2, true, now)).toThrow('multi-party');
    expect(() => assertSoloSelfApproval(fourEyes, 1, true, now)).toThrow('cannot decide');
  });

  it('blocks production and every unbounded external effect in SOLO_DEV', () => {
    const safe = boundedSoloDevelopmentExecution('codex/ticket-1000');
    expect(() => assertSoloDevelopmentBoundary(solo, safe, now)).not.toThrow();
    for (const unsafe of [
      { ...safe, branchName: 'main' },
      { ...safe, draftPullRequest: false },
      { ...safe, testsRequired: false },
      { ...safe, autoMerge: true },
      { ...safe, productionDeployment: true },
      { ...safe, liveSecrets: true },
      { ...safe, liveBilling: true },
      { ...safe, liveGeneration: true },
      { ...safe, livePrintBroker: true },
    ]) expect(() => assertSoloDevelopmentBoundary(solo, unsafe, now)).toThrow('SOLO_DEV only permits');
  });
});
