import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Clapperboard, Map as MapIcon, MoreHorizontal, Plus, Users, X } from "lucide-react";
import { useProduction } from "../hooks/useProduction";
import { useRunnerGps } from "../hooks/useRunnerGps";
import { eventText } from "../lib/events";
import { usePrefs } from "../lib/preferences";
import { runnerColors } from "../lib/runners";
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
import ImportCsv from "./ImportCsv";
import InfoOverlay from "./InfoOverlay";
import InviteDialog from "./InviteDialog";
import MapLayer from "./MapLayer";
import PeoplePanel from "./PeoplePanel";
import PersonBanner from "./PersonBanner";
import PickupPrompt from "./PickupPrompt";
import ProducerSummary from "./ProducerSummary";
import DaySummary from "./DaySummary";
import Logo from "./Logo";
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

// Pickups confirmed without signal wait on this device and are sent when the network is back.
const queueKey = (productionId: string) => `runset:pickup-queue:${productionId}`;
function readQueue(productionId: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(queueKey(productionId)) ?? "[]");
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
function writeQueue(productionId: string, ids: string[]) {
  try {
    if (ids.length) localStorage.setItem(queueKey(productionId), JSON.stringify(ids));
    else localStorage.removeItem(queueKey(productionId));
  } catch {
    /* Storage blocked: the pickup stays only in memory for this session. */
  }
}

export function CenteredMessage({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center gap-5 bg-ground p-6 text-center">
      <p className="max-w-sm text-ink2" role="status">
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
  const { t, tError } = usePrefs();
  const { people, sets, session } = data;
  const producer = session.role === UserRole.PRODUCER;
  const productionId = session.productionId;
  const [now, setNow] = useState(serverNow);
  const [panel, setPanel] = useState<Panel>(null);
  const [adding, setAdding] = useState(false);
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
  const colors = useMemo(() => runnerColors(people), [people]);
  const assigned = people.filter((p) => p.category !== "RUNNER" && p.assignedRunnerId === session.runnerId);
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
    for (const event of fresh) seen.current.add(event.id);
    // "Arriving" alerts are for the producer; the runner already knows where they are.
    const shown = fresh.filter((e) => producer || (e.type !== "ARRIVING" && e.type !== "LATE"));
    for (const event of shown) {
      const title =
        event.type === "PICKUP" ? t("notify_pickup_title") : event.type === "ARRIVING"
            ? t("notify_arriving_title")
            : event.type === "LATE"
              ? t("notify_late_title")
              : "RunSet";
      NotificationService.show(title, eventText(event, t), event.id);
    }
    if (shown.length) setNotice(eventText(shown[shown.length - 1], t));
  }, [data.events, t, producer]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  const close = () => {
    setSelectedId(null);
    setEditor(null);
    setPoint(null);
    setAdding(false);
  };
  const add = (type: Editor["type"], location?: Location) => {
    setEditor({ type, location });
    setPoint(null);
    setAdding(false);
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
      try {
        await run(() => actions.confirmPickup(person.id));
      } catch (cause) {
        if (errorCode(cause) !== "network") throw cause;
        writeQueue(productionId, [...new Set([...readQueue(productionId), person.id])]);
        setNotice(t("offline_queued", { name: person.name }));
      }
      setDismissed((s) => new Set(s).add(person.id));
    });

  // Send queued pickups when the connection returns (confirm_pickup is idempotent).
  useEffect(() => {
    if (producer) return;
    let sending = false;
    const flush = async () => {
      const queued = readQueue(productionId);
      if (sending || queued.length === 0 || !navigator.onLine) return;
      sending = true;
      const left: string[] = [];
      for (const id of queued) {
        try {
          await actions.confirmPickup(id);
        } catch (cause) {
          if (errorCode(cause) === "network") left.push(id);
        }
      }
      writeQueue(productionId, left);
      sending = false;
      if (left.length < queued.length) {
        setNotice(t("offline_sent"));
        void run(async () => undefined);
      }
    };
    void flush();
    window.addEventListener("online", flush);
    const timer = setInterval(flush, 20_000);
    return () => {
      window.removeEventListener("online", flush);
      clearInterval(timer);
    };
  }, [producer, productionId, run, t]);
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
  const tabs = [
    { key: null, Icon: MapIcon, label: t("nav_map") },
    { key: "people", Icon: Users, label: t("nav_people") },
    { key: "sets", Icon: Clapperboard, label: t("nav_sets") },
    { key: "activity", Icon: Bell, label: t("nav_activity") },
    { key: "settings", Icon: MoreHorizontal, label: t("nav_more") },
  ] as const;
  const panelTitle = {
    people: t("nav_people"),
    sets: t("sets_title"),
    activity: t("nav_activity"),
    settings: t("nav_settings"),
  };
  const errorText = localError || (loadError ? tError(loadError) : "");
  const onMap = !panel && !editor && !selected && !point && !adding;
  const day = t("day_label", { day: session.dayNumber });

  return (
    <div className="flex h-[100dvh] flex-col bg-ground text-ink">
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
            controlsClassName="top-[84px]"
          />
        </div>

        <div className="pt-safe pointer-events-none absolute inset-x-3 top-3 z-30 flex items-center gap-2.5 sm:inset-x-4 sm:top-4">
          <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2.5 rounded-[18px] bg-white px-3.5 py-2.5 shadow-float">
            <Logo className="h-8 w-auto shrink-0 text-ink" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-[15px] font-bold leading-5">
                {producer ? session.productionName : `${active?.name ?? ""} · ${t("role_runner")}`}
              </h1>
              <p className="flex items-center gap-1.5 truncate font-mono text-[11px] text-muted" role="status">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-live" : "bg-red-500"}`}
                />
                <span className="truncate">
                  {!connected
                    ? t("status_offline")
                    : producer
                      ? t("live_sub", { day })
                      : `${session.productionName} · ${day}`}
                </span>
              </p>
            </div>
          </div>
          {!producer && active && (
            <RapidAlertMenu
              runnerName={active.name}
              producerPhone={data.producerInfo.phone}
              onSend={(type) => run(() => actions.sendAlert(productionId, type))}
            />
          )}
          <Tutorial key={session.role} role={session.role} />
          {producer && (
            <button
              type="button"
              aria-label={t("add_menu")}
              title={t("add_menu")}
              onClick={() => {
                close();
                setPanel(null);
                setAdding(true);
              }}
              className="pointer-events-auto flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-float"
            >
              <Plus size={24} />
            </button>
          )}
        </div>

        {errorText && (
          <div
            role="alert"
            className="absolute inset-x-3 top-[84px] z-[2100] flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 shadow-float sm:inset-x-4 md:left-auto md:w-96"
          >
            <span className="flex-1">{errorText}</span>
            <button type="button" aria-label={t("close")} onClick={() => setLocalError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && !panel && !errorText && (
          <button
            type="button"
            onClick={() => {
              setPanel("activity");
              setNotice("");
            }}
            role="status"
            className="absolute inset-x-3 top-[84px] z-20 flex items-center gap-3 rounded-2xl bg-ink p-3.5 text-left text-sm font-medium text-white shadow-float sm:inset-x-4 md:left-auto md:right-20 md:w-96"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal text-ink">
              <Bell size={16} />
            </span>
            {notice}
          </button>
        )}
        {producer && people.length === 0 && sets.length === 0 && onMap && (
          <div className="absolute inset-x-4 top-[92px] z-10 mx-auto max-w-sm rounded-[22px] bg-white p-5 shadow-float">
            <p className="mb-2 font-display text-lg font-bold">{t("empty_title")}</p>
            <p className="mb-4 text-sm text-muted">{t("empty_text")}</p>
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
        {producer && onMap && people.length > 0 && (
          <ProducerSummary people={people} now={now} colors={colors} onSelect={select} />
        )}
        {!producer && active && onMap && (
          <RunnerDock sharing={sharing} status={gps.status} onToggle={toggleSharing} assigned={assigned} onSelect={select} />
        )}
        {(point || adding) && !editor && (
          <div className="absolute left-1/2 top-[84px] z-30 w-72 -translate-x-1/2 rounded-[22px] bg-white p-3 shadow-[0_14px_36px_rgba(13,27,42,0.28)]">
            <div className="mb-1 flex items-center justify-between px-2 pt-1">
              <p className="font-display text-sm font-bold">{point ? t("add_here") : t("add_menu")}</p>
              <button
                type="button"
                aria-label={t("close")}
                onClick={() => {
                  setPoint(null);
                  setAdding(false);
                }}
                className="rounded-lg p-1.5 hover:bg-ground"
              >
                <X size={18} />
              </button>
            </div>
            {(["SET", "ACTOR", "TROUPE", ...(point ? [] : (["RUNNER"] as const))] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => add(type, point ?? undefined)}
                className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-sm font-medium hover:bg-ground"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${
                    type === "SET" ? "rounded-lg bg-ink" : type === "ACTOR" ? "bg-cast" : type === "TROUPE" ? "bg-crew" : "bg-signal"
                  }`}
                >
                  {type === "SET" ? <Clapperboard size={16} /> : <Plus size={16} />}
                </span>
                {type === "SET" ? t("type_set") : t(`cat_${type}`)}
              </button>
            ))}
          </div>
        )}
        {panel && (
          <>
            <button
              type="button"
              aria-label={t("close")}
              className="absolute inset-0 z-30 bg-ink/30 md:bg-transparent"
              onClick={() => setPanel(null)}
            />
            <aside className="absolute inset-x-0 bottom-0 top-16 z-40 flex flex-col rounded-t-[26px] bg-white shadow-sheet md:inset-y-3 md:left-3 md:right-auto md:w-[400px] md:rounded-[26px]">
              <span aria-hidden="true" className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-line2 md:hidden" />
              <div className="flex items-center justify-between px-5 pb-2 pt-3">
                <h2 className="font-display text-2xl font-bold">{panelTitle[panel]}</h2>
                <button
                  type="button"
                  aria-label={t("close")}
                  onClick={() => setPanel(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-ground"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-2">
                {panel === "people" && (
                  <PeoplePanel
                    people={people}
                    producer={producer}
                    now={now}
                    filter={filter}
                    onFilter={setFilter}
                    busy={busy}
                    colors={colors}
                    onAdd={(category) => add(category)}
                    onSelect={select}
                    onInvite={makeInvite}
                    onPickup={(person) => void pickup(person)}
                  />
                )}
                {panel === "people" && producer && <ImportCsv productionId={productionId} people={people} run={run} />}
                {panel === "sets" && <SetsPanel sets={sets} producer={producer} onAdd={() => add("SET")} onSelect={select} />}
                {panel === "activity" && producer && (
                  <DaySummary
                    people={people}
                    dayNumber={session.dayNumber}
                    productionName={session.productionName}
                    colors={colors}
                  />
                )}
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
      <nav aria-label={t("menu_label")} className="pb-safe z-30 flex shrink-0 border-t border-line bg-white">
        {tabs.map(({ key, Icon, label }) => {
          const current = panel === key;
          return (
            <button
              key={label}
              type="button"
              aria-current={current ? "page" : undefined}
              onClick={() => setPanel(key)}
              className={`flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                current ? "text-ink" : "text-muted"
              }`}
            >
              <Icon size={22} className={current ? "text-signal-dark" : ""} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
