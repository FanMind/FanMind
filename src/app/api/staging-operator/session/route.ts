import { NextRequest, NextResponse } from 'next/server';
import { createOperatorSessionRenewer } from '@/lib/stagingOperatorSession.mjs';
import { SUPABASE_ACCESS_TOKEN_COOKIE, SUPABASE_REFRESH_TOKEN_COOKIE } from '@/lib/supabase/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const renew = createOperatorSessionRenewer();

export async function POST(request: NextRequest) {
  const result = await renew({ url: request.url, method: request.method, headers: request.headers, bodyPresent: request.body !== null, refreshToken: request.cookies.get(SUPABASE_REFRESH_TOKEN_COOKIE)?.value }, process.env);
  const response = NextResponse.json({ ok: result.status === 200, code: result.code }, { status: result.status, headers: { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' } });
  if ('session' in result && result.session) {
    const options = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' };
    response.cookies.set(SUPABASE_ACCESS_TOKEN_COOKIE, result.session.access_token, { ...options, maxAge: result.session.expires_in });
    response.cookies.set(SUPABASE_REFRESH_TOKEN_COOKIE, result.session.refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 });
  }
  // Fixed, token-free audit event; no account details or upstream error content.
  if (result.status !== 404) console.info('staging_operator_session', { outcome: result.code });
  return response;
}
