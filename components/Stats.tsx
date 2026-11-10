"use client";

import { useEffect, useState } from "react";

type Row = { day: string; minutes: number };

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

// Computed on the client so "today" follows the user's own timezone
export default function Stats({ rows, done, total }: { rows: Row[]; done: number; total: number }) {
  const [days, setDays] = useState<{ day: string; label: string; minutes: number }[] | null>(null);

  useEffect(() => {
    const map = new Map(rows.map((r) => [r.day, r.minutes]));
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = key(d);
      out.push({ day: k, label: d.toLocaleDateString(undefined, { weekday: "short" }), minutes: map.get(k) ?? 0 });
    }
    setDays(out);
  }, [rows]);

  const max = Math.max(30, ...(days?.map((d) => d.minutes) ?? [0]));
  const today = days?.[days.length - 1]?.minutes ?? 0;
  const week = days?.reduce((a, d) => a + d.minutes, 0) ?? 0;

  return (
    <section className="card" aria-label="Your stats">
      <div className="stats">
        <div>
          <div className="stat">{days ? fmtMin(today) : "–"}</div>
          <div className="muted small">Focus today</div>
        </div>
        <div>
          <div className="stat">{days ? fmtMin(week) : "–"}</div>
          <div className="muted small">Last 7 days</div>
        </div>
        <div>
          <div className="stat">
            {done}/{total}
          </div>
          <div className="muted small">Tasks done</div>
        </div>
      </div>

      <div className="chart" aria-hidden>
        {(days ?? []).map((d) => (
          <div key={d.day} className="col" title={`${d.day}: ${d.minutes} min`}>
            <div className="fill" style={{ height: `${(d.minutes / max) * 100}%` }} />
            <span>{d.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
