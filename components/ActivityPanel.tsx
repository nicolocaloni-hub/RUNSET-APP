import React from "react";
import { eventText } from "../lib/events";
import { usePrefs } from "../lib/preferences";
import type { RunEvent } from "../services/protocol";

const ACCENT: Record<RunEvent["type"], string> = {
  PICKUP: "border-emerald-400",
  UNDO: "border-zinc-500",
  ALERT: "border-red-400",
  SET: "border-yellow-400",
  DAY: "border-blue-400",
};

export default function ActivityPanel({ events }: { events: RunEvent[] }) {
  const { t, formatDateTime } = usePrefs();
  if (events.length === 0) return <p className="text-sm text-zinc-400">{t("activity_empty")}</p>;
  return (
    <>
      {[...events].reverse().map((event) => (
        <article key={event.id} className={`border-l-2 py-1 pl-4 ${ACCENT[event.type]}`}>
          <p className="mb-2 text-sm">{eventText(event, t)}</p>
          <time dateTime={new Date(event.createdAt).toISOString()} className="text-xs text-zinc-500">
            {formatDateTime(event.createdAt)}
          </time>
        </article>
      ))}
    </>
  );
}
