import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Clapperboard,
  Copy,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Person, SetPoint, Location, UserRole } from "../types";
import { Snapshot } from "../services/protocol";
import { useLanguage } from "../App";
import MapLayer from "./MapLayer";
import SetBanner from "./SetBanner";
import PersonBanner from "./PersonBanner";
import InfoOverlay from "./InfoOverlay";
import RapidAlertMenu from "./RapidAlertMenu";
import Tutorial from "./Tutorial";
import { NotificationService } from "../services/NotificationService";
import { distanceMeters, pickupCandidates } from "../services/proximity";

type Mutation = (body: Record<string, unknown>) => Promise<Snapshot>;
interface Props {
  data: Snapshot;
  mutate: Mutation;
  onLogout: () => Promise<void>;
  sharing: boolean;
  onSharingChange: (v: boolean) => void;
  gpsStatus: string;
  online: boolean;
  error: string;
  now: number;
}
type Editor = {
  type: "SET" | "RUNNER" | "ACTOR" | "TROUPE";
  entity?: Person | SetPoint;
  location?: Location;
};
type Panel = "people" | "sets" | "activity" | "settings" | null;
const input =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm";

function ProductionSettings({
  data,
  mutate,
  onLogout,
}: {
  data: Snapshot;
  mutate: Mutation;
  onLogout: () => Promise<void>;
}) {
  const { mapTheme, setMapTheme } = useLanguage();
  const [info, setInfo] = useState(data.producerInfo);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate({ action: "saveProducer", producerInfo: info });
      setStatus("Contatti salvati.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-zinc-400 mb-2">CODICE PRODUZIONE</p>
        <p className="font-mono text-xl text-yellow-400 select-all break-all">
          {data.session.roomCode}
        </p>
        <p className="text-xs text-zinc-500 mt-2">
          Conservalo insieme alla password per accedere dagli altri dispositivi.
        </p>
      </div>
      {data.session.role === UserRole.PRODUCER && (
        <form onSubmit={save} className="space-y-3">
          <label className="block text-sm">
            Nome produttore
            <input
              className={input + " mt-2"}
              value={info.name}
              onChange={(e) => setInfo({ ...info, name: e.target.value })}
              required
              maxLength={120}
            />
          </label>
          <label className="block text-sm">
            Telefono produttore
            <input
              className={input + " mt-2"}
              type="tel"
              value={info.phone}
              onChange={(e) => setInfo({ ...info, phone: e.target.value })}
              maxLength={40}
            />
          </label>
          <button
            disabled={busy}
            className="bg-yellow-400 text-black p-3 rounded-xl font-semibold w-full"
          >
            {busy ? "Salvataggio…" : "Salva contatti"}
          </button>
        </form>
      )}
      <button
        onClick={() => setMapTheme(mapTheme === "dark" ? "light" : "dark")}
        className="w-full flex items-center gap-3 rounded-xl bg-zinc-800 p-3"
      >
        {mapTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}Mappa{" "}
        {mapTheme === "dark" ? "chiara" : "scura"}
      </button>
      <button
        onClick={async () =>
          setStatus(
            (await NotificationService.requestPermission())
              ? "Notifiche browser abilitate."
              : "Le notifiche restano disponibili nel pannello Attività.",
          )
        }
        className="w-full flex items-center gap-3 rounded-xl bg-zinc-800 p-3"
      >
        <Bell size={18} />
        Abilita notifiche browser
      </button>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Gli avvisi sono sempre salvati in Attività. Le notifiche del browser
        dipendono dal dispositivo e richiedono l’app aperta. Il GPS in una
        pagina web non è garantito con schermo bloccato o app in secondo piano.
      </p>
      {status && (
        <p role="status" className="text-sm text-yellow-200">
          {status}
        </p>
      )}
      <button
        onClick={() => void onLogout()}
        className="w-full flex items-center gap-3 rounded-xl border border-zinc-700 p-3 text-zinc-300"
      >
        <LogOut size={18} />
        Esci dalla produzione
      </button>
    </div>
  );
}

export default function MainLayout({
  data,
  mutate,
  onLogout,
  sharing,
  onSharingChange,
  gpsStatus,
  online,
  error,
  now,
}: Props) {
  const { mapTheme } = useLanguage();
  const { people, sets, session } = data;
  const producer = session.role === UserRole.PRODUCER;
  const [panel, setPanel] = useState<Panel>(() =>
    window.matchMedia("(min-width:768px)").matches ? "people" : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [point, setPoint] = useState<Location | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [invite, setInvite] = useState<{ name: string; code: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const lastNotice = useRef(0);
  const [notice, setNotice] = useState("");
  const active = people.find((p) => p.id === session.runnerId);
  const runners = people.filter((p) => p.category === "RUNNER");
  const selected =
    people.find((p) => p.id === selectedId) ??
    sets.find((s) => s.id === selectedId);
  const visible = useMemo(
    () =>
      filter
        ? people.filter((p) => p.id === filter || p.assignedRunnerId === filter)
        : people,
    [people, filter],
  );
  const candidates = sharing ? pickupCandidates(active, people, now) : [];
  const candidate = candidates.find((p) => !dismissed.has(p.id));
  useEffect(() => {
    if (!active) return;
    setDismissed((previous) => {
      const remaining = new Set(
        [...previous].filter((id) => {
          const p = people.find((x) => x.id === id);
          return (
            p &&
            !p.isRecovered &&
            distanceMeters(active.location, p.location) < 12
          );
        }),
      );
      return remaining.size === previous.size ? previous : remaining;
    });
  }, [active, people]);
  useEffect(() => {
    const latest = data.events.at(-1);
    if (!latest) return;
    if (lastNotice.current && latest.createdAt > lastNotice.current)
      setNotice(latest.message);
    lastNotice.current = latest.createdAt;
  }, [data.events]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);
  const toggle = (next: Panel) => setPanel(panel === next ? null : next);
  const close = () => {
    setSelectedId(null);
    setEditor(null);
    setPoint(null);
  };
  const add = (type: Editor["type"], location?: Location) => {
    setEditor({ type, location });
    setPoint(null);
    setSelectedId(null);
    setPanel(null);
  };
  const select = (entity: Person | SetPoint) => {
    setSelectedId(entity.id);
    setEditor(null);
    setPanel(null);
  };
  async function pickup(person: Person) {
    if (busy) return;
    setBusy(true);
    setLocalError("");
    try {
      await mutate({ action: "pickup", personId: person.id });
      setDismissed((s) => new Set(s).add(person.id));
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function makeInvite(runner: Person) {
    if (
      !window.confirm(
        `Creare un nuovo invito per ${runner.name}? Gli accessi precedenti di questo runner saranno revocati.`,
      )
    )
      return;
    setBusy(true);
    try {
      const next = await mutate({
        action: "createInvite",
        runnerId: runner.id,
      });
      setInvite({ name: runner.name, code: next.accessCode! });
      setCopied(false);
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const focus =
    selected &&
    (!("category" in selected) ||
      selected.category !== "RUNNER" ||
      selected.lastSeen)
      ? selected.location
      : undefined;
  return (
    <div className="h-[100dvh] flex flex-col bg-zinc-950 text-white">
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-950 z-30 px-2 sm:px-3 md:px-5 h-16 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Clapperboard
            className="hidden sm:block text-yellow-400 shrink-0"
            size={24}
          />
          <div className="min-w-0">
            <h1 className="font-black text-xl tracking-tight leading-5 truncate">
              RunSet<span className="text-yellow-400">.</span>
            </h1>
            <p className="text-[11px] text-zinc-400 truncate max-w-[130px] sm:max-w-xs">
              {session.roomName}
            </p>
          </div>
        </div>
        <nav
          className="flex shrink-0 items-center gap-1 sm:gap-1.5"
          aria-label="Menu produzione"
        >
          {(
            [
              { key: "people", Icon: Users, label: "Squadra" },
              { key: "sets", Icon: Clapperboard, label: "Set" },
              { key: "activity", Icon: Bell, label: "Attività" },
              { key: "settings", Icon: Settings, label: "Impostazioni" },
            ] as const
          ).map(({ key, Icon, label }) => (
            <button
              key={key}
              aria-label={label}
              title={label}
              onClick={() => toggle(key)}
              className={`p-2 sm:p-2.5 rounded-xl ${panel === key ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-300"}`}
            >
              <Icon size={19} />
            </button>
          ))}
          <Tutorial key={session.role} role={session.role} />
        </nav>
      </header>
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <MapLayer
            sets={sets}
            runners={visible.filter((p) => p.category === "RUNNER")}
            actors={visible.filter((p) => p.category === "ACTOR")}
            crew={visible.filter((p) => p.category === "TROUPE")}
            onEntityClick={select}
            onMapClick={(lat, lng) => {
              if (producer && !editor && !selected) setPoint({ lat, lng });
            }}
            onMapLongPress={(lat, lng) => {
              if (producer) {
                close();
                setPoint({ lat, lng });
              }
            }}
            forceCenter={focus}
            theme={mapTheme}
          />
        </div>
        <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-3 pointer-events-none">
          <div className="bg-zinc-950/95 border border-zinc-700 rounded-xl py-2 px-3 text-xs flex gap-2 items-center shadow-xl pointer-events-auto">
            {online ? (
              <Wifi size={15} className="text-emerald-400" />
            ) : (
              <WifiOff size={15} className="text-red-400" />
            )}
            {online
              ? "Connesso · aggiornamento ogni 3 s"
              : "Connessione interrotta"}
          </div>
          {producer && (
            <button
              aria-label="Aggiungi set"
              onClick={() => add("SET")}
              className="pointer-events-auto bg-yellow-400 text-black rounded-xl p-2.5 font-bold flex gap-1 items-center shadow-xl"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Set</span>
            </button>
          )}
        </div>
        {(error || localError) && (
          <div
            role="alert"
            className="absolute top-16 inset-x-3 z-[2100] text-sm text-red-100 bg-red-950 border border-red-800 rounded-xl p-3"
          >
            {localError || error}
            <button
              aria-label="Chiudi errore"
              className="float-right ml-2"
              onClick={() => setLocalError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && !panel && (
          <button
            onClick={() => {
              setPanel("activity");
              setNotice("");
            }}
            role="status"
            className="absolute top-16 left-3 right-3 md:left-auto md:w-96 z-20 bg-zinc-900 border border-yellow-400/50 rounded-xl p-4 text-left text-sm shadow-xl"
          >
            <Bell size={16} className="inline mr-2 text-yellow-400" />
            {notice}
          </button>
        )}
        {producer &&
          people.length === 0 &&
          sets.length === 0 &&
          !panel &&
          !editor &&
          !point && (
            <div className="absolute inset-x-6 top-24 max-w-sm mx-auto z-10 rounded-2xl bg-zinc-950/95 border border-zinc-700 p-5 shadow-2xl">
              <p className="font-bold text-lg mb-2">Prepariamo la giornata.</p>
              <p className="text-sm text-zinc-400 mb-4">
                Aggiungi i runner alla squadra, crea il set e assegna le persone
                da recuperare.
              </p>
              <button
                onClick={() => setPanel("people")}
                className="bg-yellow-400 text-black rounded-xl px-4 py-3 text-sm font-bold"
              >
                Aggiungi la squadra
              </button>
            </div>
          )}
        {candidate && !panel && !editor && (
          <section
            role="alertdialog"
            aria-label="Conferma recupero vicino"
            className="absolute top-20 inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[460px] z-[2200] rounded-2xl bg-zinc-900 border border-yellow-400 p-4 shadow-2xl"
          >
            <p className="text-xs text-yellow-400 font-bold mb-1">
              ENTRO 5 METRI · GPS ±{Math.round(active?.accuracy ?? 0)} m
            </p>
            <h2 className="font-bold text-lg">
              Hai recuperato {candidate.name}?
            </h2>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                disabled={busy}
                onClick={() =>
                  setDismissed((s) => new Set(s).add(candidate.id))
                }
                className="bg-zinc-700 rounded-xl p-3"
              >
                No
              </button>
              <button
                disabled={busy}
                onClick={() => void pickup(candidate)}
                className="bg-yellow-400 text-black rounded-xl p-3 font-bold"
              >
                {busy ? "Salvataggio…" : "Sì, recuperato"}
              </button>
            </div>
          </section>
        )}
        {!producer && active && !editor && !selected && (
          <div className="absolute bottom-7 left-3 right-3 md:max-w-md md:right-auto z-20 rounded-2xl border border-zinc-700 bg-zinc-950/95 shadow-2xl p-4">
            <div className="flex justify-between gap-3 items-center mb-3">
              <div>
                <p className="font-bold">{active.name}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {sharing ? gpsStatus : "Condivisione GPS disattivata"}
                </p>
              </div>
              <button
                onClick={() => onSharingChange(!sharing)}
                className={`rounded-xl px-4 py-3 text-sm font-bold ${sharing ? "bg-zinc-700" : "bg-yellow-400 text-black"}`}
              >
                {sharing ? "Ferma GPS" : "Condividi GPS"}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-zinc-400">
              {sharing
                ? "Tieni RunSet aperta durante il servizio. Il recupero automatico propone una conferma: non viene mai segnato da solo."
                : "Condividi la tua posizione con il produttore di questa produzione. Puoi fermarla in qualsiasi momento."}
            </p>
          </div>
        )}
        {!producer && active && (
          <RapidAlertMenu
            runnerName={active.name}
            producerPhone={data.producerInfo.phone}
            onSend={async (type) => {
              await mutate({ action: "alert", type });
            }}
          />
        )}
        {point && !editor && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-72 z-30 bg-zinc-950 border border-zinc-700 rounded-2xl shadow-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-bold">Aggiungi in questo punto</p>
              <button aria-label="Chiudi" onClick={() => setPoint(null)}>
                <X size={18} />
              </button>
            </div>
            {(["SET", "ACTOR", "TROUPE"] as const).map((type) => (
              <button
                key={type}
                onClick={() => add(type, point)}
                className="block text-left p-3 rounded-xl hover:bg-zinc-800 w-full text-sm"
              >
                {type === "SET"
                  ? "🎬 Set"
                  : type === "ACTOR"
                    ? "🎭 Attore / attrice"
                    : "👥 Membro troupe"}
              </button>
            ))}
          </div>
        )}
        {panel && (
          <>
            <button
              aria-label="Chiudi pannello"
              className="absolute inset-0 z-30 bg-black/30 md:bg-transparent"
              onClick={() => setPanel(null)}
            />
            <aside className="absolute top-0 bottom-0 left-0 w-full sm:w-[360px] z-40 bg-zinc-950 border-r border-zinc-800 flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                <h2 className="text-lg font-bold">
                  {panel === "people"
                    ? "Squadra"
                    : panel === "sets"
                      ? "Set di produzione"
                      : panel === "activity"
                        ? "Attività"
                        : "Impostazioni"}
                </h2>
                <button
                  aria-label="Chiudi pannello"
                  onClick={() => setPanel(null)}
                  className="p-2 rounded-lg bg-zinc-900"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 space-y-5">
                {panel === "people" && (
                  <>
                    {producer && (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {(["RUNNER", "ACTOR", "TROUPE"] as const).map(
                            (type) => (
                              <button
                                key={type}
                                onClick={() => add(type)}
                                className="bg-zinc-800 rounded-xl py-3 text-xs flex flex-col items-center gap-1"
                              >
                                <Plus size={16} />
                                {type === "RUNNER"
                                  ? "Runner"
                                  : type === "ACTOR"
                                    ? "Cast"
                                    : "Troupe"}
                              </button>
                            ),
                          )}
                        </div>
                        <label className="block text-xs text-zinc-400">
                          Filtra per runner
                          <select
                            aria-label="Filtra per runner"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className={input + " mt-2"}
                          >
                            <option value="">Tutta la squadra</option>
                            {runners.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                    {(["RUNNER", "ACTOR", "TROUPE"] as const).map(
                      (category) => {
                        const members = visible.filter(
                          (p) => p.category === category,
                        );
                        return (
                          <section key={category}>
                            <h3 className="text-xs text-zinc-500 tracking-widest uppercase mb-3">
                              {category === "RUNNER"
                                ? "Runner"
                                : category === "ACTOR"
                                  ? "Cast"
                                  : "Troupe"}{" "}
                              · {members.length}
                            </h3>
                            {members.length === 0 && (
                              <p className="text-sm text-zinc-500">
                                {producer
                                  ? "Nessun contatto aggiunto."
                                  : "Nessuna persona assegnata."}
                              </p>
                            )}
                            <div className="space-y-2">
                              {members.map((p) => (
                                <div
                                  key={p.id}
                                  className="border border-zinc-800 bg-zinc-900/60 rounded-xl p-3"
                                >
                                  <button
                                    onClick={() => select(p)}
                                    className="w-full text-left flex items-center gap-3"
                                  >
                                    <span
                                      className={`rounded-full w-9 h-9 flex items-center justify-center shrink-0 font-bold text-xs ${p.isRecovered ? "bg-zinc-600 text-zinc-300" : category === "RUNNER" ? "bg-blue-500" : category === "ACTOR" ? "bg-violet-500" : "bg-emerald-600"}`}
                                    >
                                      {p.isRecovered ? (
                                        <Check size={17} />
                                      ) : (
                                        p.initials
                                      )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block font-semibold text-sm truncate">
                                        {p.name}
                                      </span>
                                      <span className="block text-xs text-zinc-400 mt-1">
                                        {category === "RUNNER"
                                          ? p.isLive &&
                                            p.lastSeen &&
                                            now - p.lastSeen <= 30000
                                            ? "● GPS attivo"
                                            : p.lastSeen
                                              ? "Ultima posizione salvata"
                                              : "In attesa del GPS"
                                          : p.isRecovered
                                            ? "Recuperato"
                                            : (people.find(
                                                (r) =>
                                                  r.id === p.assignedRunnerId,
                                              )?.name ?? "Da assegnare")}
                                      </span>
                                    </span>
                                    <ChevronRight
                                      size={15}
                                      className="text-zinc-500"
                                    />
                                  </button>
                                  {producer && category === "RUNNER" && (
                                    <button
                                      disabled={busy}
                                      onClick={() => void makeInvite(p)}
                                      className="mt-3 text-xs text-yellow-400 border-t border-zinc-800 pt-2 w-full text-left"
                                    >
                                      Crea / rinnova invito personale
                                    </button>
                                  )}
                                  {!producer &&
                                    category !== "RUNNER" &&
                                    !p.isRecovered && (
                                      <button
                                        disabled={busy}
                                        onClick={() => void pickup(p)}
                                        className="mt-3 rounded-lg bg-yellow-400 text-black text-sm font-bold p-2 w-full"
                                      >
                                        Conferma recupero
                                      </button>
                                    )}
                                </div>
                              ))}
                            </div>
                          </section>
                        );
                      },
                    )}
                  </>
                )}
                {panel === "sets" && (
                  <>
                    {producer && (
                      <button
                        onClick={() => add("SET")}
                        className="bg-yellow-400 text-black w-full p-3 rounded-xl font-bold flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        Aggiungi set
                      </button>
                    )}
                    {sets.length === 0 && (
                      <p className="text-sm text-zinc-400">
                        I set salvati appariranno qui e sulla mappa.
                      </p>
                    )}
                    {sets.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => select(s)}
                        className="w-full text-left p-4 border border-zinc-800 rounded-xl bg-zinc-900"
                      >
                        <p className="font-bold mb-1">🎬 {s.name}</p>
                        <p className="text-xs text-zinc-400">
                          {s.address || "Posizione scelta sulla mappa"}
                        </p>
                      </button>
                    ))}
                  </>
                )}
                {panel === "activity" && (
                  <>
                    {data.events.length === 0 && (
                      <p className="text-sm text-zinc-400">
                        Qui troverai recuperi, nuovi set e segnalazioni dei
                        runner.
                      </p>
                    )}
                    {[...data.events].reverse().map((event) => (
                      <article
                        key={event.id}
                        className="border-l-2 border-yellow-400 pl-4 py-1"
                      >
                        <p className="text-sm mb-2">{event.message}</p>
                        <time className="text-xs text-zinc-500">
                          {new Date(event.createdAt).toLocaleString("it-IT")}
                        </time>
                      </article>
                    ))}
                  </>
                )}
                {panel === "settings" && (
                  <ProductionSettings
                    data={data}
                    mutate={mutate}
                    onLogout={onLogout}
                  />
                )}
              </div>
            </aside>
          </>
        )}
        {editor?.type === "SET" && (
          <SetBanner
            key={editor.entity?.id ?? "new-set"}
            initialSet={editor.entity as SetPoint | undefined}
            initialLocation={editor.location}
            onCancel={close}
            onSave={async (set) => {
              await mutate({ action: "saveSet", set });
              close();
            }}
          />
        )}
        {editor && editor.type !== "SET" && (
          <PersonBanner
            key={editor.entity?.id ?? editor.type}
            type={editor.type}
            initialPerson={editor.entity as Person | undefined}
            initialLocation={editor.location}
            runners={runners}
            onCancel={close}
            onSave={async (person) => {
              await mutate({ action: "savePerson", person });
              close();
              setPanel("people");
            }}
          />
        )}
        {selected && !editor && (
          <InfoOverlay
            entity={selected}
            role={session.role}
            onClose={close}
            onEdit={
              producer
                ? (entity) => {
                    setEditor({
                      type: "category" in entity ? entity.category : "SET",
                      entity,
                    });
                    setSelectedId(null);
                  }
                : undefined
            }
            onDelete={
              producer
                ? async (id) => {
                    await mutate({
                      action:
                        "category" in selected ? "deletePerson" : "deleteSet",
                      id,
                    });
                    close();
                  }
                : undefined
            }
          />
        )}
        {invite && (
          <div className="fixed inset-0 z-[4000] p-5 bg-black/75 flex items-center justify-center">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Invito runner"
              className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-4"
            >
              <div className="flex justify-between">
                <h2 className="text-xl font-bold">Invito per {invite.name}</h2>
                <button
                  aria-label="Chiudi invito"
                  onClick={() => setInvite(null)}
                >
                  <X size={22} />
                </button>
              </div>
              <p className="text-sm text-zinc-400">
                Condividi questi codici soltanto con questo runner. L’invito
                permette l’accesso alla sua squadra. Per revocarlo, creane uno
                nuovo.
              </p>
              <label className="block text-xs text-zinc-400">
                Produzione
                <input
                  readOnly
                  value={session.roomCode}
                  className={input + " mt-1 font-mono"}
                />
              </label>
              <label className="block text-xs text-zinc-400">
                Invito personale
                <input
                  readOnly
                  value={invite.code}
                  className={input + " mt-1 font-mono"}
                />
              </label>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `RunSet: ${window.location.origin}\nProduzione: ${session.roomCode}\nInvito personale: ${invite.code}`,
                    );
                    setCopied(true);
                  } catch {
                    setLocalError("Seleziona e copia i codici manualmente.");
                  }
                }}
                className="bg-yellow-400 text-black p-3 rounded-xl w-full font-bold flex justify-center gap-2"
              >
                <Copy size={18} />
                {copied ? "Copiato" : "Copia invito"}
              </button>
              <p className="text-xs text-zinc-500">
                Questo codice viene mostrato solo adesso. Se lo perdi, rinnova
                l’invito.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
