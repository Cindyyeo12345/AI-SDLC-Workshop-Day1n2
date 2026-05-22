# PRP: Reminder & Notification System

## Feature Overview
Browser-based notification system that alerts users before todo due dates, with configurable timing offsets and duplicate prevention.

## User Stories

### As a busy user
- I want to receive notifications before todos are due
- So that I don't miss important deadlines

### As a user who plans ahead
- I want to set reminders for 1 day or 1 week before
- So that I have time to prepare for large tasks

### As a user with urgent tasks
- I want reminders 15 or 30 minutes before
- So that I can complete time-sensitive tasks

## Reminder Timing Options

| Option | Minutes Before | Use Case |
|--------|---------------|----------|
| 1 minute | 1 | Testing, very last-minute tasks |
| 15 minutes | 15 | Urgent meetings, time-sensitive tasks |
| 30 minutes | 30 | Quick tasks, last-minute prep |
| 1 hour | 60 | Moderate prep time |
| 2 hours | 120 | Tasks requiring setup |
| 1 day | 1440 | Important deadlines, planning |
| 2 days | 2880 | Large projects, preparation |
| 1 week | 10080 | Long-term planning, big events |

## User Flow

### Enabling Notifications
1. User clicks "Enable Notifications" button (top of page)
2. Browser shows native permission dialog
3. User clicks "Allow"
4. Button changes to "Notifications Enabled" (disabled state)
5. System begins checking for upcoming reminders

### Setting Reminder on New Todo
1. User enters todo title and sets due date
2. Reminder dropdown becomes enabled (disabled without due date)
3. User selects reminder timing (e.g., "1 day before")
4. User clicks "Add"
5. Todo displays 🔔 badge with timing (e.g., "🔔 1d before")

### Setting Reminder on Existing Todo
1. User clicks "Edit" on todo
2. User sets/changes due date (if not already set)
3. Reminder dropdown becomes enabled
4. User selects reminder timing
5. User clicks "Save Changes"
6. Todo displays updated 🔔 badge

### Receiving Notification
1. System polls `/api/notifications/check` every 30 seconds
2. When reminder time reached (in Singapore timezone):
   - Browser displays notification: title "Todo Reminder", body = todo title
   - `tag: "todo-{id}"` prevents duplicate browser notifications
3. System marks `last_notification_sent` to prevent re-firing
4. User clicks notification → redirects to app

### Disabling Reminder
1. User edits todo
2. User selects "No reminder" from dropdown
3. Reminder badge removed from todo

## Technical Requirements

### Database Fields
Already included in PRP-01 schema — no migration needed:
```sql
reminder_minutes       INTEGER,   -- NULL or positive number
last_notification_sent TEXT       -- ISO 8601 SGT, nullable
```

### Custom Hook: `lib/hooks/useNotifications.ts`
```typescript
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
      setIsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    setIsEnabled(result === 'granted');
  };

  const toggleMute = () => setIsMuted(m => !m);

  return { permission, isEnabled, isMuted, requestPermission, toggleMute };
}
```

### Polling System (Client-Side, `app/page.tsx`)
```typescript
useEffect(() => {
  if (!isEnabled || isMuted) return;

  const checkNotifications = async () => {
    const res = await fetch('/api/notifications/check');
    if (!res.ok) return;
    const { notifications } = await res.json();
    notifications.forEach((todo: { id: number; title: string }) => {
      new Notification('Todo Reminder', {
        body: todo.title,
        tag: `todo-${todo.id}`,
      });
    });
  };

  const interval = setInterval(checkNotifications, 30000);
  return () => clearInterval(interval);
}, [isEnabled, isMuted]);
```

### API Endpoint: `GET /api/notifications/check`

File: `app/api/notifications/check/route.ts`

**Logic:**
1. Get authenticated session
2. Query todos where `reminder_minutes IS NOT NULL`, `due_date IS NOT NULL`, `completed = 0`, and `reminder_time <= now`
3. Grace period: skip if `last_notification_sent` was within the last hour
4. Update `last_notification_sent` for each returned todo
5. Return matching todos

```typescript
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const now = getSingaporeNow();
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

  due.forEach(todo => {
    db.prepare(`UPDATE todos SET last_notification_sent = ? WHERE id = ?`)
      .run(now.toISOString(), todo.id);
  });

  return NextResponse.json({ notifications: due });
}
```

### UI Components

#### Enable Notifications Button (top of `app/page.tsx`)
```tsx
<button
  onClick={requestPermission}
  disabled={isEnabled}
  className={isEnabled ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}
>
  {isEnabled ? '✓ Notifications Enabled' : 'Enable Notifications'}
</button>
```

#### Reminder Dropdown (in add-todo form and edit mode)
```tsx
<select
  value={reminderMinutes ?? ''}
  onChange={e => setReminderMinutes(e.target.value ? Number(e.target.value) : null)}
  disabled={!dueDate}
>
  <option value="">No reminder</option>
  <option value="15">15 minutes before</option>
  <option value="30">30 minutes before</option>
  <option value="60">1 hour before</option>
  <option value="120">2 hours before</option>
  <option value="1440">1 day before</option>
  <option value="2880">2 days before</option>
  <option value="10080">1 week before</option>
</select>
```

#### Reminder Badge (on TodoCard)
```tsx
function formatReminderOffset(minutes: number): string {
  if (minutes < 60) return `${minutes}m before`;
  if (minutes < 1440) return `${minutes / 60}h before`;
  return `${minutes / 1440}d before`;
}

{todo.reminder_minutes && (
  <span className="text-xs text-purple-600">
    🔔 {formatReminderOffset(todo.reminder_minutes)}
  </span>
)}
```

## Duplicate Prevention

- `last_notification_sent` field tracks last sent time per todo
- API skips todos where this was set within the last hour
- Browser `tag: "todo-{id}"` replaces any existing browser notification for same todo

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Browser closed | Notifications don't fire; resume on next open |
| Permission denied | Button stays in "Enable" state; no polling |
| Todo completed before reminder fires | Excluded from check query |
| Reminder set but no due date | Dropdown disabled in UI; reminder_minutes ignored |
| Recurring todo | Next instance inherits reminder_minutes; last_notification_sent reset to NULL |

## Acceptance Criteria

- [ ] "Enable Notifications" button requests browser permission
- [ ] Button shows "✓ Notifications Enabled" and is disabled after permission granted
- [ ] Reminder dropdown is disabled when no due date is set
- [ ] Reminder dropdown is enabled once a due date is set
- [ ] Can select reminder timing from 7 predefined options
- [ ] Can clear reminder by selecting "No reminder"
- [ ] Todo displays 🔔 badge with human-readable timing (e.g., "🔔 1d before")
- [ ] Browser notification appears at correct time (Singapore timezone)
- [ ] Notification title: "Todo Reminder", body: todo title
- [ ] Only one notification sent per reminder (duplicate prevention)
- [ ] Completed todos do not trigger notifications
- [ ] Notification respects browser permission status

## `data-testid` Attributes

| Element | `data-testid` |
|---------|---------------|
| Enable notifications button | `enable-notifications-btn` |
| Reminder dropdown (create form) | `new-reminder-select` |
| Reminder dropdown (edit mode) | `edit-reminder-select` |
| Reminder badge on todo | `reminder-badge` |

## Files to Create / Modify

| File | Change |
|------|--------|
| `lib/hooks/useNotifications.ts` | New — custom hook |
| `app/api/notifications/check/route.ts` | New — polling endpoint |
| `app/page.tsx` | Add enable button, reminder dropdowns, reminder badge, polling |

## Testing Requirements

### E2E Tests — `tests/05-reminders.spec.ts`
- Enable button exists and is clickable
- Reminder dropdown disabled without due date
- Reminder dropdown enabled once due date is set
- Can select reminder timing
- Reminder badge displays correctly
- `GET /api/notifications/check` returns correct todos (via API request)

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome / Edge | ✅ Full |
| Firefox | ✅ Full |
| Safari | ⚠️ Requires HTTPS (not on localhost) |
| Mobile | ❌ Limited (background restrictions) |

## Out of Scope
- Email / SMS / push notifications (service worker)
- Custom notification sounds
- Snooze functionality
- Multiple reminders per todo
- Notification history/log

---

*PRP-04 | Reminder & Notification System | Status: Ready for Implementation*
