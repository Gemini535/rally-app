import { z } from 'zod';
import {
  ActivityTypeSchema, EntryStatusSchema, GameTypeSchema, SentimentSchema,
  SessionStatusSchema, SkillLevelSchema, SportSlugSchema, SurfaceSchema,
} from './enums.js';

const IsoDateTimeSchema = z.string().datetime();
const NullableNumberSchema = z.number().nullable();

export const UserMiniSchema = z.object({
  id: z.string().uuid(), handle: z.string(), displayName: z.string(), avatarUrl: z.string().url().nullable(),
});

export const UserProfileSchema = UserMiniSchema.extend({
  bio: z.string().nullable(), homeCity: z.string(), homeLat: NullableNumberSchema, homeLng: NullableNumberSchema,
  isDemo: z.boolean(), createdAt: IsoDateTimeSchema,
  sports: z.array(z.object({ slug: SportSlugSchema, name: z.string(), skillLevel: SkillLevelSchema, isPrimary: z.boolean() })),
  followerCount: z.number().int().nonnegative(), followingCount: z.number().int().nonnegative(), isFollowing: z.boolean(),
});

export const VenueMiniSchema = z.object({
  id: z.string().uuid(), slug: z.string(), name: z.string(), neighborhood: z.string().nullable(), city: z.string(), photoUrl: z.string().url().nullable(),
});

export const LiveStatusSchema = z.object({
  activeCount: z.number().int().nonnegative(), headcount: z.number().int().nonnegative(),
  gameType: GameTypeSchema.nullable(), skillLevel: SkillLevelSchema.nullable(), lastCheckInAt: IsoDateTimeSchema,
});

export const RecoComponentsSchema = z.object({
  personal: NullableNumberSchema, social: NullableNumberSchema, proximity: NullableNumberSchema,
  live: NullableNumberSchema, gate: z.number(),
});

export const VenueCardSchema = VenueMiniSchema.extend({
  lat: z.number(), lng: z.number(), distanceMeters: NullableNumberSchema,
  sports: z.array(z.object({ slug: SportSlugSchema, name: z.string(), colorHex: z.string(), courtCount: z.number().int(), surface: SurfaceSchema.nullable() })),
  isIndoor: z.boolean(), isFree: z.boolean(), hasLights: z.boolean(), requiresReservation: z.boolean(),
  live: LiveStatusSchema.nullable(),
  myEntry: z.object({ rallyScore: z.number(), rankPosition: z.number().int(), totalRanked: z.number().int() }).nullable(),
  inWantToTry: z.boolean(), cityElo: z.number(),
  reco: z.object({ rallyScore: z.number(), components: RecoComponentsSchema, gateReason: z.string().nullable(), why: z.array(z.string()) }).nullable(),
});

export const VenueDetailSchema = VenueCardSchema.extend({
  address: z.string().nullable(), state: z.string(), country: z.string(), hasParking: z.boolean(),
  hasRestrooms: z.boolean(), hasWater: z.boolean(), source: z.string(), conditionNotes: z.string().nullable(),
  reviews: z.array(z.lazy(() => ReviewSchema)), checkIns: z.array(z.lazy(() => CheckInSchema)),
});

export const EntrySchema = z.object({
  id: z.string().uuid(), venue: VenueMiniSchema, sportSlug: SportSlugSchema, sentiment: SentimentSchema,
  rallyScore: z.number().nullable(), rankPosition: z.number().int().nullable(), status: EntryStatusSchema,
  note: z.string().nullable(), tags: z.array(z.string()), playedAt: IsoDateTimeSchema, createdAt: IsoDateTimeSchema, updatedAt: IsoDateTimeSchema,
});

export const RankedEntrySchema = EntrySchema.extend({
  rallyScore: z.number(), rankPosition: z.number().int(), totalRanked: z.number().int(),
});

export const ComparisonSessionSchema = z.object({
  id: z.string().uuid(), sportSlug: SportSlugSchema, status: SessionStatusSchema, step: z.number().int(), maxSteps: z.number().int(), subject: VenueMiniSchema,
  nextPair: z.object({ opponentEntryId: z.string().uuid(), opponent: VenueMiniSchema }).nullable(),
  result: z.object({ entryId: z.string().uuid(), rallyScore: z.number(), rankPosition: z.number().int(), totalRanked: z.number().int(), sentiment: SentimentSchema, beat: z.array(VenueMiniSchema) }).nullable(),
});

export const CheckInSchema = z.object({
  id: z.string().uuid(), user: UserMiniSchema, venue: VenueMiniSchema, sportSlug: SportSlugSchema,
  startedAt: IsoDateTimeSchema, expiresAt: IsoDateTimeSchema, endedAt: IsoDateTimeSchema.nullable(),
  headcount: z.number().int().nonnegative(), gameType: GameTypeSchema, skillLevel: SkillLevelSchema, note: z.string().nullable(),
});

export const ReviewSchema = z.object({
  id: z.string().uuid(), user: UserMiniSchema, venueId: z.string().uuid(), sportSlug: SportSlugSchema,
  body: z.string(), photos: z.array(z.string().url()), createdAt: IsoDateTimeSchema,
});

export const ActivitySchema = z.object({
  id: z.string().uuid(), actor: UserMiniSchema, type: ActivityTypeSchema, venue: VenueMiniSchema.nullable(),
  sportSlug: SportSlugSchema.nullable(), entry: EntrySchema.nullable(), checkIn: CheckInSchema.nullable(),
  targetUser: UserMiniSchema.nullable(), payload: z.record(z.unknown()), createdAt: IsoDateTimeSchema,
});

export const LeaderboardRowSchema = z.object({
  rank: z.number().int().positive(), venue: VenueMiniSchema, sportSlug: SportSlugSchema, elo: z.number(),
  confidenceScore: z.number(), nComparisons: z.number().int().nonnegative(), avgRallyScore: z.number().nullable(), nEntries: z.number().int().nonnegative(),
});

export type UserMini = z.infer<typeof UserMiniSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type VenueMini = z.infer<typeof VenueMiniSchema>;
export type LiveStatus = z.infer<typeof LiveStatusSchema>;
export type RecoComponents = z.infer<typeof RecoComponentsSchema>;
export type VenueCard = z.infer<typeof VenueCardSchema>;
export type VenueDetail = z.infer<typeof VenueDetailSchema>;
export type Entry = z.infer<typeof EntrySchema>;
export type RankedEntry = z.infer<typeof RankedEntrySchema>;
export type ComparisonSession = z.infer<typeof ComparisonSessionSchema>;
export type CheckIn = z.infer<typeof CheckInSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;
