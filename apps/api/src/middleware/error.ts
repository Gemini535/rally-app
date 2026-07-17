import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly details?: unknown) {
    super(message);
  }
}

export const notFound = (message = 'Resource not found.') => new ApiError('NOT_FOUND', 404, message);
export const forbidden = (message = 'You do not have access to this resource.') => new ApiError('FORBIDDEN', 403, message);
export const conflict = (message = 'This request conflicts with existing data.') => new ApiError('CONFLICT', 409, message);

export const asyncHandler = (handler: RequestHandler): RequestHandler => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: error.flatten() } });
    return;
  }
  request.log.error({ error }, 'Unhandled API error');
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
};
