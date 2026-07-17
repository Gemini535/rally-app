import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const protectedPaths = ['/', '/feed', '/me', '/leaderboard'];
const authPaths = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const protectedRoute = protectedPaths.includes(pathname) || pathname.startsWith('/log/');
  if (!user && protectedRoute) return NextResponse.redirect(new URL('/login', request.url));
  if (user && authPaths.includes(pathname)) return NextResponse.redirect(new URL('/', request.url));
  if (user && protectedRoute && pathname !== '/onboarding') {
    const { data } = await supabase.from('user_sports').select('id').eq('user_id', user.id).limit(1);
    if (data?.length === 0) return NextResponse.redirect(new URL('/onboarding', request.url));
  }
  return response;
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
