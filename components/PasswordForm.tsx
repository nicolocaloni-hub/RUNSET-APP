import React, { useState } from "react";
import { client } from "../lib/supabase";
import { usePrefs } from "../lib/preferences";
import { errorCode } from "../services/store";
import { field, fieldLabel, primaryButton } from "./ui";

export const MIN_PASSWORD = 10;

/** Sets a new password for the signed-in producer (settings or recovery link). */
export default function PasswordForm({ onDone }: { onDone?: () => void }) {
  const { t, tError } = usePrefs();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setMessage({ ok: false, text: t("err_password_short") });
      return;
    }
    setBusy(true);
    const { error } = await client().auth.updateUser({ password });
    setBusy(false);
    if (error) setMessage({ ok: false, text: tError(errorCode(error)) });
    else {
      setPassword("");
      setMessage({ ok: true, text: t("password_changed") });
      onDone?.();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className={fieldLabel}>
        {t("password_new")}
        <input
          type="password"
          required
          minLength={MIN_PASSWORD}
          maxLength={200}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
        <span className="mt-1.5 block font-normal text-zinc-500">{t("password_hint")}</span>
      </label>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-emerald-300" : "text-red-300"}`}>
          {message.text}
        </p>
      )}
      <button disabled={busy} className={primaryButton + " w-full"}>
        {busy ? t("saving") : t("change_password")}
      </button>
    </form>
  );
}
