import { NextRequest, NextResponse } from 'next/server';
import { userDB } from '@/lib/db';
import { createSession } from '@/lib/auth';

// Only available in development — never exposed in production builds
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    const { username } = await request.json();

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const name = username.trim();

    // Find or create the user so any dev username works
    let user = userDB.findByUsername(name);
    if (!user) {
      user = userDB.create(name);
    }

    await createSession(user.id, user.username);

    return NextResponse.json({ success: true, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'Dev login failed' }, { status: 500 });
  }
}
