import React, { useState } from "react";
import { Person, Location } from "../types";
import {
  X,
  Save,
  User,
  Phone,
  Briefcase,
  Link as LinkIcon,
  MapPin,
  Crosshair,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "../App";

interface PersonBannerProps {
  type: "RUNNER" | "ACTOR" | "TROUPE";
  runners?: Person[]; // Lista runner per l'assegnazione
  onSave: (person: Person) => void | Promise<void>;
  onCancel: () => void;
  initialLocation?: Location;
  initialPerson?: Person;
}

const PersonBanner: React.FC<PersonBannerProps> = ({
  type,
  runners = [],
  onSave,
  onCancel,
  initialLocation,
  initialPerson,
}) => {
  const { t } = useLanguage();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [formData, setFormData] = useState({
    name: initialPerson?.name ?? "",
    role: initialPerson?.role ?? "",
    phone: initialPerson?.phone ?? "",
    address: initialPerson?.address ?? "",
    assignedRunnerId: initialPerson?.assignedRunnerId ?? "",
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
    setGeoError(false);
    setSaveError("");

    setIsGeocoding(true);
    let finalLocation =
      initialLocation ??
      (initialPerson &&
      (type === "RUNNER" ||
        formData.address.trim() === (initialPerson.address ?? "").trim())
        ? initialPerson.location
        : undefined);

    if (!finalLocation && formData.address) {
      const coords = await geocodeAddress(formData.address);
      if (coords) {
        finalLocation = coords;
      } else {
        setGeoError(true);
        setIsGeocoding(false);
        return;
      }
    }

    // A runner has no measured position before the first GPS update. MapLayer
    // never displays this storage placeholder without a lastSeen timestamp.
    if (!finalLocation && type === "RUNNER" && !formData.address.trim()) {
      finalLocation = { lat: 0, lng: 0 };
    }

    if (
      !finalLocation ||
      !Number.isFinite(finalLocation.lat) ||
      !Number.isFinite(finalLocation.lng) ||
      Math.abs(finalLocation.lat) > 90 ||
      Math.abs(finalLocation.lng) > 180
    ) {
      setGeoError(true);
      setIsGeocoding(false);
      return;
    }

    // Calcolo iniziali ultra-sicuro per evitare crash
    const nameToProcess = formData.name.trim();
    const parts = nameToProcess.split(/\s+/).filter(Boolean);
    let initials = "??";
    if (parts.length > 0) {
      initials = parts
        .map((p) => p[0].toUpperCase())
        .join("")
        .slice(0, 2);
    }

    const newPerson: Person = {
      ...initialPerson,
      id: initialPerson?.id ?? crypto.randomUUID(),
      name: nameToProcess,
      role:
        formData.role.trim() ||
        (type === "RUNNER" ? "Runner" : type === "ACTOR" ? "Attore" : "Crew"),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      initials,
      category: type,
      assignedRunnerId:
        type === "TROUPE" || type === "ACTOR"
          ? formData.assignedRunnerId
          : undefined,
      location: finalLocation,
      isRecovered: initialPerson?.isRecovered ?? false,
    };

    try {
      await onSave(newPerson);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Salvataggio non riuscito. Riprova.",
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  const getTitle = () => {
    if (initialPerson) return "Modifica contatto";
    switch (type) {
      case "RUNNER":
        return t("add_runner");
      case "ACTOR":
        return t("add_actor");
      default:
        return t("add_troupe");
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-[2000] flex items-end justify-center p-4 md:p-8 animate-in slide-in-from-bottom duration-300 pointer-events-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={getTitle()}
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              {getTitle()}
            </h3>
            {initialLocation && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded-full border border-blue-500/20">
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
                {t("full_name")}
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  size={16}
                />
                <input
                  autoFocus
                  aria-label={t("full_name")}
                  maxLength={120}
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Mario Rossi"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                {t("role_dept")}
              </label>
              <div className="relative">
                <Briefcase
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                  size={16}
                />
                <input
                  type="text"
                  aria-label={t("role_dept")}
                  maxLength={100}
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, role: e.target.value }))
                  }
                  placeholder={
                    type === "RUNNER"
                      ? "Runner"
                      : type === "ACTOR"
                        ? "Protagonista"
                        : "Elettricista"
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
              {t("start_address")}
            </label>
            <div className="relative">
              <MapPin
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                size={16}
              />
              <input
                type="text"
                aria-label={t("start_address")}
                maxLength={500}
                required={
                  type !== "RUNNER" &&
                  !initialLocation &&
                  !initialPerson?.location
                }
                value={formData.address}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, address: e.target.value }));
                  setGeoError(false);
                }}
                placeholder="Via Roma, 123, Roma"
                className={`w-full bg-zinc-900 border rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none transition-colors ${geoError ? "border-red-500 animate-shake" : "border-zinc-800 focus:border-yellow-500"}`}
              />
            </div>
            {type === "RUNNER" && (
              <p className="text-xs text-zinc-400 ml-1">
                La posizione apparirà quando il runner attiverà il GPS sul
                proprio dispositivo. L'indirizzo è facoltativo.
              </p>
            )}
            {initialLocation && (
              <p className="text-xs text-zinc-400 ml-1">
                Verrà usato il punto scelto sulla mappa.
              </p>
            )}
            {geoError && (
              <p
                role="alert"
                className="text-red-400 text-xs ml-1 mt-1 flex items-center gap-1"
              >
                <AlertCircle size={12} /> Indirizzo non trovato o servizio non
                disponibile. Controlla l'indirizzo oppure chiudi e scegli un
                punto sulla mappa.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="+39 333..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            {(type === "TROUPE" || type === "ACTOR") && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">
                  {t("assign_runner")}
                </label>
                <div className="relative">
                  <LinkIcon
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                    size={16}
                  />
                  <select
                    aria-label={t("assign_runner")}
                    value={formData.assignedRunnerId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        assignedRunnerId: e.target.value,
                      }))
                    }
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors appearance-none"
                  >
                    <option value="">Nessun Runner</option>
                    {runners.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
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
              {isGeocoding ? "Salvataggio in corso..." : t("save_contact")}
            </button>
          </div>
        </form>
        <div className="h-[env(safe-area-inset-bottom)] bg-zinc-950 shrink-0" />
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default PersonBanner;
