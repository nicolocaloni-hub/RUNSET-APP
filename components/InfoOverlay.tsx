import React, { useState } from "react";
import { SetPoint, Person, UserRole } from "../types";
import {
  X,
  Phone,
  Navigation,
  Trash2,
  MapPin,
  User,
  Clipboard,
  ExternalLink,
  Pencil,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "../App";

interface InfoOverlayProps {
  entity: SetPoint | Person;
  onClose: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  onEdit?: (entity: SetPoint | Person) => void;
  role: UserRole;
}

const InfoOverlay: React.FC<InfoOverlayProps> = ({
  entity,
  onClose,
  onDelete,
  onEdit,
  role,
}) => {
  const { t } = useLanguage();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const isSet = (e: SetPoint | Person): e is SetPoint => !("category" in e);
  const isProducer = role === UserRole.PRODUCER;
  const hasMeasuredPosition =
    isSet(entity) || entity.category !== "RUNNER" || Boolean(entity.lastSeen);

  const handleDelete = async () => {
    if (!onDelete || isDeleting || !window.confirm(`Eliminare ${entity.name}?`))
      return;
    setIsDeleting(true);
    setError("");
    try {
      await onDelete(entity.id);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Eliminazione non riuscita. Riprova.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDirections = () => {
    if (!hasMeasuredPosition) return;
    const coords = entity.location;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleCall = () => {
    if (!entity.phone) return;
    window.location.href = `tel:${entity.phone.replace(/[^+\d*#]/g, "")}`;
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-[2000] flex items-end justify-center p-4 md:p-8 animate-in slide-in-from-bottom duration-300 pointer-events-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={entity.name}
        className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[85vh]"
      >
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <div
              className={`w-2 h-2 rounded-full ${isSet(entity) ? "bg-yellow-500" : "bg-blue-500"}`}
            />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {isSet(entity) ? t("set_card") : t("contact_card")}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Chiudi"
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-hide flex-1">
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {entity.name}
              </h2>
              {isSet(entity) ? (
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                  <MapPin size={12} className="text-yellow-500/50" />
                  <span>{entity.address}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-blue-400 text-xs font-bold uppercase tracking-widest">
                    {entity.role}
                  </div>
                  {entity.address && (
                    <p className="text-xs text-zinc-400">{entity.address}</p>
                  )}
                  {entity.isRecovered && (
                    <p className="flex items-center gap-1 text-sm text-zinc-300">
                      <CheckCircle2 size={14} /> Recuperato
                    </p>
                  )}
                  {entity.category === "RUNNER" && (
                    <p className="text-xs text-zinc-400">
                      {entity.lastSeen
                        ? `Ultima posizione: ${new Date(entity.lastSeen).toLocaleString("it-IT")}${typeof entity.accuracy === "number" ? ` · precisione ±${Math.round(entity.accuracy)} m` : ""}`
                        : "Posizione GPS non ancora condivisa"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {isProducer && (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(entity)}
                    disabled={isDeleting}
                    aria-label={`Modifica ${entity.name}`}
                    className="p-3 bg-zinc-800 text-zinc-300 rounded-2xl hover:bg-zinc-700"
                  >
                    <Pencil size={18} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    aria-label={`Elimina ${entity.name}`}
                    className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    {isDeleting ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Trash2 size={20} />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-400 mb-4">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 mb-8">
            {isSet(entity) && entity.managerName && (
              <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800/50 rounded-xl text-zinc-500">
                    <User size={14} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                      {t("set_manager")}
                    </div>
                    <div className="text-sm font-semibold">
                      {entity.managerName}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {entity.phone && (
              <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                      <Phone size={14} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                        {t("direct_contact")}
                      </div>
                      <button
                        onClick={handleCall}
                        className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {entity.phone}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleCall}
                    aria-label={`Chiama ${entity.name}`}
                    className="p-2 bg-blue-500 text-white rounded-lg active:scale-90 transition-transform"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            )}

            {isSet(entity) && entity.note && (
              <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800/50 rounded-xl text-zinc-500">
                    <Clipboard size={14} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
                      {t("operative_notes")}
                    </div>
                    <div className="text-xs text-zinc-400 leading-snug">
                      {entity.note}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pb-2">
            <button
              onClick={handleCall}
              disabled={!entity.phone}
              className="flex items-center justify-center gap-2 py-4 bg-zinc-900 border border-zinc-800 hover:bg-blue-500/10 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-30"
            >
              <Phone size={16} className="text-blue-500" />
              {t("call")}
            </button>
            <button
              onClick={handleDirections}
              disabled={!hasMeasuredPosition}
              className="flex items-center justify-center gap-2 py-4 bg-zinc-900 border border-zinc-800 hover:bg-yellow-500/10 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-30"
            >
              <Navigation size={16} className="text-yellow-500" />
              {t("navigate")}
            </button>
          </div>
        </div>

        {/* Safe Area Spacer */}
        <div className="h-[env(safe-area-inset-bottom)] bg-zinc-950 shrink-0" />
      </div>
    </div>
  );
};

export default InfoOverlay;
