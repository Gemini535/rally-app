import { describe, expect, it } from 'vitest';
import { applyComparisonResult, eloUpdate, expectedScore, kendallTau, maxSteps, nextComparisonIndex, resolveInsertIndex, scoreBand, shrunkElo, tasteAffinity } from './core.js';

describe('ranking core', () => {
  it('caps binary-search steps', () => {
    expect([0, 1, 2, 3, 7, 15, 16, 31, 50].map(maxSteps)).toEqual([0, 1, 2, 2, 3, 4, 5, 5, 5]);
  });

  it('finds binary insertion positions', () => {
    const insert = (wins: boolean[]) => {
      let lo = 0; let hi = 7;
      for (const won of wins) { const mid = nextComparisonIndex(lo, hi); if (mid === null) break; ({ lo, hi } = applyComparisonResult(lo, hi, mid, won)); }
      return resolveInsertIndex(lo, hi, wins.length, 3);
    };
    expect(insert([true, true, true])).toBe(0);
    expect(insert([false, false, false])).toBe(7);
    expect(insert([true, false, true])).toBe(2);
  });

  it('scores each sentiment band without overlap', () => {
    expect(scoreBand('LIKED', 1, 1)).toBe(8.4);
    expect([1, 2, 3, 4, 5].map((position) => scoreBand('LIKED', 5, position))).toEqual([10, 9.2, 8.4, 7.5, 6.7]);
    expect(scoreBand('LIKED', 2, 2)).toBeGreaterThan(scoreBand('FINE', 2, 1));
    expect(scoreBand('FINE', 2, 2)).toBeGreaterThan(scoreBand('DISLIKED', 2, 1));
  });

  it('updates Elo and calculates expectations', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1900, 1500)).toBeCloseTo(0.9091, 3);
    expect(eloUpdate(1500, 1500, 0, 0, true)).toEqual({ ra: 1516, rb: 1484 });
  });

  it('shrinks small-sample outliers more strongly', () => {
    expect(Math.abs(shrunkElo(1700, 2) - 1500)).toBeLessThan(Math.abs(shrunkElo(1700, 50) - 1500));
  });

  it('computes tau-b for ranks and affinity', () => {
    expect(kendallTau([1, 2, 3], [1, 2, 3])).toBe(1);
    expect(kendallTau([1, 2, 3], [3, 2, 1])).toBe(-1);
    expect(kendallTau([1, 2, 3, 4], [1, 3, 2, 4])).toBeCloseTo(2 / 3);
    expect(tasteAffinity(-1, 2)).toBe(0.5);
  });
});
