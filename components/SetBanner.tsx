import React, { useState } from "react";
import { Crosshair, Loader2, Save } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { errorCode } from "../services/store";
import type { Location, SetPoint } from "../types";
import AddressSearch from "./AddressSearch";
import Sheet from "./Sheet";
import { field, fieldLabel, primaryButton } from "./ui";

export default function SetBanner({
  onSave,
  onCancel,
  initialLocation,
  initialSet,
}: {
  onSave: (set: SetPoint, isNew: boolean) => Promise<void>;
  onCancel: () => void;
  initialLocation?: Location;
  initialSet?: SetPoint;
}) {
  const { t, tError } = usePrefs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: initialSet?.name ?? "",
    address: initialSet?.address ?? "",
    managerName: initialSet?.managerName ?? "",
    phone: initialSet?.phone ?? "",
    note: initialSet?.note ?? "",
  });
  const [location, setLocation] = useState<Location | undefined>(initialLocation ?? initialSet?.location);
  const [locationLabel, setLocationLabel] = useState<string>();
  const title = initialSet ? t("edit_set") : t("new_set");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !form.name.trim()) return;
    if (!location) {
      setError(t("address_needed"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(
        {
          id: initialSet?.id ?? "",
          name: form.name.trim(),
          address: form.address.trim(),
          managerName: form.managerName.trim(),
          phone: form.phone.trim(),
          note: form.note.trim(),
          location,
        },
        !initialSet,
      );
    } catch (cause) {
      setError(tError(errorCode(cause)));
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={title}
      onClose={onCancel}
      closeDisabled={busy}
      badge={
        initialLocation && (
          <span className="flex items-center gap-1 rounded-full border border-signal/40 bg-signal-soft px-2 py-0.5 text-[10px] font-bold text-signal-text">
            <Crosshair size={10} />
            {t("map_pin")}
          </span>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <label className={fieldLabel}>
          {t("set_name")}
          <input
            autoFocus
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("placeholder_set")}
            className={field}
          />
        </label>
        <AddressSearch
          label="address"
          address={form.address}
          onAddress={(address) => setForm({ ...form, address })}
          location={location}
          locationLabel={locationLabel}
          onLocation={(next, label) => {
            setLocation(next ?? initialLocation);
            setLocationLabel(label);
            setError("");
          }}
          pinned={Boolean(initialLocation)}
          required
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={fieldLabel}>
            {t("set_manager")}
            <input
              maxLength={120}
              value={form.managerName}
              onChange={(e) => setForm({ ...form, managerName: e.target.value })}
              placeholder={t("manager_placeholder")}
              className={field}
            />
          </label>
          <label className={fieldLabel}>
            {t("phone")}
            <input
              type="tel"
              maxLength={40}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+39…"
              className={field}
            />
          </label>
        </div>
        <label className={fieldLabel}>
          {t("operative_notes")}
          <textarea
            rows={2}
            maxLength={2000}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder={t("notes_placeholder")}
            className={field + " resize-none"}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={primaryButton + " w-full py-4"}>
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {busy ? t("saving") : t("save_set")}
        </button>
      </form>
    </Sheet>
  );
}
