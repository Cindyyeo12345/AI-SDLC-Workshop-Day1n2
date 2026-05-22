# PRP-01: Todo CRUD Operations

## Feature Overview

The core Todo CRUD (Create, Read, Update, Delete) feature is the foundation of the entire application. It provides users the ability to manage a personal todo list with titles, due dates, completion status, and notes. All date/time operations use the **Singapore timezone** (`Asia/Singapore`). This PRP covers only the base todo model — priority, tags, subtasks, and recurrence are handled in their respective PRPs but the schema is designed to accommodate them from the start.

---

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | User | Create a new todo with a title | I can track what I need to do |
| US-02 | User | See all my todos in a list | I have an overview of everything pending |
| US-03 | User | Edit a todo's title, due date, or notes | I can update details when things change |
| US-04 | User | Mark a todo as complete | I can track my progress |
| US-05 | User | Unmark a completed todo | I can reopen accidentally closed items |
| US-06 | User | Delete a todo | I can remove things I no longer need |
| US-07 | User | See when a todo is due | I know what needs to be done by when |
| US-08 | User | See completed todos separately | I can distinguish done from pending work |

---

## User Flow

### Creating a Todo
1. User sees the main page with an input field at the top
2. User types a title (required, 1–500 characters)
3. Optionally sets a due date via a date/time picker
4. Optionally adds notes
5. Clicks **"Add"** button or presses **Enter**
6. Todo immediately appears at the top of the list (optimistic update)
7. API call confirms creation; on failure, todo is removed and error shown

### Viewing Todos
1. Page loads and fetches all todos for the authenticated user
2. **Active todos** appear first, sorted by: due date (earliest first) → creation date (newest first)
3. **Completed todos** appear in a collapsible section below, sorted by completion time (most recent first)
4. Each todo card shows: title, due date (if set), completion checkbox, edit/delete buttons

### Editing a Todo
1. User clicks **Edit** (pencil icon) on a todo card
2. Card switches to inline edit mode showing editable fields
3. User modifies title, due date, or notes
4. Clicks **Save** or presses **Enter** → optimistic update applied
5. Clicks **Cancel** → reverts all changes

### Completing a Todo
1. User clicks the checkbox on a todo card
2. Todo is immediately marked complete (optimistic update) and moves to completed section
3. Completion timestamp recorded in Singapore time

### Deleting a Todo
1. User clicks **Delete** (trash icon) on a todo card
2. Confirmation prompt appears: *"Delete this todo?"*
3. User confirms → todo removed optimistically from the list
4. On API failure, todo is restored and error shown

---

## Technical Requirements

### 1. Database Schema

Add to `lib/db.ts` in the `db.exec()` initialisation block:

```sql
CREATE TABLE IF NOT EXISTS todos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0,          -- 0 = false, 1 = true (SQLite boolean)
  priority    TEXT    NOT NULL DEFAULT 'medium',   -- 'high' | 'medium' | 'low'  (PRP-02)
  due_date    TEXT,                                -- ISO 8601 string in SGT, nullable
  notes       TEXT,                                -- free-form text, nullable
  recurrence  TEXT,                                -- 'daily'|'weekly'|'monthly'|'yearly'|NULL (PRP-03)
  reminder_minutes INTEGER,                        -- minutes before due_date (PRP-04)
  created_at  TEXT    NOT NULL,                    -- ISO 8601 SGT
  updated_at  TEXT    NOT NULL,                    -- ISO 8601 SGT
  completed_at TEXT,                               -- ISO 8601 SGT, nullable
  last_notification_sent TEXT                      -- ISO 8601 SGT, nullable (PRP-04)
);
```

> **Note:** Columns marked with a PRP reference are included now to avoid future migrations but are only used by those later PRPs.

### 2. TypeScript Types

Add to `lib/db.ts`:

```typescript
export type Priority = 'high' | 'medium' | 'low'
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  priority: Priority
  due_date: string | null        // ISO 8601 string (SGT)
  notes: string | null
  recurrence: RecurrencePattern | null
  reminder_minutes: number | null
  created_at: string             // ISO 8601 string (SGT)
  updated_at: string             // ISO 8601 string (SGT)
  completed_at: string | null    // ISO 8601 string (SGT)
  last_notification_sent: string | null
}

export interface CreateTodoInput {
  title: string
  due_date?: string | null
  notes?: string | null
  priority?: Priority
}

export interface UpdateTodoInput {
  title?: string
  completed?: boolean
  due_date?: string | null
  notes?: string | null
  priority?: Priority
}
```

### 3. Database Operations

Add a `todoDB` export object to `lib/db.ts`:

```typescript
export const todoDB = {
  // Return all todos for a user, active first then completed
  getAll: (userId: number): Todo[] => {
    return db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
      ORDER BY
        completed ASC,
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
        due_date ASC,
        created_at DESC
    `).all(userId) as Todo[]
  },

  getById: (id: number, userId: number): Todo | null => {
    return db.prepare(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Todo | null
  },

  create: (userId: number, input: CreateTodoInput): Todo => {
    const now = getSingaporeNow().toISOString()
    const result = db.prepare(`
      INSERT INTO todos (user_id, title, priority, due_date, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.title.trim(),
      input.priority ?? 'medium',
      input.due_date ?? null,
      input.notes ?? null,
      now,
      now
    )
    return todoDB.getById(result.lastInsertRowid as number, userId)!
  },

  update: (id: number, userId: number, input: UpdateTodoInput): Todo | null => {
    const todo = todoDB.getById(id, userId)
    if (!todo) return null

    const now = getSingaporeNow().toISOString()
    const completedAt = input.completed === true
      ? (todo.completed_at ?? now)   // preserve original completion time
      : input.completed === false
        ? null
        : todo.completed_at

    db.prepare(`
      UPDATE todos SET
        title       = ?,
        completed   = ?,
        priority    = ?,
        due_date    = ?,
        notes       = ?,
        completed_at = ?,
        updated_at  = ?
      WHERE id = ? AND user_id = ?
    `).run(
      input.title       ?? todo.title,
      input.completed   !== undefined ? (input.completed ? 1 : 0) : (todo.completed ? 1 : 0),
      input.priority    ?? todo.priority,
      'due_date'  in input ? (input.due_date ?? null) : todo.due_date,
      'notes'     in input ? (input.notes    ?? null) : todo.notes,
      completedAt,
      now,
      id,
      userId
    )
    return todoDB.getById(id, userId)
  },

  delete: (id: number, userId: number): boolean => {
    const result = db.prepare(
      'DELETE FROM todos WHERE id = ? AND user_id = ?'
    ).run(id, userId)
    return result.changes > 0
  },
}
```

### 4. API Routes

#### `GET /api/todos` — List all todos

File: `app/api/todos/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const todos = todoDB.getAll(session.userId)
    return NextResponse.json(todos)
  } catch (error) {
    console.error('Failed to fetch todos:', error)
    return NextResponse.json({ error: 'Failed to fetch todos' }, { status: 500 })
  }
}
```

#### `POST /api/todos` — Create a todo

Add to `app/api/todos/route.ts`:

```typescript
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, due_date, notes, priority } = body

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (title.trim().length > 500) {
      return NextResponse.json({ error: 'Title must be 500 characters or fewer' }, { status: 400 })
    }

    const todo = todoDB.create(session.userId, {
      title,
      due_date: due_date ?? null,
      notes: notes ?? null,
      priority: priority ?? 'medium',
    })

    return NextResponse.json(todo, { status: 201 })
  } catch (error) {
    console.error('Failed to create todo:', error)
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 })
  }
}
```

#### `PUT /api/todos/[id]` — Update a todo

File: `app/api/todos/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // params is a Promise in Next.js 16
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { id } = await params
    const todoId = parseInt(id, 10)
    if (isNaN(todoId)) {
      return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 })
    }

    const body = await request.json()

    // Validate title if provided
    if ('title' in body) {
      if (!body.title || body.title.trim().length === 0) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      if (body.title.trim().length > 500) {
        return NextResponse.json({ error: 'Title must be 500 characters or fewer' }, { status: 400 })
      }
    }

    const updated = todoDB.update(todoId, session.userId, body)
    if (!updated) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update todo:', error)
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 })
  }
}
```

#### `DELETE /api/todos/[id]` — Delete a todo

Add to `app/api/todos/[id]/route.ts`:

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { id } = await params
    const todoId = parseInt(id, 10)
    if (isNaN(todoId)) {
      return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 })
    }

    const deleted = todoDB.delete(todoId, session.userId)
    if (!deleted) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete todo:', error)
    return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 })
  }
}
```

---

## UI Components

### Main Page Structure (`app/page.tsx`)

This is a `'use client'` component. Key state and layout:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Todo } from '@/lib/db'

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  // Fetch on mount
  useEffect(() => { fetchTodos() }, [])

  const fetchTodos = async () => { /* GET /api/todos */ }
  const createTodo = async () => { /* POST /api/todos with optimistic update */ }
  const updateTodo = async (id: number, data: Partial<Todo>) => { /* PUT /api/todos/[id] */ }
  const deleteTodo = async (id: number) => { /* DELETE /api/todos/[id] */ }
  const toggleComplete = async (todo: Todo) => {
    await updateTodo(todo.id, { completed: !todo.completed })
  }

  const activeTodos    = todos.filter(t => !t.completed)
  const completedTodos = todos.filter(t =>  t.completed)

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">My Todos</h1>

      {/* Add Todo Form */}
      <AddTodoForm
        title={newTitle}
        dueDate={newDueDate}
        notes={newNotes}
        onTitleChange={setNewTitle}
        onDueDateChange={setNewDueDate}
        onNotesChange={setNewNotes}
        onSubmit={createTodo}
      />

      {/* Active Todos */}
      <section className="mt-6">
        {activeTodos.map(todo => (
          <TodoCard
            key={todo.id}
            todo={todo}
            isEditing={editingId === todo.id}
            onToggleComplete={() => toggleComplete(todo)}
            onEdit={() => setEditingId(todo.id)}
            onSave={(data) => { updateTodo(todo.id, data); setEditingId(null) }}
            onCancelEdit={() => setEditingId(null)}
            onDelete={() => deleteTodo(todo.id)}
          />
        ))}
        {activeTodos.length === 0 && !loading && (
          <p className="text-gray-400 text-center py-8">No todos yet. Add one above!</p>
        )}
      </section>

      {/* Completed Todos */}
      {completedTodos.length > 0 && (
        <CompletedSection todos={completedTodos}
          onToggleComplete={toggleComplete}
          onDelete={deleteTodo}
        />
      )}
    </main>
  )
}
```

### Add Todo Form Component

```typescript
// Input field at the top of the page
// Required: title input with placeholder "What needs to be done?"
// Optional (collapsible or inline): due date datetime-local input, notes textarea
// Submit: "Add" button + Enter key support
// Clears fields on successful submit
// Shows inline error if title is empty on submit attempt
```

### Todo Card Component

```typescript
// Display mode shows:
//   [ ] checkbox | Title | Due date badge | Edit button | Delete button
//
// Due date badge colours:
//   - Overdue (past due, not completed): red background
//   - Due today: orange background
//   - Due this week: yellow background
//   - Future: grey background
//
// Edit mode (inline) shows:
//   Title input (pre-filled) | Due date input | Notes textarea
//   Save button | Cancel button
//
// Completed todo: checkbox checked, title has line-through styling
```

### Optimistic Update Pattern

```typescript
// CREATE — add todo to state immediately, revert on error
const createTodo = async () => {
  const tempId = Date.now() // temporary ID
  const optimisticTodo: Todo = {
    id: tempId,
    user_id: 0,
    title: newTitle.trim(),
    completed: false,
    priority: 'medium',
    due_date: newDueDate || null,
    notes: newNotes || null,
    recurrence: null,
    reminder_minutes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    last_notification_sent: null,
  }

  setTodos(prev => [optimisticTodo, ...prev])
  setNewTitle('')

  try {
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim(), due_date: newDueDate || null, notes: newNotes || null }),
    })
    if (!res.ok) throw new Error(await res.text())
    const created: Todo = await res.json()
    // Replace temp with real todo
    setTodos(prev => prev.map(t => t.id === tempId ? created : t))
  } catch {
    // Revert
    setTodos(prev => prev.filter(t => t.id !== tempId))
    setError('Failed to create todo. Please try again.')
  }
}

// UPDATE — update state immediately, revert on error
const updateTodo = async (id: number, data: Partial<Todo>) => {
  const previous = todos.find(t => t.id === id)
  setTodos(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))

  try {
    const res = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(await res.text())
    const updated: Todo = await res.json()
    setTodos(prev => prev.map(t => t.id === id ? updated : t))
  } catch {
    if (previous) setTodos(prev => prev.map(t => t.id === id ? previous : t))
    setError('Failed to update todo. Please try again.')
  }
}

// DELETE — remove from state immediately, restore on error
const deleteTodo = async (id: number) => {
  if (!confirm('Delete this todo?')) return
  const previous = todos.find(t => t.id === id)
  setTodos(prev => prev.filter(t => t.id !== id))

  try {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
  } catch {
    if (previous) setTodos(prev => [...prev, previous].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ))
    setError('Failed to delete todo. Please try again.')
  }
}
```

---

## Singapore Timezone Handling

All date/time operations **must** use `lib/timezone.ts`. Never use `new Date()` directly.

```typescript
// lib/timezone.ts — required exports used in this PRP
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'

const TIMEZONE = 'Asia/Singapore'

export const getSingaporeNow = (): Date => {
  return toZonedTime(new Date(), TIMEZONE)
}

export const formatSingaporeDate = (date: Date | string, fmt = 'dd MMM yyyy, h:mm a'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(toZonedTime(d, TIMEZONE), fmt, { timeZone: TIMEZONE })
}

export const isOverdue = (dueDate: string): boolean => {
  return new Date(dueDate) < getSingaporeNow()
}

export const isDueToday = (dueDate: string): boolean => {
  const due = toZonedTime(new Date(dueDate), TIMEZONE)
  const now = getSingaporeNow()
  return due.getFullYear() === now.getFullYear()
      && due.getMonth()    === now.getMonth()
      && due.getDate()     === now.getDate()
}
```

Use in components:
```typescript
import { formatSingaporeDate, isOverdue, isDueToday } from '@/lib/timezone'

// Display due date
{todo.due_date && (
  <span className={isOverdue(todo.due_date) ? 'text-red-500' : 'text-gray-500'}>
    {formatSingaporeDate(todo.due_date, 'dd MMM yyyy')}
  </span>
)}
```

---

## Validation Rules

### Title
| Rule | Constraint |
|------|-----------|
| Required | Cannot be empty or whitespace-only |
| Max length | 500 characters |
| Trimmed | Leading/trailing whitespace stripped before save |

### Due Date
| Rule | Constraint |
|------|-----------|
| Optional | Null if not set |
| Format | ISO 8601 string stored in SGT |
| Past dates | Allowed (user may add overdue items) |

### Notes
| Rule | Constraint |
|------|-----------|
| Optional | Null if not set |
| Max length | 2000 characters (enforce client-side only) |

---

## Edge Cases

| Scenario | Expected Behaviour |
|----------|--------------------|
| Submit with empty title | Show inline error, do not call API |
| Title with only spaces | Trim → treated as empty → show error |
| API returns 500 on create | Revert optimistic todo, show error message |
| API returns 500 on delete | Restore todo in list, show error message |
| Network offline during update | Revert change, show "Network error" message |
| Edit todo, then click Cancel | All fields revert to original values |
| Delete todo while editing | Confirmation still required |
| Very long title (500 chars) | Accepted; longer titles rejected with error |
| Due date set to past | Displayed with red "Overdue" badge |
| Multiple rapid completions | Each toggle waits for previous request (disable checkbox during request) |
| Page refresh mid-edit | Edit mode lost; data persisted from last save |

---

## Acceptance Criteria

All criteria must pass before this feature is considered complete.

### Create
- [ ] AC-01: User can create a todo with a title only
- [ ] AC-02: User can create a todo with title + due date + notes
- [ ] AC-03: Todo appears in the list immediately (optimistic update)
- [ ] AC-04: Submitting empty title shows an error; no API call is made
- [ ] AC-05: Title longer than 500 characters is rejected with an error
- [ ] AC-06: Created todo is stored with Singapore timezone timestamps

### Read
- [ ] AC-07: All active todos are displayed on page load
- [ ] AC-08: Active todos sorted: due soonest first, then by creation date (newest first)
- [ ] AC-09: Todos with no due date appear after todos with a due date
- [ ] AC-10: Completed todos appear in a separate section
- [ ] AC-11: Empty state message shown when no todos exist
- [ ] AC-12: Overdue todos display a red due-date badge

### Update
- [ ] AC-13: User can edit a todo's title inline
- [ ] AC-14: User can edit a todo's due date and notes inline
- [ ] AC-15: Saving an empty title shows an error; change is not saved
- [ ] AC-16: Cancel edit reverts all fields to their original values
- [ ] AC-17: Updated timestamp (`updated_at`) is refreshed on every save

### Complete / Uncomplete
- [ ] AC-18: Clicking the checkbox marks the todo complete and moves it to completed section
- [ ] AC-19: Clicking the checkbox on a completed todo moves it back to active
- [ ] AC-20: `completed_at` is recorded in Singapore time when first completed
- [ ] AC-21: `completed_at` is cleared when a todo is uncompleted

### Delete
- [ ] AC-22: Clicking delete shows a confirmation prompt
- [ ] AC-23: Confirming delete removes the todo immediately (optimistic)
- [ ] AC-24: Cancelling the confirmation leaves the todo unchanged
- [ ] AC-25: Deleted todo is permanently removed from the database

### Error Handling
- [ ] AC-26: API failure on create reverts the optimistic todo and shows an error
- [ ] AC-27: API failure on update reverts the optimistic change and shows an error
- [ ] AC-28: API failure on delete restores the todo and shows an error
- [ ] AC-29: Error messages auto-dismiss after 5 seconds

### Security
- [ ] AC-30: Unauthenticated requests to all todo endpoints return 401
- [ ] AC-31: User cannot read, update, or delete another user's todos (returns 404)

---

## Testing Requirements

### E2E Tests (Playwright) — `tests/02-todo-crud.spec.ts`

```typescript
import { test, expect } from '@playwright/test'
import { TestHelpers } from './helpers'

test.describe('Todo CRUD', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await helpers.registerAndLogin()
  })

  test('create a todo with title only', async ({ page }) => {
    await page.fill('[data-testid="new-todo-input"]', 'Buy milk')
    await page.click('[data-testid="add-todo-button"]')
    await expect(page.locator('[data-testid="todo-item"]')).toContainText('Buy milk')
  })

  test('create a todo with due date', async ({ page }) => {
    await page.fill('[data-testid="new-todo-input"]', 'Team meeting')
    await page.fill('[data-testid="new-due-date-input"]', '2025-12-31T09:00')
    await page.click('[data-testid="add-todo-button"]')
    await expect(page.locator('[data-testid="todo-due-date"]')).toBeVisible()
  })

  test('cannot create a todo with empty title', async ({ page }) => {
    await page.click('[data-testid="add-todo-button"]')
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(0)
  })

  test('edit a todo title', async ({ page }) => {
    await helpers.createTodo('Original title')
    await page.click('[data-testid="edit-todo-button"]')
    await page.fill('[data-testid="edit-title-input"]', 'Updated title')
    await page.click('[data-testid="save-todo-button"]')
    await expect(page.locator('[data-testid="todo-item"]')).toContainText('Updated title')
    await expect(page.locator('[data-testid="todo-item"]')).not.toContainText('Original title')
  })

  test('cancel edit reverts changes', async ({ page }) => {
    await helpers.createTodo('Original title')
    await page.click('[data-testid="edit-todo-button"]')
    await page.fill('[data-testid="edit-title-input"]', 'Changed title')
    await page.click('[data-testid="cancel-edit-button"]')
    await expect(page.locator('[data-testid="todo-item"]')).toContainText('Original title')
  })

  test('complete a todo moves it to completed section', async ({ page }) => {
    await helpers.createTodo('Finish report')
    await page.click('[data-testid="todo-checkbox"]')
    await expect(page.locator('[data-testid="completed-section"]')).toContainText('Finish report')
    await expect(page.locator('[data-testid="active-section"] [data-testid="todo-item"]'))
      .not.toContainText('Finish report')
  })

  test('uncomplete a todo moves it back to active', async ({ page }) => {
    await helpers.createTodo('Finish report')
    await page.click('[data-testid="todo-checkbox"]')             // complete
    await page.click('[data-testid="completed-todo-checkbox"]')   // uncomplete
    await expect(page.locator('[data-testid="active-section"]')).toContainText('Finish report')
  })

  test('delete a todo with confirmation', async ({ page }) => {
    await helpers.createTodo('To be deleted')
    page.once('dialog', dialog => dialog.accept())
    await page.click('[data-testid="delete-todo-button"]')
    await expect(page.locator('[data-testid="todo-item"]')).not.toContainText('To be deleted')
  })

  test('cancel delete keeps the todo', async ({ page }) => {
    await helpers.createTodo('Do not delete')
    page.once('dialog', dialog => dialog.dismiss())
    await page.click('[data-testid="delete-todo-button"]')
    await expect(page.locator('[data-testid="todo-item"]')).toContainText('Do not delete')
  })

  test('overdue todo shows red badge', async ({ page }) => {
    // Create a todo with a past due date via API
    await page.request.post('/api/todos', {
      data: { title: 'Overdue task', due_date: '2020-01-01T09:00:00.000Z' }
    })
    await page.reload()
    await expect(page.locator('[data-testid="overdue-badge"]')).toBeVisible()
  })

  test('todos persist after page reload', async ({ page }) => {
    await helpers.createTodo('Persistent todo')
    await page.reload()
    await expect(page.locator('[data-testid="todo-item"]')).toContainText('Persistent todo')
  })
})
```

### Unit Tests — `lib/db.test.ts`

```typescript
describe('todoDB', () => {
  test('create stores title and default priority', () => {
    const todo = todoDB.create(userId, { title: 'Test todo' })
    expect(todo.title).toBe('Test todo')
    expect(todo.priority).toBe('medium')
    expect(todo.completed).toBe(false)
    expect(todo.due_date).toBeNull()
  })

  test('getAll returns active todos before completed', () => {
    todoDB.create(userId, { title: 'Active' })
    const completed = todoDB.create(userId, { title: 'Done' })
    todoDB.update(completed.id, userId, { completed: true })
    const todos = todoDB.getAll(userId)
    expect(todos[0].completed).toBe(false)
    expect(todos[todos.length - 1].completed).toBe(true)
  })

  test('update records completed_at when marking complete', () => {
    const todo = todoDB.create(userId, { title: 'Task' })
    const updated = todoDB.update(todo.id, userId, { completed: true })!
    expect(updated.completed_at).not.toBeNull()
  })

  test('update clears completed_at when uncompleting', () => {
    const todo = todoDB.create(userId, { title: 'Task' })
    todoDB.update(todo.id, userId, { completed: true })
    const uncompleted = todoDB.update(todo.id, userId, { completed: false })!
    expect(uncompleted.completed_at).toBeNull()
  })

  test('delete returns false for another user\'s todo', () => {
    const todo = todoDB.create(userId, { title: 'Mine' })
    expect(todoDB.delete(todo.id, otherUserId)).toBe(false)
  })

  test('getById returns null for another user\'s todo', () => {
    const todo = todoDB.create(userId, { title: 'Mine' })
    expect(todoDB.getById(todo.id, otherUserId)).toBeNull()
  })
})
```

### `data-testid` Attributes Required

| Element | `data-testid` |
|---------|---------------|
| New todo title input | `new-todo-input` |
| New due date input | `new-due-date-input` |
| New notes input | `new-notes-input` |
| Add button | `add-todo-button` |
| Active todos section | `active-section` |
| Completed todos section | `completed-section` |
| Each todo item | `todo-item` |
| Todo checkbox (active) | `todo-checkbox` |
| Todo checkbox (completed) | `completed-todo-checkbox` |
| Edit button | `edit-todo-button` |
| Edit title input | `edit-title-input` |
| Save edit button | `save-todo-button` |
| Cancel edit button | `cancel-edit-button` |
| Delete button | `delete-todo-button` |
| Due date display | `todo-due-date` |
| Overdue badge | `overdue-badge` |
| Error message | `error-message` |

---

## Out of Scope (Covered in Later PRPs)

- Priority levels → **PRP-02**
- Recurring todos → **PRP-03**
- Reminders/notifications → **PRP-04**
- Subtasks → **PRP-05**
- Tags → **PRP-06**
- Templates → **PRP-07**
- Search & filtering → **PRP-08**
- Export / Import → **PRP-09**
- Calendar view → **PRP-10**
- WebAuthn authentication → **PRP-11**

---

## Success Metrics

| Metric | Target |
|--------|--------|
| All 31 acceptance criteria pass | 100% |
| E2E test suite passes | 0 failures |
| Unit test coverage for `todoDB` | ≥ 80% |
| Optimistic update latency | < 50ms perceived |
| API response time (P95) | < 200ms |
| Zero 5xx errors in normal usage | 100% |

---

## Dependencies

| Dependency | Why needed |
|-----------|------------|
| `better-sqlite3` | Synchronous SQLite for database operations |
| `date-fns-tz` | Singapore timezone date formatting |
| `next` ≥ 16 | App Router, async params pattern |
| `lib/auth.ts` | `getSession()` — user identity for all queries |
| `lib/timezone.ts` | `getSingaporeNow()`, `formatSingaporeDate()` |

---

*PRP-01 | Todo CRUD Operations | Created: May 2026 | Status: Ready for Implementation*
