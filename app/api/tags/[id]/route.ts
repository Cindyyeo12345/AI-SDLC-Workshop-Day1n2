import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tagId = Number(id);
    if (!Number.isInteger(tagId) || tagId <= 0) {
      return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 });
    }

    const body = await request.json();
    const updatePayload: { name?: string; color?: string } = {};

    if ('name' in body) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 });
      }
      if (body.name.trim().length > 50) {
        return NextResponse.json({ error: 'Tag name must be 50 characters or fewer' }, { status: 400 });
      }
      updatePayload.name = body.name.trim();
    }

    if ('color' in body) {
      if (typeof body.color !== 'string' || !HEX_COLOR_RE.test(body.color)) {
        return NextResponse.json({ error: 'Tag color must be a valid hex value (e.g. #3B82F6)' }, { status: 400 });
      }
      updatePayload.color = body.color;
    }

    const updated = tagDB.update(tagId, session.userId, updatePayload);
    if (!updated) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 });
    }
    console.error('Failed to update tag:', error);
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const tagId = Number(id);
    if (!Number.isInteger(tagId) || tagId <= 0) {
      return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 });
    }

    const deleted = tagDB.delete(tagId, session.userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete tag:', error);
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}
