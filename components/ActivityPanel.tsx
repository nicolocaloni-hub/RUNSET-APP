import React from "react";
import { eventText } from "../lib/events";
import { usePrefs } from "../lib/preferences";
import type { RunEvent } from "../services/protocol";

const ACCENT: Record<RunEvent["type"], string> = {
  PICKUP: "border-emerald-600",
  UNDO: "border-line2",
  ALERT: "border-red-200",
  SET: "border-signal",
  DAY: "border-blue-200",
  ARRIVING: "border-signal",
};

export default function ActivityPanel({ events }: { events: RunEvent[] }) {
  const { t, formatDateTime } = usePrefs();
  if (events.length === 0) return <p className="text-sm text-muted">{t("activity_empty")}</p>;
  return (
    <>
      {[...events].reverse().map((event) => (
        <article key={event.id} className={`border-l-2 py-1 pl-4 ${ACCENT[event.type]}`}>
          <p className="mb-2 text-sm">{eventText(event, t)}</p>
          <time dateTime={new Date(event.createdAt).toISOString()} className="text-xs text-muted">
            {formatDateTime(event.createdAt)}
          </time>
        </article>
      ))}
    </>
  );
}
