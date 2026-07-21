import { createPublicKey, type KeyObject } from 'node:crypto';
import jwt, { type JwtHeader, type JwtPayload } from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import type {} from '../types/express.js';
import { ApiError } from './error.js';

type Jwk = { kid?: string; use?: string; kty?: string; crv?: string; [key: string]: string | undefined };
type CachedKeys = { expiresAt: number; keys: Map<string, KeyObject> };
let cachedKeys: CachedKeys | null = null;
const JWKS_TTL_MS = 10 * 60_000;

function toUser(payload: string | JwtPayload): { id: string; email: string | null } | null {
  if (typeof payload === 'string' || !payload.sub) return null;
  return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
}

async function jwks(): Promise<Map<string, KeyObject>> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Supabase URL is not configured.');
  const response = await fetch(`${base}/auth/v1/.well-known/jwks.json`);
  if (!response.ok) throw new Error(`Supabase JWKS fetch failed (${response.status}).`);
  const body = await response.json() as { keys?: Jwk[] };
  const keys = new Map<string, KeyObject>();
  for (const key of body.keys ?? []) {
    if (key.kid && key.kty === 'EC' && key.crv === 'P-256') keys.set(key.kid, createPublicKey({ key: key as never, format: 'jwk' }));
  }
  if (!keys.size) throw new Error('Supabase JWKS did not contain ES256 keys.');
  cachedKeys = { keys, expiresAt: Date.now() + JWKS_TTL_MS };
  return keys;
}

function tokenFromCookie(cookie?: string): string | null {
  const chunks = (cookie ?? '').split(';').map((part) => part.trim()).flatMap((part) => {
    const match = /^(sb-[^=]+-auth-token)(?:\.(\d+))?=(.*)$/.exec(part);
    return match ? [{ index: Number(match[2] ?? 0), value: match[3] }] : [];
  }).sort((left, right) => left.index - right.index);
  const value = chunks.map((chunk) => chunk.value).join('');
  if (!value) return null;
  const decoded = decodeURIComponent(value);
  try {
    const json = decoded.startsWith('base64-') ? Buffer.from(decoded.slice(7), 'base64url').toString('utf8') : decoded;
    const parsed = JSON.parse(json) as { access_token?: string } | [string, string];
    return Array.isArray(parsed) ? parsed[0] : parsed.access_token ?? null;
  } catch { return null; }
}

async function readUser(authorization?: string, cookie?: string): Promise<{ id: string; email: string | null } | null> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : tokenFromCookie(cookie);
  if (!token) return null;
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string') return null;
  try {
    const header = decoded.header as JwtHeader;
    if (header.alg === 'HS256' && process.env.SUPABASE_JWT_SECRET) return toUser(jwt.verify(token, process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }));
    if (header.alg !== 'ES256' || !header.kid) return null;
    const key = (await jwks()).get(header.kid);
    const issuer = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') + '/auth/v1';
    if (!key || !issuer) return null;
    return toUser(jwt.verify(token, key, { algorithms: ['ES256'], issuer }));
  } catch { return null; }
}

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const user = await readUser(request.header('authorization'), request.header('cookie'));
  if (!user) return next(new ApiError('UNAUTHORIZED', 401, 'Authentication is required.'));
  request.user = user;
  next();
};

export const optionalAuth: RequestHandler = async (request, _response, next) => { request.user = await readUser(request.header('authorization'), request.header('cookie')); next(); };

export function clearJwksCacheForTests() { cachedKeys = null; }
