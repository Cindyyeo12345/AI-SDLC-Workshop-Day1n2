import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import type { Todo } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Use real UTC epoch for comparison — getSingaporeNow() returns Invalid Date in Node.js
    const now = new Date();

    const todos = db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
        AND completed = 0
        AND due_date IS NOT NULL
        AND reminder_minutes IS NOT NULL
        AND (last_notification_sent IS NULL
             OR last_notification_sent < datetime('now', '-1 hour'))
    `).all(session.userId) as Todo[];

    const due = todos.filter(todo => {
      const dueDate = new Date(todo.due_date!);
      const reminderTime = new Date(dueDate.getTime() - todo.reminder_minutes! * 60000);
      return reminderTime <= now;
    });

    if (due.length > 0) {
      const nowIso = now.toISOString();
      const update = db.prepare('UPDATE todos SET last_notification_sent = ? WHERE id = ?');
      due.forEach(todo => update.run(nowIso, todo.id));
    }

    return NextResponse.json({ notifications: due });
  } catch (error) {
    console.error('Failed to check notifications:', error);
    return NextResponse.json({ error: 'Failed to check notifications' }, { status: 500 });
  }
}
