import { z } from 'zod';
import { ActivitySchema, CheckInSchema, ComparisonSessionSchema, EntrySchema, LeaderboardRowSchema, UserProfileSchema, VenueCardSchema, VenueDetailSchema } from './entities.js';

export const paginated = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const HealthResponseSchema = z.object({ ok: z.literal(true) });
export const VenueSearchResponseSchema = paginated(VenueCardSchema);
export const VenueDetailResponseSchema = z.object({ venue: VenueDetailSchema });
export const CreateEntryResponseSchema = z.object({ entry: EntrySchema, session: ComparisonSessionSchema.nullable() });
export const ComparisonSessionResponseSchema = z.object({ session: ComparisonSessionSchema });
export const CheckInResponseSchema = z.object({ checkIn: CheckInSchema });
export const MeResponseSchema = z.object({ user: UserProfileSchema });
export const FeedResponseSchema = paginated(ActivitySchema);
export const LeaderboardResponseSchema = paginated(LeaderboardRowSchema);

export type Paginated<T> = { items: T[]; nextCursor: string | null };
