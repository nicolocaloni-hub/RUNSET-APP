import React from "react";
import { usePrefs } from "../lib/preferences";
import type { Person } from "../types";

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
      className="absolute inset-x-3 top-20 z-[2200] rounded-2xl border border-yellow-400 bg-zinc-900 p-4 shadow-2xl md:inset-x-auto md:left-1/2 md:w-[460px] md:-translate-x-1/2"
    >
      <p className="mb-1 text-xs font-bold text-yellow-400">
        {t("pickup_near", { m: Math.round(distance), acc: Math.round(accuracy) })}
      </p>
      <h2 className="text-lg font-bold">{t("pickup_question", { name: person.name })}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={onNo} className="rounded-xl bg-zinc-700 p-3">
          {t("no")}
        </button>
        <button type="button" disabled={busy} onClick={onYes} className="rounded-xl bg-yellow-400 p-3 font-bold text-black">
          {busy ? t("saving") : t("pickup_yes")}
        </button>
      </div>
    </section>
  );
}
