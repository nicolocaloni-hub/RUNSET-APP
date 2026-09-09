import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { AlertType } from "../services/NotificationService";
export default function RapidAlertMenu({
  runnerName,
  producerPhone,
  onSend,
}: {
  runnerName: string;
  producerPhone?: string;
  onSend: (type: AlertType) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function send(type: AlertType) {
    setBusy(true);
    try {
      await onSend(type);
      setFeedback("Segnalazione inviata al produttore.");
    } catch (e) {
      setFeedback((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="absolute right-3 top-16 z-20 flex flex-col items-end gap-2">
      <button
        title={`Segnalazioni di ${runnerName}`}
        aria-label="Segnala un imprevisto"
        onClick={() => setOpen(!open)}
        className="rounded-full p-3 bg-yellow-400 text-black shadow-xl"
      >
        {open ? <X size={22} /> : <AlertTriangle size={22} />}
      </button>
      {open && (
        <div className="w-64 bg-zinc-950 border border-zinc-700 rounded-2xl p-3 shadow-xl space-y-2">
          {(["TRAFFICO", "IMPREVISTO", "PAUSA BENZINA"] as AlertType[]).map(
            (type, i) => (
              <button
                disabled={busy}
                key={type}
                onClick={() => void send(type)}
                className="bg-zinc-800 rounded-xl p-3 w-full text-left text-sm disabled:opacity-50"
              >
                {["🚦", "❗", "⛽"][i]} {type}
              </button>
            ),
          )}
          {producerPhone && (
            <a
              className="block rounded-xl p-3 text-yellow-400 text-sm"
              href={`tel:${producerPhone.replace(/[^+\d]/g, "")}`}
            >
              Chiama il produttore
            </a>
          )}
          {feedback && (
            <p role="status" className="text-xs text-zinc-300 p-2">
              {feedback}
            </p>
          )}
          {producerPhone && (
            <a className="block rounded-xl p-3 text-yellow-400 text-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${producerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Ciao, sono ${runnerName}. Ho un imprevisto durante il servizio.`)}`}>
              Apri WhatsApp con il produttore
            </a>
          )}
        </div>
      )}
    </div>
  );
}
