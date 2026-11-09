import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Clapperboard, Plus, Settings, Users, Wifi, WifiOff, X } from "lucide-react";
import { useProduction } from "../hooks/useProduction";
import { useRunnerGps } from "../hooks/useRunnerGps";
import { eventText } from "../lib/events";
import { usePrefs } from "../lib/preferences";
import { NotificationService } from "../services/NotificationService";
import type { Snapshot } from "../services/protocol";
import {
  distanceMeters,
  PICKUP_DISMISS_RESET_METERS,
  pickupCandidates,
} from "../services/proximity";
import { actions, errorCode, type Membership, serverNow } from "../services/store";
import { Category, Location, Person, SetPoint, UserRole } from "../types";
import ActivityPanel from "./ActivityPanel";
import InfoOverlay from "./InfoOverlay";
import InviteDialog from "./InviteDialog";
import MapLayer from "./MapLayer";
import PeoplePanel from "./PeoplePanel";
import PersonBanner from "./PersonBanner";
import PickupPrompt from "./PickupPrompt";
import RapidAlertMenu from "./RapidAlertMenu";
import RunnerDock from "./RunnerDock";
import SetBanner from "./SetBanner";
import SetsPanel from "./SetsPanel";
import SettingsPanel from "./SettingsPanel";
import Tutorial from "./Tutorial";
import { primaryButton, secondaryButton } from "./ui";

type Editor = { type: "SET" | Category; entity?: Person | SetPoint; location?: Location };
type Panel = "people" | "sets" | "activity" | "settings" | null;
const GPS_CONSENT_KEY = "runset:gps-consent:v1";

export function CenteredMessage({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-zinc-950 p-6 text-center">
      <p className="max-w-sm text-zinc-200" role="status">
        {text}
      </p>
      {children}
    </main>
  );
}

export default function MainLayout({
  membership,
  onLogout,
  onSwitch,
}: {
  membership: Membership;
  onLogout: () => Promise<void>;
  onSwitch?: () => void;
}) {
  const { t, tError } = usePrefs();
  const production = useProduction(membership);
  if (production.status === "loading") return <CenteredMessage text={t("loading")} />;
  if (production.status === "revoked")
    return (
      <CenteredMessage text={t("access_revoked")}>
        {onSwitch && (
          <button type="button" onClick={onSwitch} className={primaryButton}>
            {t("switch_production")}
          </button>
        )}
        <button type="button" onClick={() => void onLogout()} className={secondaryButton}>
          {t("sign_out")}
        </button>
      </CenteredMessage>
    );
  if (!production.snapshot)
    return (
      <CenteredMessage text={tError(production.error)}>
        <button type="button" onClick={() => void production.reload()} className={primaryButton}>
          {t("retry")}
        </button>
      </CenteredMessage>
    );
  return (
    <Workspace
      data={production.snapshot}
      connected={production.connected}
      loadError={production.error}
      run={production.run}
      onLogout={onLogout}
      onSwitch={onSwitch}
    />
  );
}

function Workspace({
  data,
  connected,
  loadError,
  run,
  onLogout,
  onSwitch,
}: {
  data: Snapshot;
  connected: boolean;
  loadError: string;
  run: <T>(write: () => Promise<T>) => Promise<T>;
  onLogout: () => Promise<void>;
  onSwitch?: () => void;
}) {
  const { t, tError, mapTheme } = usePrefs();
  const { people, sets, session } = data;
  const producer = session.role === UserRole.PRODUCER;
  const productionId = session.productionId;
  const [now, setNow] = useState(serverNow);
  const [panel, setPanel] = useState<Panel>(() => (window.matchMedia("(min-width:768px)").matches ? "people" : null));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [point, setPoint] = useState<Location | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const [notice, setNotice] = useState("");
  const [invite, setInvite] = useState<{ name: string; token: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const gps = useRunnerGps(productionId, sharing && !producer, () => setSharing(false));

  useEffect(() => {
    const tick = setInterval(() => setNow(serverNow()), 3000);
    return () => clearInterval(tick);
  }, []);

  const active = people.find((p) => p.id === session.runnerId);
  const runners = people.filter((p) => p.category === "RUNNER");
  const selected = people.find((p) => p.id === selectedId) ?? sets.find((s) => s.id === selectedId);
  const visible = useMemo(
    () => (filter ? people.filter((p) => p.id === filter || p.assignedRunnerId === filter) : people),
    [people, filter],
  );
  const candidates = sharing ? pickupCandidates(gps.fix, session.runnerId, people, Date.now()) : [];
  const candidate = candidates.find((p) => !dismissed.has(p.id));

  // A dismissed suggestion comes back once the runner has moved away and returned.
  useEffect(() => {
    if (!gps.fix || dismissed.size === 0) return;
    const remaining = new Set(
      [...dismissed].filter((id) => {
        const person = people.find((p) => p.id === id);
        return person && !person.isRecovered && distanceMeters(gps.fix!.location, person.location) < PICKUP_DISMISS_RESET_METERS;
      }),
    );
    if (remaining.size !== dismissed.size) setDismissed(remaining);
  }, [gps.fix, people, dismissed]);

  // Notify about events that arrive after the first load.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(data.events.map((e) => e.id));
      return;
    }
    const fresh = data.events.filter((e) => !seen.current!.has(e.id));
    for (const event of fresh) {
      seen.current.add(event.id);
      NotificationService.show(event.type === "PICKUP" ? t("notify_pickup_title") : "RunSet", eventText(event, t), event.id);
    }
    if (fresh.length) setNotice(eventText(fresh[fresh.length - 1], t));
  }, [data.events, t]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

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
  async function attempt(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setLocalError("");
    try {
      await action();
    } catch (cause) {
      setLocalError(tError(errorCode(cause)));
    } finally {
      setBusy(false);
    }
  }
  const pickup = (person: Person) =>
    attempt(async () => {
      await run(() => actions.confirmPickup(person.id));
      setDismissed((s) => new Set(s).add(person.id));
    });
  const makeInvite = (runner: Person) => {
    if (!window.confirm(t("invite_confirm", { name: runner.name }))) return;
    void attempt(async () => {
      const token = await run(() => actions.createInvite(runner.id));
      setInvite({ name: runner.name, token });
    });
  };
  const toggleSharing = () => {
    if (sharing) return setSharing(false);
    let agreed = false;
    try {
      agreed = localStorage.getItem(GPS_CONSENT_KEY) === "yes";
    } catch {
      /* Storage blocked: ask every time. */
    }
    if (!agreed && !window.confirm(t("gps_consent"))) return;
    try {
      localStorage.setItem(GPS_CONSENT_KEY, "yes");
    } catch {
      /* Storage blocked: ask again next time. */
    }
    setSharing(true);
  };

  const focus =
    selected && (!("category" in selected) || selected.category !== "RUNNER" || selected.lastSeen)
      ? selected.location
      : undefined;
  const nav = [
    { key: "people", Icon: Users, label: t("nav_people") },
    { key: "sets", Icon: Clapperboard, label: t("nav_sets") },
    { key: "activity", Icon: Bell, label: t("nav_activity") },
    { key: "settings", Icon: Settings, label: t("nav_settings") },
  ] as const;
  const panelTitle = {
    people: t("nav_people"),
    sets: t("sets_title"),
    activity: t("nav_activity"),
    settings: t("nav_settings"),
  };
  const errorText = localError || (loadError ? tError(loadError) : "");

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950 px-2 sm:gap-3 sm:px-3 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Clapperboard className="hidden shrink-0 text-yellow-400 sm:block" size={24} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black leading-5 tracking-tight">
              RunSet<span className="text-yellow-400">.</span>
            </h1>
            <p className="max-w-[130px] truncate text-[11px] text-zinc-400 sm:max-w-xs">
              {session.productionName} · {t("day_label", { day: session.dayNumber })}
            </p>
          </div>
        </div>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-1.5" aria-label={t("menu_label")}>
          {nav.map(({ key, Icon, label }) => (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={panel === key}
              title={label}
              onClick={() => setPanel(panel === key ? null : key)}
              className={`rounded-xl p-2 sm:p-2.5 ${panel === key ? "bg-yellow-400 text-black" : "bg-zinc-900 text-zinc-300"}`}
            >
              <Icon size={19} />
            </button>
          ))}
          <Tutorial key={session.role} role={session.role} />
        </nav>
      </header>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <MapLayer
            sets={sets}
            people={visible}
            now={now}
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
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs shadow-xl">
            {connected ? <Wifi size={15} className="text-emerald-400" /> : <WifiOff size={15} className="text-red-400" />}
            {connected ? t("status_live") : t("status_offline")}
          </div>
          {producer && (
            <button
              type="button"
              aria-label={t("add_set")}
              onClick={() => add("SET")}
              className="pointer-events-auto flex items-center gap-1 rounded-xl bg-yellow-400 p-2.5 font-bold text-black shadow-xl"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">{t("type_set")}</span>
            </button>
          )}
        </div>
        {errorText && (
          <div
            role="alert"
            className="absolute inset-x-3 top-16 z-[2100] rounded-xl border border-red-800 bg-red-950 p-3 text-sm text-red-100"
          >
            {errorText}
            <button type="button" aria-label={t("close")} className="float-right ml-2" onClick={() => setLocalError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && !panel && (
          <button
            type="button"
            onClick={() => {
              setPanel("activity");
              setNotice("");
            }}
            role="status"
            className="absolute left-3 right-3 top-16 z-20 rounded-xl border border-yellow-400/50 bg-zinc-900 p-4 text-left text-sm shadow-xl md:left-auto md:w-96"
          >
            <Bell size={16} className="mr-2 inline text-yellow-400" />
            {notice}
          </button>
        )}
        {producer && people.length === 0 && sets.length === 0 && !panel && !editor && !point && (
          <div className="absolute inset-x-6 top-24 z-10 mx-auto max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950/95 p-5 shadow-2xl">
            <p className="mb-2 text-lg font-bold">{t("empty_title")}</p>
            <p className="mb-4 text-sm text-zinc-400">{t("empty_text")}</p>
            <button type="button" onClick={() => setPanel("people")} className={primaryButton}>
              {t("empty_cta")}
            </button>
          </div>
        )}
        {candidate && gps.fix && !panel && !editor && (
          <PickupPrompt
            person={candidate}
            distance={distanceMeters(gps.fix.location, candidate.location)}
            accuracy={gps.fix.accuracy}
            busy={busy}
            onNo={() => setDismissed((s) => new Set(s).add(candidate.id))}
            onYes={() => void pickup(candidate)}
          />
        )}
        {!producer && active && !editor && !selected && (
          <RunnerDock name={active.name} sharing={sharing} status={gps.status} onToggle={toggleSharing} />
        )}
        {!producer && active && (
          <RapidAlertMenu
            runnerName={active.name}
            producerPhone={data.producerInfo.phone}
            onSend={(type) => run(() => actions.sendAlert(productionId, type))}
          />
        )}
        {point && !editor && (
          <div className="absolute left-1/2 top-20 z-30 w-72 -translate-x-1/2 rounded-2xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">{t("add_here")}</p>
              <button type="button" aria-label={t("close")} onClick={() => setPoint(null)}>
                <X size={18} />
              </button>
            </div>
            {(["SET", "ACTOR", "TROUPE"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => add(type, point)}
                className="block w-full rounded-xl p-3 text-left text-sm hover:bg-zinc-800"
              >
                {type === "SET" ? `🎬 ${t("type_set")}` : type === "ACTOR" ? `🎭 ${t("type_actor")}` : `👥 ${t("type_troupe")}`}
              </button>
            ))}
          </div>
        )}
        {panel && (
          <>
            <button
              type="button"
              aria-label={t("close")}
              className="absolute inset-0 z-30 bg-black/30 md:bg-transparent"
              onClick={() => setPanel(null)}
            />
            <aside className="absolute bottom-0 left-0 top-0 z-40 flex w-full flex-col border-r border-zinc-800 bg-zinc-950 shadow-2xl sm:w-[360px]">
              <div className="flex items-center justify-between border-b border-zinc-800 p-5">
                <h2 className="text-lg font-bold">{panelTitle[panel]}</h2>
                <button type="button" aria-label={t("close")} onClick={() => setPanel(null)} className="rounded-lg bg-zinc-900 p-2">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {panel === "people" && (
                  <PeoplePanel
                    people={people}
                    producer={producer}
                    now={now}
                    filter={filter}
                    onFilter={setFilter}
                    busy={busy}
                    onAdd={(category) => add(category)}
                    onSelect={select}
                    onInvite={makeInvite}
                    onPickup={(person) => void pickup(person)}
                  />
                )}
                {panel === "sets" && <SetsPanel sets={sets} producer={producer} onAdd={() => add("SET")} onSelect={select} />}
                {panel === "activity" && <ActivityPanel events={data.events} />}
                {panel === "settings" && (
                  <SettingsPanel data={data} run={run} onLogout={onLogout} onSwitch={onSwitch} />
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
            onSave={async (set, isNew) => {
              await run(() => actions.saveSet(productionId, set, isNew));
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
            onSave={async (person, isNew) => {
              await run(() => actions.savePerson(productionId, person, isNew));
              close();
              setPanel("people");
            }}
          />
        )}
        {selected && !editor && (
          <InfoOverlay
            entity={selected}
            isProducer={producer}
            runnerId={session.runnerId}
            now={now}
            onClose={close}
            onEdit={
              producer
                ? (entity) => {
                    setEditor({ type: "category" in entity ? entity.category : "SET", entity });
                    setSelectedId(null);
                  }
                : undefined
            }
            onDelete={
              producer
                ? async (entity) => {
                    await run(() => ("category" in entity ? actions.deletePerson(entity.id) : actions.deleteSet(entity.id)));
                    close();
                  }
                : undefined
            }
            onUndo={(person) => run(() => actions.undoPickup(person.id))}
          />
        )}
        {invite && (
          <InviteDialog
            name={invite.name}
            token={invite.token}
            productionName={session.productionName}
            onClose={() => setInvite(null)}
          />
        )}
      </div>
    </div>
  );
}
