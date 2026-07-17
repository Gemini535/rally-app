import type { SportSlug } from './enums.js';

export const SENTIMENT_BANDS = {
  LIKED: [6.7, 10.0],
  FINE: [3.4, 6.6],
  DISLIKED: [0.0, 3.3],
} as const;

export const MAX_COMPARISONS = 5;
export const CHECK_IN_TTL_MINUTES = 120;
export const IDEAL_COUNT: Record<SportSlug, number> = {
  basketball: 8, pickleball: 4, tennis: 4, soccer: 12, volleyball: 8, baseball: 12,
  softball: 12, running_track: 2, golf_range: 2, skate: 6, football: 12, handball: 4,
};
export const ELO_BASE = 1500;
export const ELO_K = 32;
export const ELO_SHRINK_C = 8;
