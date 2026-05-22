# PRP-10: Calendar View

## Feature Overview

The Calendar View provides a monthly visual overview of all todos organised by their due dates. It lives on a dedicated `/calendar` page (separate from the main list) and lets users see at a glance which days are busy, what priority those todos carry, and which days are Singapore public holidays. Users can click any day to see a full detail panel for that day's todos.

---

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | User | See all my todos laid out on a monthly calendar | I can spot busy days and plan ahead |
| US-02 | User | Navigate between months | I can review past and future due dates |
| US-03 | User | See Singapore public holidays on the calendar | I can factor them into my planning |
| US-04 | User | See todo priority at a glance on the calendar | I know which days have high-stakes work |
| US-05 | User | Click a day to see its full todo list | I can read the complete details without leaving the page |
| US-06 | User | Jump back to today's month quickly | I don't have to navigate manually after browsing |
| US-07 | User | Navigate back to my main todo list | I can switch views without losing context |

---

## User Flow

### Viewing the Calendar
1. User clicks **📅 Calendar** in the main page header
2. Browser navigates to `/calendar`
3. Current month is shown by default (Singapore timezone)
4. Today's date is highlighted with an orange circle
5. Todos with due dates appear as coloured pills inside their respective day cells
6. Singapore public holidays appear with a 🎉 label inside the day cell

### Navigating Months
1. User clicks **‹** (previous) or **›** (next) to move between months
2. Calendar grid re-renders for the new month
3. Selected day panel (if open) closes on navigation
4. User clicks **Today** button to jump back to the current month

### Viewing Day Details
1. User clicks on any day cell
2. A detail panel expands below the calendar grid
3. Panel shows all todos due that day, sorted: active first (high → medium → low), then completed
4. Each todo shows: priority dot, title, notes (truncated), tags, priority badge, completion status
5. User clicks the same day again or the **✕** button to close the panel

---

## Technical Requirements

### Route & Auth
- Page: `app/calendar/page.tsx` — `'use client'` component
- Protected route: middleware redirects unauthenticated users to `/login`
- Middleware matcher must include `/calendar`

### Data Fetching
- Fetch all todos via `GET /api/todos` (existing endpoint, no new API needed)
- Todos are fetched once on mount; no pagination required
- All due dates stored as ISO strings — converted to Singapore date keys for placement

### Date Key Logic
```typescript
// Convert ISO due_date to YYYY-MM-DD in Singapore timezone
function toSGDateKey(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
}

// Convert local Date object to YYYY-MM-DD (no timezone conversion)
function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

### Calendar Grid Construction
```typescript
function buildCalendarGrid(year: number, month: number, todos: Todo[]): CalendarCell[] {
  // 1. Get today's key in Singapore time
  // 2. Group todos by SG due-date key
  // 3. Find first day-of-week for month (0 = Sunday)
  // 4. Add leading null cells for padding
  // 5. Add one cell per day with: todos, holiday, isToday flag
  // 6. Pad trailing cells to complete the last row (6 rows × 7 = 42 cells max)
}
```

### Singapore Public Holidays
Hardcoded map of `YYYY-MM-DD → holiday name` covering 2024–2026:

| Year | Holiday | Date |
|------|---------|------|
| 2025 | New Year's Day | 2025-01-01 |
| 2025 | Chinese New Year | 2025-01-29, 2025-01-30 |
| 2025 | Hari Raya Puasa | 2025-03-31 |
| 2025 | Good Friday | 2025-04-18 |
| 2025 | Labour Day | 2025-05-01 |
| 2025 | Vesak Day | 2025-05-12 |
| 2025 | Hari Raya Haji | 2025-06-07 |
| 2025 | National Day | 2025-08-09 |
| 2025 | Deepavali | 2025-10-20 |
| 2025 | Christmas Day | 2025-12-25 |
| 2026 | New Year's Day | 2026-01-01 |
| 2026 | Chinese New Year | 2026-02-17, 2026-02-18 |
| 2026 | Hari Raya Puasa | 2026-03-20 |
| 2026 | Good Friday | 2026-04-03 |
| 2026 | Labour Day | 2026-05-01 |
| 2026 | Hari Raya Haji | 2026-05-27 |
| 2026 | Vesak Day | 2026-05-31 |
| 2026 | National Day (in lieu) | 2026-08-10 |
| 2026 | Deepavali | 2026-11-08 |
| 2026 | Christmas Day | 2026-12-25 |

### TypeScript Interfaces
```typescript
type Priority = 'high' | 'medium' | 'low';

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  notes: string | null;
  tags?: Tag[];
}

interface CalendarCell {
  date: Date | null;          // null for padding cells
  dateKey: string | null;     // YYYY-MM-DD or null for padding
  todos: Todo[];
  holiday: string | null;
  isToday: boolean;
}
```

---

## UI Components

### Page Layout
```
┌─────────────────────────────────────────────────┐
│  📅 Calendar View              ← Back to List   │  ← header
├─────────────────────────────────────────────────┤
│     ‹        May 2025   [Today]         ›        │  ← month nav
├──────┬──────┬──────┬──────┬──────┬──────┬───────┤
│ Sun  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │  Sat  │  ← day headers
├──────┼──────┼──────┼──────┼──────┼──────┼───────┤
│      │      │      │  1   │  2   │  3   │   4   │
│      │      │      │ 🎉   │ todo │      │       │
├──────┼──────┼──────┼──────┼──────┼──────┼───────┤
│  5   │  6   │  7   │  8   │  9   │  10  │  11   │
│      │ high │      │      │ [⬤]  │      │       │
│      │ med  │      │      │      │      │       │
└──────┴──────┴──────┴──────┴──────┴──────┴───────┘

┌─────────────────────────────────────────────────┐
│  Thursday, 9 May 2025                        ✕  │  ← detail panel
│  ● Buy groceries               [medium]         │
│    Due today — notes here                       │
│  ● Submit report               [high]           │
└─────────────────────────────────────────────────┘

Legend: 🟠 Today  🔴 High  🟡 Medium  🔵 Low  🎉 Holiday
```

### Colour Coding (matches main list)
| Priority | Pill class | Dot class |
|----------|-----------|-----------|
| high | `bg-red-100 text-red-800 border border-red-200` | `bg-red-500` |
| medium | `bg-yellow-100 text-yellow-800 border border-yellow-200` | `bg-yellow-500` |
| low | `bg-blue-100 text-blue-800 border border-blue-200` | `bg-blue-500` |

### Day Cell Rules
- Today: orange circle around day number (`bg-orange-500 text-white`), cell `bg-orange-50`
- Selected: `bg-blue-50 ring-2 ring-inset ring-blue-400`
- Holiday: `text-red-600` label with 🎉 emoji below day number
- Max 3 todo pills visible per cell; overflow shows "+N more"
- Completed-only days show "✓ N done" in gray

### Detail Panel Sort Order
1. Active todos sorted high → medium → low
2. Completed todos appear below active, also sorted by priority

---

## State Management

```typescript
// Calendar page state
const [year, setYear] = useState<number>(...)      // current view year (SGT)
const [month, setMonth] = useState<number>(...)    // current view month 0–11 (SGT)
const [todos, setTodos] = useState<Todo[]>([])     // all todos from API
const [loading, setLoading] = useState(true)
const [selectedKey, setSelectedKey] = useState<string | null>(null)  // YYYY-MM-DD
```

No server-side state — the page is a pure client component. Todos are fetched once on mount and the grid is computed in memory on every render when year/month changes.

---

## Navigation Integration

### Main page header (`app/page.tsx`)
Add a **📅 Calendar** link button next to the notifications toggle:
```tsx
import Link from 'next/link';

<Link
  href="/calendar"
  data-testid="calendar-view-link"
  className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
>
  📅 Calendar
</Link>
```

### Calendar page back-link
```tsx
<Link href="/" data-testid="back-to-list-link">← Back to List</Link>
```

---

## Middleware Protection

```typescript
// middleware.ts
const protectedRoutes = ['/', '/calendar'];

export const config = {
  matcher: ['/', '/login', '/calendar'],
};
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Todo has no `due_date` | Excluded from calendar; only visible in list view |
| Multiple todos on the same day | All shown; max 3 pills, overflow count displayed |
| Due date in a different timezone (e.g. stored as UTC midnight) | Converted to Singapore date key via `toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })` |
| Month with only 4 rows | Grid always shows complete rows; trailing cells are blank/gray |
| Holiday on the same day as todos | Both rendered: holiday label first, then todo pills |
| User navigates to past/future month | Grid re-renders correctly; selected day panel closes |
| No todos in the fetched list | Calendar renders; all cells show only day numbers and holidays |
| API fetch fails | `loading` stays false; empty grid renders; no crash |

---

## Acceptance Criteria

- [ ] `/calendar` shows a 7-column monthly grid starting on Sunday
- [ ] Today's date is highlighted with an orange filled circle
- [ ] Todos with a `due_date` appear as coloured pills on the correct day
- [ ] Pills are colour-coded: red = high, yellow = medium, blue = low
- [ ] Cells with more than 3 active todos show "+N more"
- [ ] Singapore public holidays appear with a 🎉 label on the correct dates
- [ ] Clicking **‹** navigates to the previous month
- [ ] Clicking **›** navigates to the next month
- [ ] Clicking **Today** returns to the current month
- [ ] Clicking a day opens the detail panel below the grid
- [ ] Detail panel lists todos sorted: active (by priority) then completed
- [ ] Detail panel shows title, notes, tags, and priority badge per todo
- [ ] Clicking the same day again or ✕ closes the detail panel
- [ ] **📅 Calendar** link in main page header navigates to `/calendar`
- [ ] **← Back to List** link on calendar page navigates to `/`
- [ ] Unauthenticated users are redirected to `/login` when visiting `/calendar`
- [ ] `npx tsc --noEmit` passes with no errors

---

## Testing Requirements

### E2E Tests (Playwright)
```
Feature: Calendar View

Scenario: Navigate to calendar
  Given I am logged in
  When I click "📅 Calendar" in the header
  Then I should be on /calendar
  And I should see the current month and year

Scenario: Today is highlighted
  Given I am on /calendar
  Then the current day cell should have an orange circle

Scenario: Todo appears on correct day
  Given I have a todo with due_date = "2025-05-09T10:00:00.000Z"
  When I navigate to May 2025
  Then the cell for May 9 should contain that todo's title

Scenario: Holiday is shown
  Given I am on /calendar showing August 2025
  Then the cell for August 9 should contain "🎉 National Day"

Scenario: Day detail panel
  Given I have todos on May 9
  When I click the May 9 cell
  Then a detail panel should appear below the grid
  And it should list those todos with priority badges

Scenario: Month navigation
  When I click the ‹ button
  Then the calendar should show the previous month
  When I click Today
  Then the calendar should return to the current month
```

### Unit Tests
- `buildCalendarGrid()` — correct number of cells, correct padding, correct today flag
- `toSGDateKey()` — UTC midnight → correct Singapore date
- Holiday map — known holidays return correct names

---

## Out of Scope

- Creating or editing todos from the calendar (read-only view — use the list page)
- Drag-and-drop rescheduling
- Week or day view (monthly only)
- Recurring event visualisation (only the next instance's due_date is shown)
- Syncing with external calendars (Google Calendar, iCal)
- Custom holiday support

---

## Success Metrics

- Users can identify their busiest upcoming weeks at a glance
- Singapore public holidays are surfaced without any external API calls
- Navigating between months is instantaneous (client-side only)
- Calendar loads in < 500 ms (single API call, client-side rendering)
