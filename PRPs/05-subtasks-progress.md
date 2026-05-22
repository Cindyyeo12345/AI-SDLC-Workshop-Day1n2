# 05-subtasks-progress.md - Subtasks & Progress Tracking

## Feature Overview

This PRP defines Subtasks and Progress Tracking for the Todo App.

The feature adds checklist-style subtasks under each todo and computes completion progress in real time. It also enforces deterministic ordering and cascade deletion behavior.

Core outcomes:
- Checklist functionality per todo
- Visual progress bars and progress text
- Position management (move up/down and stable ordering)
- Cascade delete behavior when parent todo is deleted

## User Stories

1. As a user, I want to add subtasks under a todo so I can break work into smaller steps.
2. As a user, I want to check and uncheck subtasks so I can track completion.
3. As a user, I want to see progress for each todo so I can quickly understand status.
4. As a user, I want to reorder subtasks so my checklist reflects execution order.
5. As a user, I want subtasks removed automatically when the parent todo is deleted.

## User Flow

1. User opens the todo list page.
2. User adds a todo.
3. User adds one or more subtasks to that todo.
4. User toggles subtask completion checkboxes.
5. UI updates progress text and bar immediately.
6. User reorders subtasks with Up and Down controls.
7. User deletes a subtask and positions are reindexed.
8. User deletes the parent todo and all related subtasks are removed by cascade.

## Technical Requirements

### Database Schema

```sql
CREATE TABLE IF NOT EXISTS subtasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  todo_id     INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);
```

Required behavior:
- Enable SQLite foreign keys.
- `todo_id` uses `ON DELETE CASCADE`.
- Positions are contiguous after reorder/delete.

Recommended index:

```sql
CREATE INDEX IF NOT EXISTS idx_subtasks_todo_position
ON subtasks(todo_id, position);
```

### API Contracts

1. `GET /api/todos`
- Auth required.
- Returns todos including `subtasks[]` sorted by `position ASC`.

2. `POST /api/todos/[id]/subtasks`
- Auth required.
- Body:

```json
{ "title": "Draft agenda" }
```

- Validation:
  - title required and trimmed
  - max 500 chars
  - parent todo must belong to current user

3. `PUT /api/todos/[id]/subtasks/[subtaskId]`
- Auth required.
- Supports:

```json
{ "completed": true }
```

```json
{ "title": "Updated text" }
```

```json
{ "action": "move_up" }
```

```json
{ "action": "move_down" }
```

4. `DELETE /api/todos/[id]/subtasks/[subtaskId]`
- Auth required.
- Removes subtask and compacts remaining positions.

5. `DELETE /api/todos/[id]`
- Existing endpoint.
- Must cascade delete related subtasks.

### UI Requirements

Per todo card:
- Subtask input and Add button
- Subtask list sorted by position
- Checkbox toggle for completion
- Move up/down buttons with boundary disable
- Subtask delete action
- Progress text: `completed/total (percent%)`
- Progress bar width based on percentage

Progress formula:
- `total = subtasks.length`
- `completed = subtasks.filter(s => s.completed).length`
- if total is 0, percent is 0
- else `percent = round((completed / total) * 100)`

### Error Handling

- 400 for invalid payload/title/ids
- 401 for unauthenticated requests
- 404 for missing todo/subtask within user scope
- 500 for server failures

### Security and Integrity

- Scope every subtask query by user and todo.
- Use prepared statements for all DB operations.
- Keep reordering and position updates transactional.

## Acceptance Criteria

1. User can add subtasks to any owned todo.
2. User can toggle completion for each subtask.
3. Progress text and bar update correctly after add/toggle/delete/reorder.
4. Subtasks always render in position order.
5. First item cannot move up and last item cannot move down.
6. Deleting a subtask compacts positions with no gaps.
7. Deleting a todo removes all related subtasks (cascade delete).
8. APIs enforce auth and ownership checks.
9. Invalid payloads return proper 400 errors.
10. End-to-end flow passes from creation through cascade deletion.

## Testing Requirements

### Unit Tests

1. Progress computation for empty, partial, and full completion.
2. Move up/down behavior including boundary no-op.
3. Position compaction after subtask delete.
4. Cascade behavior when parent todo is deleted.

### Integration/API Tests

1. Create subtask success and validation failures.
2. Toggle and title update success/failure paths.
3. Move action correctness and boundary behavior.
4. Delete subtask with position compaction.
5. Cross-user access blocked.

### E2E Tests

1. Authenticate user.
2. Create todo.
3. Add 3 subtasks.
4. Verify `0/3 (0%)`.
5. Reorder middle item upward.
6. Toggle all complete and verify `3/3 (100%)`.
7. Delete parent todo.
8. Verify todo is gone and no orphan subtask UI remains.

## Out of Scope

1. Nested subtasks.
2. Drag-and-drop ordering.
3. Cross-todo subtask move.
4. Subtask-level due dates/reminders.
5. Bulk subtask operations.

## Success Metrics

1. All acceptance criteria pass.
2. E2E workflow is stable across repeated runs.
3. No orphan subtasks after todo deletion.
4. No ordering corruption after repeated move operations.
5. Progress always matches actual completion state.

## AI Assistant Prompt Snippet

Implement Subtasks and Progress Tracking for the Todo App using this PRP.

Requirements summary:
- Add subtasks table with todo cascade delete.
- Implement subtask CRUD and move APIs under `/api/todos/[id]/subtasks`.
- Include `subtasks[]` in todo list response.
- Add checklist UI, progress text, and progress bar.
- Enforce position management with boundary-safe reordering.
- Add unit, API, and E2E tests for core and edge cases.
