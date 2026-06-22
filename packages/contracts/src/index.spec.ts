import { describe, expect, it } from 'vitest';
import { canTransition } from './index';

describe('ticket state machine', () => {
  it('accepts the validated workflow', () => expect(canTransition('spec_validated', 'ready_for_ai')).toBe(true));
  it('forbids bypassing validation', () => expect(canTransition('imported', 'ai_requested')).toBe(false));
  it('forbids an automatic merge state', () => expect(canTransition('human_review_required', 'done')).toBe(true));
});
