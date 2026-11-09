import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarPlus,
  Check,
  Clapperboard,
  MapPin,
  Navigation,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { usePrefs } from "../lib/preferences";
import type { Language } from "../translations";
import { UserRole } from "../types";

interface Step {
  title: string;
  where: string;
  Icon: LucideIcon;
  text: string;
  tip: string;
}

const STEPS: Record<Language, Record<UserRole, Step[]>> = {
  it: {
    [UserRole.PRODUCER]: [
      {
        title: "La produzione, a colpo d’occhio",
        where: "Mappa e barra in alto",
        Icon: Clapperboard,
        text: "Questa è la mappa della tua produzione. Dalla barra in basso apri Mappa, Squadra, Set, Attività e Altro. Gli aggiornamenti arrivano in tempo reale.",
        tip: "Puoi saltare la guida e riaprirla quando vuoi con Tutorial.",
      },
      {
        title: "Aggiungi e invita i runner",
        where: "Squadra · Runner",
        Icon: Users,
        text: "Aggiungi un runner con il tasto +, poi crea il suo link d’invito e mandalo su WhatsApp. Aprendolo dal telefono, il runner entra nella sua squadra senza password.",
        tip: "Ogni link funziona una volta. Un nuovo link scollega il dispositivo precedente di quel runner.",
      },
      {
        title: "Assegna cast e troupe",
        where: "Squadra · Cast e Troupe",
        Icon: MapPin,
        text: "Aggiungi le persone da recuperare, cerca il punto di incontro e scegli il risultato corretto, poi assegnale a un runner. Puoi anche tenere premuto sulla mappa per scegliere il punto.",
        tip: "Tocca una persona per aprire la scheda, modificarla o consultarne i contatti.",
      },
      {
        title: "Prepara i set",
        where: "Set · Tasto + sulla mappa",
        Icon: Clapperboard,
        text: "Crea un set con nome, posizione, referente e note. I runner vedono le destinazioni e possono avviare le indicazioni stradali.",
        tip: "Dal tasto Set nella barra ritrovi tutte le destinazioni della produzione.",
      },
      {
        title: "Segui gli spostamenti",
        where: "Mappa · Bollini dei runner",
        Icon: Navigation,
        text: "Quando un runner condivide il GPS, la sua macchina con le iniziali scorre sulla mappa lasciando una scia del suo colore. Quando arriva a 250 m da una persona da recuperare ricevi un avviso. Senza aggiornamenti per 30 secondi la macchina si sbiadisce e mostra l’ora dell’ultima posizione.",
        tip: "Un bollino grigio non significa che il runner sia ancora lì.",
      },
      {
        title: "Recuperi, segnalazioni e giornate",
        where: "Attività · Impostazioni",
        Icon: CalendarPlus,
        text: "In Attività trovi recuperi, annullamenti e segnalazioni. Un recupero sbagliato si annulla dalla scheda della persona. A fine giornata, Nuova giornata in Impostazioni azzera i recuperi.",
        tip: "Da Impostazioni puoi anche cambiare password ed eliminare l’intera produzione.",
      },
    ],
    [UserRole.RUNNER]: [
      {
        title: "La tua giornata sul set",
        where: "Mappa e barra in alto",
        Icon: Users,
        text: "Qui trovi le persone che il produttore ti ha assegnato e i set da raggiungere. Dalla barra in basso apri Mappa, Squadra, Set, Attività e Altro.",
        tip: "La guida è sempre disponibile dal tasto Tutorial.",
      },
      {
        title: "Condividi la tua posizione",
        where: "Mappa · Condividi GPS",
        Icon: Navigation,
        text: "Premi Condividi GPS e consenti al browser di usare la posizione. Il produttore vede solo la tua ultima posizione, non il percorso. Premi Ferma GPS quando vuoi.",
        tip: "Tieni l’app aperta: con schermo bloccato o app in secondo piano il GPS non è garantito.",
      },
      {
        title: "Trova chi devi recuperare",
        where: "Squadra · Persone assegnate",
        Icon: MapPin,
        text: "In Squadra trovi cast e troupe affidati a te. Tocca una persona per chiamarla o aprire le indicazioni verso il punto di incontro.",
        tip: "Le posizioni di cast e troupe sono i punti di incontro indicati dal produttore.",
      },
      {
        title: "Conferma il recupero",
        where: "Avviso sulla mappa · Squadra",
        Icon: Check,
        text: "Quando sei vicino al punto di incontro compare “Hai recuperato…?”. Premi Sì solo quando la persona è con te. Puoi anche usare Conferma recupero in Squadra.",
        tip: "Se hai sbagliato, puoi annullare dalla scheda della persona entro 10 minuti.",
      },
      {
        title: "Avvisa la produzione",
        where: "Triangolo in alto a destra",
        Icon: Bell,
        text: "Usa il triangolo in alto a destra per segnalare traffico, un imprevisto o una pausa benzina. Da lì puoi anche chiamare il produttore o scrivergli su WhatsApp.",
        tip: "Apri Attività per consultare gli eventi della tua squadra.",
      },
      {
        title: "Sei pronto a partire",
        where: "Impostazioni",
        Icon: ShieldCheck,
        text: "In Impostazioni scegli lingua e tema della mappa, gestisci le notifiche ed esci dalla produzione. A fine servizio ferma la condivisione GPS.",
        tip: "Per rivedere la guida, premi Tutorial nella barra in alto.",
      },
    ],
  },
  en: {
    [UserRole.PRODUCER]: [
      {
        title: "Your production at a glance",
        where: "Map and top bar",
        Icon: Clapperboard,
        text: "This is your production’s map. From the bottom bar open Map, Team, Sets, Activity and More. Updates arrive in real time.",
        tip: "You can skip the guide and reopen it any time with Tutorial.",
      },
      {
        title: "Add and invite runners",
        where: "Team · Runners",
        Icon: Users,
        text: "Add a runner with the + button, then create their invite link and send it on WhatsApp. Opening it on their phone, the runner joins the team without a password.",
        tip: "Each link works once. A new link disconnects that runner’s previous device.",
      },
      {
        title: "Assign cast and crew",
        where: "Team · Cast and Crew",
        Icon: MapPin,
        text: "Add the people to pick up, search the meeting point and choose the correct result, then assign them to a runner. You can also long-press the map to choose the point.",
        tip: "Tap a person to open their card, edit it or see their contacts.",
      },
      {
        title: "Prepare the sets",
        where: "Sets · + button on the map",
        Icon: Clapperboard,
        text: "Create a set with name, position, contact person and notes. Runners see the destinations and can start turn-by-turn directions.",
        tip: "The Sets button in the bar lists all the production’s destinations.",
      },
      {
        title: "Follow the runners",
        where: "Map · Runner badges",
        Icon: Navigation,
        text: "When a runner shares GPS, their car with initials glides across the map, leaving a trail in their color. When they get within 250 m of someone to pick up, you get an alert. Without updates for 30 seconds the car fades and shows the time of the last position.",
        tip: "A grey badge doesn’t mean the runner is still there.",
      },
      {
        title: "Pickups, alerts and days",
        where: "Activity · Settings",
        Icon: CalendarPlus,
        text: "Activity lists pickups, undos and alerts. A wrong pickup can be undone from the person’s card. At the end of the day, New day in Settings resets pickups.",
        tip: "In Settings you can also change your password and delete the whole production.",
      },
    ],
    [UserRole.RUNNER]: [
      {
        title: "Your day on set",
        where: "Map and top bar",
        Icon: Users,
        text: "Here you find the people the producer assigned to you and the sets to reach. From the bottom bar open Map, Team, Sets, Activity and More.",
        tip: "The guide is always available from the Tutorial button.",
      },
      {
        title: "Share your position",
        where: "Map · Share GPS",
        Icon: Navigation,
        text: "Tap Share GPS and allow the browser to use your location. The producer sees only your latest position, not your route. Tap Stop GPS whenever you want.",
        tip: "Keep the app open: with the screen locked or the app in the background GPS is not guaranteed.",
      },
      {
        title: "Find who to pick up",
        where: "Team · Assigned people",
        Icon: MapPin,
        text: "Team lists the cast and crew assigned to you. Tap a person to call them or open directions to the meeting point.",
        tip: "Cast and crew positions are the meeting points set by the producer.",
      },
      {
        title: "Confirm the pickup",
        where: "Prompt on the map · Team",
        Icon: Check,
        text: "When you are near the meeting point, “Did you pick up…?” appears. Tap Yes only when the person is with you. You can also use Confirm pickup in Team.",
        tip: "If you made a mistake, you can undo from the person’s card within 10 minutes.",
      },
      {
        title: "Alert the production",
        where: "Triangle at the top right",
        Icon: Bell,
        text: "Use the triangle at the top right to report traffic, an incident or a fuel stop. From there you can also call the producer or message them on WhatsApp.",
        tip: "Open Activity to see your team’s events.",
      },
      {
        title: "Ready to go",
        where: "Settings",
        Icon: ShieldCheck,
        text: "In Settings choose language and map theme, manage notifications and leave the production. At the end of your shift, stop GPS sharing.",
        tip: "To see this guide again, tap Tutorial in the top bar.",
      },
    ],
  },
};

export default function Tutorial({ role }: { role: UserRole }) {
  const { t, language } = usePrefs();
  const steps = STEPS[language][role];
  const storageKey = `runset:tutorial:v2:${role}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== "seen";
    } catch {
      return true;
    }
  });
  const [index, setIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const step = steps[index];
  const Icon = step.Icon;
  const last = index === steps.length - 1;

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    return () => element.close();
  }, [open]);

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open, index]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "seen");
    } catch {
      // The guide remains usable when browser storage is unavailable.
    }
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setIndex(0);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        title={t("tutorial")}
        aria-label={t("tutorial")}
        className="pointer-events-auto flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] bg-white text-ink shadow-float"
      >
        <BookOpen size={20} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCancel={(event) => {
              event.preventDefault();
              dismiss();
            }}
            className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-line2 bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/50"
          >
            <div className="p-5 sm:p-7">
              <div className="mb-6 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-signal-text">
                  {t("tutorial")} · {role === UserRole.PRODUCER ? t("role_producer") : t("role_runner")}
                </p>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-lg px-3 py-2 text-sm text-ink2 hover:bg-ground hover:text-ink"
                >
                  {t("skip")}
                </button>
              </div>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-signal text-ink">
                <Icon size={28} aria-hidden="true" />
              </div>
              <p className="mb-2 text-xs text-muted">
                {index + 1} / {steps.length} · {step.where}
              </p>
              <h2 ref={heading} id={titleId} tabIndex={-1} className="mb-3 text-2xl font-bold tracking-tight outline-none">
                {step.title}
              </h2>
              <p id={descriptionId} className="text-sm leading-relaxed text-ink2">
                {step.text}
              </p>
              <p className="mt-5 rounded-xl border border-line bg-ground p-3 text-xs leading-relaxed text-muted">
                {step.tip}
              </p>
              <div className="my-6 flex gap-1.5" aria-hidden="true">
                {steps.map((item, number) => (
                  <span
                    key={item.title}
                    className={`h-1 flex-1 rounded-full ${number <= index ? "bg-signal" : "bg-ground"}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm text-ink2 hover:bg-ground disabled:invisible"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  {t("back")}
                </button>
                <button
                  type="button"
                  onClick={() => (last ? dismiss() : setIndex((value) => value + 1))}
                  className="flex items-center justify-center gap-2 rounded-xl bg-signal px-5 py-3 text-sm font-bold text-ink hover:bg-signal-hover"
                >
                  {last ? t("finish") : t("continue")}
                  {last ? <Check size={17} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
