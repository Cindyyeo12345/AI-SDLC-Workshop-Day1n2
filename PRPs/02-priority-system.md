# PRP: Priority System

## Feature Overview
Three-level priority system with visual color coding and automatic sorting to help users focus on important tasks.

## User Stories

### As a user
- I want to mark todos as high/medium/low priority
- So that I can see which tasks need immediate attention

### As a busy user
- I want high-priority tasks to appear first
- So that I don't miss critical deadlines

### As a visual user
- I want different colors for each priority
- So that I can quickly scan my task list

## Priority Levels

| Level | Badge Color | Text Color | Use Case | Sort Order |
|-------|------------|------------|----------|------------|
| **High** | Red (#EF4444) | White | Urgent, critical tasks | 1st |
| **Medium** | Yellow (#F59E0B) | White | Standard tasks | 2nd |
| **Low** | Blue (#3B82F6) | White | Nice-to-have tasks | 3rd |

### Default Behavior
- New todos default to **Medium** priority if not specified
- Priority is optional but defaults are applied automatically

## User Flow

### Setting Priority (Create)
1. User enters todo title
2. User clicks priority dropdown
3. User selects: High, Medium, or Low
4. Badge preview updates in form
5. User clicks "Add"
6. Todo appears with colored priority badge

### Changing Priority (Edit)
1. User clicks "Edit" on existing todo
2. User changes priority dropdown
3. User clicks "Save Changes"
4. Badge updates immediately
5. Todo re-sorts to correct position

### Filtering by Priority
1. User clicks priority filter dropdown (top of page)
2. User selects: All, High, Medium, or Low
3. System shows only todos matching selected priority
4. Filter applies to all sections (Active, Completed)
5. User selects "All" to clear filter

## Technical Requirements

### Database Field
```sql
ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium';
```

Already included in PRP-01 schema — no migration needed.

### Type Definition
```typescript
type Priority = 'high' | 'medium' | 'low';
```

### API Integration
Already covered by main CRUD endpoints — priority is just another todo field:
```typescript
// Create/Update payload
{
  priority?: Priority;  // defaults to 'medium'
}
```

### Sorting Algorithm
```typescript
// Priority order in SQL (getAll)
ORDER BY
  completed ASC,
  CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
  CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
  due_date ASC,
  created_at DESC
```

### UI Components

#### Priority Badge
```tsx
const PRIORITY_STYLES: Record<Priority, string> = {
  high:   'bg-red-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low:    'bg-blue-500 text-white',
};

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_STYLES[priority]}`}
      aria-label={`Priority: ${priority}`}
    >
      {priority.toUpperCase()}
    </span>
  );
}
```

#### Priority Dropdown (Create Form)
```tsx
<select
  data-testid="new-priority-select"
  value={newPriority}
  onChange={e => setNewPriority(e.target.value as Priority)}
>
  <option value="high">High Priority</option>
  <option value="medium">Medium Priority</option>
  <option value="low">Low Priority</option>
</select>
```

#### Priority Dropdown (Edit Mode)
```tsx
<select
  data-testid="edit-priority-select"
  value={editState.priority}
  onChange={e => setEditState(s => ({ ...s, priority: e.target.value as Priority }))}
>
  <option value="high">High Priority</option>
  <option value="medium">Medium Priority</option>
  <option value="low">Low Priority</option>
</select>
```

#### Priority Filter Dropdown
```tsx
<select
  data-testid="priority-filter"
  value={priorityFilter}
  onChange={e => setPriorityFilter(e.target.value as 'all' | Priority)}
>
  <option value="all">All Priorities</option>
  <option value="high">High Only</option>
  <option value="medium">Medium Only</option>
  <option value="low">Low Only</option>
</select>
```

### Filter Logic (Client-Side)
```typescript
const filtered = priorityFilter === 'all'
  ? todos
  : todos.filter(t => t.priority === priorityFilter);

const activeTodos    = filtered.filter(t => !t.completed);
const completedTodos = filtered.filter(t =>  t.completed);
```

## Visual Design

### Badge Placement
- Appears inline next to todo title
- Small size (`text-xs`) to avoid dominating
- Round corners (`rounded-full`) for visual distinction

### Section Display
Both active and completed sections show priority badges:
- **Active**: Badge clearly visible
- **Completed**: Badge with reduced opacity (inherited from parent `opacity-60`)

### Filter UI
- Dropdown positioned below the add-todo form
- Label: "Filter by Priority:"
- Highlighted border + background when a filter is active
- "Clear ✕" button appears when filter is not "All"

## `data-testid` Attributes

| Element | `data-testid` |
|---------|---------------|
| Priority select (create form) | `new-priority-select` |
| Priority select (edit mode) | `edit-priority-select` |
| Priority filter dropdown | `priority-filter` |

## Acceptance Criteria

- [ ] Priority dropdown available when creating todo
- [ ] Priority dropdown available when editing todo
- [ ] Default priority is "medium" if not specified
- [ ] High priority badge is red with white text
- [ ] Medium priority badge is yellow with white text
- [ ] Low priority badge is blue with white text
- [ ] Todos sorted by priority (high→medium→low) within each section
- [ ] Priority filter dropdown at top of list
- [ ] Selecting priority filter shows only matching todos
- [ ] "All Priorities" option clears filter
- [ ] Priority badges visible for both active and completed todos

## Accessibility

### Color + Text
All badges use white text on colored backgrounds:
- Red badge (`bg-red-500`): sufficient contrast for WCAG AA
- Yellow badge (`bg-yellow-500`): sufficient contrast for WCAG AA
- Blue badge (`bg-blue-500`): sufficient contrast for WCAG AA

### Screen Readers
```tsx
<span aria-label={`Priority: ${priority}`}>
  {priority.toUpperCase()}
</span>
```

### Keyboard Navigation
- Priority dropdown fully keyboard accessible
- Tab order: Title → Priority → Due Date → Add button

## Testing Requirements

### E2E Tests — `tests/03-priority.spec.ts`

Test cases:
- [ ] Create todo with high priority — badge shows red HIGH
- [ ] Create todo with default (medium) priority
- [ ] Edit todo to change priority from medium to low
- [ ] Verify sorting: high appears before medium before low
- [ ] Filter by high priority shows only high-priority todos
- [ ] Clear filter ("All Priorities") shows all todos again

## Error Handling
- Invalid priority value sent to API: defaults to 'medium' (enforced by `input.priority ?? todo.priority` in `todoDB.update`)
- Server validates accepted values via TypeScript types

## Out of Scope
- Custom priority levels (only 3 fixed levels)
- Priority icons/emojis (text only)
- Priority-based notifications
- Automatic priority suggestions

---

*PRP-02 | Priority System | Status: Implemented*
