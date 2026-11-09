import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AccessGate from "./components/AccessGate";
import ErrorBoundary from "./components/ErrorBoundary";
import MainLayout, { CenteredMessage } from "./components/MainLayout";
import PasswordForm from "./components/PasswordForm";
import ProductionPicker from "./components/ProductionPicker";
import { primaryButton } from "./components/ui";
import { client, supabase } from "./lib/supabase";
import { PreferencesProvider, usePrefs } from "./lib/preferences";
import { actions, errorCode, memberships as loadMemberships, type Membership } from "./services/store";

const LAST_PRODUCTION_KEY = "runset:last-production";

/** Invite links look like https://…/#invito=<64 hex>; the fragment never reaches a server. */
function readInviteToken(): string | null {
  return window.location.hash.match(/invito=([a-f0-9]{64})/)?.[1] ?? null;
}
function lastProduction() {
  try {
    return localStorage.getItem(LAST_PRODUCTION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function Root() {
  const { t, tError } = usePrefs();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);
  const [list, setList] = useState<Membership[] | null>(null);
  const [listError, setListError] = useState("");
  const [active, setActive] = useState<Membership | null>(null);
  const [inviteToken, setInviteToken] = useState(readInviteToken);
  const [joinError, setJoinError] = useState("");
  const joining = useRef(false);

  useEffect(() => {
    // Remove the token from the address bar and history straight away.
    if (inviteToken) history.replaceState(null, "", window.location.pathname + window.location.search);
    const auth = client().auth;
    void auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        setActive(null);
        setList(null);
      }
    });
    return () => data.subscription.unsubscribe();
    // Runs once: the invite token is read at startup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async (prefer?: string, autoOpen = true) => {
    setListError("");
    try {
      const next = await loadMemberships();
      setList(next);
      const wanted = next.find((m) => m.productionId === (prefer ?? lastProduction()));
      setActive(wanted ?? (autoOpen && next.length === 1 ? next[0] : null));
    } catch (cause) {
      setListError(errorCode(cause));
    }
  }, []);

  // Runner invite: sign in anonymously on this device, then bind it to the runner.
  useEffect(() => {
    if (!inviteToken || session === undefined || joining.current) return;
    joining.current = true;
    void (async () => {
      try {
        const auth = client().auth;
        if (session && !session.user.is_anonymous) {
          if (!window.confirm(t("join_as_producer_warning"))) return;
          await auth.signOut();
        }
        if (!(await auth.getSession()).data.session) {
          const { error } = await auth.signInAnonymously();
          if (error) throw error;
        }
        const productionId = await actions.redeemInvite(inviteToken);
        await refresh(productionId);
      } catch (cause) {
        setJoinError(tError(errorCode(cause)));
      } finally {
        setInviteToken(null);
      }
    })();
  }, [inviteToken, session, refresh, t, tError]);

  useEffect(() => {
    if (inviteToken) return;
    if (session) void refresh();
    else {
      setList(null);
      setActive(null);
    }
    // Reload only when the signed-in user changes, not on token refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, inviteToken]);

  useEffect(() => {
    if (!active) return;
    try {
      localStorage.setItem(LAST_PRODUCTION_KEY, active.productionId);
    } catch {
      /* Remembering the last production is optional. */
    }
  }, [active]);

  const logout = async () => {
    await client().auth.signOut();
    setActive(null);
    setList(null);
  };

  if (session === undefined || inviteToken) return <CenteredMessage text={inviteToken ? t("joining") : t("loading")} />;
  if (session && recovery)
    return (
      <main className="flex h-[100dvh] items-center justify-center bg-zinc-950 p-5">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h1 className="text-xl font-semibold">{t("recovery_title")}</h1>
          <PasswordForm onDone={() => setRecovery(false)} />
        </div>
      </main>
    );
  if (!session) return <AccessGate initialError={joinError || undefined} />;
  if (listError)
    return (
      <CenteredMessage text={tError(listError)}>
        <button type="button" onClick={() => void refresh()} className={primaryButton}>
          {t("retry")}
        </button>
      </CenteredMessage>
    );
  if (!list) return <CenteredMessage text={t("loading")} />;
  const producerAccount = !session.user.is_anonymous;
  if (active)
    return (
      <MainLayout
        key={active.productionId}
        membership={active}
        onLogout={logout}
        onSwitch={
          producerAccount || list.length > 1
            ? () => {
                setActive(null);
                void refresh(undefined, false);
              }
            : undefined
        }
      />
    );
  return (
    <ProductionPicker
      memberships={list}
      canCreate={producerAccount}
      onOpen={setActive}
      onCreated={(id) => void refresh(id)}
      onSignOut={logout}
    />
  );
}

function ConfigMissing() {
  const { t } = usePrefs();
  return <CenteredMessage text={t("err_config_missing")} />;
}

export default function App() {
  return (
    <PreferencesProvider>
      <ErrorBoundary>{supabase ? <Root /> : <ConfigMissing />}</ErrorBoundary>
    </PreferencesProvider>
  );
}
