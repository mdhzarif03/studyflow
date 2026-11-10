"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export type FormState = { error?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Naive in-memory throttle for failed logins (per email, per server instance).
const failures = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 6;
// Used so a missing account takes about as long to reject as a wrong password
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

function str(fd: FormData, key: string, max: number) {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name", 60);
  const email = str(fd, "email", 120).toLowerCase();
  const password = String(fd.get("password") ?? "");

  if (!name) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password.length > 200) return { error: "Password is too long." };

  const taken = await query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (taken.length) return { error: "An account with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 10);
  let id: number;
  try {
    const rows = await query<{ id: number }>(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [email, name, passwordHash],
    );
    id = rows[0].id;
  } catch (err) {
    // Two sign-ups racing on the same email
    if ((err as { code?: string }).code === "23505") return { error: "An account with that email already exists." };
    throw err;
  }
  await createSession(id);
  redirect("/dashboard");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email", 120).toLowerCase();
  const password = String(fd.get("password") ?? "");

  const f = failures.get(email);
  if (f && Date.now() - f.first < WINDOW_MS && f.n >= MAX_FAILS) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const rows = await query<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = rows[0];

  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    const fresh = !f || Date.now() - f.first >= WINDOW_MS;
    failures.set(email, { n: fresh ? 1 : f.n + 1, first: fresh ? Date.now() : f.first });
    return { error: "Incorrect email or password." };
  }

  failures.delete(email);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function addTask(fd: FormData) {
  const user = await requireUser();
  const title = str(fd, "title", 200);
  if (!title) return;
  const subject = str(fd, "subject", 40);
  const due = str(fd, "due_date", 10);
  const priority = Math.min(3, Math.max(1, Number(fd.get("priority")) || 2));
  await query("INSERT INTO tasks (user_id, title, subject, due_date, priority) VALUES ($1, $2, $3, $4, $5)", [
    user.id,
    title,
    subject,
    DATE_RE.test(due) ? due : null,
    priority,
  ]);
  revalidatePath("/dashboard");
}

export async function toggleTask(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return;
  await query("UPDATE tasks SET done = 1 - done WHERE id = $1 AND user_id = $2", [id, user.id]);
  revalidatePath("/dashboard");
}

export async function deleteTask(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return;
  await query("DELETE FROM tasks WHERE id = $1 AND user_id = $2", [id, user.id]);
  revalidatePath("/dashboard");
}

export async function logFocus(taskId: number | null, minutes: number, day: string) {
  const user = await requireUser();
  const mins = Math.round(minutes);
  if (!Number.isFinite(mins) || mins < 1 || mins > 240 || !DATE_RE.test(day)) return;

  // Only link the session to a task that belongs to this user
  await query(
    `INSERT INTO focus_sessions (user_id, task_id, minutes, day)
     VALUES ($1, (SELECT id FROM tasks WHERE id = $2 AND user_id = $1), $3, $4)`,
    [user.id, taskId, mins, day],
  );
  revalidatePath("/dashboard");
}
