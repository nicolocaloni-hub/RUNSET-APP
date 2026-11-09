import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "../services/protocol";
import {
  applyPosition,
  errorCode,
  loadSnapshot,
  type Membership,
  type PositionRow,
  subscribe,
  syncClock,
} from "../services/store";

export type ProductionStatus = "loading" | "ready" | "revoked" | "error";

/** Snapshot of one production kept fresh by Supabase Realtime, with a slow safety refresh. */
export function useProduction(membership: Membership) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<ProductionStatus>("loading");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasData = useRef(false);

  const reload = useCallback(async () => {
    const mine = ++sequence.current;
    try {
      const next = await loadSnapshot(membership);
      if (mine !== sequence.current) return; // a newer load is in flight
      if (!next) {
        setStatus("revoked");
        return;
      }
      hasData.current = true;
      setSnapshot(next);
      setStatus("ready");
      setError("");
    } catch (cause) {
      if (mine !== sequence.current) return;
      const code = errorCode(cause);
      if (code === "forbidden") setStatus("revoked");
      else {
        setError(code);
        if (!hasData.current) setStatus("error");
      }
    }
  }, [membership]);

  const scheduleReload = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void reload(), 250);
  }, [reload]);

  useEffect(() => {
    void syncClock();
    void reload();
    const onPosition = (row: PositionRow) =>
      setSnapshot((previous) =>
        previous && {
          ...previous,
          people: previous.people.map((person) => {
            if (person.id !== row.runner_id) return person;
            const updated = { ...person };
            applyPosition(updated, row);
            return updated;
          }),
        },
      );
    let wasConnected = false;
    const unsubscribe = subscribe(membership.productionId, onPosition, scheduleReload, (isConnected) => {
      setConnected(isConnected);
      // Catch up on anything missed while the socket was down.
      if (isConnected && !wasConnected) scheduleReload();
      wasConnected = isConnected;
    });
    const safety = setInterval(() => void reload(), 60_000);
    const clock = setInterval(() => void syncClock(), 10 * 60_000);
    const wake = () => {
      if (!document.hidden) scheduleReload();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => {
      sequence.current++;
      clearTimeout(timer.current);
      clearInterval(safety);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      unsubscribe();
    };
  }, [membership.productionId, reload, scheduleReload]);

  /** Runs a write, then refreshes immediately instead of waiting for Realtime. */
  const run = useCallback(
    async <T,>(write: () => Promise<T>): Promise<T> => {
      const result = await write();
      void reload();
      return result;
    },
    [reload],
  );

  return { snapshot, status, connected, error, reload, run };
}
