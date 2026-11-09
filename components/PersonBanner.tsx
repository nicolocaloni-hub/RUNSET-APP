import React, { useState } from "react";
import { Crosshair, Loader2, Save } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { errorCode } from "../services/store";
import { initials } from "../services/proximity";
import type { Category, Location, Person } from "../types";
import AddressSearch from "./AddressSearch";
import Sheet from "./Sheet";
import { field, fieldLabel, primaryButton } from "./ui";

export default function PersonBanner({
  type,
  runners,
  onSave,
  onCancel,
  initialLocation,
  initialPerson,
}: {
  type: Category;
  runners: Person[];
  onSave: (person: Person, isNew: boolean) => Promise<void>;
  onCancel: () => void;
  initialLocation?: Location;
  initialPerson?: Person;
}) {
  const { t, tError } = usePrefs();
  const runner = type === "RUNNER";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: initialPerson?.name ?? "",
    role: initialPerson?.role ?? "",
    phone: initialPerson?.phone ?? "",
    address: initialPerson?.address ?? "",
    assignedRunnerId: initialPerson?.assignedRunnerId ?? "",
  });
  const [location, setLocation] = useState<Location | undefined>(
    runner ? undefined : (initialLocation ?? initialPerson?.location),
  );
  const [locationLabel, setLocationLabel] = useState<string>();
  const title = initialPerson
    ? t("edit_contact")
    : t(type === "RUNNER" ? "add_runner" : type === "ACTOR" ? "add_actor" : "add_troupe");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !form.name.trim()) return;
    if (!runner && !location) {
      setError(t("address_needed"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const name = form.name.trim();
      await onSave(
        {
          ...initialPerson,
          id: initialPerson?.id ?? "",
          name,
          initials: initials(name),
          role: form.role.trim() || t(`default_role_${type}`),
          phone: form.phone.trim(),
          address: form.address.trim(),
          category: type,
          assignedRunnerId: runner ? undefined : form.assignedRunnerId || undefined,
          location: runner ? undefined : location,
        },
        !initialPerson,
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
          <span className="flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
            <Crosshair size={10} />
            {t("map_pin")}
          </span>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={fieldLabel}>
            {t("full_name")}
            <input
              autoFocus
              required
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("placeholder_name")}
              autoComplete="off"
              className={field}
            />
          </label>
          <label className={fieldLabel}>
            {t("role_dept")}
            <input
              maxLength={100}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder={t(`placeholder_role_${type}`)}
              className={field}
            />
          </label>
        </div>
        <AddressSearch
          label="start_address"
          address={form.address}
          onAddress={(address) => setForm({ ...form, address })}
          location={location}
          locationLabel={locationLabel}
          onLocation={(next, label) => {
            if (runner) return;
            // Editing an address resets the old point, except for a map pin.
            setLocation(next ?? initialLocation);
            setLocationLabel(label);
            setError("");
          }}
          pinned={Boolean(initialLocation)}
          required={!runner}
        />
        {runner && <p className="text-xs text-zinc-400">{t("runner_location_note")}</p>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={fieldLabel}>
            {t("phone")}
            <input
              type="tel"
              maxLength={40}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+39 333…"
              autoComplete="off"
              className={field}
            />
          </label>
          {!runner && (
            <label className={fieldLabel}>
              {t("assign_runner")}
              <select
                value={form.assignedRunnerId}
                onChange={(e) => setForm({ ...form, assignedRunnerId: e.target.value })}
                className={field}
              >
                <option value="">{t("no_runner")}</option>
                {runners.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={primaryButton + " w-full py-4"}>
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {busy ? t("saving") : t("save_contact")}
        </button>
      </form>
    </Sheet>
  );
}
