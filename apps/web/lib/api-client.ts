'use client';

import type { ZodType } from 'zod';
import { ApiErrorSchema } from '@rally/shared';
import { mockVenues } from '@/lib/mocks/venues';

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: unknown) { super(message); }
}

export function apiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Something went sideways. Please try again.';
  if (error.code === 'UNAUTHORIZED') return 'Sign in again to make that change.';
  if (error.code === 'CONFLICT') return 'That already exists. Try a different choice.';
  if (error.code === 'VALIDATION_ERROR') return 'Check the details and try again.';
  if (error.code === 'FORBIDDEN') return 'You don’t have permission to do that.';
  return 'That didn’t save. Please try again.';
}

function throwApiError(error: ApiError): never {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rally-api-error', { detail: apiErrorMessage(error) }));
  throw error;
}

async function request<T>(method: string, path: string, body?: unknown, schema?: ZodType<T>) {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const payload: unknown = path.startsWith('/feed/recommended') ? { items: mockVenues, weights: { personal: .35, social: .25, proximity: .2, live: .2 } } : null;
    return schema ? schema.parse(payload) : payload as T;
  }
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}${path}`, {
    method, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) throwApiError(new ApiError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.details));
    throwApiError(new ApiError('INTERNAL_ERROR', 'The API returned an invalid error response.'));
  }
  return schema ? schema.parse(json) : json as T;
}

export const api = {
  get: <T>(path: string, schema?: ZodType<T>) => request<T>('GET', path, undefined, schema),
  post: <T>(path: string, body: unknown, schema?: ZodType<T>) => request<T>('POST', path, body, schema),
  patch: <T>(path: string, body: unknown, schema?: ZodType<T>) => request<T>('PATCH', path, body, schema),
  delete: <T>(path: string, schema?: ZodType<T>) => request<T>('DELETE', path, undefined, schema),
};
