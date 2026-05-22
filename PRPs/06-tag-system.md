# PRP-06: Tag System

## Feature Overview

Add a tag system that lets users organize todos with reusable, color-coded labels. A todo can have many tags, and a tag can be used by many todos (many-to-many). Users can create, read, update, and delete tags, then filter todo lists by selected tag(s).

Core scope:
- Color-coded labels
- Many-to-many relationships
- Tag management (CRUD)
- Filtering by tag

---

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | User | Create custom tags with colors | I can group todos by theme/context |
| US-02 | User | Assign multiple tags to one todo | I can classify tasks in multiple ways |
| US-03 | User | Edit or rename tags | My tag system can evolve over time |
| US-04 | User | Delete a tag | I can remove labels I no longer use |
| US-05 | User | Filter todos by tag | I can focus on a specific category quickly |

---

## User Flow

### Creating a Tag
1. User opens tag management section
2. User enters tag name and selects a color
3. User saves tag
4. New tag appears in the available tag list

### Assigning Tags to a Todo
1. User creates/edits a todo
2. User selects one or more tags from available tags
3. User saves todo
4. Selected tags appear as colored pills on the todo card

### Editing a Tag
1. User opens tag management
2. User updates name and/or color
3. Changes apply to all todos using that tag

### Deleting a Tag
1. User clicks delete on a tag
2. Tag is removed from `tags` table
3. Related mappings in `todo_tags` are removed automatically
4. Todos remain intact

### Filtering by Tag
1. User selects a tag in the filter UI
2. Todo list updates to show only todos linked to that tag
3. User clears filter to return to full list

---

## Technical Requirements

### 1. Database Schema

Use `lib/db.ts` for schema and DB operations.

```sql
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
```

Notes:
- `todo_tags` is the many-to-many join table.
- `UNIQUE(user_id, name)` prevents duplicate tag names per user.
- Deleting a todo or tag cascades through `todo_tags`.

### 2. TypeScript Types

```typescript
export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string; // hex format, e.g. #3B82F6
  created_at: string;
}

export interface CreateTagInput {
  name: string;
  color: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}
```

### 3. API Endpoints

Use authenticated route pattern (`getSession()` + `session.userId` scoping).

1. `GET /api/tags`
   - List user tags, sorted by name.

2. `POST /api/tags`
   - Body: `{ name: string, color: string }`
   - Creates a tag for current user.

3. `PUT /api/tags/[id]`
   - Body: `{ name?: string, color?: string }`
   - Updates user-owned tag.

4. `DELETE /api/tags/[id]`
   - Deletes tag and linked rows in `todo_tags`.

5. Todo integration (`/api/todos` create/update)
   - Accepts `tagIds?: number[]`
   - Replaces tag mappings in `todo_tags` for that todo.

6. Filtering (`GET /api/todos`)
   - Supports `?tagId=<id>` (single tag) for server-side filtering.

### 4. Validation Rules

- `name` required, trimmed, 1-50 chars.
- `color` required, must match hex: `^#[0-9A-Fa-f]{6}$`.
- Tag updates/deletes must be scoped to current user.
- Reject duplicate tag names per user with 409.

### 5. Query Patterns

Fetch tags for a todo:

```sql
SELECT t.*
FROM tags t
INNER JOIN todo_tags tt ON tt.tag_id = t.id
WHERE tt.todo_id = ?
ORDER BY t.name ASC;
```

Filter todos by tag:

```sql
SELECT DISTINCT td.*
FROM todos td
INNER JOIN todo_tags tt ON tt.todo_id = td.id
WHERE td.user_id = ? AND tt.tag_id = ?
ORDER BY td.completed ASC, td.created_at DESC;
```

---

## UI Components

Add UI in `app/page.tsx` following existing monolithic patterns.

### Tag Pill

```tsx
function TagPill({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
      style={{ backgroundColor: color }}
      aria-label={`Tag: ${name}`}
    >
      {name}
    </span>
  );
}
```

### Tag Selector (Create/Edit Todo)
- Multi-select style control for available tags
- Shows selected tags as removable chips

### Tag Management Panel
- List tags with edit/delete actions
- Create form: name + color picker

### Tag Filter UI
- Dropdown or chip bar: All + user tags
- Active filter is visually highlighted

---

## Edge Cases

1. Same tag name with different case (`Work` vs `work`)
   - Normalize comparison strategy (recommended: case-insensitive uniqueness).

2. Deleting a tag currently used by many todos
   - Remove mappings only; todos remain unchanged.

3. Invalid color values from manual input
   - Reject with 400 and clear message.

4. Filter tag deleted while active
   - Reset to "All tags" to avoid empty stale state.

5. User attempts to edit another user's tag
   - Return 404/403 without leaking ownership details.

---

## Acceptance Criteria

- [ ] Users can create tags with name + color.
- [ ] Users can edit and delete their own tags.
- [ ] Todos can have zero, one, or many tags.
- [ ] Same tag can be assigned to multiple todos.
- [ ] Tag chips render in configured colors.
- [ ] Filtering by tag shows only matching todos.
- [ ] Deleting a tag removes join rows but does not delete todos.
- [ ] Cross-user tag access is blocked.

---

## Testing Requirements

### E2E (Playwright)

1. Create tag (`Work`, `#3B82F6`) and verify it appears in management + selector.
2. Assign tag to two todos; verify both show the colored tag pill.
3. Filter by tag; verify only tagged todos are shown.
4. Edit tag name/color; verify updates appear across linked todos.
5. Delete tag; verify tag disappears from todos and filter options.

### Unit/Integration

1. DB CRUD for `tags` with user scoping.
2. Insert/delete mapping rows in `todo_tags`.
3. Duplicate tag-name protection per user.
4. Todo filtering by `tagId`.
5. Authorization checks for tag update/delete.

---

## Out of Scope

- Nested/hierarchical tags
- Global shared tags across all users
- Tag descriptions/icons
- Advanced tag logic (AND/OR combinations across multiple selected tags)

---

## Success Metrics

1. Users can manage tags without manual DB operations.
2. Tag assignment and filtering are consistently accurate.
3. No orphan join-table rows remain after todo/tag deletion.
4. Tag workflows are fully covered by E2E tests.
