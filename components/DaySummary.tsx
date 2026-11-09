import React from "react";
import { Download } from "lucide-react";
import { toCsv } from "../lib/csv";
import { usePrefs } from "../lib/preferences";
import type { Person } from "../types";

/** Minutes between the call time ("07:15") and the actual pickup, on the pickup's own date. */
function delayMinutes(person: Person): number | undefined {
  if (!person.pickupTime || !person.recoveredAt) return undefined;
  const [hours, minutes] = person.pickupTime.split(":").map(Number);
  const called = new Date(person.recoveredAt);
  called.setHours(hours, minutes, 0, 0);
  return Math.round((person.recoveredAt - called.getTime()) / 60_000);
}

/** End-of-day report for the producer: pickups, delays and km per runner, downloadable as CSV. */
export default function DaySummary({
  people,
  dayNumber,
  productionName,
  colors,
}: {
  people: Person[];
  dayNumber: number;
  productionName: string;
  colors: Map<string, string>;
}) {
  const { t, formatTime } = usePrefs();
  const runners = people.filter((p) => p.category === "RUNNER");
  const others = people
    .filter((p) => p.category !== "RUNNER" && (p.assignedRunnerId || p.isRecovered))
    .sort((a, b) => (a.pickupTime ?? "99:99").localeCompare(b.pickupTime ?? "99:99") || a.name.localeCompare(b.name));
  const nameOf = (id?: string) => people.find((p) => p.id === id)?.name ?? "";
  const km = (runner: Person) =>
    runner.metersDay === dayNumber && runner.dayMeters ? (runner.dayMeters / 1000).toFixed(1) : "0.0";
  const pickupsBy = (runner: Person) => others.filter((p) => p.isRecovered && p.recoveredBy === runner.id).length;

  const download = () => {
    const csv = toCsv([
      [t("csv_person"), t("csv_category"), t("csv_called"), t("csv_picked"), t("csv_runner"), t("csv_late")],
      ...others.map((p) => [
        p.name,
        t(`cat_${p.category}`),
        p.pickupTime ?? "",
        p.recoveredAt ? formatTime(p.recoveredAt) : "",
        nameOf(p.recoveredBy ?? p.assignedRunnerId),
        delayMinutes(p) ?? "",
      ]),
      [],
      [t("csv_runner"), t("csv_pickups"), t("csv_km")],
      ...runners.map((r) => [r.name, pickupsBy(r), km(r).replace(".", ",")]),
    ]);
    // BOM so Excel reads accented names correctly.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `RunSet - ${productionName} - ${t("day_label", { day: dayNumber })}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (runners.length === 0 && others.length === 0) {
    return <p className="text-sm text-muted">{t("day_summary_empty")}</p>;
  }

  return (
    <section className="space-y-3 rounded-2xl border-[1.5px] border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold">{t("day_summary_title", { day: dayNumber })}</h3>
        <button
          type="button"
          onClick={download}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-xs font-semibold text-white"
        >
          <Download size={14} />
          {t("day_summary_download")}
        </button>
      </div>
      {runners.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colors.get(r.id) }} />
          <span className="flex-1 truncate font-semibold">{r.name}</span>
          <span className="font-mono text-xs text-muted">
            {t("day_summary_runner_line", { n: pickupsBy(r), km: km(r) })}
          </span>
        </div>
      ))}
      {others.length > 0 && (
        <ul className="space-y-1.5 border-t border-line pt-3">
          {others.map((p) => {
            const delay = delayMinutes(p);
            return (
              <li key={p.id} className="text-sm">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="flex flex-wrap gap-x-2 font-mono text-[11px]">
                  {p.pickupTime && <span className="text-muted">{t("day_summary_called", { time: p.pickupTime })}</span>}
                  <span className={p.isRecovered ? "text-ink2" : "text-signal-text"}>
                    {p.recoveredAt ? t("day_summary_picked", { time: formatTime(p.recoveredAt) }) : t("day_summary_waiting")}
                  </span>
                  {delay !== undefined && delay > 5 && (
                    <span className="font-semibold text-red-700">{t("day_summary_late", { min: delay })}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
