import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePrefs } from "../lib/preferences";
import { primaryButton } from "./ui";

/** Link plus modal with the data-handling summary shown to every user. */
export default function PrivacyDialog() {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-zinc-400 underline underline-offset-2">
        {t("privacy_link")}
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            onCancel={(e) => {
              e.preventDefault();
              close();
            }}
            aria-label={t("privacy_title")}
            className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-950 p-6 text-white backdrop:bg-black/70"
          >
            <h2 className="mb-4 text-xl font-bold">{t("privacy_title")}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
              <p>{t("privacy_1")}</p>
              <p>{t("privacy_2")}</p>
              <p>{t("privacy_3")}</p>
              <p>{t("privacy_4")}</p>
            </div>
            <button type="button" onClick={close} className={primaryButton + " mt-6 w-full"}>
              {t("close")}
            </button>
          </dialog>,
          document.body,
        )}
    </>
  );
}
