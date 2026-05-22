import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const tagIdRaw = request.nextUrl.searchParams.get('tagId');
    let tagId: number | undefined;
    if (tagIdRaw !== null) {
      const parsed = Number(tagIdRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'Invalid tagId' }, { status: 400 });
      }
      tagId = parsed;
    }

    const todos = todoDB.getAll(session.userId, tagId);
    return NextResponse.json(todos);
  } catch (error) {
    console.error('Failed to fetch todos:', error);
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, due_date, notes, priority, recurrence, reminder_minutes, tagIds } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (title.trim().length > 500) {
      return NextResponse.json({ error: 'Title must be 500 characters or fewer' }, { status: 400 });
    }

    if (recurrence && !['daily', 'weekly', 'monthly', 'yearly'].includes(recurrence)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    }

    if (recurrence && !due_date) {
      return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 });
    }

    if (reminder_minutes !== undefined && reminder_minutes !== null && (!Number.isInteger(reminder_minutes) || Number(reminder_minutes) <= 0)) {
      return NextResponse.json({ error: 'reminder_minutes must be a positive integer or null' }, { status: 400 });
    }
    if (reminder_minutes !== undefined && reminder_minutes !== null && !due_date) {
      return NextResponse.json({ error: 'reminder_minutes requires due_date' }, { status: 400 });
    }

    if (reminder_minutes !== undefined && reminder_minutes !== null && !due_date) {
      return NextResponse.json({ error: 'Reminders require a due date' }, { status: 400 });
    }

    if (tagIds !== undefined) {
      if (!Array.isArray(tagIds)) {
        return NextResponse.json({ error: 'tagIds must be an array' }, { status: 400 });
      }
      if (tagIds.some((id: unknown) => !Number.isInteger(id) || Number(id) <= 0)) {
        return NextResponse.json({ error: 'tagIds must contain positive integers' }, { status: 400 });
      }
    }

    const todo = todoDB.create(session.userId, {
      title,
      due_date: due_date ?? null,
      notes: notes ?? null,
      priority: priority ?? 'medium',
      recurrence: recurrence ?? null,
      reminder_minutes: reminder_minutes ?? null,
      tagIds: tagIds ?? [],
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid for this user')) {
      return NextResponse.json({ error: 'One or more tag IDs are invalid' }, { status: 400 });
    }
    console.error('Failed to create todo:', error);
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
