import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import type {} from '../types/express.js';
import { ApiError } from './error.js';

function readUser(authorization?: string): { id: string; email: string | null } | null {
  if (!authorization?.startsWith('Bearer ') || !process.env.SUPABASE_JWT_SECRET) return null;
  try {
    const payload = jwt.verify(authorization.slice(7), process.env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) return null;
    return { id: payload.sub, email: typeof (payload as JwtPayload).email === 'string' ? (payload as JwtPayload).email : null };
  } catch {
    return null;
  }
}

export const requireAuth: RequestHandler = (request, _response, next) => {
  const user = readUser(request.header('authorization'));
  if (!user) return next(new ApiError('UNAUTHORIZED', 401, 'Authentication is required.'));
  request.user = user;
  next();
};

export const optionalAuth: RequestHandler = (request, _response, next) => {
  request.user = readUser(request.header('authorization'));
  next();
};
