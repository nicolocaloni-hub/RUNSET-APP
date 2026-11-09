import React from "react";
import { usePrefs } from "../lib/preferences";
import { isLive } from "../services/proximity";
import type { Person } from "../types";

/** Map-tab sheet for the producer: overall progress and one card per runner. */
export default function ProducerSummary({
  people,
  now,
  colors,
  onSelect,
}: {
  people: Person[];
  /** Server-corrected time. */
  now: number;
  colors: Map<string, string>;
  onSelect: (person: Person) => void;
}) {
  const { t } = usePrefs();
  const toPickUp = people.filter((p) => p.category !== "RUNNER" && p.assignedRunnerId);
  const done = toPickUp.filter((p) => p.isRecovered).length;
  const runners = people.filter((p) => p.category === "RUNNER");
  const share = toPickUp.length ? done / toPickUp.length : 0;
  const ring = 2 * Math.PI * 22;

  return (
    <section
      aria-label={t("summary_title")}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-[26px] bg-white px-4 pb-4 pt-2.5 shadow-sheet md:bottom-3 md:left-3 md:right-auto md:w-[400px] md:rounded-[26px]"
    >
      <span aria-hidden="true" className="mx-auto h-[5px] w-10 rounded-full bg-line2" />
      <div className="flex items-center gap-3.5">
        <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className="shrink-0 -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="#F2F4F7" strokeWidth="7" />
          <circle
            cx="28"
            cy="28"
            r="22"
            fill="none"
            stroke="#FF5B1F"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${ring * share} ${ring}`}
            className="transition-[stroke-dasharray] duration-700"
          />
        </svg>
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-wider text-muted">{t("summary_title").toUpperCase()}</p>
          <p className="font-display text-xl font-bold">
            {toPickUp.length ? t("progress", { done, total: toPickUp.length }) : t("summary_none")}
          </p>
        </div>
      </div>
      {runners.length > 0 && (
        <div className="scrollbar-hide -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          {runners.map((runner) => {
            const color = colors.get(runner.id) ?? "#FF5B1F";
            const mine = toPickUp.filter((p) => p.assignedRunnerId === runner.id);
            const mineDone = mine.filter((p) => p.isRecovered).length;
            const live = isLive(runner, now);
            return (
              <button
                key={runner.id}
                type="button"
                onClick={() => onSelect(runner)}
                className="flex w-44 shrink-0 flex-col gap-2 rounded-2xl border-[1.5px] border-line p-3 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white"
                    style={{ background: color }}
                  >
                    {runner.initials}
                    {live && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-live" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{runner.name}</span>
                    <span className={`block truncate font-mono text-[11px] ${live ? "text-live" : "text-muted"}`}>
                      {live ? t("live").toUpperCase() : t("runner_off")}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="h-[5px] flex-1 overflow-hidden rounded-full bg-ground">
                    <span
                      className="block h-full rounded-full transition-all"
                      style={{ width: `${mine.length ? (mineDone / mine.length) * 100 : 0}%`, background: color }}
                    />
                  </span>
                  <span className="font-mono text-[11px] text-muted">
                    {t("runner_card", { done: mineDone, total: mine.length })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
