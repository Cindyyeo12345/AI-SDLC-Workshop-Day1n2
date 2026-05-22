# PRP-08: Search & Filtering

## Feature Overview

Implement fast, user-friendly search and filtering for todos so users can quickly find tasks in large lists. The feature includes real-time text search, advanced search across title and tags, multi-criteria filtering, and client-side performance safeguards.

Core scope:
- Real-time text search
- Advanced search (title + tags)
- Multi-criteria filtering
- Client-side performance

---

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | User | Search by typing part of a title | I can find tasks instantly |
| US-02 | User | Search by tag name | I can find grouped tasks quickly |
| US-03 | User | Combine filters (priority, completion, tag, due-state) | I can narrow down results precisely |
| US-04 | User | Get immediate feedback while typing | I don’t need to press submit |
| US-05 | User | Keep UI responsive with many todos | Searching remains smooth |

---

## User Flow

### Real-Time Search
1. User types in search input.
2. List updates immediately (debounced) without page reload.
3. Matching applies to title and tag names.
4. Clear search resets to full list.

### Multi-Criteria Filtering
1. User sets one or more filters:
   - Priority (`all/high/medium/low`)
   - Tag (`all/<tagId>`)
   - Completion (`all/active/completed`)
   - Due state (`all/overdue/today/this-week/no-due-date`)
2. Results update from intersection of all active filters.
3. User can clear individual filters or reset all.

### Empty State
1. If no match, show clear “no results” message.
2. Offer one-click “Clear filters”.

---

## Technical Requirements

### 1. Data Sources

- Todos from `GET /api/todos` (already user-scoped).
- Tags from `GET /api/tags`.
- Filtering/search logic runs client-side in `app/page.tsx`.

### 2. Search Normalization

Normalize both query and target fields:
- `trim()`
- lowercase
- collapse repeated spaces

Search fields:
- `todo.title`
- each tag name in `todo.tags[]`

### 3. Filter Model

```typescript
type CompletionFilter = 'all' | 'active' | 'completed';
type DueFilter = 'all' | 'overdue' | 'today' | 'this-week' | 'no-due-date';

interface SearchFilterState {
  query: string;
  priority: 'all' | Priority;
  tagId: 'all' | number;
  completion: CompletionFilter;
  due: DueFilter;
}
```

### 4. Filter Algorithm Order

Apply in this order for predictable performance:
1. Completion
2. Priority
3. Tag
4. Due state
5. Text query (title + tags)

This preserves correctness while reducing candidates before string matching.

### 5. Debounce Strategy

- Debounce search input updates by ~150–250ms.
- Use `useMemo` for filtered list derivation.
- Avoid repeated heavy loops during every keystroke.

### 6. API Compatibility

No required schema changes.

Optional enhancement:
- Server-side search query params later (`q`, `priority`, `tagId`, etc.) for very large datasets.
- Current PRP keeps implementation client-side per scope.

---

## UI Components

### Search Bar
- Placeholder: `Search todos by title or tag...`
- Real-time input with clear (`✕`) action.
- `data-testid="todo-search-input"`

### Filter Controls
- Priority filter (existing)
- Tag filter (existing)
- Completion filter (new)
- Due-state filter (new)
- Clear-all button when any filter active

### Result Summary
- Small helper text:
  - `Showing X of Y todos`
  - `No todos match current search/filters`

Example:

```tsx
<input
  data-testid="todo-search-input"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Search todos by title or tag..."
/>
```

---

## Edge Cases

1. Query is only spaces:
   - Treat as empty query.

2. Tag deleted while selected:
   - Reset tag filter to `all`.

3. Todo has no tags:
   - Still searchable by title.

4. Filters produce zero results:
   - Show empty state without errors.

5. Large list (1000+ todos):
   - UI remains responsive using debounce + memoized filtering.

---

## Acceptance Criteria

- [ ] Search updates results in real time while typing.
- [ ] Query matches both todo title and tag names.
- [ ] Priority, tag, completion, and due-state filters can be combined.
- [ ] Active + completed section rendering remains correct after filtering.
- [ ] Clear-all returns to default full list state.
- [ ] No-results state is displayed when applicable.
- [ ] Client remains responsive during rapid typing.

---

## Testing Requirements

### E2E (Playwright)

1. Create todos with varying titles/tags/priorities/completion states.
2. Search by partial title; verify match-only results.
3. Search by tag name; verify tagged todos are returned.
4. Apply multiple filters together; verify intersection behavior.
5. Verify clear-query and clear-filters restore full list.
6. Validate zero-results message appears for unmatched query.

### Unit/Integration

1. Filter utility:
   - Completion filter correctness
   - Priority filter correctness
   - Tag filter correctness
   - Due-state calculations
2. Search utility:
   - Case-insensitive matching
   - Trimmed/normalized query behavior
   - Tag-name matching
3. Performance-focused checks:
   - Debounced updates
   - Stable memoized output for unchanged inputs

---

## Out of Scope

- Full-text search backend/indexing engine
- Fuzzy ranking/scoring algorithms
- Saved filter presets
- Cross-user/global search

---

## Success Metrics

1. Users can find target todos in under a few keystrokes.
2. Combined filters return accurate, deterministic results.
3. Search remains responsive for large local datasets.
4. No regressions in existing todo/tag/priority behavior.
