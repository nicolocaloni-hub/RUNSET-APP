import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { UserRole } from "./types";
import { Snapshot } from "./services/protocol";
import AccessGate from "./components/AccessGate";
import MainLayout from "./components/MainLayout";
import { api, ApiError } from "./services/api";
import { NotificationService } from "./services/NotificationService";
import { translations, Language, TranslationKey } from "./translations";
interface Context {
  language: Language;
  setLanguage: (l: Language) => void;
  mapTheme: "light" | "dark";
  setMapTheme: (v: "light" | "dark") => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
}
const AppContext = createContext<Context | undefined>(undefined);
export function useLanguage() {
  const context = useContext(AppContext);
  if (!context) throw new Error("Missing App provider");
  return context;
}
function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
export default function App() {
  const [language, setLang] = useState<Language>(() =>
    preference("runset_lang", "it") === "en" ? "en" : "it",
  );
  const [mapTheme, setTheme] = useState<"light" | "dark">(() =>
    preference("runset_map_theme", "dark") === "light" ? "light" : "dark",
  );
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("GPS spento");
  const [now, setNow] = useState(Date.now());
  const dataRef = useRef<Snapshot | null>(null);
  const seen = useRef(new Set<string>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const epoch = useRef(0);
  const exiting = useRef(false);
  const accept = useCallback((next: Snapshot) => {
    if (
      dataRef.current &&
      next.session.roomCode === dataRef.current.session.roomCode &&
      next.version < dataRef.current.version
    )
      return;
    const initial =
      !dataRef.current ||
      dataRef.current.session.roomCode !== next.session.roomCode;
    if (initial) seen.current.clear();
    for (const e of next.events) {
      if (!initial && !seen.current.has(e.id))
        NotificationService.showNativeNotification(
          e.type === "PICKUP" ? "Recupero completato" : "RunSet",
          e.message,
          e.id,
        );
      seen.current.add(e.id);
    }
    dataRef.current = next;
    setData(next);
    setOnline(true);
    setError("");
  }, []);
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const captured = epoch.current;
      try {
        const next = await api();
        if (!disposed && !exiting.current && captured === epoch.current)
          accept(next);
      } catch (e) {
        if (disposed || exiting.current || captured !== epoch.current) return;
        setOnline(false);
        if (e instanceof ApiError && e.status === 401) {
          dataRef.current = null;
          setData(null);
          setSharing(false);
        } else setError((e as Error).message);
      } finally {
        if (!disposed) {
          setLoading(false);
          timer = setTimeout(poll, document.hidden ? 15000 : 3000);
        }
      }
    }
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [accept]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(tick);
  }, []);
  const mutate = useCallback(
    (body: Record<string, unknown>): Promise<Snapshot> => {
      const captured = epoch.current;
      const pending = queue.current
        .catch(() => {})
        .then(async () => {
          if (captured !== epoch.current)
            throw new ApiError("Sessione cambiata.", 401);
          const next = await api(body);
          if (captured === epoch.current && !exiting.current) accept(next);
          return next;
        });
      queue.current = pending;
      return pending.catch((e) => {
        if (captured === epoch.current && !exiting.current) {
          setError((e as Error).message);
          if (e instanceof ApiError && e.status === 401) {
            dataRef.current = null;
            setData(null);
            setSharing(false);
          }
        }
        throw e;
      });
    },
    [accept],
  );
  useEffect(() => {
    if (!sharing || data?.session.role !== UserRole.RUNNER) return;
    if (!navigator.geolocation) {
      setGpsStatus("GPS non supportato");
      setSharing(false);
      return;
    }
    let alive = true,
      sending = false,
      lastSent = 0;
    let wake: WakeLockSentinel | undefined;
    const runnerId = data.session.runnerId;
    const success = (position: GeolocationPosition) => {
      if (
        !alive ||
        sending ||
        Date.now() - lastSent < 3000 ||
        Date.now() - position.timestamp > 30000
      )
        return;
      sending = true;
      lastSent = Date.now();
      setGpsStatus(`GPS ±${Math.round(position.coords.accuracy)} m`);
      void mutate({
        action: "location",
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        sharing: true,
      })
        .catch(() => {
          if (alive) setGpsStatus("Posizione non inviata · controlla la rete");
        })
        .finally(() => {
          sending = false;
        });
    };
    const failure = (e: GeolocationPositionError) => {
      if (!alive) return;
      setGpsStatus(
        e.code === 1
          ? "GPS negato: abilitalo nelle impostazioni del browser"
          : e.code === 2
            ? "GPS non disponibile"
            : "In attesa di un segnale GPS",
      );
      if (e.code === 1) setSharing(false);
      void mutate({
        action: "location",
        sharing: false,
        timestamp: Date.now(),
      }).catch(() => {});
    };
    const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };
    setGpsStatus("Ricerca segnale GPS…");
    const watch = navigator.geolocation.watchPosition(
      success,
      failure,
      options,
    );
    const fresh = () => {
      if (!document.hidden)
        navigator.geolocation.getCurrentPosition(success, failure, options);
    };
    const heartbeat = setInterval(fresh, 12000);
    const lock = async () => {
      try {
        if ("wakeLock" in navigator && !document.hidden)
          wake = await navigator.wakeLock.request("screen");
      } catch {
        /* Optional battery/device feature. */
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
      if (dataRef.current?.session.runnerId === runnerId && !exiting.current)
        void mutate({
          action: "location",
          sharing: false,
          timestamp: Date.now(),
        }).catch(() => {});
    };
  }, [sharing, data?.session.runnerId, data?.session.role, mutate]);
  const logout = async () => {
    exiting.current = true;
    setSharing(false);
    try {
      await queue.current.catch(() => {});
      if (dataRef.current?.session.role === UserRole.RUNNER)
        await api({
          action: "location",
          sharing: false,
          timestamp: Date.now(),
        }).catch(() => {});
      await api({ action: "logout" });
      epoch.current++;
      dataRef.current = null;
      setData(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      exiting.current = false;
    }
  };
  const setLanguage = (value: Language) => {
    setLang(value);
    try {
      localStorage.setItem("runset_lang", value);
    } catch {}
  };
  const setMapTheme = (value: "light" | "dark") => {
    setTheme(value);
    try {
      localStorage.setItem("runset_map_theme", value);
    } catch {}
  };
  const t = (key: TranslationKey, params?: Record<string, string>) => {
    let value = translations[language][key] || key;
    for (const [k, v] of Object.entries(params ?? {}))
      value = value.replace(`{${k}}`, v);
    return value;
  };
  return (
    <AppContext.Provider
      value={{ language, setLanguage, mapTheme, setMapTheme, t }}
    >
      {loading ? (
        <div className="m-auto text-yellow-400" role="status">
          Connessione alla produzione…
        </div>
      ) : !data ? (
        <>
          <AccessGate
            onAccess={(next) => {
              epoch.current++;
              accept(next);
            }}
          />
          {error && (
            <p
              role="alert"
              className="fixed bottom-2 inset-x-3 bg-red-950 p-3 rounded-xl text-sm text-red-200"
            >
              {error}
            </p>
          )}
        </>
      ) : (
        <MainLayout
          key={
            data.session.roomCode +
            data.session.role +
            (data.session.runnerId ?? "")
          }
          data={data}
          mutate={mutate}
          onLogout={logout}
          sharing={sharing}
          onSharingChange={setSharing}
          gpsStatus={gpsStatus}
          online={online}
          error={error}
          now={now}
        />
      )}
    </AppContext.Provider>
  );
}
