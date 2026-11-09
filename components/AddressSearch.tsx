import React, { useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { errorCode, geocode, type GeocodeResult } from "../services/store";
import type { TranslationKey } from "../translations";
import type { Location } from "../types";
import { field, fieldLabel } from "./ui";

/**
 * Address field with an explicit search. The producer sees what was found and
 * picks it, so a wrong match never becomes a meeting point silently.
 */
export default function AddressSearch({
  label,
  address,
  onAddress,
  location,
  locationLabel,
  onLocation,
  pinned,
  required,
}: {
  label: TranslationKey;
  address: string;
  onAddress: (value: string) => void;
  location?: Location;
  locationLabel?: string;
  onLocation: (location: Location | undefined, label?: string) => void;
  /** Point chosen on the map: editing the text never discards it. */
  pinned: boolean;
  required: boolean;
}) {
  const { t, tError, language } = usePrefs();
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    if (address.trim().length < 3 || busy) return;
    setBusy(true);
    setError("");
    setResults([]);
    try {
      const found = await geocode(address, language);
      if (found.length === 0) setError(t("address_not_found"));
      else if (found.length === 1) onLocation(found[0], found[0].label);
      else setResults(found);
    } catch (cause) {
      setError(tError(errorCode(cause)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className={fieldLabel}>
        {t(label)}
        <div className="mt-1.5 flex gap-2">
          <input
            type="text"
            maxLength={500}
            required={required && !location}
            value={address}
            onChange={(event) => {
              onAddress(event.target.value);
              setResults([]);
              setError("");
              if (!pinned) onLocation(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            placeholder={t("placeholder_address")}
            className={field.replace("mt-1.5 ", "") + " flex-1"}
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={busy || address.trim().length < 3}
            aria-label={t("search_address")}
            title={t("search_address")}
            className="shrink-0 rounded-xl bg-zinc-800 px-3 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </div>
      </label>
      {results.length > 1 && (
        <fieldset className="mt-2 space-y-1.5">
          <legend className="mb-1 text-xs text-zinc-400">{t("address_choose")}</legend>
          {results.map((result) => (
            <button
              key={`${result.lat},${result.lng}`}
              type="button"
              onClick={() => {
                onLocation(result, result.label);
                setResults([]);
              }}
              className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-left text-xs text-zinc-200 hover:border-yellow-500"
            >
              {result.label}
            </button>
          ))}
        </fieldset>
      )}
      {location && !results.length && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-emerald-300">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          <span>
            {pinned ? t("map_pin_note") : `${t("address_found")} ${locationLabel || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}`}
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
