import React from "react";
import { Plus } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import type { SetPoint } from "../types";
import { primaryButton } from "./ui";

export default function SetsPanel({
  sets,
  producer,
  onAdd,
  onSelect,
}: {
  sets: SetPoint[];
  producer: boolean;
  onAdd: () => void;
  onSelect: (set: SetPoint) => void;
}) {
  const { t } = usePrefs();
  return (
    <>
      {producer && (
        <button type="button" onClick={onAdd} className={primaryButton + " w-full"}>
          <Plus size={18} />
          {t("add_set")}
        </button>
      )}
      {sets.length === 0 && <p className="text-sm text-muted">{t("sets_empty")}</p>}
      {sets.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s)}
          className="w-full rounded-xl border border-line bg-ground p-4 text-left"
        >
          <p className="mb-1 font-bold">🎬 {s.name}</p>
          <p className="text-xs text-muted">{s.address || t("map_point")}</p>
        </button>
      ))}
    </>
  );
}
