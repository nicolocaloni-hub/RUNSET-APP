import React, { useState } from "react";
import { ArrowRight, Clapperboard, Link2, ShieldCheck, Truck } from "lucide-react";
import { client } from "../lib/supabase";
import { usePrefs } from "../lib/preferences";
import { errorCode } from "../services/store";
import { MIN_PASSWORD } from "./PasswordForm";
import PrivacyDialog from "./PrivacyDialog";
import { field, fieldLabel, primaryButton } from "./ui";

type Mode = "login" | "signup" | "reset" | "runner";

/** Producer sign-in with email and password; runners only need their invite link. */
export default function AccessGate({ initialError }: { initialError?: string }) {
  const { t, tError } = usePrefs();
  const [mode, setMode] = useState<Mode>(initialError ? "runner" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | undefined>(
    initialError ? { ok: false, text: initialError } : undefined,
  );
  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage(undefined);
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      setMessage({ ok: false, text: t("err_password_short") });
      return;
    }
    setBusy(true);
    const auth = client().auth;
    const redirect = window.location.origin;
    try {
      if (mode === "login") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        // With email confirmation enabled there is no session until the link is clicked.
        if (!data.session) setMessage({ ok: true, text: t("signup_check_email") });
      } else {
        const { error } = await auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (error) throw error;
        setMessage({ ok: true, text: t("reset_sent") });
      }
    } catch (cause) {
      setMessage({ ok: false, text: tError(errorCode(cause)) });
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? t("signup_title") : mode === "reset" ? t("reset_title") : t("login_title");
  const button = mode === "signup" ? t("signup_button") : mode === "reset" ? t("reset_button") : t("login_button");

  return (
    <main className="flex h-[100dvh] items-start justify-center overflow-y-auto bg-zinc-950 p-5">
      <div className="my-auto w-full max-w-md py-8">
        <div className="mb-6 inline-flex rounded-2xl bg-yellow-400 p-3 text-black">
          <Clapperboard size={32} />
        </div>
        <p className="text-xs font-bold tracking-[.25em] text-yellow-400">{t("app_tagline")}</p>
        <h1 className="mb-4 mt-3 text-5xl font-black tracking-tight">
          RunSet<span className="text-yellow-400">.</span>
        </h1>
        <p className="mb-8 text-zinc-400">{t("app_intro")}</p>
        <div className="mb-6 grid grid-cols-2 gap-2" role="tablist">
          {(
            [
              { key: "login", Icon: ShieldCheck, label: t("tab_producer"), active: mode !== "runner" },
              { key: "runner", Icon: Truck, label: t("tab_runner"), active: mode === "runner" },
            ] as const
          ).map(({ key, Icon, label, active }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={busy}
              onClick={() => switchMode(key)}
              className={`flex items-center justify-center gap-2 rounded-xl p-3 ${active ? "bg-zinc-700" : "bg-zinc-900 text-zinc-400"}`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        {mode === "runner" ? (
          <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Link2 size={20} className="text-yellow-400" />
              {t("runner_title")}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-300">{t("runner_help")}</p>
            <p className="text-xs text-zinc-500">{t("runner_link_once")}</p>
            {message && (
              <p role="alert" className="text-sm text-red-300">
                {message.text}
              </p>
            )}
          </section>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-xl font-semibold">{title}</h2>
            <label className={fieldLabel}>
              {t("email")}
              <input
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </label>
            {mode !== "reset" && (
              <label className={fieldLabel}>
                {t("password")}
                <input
                  type="password"
                  required
                  minLength={mode === "signup" ? MIN_PASSWORD : 1}
                  maxLength={200}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={field}
                />
                {mode === "signup" && <span className="mt-1.5 block font-normal text-zinc-500">{t("password_hint")}</span>}
              </label>
            )}
            {message && (
              <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-emerald-300" : "text-red-300"}`}>
                {message.text}
              </p>
            )}
            <button disabled={busy} className={primaryButton + " w-full py-3.5"}>
              {busy ? t("saving") : button}
              <ArrowRight size={18} />
            </button>
            <div className="flex flex-col gap-2 pt-1 text-sm text-zinc-300">
              {mode === "login" && (
                <>
                  <button type="button" disabled={busy} onClick={() => switchMode("signup")}>
                    {t("to_signup")}
                  </button>
                  <button type="button" disabled={busy} onClick={() => switchMode("reset")} className="text-zinc-400">
                    {t("to_reset")}
                  </button>
                </>
              )}
              {mode !== "login" && (
                <button type="button" disabled={busy} onClick={() => switchMode("login")}>
                  {t("to_login")}
                </button>
              )}
            </div>
          </form>
        )}
        <p className="mt-8 text-xs leading-relaxed text-zinc-500">{t("access_footer")}</p>
        <div className="mt-3">
          <PrivacyDialog />
        </div>
      </div>
    </main>
  );
}
