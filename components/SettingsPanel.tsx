import React, { useState } from "react";
import { ArrowLeftRight, Bell, CalendarPlus, Languages, LogOut, Moon, Sun, Trash2 } from "lucide-react";
import { client } from "../lib/supabase";
import { usePrefs } from "../lib/preferences";
import { NotificationService } from "../services/NotificationService";
import type { Snapshot } from "../services/protocol";
import { actions, errorCode } from "../services/store";
import { UserRole } from "../types";
import PasswordForm from "./PasswordForm";
import PrivacyDialog from "./PrivacyDialog";
import { dangerButton, field, fieldLabel, primaryButton, secondaryButton } from "./ui";

export default function SettingsPanel({
  data,
  run,
  onLogout,
  onSwitch,
}: {
  data: Snapshot;
  run: <T>(write: () => Promise<T>) => Promise<T>;
  onLogout: () => Promise<void>;
  /** Present when the user belongs to more than one production. */
  onSwitch?: () => void;
}) {
  const { t, tError, language, setLanguage, mapTheme, setMapTheme } = usePrefs();
  const producer = data.session.role === UserRole.PRODUCER;
  const id = data.session.productionId;
  const [info, setInfo] = useState({
    name: data.session.productionName,
    producerName: data.producerInfo.name,
    producerPhone: data.producerInfo.phone,
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function attempt(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setStatus("");
    try {
      await action();
      if (success) setStatus(success);
    } catch (cause) {
      setStatus(tError(errorCode(cause)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      {producer && (
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-zinc-500">{t("settings_production")}</h3>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void attempt(() => run(() => actions.saveProduction(id, info)), t("settings_saved"));
            }}
          >
            <label className={fieldLabel}>
              {t("production_name")}
              <input
                className={field}
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
                required
                maxLength={120}
              />
            </label>
            <label className={fieldLabel}>
              {t("producer_name")}
              <input
                className={field}
                value={info.producerName}
                onChange={(e) => setInfo({ ...info, producerName: e.target.value })}
                required
                maxLength={120}
              />
            </label>
            <label className={fieldLabel}>
              {t("producer_phone")}
              <input
                className={field}
                type="tel"
                value={info.producerPhone}
                onChange={(e) => setInfo({ ...info, producerPhone: e.target.value })}
                maxLength={40}
              />
            </label>
            <button disabled={busy} className={primaryButton + " w-full"}>
              {busy ? t("saving") : t("save")}
            </button>
          </form>
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="mb-1 font-semibold">{t("new_day")}</p>
            <p className="mb-3 text-xs leading-relaxed text-zinc-400">{t("new_day_text")}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(t("new_day_confirm", { day: data.session.dayNumber + 1 })))
                  void attempt(() => run(() => actions.startNewDay(id)));
              }}
              className={secondaryButton + " w-full"}
            >
              <CalendarPlus size={18} />
              {t("new_day")}
            </button>
          </div>
        </section>
      )}

      {status && (
        <p role="status" className="text-sm text-yellow-200">
          {status}
        </p>
      )}

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setMapTheme(mapTheme === "dark" ? "light" : "dark")}
          className="flex w-full items-center gap-3 rounded-xl bg-zinc-800 p-3"
        >
          {mapTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {mapTheme === "dark" ? t("map_light") : t("map_dark")}
        </button>
        <label className="flex w-full items-center gap-3 rounded-xl bg-zinc-800 p-3">
          <Languages size={18} />
          <span className="flex-1">{t("language")}</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "it")}
            className="rounded-lg bg-zinc-900 px-2 py-1 text-sm"
          >
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </label>
        <button
          type="button"
          onClick={async () =>
            setStatus((await NotificationService.requestPermission()) ? t("notifications_on") : t("notifications_off"))
          }
          className="flex w-full items-center gap-3 rounded-xl bg-zinc-800 p-3"
        >
          <Bell size={18} />
          {t("notifications_enable")}
        </button>
        <p className="text-xs leading-relaxed text-zinc-400">{t("notifications_note")}</p>
      </section>

      {producer && (
        <section className="space-y-3">
          <h3 className="text-xs uppercase tracking-widest text-zinc-500">{t("account")}</h3>
          <PasswordForm />
          <button
            type="button"
            disabled={busy}
            onClick={() => void attempt(async () => {
              await client().auth.signOut({ scope: "global" });
            })}
            className={secondaryButton + " w-full"}
          >
            <LogOut size={18} />
            {t("sign_out_all")}
          </button>
        </section>
      )}

      <section className="space-y-2">
        {onSwitch && (
          <button type="button" onClick={onSwitch} className={secondaryButton + " w-full"}>
            <ArrowLeftRight size={18} />
            {t("switch_production")}
          </button>
        )}
        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 p-3 text-zinc-300"
        >
          <LogOut size={18} />
          {t("leave")}
        </button>
        <PrivacyDialog />
      </section>

      {producer && (
        <section className="space-y-3 rounded-xl border border-red-900/60 p-4">
          <h3 className="text-xs uppercase tracking-widest text-red-400">{t("danger_zone")}</h3>
          <p className="text-xs leading-relaxed text-zinc-400">{t("delete_production_text")}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const typed = window.prompt(t("delete_production_prompt", { name: data.session.productionName }));
              if (typed === null) return;
              if (typed.trim() !== data.session.productionName.trim()) {
                setStatus(t("delete_production_mismatch"));
                return;
              }
              // Realtime/reload then reports the production as gone and returns to the list.
              void attempt(() => run(() => actions.deleteProduction(id)));
            }}
            className={dangerButton + " w-full"}
          >
            <Trash2 size={18} />
            {t("delete_production")}
          </button>
        </section>
      )}
    </div>
  );
}
