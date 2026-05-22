'use client';

import { useState, useEffect, useRef } from 'react';
import { formatSingaporeDate, isOverdue, isDueToday, isDueThisWeek } from '@/lib/timezone';

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
}

interface EditState {
  title: string;
  due_date: string;
  notes: string;
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

interface TodoCardProps {
  todo: Todo;
  isEditing: boolean;
  onToggleComplete: () => void;
  onEdit: () => void;
  onSave: (data: Partial<Todo>) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

function TodoCard({
  todo,
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
  });
  const [editError, setEditError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditState({
        title: todo.title,
        due_date: todo.due_date ?? '',
        notes: todo.notes ?? '',
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
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancelEdit();
  };

  if (isEditing) {
    return (
      <div data-testid="todo-item" className="bg-white border border-blue-300 rounded-lg p-4 mb-2 shadow-sm">
        {editError && (
          <p className="text-red-500 text-sm mb-2">{editError}</p>
        )}
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
        <input
          type="datetime-local"
          value={editState.due_date}
          onChange={e => setEditState(s => ({ ...s, due_date: e.target.value }))}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <textarea
          value={editState.notes}
          onChange={e => setEditState(s => ({ ...s, notes: e.target.value }))}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          placeholder="Notes (optional)"
          rows={2}
          maxLength={2000}
        />
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
        <p className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {todo.title}
        </p>
        {todo.due_date && (
          <div className="mt-1">
            <DueDateBadge dueDate={todo.due_date} />
          </div>
        )}
        {todo.notes && (
          <p className="mt-1 text-xs text-gray-500 truncate">{todo.notes}</p>
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
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 5000);
  };

  useEffect(() => {
    fetchTodos();
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

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

  const createTodo = async () => {
    if (!newTitle.trim()) {
      setTitleError('Title is required');
      return;
    }
    if (newTitle.trim().length > 500) {
      setTitleError('Title must be 500 characters or fewer');
      return;
    }
    setTitleError(null);

    const tempId = Date.now();
    const optimistic: Todo = {
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
    };

    setTodos(prev => [optimistic, ...prev]);
    const savedTitle = newTitle.trim();
    setNewTitle('');
    setNewDueDate('');
    setNewNotes('');

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: savedTitle, due_date: optimistic.due_date, notes: optimistic.notes }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created: Todo = await res.json();
      setTodos(prev => prev.map(t => t.id === tempId ? created : t));
    } catch {
      setTodos(prev => prev.filter(t => t.id !== tempId));
      showError('Failed to create todo. Please try again.');
    }
  };

  const updateTodo = async (id: number, data: Partial<Todo>) => {
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

  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  return (
    <main className="max-w-2xl mx-auto p-4 pt-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">My Todos</h1>

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
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
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
        <div className="flex gap-2">
          <input
            data-testid="new-due-date-input"
            type="datetime-local"
            value={newDueDate}
            onChange={e => setNewDueDate(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-600"
          />
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
      </div>

      {/* Active Todos */}
      <section data-testid="active-section">
        {loading ? (
          <p className="text-gray-400 text-center py-8">Loading...</p>
        ) : activeTodos.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No todos yet. Add one above!</p>
        ) : (
          activeTodos.map(todo => (
            <TodoCard
              key={todo.id}
              todo={todo}
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
