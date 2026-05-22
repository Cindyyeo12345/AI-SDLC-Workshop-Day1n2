import Database from 'better-sqlite3';
import path from 'path';
import { getSingaporeNow } from './timezone';

const dataDir = process.env.DATA_DIR || process.cwd();
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

  CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL COLLATE NOCASE,
    color      TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (todo_id, tag_id)
  );

  CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_todo_id ON todo_tags(todo_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
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
  tags?: Tag[];
}

export interface CreateTodoInput {
  title: string;
  due_date?: string | null;
  notes?: string | null;
  priority?: Priority;
  reminder_minutes?: number | null;
  tagIds?: number[];
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
  due_date?: string | null;
  notes?: string | null;
  priority?: Priority;
  reminder_minutes?: number | null;
  tagIds?: number[];
}

export const todoDB = {
  getAll: (userId: number, tagId?: number): Todo[] => {
    const todos = (tagId
      ? db.prepare(`
          SELECT DISTINCT td.*
          FROM todos td
          INNER JOIN todo_tags tt ON tt.todo_id = td.id
          WHERE td.user_id = ? AND tt.tag_id = ?
          ORDER BY
            td.completed ASC,
            CASE td.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
            CASE WHEN td.due_date IS NULL THEN 1 ELSE 0 END ASC,
            td.due_date ASC,
            td.created_at DESC
        `).all(userId, tagId)
      : db.prepare(`
          SELECT * FROM todos
          WHERE user_id = ?
          ORDER BY
            completed ASC,
            CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
            CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
            due_date ASC,
            created_at DESC
        `).all(userId)) as Todo[];

    return attachTagsToTodos(todos, userId);
  },

  getById: (id: number, userId: number): Todo | null => {
    const todo = db.prepare(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?'
    ).get(id, userId) as Todo | null;
    if (!todo) {
      return null;
    }
    return attachTagsToTodos([todo], userId)[0];
  },

  create: (userId: number, input: CreateTodoInput): Todo => {
    const now = getSingaporeNow().toISOString();
    const result = db.prepare(`
      INSERT INTO todos (user_id, title, priority, due_date, notes, reminder_minutes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.title.trim(),
      input.priority ?? 'medium',
      input.due_date ?? null,
      input.notes ?? null,
      input.reminder_minutes ?? null,
      now,
      now
    );
    const todoId = result.lastInsertRowid as number;

    if (input.tagIds) {
      replaceTodoTags(todoId, userId, input.tagIds);
    }

    return todoDB.getById(todoId, userId)!;
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

    db.prepare(`
      UPDATE todos SET
        title            = ?,
        completed        = ?,
        priority         = ?,
        due_date         = ?,
        notes            = ?,
        reminder_minutes = ?,
        completed_at     = ?,
        updated_at       = ?
      WHERE id = ? AND user_id = ?
    `).run(
      input.title       ?? todo.title,
      input.completed   !== undefined ? (input.completed ? 1 : 0) : (todo.completed ? 1 : 0),
      input.priority    ?? todo.priority,
      'due_date'         in input ? (input.due_date         ?? null) : todo.due_date,
      'notes'            in input ? (input.notes            ?? null) : todo.notes,
      'reminder_minutes' in input ? (input.reminder_minutes ?? null) : todo.reminder_minutes,
      completedAt,
      now,
      id,
      userId
    );

    if (input.tagIds) {
      replaceTodoTags(id, userId, input.tagIds);
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

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
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

const attachTagsToTodos = (todos: Todo[], userId: number): Todo[] => {
  if (todos.length === 0) {
    return todos.map((todo) => ({ ...todo, tags: [] }));
  }

  const ids = todos.map((todo) => todo.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT tt.todo_id, t.id, t.user_id, t.name, t.color, t.created_at
    FROM todo_tags tt
    INNER JOIN tags t ON t.id = tt.tag_id
    WHERE t.user_id = ? AND tt.todo_id IN (${placeholders})
    ORDER BY t.name ASC
  `).all(userId, ...ids) as Array<{ todo_id: number } & Tag>;

  const tagMap = new Map<number, Tag[]>();
  for (const row of rows) {
    const existing = tagMap.get(row.todo_id) ?? [];
    existing.push({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      color: row.color,
      created_at: row.created_at,
    });
    tagMap.set(row.todo_id, existing);
  }

  return todos.map((todo) => ({
    ...todo,
    tags: tagMap.get(todo.id) ?? [],
  }));
};

const getValidatedTagIds = (userId: number, tagIds: number[]): number[] => {
  const normalized = Array.from(new Set(tagIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (normalized.length === 0) {
    return [];
  }

  const placeholders = normalized.map(() => '?').join(',');
  const found = db.prepare(`
    SELECT id FROM tags WHERE user_id = ? AND id IN (${placeholders})
  `).all(userId, ...normalized) as Array<{ id: number }>;

  if (found.length !== normalized.length) {
    throw new Error('Some tags are invalid for this user');
  }

  return normalized;
};

const replaceTodoTags = (todoId: number, userId: number, tagIds: number[]) => {
  const validatedTagIds = getValidatedTagIds(userId, tagIds);

  const exists = db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(todoId, userId) as { id: number } | undefined;
  if (!exists) {
    throw new Error('Todo not found');
  }

  db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId);

  if (validatedTagIds.length === 0) {
    return;
  }

  const insert = db.prepare('INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
  const transaction = db.transaction((ids: number[]) => {
    for (const tagId of ids) {
      insert.run(todoId, tagId);
    }
  });
  transaction(validatedTagIds);
};

export const tagDB = {
  getAll: (userId: number): Tag[] => {
    return db.prepare(`
      SELECT * FROM tags
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(userId) as Tag[];
  },

  getById: (id: number, userId: number): Tag | null => {
    return db.prepare(`
      SELECT * FROM tags
      WHERE id = ? AND user_id = ?
    `).get(id, userId) as Tag | null;
  },

  create: (userId: number, input: CreateTagInput): Tag => {
    const now = getSingaporeNow().toISOString();
    const result = db.prepare(`
      INSERT INTO tags (user_id, name, color, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, input.name.trim(), input.color, now);

    return tagDB.getById(result.lastInsertRowid as number, userId)!;
  },

  update: (id: number, userId: number, input: UpdateTagInput): Tag | null => {
    const existing = tagDB.getById(id, userId);
    if (!existing) {
      return null;
    }

    db.prepare(`
      UPDATE tags
      SET name = ?, color = ?
      WHERE id = ? AND user_id = ?
    `).run(input.name ?? existing.name, input.color ?? existing.color, id, userId);

    return tagDB.getById(id, userId);
  },

  delete: (id: number, userId: number): boolean => {
    const result = db.prepare(`
      DELETE FROM tags
      WHERE id = ? AND user_id = ?
    `).run(id, userId);

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
