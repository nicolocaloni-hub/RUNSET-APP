import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  Clapperboard,
  MapPin,
  Navigation,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { UserRole } from "../types";

const producerSteps = [
  {
    title: "La produzione, a colpo d’occhio",
    where: "Mappa e barra in alto",
    Icon: Clapperboard,
    text: "Questa è la mappa della tua produzione. Dalla barra in alto apri Squadra, Set, Attività e Impostazioni. Vediamo insieme come preparare la giornata.",
    tip: "Puoi saltare la guida e riaprirla quando vuoi con Tutorial.",
  },
  {
    title: "Aggiungi e invita i runner",
    where: "Squadra · Runner",
    Icon: Users,
    text: "Apri Squadra e aggiungi un runner con il tasto +. Crea il suo invito personale e consegnagli entrambi i codici: produzione e invito. Dal suo telefono potrà accedere come Runner.",
    tip: "Un nuovo invito revoca gli accessi precedenti di quel runner. Copialo quando viene mostrato.",
  },
  {
    title: "Assegna cast e troupe",
    where: "Squadra · Cast e Troupe",
    Icon: MapPin,
    text: "Aggiungi le persone da recuperare, indica il punto di incontro e assegna ciascuna a un runner. Puoi inserire un indirizzo oppure scegliere il punto direttamente sulla mappa.",
    tip: "Tocca una persona per aprire la scheda, modificarla o consultarne i contatti.",
  },
  {
    title: "Prepara i set",
    where: "Set · Tasto + sulla mappa",
    Icon: Clapperboard,
    text: "Crea un set con nome, posizione, referente e telefono. Le schede si aprono sopra la mappa: i runner possono consultare la destinazione e avviare le indicazioni stradali.",
    tip: "Dal tasto Set nella barra ritrovi tutte le destinazioni della produzione.",
  },
  {
    title: "Segui gli spostamenti",
    where: "Mappa · Bollini dei runner",
    Icon: Navigation,
    text: "Quando un runner attiva Condividi GPS, la sua posizione si aggiorna sulla tua mappa. Tocca il suo bollino per controllare l’ultimo aggiornamento e la precisione del segnale.",
    tip: "“Ultima posizione salvata” indica un dato non live: non significa che il runner sia ancora lì.",
  },
  {
    title: "Controlla recuperi e segnalazioni",
    where: "Attività · Icona della campanella",
    Icon: Bell,
    text: "Quando il runner conferma un recupero, il bollino della persona diventa in bianco e nero. In Attività trovi chi è stato recuperato, da quale runner e le segnalazioni di traffico, imprevisti o benzina.",
    tip: "Gli eventi rimangono nel registro anche se non hai abilitato le notifiche del browser.",
  },
  {
    title: "Pronto per iniziare",
    where: "Impostazioni · Icona dell’ingranaggio",
    Icon: Settings,
    text: "Salva i tuoi contatti, scegli la mappa chiara o scura e, se vuoi, abilita le notifiche. Qui trovi anche il codice produzione e il tasto per uscire.",
    tip: "Conserva codice produzione e password. Per rivedere questi passaggi, premi Tutorial in alto.",
  },
];

const runnerSteps = [
  {
    title: "La tua giornata sul set",
    where: "Mappa e barra in alto",
    Icon: Users,
    text: "Qui trovi la tua posizione, le persone che il produttore ti ha assegnato e i set da raggiungere. Dalla barra in alto puoi aprire Squadra, Set, Attività e Impostazioni.",
    tip: "La guida è sempre disponibile dal tasto Tutorial.",
  },
  {
    title: "Condividi la tua posizione",
    where: "Mappa · Condividi GPS",
    Icon: Navigation,
    text: "Premi Condividi GPS e consenti al browser di usare la posizione. Il produttore potrà seguire i tuoi spostamenti. Premi Ferma GPS quando vuoi interrompere la condivisione.",
    tip: "Durante il servizio tieni l’app aperta. Con schermo bloccato o app in secondo piano il GPS non è garantito.",
  },
  {
    title: "Trova chi devi recuperare",
    where: "Squadra · Persone assegnate",
    Icon: MapPin,
    text: "Apri Squadra per vedere cast e troupe affidati a te. Tocca una persona o il suo bollino per consultarne i dettagli, chiamarla o aprire le indicazioni. Nel pannello Set trovi le destinazioni.",
    tip: "Le posizioni di cast e troupe sono i punti di incontro indicati dal produttore.",
  },
  {
    title: "Conferma il recupero",
    where: "Banner sulla mappa · Squadra",
    Icon: Check,
    text: "Entro circa 5 metri dal punto di incontro, con un GPS sufficientemente preciso, compare “Hai recuperato…?”. Premi Sì solo quando la persona è con te, oppure No. Puoi anche usare Conferma recupero in Squadra.",
    tip: "La conferma avvisa il produttore e rende il bollino in bianco e nero su entrambe le mappe.",
  },
  {
    title: "Avvisa la produzione",
    where: "Mappa · Tasto giallo delle segnalazioni",
    Icon: Bell,
    text: "Usa il tasto con il triangolo per segnalare traffico, un imprevisto o una pausa benzina. Il produttore riceve l’avviso nel registro Attività. Trovi anche i contatti della produzione, se disponibili.",
    tip: "Apri Attività dalla campanella per consultare gli eventi della tua squadra.",
  },
  {
    title: "Sei pronto a partire",
    where: "Impostazioni · Tutorial",
    Icon: ShieldCheck,
    text: "In Impostazioni scegli il tema della mappa, gestisci le notifiche ed esci dalla produzione. Alla fine del servizio interrompi la condivisione GPS.",
    tip: "Per rivedere la guida, premi Tutorial nella barra in alto.",
  },
];

export default function Tutorial({ role }: { role: UserRole }) {
  const producer = role === UserRole.PRODUCER;
  const steps = producer ? producerSteps : runnerSteps;
  const storageKey = `runset:tutorial:v1:${role}`;
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
        title="Tutorial"
        className="flex items-center gap-1.5 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-yellow-300"
      >
        <BookOpen size={17} className="hidden sm:block" aria-hidden="true" />
        Tutorial
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
            className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-950 p-0 text-white shadow-2xl backdrop:bg-black/70"
          >
            <div className="p-5 sm:p-7">
              <div className="mb-6 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold tracking-wide text-yellow-300">
                  TUTORIAL {producer ? "PRODUTTORE" : "RUNNER"}
                </p>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
                >
                  Salta
                </button>
              </div>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-black">
                <Icon size={28} aria-hidden="true" />
              </div>
              <p className="mb-2 text-xs text-zinc-400">
                Passaggio {index + 1} di {steps.length} · {step.where}
              </p>
              <h2
                ref={heading}
                id={titleId}
                tabIndex={-1}
                className="mb-3 text-2xl font-bold tracking-tight outline-none"
              >
                {step.title}
              </h2>
              <p
                id={descriptionId}
                className="text-sm leading-relaxed text-zinc-300"
              >
                {step.text}
              </p>
              <p className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-400">
                {step.tip}
              </p>
              <div className="my-6 flex gap-1.5" aria-hidden="true">
                {steps.map((item, number) => (
                  <span
                    key={item.title}
                    className={`h-1 flex-1 rounded-full ${number <= index ? "bg-yellow-400" : "bg-zinc-800"}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm text-zinc-300 hover:bg-zinc-800 disabled:invisible"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Indietro
                </button>
                <button
                  type="button"
                  onClick={() =>
                    last ? dismiss() : setIndex((value) => value + 1)
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-300"
                >
                  {last ? "Fine" : "Continua"}
                  {last ? (
                    <Check size={17} aria-hidden="true" />
                  ) : (
                    <ArrowRight size={17} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
