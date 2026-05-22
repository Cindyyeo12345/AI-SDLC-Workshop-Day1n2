import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { userDB, authenticatorDB } from '@/lib/db';
import { createSession } from '@/lib/auth';

function getRpID(request: NextRequest): string {
  const host = request.headers.get('host') || request.nextUrl.host;
  return host.split(':')[0];
}

export async function POST(request: NextRequest) {
  try {
    const body: AuthenticationResponseJSON = await request.json();

    const challenge = request.cookies.get('auth-challenge')?.value;
    const username = request.cookies.get('auth-username')?.value;

    if (!challenge || !username) {
      return NextResponse.json({ error: 'Authentication session expired' }, { status: 400 });
    }

    const rpID = getRpID(request);
    const user = userDB.findByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userAuthenticators = authenticatorDB.findByUserId(user.id);
    if (userAuthenticators.length === 0) {
      return NextResponse.json({ error: 'No authenticators registered for this user' }, { status: 404 });
    }

    const credentialId = Buffer.from(body.id, 'base64url').toString('base64');
    const authenticator = userAuthenticators.find(a => a.credential_id === credentialId)
      ?? (userAuthenticators.length === 1 ? userAuthenticators[0] : undefined);

    if (!authenticator) {
      return NextResponse.json({ error: 'Authenticator not found' }, { status: 404 });
    }

    const origin = request.headers.get('origin') || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        publicKey: Buffer.from(authenticator.credential_public_key, 'base64'),
        id: authenticator.credential_id,
        counter: authenticator.counter ?? 0,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    authenticatorDB.updateCounter(authenticator.credential_id, verification.authenticationInfo.newCounter);
    await createSession(user.id, user.username);

    const response = NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
    response.cookies.delete('auth-challenge');
    response.cookies.delete('auth-username');

    return response;
  } catch (error) {
    console.error('[AUTH] Authentication verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
