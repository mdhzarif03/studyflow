"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { logFocus } from "@/app/actions";

type Mode = "focus" | "short" | "long";
type Durations = Record<Mode, number>;

const DEFAULTS: Durations = { focus: 25, short: 5, long: 15 };
const LABELS: Record<Mode, string> = { focus: "Focus", short: "Short break", long: "Long break" };
const KEY = "sf_durations";

const localDay = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* audio not available */
  }
}

export default function Pomodoro({ tasks }: { tasks: { id: number; title: string }[] }) {
  const [durations, setDurations] = useState<Durations>(DEFAULTS);
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState(DEFAULTS.focus * 60);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0); // completed focus sessions this visit
  const [taskId, setTaskId] = useState<string>("");
  const [, startTransition] = useTransition();
  const endAt = useRef(0);

  // Load saved durations once
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (saved && saved.focus > 0 && saved.short > 0 && saved.long > 0) {
        setDurations(saved);
        setRemaining(saved.focus * 60);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const switchMode = useCallback(
    (m: Mode, d: Durations = durations) => {
      setMode(m);
      setRunning(false);
      setRemaining(d[m] * 60);
    },
    [durations],
  );

  const finish = useCallback(() => {
    beep();
    if (mode === "focus") {
      const tid = taskId ? Number(taskId) : null;
      startTransition(() => {
        void logFocus(tid, durations.focus, localDay());
      });
      const next = cycles + 1;
      setCycles(next);
      switchMode(next % 4 === 0 ? "long" : "short");
    } else {
      switchMode("focus");
    }
  }, [mode, taskId, durations, cycles, switchMode]);

  // Timestamp-based ticking so background tabs don't drift
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) finish();
    }, 250);
    return () => clearInterval(id);
  }, [running, finish]);

  useEffect(() => {
    document.title = running ? `${fmt(remaining)} · ${LABELS[mode]}` : "StudyFlow";
  }, [running, remaining, mode]);

  function toggle() {
    if (!running) endAt.current = Date.now() + remaining * 1000;
    setRunning(!running);
  }

  function setMinutes(m: Mode, value: number) {
    const v = Math.min(120, Math.max(1, Math.round(value) || 1));
    const next = { ...durations, [m]: v };
    setDurations(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    if (m === mode && !running) setRemaining(v * 60);
  }

  const total = durations[mode] * 60;
  const pct = Math.round(((total - remaining) / total) * 100);

  return (
    <section className="card timer" aria-label="Pomodoro timer">
      <div className="tabs" role="tablist">
        {(Object.keys(LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? "tab active" : "tab"}
            onClick={() => switchMode(m)}
          >
            {LABELS[m]}
          </button>
        ))}
      </div>

      <div className="clock" aria-live="off">
        {fmt(remaining)}
      </div>
      <div className="bar" aria-hidden>
        <div style={{ width: `${pct}%` }} />
      </div>

      {mode === "focus" && (
        <label className="small">
          Working on
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">— no task —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="row">
        <button className="btn primary grow" onClick={toggle}>
          {running ? "Pause" : remaining < total ? "Resume" : "Start"}
        </button>
        <button className="btn" onClick={() => switchMode(mode)} disabled={remaining === total && !running}>
          Reset
        </button>
      </div>

      <details className="small">
        <summary>Durations (minutes)</summary>
        <div className="durations">
          {(Object.keys(LABELS) as Mode[]).map((m) => (
            <label key={m}>
              {LABELS[m]}
              <input
                type="number"
                min={1}
                max={120}
                value={durations[m]}
                disabled={running}
                onChange={(e) => setMinutes(m, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </details>
      <p className="muted small">Completed focus sessions are saved to your account.</p>
    </section>
  );
}
