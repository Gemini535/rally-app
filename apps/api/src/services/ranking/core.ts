import { ELO_BASE, ELO_K, ELO_SHRINK_C, MAX_COMPARISONS, SENTIMENT_BANDS } from '@rally/shared';
import type { Sentiment } from '@rally/shared';

export type RankingBands = Record<Sentiment, string[]>;

export function maxSteps(bandSize: number): number {
  return Math.min(MAX_COMPARISONS, Math.ceil(Math.log2(Math.max(0, bandSize) + 1)));
}

export function nextComparisonIndex(lo: number, hi: number): number | null {
  return lo < hi ? Math.floor((lo + hi) / 2) : null;
}

export function applyComparisonResult(lo: number, hi: number, mid: number, subjectWon: boolean) {
  return subjectWon ? { lo, hi: mid } : { lo: mid + 1, hi };
}

export function resolveInsertIndex(lo: number, hi: number, _stepsTaken: number, _maxSteps: number): number {
  return lo >= hi ? lo : Math.floor((lo + hi) / 2);
}

export function scoreBand(sentiment: Sentiment, size: number, position: number): number {
  if (size < 1 || position < 1 || position > size) throw new RangeError('Invalid band position.');
  const [low, high] = SENTIMENT_BANDS[sentiment];
  const score = size === 1 ? (low + high) / 2 : high - ((position - 1) * (high - low)) / (size - 1);
  return Math.round(score * 10 + 1e-8) / 10;
}

export function rescoreBand(sentiment: Sentiment, orderedEntryIds: string[]) {
  return orderedEntryIds.map((entryId, index) => ({ entryId, rallyScore: scoreBand(sentiment, orderedEntryIds.length, index + 1) }));
}

export function globalPositions(bands: RankingBands) {
  return ([...bands.LIKED, ...bands.FINE, ...bands.DISLIKED]).map((entryId, index) => ({ entryId, rankPosition: index + 1 }));
}

export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

export function kFactor(nComparisons: number): number {
  return nComparisons < 10 ? ELO_K : nComparisons < 40 ? ELO_K * 0.6 : ELO_K * 0.3;
}

export function eloUpdate(ra: number, rb: number, nA: number, nB: number, aWon: boolean) {
  const scoreA = aWon ? 1 : 0;
  const deltaA = kFactor(nA) * (scoreA - expectedScore(ra, rb));
  const deltaB = kFactor(nB) * ((1 - scoreA) - expectedScore(rb, ra));
  return { ra: ra + deltaA, rb: rb + deltaB };
}

export function shrunkElo(elo: number, nComparisons: number): number {
  return ELO_BASE + (elo - ELO_BASE) * nComparisons / (nComparisons + ELO_SHRINK_C);
}

export function kendallTau(ranksA: number[], ranksB: number[]): number {
  if (ranksA.length !== ranksB.length) throw new RangeError('Rank arrays must have equal length.');
  let concordant = 0;
  let discordant = 0;
  let tiesA = 0;
  let tiesB = 0;
  for (let i = 0; i < ranksA.length; i += 1) {
    for (let j = i + 1; j < ranksA.length; j += 1) {
      const a = Math.sign(ranksA[i] - ranksA[j]);
      const b = Math.sign(ranksB[i] - ranksB[j]);
      if (a === 0 && b === 0) continue;
      if (a === 0) tiesA += 1;
      else if (b === 0) tiesB += 1;
      else if (a === b) concordant += 1;
      else discordant += 1;
    }
  }
  const denominator = Math.sqrt((concordant + discordant + tiesA) * (concordant + discordant + tiesB));
  return denominator === 0 ? 0 : (concordant - discordant) / denominator;
}

export function tasteAffinity(tau: number, overlapN: number): number {
  if (overlapN < 3) return 0.5;
  const shrunk = tau * overlapN / (overlapN + 3);
  return Math.max(0, Math.min(1, (shrunk + 1) / 2));
}
