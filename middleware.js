import { NextResponse } from 'next/server';

/**
 * Per-IP rate limiting for /api/hustle
 * Limit: 5 requests per IP per 60-second sliding window
 *
 * NOTE: This Map is in-memory and scoped to a single edge-function instance.
 * For multi-region persistence use Vercel KV. This is correct and sufficient
 * for the vast majority of single-region / low-traffic deployments.
 */
const rateLimitMap = new Map();
const LIMIT = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

export function middleware(request) {
  if (request.nextUrl.pathname === '/api/hustle') {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Keep only timestamps within the current window
    const timestamps = (rateLimitMap.get(ip) || []).filter(
      (t) => t > windowStart
    );

    if (timestamps.length >= LIMIT) {
      const retryAfter = Math.ceil(
        (timestamps[0] + WINDOW_MS - now) / 1000
      );
      return NextResponse.json(
        {
          error:
            'Too many requests. Please wait a minute before trying again.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(LIMIT),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(
              Math.ceil((timestamps[0] + WINDOW_MS) / 1000)
            ),
          },
        }
      );
    }

    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(LIMIT));
    response.headers.set(
      'X-RateLimit-Remaining',
      String(LIMIT - timestamps.length)
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/hustle',
};
