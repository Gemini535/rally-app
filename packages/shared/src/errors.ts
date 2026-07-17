import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
  'VALIDATION_ERROR', 'RATE_LIMITED', 'INTERNAL_ERROR',
]);
export const ApiErrorSchema = z.object({
  error: z.object({ code: ApiErrorCodeSchema, message: z.string(), details: z.unknown().optional() }),
});

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
