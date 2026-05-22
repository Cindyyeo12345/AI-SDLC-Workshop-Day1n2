import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const todos = todoDB.getAll(session.userId);
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
    const { title, due_date, notes, priority, recurrence, reminder_minutes } = body;

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

    if (reminder_minutes !== undefined && reminder_minutes !== null && !due_date) {
      return NextResponse.json({ error: 'Reminders require a due date' }, { status: 400 });
    }

    const todo = todoDB.create(session.userId, {
      title,
      due_date: due_date ?? null,
      notes: notes ?? null,
      priority: priority ?? 'medium',
      reminder_minutes: reminder_minutes ?? null,
      recurrence: recurrence ?? null,
    });

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    console.error('Failed to create todo:', error);
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 });
  }
}
