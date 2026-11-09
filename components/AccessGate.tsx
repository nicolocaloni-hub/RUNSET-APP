import React, { useState } from "react";
import { ArrowRight, Link2, ShieldCheck, Truck } from "lucide-react";
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
    <main className="flex h-[100dvh] flex-col overflow-y-auto bg-ink">
      <header className="mx-auto w-full max-w-md px-6 pb-8 pt-14 text-white">
        <span className="flex items-center gap-2.5">
          <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z" fill="#FF5B1F" />
            <circle cx="12" cy="9" r="2.6" fill="#ffffff" />
          </svg>
          <h1 className="font-display text-[34px] font-extrabold tracking-tight">RunSet</h1>
        </span>
        <p className="mt-3 font-mono text-[11px] font-semibold tracking-widest text-signal">{t("app_tagline")}</p>
        <p className="mt-2 max-w-xs font-display text-[22px] font-semibold leading-tight">{t("app_intro")}</p>
      </header>
      <div className="mx-auto w-full max-w-md flex-1 rounded-t-[26px] bg-white px-5 pb-7 pt-5 md:mb-8 md:flex-none md:rounded-[26px]">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-ground p-1" role="tablist">
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
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl font-display text-sm font-semibold ${
                active ? "bg-white text-ink shadow-[0_2px_6px_rgba(13,27,42,0.12)]" : "text-muted"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        {mode === "runner" ? (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-[22px] font-bold">
              <Link2 size={20} className="text-signal-text" />
              {t("runner_title")}
            </h2>
            <p className="text-sm leading-relaxed text-ink2">{t("runner_help")}</p>
            <p className="text-xs text-muted">{t("runner_link_once")}</p>
            {message && (
              <p role="alert" className="text-sm text-red-700">
                {message.text}
              </p>
            )}
          </section>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="font-display text-[22px] font-bold">{title}</h2>
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
                {mode === "signup" && <span className="mt-1.5 block font-normal text-muted">{t("password_hint")}</span>}
              </label>
            )}
            {message && (
              <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-700"}`}>
                {message.text}
              </p>
            )}
            <button disabled={busy} className={primaryButton + " min-h-[56px] w-full text-base"}>
              {busy ? t("saving") : button}
              <ArrowRight size={18} />
            </button>
            <div className="flex flex-col gap-2 pt-1 text-sm text-ink2">
              {mode === "login" && (
                <>
                  <button type="button" disabled={busy} onClick={() => switchMode("signup")}>
                    {t("to_signup")}
                  </button>
                  <button type="button" disabled={busy} onClick={() => switchMode("reset")} className="text-muted">
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
        <p className="mt-8 text-xs leading-relaxed text-muted">{t("access_footer")}</p>
        <div className="mt-3">
          <PrivacyDialog />
        </div>
      </div>
    </main>
  );
}
