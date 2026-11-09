import React from "react";
import { X } from "lucide-react";
import { usePrefs } from "../lib/preferences";

/** Bottom sheet used by the editors and the info cards, above the map. */
export default function Sheet({
  title,
  badge,
  onClose,
  closeDisabled,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
}) {
  const { t } = usePrefs();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2000] flex items-end justify-center p-3 md:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !closeDisabled) onClose();
        }}
        className="pointer-events-auto flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-2 pl-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">{title}</h3>
            {badge}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={t("close")}
            className="p-2 text-zinc-500 transition-colors hover:text-white disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 md:p-6">{children}</div>
        <div className="h-[env(safe-area-inset-bottom)] shrink-0 bg-zinc-950" />
      </div>
    </div>
  );
}
