import React from "react";
import type { GpsStatus } from "../hooks/useRunnerGps";
import { usePrefs } from "../lib/preferences";

export default function RunnerDock({
  name,
  sharing,
  status,
  onToggle,
}: {
  name: string;
  sharing: boolean;
  status: GpsStatus;
  onToggle: () => void;
}) {
  const { t } = usePrefs();
  return (
    <div className="absolute bottom-7 left-3 right-3 z-20 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl md:right-auto md:max-w-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold">{name}</p>
          <p className="mt-1 text-xs text-zinc-400" role="status">
            {sharing ? t(status.key, status.params) : t("gps_off")}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold ${sharing ? "bg-zinc-700" : "bg-yellow-400 text-black"}`}
        >
          {sharing ? t("gps_stop") : t("gps_share")}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-zinc-400">{sharing ? t("gps_hint_on") : t("gps_hint_off")}</p>
    </div>
  );
}
