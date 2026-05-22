import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const tags = tagDB.getAll(session.userId);
    return NextResponse.json(tags);
  } catch (error) {
    console.error('Failed to fetch tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const color = typeof body.color === 'string' ? body.color : '';

    if (name.length === 0) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }
    if (name.length > 50) {
      return NextResponse.json({ error: 'Tag name must be 50 characters or fewer' }, { status: 400 });
    }
    if (!HEX_COLOR_RE.test(color)) {
      return NextResponse.json({ error: 'Tag color must be a valid hex value (e.g. #3B82F6)' }, { status: 400 });
    }

    const tag = tagDB.create(session.userId, { name, color });
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 });
    }
    console.error('Failed to create tag:', error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}
