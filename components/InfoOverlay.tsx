import React, { useState } from "react";
import { CheckCircle2, Clipboard, Loader2, MapPin, Navigation, Pencil, Phone, RotateCcw, Trash2, User } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { errorCode } from "../services/store";
import { isValidLocation } from "../services/proximity";
import type { Person, SetPoint } from "../types";
import Sheet from "./Sheet";

const UNDO_WINDOW_MS = 10 * 60_000;
const isSet = (entity: SetPoint | Person): entity is SetPoint => !("category" in entity);
const telHref = (phone: string) => `tel:${phone.replace(/[^+\d*#]/g, "")}`;

export default function InfoOverlay({
  entity,
  isProducer,
  runnerId,
  now,
  onClose,
  onEdit,
  onDelete,
  onUndo,
}: {
  entity: SetPoint | Person;
  isProducer: boolean;
  runnerId?: string;
  /** Server-corrected time. */
  now: number;
  onClose: () => void;
  onEdit?: (entity: SetPoint | Person) => void;
  onDelete?: (entity: SetPoint | Person) => Promise<void>;
  onUndo?: (person: Person) => Promise<void>;
}) {
  const { t, tError, formatDateTime, formatTime } = usePrefs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = isSet(entity) ? entity : undefined;
  const person = isSet(entity) ? undefined : entity;
  const canNavigate = isValidLocation(entity.location);
  const canUndo =
    person?.isRecovered &&
    onUndo &&
    (isProducer || (person.recoveredBy === runnerId && now - (person.recoveredAt ?? 0) < UNDO_WINDOW_MS));

  async function attempt(action: () => Promise<void>, question: string) {
    if (busy || !window.confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(tError(errorCode(cause)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={set ? t("set_card") : t("contact_card")} onClose={onClose} closeDisabled={busy}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h2 className="break-words text-2xl font-bold tracking-tight">{entity.name}</h2>
          {set ? (
            set.address && (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <MapPin size={12} className="text-signal-text/60" />
                {set.address}
              </p>
            )
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">{person!.role}</p>
              {person!.address && <p className="text-xs text-muted">{person!.address}</p>}
              {person!.isRecovered && (
                <p className="flex items-center gap-1 text-sm text-ink2">
                  <CheckCircle2 size={14} />
                  {person!.recoveredAt ? t("recovered_at", { time: formatTime(person!.recoveredAt) }) : t("recovered")}
                </p>
              )}
              {person!.category === "RUNNER" && (
                <p className="text-xs text-muted">
                  {person!.lastSeen
                    ? `${t("last_position", { time: formatDateTime(person!.lastSeen) })}${
                        typeof person!.accuracy === "number" ? ` · ${t("precision", { m: Math.round(person!.accuracy) })}` : ""
                      }`
                    : t("no_position")}
                </p>
              )}
            </>
          )}
        </div>
        {isProducer && (
          <div className="flex shrink-0 gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(entity)}
                disabled={busy}
                aria-label={t("edit_name", { name: entity.name })}
                className="rounded-2xl bg-ground p-3 text-ink2 hover:bg-line"
              >
                <Pencil size={18} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => void attempt(() => onDelete(entity), t("delete_confirm", { name: entity.name }))}
                disabled={busy}
                aria-label={t("delete_name", { name: entity.name })}
                className="rounded-2xl bg-red-50 p-3 text-red-700 hover:bg-red-100 disabled:opacity-40"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mb-6 grid gap-3">
        {set?.managerName && (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-ground p-4">
            <User size={14} className="text-muted" />
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">{t("set_manager")}</p>
              <p className="text-sm font-semibold">{set.managerName}</p>
            </div>
          </div>
        )}
        {entity.phone && (
          <a
            href={telHref(entity.phone)}
            aria-label={t("call_name", { name: entity.name })}
            className="flex items-center gap-3 rounded-2xl border border-line bg-ground p-4"
          >
            <Phone size={14} className="text-blue-700" />
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">{t("direct_contact")}</p>
              <p className="text-sm font-bold text-blue-700">{entity.phone}</p>
            </div>
          </a>
        )}
        {set?.note && (
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-ground p-4">
            <Clipboard size={14} className="mt-0.5 text-muted" />
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">{t("operative_notes")}</p>
              <p className="whitespace-pre-line text-xs leading-snug text-ink2">{set.note}</p>
            </div>
          </div>
        )}
      </div>
      {canUndo && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void attempt(() => onUndo!(person!), t("undo_confirm", { name: entity.name }))}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-line2 py-3 text-sm text-ink2 hover:bg-ground"
        >
          <RotateCcw size={16} />
          {t("undo_pickup")}
        </button>
      )}
      <div className="grid grid-cols-2 gap-4">
        <a
          href={entity.phone ? telHref(entity.phone) : undefined}
          aria-disabled={!entity.phone}
          className={`flex items-center justify-center gap-2 rounded-2xl border border-line bg-ground py-4 text-xs font-bold uppercase tracking-widest ${
            entity.phone ? "hover:bg-blue-50" : "pointer-events-none opacity-30"
          }`}
        >
          <Phone size={16} className="text-blue-700" />
          {t("call")}
        </a>
        <a
          href={
            canNavigate
              ? `https://www.google.com/maps/dir/?api=1&destination=${entity.location!.lat},${entity.location!.lng}`
              : undefined
          }
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!canNavigate}
          className={`flex items-center justify-center gap-2 rounded-2xl border border-line bg-ground py-4 text-xs font-bold uppercase tracking-widest ${
            canNavigate ? "hover:bg-signal-soft" : "pointer-events-none opacity-30"
          }`}
        >
          <Navigation size={16} className="text-signal-text" />
          {t("navigate")}
        </a>
      </div>
    </Sheet>
  );
}
