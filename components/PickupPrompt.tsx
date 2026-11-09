import React from "react";
import { usePrefs } from "../lib/preferences";
import type { Person } from "../types";

const CATEGORY_BG: Record<Person["category"], string> = { RUNNER: "bg-ink", ACTOR: "bg-cast", TROUPE: "bg-crew" };

export default function PickupPrompt({
  person,
  distance,
  accuracy,
  busy,
  onYes,
  onNo,
}: {
  person: Person;
  distance: number;
  accuracy: number;
  busy: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const { t } = usePrefs();
  return (
    <section
      role="alertdialog"
      aria-label={t("pickup_label")}
      className="absolute inset-x-4 top-[92px] z-[2200] flex flex-col gap-3.5 rounded-[22px] bg-white p-4 shadow-[0_14px_36px_rgba(13,27,42,0.28)] md:inset-x-auto md:left-1/2 md:w-[440px] md:-translate-x-1/2"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white ${CATEGORY_BG[person.category]}`}
        >
          {person.initials}
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-signal-text">
            {t("pickup_near", { m: Math.round(distance), acc: Math.round(accuracy) })}
          </p>
          <h2 className="font-display text-[19px] font-bold leading-tight">{t("pickup_question", { name: person.name })}</h2>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={onNo}
          className="min-h-[52px] rounded-2xl border-[1.5px] border-line2 bg-white font-display text-[15px] font-semibold"
        >
          {t("no")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onYes}
          className="min-h-[52px] rounded-2xl bg-signal font-display text-[15px] font-bold text-ink disabled:opacity-60"
        >
          {busy ? t("saving") : t("pickup_yes")}
        </button>
      </div>
    </section>
  );
}
