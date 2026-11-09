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
        className="pointer-events-auto flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-line bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line bg-ground p-4">
          <div className="flex items-center gap-2 pl-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted">{title}</h3>
            {badge}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={t("close")}
            className="p-2 text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 md:p-6">{children}</div>
        <div className="h-[env(safe-area-inset-bottom)] shrink-0 bg-white" />
      </div>
    </div>
  );
}
