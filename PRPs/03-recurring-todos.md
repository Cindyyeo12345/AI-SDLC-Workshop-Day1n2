# PRP: Recurring Todos

## Feature Overview
Automatically create the next todo instance when a recurring todo is completed. Supports daily, weekly, monthly, and yearly recurrence patterns with Singapore-time-aware date handling and metadata inheritance.

## User Stories

### As a user with routines
- I want to mark a todo as recurring
- So that I do not need to recreate it manually every time

### As a planning-focused user
- I want to choose recurrence frequency (daily/weekly/monthly/yearly)
- So that each task repeats on the right schedule

### As a detail-oriented user
- I want the next instance to keep key metadata
- So that priority, notes, tags, and reminders remain consistent

## Recurrence Patterns

| Pattern | Rule | Example |
|--------|------|---------|
| daily | +1 day | 22 May 09:00 -> 23 May 09:00 |
| weekly | +7 days | Fri 22 May -> Fri 29 May |
| monthly | same day next month | 31 Jan -> 28/29 Feb (JS Date behavior) |
| yearly | same month/day next year | 22 May 2026 -> 22 May 2027 |

## User Flow

### Create Recurring Todo
1. User enters title.
2. User sets due date/time.
3. User checks Repeat.
4. User selects pattern (Daily/Weekly/Monthly/Yearly).
5. User clicks Add.
6. Todo appears with recurrence badge.

### Complete Recurring Todo
1. User clicks completion checkbox on a recurring todo.
2. Current todo is marked completed.
3. System calculates next due date from current due date and recurrence pattern.
4. System creates new active todo instance automatically.
5. New instance appears in active list with same metadata.

### Disable Recurrence
1. User edits an existing recurring todo.
2. User disables repeat (sets recurrence to null).
3. User saves changes.
4. Future completion will not auto-create new instances.

## Technical Requirements

### Database Field
Use existing `recurrence` column on `todos` table:

```sql
recurrence TEXT  -- nullable, values: daily|weekly|monthly|yearly
```

No separate `is_recurring` flag is required. `recurrence IS NOT NULL` means recurring.

### Type Definition
```typescript
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
```

### API Contract

#### Create Todo (`POST /api/todos`)
Accepted payload fields:
```json
{
  "title": "Daily standup",
  "due_date": "2026-05-23T09:00",
  "priority": "medium",
  "notes": "optional",
  "recurrence": "daily",
  "reminder_minutes": 60,
  "tagIds": [1, 2]
}
```

Validation:
- `recurrence` must be one of `daily|weekly|monthly|yearly` or null.
- Recurring todos require `due_date`.

#### Update Todo (`PUT /api/todos/[id]`)
- Same recurrence validation as create.
- If setting recurrence to non-null, effective due date must exist.

### Recurrence Calculation Logic

```typescript
function addRecurrenceDueDate(dueDate: string, recurrence: RecurrencePattern): string {
  const next = new Date(dueDate);

  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next.toISOString();
}
```

### Auto-Creation Trigger
When toggling `completed` from `false -> true` on a recurring todo with a due date:
- Create next todo instance using computed due date.
- Inherit metadata from current todo:
  - title
  - priority
  - notes
  - recurrence
  - reminder_minutes
  - tags
- Set new instance as active (`completed = false`, `completed_at = null`).

### Metadata Inheritance for Tags
If tags are many-to-many, copy tag relations to the new instance by inserting equivalent rows in join table.

## UI Requirements

### Create Form Controls
- Repeat checkbox.
- Recurrence dropdown, shown/enabled when Repeat is checked.
- Repeat requires due date (show validation message when missing).

### Edit Form Controls
- Allow recurrence to be changed or disabled in edit mode.
- Preserve existing recurrence when untouched.

### Recurrence Badge
Display on todo card when recurring:

```tsx
<span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 font-medium">
  🔄 {RECURRENCE_LABELS[todo.recurrence]}
</span>
```

Label mapping:
```typescript
const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};
```

## `data-testid` Attributes

| Element | `data-testid` |
|---------|---------------|
| Repeat checkbox (create) | `repeat-checkbox` |
| Recurrence select (create) | `recurrence-select` |
| Todo due date badge | `todo-due-date` |
| Todo checkbox | `todo-checkbox` |
| Completed todo checkbox | `completed-todo-checkbox` |

If recurrence is added to edit form:

| Element | `data-testid` |
|---------|---------------|
| Repeat checkbox (edit) | `edit-repeat-checkbox` |
| Recurrence select (edit) | `edit-recurrence-select` |

## Acceptance Criteria

- [ ] User can create a recurring todo with all four patterns.
- [ ] Recurring todo cannot be created without due date.
- [ ] Completing recurring todo creates exactly one next instance.
- [ ] Next instance due date is correct for selected pattern.
- [ ] Next instance inherits title, priority, notes, reminder, recurrence, and tags.
- [ ] Completed instance remains in completed section.
- [ ] New instance appears in active section.
- [ ] Recurrence badge is shown on recurring todos.
- [ ] User can disable recurrence on existing todo.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Recurrence set but due date removed | Reject update with validation error |
| Completing already completed todo | Do not create duplicate next instance |
| Monthly from Jan 31 | JavaScript Date rollover behavior accepted |
| Yearly from leap day | JavaScript Date rollover behavior accepted |
| Recurring todo without reminder | New instance has `reminder_minutes = null` |
| Recurring todo with tags | New instance includes same tags |

## File Targets

| File | Change |
|------|--------|
| `lib/db.ts` | Recurrence type/input support, next-date helper, auto-create next instance, tag inheritance |
| `app/api/todos/route.ts` | Recurrence validation on create |
| `app/api/todos/[id]/route.ts` | Recurrence validation on update |
| `app/page.tsx` | Repeat controls, recurrence badge, create/edit payload support |

## Testing Requirements

### E2E Tests (`tests/03-recurring.spec.ts`)
- [ ] Create daily recurring todo.
- [ ] Create weekly recurring todo.
- [ ] Complete recurring todo and verify next instance appears.
- [ ] Verify due date increments correctly by pattern.
- [ ] Verify inherited metadata (priority, reminder, tags).
- [ ] Verify recurrence validation error without due date.
- [ ] Verify recurrence can be disabled in edit mode.

### Unit Tests
- [ ] `addRecurrenceDueDate` for daily/weekly/monthly/yearly.
- [ ] Completion transition creates next instance only on first completion.

### Manual Verification Scenario
1. Create todo: `Daily standup`.
2. Check Repeat.
3. Select Daily pattern.
4. Set due date: tomorrow 9:00 AM.
5. Complete the todo.
6. Verify a new `Daily standup` instance is created for next day.

## Out of Scope
- Custom recurrence intervals (e.g., every 2 days).
- Weekday-only recurrence.
- RRULE/ICS export integration.
- Timezone conversion UI.

---

*PRP-03 | Recurring Todos | Status: Generated*
