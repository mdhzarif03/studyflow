import Link from "next/link";
import { addTask, deleteTask, logout, toggleTask } from "@/app/actions";
import DueBadge from "@/components/DueBadge";
import Pomodoro from "@/components/Pomodoro";
import Stats from "@/components/Stats";
import { requireUser } from "@/lib/auth";
import { query, type Task } from "@/lib/db";

export const dynamic = "force-dynamic";

const PRIORITY = ["", "Low", "Medium", "High"];
const FILTERS = [
  { id: "active", label: "To do" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ show?: string; subject?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const show = FILTERS.some((f) => f.id === sp.show) ? sp.show! : "active";
  const subject = sp.subject?.slice(0, 40) ?? "";

  const where = ["user_id = $1"];
  const args: (string | number)[] = [user.id];
  if (show === "active") where.push("done = 0");
  if (show === "done") where.push("done = 1");
  if (subject) {
    args.push(subject);
    where.push(`subject = $${args.length}`);
  }

  // Independent queries run in parallel (one HTTP round trip each)
  const [tasks, countRows, subjectRows, activeTasks, focusRows] = await Promise.all([
    query<Task>(
      `SELECT id, user_id, title, subject, due_date, priority, done FROM tasks
       WHERE ${where.join(" AND ")}
       ORDER BY done, due_date IS NULL, due_date, priority DESC, id DESC`,
      args,
    ),
    query<{ total: number; done: number }>(
      "SELECT COUNT(*)::int AS total, COALESCE(SUM(done), 0)::int AS done FROM tasks WHERE user_id = $1",
      [user.id],
    ),
    query<{ subject: string }>(
      "SELECT DISTINCT subject FROM tasks WHERE user_id = $1 AND subject <> '' ORDER BY subject",
      [user.id],
    ),
    query<{ id: number; title: string }>(
      "SELECT id, title FROM tasks WHERE user_id = $1 AND done = 0 ORDER BY id DESC",
      [user.id],
    ),
    query<{ day: string; minutes: number }>(
      `SELECT day, SUM(minutes)::int AS minutes FROM focus_sessions
       WHERE user_id = $1 AND day >= to_char(current_date - 9, 'YYYY-MM-DD')
       GROUP BY day`,
      [user.id],
    ),
  ]);
  const counts = countRows[0];
  const subjects = subjectRows.map((r) => r.subject);

  const href = (next: { show?: string; subject?: string }) => {
    const p = new URLSearchParams();
    const s = next.show ?? show;
    const sub = next.subject ?? subject;
    if (s !== "active") p.set("show", s);
    if (sub) p.set("subject", sub);
    const q = p.toString();
    return q ? `/dashboard?${q}` : "/dashboard";
  };

  return (
    <>
      <header className="top">
        <strong>StudyFlow</strong>
        <div className="row">
          <span className="muted small">{user.name}</span>
          <form action={logout}>
            <button className="btn small-btn">Log out</button>
          </form>
        </div>
      </header>

      <main className="grid">
        <div className="stack">
          <Pomodoro tasks={activeTasks} />
          <Stats rows={focusRows} done={counts.done} total={counts.total} />
        </div>

        <div className="stack">
          <form action={addTask} className="card add">
            <input name="title" placeholder="Add a task, e.g. Revise chapter 4" required maxLength={200} aria-label="Task title" />
            <div className="row wrap">
              <input name="subject" list="subjects" placeholder="Subject" maxLength={40} aria-label="Subject" />
              <datalist id="subjects">
                {subjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <input name="due_date" type="date" aria-label="Due date" />
              <select name="priority" defaultValue="2" aria-label="Priority">
                <option value="1">Low</option>
                <option value="2">Medium</option>
                <option value="3">High</option>
              </select>
              <button className="btn primary">Add</button>
            </div>
          </form>

          <section className="card">
            <div className="row wrap between">
              <div className="tabs">
                {FILTERS.map((f) => (
                  <Link key={f.id} href={href({ show: f.id })} className={show === f.id ? "tab active" : "tab"}>
                    {f.label}
                  </Link>
                ))}
              </div>
              {subjects.length > 0 && (
                <div className="chips">
                  <Link href={href({ subject: "" })} className={!subject ? "chip active" : "chip"}>
                    All subjects
                  </Link>
                  {subjects.map((s) => (
                    <Link key={s} href={href({ subject: s })} className={subject === s ? "chip active" : "chip"}>
                      {s}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {tasks.length === 0 ? (
              <p className="muted empty">{show === "done" ? "Nothing completed yet." : "No tasks here. Add one above."}</p>
            ) : (
              <ul className="tasks">
                {tasks.map((t) => (
                  <li key={t.id} className={t.done ? "task done" : "task"}>
                    <form action={toggleTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="check" aria-label={t.done ? "Mark as not done" : "Mark as done"}>
                        {t.done ? "✓" : ""}
                      </button>
                    </form>
                    <div className="grow">
                      <div className="title">{t.title}</div>
                      <div className="meta">
                        {t.subject && <span className="badge subject">{t.subject}</span>}
                        {t.due_date && <DueBadge date={t.due_date} done={!!t.done} />}
                        <span className={`badge p${t.priority}`}>{PRIORITY[t.priority]}</span>
                      </div>
                    </div>
                    <form action={deleteTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="icon" aria-label={`Delete ${t.title}`}>
                        ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
