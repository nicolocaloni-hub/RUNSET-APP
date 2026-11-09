import { useEffect, useState } from "react";
import type { TranslationKey } from "../translations";
import type { Fix } from "../services/proximity";
import { actions } from "../services/store";

export interface GpsStatus {
  key: TranslationKey;
  params?: Record<string, string | number>;
}

const SEND_INTERVAL_MS = 3000;
const HEARTBEAT_MS = 12_000;

/**
 * Watches the device GPS while `enabled` and reports to the server. The local
 * fix is returned too, so pickup suggestions don't wait for a network round trip.
 */
export function useRunnerGps(productionId: string, enabled: boolean, onDenied: () => void) {
  const [status, setStatus] = useState<GpsStatus>({ key: "gps_off" });
  const [fix, setFix] = useState<Fix | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus({ key: "gps_off" });
      setFix(null);
      return;
    }
    if (!navigator.geolocation) {
      setStatus({ key: "gps_unsupported" });
      onDenied();
      return;
    }
    let alive = true;
    let sending = false;
    let lastSent = 0;
    let wake: WakeLockSentinel | undefined;
    // Device clock at capture time: the server uses it only to order this device's samples.
    const stop = () => actions.reportPosition(productionId, false, Date.now()).catch(() => {});

    const success = (position: GeolocationPosition) => {
      if (!alive) return;
      const captured = Date.now();
      const next: Fix = {
        location: { lat: position.coords.latitude, lng: position.coords.longitude },
        accuracy: position.coords.accuracy,
        timestamp: captured,
      };
      setFix(next);
      setStatus({ key: "gps_accuracy", params: { m: Math.round(position.coords.accuracy) } });
      if (sending || captured - lastSent < SEND_INTERVAL_MS) return;
      sending = true;
      lastSent = captured;
      actions
        .reportPosition(productionId, true, captured, { ...next.location, accuracy: next.accuracy })
        .catch(() => alive && setStatus({ key: "gps_send_failed" }))
        .finally(() => {
          sending = false;
        });
    };
    const failure = (error: GeolocationPositionError) => {
      if (!alive) return;
      if (error.code === error.PERMISSION_DENIED) {
        setStatus({ key: "gps_denied" });
        onDenied();
        void stop();
      } else setStatus({ key: error.code === error.POSITION_UNAVAILABLE ? "gps_unavailable" : "gps_waiting_signal" });
    };
    const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 };
    setStatus({ key: "gps_searching" });
    const watch = navigator.geolocation.watchPosition(success, failure, options);
    const fresh = () => {
      if (!document.hidden) navigator.geolocation.getCurrentPosition(success, failure, options);
    };
    const heartbeat = setInterval(fresh, HEARTBEAT_MS);
    const lock = async () => {
      try {
        if ("wakeLock" in navigator && !document.hidden) wake = await navigator.wakeLock.request("screen");
      } catch {
        /* Optional: not every browser or battery mode allows it. */
      }
    };
    void lock();
    const visible = () => {
      if (!document.hidden) {
        fresh();
        void lock();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      navigator.geolocation.clearWatch(watch);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", visible);
      void wake?.release();
      void stop();
    };
    // onDenied is a state setter from the parent; it never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, productionId]);

  return { status, fix };
}
