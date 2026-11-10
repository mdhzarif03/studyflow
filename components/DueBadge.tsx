"use client";

import { useEffect, useState } from "react";

// Relative due-date label computed in the browser's timezone
export default function DueBadge({ date, done }: { date: string; done: boolean }) {
  const [info, setInfo] = useState<{ text: string; late: boolean } | null>(null);

  useEffect(() => {
    const [y, m, d] = date.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    let text: string;
    if (diff === 0) text = "Today";
    else if (diff === 1) text = "Tomorrow";
    else if (diff === -1) text = "Yesterday";
    else if (diff < 0) text = `${-diff}d overdue`;
    else if (diff < 7) text = due.toLocaleDateString(undefined, { weekday: "long" });
    else text = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    setInfo({ text, late: diff < 0 && !done });
  }, [date, done]);

  if (!info) return <span className="badge">{date}</span>;
  return <span className={info.late ? "badge late" : "badge"}>{info.text}</span>;
}
