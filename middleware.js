import { NextResponse } from 'next/server';

const rateLimitMap = new Map();

export function middleware(request) {
  const ip = request.headers.get('x-forwarded-for') ?? 
              request.headers.get('x-real-ip') ?? 
              '127.0.0.1';
  
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 5;

  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < windowMs);
  
  if (timestamps.length >= max) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please wait a minute.' }),
      { 
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Limit': String(max),
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  
  return NextResponse.next();
}

export const config = { matcher: '/api/hustle' };
