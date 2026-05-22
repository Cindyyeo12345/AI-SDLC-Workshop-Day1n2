import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';

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
    const todoId = parseInt(id, 10);
    if (isNaN(todoId)) {
      return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 });
    }

    const body = await request.json();

    if ('title' in body) {
      if (!body.title || body.title.trim().length === 0) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      }
      if (body.title.trim().length > 500) {
        return NextResponse.json({ error: 'Title must be 500 characters or fewer' }, { status: 400 });
      }
    }
    if ('tagIds' in body) {
      if (!Array.isArray(body.tagIds)) {
        return NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 });
      }
      if (body.tagIds.some((id: unknown) => !Number.isInteger(id) || Number(id) <= 0)) {
        return NextResponse.json({ error: 'tagIds must contain positive integers' }, { status: 400 });
      }
    }
    if ('reminder_minutes' in body) {
      const value = body.reminder_minutes;
      if (value !== null && (!Number.isInteger(value) || Number(value) <= 0)) {
        return NextResponse.json({ error: 'reminder_minutes must be a positive integer or null' }, { status: 400 });
      }
    }

    const updated = todoDB.update(todoId, session.userId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid for this user')) {
      return NextResponse.json({ error: 'One or more tag IDs are invalid' }, { status: 400 });
    }
    console.error('Failed to update todo:', error);
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 });
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
    const todoId = parseInt(id, 10);
    if (isNaN(todoId)) {
      return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 });
    }

    const deleted = todoDB.delete(todoId, session.userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete todo:', error);
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
  }
}
