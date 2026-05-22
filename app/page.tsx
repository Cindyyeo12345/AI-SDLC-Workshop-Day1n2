'use client';

import { useState, useEffect, useRef } from 'react';
import { formatSingaporeDate, isOverdue, isDueToday, isDueThisWeek } from '@/lib/timezone';
import { useNotifications } from '@/lib/hooks/useNotifications';

type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  notes: string | null;
  recurrence: RecurrencePattern | null;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_notification_sent: string | null;
  tags?: Tag[];
}

interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

interface EditState {
  title: string;
  due_date: string;
  notes: string;
  priority: Priority;
  reminder_minutes: number | null;
  tagIds: number[];
}

const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

type TodoUpdatePayload = Partial<Todo> & { tagIds?: number[] };

const PRIORITY_STYLES: Record<Priority, string> = {
  high:   'bg-red-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low:    'bg-blue-500 text-white',
};

function formatReminderOffset(minutes: number): string {
  if (minutes < 60) return `${minutes}m before`;
  if (minutes < 1440) return `${minutes / 60}h before`;
  return `${minutes / 1440}d before`;
}

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

function DueDateBadge({ dueDate }: { dueDate: string }) {
  if (isOverdue(dueDate)) {
    return (
      <span
        data-testid="overdue-badge"
        className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"
      >
        Overdue · {formatSingaporeDate(dueDate, 'dd MMM yyyy')}
      </span>
    );
  }
  if (isDueToday(dueDate)) {
    return (
      <span
        data-testid="todo-due-date"
        className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium"
      >
        Today · {formatSingaporeDate(dueDate, 'dd MMM yyyy')}
      </span>
    );
  }
  if (isDueThisWeek(dueDate)) {
    return (
      <span
        data-testid="todo-due-date"
        className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium"
      >
        {formatSingaporeDate(dueDate, 'dd MMM yyyy')}
      </span>
    );
  }
  return (
    <span
      data-testid="todo-due-date"
      className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
    >
      {formatSingaporeDate(dueDate, 'dd MMM yyyy')}
    </span>
  );
}

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
      style={{ backgroundColor: tag.color }}
      aria-label={`Tag: ${tag.name}`}
    >
      {tag.name}
    </span>
  );
}

interface TodoCardProps {
  todo: Todo;
  availableTags: Tag[];
  isEditing: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onSave: (data: TodoUpdatePayload) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

function TodoCard({
  todo,
  availableTags,
  isEditing,
  onToggleComplete,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
}: TodoCardProps) {
  const [editState, setEditState] = useState<EditState>({
    title: todo.title,
    due_date: todo.due_date ?? '',
    notes: todo.notes ?? '',
    priority: todo.priority,
    reminder_minutes: todo.reminder_minutes,
    tagIds: (todo.tags ?? []).map((tag) => tag.id),
  });
  const [editError, setEditError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditState({
        title: todo.title,
        due_date: todo.due_date ?? '',
        notes: todo.notes ?? '',
        priority: todo.priority,
        reminder_minutes: todo.reminder_minutes,
        tagIds: (todo.tags ?? []).map((tag) => tag.id),
      });
      setEditError(null);
      setTimeout(() => titleInputRef.current?.focus(), 0);
    }
  }, [isEditing, todo]);

  const handleSave = () => {
    if (!editState.title.trim()) {
      setEditError('Title cannot be empty');
      return;
    }
    onSave({
      title: editState.title.trim(),
      due_date: editState.due_date || null,
      notes: editState.notes || null,
      priority: editState.priority,
      reminder_minutes: editState.reminder_minutes,
      tagIds: editState.tagIds,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancelEdit();
  };

  if (isEditing) {
    return (
      <div data-testid="todo-item" className="bg-white border border-blue-300 rounded-lg p-4 mb-2 shadow-sm">
        {editError && <p className="text-red-500 text-sm mb-2">{editError}</p>}
        <input
          ref={titleInputRef}
          data-testid="edit-title-input"
          type="text"
          value={editState.title}
          onChange={e => setEditState(s => ({ ...s, title: e.target.value }))}
          onKeyDown={handleKeyDown}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Todo title"
        />
        <div className="flex gap-2 mb-2">
          <select
            data-testid="edit-priority-select"
            value={editState.priority}
            onChange={e => setEditState(s => ({ ...s, priority: e.target.value as Priority }))}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <input
            type="datetime-local"
            value={editState.due_date}
            onChange={e => setEditState(s => ({ ...s, due_date: e.target.value, reminder_minutes: e.target.value ? s.reminder_minutes : null }))}
            className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="mb-2">
          <select
            data-testid="edit-reminder-select"
            value={editState.reminder_minutes ?? ''}
            onChange={e => setEditState(s => ({ ...s, reminder_minutes: e.target.value ? Number(e.target.value) : null }))}
            disabled={!editState.due_date}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">No reminder</option>
            <option value="1">1 minute before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="120">2 hours before</option>
            <option value="1440">1 day before</option>
            <option value="2880">2 days before</option>
            <option value="10080">1 week before</option>
          </select>
        </div>
        <textarea
          value={editState.notes}
          onChange={e => setEditState(s => ({ ...s, notes: e.target.value }))}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          placeholder="Notes (optional)"
          rows={2}
          maxLength={2000}
        />
        {availableTags.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const selected = editState.tagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setEditState((s) => ({
                        ...s,
                        tagIds: selected ? s.tagIds.filter((id) => id !== tag.id) : [...s.tagIds, tag.id],
                      }))
                    }
                    className={`text-xs px-2 py-0.5 rounded-full border ${selected ? 'border-blue-500 ring-1 ring-blue-300' : 'border-transparent'}`}
                    style={{ backgroundColor: tag.color, color: '#fff' }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            data-testid="save-todo-button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium"
          >
            Save
          </button>
          <button
            data-testid="cancel-edit-button"
            onClick={onCancelEdit}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="todo-item"
      className={`bg-white border rounded-lg p-4 mb-2 shadow-sm flex items-start gap-3 ${todo.completed ? 'opacity-60' : ''}`}
    >
      <input
        data-testid={todo.completed ? 'completed-todo-checkbox' : 'todo-checkbox'}
        type="checkbox"
        checked={todo.completed}
        onChange={onToggleComplete}
        className="mt-0.5 w-4 h-4 cursor-pointer accent-blue-600"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {todo.title}
          </p>
          <PriorityBadge priority={todo.priority} />
          {todo.recurrence && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-300 font-medium">
              🔄 {RECURRENCE_LABELS[todo.recurrence]}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 items-center">
          {todo.due_date && <DueDateBadge dueDate={todo.due_date} />}
          {todo.reminder_minutes && (
            <span data-testid="reminder-badge" className="text-xs text-purple-600">
              🔔 {formatReminderOffset(todo.reminder_minutes)}
            </span>
          )}
        </div>
        {todo.notes && (
          <p className="mt-1 text-xs text-gray-500 truncate">{todo.notes}</p>
        )}
        {(todo.tags ?? []).length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {(todo.tags ?? []).map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          data-testid="edit-todo-button"
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          title="Edit"
        >
          ✏️
        </button>
        <button
          data-testid="delete-todo-button"
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { isEnabled, isMuted, requestPermission, toggleMute } = useNotifications();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newReminderMinutes, setNewReminderMinutes] = useState<number | null>(null);
  const [newIsRecurring, setNewIsRecurring] = useState(false);
  const [newRecurrence, setNewRecurrence] = useState<RecurrencePattern>('daily');
  const [newTagIds, setNewTagIds] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagColor, setEditingTagColor] = useState('#3B82F6');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [tagFilter, setTagFilter] = useState<'all' | number>('all');
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 5000);
  };

  useEffect(() => {
    fetchTodos();
    fetchTags();
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Notification polling — fires immediately then every 30 seconds when enabled
  useEffect(() => {
    if (!isEnabled || isMuted) return;

    const check = async () => {
      try {
        const res = await fetch('/api/notifications/check');
        if (!res.ok) return;
        const { notifications } = await res.json() as { notifications: { id: number; title: string }[] };
        notifications.forEach(todo => {
          new Notification('Todo Reminder', {
            body: todo.title,
            tag: `todo-${todo.id}`,
          });
        });
      } catch {
        // Silently ignore polling errors
      }
    };

    check(); // immediate check on enable
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [isEnabled, isMuted]);

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data: Todo[] = await res.json();
      setTodos(data);
    } catch {
      showError('Failed to load todos. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch tags');
      const data: Tag[] = await res.json();
      setTags(data);
    } catch {
      showError('Failed to load tags.');
    }
  };

  const createTodo = async () => {
    if (!newTitle.trim()) {
      setTitleError('Title is required');
      return;
    }
    if (newTitle.trim().length > 500) {
      setTitleError('Title must be 500 characters or fewer');
      return;
    }
    if (newIsRecurring && !newDueDate) {
      setTitleError('Recurring todos require a due date');
      return;
    }
    setTitleError(null);

    const tempId = Date.now();
    const optimistic: Todo = {
      id: tempId,
      user_id: 0,
      title: newTitle.trim(),
      completed: false,
      priority: newPriority,
      due_date: newDueDate || null,
      notes: newNotes || null,
      recurrence: newIsRecurring ? newRecurrence : null,
      reminder_minutes: newReminderMinutes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      last_notification_sent: null,
      tags: tags.filter((tag) => newTagIds.includes(tag.id)),
    };

    setTodos(prev => [optimistic, ...prev]);
    const savedTitle = newTitle.trim();
    const savedPriority = newPriority;
    const savedReminderMinutes = newReminderMinutes;
    const savedRecurrence = newIsRecurring ? newRecurrence : null;
    const savedTagIds = [...newTagIds];
    setNewTitle('');
    setNewDueDate('');
    setNewNotes('');
    setNewPriority('medium');
    setNewReminderMinutes(null);
    setNewIsRecurring(false);
    setNewRecurrence('daily');
    setNewTagIds([]);

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: savedTitle,
          due_date: optimistic.due_date,
          notes: optimistic.notes,
          priority: savedPriority,
          reminder_minutes: savedReminderMinutes,
          recurrence: savedRecurrence,
          tagIds: savedTagIds,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created: Todo = await res.json();
      setTodos(prev => prev.map(t => t.id === tempId ? created : t));
    } catch {
      setTodos(prev => prev.filter(t => t.id !== tempId));
      showError('Failed to create todo. Please try again.');
    }
  };

  const updateTodo = async (id: number, data: TodoUpdatePayload) => {
    const previous = todos.find(t => t.id === id);
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: Todo = await res.json();
      setTodos(prev => prev.map(t => t.id === id ? updated : t));
    } catch {
      if (previous) setTodos(prev => prev.map(t => t.id === id ? previous : t));
      showError('Failed to update todo. Please try again.');
    }
  };

  const deleteTodo = async (id: number) => {
    if (!confirm('Delete this todo?')) return;
    const previous = todos.find(t => t.id === id);
    setTodos(prev => prev.filter(t => t.id !== id));

    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      if (previous) {
        setTodos(prev => [...prev, previous].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ));
      }
      showError('Failed to delete todo. Please try again.');
    }
  };

  const toggleComplete = (todo: Todo) => updateTodo(todo.id, { completed: !todo.completed });

  const filtered = priorityFilter === 'all' ? todos : todos.filter(t => t.priority === priorityFilter);
  const filteredByTag = tagFilter === 'all'
    ? filtered
    : filtered.filter((todo) => (todo.tags ?? []).some((tag) => tag.id === tagFilter));
  const activeTodos = filteredByTag.filter(t => !t.completed);
  const completedTodos = filteredByTag.filter(t => t.completed);

  const createTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      showError('Tag name is required.');
      return;
    }

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newTagColor }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to create tag' }));
        throw new Error(body.error || 'Failed to create tag');
      }
      const created: Tag = await res.json();
      setTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
      setNewTagColor('#3B82F6');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create tag.');
    }
  };

  const beginEditTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setEditingTagColor(tag.color);
  };

  const saveTag = async (tagId: number) => {
    const name = editingTagName.trim();
    if (!name) {
      showError('Tag name is required.');
      return;
    }

    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: editingTagColor }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to update tag' }));
        throw new Error(body.error || 'Failed to update tag');
      }
      const updated: Tag = await res.json();
      setTags((prev) => prev.map((tag) => (tag.id === tagId ? updated : tag)).sort((a, b) => a.name.localeCompare(b.name)));
      setTodos((prev) => prev.map((todo) => ({
        ...todo,
        tags: (todo.tags ?? []).map((tag) => (tag.id === tagId ? updated : tag)),
      })));
      setEditingTagId(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update tag.');
    }
  };

  const deleteTag = async (tagId: number) => {
    if (!confirm('Delete this tag?')) return;

    try {
      const res = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to delete tag' }));
        throw new Error(body.error || 'Failed to delete tag');
      }
      setTags((prev) => prev.filter((tag) => tag.id !== tagId));
      setNewTagIds((prev) => prev.filter((id) => id !== tagId));
      setTodos((prev) => prev.map((todo) => ({
        ...todo,
        tags: (todo.tags ?? []).filter((tag) => tag.id !== tagId),
      })));
      if (tagFilter === tagId) {
        setTagFilter('all');
      }
      if (editingTagId === tagId) {
        setEditingTagId(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete tag.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <main className="max-w-2xl mx-auto p-4 pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Todos</h1>
        <div className="flex items-center gap-2">
          <button
            data-testid="enable-notifications-btn"
            onClick={isEnabled ? toggleMute : requestPermission}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              isEnabled
                ? isMuted
                  ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            }`}
          >
            {isEnabled ? (isMuted ? '🔕 Muted' : '🔔 Notifications On') : 'Enable Notifications'}
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          data-testid="error-message"
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center"
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Add Todo Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex gap-2 mb-2">
          <input
            data-testid="new-todo-input"
            type="text"
            value={newTitle}
            onChange={e => { setNewTitle(e.target.value); setTitleError(null); }}
            onKeyDown={e => e.key === 'Enter' && createTodo()}
            placeholder="What needs to be done?"
            className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${titleError ? 'border-red-400' : 'border-gray-300'}`}
          />
          <button
            data-testid="add-todo-button"
            onClick={createTodo}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </div>
        {titleError && (
          <p data-testid="error-message" className="text-red-500 text-xs mb-2">{titleError}</p>
        )}
        <div className="flex gap-2 mb-2">
          <select
            data-testid="new-priority-select"
            value={newPriority}
            onChange={e => setNewPriority(e.target.value as Priority)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
          <input
            data-testid="new-due-date-input"
            type="datetime-local"
            value={newDueDate}
            onChange={e => {
              setNewDueDate(e.target.value);
              if (!e.target.value) setNewReminderMinutes(null);
            }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-600"
          />
        </div>
        <div className="flex gap-2">
          <select
            data-testid="new-reminder-select"
            value={newReminderMinutes ?? ''}
            onChange={e => setNewReminderMinutes(e.target.value ? Number(e.target.value) : null)}
            disabled={!newDueDate}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">No reminder</option>
            <option value="1">1 minute before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="120">2 hours before</option>
            <option value="1440">1 day before</option>
            <option value="2880">2 days before</option>
            <option value="10080">1 week before</option>
          </select>
          <textarea
            data-testid="new-notes-input"
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={1}
            maxLength={2000}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              data-testid="repeat-checkbox"
              type="checkbox"
              checked={newIsRecurring}
              onChange={e => setNewIsRecurring(e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-blue-600"
            />
            Repeat
          </label>
          {newIsRecurring && (
            <select
              data-testid="recurrence-select"
              value={newRecurrence}
              onChange={e => setNewRecurrence(e.target.value as RecurrencePattern)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          )}
        </div>
        {tags.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const selected = newTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setNewTagIds((prev) =>
                        selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                      )
                    }
                    className={`text-xs px-2 py-0.5 rounded-full border ${selected ? 'border-blue-500 ring-1 ring-blue-300' : 'border-transparent'}`}
                    style={{ backgroundColor: tag.color, color: '#fff' }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {tags.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const selected = newTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setNewTagIds((prev) =>
                        selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                      )
                    }
                    className={`text-xs px-2 py-0.5 rounded-full border ${selected ? 'border-blue-500 ring-1 ring-blue-300' : 'border-transparent'}`}
                    style={{ backgroundColor: tag.color, color: '#fff' }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tag Management */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Tag Management</h2>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag name"
            maxLength={50}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className="h-9 w-12 border border-gray-300 rounded"
            aria-label="Tag color"
          />
          <button
            onClick={createTag}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
          >
            Add Tag
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-col gap-2">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-2">
                {editingTagId === tag.id ? (
                  <>
                    <input
                      type="text"
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      maxLength={50}
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="color"
                      value={editingTagColor}
                      onChange={(e) => setEditingTagColor(e.target.value)}
                      className="h-8 w-10 border border-gray-300 rounded"
                    />
                    <button onClick={() => saveTag(tag.id)} className="text-xs text-blue-600 hover:text-blue-700">Save</button>
                    <button onClick={() => setEditingTagId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                  </>
                ) : (
                  <>
                    <TagPill tag={tag} />
                    <button onClick={() => beginEditTag(tag)} className="text-xs text-blue-600 hover:text-blue-700">Edit</button>
                    <button onClick={() => deleteTag(tag.id)} className="text-xs text-red-600 hover:text-red-700">Delete</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-gray-500">Filter by Priority:</span>
        <select
          data-testid="priority-filter"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as 'all' | Priority)}
          className={`border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${priorityFilter !== 'all' ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-gray-300'}`}
        >
          <option value="all">All Priorities</option>
          <option value="high">High Only</option>
          <option value="medium">Medium Only</option>
          <option value="low">Low Only</option>
        </select>
        {priorityFilter !== 'all' && (
          <button onClick={() => setPriorityFilter('all')} className="text-xs text-gray-400 hover:text-gray-600">
            Clear ✕
          </button>
        )}
        <span className="text-sm text-gray-500 ml-2">Tag:</span>
        <select
          value={tagFilter === 'all' ? 'all' : String(tagFilter)}
          onChange={(e) => setTagFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className={`border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${tagFilter !== 'all' ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-gray-300'}`}
        >
          <option value="all">All Tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>
        {tagFilter !== 'all' && (
          <button
            onClick={() => setTagFilter('all')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear Tag ✕
          </button>
        )}
      </div>

      {/* Active Todos */}
      <section data-testid="active-section">
        {loading ? (
          <p className="text-gray-400 text-center py-8">Loading...</p>
        ) : activeTodos.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No todos match the current filters.</p>
        ) : (
          activeTodos.map(todo => (
            <TodoCard
              key={todo.id}
              todo={todo}
              availableTags={tags}
              isEditing={editingId === todo.id}
              onToggleComplete={() => toggleComplete(todo)}
              onEdit={() => setEditingId(todo.id)}
              onSave={data => { updateTodo(todo.id, data); setEditingId(null); }}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => deleteTodo(todo.id)}
            />
          ))
        )}
      </section>

      {/* Completed Todos */}
      {completedTodos.length > 0 && (
        <section data-testid="completed-section" className="mt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Completed ({completedTodos.length})
          </h2>
          {completedTodos.map(todo => (
            <TodoCard
              key={todo.id}
              todo={todo}
              availableTags={tags}
              isEditing={editingId === todo.id}
              onToggleComplete={() => toggleComplete(todo)}
              onEdit={() => setEditingId(todo.id)}
              onSave={data => { updateTodo(todo.id, data); setEditingId(null); }}
              onCancelEdit={() => setEditingId(null)}
              onDelete={() => deleteTodo(todo.id)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
