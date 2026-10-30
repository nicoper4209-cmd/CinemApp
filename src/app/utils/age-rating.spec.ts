import { describe, expect, it } from 'vitest';
import { requiresAccompanyingAdult } from './age-rating';

describe('age-rating notice', () => {
  it.each([
    ['ATP', false],
    ['+13', true],
    ['+18', true],
    [undefined, false],
  ])('classifies %s for the accompanying-adult notice', (rating, expected) => {
    expect(requiresAccompanyingAdult(rating)).toBe(expected);
  });
});
