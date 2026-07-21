import { z } from 'zod';
import { GameTypeSchema, SentimentSchema, SkillLevelSchema, SportSlugSchema } from './enums.js';

const CursorSchema = z.string().min(1).optional();
const OptionalBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true').optional();

export const VenueSearchQuery = z.object({ sports: z.string().transform((value) => value.split(',').filter(Boolean).map((slug) => SportSlugSchema.parse(slug))).optional(), q: z.string().trim().max(100).optional(), lat: z.coerce.number().optional(), lng: z.coerce.number().optional(), radiusMeters: z.coerce.number().positive().max(50_000).default(5_000), city: z.string().trim().default('Chicago'), limit: z.coerce.number().int().min(1).max(50).default(20), cursor: CursorSchema, isIndoor: OptionalBooleanSchema, isFree: OptionalBooleanSchema, hasLights: OptionalBooleanSchema });
export const CreateEntryBody = z.object({ venueId: z.string().uuid(), sportSlug: SportSlugSchema, sentiment: SentimentSchema, note: z.string().max(2_000).nullable().optional(), tags: z.array(z.string().max(50)).max(10).default([]), playedAt: z.string().datetime() });
export const SubmitComparisonBody = z.object({ opponentEntryId: z.string().uuid(), winnerEntryId: z.string().uuid().nullable() });
export const CreateCheckInBody = z.object({ venueId: z.string().uuid(), sportSlug: SportSlugSchema, headcount: z.number().int().nonnegative().max(100), gameType: GameTypeSchema, skillLevel: SkillLevelSchema, note: z.string().max(500).nullable().optional() });
export const UpdateCheckInBody = z.object({ headcount: z.number().int().nonnegative().max(100).optional(), gameType: GameTypeSchema.optional(), skillLevel: SkillLevelSchema.optional(), note: z.string().max(500).nullable().optional(), endedAt: z.string().datetime().nullable().optional() }).refine((body) => Object.keys(body).length > 0, 'Provide at least one field.');
export const FollowBody = z.object({ userId: z.string().uuid() });
export const WantToTryBody = z.object({ venueId: z.string().uuid(), sportSlug: SportSlugSchema, source: z.string().max(100).optional() });
export const UpdateMeBody = z.object({ handle: z.string().trim().min(3).max(30).regex(/^[a-z0-9_]+$/), displayName: z.string().trim().min(1).max(80), avatarUrl: z.string().url().nullable().optional(), bio: z.string().max(500).nullable().optional(), homeCity: z.string().trim().min(1).max(100).optional(), homeLat: z.number().min(-90).max(90).nullable().optional(), homeLng: z.number().min(-180).max(180).nullable().optional(), sports: z.array(z.object({ sportSlug: SportSlugSchema, skillLevel: SkillLevelSchema, preferredGameTypes: z.array(GameTypeSchema), isPrimary: z.boolean() })).max(12).optional() });
export const FeedQuery = z.object({ cursor: CursorSchema, limit: z.coerce.number().int().min(1).max(50).optional() });
export const LeaderboardQuery = z.object({ sport: SportSlugSchema, city: z.string().trim().optional(), friendsOnly: OptionalBooleanSchema, cursor: CursorSchema, limit: z.coerce.number().int().min(1).max(100).optional() });
export const UserSearchQuery = z.object({ q: z.string().trim().min(1).max(100), cursor: CursorSchema, limit: z.coerce.number().int().min(1).max(50).optional() });

export type VenueSearchQueryInput = z.infer<typeof VenueSearchQuery>;
export type CreateEntryBodyInput = z.infer<typeof CreateEntryBody>;
export type SubmitComparisonBodyInput = z.infer<typeof SubmitComparisonBody>;
export type CreateCheckInBodyInput = z.infer<typeof CreateCheckInBody>;
export type UpdateCheckInBodyInput = z.infer<typeof UpdateCheckInBody>;
export type FollowBodyInput = z.infer<typeof FollowBody>;
export type WantToTryBodyInput = z.infer<typeof WantToTryBody>;
export type UpdateMeBodyInput = z.infer<typeof UpdateMeBody>;
export type FeedQueryInput = z.infer<typeof FeedQuery>;
export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuery>;
export type UserSearchQueryInput = z.infer<typeof UserSearchQuery>;
