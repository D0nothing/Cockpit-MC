import { describe, expect, it } from 'vitest';
import { canonicalHash } from './audit';
describe('audit integrity', () => {
  it('is deterministic', () => expect(canonicalHash({ action: 'x' })).toBe(canonicalHash({ action: 'x' })));
  it('detects mutations', () => expect(canonicalHash({ action: 'x' })).not.toBe(canonicalHash({ action: 'y' })));
});
