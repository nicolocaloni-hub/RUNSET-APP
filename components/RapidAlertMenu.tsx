import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import type { AlertType } from "../services/protocol";
import { errorCode } from "../services/store";

const ALERTS: { type: AlertType; icon: string }[] = [
  { type: "TRAFFIC", icon: "🚦" },
  { type: "INCIDENT", icon: "❗" },
  { type: "FUEL", icon: "⛽" },
];

export default function RapidAlertMenu({
  runnerName,
  producerPhone,
  onSend,
}: {
  runnerName: string;
  producerPhone?: string;
  onSend: (type: AlertType) => Promise<void>;
}) {
  const { t, tError } = usePrefs();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function send(type: AlertType) {
    setBusy(true);
    try {
      await onSend(type);
      setFeedback(t("alert_sent"));
    } catch (cause) {
      setFeedback(tError(errorCode(cause)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto relative">
      <button
        type="button"
        aria-label={t("alert_open")}
        aria-expanded={open}
        title={t("alert_open")}
        onClick={() => {
          setOpen(!open);
          setFeedback("");
        }}
        className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-white text-signal-dark shadow-float"
      >
        {open ? <X size={22} /> : <AlertTriangle size={22} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 space-y-2 rounded-[22px] bg-white p-3 shadow-[0_14px_36px_rgba(13,27,42,0.28)]">
          {ALERTS.map(({ type, icon }) => (
            <button
              key={type}
              type="button"
              disabled={busy}
              onClick={() => void send(type)}
              className="w-full rounded-xl bg-ground p-3 text-left text-sm disabled:opacity-50"
            >
              <span aria-hidden="true">{icon}</span> {t(`alert_${type}`)}
            </button>
          ))}
          {feedback && (
            <p role="status" className="p-2 text-xs text-ink2">
              {feedback}
            </p>
          )}
          {producerPhone && (
            <>
              <a className="block rounded-xl p-3 text-sm text-signal-text" href={`tel:${producerPhone.replace(/[^+\d]/g, "")}`}>
                {t("call_producer")}
              </a>
              <a
                className="block rounded-xl p-3 text-sm text-signal-text"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://wa.me/${producerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  t("whatsapp_alert", { name: runnerName }),
                )}`}
              >
                {t("whatsapp_producer")}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
