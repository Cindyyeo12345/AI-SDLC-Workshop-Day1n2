'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { SINGAPORE_TIMEZONE } from '@/lib/timezone';

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
  date: Date | null;
  dateKey: string | null;
  todos: Todo[];
  holiday: string | null;
  isToday: boolean;
}

// Singapore public holidays 2024–2026
const SG_HOLIDAYS: Record<string, string> = {
  '2024-01-01': "New Year's Day",
  '2024-02-10': 'Chinese New Year',
  '2024-02-11': 'Chinese New Year',
  '2024-03-29': 'Good Friday',
  '2024-04-10': 'Hari Raya Puasa',
  '2024-05-01': 'Labour Day',
  '2024-05-23': 'Vesak Day',
  '2024-06-17': 'Hari Raya Haji',
  '2024-08-09': 'National Day',
  '2024-10-31': 'Deepavali',
  '2024-12-25': 'Christmas Day',
  '2025-01-01': "New Year's Day",
  '2025-01-29': 'Chinese New Year',
  '2025-01-30': 'Chinese New Year',
  '2025-03-31': 'Hari Raya Puasa',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Labour Day',
  '2025-05-12': 'Vesak Day',
  '2025-06-07': 'Hari Raya Haji',
  '2025-08-09': 'National Day',
  '2025-10-20': 'Deepavali',
  '2025-12-25': 'Christmas Day',
  '2026-01-01': "New Year's Day",
  '2026-02-17': 'Chinese New Year',
  '2026-02-18': 'Chinese New Year',
  '2026-03-20': 'Hari Raya Puasa',
  '2026-04-03': 'Good Friday',
  '2026-05-01': 'Labour Day',
  '2026-05-27': 'Hari Raya Haji',
  '2026-05-31': 'Vesak Day',
  '2026-08-10': 'National Day (in lieu)',
  '2026-11-08': 'Deepavali',
  '2026-12-25': 'Christmas Day',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_PILL: Record<Priority, string> = {
  high:   'bg-red-100 text-red-800 border border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  low:    'bg-blue-100 text-blue-800 border border-blue-200',
};

const PRIORITY_DOT: Record<Priority, string> = {
  high:   'bg-red-500',
  medium: 'bg-yellow-500',
  low:    'bg-blue-500',
};

const PRIORITY_BADGE: Record<Priority, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-blue-100 text-blue-700',
};

/** Returns a YYYY-MM-DD key in Singapore time */
function toSGDateKey(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-CA', { timeZone: SINGAPORE_TIMEZONE });
}

/** Returns a YYYY-MM-DD key from a local Date object */
function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildCalendarGrid(year: number, month: number, todos: Todo[]): CalendarCell[] {
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: SINGAPORE_TIMEZONE });

  // Group todos by their SG due date
  const byDate: Record<string, Todo[]> = {};
  for (const todo of todos) {
    if (todo.due_date) {
      const key = toSGDateKey(todo.due_date);
      byDate[key] = [...(byDate[key] ?? []), todo];
    }
  }

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = firstDay.getDay(); // 0 = Sunday

  const cells: CalendarCell[] = [];

  // Leading empty padding
  for (let i = 0; i < startDow; i++) {
    cells.push({ date: null, dateKey: null, todos: [], holiday: null, isToday: false });
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = toLocalDateKey(date);
    cells.push({
      date,
      dateKey: key,
      todos: byDate[key] ?? [],
      holiday: SG_HOLIDAYS[key] ?? null,
      isToday: key === todayKey,
    });
  }

  // Trailing padding to complete the last row
  const totalCells = Math.ceil(cells.length / 7) * 7;
  while (cells.length < totalCells) {
    cells.push({ date: null, dateKey: null, todos: [], holiday: null, isToday: false });
  }

  return cells;
}

export default function CalendarPage() {
  const sgNow = new Date(new Date().toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE }));

  const [year, setYear] = useState(sgNow.getFullYear());
  const [month, setMonth] = useState(sgNow.getMonth());
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos');
      if (res.ok) {
        setTodos(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const goToPrev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else { setMonth(m => m - 1); }
    setSelectedKey(null);
  };

  const goToNext = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else { setMonth(m => m + 1); }
    setSelectedKey(null);
  };

  const goToToday = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE }));
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedKey(null);
  };

  const grid = buildCalendarGrid(year, month, todos);

  const selectedCell = selectedKey
    ? grid.find(c => c.dateKey === selectedKey) ?? null
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <h1 className="text-xl font-bold text-gray-900">Calendar View</h1>
          </div>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            data-testid="back-to-list-link"
          >
            ← Back to List
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goToPrev}
            data-testid="prev-month-btn"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 text-lg transition-colors"
            aria-label="Previous month"
          >
            ‹
          </button>

          <div className="flex items-center gap-3">
            <h2
              className="text-2xl font-bold text-gray-900 min-w-[220px] text-center"
              data-testid="calendar-month-title"
            >
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={goToToday}
              data-testid="today-btn"
              className="text-xs px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 font-semibold transition-colors"
            >
              Today
            </button>
          </div>

          <button
            onClick={goToNext}
            data-testid="next-month-btn"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 text-lg transition-colors"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        {loading ? (
          <div className="text-center py-24 text-gray-400 text-sm">Loading todos…</div>
        ) : (
          <>
            {/* Calendar grid */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" data-testid="calendar-grid">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                {DAYS_OF_WEEK.map(day => (
                  <div
                    key={day}
                    className="py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
                {grid.map((cell, idx) => {
                  if (!cell.date || !cell.dateKey) {
                    return (
                      <div
                        key={idx}
                        className="min-h-[110px] bg-gray-50/60"
                        aria-hidden="true"
                      />
                    );
                  }

                  const isSelected = selectedKey === cell.dateKey;
                  const activeTodos = cell.todos.filter(t => !t.completed);
                  const doneTodos  = cell.todos.filter(t => t.completed);
                  const overflowCount = Math.max(0, activeTodos.length - 3);
                  const visibleTodos = activeTodos.slice(0, 3);

                  return (
                    <div
                      key={idx}
                      data-testid={`calendar-day-${cell.dateKey}`}
                      onClick={() => setSelectedKey(isSelected ? null : cell.dateKey)}
                      className={`min-h-[110px] p-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
                          : cell.isToday
                          ? 'bg-orange-50 hover:bg-orange-100/70'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Day number */}
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 ${
                        cell.isToday
                          ? 'bg-orange-500 text-white'
                          : 'text-gray-700'
                      }`}>
                        {cell.date.getDate()}
                      </div>

                      {/* Holiday label */}
                      {cell.holiday && (
                        <div className="text-[10px] text-red-600 font-medium leading-tight truncate mb-1" title={cell.holiday}>
                          🎉 {cell.holiday}
                        </div>
                      )}

                      {/* Todo pills */}
                      <div className="space-y-0.5">
                        {visibleTodos.map(todo => (
                          <div
                            key={todo.id}
                            className={`text-[11px] px-1.5 py-0.5 rounded truncate leading-tight ${PRIORITY_PILL[todo.priority]}`}
                            title={todo.title}
                          >
                            {todo.title}
                          </div>
                        ))}
                        {overflowCount > 0 && (
                          <div className="text-[10px] text-gray-400 pl-1">
                            +{overflowCount} more
                          </div>
                        )}
                        {activeTodos.length === 0 && doneTodos.length > 0 && (
                          <div className="text-[10px] text-gray-400 pl-1">
                            ✓ {doneTodos.length} done
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected day detail panel */}
            {selectedCell && selectedCell.date && (
              <div
                className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                data-testid="day-detail-panel"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {selectedCell.date.toLocaleDateString('en-SG', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </h3>
                    {selectedCell.holiday && (
                      <p className="text-sm text-red-600 mt-0.5">🎉 {selectedCell.holiday}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedKey(null)}
                    className="text-gray-400 hover:text-gray-600 text-xl leading-none mt-0.5"
                    aria-label="Close day detail"
                  >
                    ✕
                  </button>
                </div>

                {selectedCell.todos.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No todos due on this day.</p>
                ) : (
                  <div className="space-y-2">
                    {[...selectedCell.todos]
                      .sort((a, b) => {
                        if (a.completed !== b.completed) return a.completed ? 1 : -1;
                        const order = { high: 0, medium: 1, low: 2 };
                        return order[a.priority] - order[b.priority];
                      })
                      .map(todo => (
                        <div
                          key={todo.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border border-gray-200 ${
                            todo.completed ? 'opacity-50 bg-gray-50' : 'bg-white'
                          }`}
                          data-testid="day-todo-item"
                        >
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[todo.priority]}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium text-gray-900 ${todo.completed ? 'line-through' : ''}`}>
                              {todo.title}
                            </p>
                            {todo.notes && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{todo.notes}</p>
                            )}
                            {(todo.tags ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {(todo.tags ?? []).map(tag => (
                                  <span
                                    key={tag.id}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                                    style={{ backgroundColor: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_BADGE[todo.priority]}`}>
                            {todo.priority}
                          </span>
                          {todo.completed && (
                            <span className="text-xs text-gray-400 flex-shrink-0">Done</span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold">9</div>
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-red-100 border border-red-200" />
                <span>High priority</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-yellow-100 border border-yellow-200" />
                <span>Medium priority</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-3 rounded bg-blue-100 border border-blue-200" />
                <span>Low priority</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>🎉</span>
                <span>Singapore public holiday</span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
