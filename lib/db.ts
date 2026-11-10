import { neon } from "@neondatabase/serverless";

export type User = { id: number; email: string; name: string };

export type Task = {
  id: number;
  user_id: number;
  title: string;
  subject: string;
  due_date: string | null; // YYYY-MM-DD
  priority: number; // 1 low, 2 medium, 3 high
  done: number; // 0 | 1
};

// Created automatically on first use (all statements are idempotent)
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    priority INTEGER NOT NULL DEFAULT 2,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, done)`,
  `CREATE TABLE IF NOT EXISTS focus_sessions (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    minutes INTEGER NOT NULL,
    day TEXT NOT NULL, -- user's local date, YYYY-MM-DD
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_focus_user_day ON focus_sessions(user_id, day)`,
];

type Sql = ReturnType<typeof neon>;
const g = globalThis as unknown as { __sf?: { sql?: Sql; ready?: Promise<void> } };
const state = (g.__sf ??= {});

function client(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add your Neon connection string to .env.local (see .env.example).");
  }
  return (state.sql ??= neon(url));
}

function ensureSchema(sql: Sql): Promise<void> {
  state.ready ??= (async () => {
    for (const stmt of SCHEMA) await sql.query(stmt);
  })().catch((err) => {
    state.ready = undefined; // allow a retry on the next request
    throw err;
  });
  return state.ready;
}

/** Run a parameterised query ($1, $2, …) and return the rows. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const sql = client();
  await ensureSchema(sql);
  return (await sql.query(text, params)) as T[];
}
