import React, { useState } from "react";
import { SetPoint, Location } from "../types";
import {
  X,
  Save,
  MapPin,
  Phone,
  User,
  FileText,
  Crosshair,
  Loader2,
} from "lucide-react";
import { useLanguage } from "../App";

interface SetBannerProps {
  onSave: (set: SetPoint) => void | Promise<void>;
  onCancel: () => void;
  initialLocation?: Location;
  initialSet?: SetPoint;
}

const SetBanner: React.FC<SetBannerProps> = ({
  onSave,
  onCancel,
  initialLocation,
  initialSet,
}) => {
  const { t } = useLanguage();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [formData, setFormData] = useState({
    name: initialSet?.name ?? "",
    address: initialSet?.address ?? "",
    manager: initialSet?.managerName ?? "",
    phone: initialSet?.phone ?? "",
    note: initialSet?.note ?? "",
  });

  const geocodeAddress = async (address: string): Promise<Location | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address.trim())}&limit=1`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (
        Array.isArray(data) &&
        data.length > 0 &&
        Number.isFinite(Number(data[0].lat)) &&
        Number.isFinite(Number(data[0].lon)) &&
        Math.abs(Number(data[0].lat)) <= 90 &&
        Math.abs(Number(data[0].lon)) <= 180
      ) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGeocoding || !formData.name.trim()) return;

    setIsGeocoding(true);
    setSaveError("");
    try {
      let finalLocation =
        initialLocation ??
        (initialSet && formData.address.trim() === initialSet.address.trim()
          ? initialSet.location
          : undefined);
      if (!finalLocation && formData.address.trim()) {
        finalLocation = (await geocodeAddress(formData.address)) ?? undefined;
      }
      if (
        !finalLocation ||
        !Number.isFinite(finalLocation.lat) ||
        !Number.isFinite(finalLocation.lng) ||
        Math.abs(finalLocation.lat) > 90 ||
        Math.abs(finalLocation.lng) > 180
      ) {
        throw new Error(
          "Indirizzo non trovato o servizio non disponibile. Controlla l'indirizzo oppure chiudi e scegli un punto sulla mappa.",
        );
      }
      await onSave({
        id: initialSet?.id ?? crypto.randomUUID(),
        name: formData.name.trim(),
        address: formData.address.trim(),
        managerName: formData.manager.trim(),
        phone: formData.phone.trim(),
        note: formData.note.trim(),
        location: finalLocation,
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Salvataggio non riuscito. Riprova.",
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-[2000] flex items-end justify-center p-4 md:p-8 animate-in slide-in-from-bottom duration-300 pointer-events-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initialSet ? "Modifica set" : t("new_set")}
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              {initialSet ? "Modifica set" : t("new_set")}
            </h3>
            {initialLocation && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-bold rounded-full border border-yellow-500/20">
                <Crosshair size={10} />
                {t("map_pin")}
              </span>
            )}
          </div>
          <button
            onClick={onCancel}
            disabled={isGeocoding}
            aria-label="Chiudi"
            className="p-2 text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto scrollbar-hide flex-1"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                {t("set_name")}
              </label>
              <div className="relative">
                <MapPin
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  size={16}
                />
                <input
                  autoFocus
                  required
                  aria-label={t("set_name")}
                  maxLength={120}
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Piazza del Popolo"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                {t("address")}
              </label>
              <input
                required={!initialLocation && !initialSet?.location}
                aria-label={t("address")}
                maxLength={500}
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Via del Corso, 1, Roma"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
              />
              {initialLocation && (
                <p className="text-xs text-zinc-400 ml-1">
                  Verrà usato il punto scelto sulla mappa. L'indirizzo è
                  facoltativo.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                {t("set_manager")}
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  size={16}
                />
                <input
                  type="text"
                  aria-label={t("set_manager")}
                  maxLength={120}
                  value={formData.manager}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      manager: e.target.value,
                    }))
                  }
                  placeholder="Manager Name"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                {t("phone")}
              </label>
              <div className="relative">
                <Phone
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  size={16}
                />
                <input
                  type="tel"
                  aria-label={t("phone")}
                  maxLength={40}
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="+39..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
              {t("internal_notes")}
            </label>
            <div className="relative">
              <FileText
                className="absolute left-3 top-3 text-zinc-600"
                size={16}
              />
              <textarea
                rows={2}
                aria-label={t("internal_notes")}
                maxLength={2000}
                value={formData.note}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Access codes, parking info..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="pt-2">
            {saveError && (
              <p role="alert" className="text-sm text-red-400 mb-3">
                {saveError}
              </p>
            )}
            <button
              type="submit"
              disabled={isGeocoding}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-yellow-500/10 disabled:opacity-50"
            >
              {isGeocoding ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Save size={20} />
              )}
              {isGeocoding ? "Salvataggio in corso..." : t("save_set")}
            </button>
          </div>
        </form>
        <div className="h-[env(safe-area-inset-bottom)] bg-zinc-950 shrink-0" />
      </div>
    </div>
  );
};

export default SetBanner;
