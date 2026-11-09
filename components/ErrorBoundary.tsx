import React from "react";
import { usePrefs } from "../lib/preferences";
import { primaryButton } from "./ui";

function Crash() {
  const { t } = usePrefs();
  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-white p-6 text-center">
      <p className="text-lg font-semibold">{t("crash_title")}</p>
      <button type="button" onClick={() => window.location.reload()} className={primaryButton}>
        {t("crash_reload")}
      </button>
    </main>
  );
}

/** Keeps a rendering bug from leaving the runner with a blank screen mid-shift. */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("RunSet UI crash", error instanceof Error ? error.name : "unknown");
  }
  render() {
    return this.state.failed ? <Crash /> : this.props.children;
  }
}
