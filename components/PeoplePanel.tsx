import React from "react";
import { Check, ChevronRight, Plus } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { isLive } from "../services/proximity";
import type { Category, Person } from "../types";
import { field, fieldLabel } from "./ui";

const CATEGORIES: Category[] = ["RUNNER", "ACTOR", "TROUPE"];
const BADGE: Record<Category, string> = { RUNNER: "bg-blue-500", ACTOR: "bg-violet-500", TROUPE: "bg-emerald-600" };

export default function PeoplePanel({
  people,
  producer,
  now,
  filter,
  onFilter,
  busy,
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
                className="flex flex-col items-center gap-1 rounded-xl bg-zinc-800 py-3 text-xs"
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
          <p className="mb-1.5 text-xs text-zinc-400">{t("progress", { done, total: toPickUp.length })}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-yellow-400 transition-all" style={{ width: `${(done / toPickUp.length) * 100}%` }} />
          </div>
        </div>
      )}
      {CATEGORIES.map((category) => {
        const members = visible.filter((p) => p.category === category);
        return (
          <section key={category}>
            <h3 className="mb-3 text-xs uppercase tracking-widest text-zinc-500">
              {t(`cat_${category}`)} · {members.length}
            </h3>
            {members.length === 0 && (
              <p className="text-sm text-zinc-500">{producer ? t("no_contacts") : t("no_assigned")}</p>
            )}
            <div className="space-y-2">
              {members.map((p) => (
                <div key={p.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <button type="button" onClick={() => onSelect(p)} className="flex w-full items-center gap-3 text-left">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        p.isRecovered ? "bg-zinc-600 text-zinc-300" : BADGE[category]
                      }`}
                    >
                      {p.isRecovered ? <Check size={17} /> : p.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.name}</span>
                      <span className="mt-1 block text-xs text-zinc-400">{status(p)}</span>
                    </span>
                    <ChevronRight size={15} className="text-zinc-500" />
                  </button>
                  {producer && category === "RUNNER" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onInvite(p)}
                      className="mt-3 w-full border-t border-zinc-800 pt-2 text-left text-xs text-yellow-400"
                    >
                      {t("invite_button")}
                    </button>
                  )}
                  {!producer && category !== "RUNNER" && !p.isRecovered && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onPickup(p)}
                      className="mt-3 w-full rounded-lg bg-yellow-400 p-2 text-sm font-bold text-black"
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
