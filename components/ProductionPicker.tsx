import React, { useState } from "react";
import { ChevronRight, Clapperboard, LogOut, Plus } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { actions, errorCode, type Membership } from "../services/store";
import { UserRole } from "../types";
import { field, fieldLabel, primaryButton, secondaryButton } from "./ui";

/** Lists the user's productions; producers can also create a new one here. */
export default function ProductionPicker({
  memberships,
  canCreate,
  onOpen,
  onCreated,
  onSignOut,
}: {
  memberships: Membership[];
  canCreate: boolean;
  onOpen: (membership: Membership) => void;
  onCreated: (productionId: string) => void;
  onSignOut: () => Promise<void>;
}) {
  const { t, tError } = usePrefs();
  const [creating, setCreating] = useState(memberships.length === 0);
  const [name, setName] = useState("");
  const [producerName, setProducerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onCreated(await actions.createProduction(name.trim(), producerName.trim()));
    } catch (cause) {
      setError(tError(errorCode(cause)));
      setBusy(false);
    }
  }

  return (
    <main className="flex h-[100dvh] items-start justify-center overflow-y-auto bg-white p-5">
      <div className="my-auto w-full max-w-md space-y-6 py-8">
        <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
          <Clapperboard className="text-signal-text" />
          {t("productions_title")}
        </h1>
        {memberships.length === 0 && !canCreate && <p className="text-ink2">{t("no_access_runner")}</p>}
        <div className="space-y-2">
          {memberships.map((m) => (
            <button
              key={m.productionId}
              type="button"
              onClick={() => onOpen(m)}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-ground p-4 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{m.productionName}</span>
                <span className="text-xs text-muted">
                  {m.role === UserRole.PRODUCER ? t("role_producer") : t("role_runner")}
                </span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          ))}
        </div>
        {canCreate &&
          (creating ? (
            <form onSubmit={create} className="space-y-4 rounded-2xl border border-line bg-ground p-5">
              <h2 className="text-xl font-semibold">{t("production_new")}</h2>
              <label className={fieldLabel}>
                {t("production_name")}
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("production_name_placeholder")}
                  className={field}
                />
              </label>
              <label className={fieldLabel}>
                {t("producer_name")}
                <input
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={producerName}
                  onChange={(e) => setProducerName(e.target.value)}
                  className={field}
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <button disabled={busy} className={primaryButton + " w-full"}>
                {busy ? t("saving") : t("create_production")}
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className={secondaryButton + " w-full"}>
              <Plus size={18} />
              {t("production_new")}
            </button>
          ))}
        <button type="button" onClick={() => void onSignOut()} className="flex items-center gap-2 text-sm text-muted">
          <LogOut size={16} />
          {t("sign_out")}
        </button>
      </div>
    </main>
  );
}
