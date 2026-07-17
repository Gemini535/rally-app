import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from './error.js';

type ValidationSchemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (request, _response, next) => {
    try {
      if (schemas.body) request.body = schemas.body.parse(request.body);
      if (schemas.query) request.query = schemas.query.parse(request.query);
      if (schemas.params) request.params = schemas.params.parse(request.params);
      next();
    } catch (error) {
      const details = error instanceof Error && 'flatten' in error ? (error as { flatten: () => unknown }).flatten() : undefined;
      next(new ApiError('VALIDATION_ERROR', 422, 'Request validation failed.', details));
    }
  };
}
