import React from "react";
import { Check, Navigation } from "lucide-react";
import type { GpsStatus } from "../hooks/useRunnerGps";
import { usePrefs } from "../lib/preferences";
import type { Person } from "../types";

const CATEGORY_BG: Record<Person["category"], string> = { RUNNER: "bg-ink", ACTOR: "bg-cast", TROUPE: "bg-crew" };

export default function RunnerDock({
  sharing,
  status,
  onToggle,
  assigned,
  onSelect,
}: {
  sharing: boolean;
  status: GpsStatus;
  onToggle: () => void;
  /** People this runner has to pick up today. */
  assigned: Person[];
  onSelect: (person: Person) => void;
}) {
  const { t, formatTime } = usePrefs();
  const done = assigned.filter((p) => p.isRecovered).length;
  // Still to pick up first, by call time; then the ones already in the car.
  const ordered = [...assigned].sort(
    (a, b) =>
      Number(!!a.isRecovered) - Number(!!b.isRecovered) ||
      (a.pickupTime ?? "99:99").localeCompare(b.pickupTime ?? "99:99"),
  );
  return (
    <section
      aria-label={t("gps_share")}
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[55%] flex-col gap-3 rounded-t-[26px] bg-white px-4 pb-4 pt-2.5 shadow-sheet md:bottom-3 md:left-3 md:right-auto md:w-[400px] md:rounded-[26px]"
    >
      <span aria-hidden="true" className="mx-auto h-[5px] w-10 shrink-0 rounded-full bg-line2" />
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            sharing ? "bg-signal-soft text-signal-dark" : "bg-ground text-muted"
          }`}
        >
          <Navigation size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-bold">{sharing ? t("gps_shared") : t("gps_off")}</p>
          <p className="truncate font-mono text-xs text-muted" role="status">
            {sharing ? t(status.key, status.params) : t("gps_hint_short")}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`h-11 shrink-0 rounded-[14px] px-4 font-display text-sm font-semibold ${
            sharing ? "border-[1.5px] border-line2 bg-white text-ink" : "bg-signal text-ink"
          }`}
        >
          {sharing ? t("gps_stop") : t("gps_share")}
        </button>
      </div>
      {assigned.length > 0 && (
        <div className="min-h-0 overflow-y-auto">
          <h2 className="mb-1 font-mono text-[11px] font-semibold tracking-wider text-muted">
            {t("my_pickups", { done, total: assigned.length })}
          </h2>
          {ordered.map((p) => (
            <div key={p.id} className={`flex min-h-[52px] items-center gap-3 ${p.isRecovered ? "text-muted" : ""}`}>
              <button type="button" onClick={() => onSelect(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                {p.isRecovered ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#9AA4B2]">
                    <Check size={16} strokeWidth={3} />
                  </span>
                ) : (
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white ${CATEGORY_BG[p.category]}`}
                  >
                    {p.initials}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {p.isRecovered && p.recoveredAt
                      ? t("recovered_at", { time: formatTime(p.recoveredAt) })
                      : [p.pickupTime, p.address].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
              {!p.isRecovered && p.location && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.location.lat},${p.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("navigate_to", { name: p.name })}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-ink text-white"
                >
                  <Navigation size={18} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
