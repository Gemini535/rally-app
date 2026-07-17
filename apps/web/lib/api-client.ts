'use client';

import type { ZodType } from 'zod';
import { ApiErrorSchema } from '@rally/shared';
import { createClient } from '@/lib/supabase/client';

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: unknown) { super(message); }
}

async function request<T>(method: string, path: string, body?: unknown, schema?: ZodType<T>) {
  const { data: { session } } = await createClient().auth.getSession();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    if (parsed.success) throw new ApiError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.details);
    throw new ApiError('INTERNAL_ERROR', 'The API returned an invalid error response.');
  }
  return schema ? schema.parse(json) : json as T;
}

export const api = {
  get: <T>(path: string, schema?: ZodType<T>) => request<T>('GET', path, undefined, schema),
  post: <T>(path: string, body: unknown, schema?: ZodType<T>) => request<T>('POST', path, body, schema),
  patch: <T>(path: string, body: unknown, schema?: ZodType<T>) => request<T>('PATCH', path, body, schema),
  delete: <T>(path: string, schema?: ZodType<T>) => request<T>('DELETE', path, undefined, schema),
};
