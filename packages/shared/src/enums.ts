import { z } from 'zod';

export const SportSlugSchema = z.enum([
  'basketball', 'pickleball', 'tennis', 'soccer', 'volleyball', 'baseball',
  'softball', 'running_track', 'golf_range', 'skate', 'football', 'handball',
]);
export const SentimentSchema = z.enum(['LIKED', 'FINE', 'DISLIKED']);
export const SkillLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ANY']);
export const GameTypeSchema = z.enum(['PICKUP', 'CASUAL', 'COMPETITIVE', 'DRILLS', 'LEAGUE', 'SOLO']);
export const SurfaceSchema = z.enum(['HARDWOOD', 'ASPHALT', 'CONCRETE', 'CLAY', 'GRASS', 'TURF', 'RUBBER', 'SAND', 'OTHER']);
export const EntryStatusSchema = z.enum(['RANKING', 'RANKED']);
export const SessionStatusSchema = z.enum(['ACTIVE', 'DONE']);
export const ActivityTypeSchema = z.enum(['RANKED_VENUE', 'CHECKED_IN', 'WANT_TO_TRY', 'FOLLOWED', 'REVIEWED']);

export type SportSlug = z.infer<typeof SportSlugSchema>;
export type Sentiment = z.infer<typeof SentimentSchema>;
export type SkillLevel = z.infer<typeof SkillLevelSchema>;
export type GameType = z.infer<typeof GameTypeSchema>;
export type Surface = z.infer<typeof SurfaceSchema>;
export type EntryStatus = z.infer<typeof EntryStatusSchema>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export type ActivityType = z.infer<typeof ActivityTypeSchema>;
