import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getSingaporeNow } from './timezone';

const dataDir = process.env.DATA_DIR || process.cwd();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'todos.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL UNIQUE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id               INTEGER NOT NULL,
    credential_id         TEXT NOT NULL UNIQUE,
    credential_public_key TEXT NOT NULL,
    counter               INTEGER NOT NULL DEFAULT 0,
    credential_device_type TEXT,
    credential_backed_up  INTEGER DEFAULT 0,
    transports            TEXT,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS todos (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title                  TEXT    NOT NULL,
    completed              INTEGER NOT NULL DEFAULT 0,
    priority               TEXT    NOT NULL DEFAULT 'medium',
    due_date               TEXT,
    notes                  TEXT,
    recurrence             TEXT,
    reminder_minutes       INTEGER,
    created_at             TEXT    NOT NULL,
    updated_at             TEXT    NOT NULL,
    completed_at           TEXT,
    last_notification_sent TEXT
  );
`);

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Todo {
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

export interface CreateTodoInput {
  title: string;
  due_date?: string | null;
  notes?: string | null;
  priority?: Priority;
  reminder_minutes?: number | null;
  recurrence?: RecurrencePattern | null;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
  due_date?: string | null;
  notes?: string | null;
  priority?: Priority;
  reminder_minutes?: number | null;
  recurrence?: RecurrencePattern | null;
}

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

export const todoDB = {
  getAll: (userId: number): Todo[] => {
    return db.prepare(`
      SELECT * FROM todos
      WHERE user_id = ?
      ORDER BY
        completed ASC,
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
        due_date ASC,
        created_at DESC
    `).all(userId) as Todo[];
  },

  getById: (id: number, userId: number): Todo | null => {
    return db.prepare(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Todo | null;
  },

  create: (userId: number, input: CreateTodoInput): Todo => {
    const now = getSingaporeNow().toISOString();
    const result = db.prepare(`
      INSERT INTO todos (user_id, title, priority, due_date, notes, recurrence, reminder_minutes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.title.trim(),
      input.priority ?? 'medium',
      input.due_date ?? null,
      input.notes ?? null,
      input.recurrence ?? null,
      input.reminder_minutes ?? null,
      now,
      now
    );
    return todoDB.getById(result.lastInsertRowid as number, userId)!;
  },

  update: (id: number, userId: number, input: UpdateTodoInput): Todo | null => {
    const todo = todoDB.getById(id, userId);
    if (!todo) return null;

    const now = getSingaporeNow().toISOString();
    const completedAt = input.completed === true
      ? (todo.completed_at ?? now)
      : input.completed === false
        ? null
        : todo.completed_at;

    const nextRecurrence = 'recurrence' in input ? (input.recurrence ?? null) : todo.recurrence;
    const becameCompleted = input.completed === true && !todo.completed;

    db.prepare(`
      UPDATE todos SET
        title        = ?,
        completed    = ?,
        priority     = ?,
        due_date     = ?,
        notes        = ?,
        recurrence   = ?,
        reminder_minutes = ?,
        completed_at = ?,
        updated_at   = ?
      WHERE id = ? AND user_id = ?
    `).run(
      input.title       ?? todo.title,
      input.completed   !== undefined ? (input.completed ? 1 : 0) : (todo.completed ? 1 : 0),
      input.priority    ?? todo.priority,
      'due_date' in input ? (input.due_date ?? null) : todo.due_date,
      'notes'    in input ? (input.notes    ?? null) : todo.notes,
      nextRecurrence,
      'reminder_minutes' in input ? (input.reminder_minutes ?? null) : todo.reminder_minutes,
      completedAt,
      now,
      id,
      userId
    );

    if (becameCompleted && todo.recurrence && todo.due_date) {
      const nextDueDate = addRecurrenceDueDate(todo.due_date, todo.recurrence);
      db.prepare(`
        INSERT INTO todos (user_id, title, priority, due_date, notes, recurrence, reminder_minutes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        todo.title,
        todo.priority,
        nextDueDate,
        todo.notes,
        todo.recurrence,
        todo.reminder_minutes,
        now,
        now
      );
    }

    return todoDB.getById(id, userId);
  },

  delete: (id: number, userId: number): boolean => {
    const result = db.prepare(
      'DELETE FROM todos WHERE id = ? AND user_id = ?'
    ).run(id, userId);
    return result.changes > 0;
  },
};

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: string;
  counter: number;
  credential_device_type?: string;
  credential_backed_up: boolean;
  transports?: string;
  created_at: string;
}

export const userDB = {
  findByUsername: (username: string): User | undefined => {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  },

  findById: (id: number): User | undefined => {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },

  create: (username: string): User => {
    const result = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    return userDB.findById(result.lastInsertRowid as number)!;
  },
};

export const authenticatorDB = {
  findByCredentialId: (credentialId: string): Authenticator | undefined => {
    return db.prepare('SELECT * FROM authenticators WHERE credential_id = ?').get(credentialId) as Authenticator | undefined;
  },

  findByUserId: (userId: number): Authenticator[] => {
    return db.prepare('SELECT * FROM authenticators WHERE user_id = ?').all(userId) as Authenticator[];
  },

  create: (
    userId: number,
    credentialId: string,
    credentialPublicKey: string,
    counter: number,
    credentialDeviceType?: string,
    credentialBackedUp?: boolean,
    transports?: string[]
  ): Authenticator => {
    const result = db.prepare(
      'INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter, credential_device_type, credential_backed_up, transports) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      userId,
      credentialId,
      credentialPublicKey,
      counter,
      credentialDeviceType || null,
      credentialBackedUp ? 1 : 0,
      transports ? JSON.stringify(transports) : null
    );
    return authenticatorDB.findByCredentialId(credentialId)!;
  },

  updateCounter: (credentialId: string, newCounter: number): void => {
    db.prepare('UPDATE authenticators SET counter = ? WHERE credential_id = ?').run(newCounter, credentialId);
  },
};

export default db;
