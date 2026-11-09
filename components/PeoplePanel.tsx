import React from "react";
import { Check, ChevronRight, Plus } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { isLive } from "../services/proximity";
import type { Category, Person } from "../types";
import { field, fieldLabel } from "./ui";

const CATEGORIES: Category[] = ["RUNNER", "ACTOR", "TROUPE"];
const BADGE: Record<Category, string> = { RUNNER: "bg-ink", ACTOR: "bg-cast", TROUPE: "bg-crew" };

export default function PeoplePanel({
  people,
  producer,
  now,
  filter,
  onFilter,
  busy,
  colors,
  onAdd,
  onSelect,
  onInvite,
  onPickup,
}: {
  people: Person[];
  producer: boolean;
  /** Server-corrected time. */
  now: number;
  filter: string;
  onFilter: (runnerId: string) => void;
  busy: boolean;
  /** Runner id to palette color, shared with the map. */
  colors: Map<string, string>;
  onAdd: (category: Category) => void;
  onSelect: (person: Person) => void;
  onInvite: (runner: Person) => void;
  onPickup: (person: Person) => void;
}) {
  const { t, formatTime } = usePrefs();
  const runners = people.filter((p) => p.category === "RUNNER");
  const visible = filter ? people.filter((p) => p.id === filter || p.assignedRunnerId === filter) : people;
  const toPickUp = visible.filter((p) => p.category !== "RUNNER" && p.assignedRunnerId);
  const done = toPickUp.filter((p) => p.isRecovered).length;

  const status = (p: Person) => {
    if (p.category === "RUNNER")
      return isLive(p, now) ? t("gps_live") : p.lastSeen ? t("gps_last", { time: formatTime(p.lastSeen) }) : t("gps_waiting");
    if (p.isRecovered) return t("recovered");
    return people.find((r) => r.id === p.assignedRunnerId)?.name ?? t("unassigned");
  };

  return (
    <>
      {producer && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => onAdd(category)}
                className="flex flex-col items-center gap-1 rounded-2xl bg-ground py-3 text-xs font-semibold"
              >
                <Plus size={16} />
                {t(`cat_${category}`)}
              </button>
            ))}
          </div>
          <label className={fieldLabel}>
            {t("filter_by_runner")}
            <select value={filter} onChange={(e) => onFilter(e.target.value)} className={field}>
              <option value="">{t("all_team")}</option>
              {runners.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {toPickUp.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-muted">{t("progress", { done, total: toPickUp.length })}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ground">
            <div className="h-full bg-signal transition-all" style={{ width: `${(done / toPickUp.length) * 100}%` }} />
          </div>
        </div>
      )}
      {CATEGORIES.map((category) => {
        const members = visible.filter((p) => p.category === category);
        return (
          <section key={category}>
            <h3 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t(`cat_${category}`)} · {members.length}
            </h3>
            {members.length === 0 && (
              <p className="text-sm text-muted">{producer ? t("no_contacts") : t("no_assigned")}</p>
            )}
            <div className="space-y-2">
              {members.map((p) => (
                <div key={p.id} className="rounded-2xl border-[1.5px] border-line bg-white p-3">
                  <button type="button" onClick={() => onSelect(p)} className="flex w-full items-center gap-3 text-left">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${
                        p.isRecovered ? "border-2 border-[#9AA4B2] text-muted" : `text-white ${BADGE[category]}`
                      }`}
                      style={!p.isRecovered && category === "RUNNER" ? { background: colors.get(p.id) } : undefined}
                    >
                      {p.isRecovered ? <Check size={17} /> : p.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="mt-1 block text-xs text-muted">{status(p)}</span>
                    </span>
                    <ChevronRight size={15} className="text-muted" />
                  </button>
                  {producer && category === "RUNNER" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onInvite(p)}
                      className="mt-3 w-full border-t border-line pt-2 text-left text-xs text-signal-text"
                    >
                      {t("invite_button")}
                    </button>
                  )}
                  {!producer && category !== "RUNNER" && !p.isRecovered && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onPickup(p)}
                      className="mt-3 w-full rounded-lg bg-signal p-2 text-sm font-bold text-ink"
                    >
                      {t("confirm_pickup")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
