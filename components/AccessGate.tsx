import React, { useState } from "react";
import { Clapperboard, ArrowRight, ShieldCheck, Truck } from "lucide-react";
import { Snapshot } from "../services/protocol";
import { api } from "../services/api";
export default function AccessGate({
  onAccess,
}: {
  onAccess: (state: Snapshot) => void;
}) {
  const [mode, setMode] = useState<"login" | "create" | "runner">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      onAccess(
        await api({
          ...data,
          action:
            mode === "create"
              ? "createRoom"
              : mode === "runner"
                ? "joinRunner"
                : "loginProducer",
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field =
    "block w-full mt-2 rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-white";
  return (
    <main className="h-[100dvh] overflow-y-auto bg-zinc-950 flex items-start justify-center p-5">
      <div className="w-full max-w-md py-8 my-auto">
        <div className="inline-flex p-3 mb-6 bg-yellow-400 text-black rounded-2xl">
          <Clapperboard size={32} />
        </div>
        <p className="text-yellow-400 text-xs tracking-[.25em] font-bold">
          LA TUA PRODUZIONE, OVUNQUE.
        </p>
        <h1 className="text-5xl font-black tracking-tight mt-3 mb-4">
          RunSet<span className="text-yellow-400">.</span>
        </h1>
        <p className="text-zinc-400 mb-8">
          Runner, cast e troupe. Una mappa condivisa per tenere il set in
          movimento.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            disabled={busy}
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-xl p-3 flex gap-2 items-center justify-center ${mode !== "runner" ? "bg-zinc-700" : "bg-zinc-900 text-zinc-400"}`}
          >
            <ShieldCheck size={18} />
            Produttore
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setMode("runner");
              setError("");
            }}
            className={`rounded-xl p-3 flex gap-2 items-center justify-center ${mode === "runner" ? "bg-zinc-700" : "bg-zinc-900 text-zinc-400"}`}
          >
            <Truck size={18} />
            Runner
          </button>
        </div>
        <form
          key={mode}
          onSubmit={submit}
          className="space-y-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5"
        >
          <h2 className="font-semibold text-xl">
            {mode === "create"
              ? "Crea una produzione"
              : mode === "runner"
                ? "Entra nella squadra"
                : "Bentornato sul set"}
          </h2>
          {mode === "create" ? (
            <>
              <label className="block text-sm text-zinc-300">
                Nome produzione
                <input
                  name="name"
                  required
                  maxLength={120}
                  className={field}
                  placeholder="Il film · Giorno 01"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                Il tuo nome
                <input
                  name="producerName"
                  required
                  maxLength={120}
                  className={field}
                  autoComplete="name"
                />
              </label>
            </>
          ) : (
            <label className="block text-sm text-zinc-300">
              Codice produzione
              <input
                name="roomCode"
                required
                maxLength={32}
                className={field + " uppercase"}
                autoComplete="off"
              />
            </label>
          )}
          {mode === "runner" ? (
            <label className="block text-sm text-zinc-300">
              Codice invito personale
              <input
                name="accessCode"
                required
                maxLength={100}
                className={field}
                autoComplete="off"
              />
              <span className="block mt-2 text-xs text-zinc-500">
                Ricevilo dal produttore. È associato al tuo nome.
              </span>
            </label>
          ) : (
            <label className="block text-sm text-zinc-300">
              Password produttore
              <input
                name="password"
                type="password"
                required
                minLength={mode === "create" ? 10 : 1}
                maxLength={200}
                className={field}
                autoComplete={
                  mode === "create" ? "new-password" : "current-password"
                }
              />
              {mode === "create" && (
                <span className="block mt-2 text-xs text-zinc-500">
                  Almeno 10 caratteri. Conserva password e codice produzione:
                  servono per accedere dagli altri dispositivi.
                </span>
              )}
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="bg-yellow-400 text-black font-bold w-full rounded-xl p-3.5 flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {busy
              ? "Connessione…"
              : mode === "create"
                ? "Crea produzione"
                : "Accedi"}
            <ArrowRight size={18} />
          </button>
        </form>
        {mode !== "runner" && (
          <button
            disabled={busy}
            onClick={() => {
              setMode(mode === "create" ? "login" : "create");
              setError("");
            }}
            className="w-full text-sm text-zinc-300 mt-5"
          >
            {mode === "create"
              ? "Hai già una produzione? Accedi"
              : "Prima volta? Crea una produzione"}
          </button>
        )}
        <p className="mt-8 text-xs leading-relaxed text-zinc-500">
          Il runner sceglie quando condividere il GPS. Il produttore vede
          l’ultima posizione e la sua precisione. Tieni l’app aperta durante il
          servizio.
        </p>
      </div>
    </main>
  );
}
